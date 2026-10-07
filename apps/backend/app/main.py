from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.db import init_db
from app.catalog_seed import seed_call_logs, seed_catalog
from app.seed import backfill_action_source_kind, seed, seed_credentials, seed_portal_spec
from app.routers import sessions, analysis, actions, llm, spec
from app.ieum.console import mount_console
from app.ieum.routers import router as ieum_router
from app.ieum.runtime import deployer as ieum_deployer
from app.routers import sessions, analysis, actions, llm, spec, market, skills, autocrawl

app = FastAPI(title="MCP Studio")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # 데모 전용. 운영 전 반드시 좁힐 것
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(analysis.router)
app.include_router(actions.router)
app.include_router(llm.router)
app.include_router(spec.router)
# 이음 게이트웨이: API(/api/ieum), 시연용 원본(/demo-origin), 콘솔(/ieum/). 배포한 MCP 서버는 별도 프로세스로 뜬다.
# 콘솔 마운트는 아래 관리자 화면의 `/` 마운트보다 먼저여야 한다.
app.include_router(ieum_router)
mount_console(app)
app.include_router(market.router)
app.include_router(skills.router)
app.include_router(autocrawl.router)

@app.on_event("startup")
def _startup() -> None:
    init_db()
    seed()
    seed_portal_spec()
    backfill_action_source_kind()
    # 마켓이 비어 있으면 플랫폼이라는 개념 자체가 전달되지 않는다.
    seed_catalog()
    seed_call_logs()
    # 액션이 만들어진 뒤에 돈다 — 무슨 키가 필요한지는 액션 스펙이 정한다.
    seed_credentials()
    # 이음: 배포 중이던 MCP 서버를 같은 스냅샷으로 다시 띄운다. 기다리지 않고 돌아온다.
    ieum_deployer.restore_all()


@app.on_event("shutdown")
def _shutdown() -> None:
    # 이음의 MCP 서버 프로세스는 콘솔과 함께 내려간다(남겨 두면 고아가 된다).
    ieum_deployer.shutdown()

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# 컨테이너 배포에서만 존재하는 디렉터리다. 로컬 개발(vite :5173)에서는 없으므로
# 아래 마운트가 건너뛰어지고 동작이 그대로 유지된다.
_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


class _SpaStaticFiles(StaticFiles):
    """없는 경로는 index.html 로 돌려준다.

    관리자 화면은 react-router 를 쓰므로 `/sessions/3` 같은 주소를 새로고침하면
    서버에 그 파일을 달라는 요청이 온다. 404 를 그대로 내면 촬영 중 화면이 빈다.
    """

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


# API 라우터보다 뒤에 마운트해야 한다. Starlette 는 등록 순서로 경로를 찾으므로
# 먼저 붙이면 정적 파일 핸들러가 /api/* 를 먼저 삼킨다.
if _STATIC_DIR.is_dir():
    app.mount("/", _SpaStaticFiles(directory=_STATIC_DIR, html=True), name="admin")
