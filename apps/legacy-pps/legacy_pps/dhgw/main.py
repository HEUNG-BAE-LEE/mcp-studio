"""DHGW 조달데이터 연계 게이트웨이 — 가상 레거시 (신형, port 8002).

시연용 가상 시스템이다. 조달청 실제 시스템이 아니다.
가장 최근에 만든 시스템이라는 설정이라 표준 OAuth2(client_credentials), 공개 오픈API 와 같은
필드명 규칙·응답 봉투(response/header/body), rate-limit 헤더를 갖췄다.
문서는 OpenAPI 3.0 하나 (/dhgw/openapi.yaml).
"""
import os
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, Form, Request
from fastapi.responses import FileResponse, JSONResponse

from legacy_pps.common.routes import VIRTUAL, register_ops

CLIENT_ID = os.environ.get("DHGW_CLIENT_ID", "dhgw-ieum")
CLIENT_SECRET = os.environ.get("DHGW_CLIENT_SECRET", "dhgw-secret-26")
TTL = int(os.environ.get("DHGW_TOKEN_TTL", "300"))
_tokens: dict = {}
_remaining = [10000]

ASSETS = Path(__file__).resolve().parents[2] / "assets"
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.post("/oauth2/token")
def token(grant_type: str = Form(""), client_id: str = Form(""), client_secret: str = Form("")):
    if grant_type != "client_credentials":
        return JSONResponse({"error": "unsupported_grant_type"}, status_code=400, headers=VIRTUAL)
    if client_id != CLIENT_ID or client_secret != CLIENT_SECRET:
        return JSONResponse({"error": "invalid_client"}, status_code=401, headers=VIRTUAL)
    t = uuid.uuid4().hex
    _tokens[t] = time.time() + TTL
    return JSONResponse({"access_token": t, "token_type": "Bearer", "expires_in": TTL}, headers=VIRTUAL)


def guard(request: Request):
    a = request.headers.get("Authorization", "")
    if not (a.startswith("Bearer ") and _tokens.get(a[7:], 0) > time.time()):
        return JSONResponse({"error": "invalid_token"}, status_code=401)
    return None


def rate(_request):
    _remaining[0] -= 1
    return {"X-RateLimit-Limit": "10000", "X-RateLimit-Remaining": str(_remaining[0])}


def envelope(items, total, params, error=None, code=None):
    if error:       # 제공기관 오류코드 — 03 No Data, 06 날짜 Format 에러, 07 입력범위 초과, 08 필수값 누락
        return {"response": {"header": {"resultCode": code or "99", "resultMsg": error}, "body": None}}
    return {"response": {"header": {"resultCode": "00", "resultMsg": "정상"},
                         "body": {"items": items, "numOfRows": int(params.get("numOfRows") or 10),
                                  "pageNo": int(params.get("pageNo") or 1), "totalCount": total}}}


_DT = {"bid_ntce_dt", "bid_begin_dt", "bid_clse_dt", "openg_dt"}
_BIZ = {"bidwinnr_bizno", "entrps_bizno"}


def fmt(key, v, _dst=None):
    """공개 오픈API 의 값 습관: 전부 문자열, 일시 'YYYY-MM-DD HH:MM:SS', 일자 'YYYY-MM-DD', 사업자번호 10자리(하이픈 없음).
    쇼핑몰형 서비스만 일자가 YYYYMMDD 다(활용가이드 1.3) — dlvr_req_date 는 그대로 둔다."""
    if key in _DT and len(str(v)) == 12:
        return f"{v[:4]}-{v[4:6]}-{v[6:8]} {v[8:10]}:{v[10:12]}:00"
    if key == "cntrct_cncls_date" and len(str(v)) == 8:
        return f"{v[:4]}-{v[4:6]}-{v[6:8]}"
    if key in _BIZ:
        return str(v).replace("-", "")
    return str(v) if isinstance(v, (int, float)) else v


register_ops(app, "dhgw", guard=guard, header_fn=rate, envelope=envelope, fmt=fmt)


@app.get("/dhgw/openapi.yaml")
def spec():
    return FileResponse(ASSETS / "dhgw.openapi3.yaml", media_type="application/yaml", headers=VIRTUAL)
