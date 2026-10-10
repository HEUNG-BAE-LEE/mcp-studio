"""FINL 재정 연계 인터페이스 — 가상 레거시 (2015년식, port 18003).

시연용 가상 시스템이다. 조달청·재정시스템의 실제 인터페이스가 아니다.
기계가독 명세가 없고, 문서는 인터페이스정의서(assets/finl_인터페이스정의서.xlsx) 하나뿐이다.

[매설 결함 — 고치지 말 것] 정의서의 selectPymntSttus 응답에는 ACNT_DIV_CD(회계구분코드, 필수)가 있지만
이 서버는 돌려주지 않는다. catalog.py 의 fields 에 넣지 않는다.
"""
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from legacy_pps.common.routes import VIRTUAL, register_ops

API_KEY = os.environ.get("FINL_API_KEY", "FINL-KEY-2015")
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def key_guard(request: Request, call_next):
    if request.url.path.startswith("/finl/") and request.headers.get("X-API-KEY") != API_KEY:
        return JSONResponse({"RESULT_CODE": "E", "RESULT_MSG": "인증키가 유효하지 않습니다."}, status_code=403, headers=VIRTUAL)
    return await call_next(request)


def envelope(items, total, params, error=None, code=None):
    if error:
        return {"RESULT_CODE": "E", "RESULT_MSG": error, "DATA_CNT": 0, "DATA": []}
    return {"RESULT_CODE": "S", "RESULT_MSG": "정상 처리되었습니다.", "DATA_CNT": total, "DATA": items}


_AMT = {"req_amt", "asign_amt", "excut_amt", "rmnd_amt"}


def fmt(key, v, _dst=None):
    if key in _AMT:
        return f"{int(v):,}"                  # 금액은 천 단위 쉼표 문자열
    return str(v) if isinstance(v, (int, float)) else v


register_ops(app, "finl", envelope=envelope, fmt=fmt)
