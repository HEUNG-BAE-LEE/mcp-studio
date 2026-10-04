"""원본 시스템 메뉴: 시스템 연결(명세 읽기, 도구 후보 생성), 명세 재읽기, 삭제."""
import re
from typing import Optional

import httpx
from fastapi import APIRouter, Body

from app.ieum.gateway import credentials, engine, spec
from app.ieum.repositories import deploy as deploy_repo
from app.ieum.repositories import sources as repo
from app.ieum.repositories import studio as tool_repo
from app.ieum.responses import fail, ok

router = APIRouter(prefix="/api/ieum/sources", tags=["ieum-sources"])

MAX_SPEC = 10 * 1024 * 1024
AUTH_LABEL = {"none": "없음", "key": "API Key", "bearer": "Bearer 토큰", "basic": "HTTP Basic", "oauth": "OAuth 2.0", "wss": "WS-Security"}


def _slug(name, taken):
    base = re.sub(r"[^0-9a-z]+", "-", name.lower()).strip("-") or "src"
    sid, n = base, 2
    while sid in taken:
        sid, n = "%s-%d" % (base, n), n + 1
    return sid


def _clean_cred(auth):
    auth = auth or {}
    t = auth.get("type") or "none"
    if t not in AUTH_LABEL:
        raise spec.SpecError("지원하지 않는 인증 방식입니다.")
    cred = {"type": t}
    for k in ("key", "in", "name", "username", "password", "tokenUrl", "clientId", "clientSecret"):
        if auth.get(k):
            cred[k] = str(auth[k]).strip()
    if t in ("key", "bearer") and not cred.get("key"):
        raise spec.SpecError("인증 키를 입력해 주세요.")
    if t == "key" and cred.get("in") not in ("header", "query"):
        cred["in"] = "header"
    if t in ("basic", "wss") and not cred.get("username"):
        raise spec.SpecError("계정을 입력해 주세요.")
    if t == "oauth" and not (cred.get("tokenUrl") and cred.get("clientId") and cred.get("clientSecret")):
        raise spec.SpecError("OAuth 토큰 URL, Client ID, Client Secret을 모두 입력해 주세요.")
    return cred


def _fetch_spec(url, cred):
    if not re.match(r"^https?://", url or ""):
        raise spec.SpecError("명세 URL은 http:// 또는 https:// 로 시작해야 합니다.")
    headers, query = engine.auth_headers({"id": "_spec"}, cred) if cred.get("type") in ("key", "bearer", "basic") else ({}, {})
    try:
        # 명세 주소는 http -> https, 끝 슬래시 같은 리다이렉트를 자주 낸다. 따라간다.
        with httpx.stream("GET", url, headers=headers, params=query, timeout=engine.TIMEOUT, follow_redirects=True) as r:
            raw = engine.read_capped(r, MAX_SPEC)
            status, encoding = r.status_code, r.encoding
    except (httpx.HTTPError, httpx.InvalidURL) as e:
        raise spec.SpecError("명세를 가져오지 못했습니다. 주소를 확인해 주세요. (%s)" % type(e).__name__)
    if status >= 400:
        raise spec.SpecError("명세를 가져오지 못했습니다. (HTTP %d)" % status)
    if len(raw) > MAX_SPEC:
        raise spec.SpecError("명세 파일이 10MB를 넘습니다.")
    return raw.decode(encoding or "utf-8", "replace")


def _analyze(body, cred):
    mode = body.get("mode")
    base = (body.get("base") or "").strip() or None
    if mode == "gov":
        meta, tools = spec.gov_preset(body.get("gov"))
        if cred.get("type") != "key":
            raise spec.SpecError("공공데이터포털은 서비스키가 필요합니다.")
        cred.update({"in": "query", "name": "serviceKey"})
        return meta, tools, None
    if mode == "sample":
        meta, tools = spec.parse_sample(body.get("sampleRequest"), body.get("sampleResponse"), base)
        return meta, tools, None
    if mode in ("rest", "soap"):
        url = (body.get("specUrl") or "").strip()
        text = body.get("specText")
        if not text and not url:
            raise spec.SpecError("명세 URL을 입력하거나 파일을 올려 주세요.")
        if not text:
            text = _fetch_spec(url, cred)
        if mode == "soap":
            meta, tools = spec.parse_wsdl(text, base)
        else:
            meta, tools = spec.parse_spec_text(text, url or None, base)
        return meta, tools, url or None
    raise spec.SpecError("지원하지 않는 연결 방식입니다.")


@router.get("/")
def source_list():
    return ok({
        "workspace": repo.workspace.load(),
        "sources": repo.list_sources(),
        "wizard": {"modes": repo.wizard_modes.load(), "banWords": repo.ban_words.load(), "govApis": repo.gov_apis.load()},
    })


@router.get("/discovery/")
def discovery_result():
    """API 자동 탐색: 탐색 서버가 준비되면 열립니다. (시연용 데이터)"""
    return ok(repo.discovery.load())


@router.post("/connect/")
def source_connect(payload: Optional[dict] = Body(None)):
    """명세를 읽어 시스템을 등록하고 AI 도구 후보를 만든다."""
    body = payload or {}
    try:
        cred = _clean_cred(body.get("auth"))
        meta, tools, spec_url = _analyze(body, cred)
    except (spec.SpecError, engine.ToolError) as e:
        return fail(400, str(e))

    rows = repo.list_sources()
    name = (body.get("name") or "").strip() or meta["name"] or "새 원본 시스템"
    sid = _slug(name, {s["id"] for s in rows})
    taken = {t["id"] for t in tool_repo.flat_tools()}
    for t in tools:  # 도구 이름은 전체에서 유일해야 AI가 구분할 수 있다
        if t["id"] in taken:
            t["id"] = "%s_%s" % (t["id"], re.sub(r"\W", "_", sid))
        taken.add(t["id"])

    src = {"id": sid, "name": name, "desc": meta.get("desc") or "", "proto": body["mode"], "spec": meta["spec"], "base": meta["base"],
           "auth": AUTH_LABEL[cred["type"]], "authType": cred["type"], "sync": "방금", "specUrl": spec_url}
    if meta.get("ns"):
        src["ns"] = meta["ns"]
    credentials.put(sid, cred)
    repo.upsert_source(src)
    saved = tool_repo.replace_source_tools(sid, [tool_repo.with_defaults(t, src) for t in tools])
    return ok({"source": src, "tools": saved}, 201)


@router.post("/{source_id}/reauth/")
def source_reauth(source_id: str, payload: Optional[dict] = Body(None)):
    """인증 정보를 바꾸고 연결을 다시 시도한다."""
    src = repo.get_source(source_id)
    if src is None:
        return fail(404)
    try:
        cred = _clean_cred((payload or {}).get("auth"))
    except spec.SpecError as e:
        return fail(400, str(e))
    credentials.put(source_id, cred)
    return ok(repo.upsert_source({"id": source_id, "err": False, "auth": AUTH_LABEL[cred["type"]], "authType": cred["type"]}))


def _drift(old_tools, new_tools, source):
    """명세를 다시 읽어 바뀐 작업을 반영한다. 응답 필드가 사라진 도구는 '명세 변경'으로 표시한다."""
    old = {t["id"]: t for t in old_tools}
    new = {t["id"]: t for t in new_tools}
    merged, added, drifted = [], [], []
    for tid, t in old.items():
        n = new.get(tid)
        if n is None:
            t = dict(t, status="drift", driftMsg="원본 명세에서 이 작업이 사라졌습니다.")
            drifted.append(tid)
        else:
            old_paths = {r["o"] for r in t.get("res", [])}
            new_paths = {r["o"] for r in n.get("res", [])}
            gone, fresh = old_paths - new_paths, sorted(new_paths - old_paths)
            if gone:
                for r in t["res"]:
                    if r["o"] in gone and not r.get("fixed"):
                        leaf = r["o"].split(".")[-1]
                        r["drift"] = 1
                        r["newO"] = next((p for p in fresh if p.split(".")[-1] == leaf), fresh[0] if fresh else "(삭제됨)")
                t = dict(t, status="drift")
                drifted.append(tid)
        merged.append(t)
    for tid, n in new.items():
        if tid not in old:
            merged.append(tool_repo.with_defaults(n, source))
            added.append(tid)
    return merged, added, drifted


@router.post("/{source_id}/reread/")
def source_reread(source_id: str):
    """명세 URL을 다시 읽어 변경을 감지한다. 변경은 감지만 하고 자동 반영하지는 않는다."""
    src = repo.get_source(source_id)
    if src is None:
        return fail(404)
    if not src.get("specUrl"):
        return fail(400, "명세 URL 없이 연결한 시스템은 다시 읽을 수 없습니다.")
    try:
        cred = credentials.get(source_id)
        text = _fetch_spec(src["specUrl"], cred)
        if src["proto"] == "soap":
            _, new_tools = spec.parse_wsdl(text, src["base"])
        else:
            _, new_tools = spec.parse_spec_text(text, src["specUrl"], src["base"])
    except spec.SpecError as e:
        repo.upsert_source({"id": source_id, "err": True})
        return fail(400, str(e))
    merged, added, drifted = _drift(tool_repo.all_tools().get(source_id, []), new_tools, src)
    saved = tool_repo.replace_source_tools(source_id, merged)
    src = repo.upsert_source({"id": source_id, "sync": "방금", "err": False})
    return ok({"source": src, "tools": saved, "added": added, "drifted": drifted})


@router.get("/{source_id}/")
def source_get(source_id: str):
    src = repo.get_source(source_id)
    if src is None:
        return fail(404)
    return ok(src)


@router.delete("/{source_id}/")
def source_delete(source_id: str):
    src = repo.get_source(source_id)
    if src is None:
        return fail(404)
    ids = {t["id"] for t in tool_repo.all_tools().get(source_id, [])}
    repo.delete_source(source_id)
    tool_repo.delete_source_tools(source_id)
    credentials.delete(source_id)
    rows = deploy_repo.toolsets.load()
    for ts in rows:
        ts["tools"] = [i for i in ts["tools"] if i not in ids]
        ts["deployed"] = [i for i in ts.get("deployed", []) if i not in ids]
    deploy_repo.toolsets.save(rows)
    return ok({"deleted": source_id})
