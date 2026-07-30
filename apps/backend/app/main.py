from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.db import init_db
from app.seed import seed, seed_portal_spec
from app.routers import sessions, analysis, actions, llm, spec

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

@app.on_event("startup")
def _startup() -> None:
    init_db()
    seed()
    seed_portal_spec()

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
