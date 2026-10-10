"""한 번에 연결(온보딩 위자드) — 엠버링크 온보딩 위자드가 부르던 API 를 같은 모양으로 이음 위에 둔다.

화면(apps/onboarding)은 엠버링크 위자드를 그대로 옮긴 것이라, 요청·응답 모양도 엠버링크 것을 따른다
(`/api/runtime`, `/api/scan/openapi`, `/api/manifest/apply`, `/api/jobs/{id}` …). 다른 점은 접두사와 뒤에서
실제로 일하는 코드다. 변환은 이음의 연결 로직(`sources._analyze` → 원본 시스템 + 도구 후보)과 소스 분석기
(`discovery.scan` → `merge`)를 그대로 쓴다. 그래서 위자드로 만든 도구는 원본 시스템 · 변환 스튜디오 · 배포 메뉴에
하나씩 연결한 것과 똑같이 보인다.

채널별 동작:
    openapi · cloud(VM/PaaS) → 명세(OpenAPI · WSDL)를 읽어 도구 후보 생성
    db · clouddb             → 스키마를 읽어 읽기 전용 조회 도구 생성(gateway.db)
    code                     → Git 저장소 · 로컬 폴더를 분석해 도구 후보 생성, 서버 주소가 있으면 읽기 API 를 한 번씩 불러 대조
    document                 → preview(RAG 적재는 이음 범위 밖이라 접수만 받는다)

클라우드 인벤토리는 preview 다. 조달청 G-Cloud(KT Cloud) 구성을 재현한 가상 구독을 돌려주되, VM 의 명세 탐색은
실제 가상조달기관 레거시 포트를 두드린다. Entra 로그인이나 Azure 구독이 없어도 시연이 끝까지 돈다.
"""
import json
import os
import re
import threading
import uuid
from pathlib import Path
from typing import Optional
from urllib.parse import unquote, urlsplit

import httpx
from fastapi import APIRouter, Body, File, Query, UploadFile

from app.ieum.discovery import merge, repo as code_repo, scan_proc
from app.ieum.discovery.jobs import _tool as disc_tool
from app.ieum.discovery.masking import Masker
from app.ieum.discovery.policy import Policy
from app.ieum.gateway import credentials, engine, probe, spec
from app.ieum.repositories import deploy as deploy_repo
from app.ieum.repositories import sources as src_repo
from app.ieum.repositories import studio as tool_repo
from app.ieum.responses import fail, ok
from app.ieum.routers import sources as src_router
from app.ieum.store import LOCK, JsonStore

router = APIRouter(prefix="/api/ieum/onboarding", tags=["ieum-onboarding"])

projects = JsonStore("onboarding", "projects")
contexts = JsonStore("onboarding", "contexts")
_JOBS: dict = {}                       # 엠버링크와 같다 — 잡은 메모리에만 둔다(재시작하면 사라진다)
_ENV_REF = re.compile(r"\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}")


def _legacy_host():
    return os.environ.get("IEUM_DEMO_LEGACY_HOST", "127.0.0.1")


def _legacy_dsn():
    return os.environ.get("PPS_LEGACY_DSN", "postgresql://pps:pps@%s:55432/pps_legacy" % os.environ.get("IEUM_DEMO_DB_HOST", "127.0.0.1"))


def _demo():
    return src_router._demo()


def _finl_source():
    return Path(__file__).resolve().parent.parent / "demo_legacy" / "finl-web"


# ── 런타임 · 시연 값 ─────────────────────────────────────────────
@router.get("/runtime")
def runtime():
    """app_mode=preview — 문서 채널은 서버 공유 폴더 모달(DocCollect)을, 클라우드는 가상 구독을 쓴다."""
    host = _legacy_host()
    return ok({"app_mode": "preview", "rag_demo": True, "demo": {
        "repo": str(_finl_source()), "baseUrl": "http://%s:18003" % host,
        "dsnRef": "${env:PPS_LEGACY_DSN}", "openapi": "http://%s:18002/dhgw/openapi.yaml" % host,
        "dbName": "pps_legacy 레거시 DB", "dbHostDb": "%s:%s/pps_legacy" % (urlsplit(_legacy_dsn()).hostname, urlsplit(_legacy_dsn()).port or 5432),
        "dbUser": unquote(urlsplit(_legacy_dsn()).username or ""),
        "probes": "18001/ctlg/v2/api-docs, 18002/dhgw/openapi.yaml, 18003, 18004/stck/StockService?wsdl"}})


def _auth_for(url: str) -> dict:
    """명세 · 호출 주소의 포트로 가상조달기관 레거시 계정을 고른다. 엠버링크 stage_auth 와 같은 역할이다."""
    try:
        port = urlsplit(url).port
    except ValueError:
        port = None
    for h in _demo().get("hosts", []):
        if port and int(h["port"]) == port:
            return dict(h["auth"])
    return {"type": "none"}


def _origin(url: str) -> str:
    """명세의 서버 주소는 운영 주소일 수 있다(10.70.1.10). 찾은 주소로 덮는다. SOAP 은 WSDL 의 서비스 주소(경로 포함)를 쓴다."""
    u = urlsplit(url)
    return "" if _mode_of(url) == "soap" else "%s://%s" % (u.scheme, u.netloc)


def _mode_of(url: str) -> str:
    return "soap" if "?wsdl" in url.lower() or url.lower().endswith(".wsdl") else "rest"


@router.post("/scan/openapi")
def scan_openapi(payload: Optional[dict] = Body(None)):
    """'확인' 버튼 — 명세를 실제로 한 번 읽어 기능 수만 센다. 저장하지 않는다(엠버링크는 dry_run 을 무시하고 저장했다)."""
    url = ((payload or {}).get("url") or "").strip()
    if not url:
        return fail(400, "명세 주소를 입력해 주세요.")
    try:
        cred = src_router._clean_cred(_auth_for(url))
        _, tools, _ = src_router._analyze({"mode": _mode_of(url), "specUrl": url, "base": _origin(url)}, cred)
    except (spec.SpecError, engine.ToolError) as e:
        return fail(400, str(e))
    return ok({"discovered": len(tools), "added": [], "total": len(tools), "strategy": "spec-url"})


# ── 프로젝트 · 소개 ──────────────────────────────────────────────
def _slugify(name: str, taken: set) -> str:
    """MCP 주소 이름. 한글 이름은 영문이 거의 남지 않아(예: 'AI') 짧으면 project-xxxx 로 만든다."""
    base = re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")[:30]
    if len(base) < 4:
        base = "project-" + uuid.uuid4().hex[:4]
    slug, n = base, 2
    while slug in taken:
        slug, n = "%s-%d" % (base, n), n + 1
    return slug


@router.post("/projects")
def create_project(payload: Optional[dict] = Body(None)):
    body = payload or {}
    name = (body.get("name") or "").strip()
    if not name:
        return fail(400, "프로젝트 이름을 입력해 주세요.")
    with LOCK:
        rows = projects.load()
        taken = {p["slug"] for p in rows} | {t["slug"] for t in deploy_repo.toolsets.load()}
        p = {"id": "prj-" + uuid.uuid4().hex[:8], "name": name, "description": (body.get("description") or "").strip(),
             "slug": _slugify(name, taken)}
        rows.append(p)
        projects.save(rows)
    return ok(p, 201)


@router.get("/compass/context")
def compass_context(project_id: str = ""):
    row = next((c for c in contexts.load() if c.get("project_id") == project_id), None)
    return ok({"context": row})


@router.post("/compass/context/draft")
def compass_draft(project_id: str = ""):
    """LLM 없이 만든 초안(preview) — 이 프로젝트가 연결한 원본 시스템으로 회사 · 업무 칩과 문장을 채운다."""
    p = next((x for x in projects.load() if x["id"] == project_id), None)
    srcs = [s["name"] for s in src_repo.list_sources() if s.get("project") == project_id]
    narrative = "%s 은(는) 가상조달기관의 %s 을(를) AI 도구로 연결해, 조달 담당자가 계약 · 대금 지급 · 재고를 묻고 바로 확인하게 한다." % (
        (p or {}).get("name", "이 프로젝트"), ", ".join(srcs[:6]) or "레거시 시스템")
    return ok({"draft": {"narrative": narrative, "company": "가상조달기관(시연용)", "industry": "공공 조달",
                         "org": "계약 · 재정 · 비축 담당 부서", "tasks": ["계약 · 납품 조회", "대금 지급 확인", "비축물자 재고 조회"],
                         "users": ["조달 담당 공무원", "수요기관 구매 담당"], "constraints": ["N2SF 등급별 연결", "개인정보 마스킹 · 읽기 전용"],
                         "glossary": {"수요기관": "조달을 요청한 공공기관", "납품요구": "쇼핑몰형 계약의 구매 요청"}}})


@router.put("/compass/context")
def compass_save(payload: Optional[dict] = Body(None), project_id: str = ""):
    b = payload or {}
    pri = b.get("priorities") or ""
    row = {"project_id": project_id, "narrative": (b.get("narrative") or "").strip(),
           "priorities": [x.strip() for x in pri.split(",") if x.strip()] if isinstance(pri, str) else list(pri),
           "removed": b.get("removed") or [], "edited": bool(b.get("edited"))}
    with LOCK:
        contexts.save([c for c in contexts.load() if c.get("project_id") != project_id] + [row])
    return ok({"context": row})


# ── 문서(RAG) — preview: 접수만 받는다 ───────────────────────────
@router.post("/projects/{pid}/rag-pipeline-uploads")
async def rag_upload(pid: str, file: UploadFile = File(...), target: str = Query("")):
    data = await file.read()
    return ok({"id": "up-" + uuid.uuid4().hex[:8], "name": file.filename, "size": len(data), "blob_url": "", "target": target})


@router.post("/projects/{pid}/rag-pipeline-executions")
def rag_execution(pid: str, payload: Optional[dict] = Body(None)):
    docs = (payload or {}).get("documents") or []
    return ok({"id": "rag-" + uuid.uuid4().hex[:8], "project_id": pid, "display_name": (payload or {}).get("display_name", ""),
               "status": "queued", "documents": docs,
               "ingestion_warning": "문서 적재(RAG)는 이음 시연 범위 밖이라 접수만 했습니다."})


def _doc_roots():
    """문서 채널(preview) 의 '서버 공유 폴더'. 저장소에 실제로 있는 파일만 내준다 — 목록에 없는 문서를 지어내지 않는다."""
    # 로컬은 저장소 루트(apps/backend/app/ieum/routers 의 5단계 위). 컨테이너(/app/app/ieum/...)는 그만큼 깊지 않다 —
    # 그때는 파일이 없으니 404 로 끝난다
    here = Path(__file__).resolve().parents
    repo = Path(os.environ.get("IEUM_REPO_ROOT") or (here[5] if len(here) > 5 else here[-1]))
    return {"활용가이드": repo / "examples" / "documents", "정의서": repo / "apps" / "legacy-pps" / "assets"}


@router.get("/rag-data/{folder}/{name}")
def rag_data(folder: str, name: str):
    from fastapi.responses import FileResponse
    root = _doc_roots().get(folder)
    p = (root / name).resolve() if root else None
    if not p or p.parent != root.resolve() or not p.is_file() or p.suffix.lower() not in (".pdf", ".docx", ".xlsx"):
        return fail(404, "문서를 찾을 수 없습니다.")
    return FileResponse(p, filename=name)


# ── 로컬 폴더 고르기 ─────────────────────────────────────────────
@router.get("/fs/list")
def fs_list(path: str = ""):
    """허용한 디렉터리(소스 분석과 같은 범위) 안만 보여 준다. 서버의 아무 폴더나 훑게 두지 않는다."""
    roots = code_repo.allowed_local_roots()
    if not path:
        return ok({"path": "", "parent": None, "isRepo": False,
                   "dirs": [{"name": r.name, "path": str(r), "isRepo": _is_repo(r)} for r in roots if r.is_dir()]})
    p = Path(unquote(path)).expanduser().resolve()
    if not any(p == r or r in p.parents for r in roots) or not p.is_dir():
        return fail(400, "이 서버에서 읽도록 허용한 디렉터리가 아닙니다.")
    dirs = sorted((d for d in p.iterdir() if d.is_dir() and not d.name.startswith(".")), key=lambda d: d.name)
    parent = str(p.parent) if any(p.parent == r or r in p.parent.parents for r in roots) else ""
    return ok({"path": str(p), "parent": parent, "isRepo": _is_repo(p),
               "dirs": [{"name": d.name, "path": str(d), "isRepo": _is_repo(d)} for d in dirs[:200]]})


def _is_repo(p: Path) -> bool:
    return (p / ".git").exists() or (p / "pom.xml").exists() or (p / "src").is_dir()


# ── 클라우드 인벤토리 — preview(조달청 G-Cloud 재현) ─────────────
# 레거시마다 VM 한 대다. 표시 주소는 G-Cloud Private Tier 대역이고, 탐색은 실제 레거시 호스트를 두드린다.
_SUB = {"id": "/subscriptions/pps-gcloud-demo", "name": "조달청 G-Cloud (가상 · KT Cloud 재현)", "state": "Enabled"}
_VMS = [
    {"name": "vm-pps-ctlg", "ip": "10.70.1.11", "port": 18001, "os": "RHEL 7 · Tomcat 6", "role": "CTLG 목록정보 관리"},
    {"name": "vm-pps-dhgw", "ip": "10.70.1.12", "port": 18002, "os": "Rocky 9 · Spring Boot", "role": "DHGW 조달데이터 연계"},
    {"name": "vm-pps-finl", "ip": "10.70.1.13", "port": 18003, "os": "RHEL 7 · JEUS 7", "role": "FINL 재정 연계"},
    {"name": "vm-pps-stck", "ip": "10.70.1.14", "port": 18004, "os": "Windows Server 2012 · IIS", "role": "STCK 비축물자 재고"},
]


def _vm(v):
    return {"id": "%s/vm/%s" % (_SUB["id"], v["name"]), "name": v["name"], "location": "koreacentral", "os": v["os"],
            "size": "Standard_B2s", "private_ip": v["ip"], "role": v["role"], "power": "running"}


@router.get("/inventory/azure/subscriptions")
def inv_subs():
    return ok({"subscriptions": [_SUB]})


@router.get("/inventory/azure/vms")
def inv_vms(subscription: str = ""):
    return ok({"vms": [_vm(v) for v in _VMS]})


@router.get("/inventory/azure/postgres")
def inv_pg(subscription: str = ""):
    return ok({"databases": [{"id": "%s/pg/pg-pps-legacy" % _SUB["id"], "name": "pg-pps-legacy", "engine": "postgres",
                              "fqdn": "pg-pps-legacy.private.postgres.database.azure.com", "admin": "pps_reader",
                              "dsn_ref": "${env:PPS_LEGACY_DSN}"}]})


@router.get("/inventory/azure/hosts")
def inv_hosts(subscription: str = ""):
    return ok({"hosts": []})


@router.get("/inventory/azure/apim")
def inv_apim(subscription: str = ""):
    return ok({"apis": []})


def _parse_probe(raw):
    m = re.match(r"^\s*(\d{1,5})(/\S*)?\s*$", str(raw or ""))
    return (int(m.group(1)), m.group(2) or "") if m and 0 < int(m.group(1)) < 65536 else None


def _probe_at(host, port, path, shown_ip):
    """한 포트를 두드린다. 경로가 있으면 그 경로(+ WSDL 이면 그대로), 없으면 표준 경로들."""
    with httpx.Client(timeout=probe.TIMEOUT, follow_redirects=False) as client:
        if path and "?wsdl" not in path.lower():
            ctx = path.rsplit("/", 1)[0] if path.count("/") > 1 else ""
            hit = probe.probe_one(client, host, port, ctx)
        else:
            hit = probe.probe_one(client, host, port, path.split("?")[0] if path else "")
    if hit.get("status") != "found":
        return None
    u = urlsplit(hit["specUrl"])
    spec_path = u.path + ("?" + u.query if u.query else "")
    return {"scheme": u.scheme, "address": host, "shown": shown_ip, "port": port, "spec_path": spec_path,
            "spec_type": hit.get("version") or ("WSDL" if hit.get("mode") == "soap" else "OpenAPI"),
            "api_count": hit.get("ops") or 0}


@router.post("/inventory/azure/host-probe")
def inv_host_probe(payload: Optional[dict] = Body(None)):
    b = payload or {}
    hit = _probe_at(b.get("host", ""), int(b.get("port") or 443), "", b.get("host", ""))
    return ok({"found": True, **hit} if hit else {"found": False, "reason": "표준 명세 경로에서 찾지 못했습니다", "can_retry_with_port": False})


@router.post("/inventory/azure/vm-probe")
def inv_vm_probe(payload: Optional[dict] = Body(None)):
    """VM 하나의 명세를 찾는다. 가상 VM 은 IP 가 달라도 실제로는 같은 레거시 호스트라, 그 VM 의 포트만 두드린다."""
    b = payload or {}
    v = next((x for x in _VMS if b.get("vm_id", "").endswith("/" + x["name"])), None)
    if not v:
        return ok({"found": False, "reason": "VM 을 찾을 수 없습니다", "can_retry_with_port": False})
    picked = _parse_probe(b.get("port")) if b.get("port") else None
    extra = [p for p in (_parse_probe(x) for x in b.get("extra_ports") or []) if p]
    tries = [picked] if picked else [p for p in extra if p[0] == v["port"]] or [(v["port"], "")]
    for port, path in tries:
        if port != v["port"]:
            continue                                   # 다른 VM 의 포트 — 이 VM 에서는 닫혀 있다
        hit = _probe_at(_legacy_host(), port, path, v["ip"])
        if hit:
            return ok({"found": True, **hit})
    labels = ["%d%s" % t for t in tries]
    return ok({"found": False, "address": v["ip"], "tried_ports": labels, "can_retry_with_port": True,
               "reason": "%s(%s)에서 API 설명서를 찾지 못했습니다. 명세 없이 운영 중인 시스템이면 소스 코드로 연결하세요." % (v["ip"], ", ".join(labels))})


# ── 변환 잡 ──────────────────────────────────────────────────────
class _Job:
    def __init__(self, project, resources):
        self.id = uuid.uuid4().hex[:10]
        self.project = project
        self.resources = [{"name": r["name"], "type": r["type"], "target": r.get("target", "mcp"), "path": r.get("path"),
                           "state": "pending", "count": 0, "collected": 0, "detail": "", "stage": ""} for r in resources]
        self.log, self.tools, self.publish, self.orphans, self.unaddressed = [], [], {}, [], []
        self.status, self.toolset = "running", None
        self._seq, self.lock = 0, threading.Lock()

    def say(self, msg, level="info"):
        with self.lock:
            self._seq += 1
            self.log.append({"seq": self._seq, "level": level, "msg": msg})

    def set(self, name, **kw):
        with self.lock:
            for r in self.resources:
                if r["name"] == name:
                    r.update({k: v for k, v in kw.items() if v is not None})
                    return

    def view(self):
        with self.lock:
            done = sum(1 for r in self.resources if r["state"] in ("done", "warn", "fail"))
            total = len(self.resources)
            return {"id": self.id, "project": self.project, "status": self.status, "pct": round(done / total * 100) if total else 0,
                    "total": total, "completed": done, "resources": [dict(r) for r in self.resources], "log": list(self.log),
                    "tools": list(self.tools), "publish": dict(self.publish), "orphans": list(self.orphans),
                    "unaddressed": list(self.unaddressed), "toolset": self.toolset}


def _env_default(name: str) -> str:
    """시연용 참조의 기본값 — 환경변수가 없으면 로컬 레거시 DB(start.sh 가 띄우는 것)를 가리킨다."""
    if name == "PPS_LEGACY_DSN":
        return _legacy_dsn()
    if name == "PPS_DB_PASSWORD":
        return unquote(urlsplit(_legacy_dsn()).password or "")
    return ""


def _expand(text: str) -> str:
    return _ENV_REF.sub(lambda m: os.environ.get(m.group(1), _env_default(m.group(1))), text or "")


def _db_cred(dsn: str) -> dict:
    """SQLAlchemy DSN(참조 포함) → 이음 DB 계정. ${env:…} 는 서버 환경에서 푼다 — 화면에는 비밀이 없다."""
    raw = _expand(dsn)
    if "://" in raw.split("@")[-1]:                    # 비밀번호 자리에 DSN 전체를 참조로 넣은 경우
        raw = raw.split("@", 1)[-1] if raw.count("://") > 1 else raw
    if "://" not in raw:
        raw = "postgresql://" + raw
    u = urlsplit(raw)
    db_name = u.path.lstrip("/").split("/")[0]
    return {"type": "db", "driver": "postgresql", "host": u.hostname or "", "port": str(u.port or 5432),
            "database": db_name, "schema": "public", "username": unquote(u.username or ""), "password": unquote(u.password or "")}


def _save(job, res, mode, meta, tools, cred, spec_url=None, base=None, proto=None, how=None):
    """원본 시스템 + 도구 후보로 저장한다. sources.source_connect 와 같은 규칙(도구 이름 전역 유일).

    위자드는 읽기 도구만 만든다(엠버링크와 같다 — 완료 화면이 '모두 읽기만 하는 기능' 이라고 말한다).
    쓰기 API 는 버리지 않고 로그에 남긴다. 필요하면 원본 시스템 메뉴에서 하나씩 검토해 등록한다."""
    writes = [t for t in tools if t.get("mode") == "write"]
    if writes:
        tools = [t for t in tools if t.get("mode") != "write"]
        job.say("[%s] 쓰기 API %d개(%s)는 도구로 만들지 않았습니다 — 필요하면 원본 시스템 메뉴에서 검토 후 등록합니다"
                % (res["name"], len(writes), ", ".join("%s %s" % (t.get("method") or "", t.get("path") or t["id"]) for t in writes[:3])), "warn")
    with LOCK:
        rows = src_repo.list_sources()
        name = res["name"] or meta.get("name") or "새 원본 시스템"
        sid = src_router._slug(name, {s["id"] for s in rows})
        taken = {t["id"] for t in tool_repo.flat_tools()}
        for t in tools:
            if t["id"] in taken:
                t["id"] = "%s_%s" % (t["id"], re.sub(r"\W", "_", sid))
            taken.add(t["id"])
        src = {"id": sid, "name": name, "desc": meta.get("desc") or "", "proto": proto or mode, "spec": how or meta.get("spec", ""),
               "base": base or meta.get("base", ""), "auth": src_router.AUTH_LABEL.get(cred["type"], "없음"), "authType": cred["type"],
               "sync": "방금", "specUrl": spec_url, "project": job.project_id}
        if meta.get("ns"):
            src["ns"] = meta["ns"]
        credentials.put(sid, cred)
        src_repo.upsert_source(src)
        saved = tool_repo.replace_source_tools(sid, [tool_repo.with_defaults(t, src) for t in tools])
    backend = "db" if mode == "db" else "http"
    trust = {t["id"]: t.get("_trust", "unknown") for t in tools}     # 저장하면서 빠지는 값이라 미리 잡아 둔다
    for t in saved:
        job.tools.append({"name": t["id"], "source": res["name"], "kind": res["type"], "backend": backend,
                          "method": t.get("method", ""), "path": t.get("path", ""), "summary": (t.get("title") or t.get("desc") or "")[:160],
                          "trust": trust.get(t["id"], "unknown"), "sourceId": sid})
    return saved


def _do_spec(job, res):
    url = (res.get("url") or "").strip()
    mode = _mode_of(url)
    job.set(res["name"], state="running", stage="spec-url")
    job.say("[%s] 명세를 읽습니다 · %s" % (res["name"], url))
    cred = src_router._clean_cred(_auth_for(url))
    meta, tools, spec_url = src_router._analyze({"mode": mode, "specUrl": url, "base": _origin(url)}, cred)
    job.set(res["name"], collected=len(tools))
    job.say("[%s] %s · 오퍼레이션 %d개" % (res["name"], meta.get("spec") or "명세", len(tools)), "ok")
    saved = _save(job, res, mode, meta, tools, cred, spec_url)
    job.set(res["name"], state="done", count=len(saved), detail="%s · 도구 후보 %d개" % (meta.get("spec", ""), len(saved)))


def _do_db(job, res):
    job.set(res["name"], state="running", stage="db-schema")
    cred = _db_cred(res.get("dsn") or "")
    job.say("[%s] 표 구조를 읽습니다 · %s:%s/%s (읽기 전용)" % (res["name"], cred["host"], cred["port"], cred["database"]))
    meta, tools, _ = src_router._analyze({"mode": "db", "name": res["name"]}, src_router._clean_cred(cred))
    job.set(res["name"], collected=len(tools))
    job.say("[%s] 표 %d개 · 조회 도구 %d개" % (res["name"], len({t.get("table") for t in tools}), len(tools)), "ok")
    saved = _save(job, res, "db", meta, tools, src_router._clean_cred(cred))
    job.set(res["name"], state="done", count=len(saved), detail="%s · 조회 도구 %d개" % (meta.get("spec", "DB 스키마"), len(saved)))


def _verify(base, apis, cred):
    """서버 주소가 있으면 읽기 API 를 한 번씩 불러 실재를 확인한다. 쓰기는 부르지 않는다(엠버링크 reconcile 과 같은 원칙)."""
    headers, query = engine.auth_headers({"id": "_verify"}, cred) if cred.get("type") in ("key", "bearer", "basic") else ({}, {})
    out = {}
    with httpx.Client(timeout=3, follow_redirects=False) as client:
        for a in apis:
            if a["m"] != "GET" or a.get("mode") != "read":
                out[a["id"]] = "declared_only"
                continue
            try:
                r = client.get(base.rstrip("/") + a["path"], headers=headers, params=query or None)
                out[a["id"]] = "verified" if r.status_code != 404 else "declared_only"
            except httpx.HTTPError:
                out[a["id"]] = "declared_only"
    return out


def _do_code(job, res):
    where = res.get("repo_url") or res.get("path") or ""
    base = (res.get("base_url") or "").strip()
    job.set(res["name"], state="running", stage="route-discovery")
    job.say("[%s] 소스를 읽습니다 · %s" % (res["name"], where))
    root, cleanup, label = code_repo.prepare(where, res.get("branch", ""), _expand(res.get("token_ref", "")))
    try:
        if res.get("subpath"):
            root = (root / res["subpath"]).resolve()
        found = scan_proc.run(str(root), "auto", timeout=120)
    finally:
        cleanup()
    eps = [e for e in found.endpoints if e.kind in ("api", "file")]
    job.set(res["name"], collected=len(eps))
    job.say("[%s] %s · URL 매핑 %d개" % (res["name"], found.framework or "프레임워크 미확인", len(eps)), "ok" if eps else "warn")
    if not eps:
        job.set(res["name"], state="warn", detail="URL 매핑을 찾지 못했습니다")
        return
    masker = Masker(pii=True)
    merged = merge.build(found, None, Policy(base=base or "http://localhost"), masker)
    merge.finalize(merged["apis"], masker)                 # 도구 이름 · 설명은 finalize 가 채운다
    apis = [a for a in merged["apis"] if a.get("tool")]
    cred = src_router._clean_cred(_auth_for(base)) if base else {"type": "none"}
    trust = {}
    if base:
        job.set(res["name"], stage="runtime-openapi")
        job.say("[%s] 서버(%s)에 읽기 API 를 한 번씩 불러 대조합니다" % (res["name"], base))
        trust = _verify(base, apis, cred)
        job.say("[%s] 실재 확인 %d / %d" % (res["name"], sum(v == "verified" for v in trust.values()), len(apis)), "ok")
    else:
        job.unaddressed.append(res["name"])
        job.say("[%s] 서버 주소가 없어 코드만 확인했습니다 — 만들어진 도구는 주소를 정해야 부를 수 있습니다" % res["name"], "warn")
    tools = []
    for a in apis:
        t = disc_tool(a, "onb-" + job.id)
        t["_trust"] = trust.get(a["id"], "unknown")
        tools.append(t)
    meta = {"name": res["name"], "desc": "소스 분석으로 찾은 API %d개" % len(tools)}
    saved = _save(job, res, "disc", meta, tools, cred, base=base, proto="disc", how="Git 소스로 추론")
    job.set(res["name"], state="done", count=len(saved), detail="%s · 도구 후보 %d개" % (found.framework, len(saved)))


def _run(job, resources, publish):
    for res in resources:
        try:
            if res["type"] == "openapi":
                _do_spec(job, res)
            elif res["type"] == "db":
                _do_db(job, res)
            elif res["type"] == "code":
                _do_code(job, res)
            elif res["type"] == "document":
                job.set(res["name"], state="warn", stage="doc-chunk", detail="문서 적재(RAG)는 이음 시연 범위 밖입니다")
                job.say("[%s] 문서는 접수만 했습니다 — 적재(RAG)는 이음 시연 범위 밖입니다" % res["name"], "warn")
            else:
                job.set(res["name"], state="fail", detail="지원하지 않는 종류입니다")
        except Exception as e:                          # 한 소스가 실패해도 나머지는 계속 간다 — 원문을 그대로 남긴다
            job.set(res["name"], state="fail", detail=str(e)[:300])
            job.say("[%s] %s" % (res["name"], str(e)[:300]), "error")
    try:
        if publish and job.tools:
            _publish(job)
    except Exception as e:                              # 게시가 실패해도 잡은 끝나야 한다 — 화면이 '변환 중'에 갇힌다
        job.say("도구 묶음 초안을 만들지 못했습니다: %s" % str(e)[:300], "error")
    with job.lock:
        job.status = "done" if any(r["state"] in ("done", "warn") for r in job.resources) else "failed"


def _publish(job):
    """만든 도구를 프로젝트 이름의 도구 묶음 초안에 담는다. 배포는 사람이 검토한 뒤 배포 메뉴에서 한다."""
    p = next((x for x in projects.load() if x["id"] == job.project_id), None) or {"name": job.project, "slug": _slugify(job.project, set())}
    ids = [t["name"] for t in job.tools]
    with LOCK:
        rows = deploy_repo.toolsets.load()
        ts = next((t for t in rows if t["slug"] == p["slug"]), None)
        if ts:
            ts["tools"] = list(dict.fromkeys(ts["tools"] + ids))
        else:
            ts = {"id": "ts-" + p["slug"], "name": p["name"], "slug": p["slug"], "audience": "전 직원", "tools": ids,
                  "ver": "v0.1", "status": "draft", "updated": "방금", "deployed": []}
            rows.append(ts)
        deploy_repo.toolsets.save(rows)
    job.toolset = {"id": ts["id"], "slug": ts["slug"], "tools": len(ts["tools"])}
    # notes 는 엠버링크 완료 화면이 '호출 주소 없음' 칩으로 그린다 — 주소를 못 받은 소스만 싣는다
    job.publish = {"published": len(ids), "held": [],
                   "notes": ["%s — 서버 주소가 없어 만든 도구를 아직 부를 수 없습니다" % n for n in job.unaddressed]}
    job.say("도구 %d개를 도구 묶음 초안 '%s'에 담았습니다 — 변환 스튜디오에서 검토한 뒤 배포하면 MCP 서버로 뜹니다" % (len(ids), p["name"]), "ok")


@router.post("/manifest/apply")
def manifest_apply(payload: Optional[dict] = Body(None)):
    body = payload or {}
    manifest = body.get("manifest") or {}
    resources = [r for r in manifest.get("resources") or [] if r.get("name") and r.get("type")]
    if not resources:
        return fail(400, "연결할 소스를 하나 이상 담아 주세요.")
    names = [r["name"] for r in resources]
    if len(set(names)) != len(names):
        return fail(400, "같은 이름의 소스가 두 번 담겼습니다: %s" % ", ".join(sorted({n for n in names if names.count(n) > 1})))
    job = _Job(manifest.get("project") or "", resources)
    job.project_id = body.get("project_id") or ""
    _JOBS[job.id] = job
    threading.Thread(target=_run, args=(job, resources, bool(body.get("publish"))), daemon=True).start()
    return ok({"jobId": job.id, "total": len(resources)})


@router.get("/jobs/{job_id}")
def job_status(job_id: str):
    job = _JOBS.get(job_id)
    if not job:
        return fail(404, "변환 작업을 찾을 수 없습니다. 서버가 다시 시작되면 진행 중이던 작업은 사라집니다.")
    return ok(job.view())


def _demo_selfcheck():
    assert _parse_probe("18001/ctlg/v2/api-docs") == (18001, "/ctlg/v2/api-docs")
    assert _parse_probe(" 18003 ") == (18003, "") and _parse_probe("70000") is None
    os.environ.pop("PPS_LEGACY_DSN", None)
    c = _db_cred("${env:PPS_LEGACY_DSN}")
    assert (c["host"], c["port"], c["database"], c["username"]) == ("127.0.0.1", "55432", "pps_legacy", "pps"), c
    c = _db_cred("postgresql+psycopg://pps_reader:s3cret@10.0.0.5:5432/pps_legacy")
    assert (c["host"], c["username"], c["password"]) == ("10.0.0.5", "pps_reader", "s3cret"), c
    c = _db_cred("postgresql+psycopg://pps:${env:PPS_DB_PASSWORD}@127.0.0.1:55432/pps_legacy")
    assert (c["username"], c["password"], c["database"]) == ("pps", "pps", "pps_legacy"), c
    assert _mode_of("http://h:1/stck/StockService?wsdl") == "soap" and _mode_of("http://h/openapi.yaml") == "rest"


if __name__ == "__main__":
    _demo_selfcheck()
    print("ok")
