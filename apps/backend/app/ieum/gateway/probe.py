"""호스트 명세 탐색: 호스트·포트만 알려주면 표준 경로에서 명세를 찾아 연결 방식을 판정한다.

엠버링크 온보딩의 "알려준 호스트에서 표준 스펙 경로 확인"과 같은 일을 한다.
- 서버발 요청이므로 허용 대역(IEUM_PROBE_CIDRS)만 두드린다. 리다이렉트는 따라가지 않는다.
- 컨텍스트 경로(/ctlg 같은 WAS 루트)를 알면 같이 받아 그 아래도 본다. SI 담당자는 보통 이 값을 안다.
- 명세를 못 찾아도 '열려 있음'은 알려 준다 → 정의서·호출 샘플로 연결하라고 안내한다.
"""
import json

import httpx
import yaml

from app.ieum.gateway.db import check_host
from app.ieum.gateway.spec import SpecError

TIMEOUT = 2.5
PATHS = ["/openapi.json", "/openapi.yaml", "/v3/api-docs", "/v2/api-docs", "/swagger.json", "/api-docs", "/swagger/v1/swagger.json"]
MAX_TARGETS = 20


def _kind(body, ctype):
    head = body[:4000].lstrip()
    if "<wsdl:definitions" in head or ("<definitions" in head and "schemas.xmlsoap.org/wsdl" in head):
        return "soap", None
    doc = None
    try:
        doc = json.loads(body)
    except ValueError:
        if "yaml" in ctype or head.startswith(("openapi:", "swagger:")):
            try:
                doc = yaml.safe_load(body)
            except yaml.YAMLError:
                doc = None
    if isinstance(doc, dict) and isinstance(doc.get("paths"), dict):
        ver = "Swagger %s" % doc["swagger"] if doc.get("swagger") else "OpenAPI %s" % doc.get("openapi", "")
        ops = sum(1 for p in doc["paths"].values() if isinstance(p, dict) for m in p if m in ("get", "post", "put", "patch", "delete"))
        return "rest", {"version": ver, "title": (doc.get("info") or {}).get("title", ""), "ops": ops}
    return None, None


def probe_one(client, host, port, context=""):
    host = (host or "").strip()
    try:
        port = int(port)
    except (TypeError, ValueError):
        return {"host": host, "port": port, "status": "invalid", "message": "포트는 숫자여야 합니다."}
    try:
        check_host(host)
    except SpecError as e:
        return {"host": host, "port": port, "status": "denied", "message": str(e)}
    base = "http://%s:%d" % (host, port)
    ctx = "/" + context.strip("/") if context and context.strip("/") else ""
    tried, reachable = [], False
    candidates = [ctx + p for p in PATHS]
    if ctx:
        candidates += PATHS                        # 컨텍스트 경로가 틀렸을 때를 대비해 루트도 본다
    for path in candidates:
        url = base + path
        tried.append(path)
        try:
            r = client.get(url)
        except httpx.HTTPError:
            continue
        reachable = True
        if r.status_code != 200:
            continue
        kind, info = _kind(r.text, r.headers.get("content-type", ""))
        if kind == "rest":
            return {"host": host, "port": port, "status": "found", "mode": "rest", "specUrl": url, **info}
    if ctx:                                         # SOAP — 서비스 경로를 받았으면 그 주소 + ?wsdl
        url = base + ctx + "?wsdl"
        tried.append(ctx + "?wsdl")
        try:
            r = client.get(url)
            reachable = True
            if r.status_code == 200 and _kind(r.text, "")[0] == "soap":
                return {"host": host, "port": port, "status": "found", "mode": "soap", "specUrl": url, "version": "WSDL (SOAP 1.1)",
                        "title": "", "ops": r.text.count("<wsdl:operation") // 2}
        except httpx.HTTPError:
            pass
    if not reachable:
        return {"host": host, "port": port, "status": "unreachable", "message": "응답이 없습니다. 주소와 방화벽을 확인해 주세요.", "tried": tried}
    return {"host": host, "port": port, "status": "nospec", "message": "서버는 열려 있지만 표준 경로에 명세가 없습니다. 인터페이스정의서나 호출 샘플로 연결하세요.",
            "tried": tried}


def probe(targets):
    if not isinstance(targets, list) or not targets:
        raise SpecError("탐색할 호스트를 하나 이상 입력해 주세요.")
    if len(targets) > MAX_TARGETS:
        raise SpecError("한 번에 %d개까지 탐색할 수 있습니다." % MAX_TARGETS)
    with httpx.Client(timeout=TIMEOUT, follow_redirects=False) as client:
        return [probe_one(client, t.get("host"), t.get("port"), t.get("context", "")) for t in targets]
