"""CTLG 목록정보 관리 — 가상 레거시 (2009년식, port 18001).

시연용 가상 시스템이다. 조달청 실제 시스템이 아니며 그 화면·주소를 흉내 내지 않는다.
2000년대 후반 전자정부 프레임워크 기반 SI 시스템의 관행을 일부러 따른다.
- 인증 실패도 HTTP 200 + resultCode 로만 구분한다
- 세션이 없거나 만료되면 401 이 아니라 200 + text/html 재로그인 안내 페이지를 준다
  → 상태코드만 보는 연동은 이 HTML 을 '성공'으로 오인한다. 이음이 본문을 보고 걸러내야 한다
- 기계가독 문서는 Swagger 2.0 하나뿐 (/ctlg/v2/api-docs — Springfox 기본 경로)
"""
import os
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, Form, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from legacy_pps.common.routes import VIRTUAL, register_ops

USER = os.environ.get("CTLG_USER", "ctlgsvc")
PW = os.environ.get("CTLG_PW", "ctlg2009!")
TTL = int(os.environ.get("CTLG_SESSION_TTL", "1800"))
_sessions: dict = {}          # WAS 메모리 세션 — 재기동하면 전부 사라진다

ASSETS = Path(__file__).resolve().parents[2] / "assets"
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

EXPIRED_HTML = """<html>
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><title>목록정보 관리 (가상)</title></head>
<body>
<script type="text/javascript">alert("세션이 만료되었습니다.");</script>
<p>세션이 만료되었습니다. 다시 로그인 하십시오.</p>
<p><a href="/ctlg/login.do">로그인 화면으로 이동</a></p>
<p style="color:#888">시연용 가상 시스템</p>
</body>
</html>"""


@app.post("/ctlg/actionLogin.do")
def login(userId: str = Form(""), password: str = Form("")):
    if userId != USER or password != PW:
        return JSONResponse({"resultCode": "9001", "resultMsg": "아이디 또는 비밀번호가 일치하지 않습니다."}, headers=VIRTUAL)
    sid = uuid.uuid4().hex.upper()
    _sessions[sid] = time.time() + TTL
    r = JSONResponse({"resultCode": "0000", "resultMsg": "정상처리되었습니다."}, headers=VIRTUAL)
    r.set_cookie("JSESSIONID", sid, httponly=True)
    return r


def guard(request: Request):
    sid = request.cookies.get("JSESSIONID")
    if not (sid in _sessions and _sessions[sid] > time.time()):
        return HTMLResponse(EXPIRED_HTML)
    return None


def envelope(items, total, params, error=None, code=None):
    if error:
        return {"resultCode": "9999", "resultMsg": error, "resultList": [], "totCnt": 0}
    return {"resultCode": "0000", "resultMsg": "정상처리되었습니다.", "resultList": items, "totCnt": total,
            "paginationInfo": {"currentPageNo": int(params.get("pageIndex") or 1),
                               "recordCountPerPage": int(params.get("recordCountPerPage") or 10), "totalRecordCount": total}}


def fmt(key, v, _dst=None):
    if key == "ceo_nm" and v:              # 대표자명은 가운데를 가린다
        return v[0] + "*" + v[2:] if len(v) > 2 else v[0] + "*"
    if key == "telno" and v:
        a, b, c = v.split("-")
        return f"{a}-****-{c}"
    return str(v) if isinstance(v, (int, float)) else v    # 2009년식 — 숫자도 문자열로 내린다


register_ops(app, "ctlg", guard=guard, envelope=envelope, fmt=fmt)


@app.get("/ctlg/v2/api-docs")
def api_docs():
    return FileResponse(ASSETS / "ctlg.swagger2.json", media_type="application/json", headers=VIRTUAL)
