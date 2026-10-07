"""시연용 레거시 구매관리 사이트(이음의 API 자동 탐색 대상)를 앱에 싣는다.

    /demo-legacy/po/...       운영(op)
    /demo-legacy/po-stg/...   스테이징(stg). 운영과 상태, 세션이 따로다.
    /demo-legacy/sso/userInfo.do   다른 출처에서 부르는 SSO 접속자 조회 (인증 없음)

사이트 본체는 `app.ieum.demo_legacy.site` 에 있다. 이 모듈은 접두사에 붙이기만 한다.
"""
from fastapi import APIRouter
from fastapi.responses import Response

from app.ieum.demo_legacy import site

router = APIRouter(tags=["ieum-demo-legacy"])

_OP = site.make_router("op", "/demo-legacy/po")
_STG = site.make_router("stg", "/demo-legacy/po-stg")
router.include_router(_OP, prefix="/demo-legacy/po")
router.include_router(_STG, prefix="/demo-legacy/po-stg")


def reset() -> None:
    """운영과 스테이징의 상태(발주 목록, 임시저장, 세션)를 초기값으로 되돌린다. 테스트가 서로 영향을 주지 않게 한다."""
    _OP.reset()  # type: ignore[attr-defined]
    _STG.reset()  # type: ignore[attr-defined]


@router.get("/demo-legacy/sso/userInfo.do", include_in_schema=False)
async def sso_user_info() -> Response:
    """다른 출처에 있는 사내 SSO 서버 흉내. 메인 화면이 localhost 와 127.0.0.1 처럼 다른 출처에서 부른다.

    CORS 미들웨어가 없는 앱에서도 동작하도록 허용 헤더를 응답에 직접 싣는다.
    """
    return site.json_response(
        {"userId": site.DEMO_USER_ID, "userNm": "테스트계정", "deptNm": "구매팀"},
        headers={"Access-Control-Allow-Origin": "*"},
    )
