"""콘솔 API 공통 응답 봉투: {resultCode, resultMsg, resultData}.

HTTP 상태 코드도 resultCode 와 같게 보낸다. 화면(api.js)은 둘 중 어느 쪽으로든 실패를 읽는다.
"""
from typing import Any, Optional

from fastapi.responses import JSONResponse

MESSAGES = {
    200: "성공",
    201: "등록했습니다.",
    400: "요청 값이 올바르지 않습니다.",
    401: "인증 정보가 없거나 올바르지 않습니다.",
    404: "찾을 수 없습니다.",
    500: "서버 오류가 났습니다.",
}


def ok(data: Any = None, code: int = 200) -> JSONResponse:
    return JSONResponse({"resultCode": code, "resultMsg": MESSAGES.get(code), "resultData": data}, status_code=code)


def fail(code: int, message: Optional[str] = None) -> JSONResponse:
    return JSONResponse({"resultCode": code, "resultMsg": message or MESSAGES.get(code), "resultData": None}, status_code=code)
