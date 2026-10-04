"""이음 API 라우터 모음. `app.main` 이 `router` 하나만 붙인다."""
from fastapi import APIRouter

from app.ieum.routers import dashboard, demo_origin, deploy, logs, mcp, playground, sources, studio

router = APIRouter()
for _module in (dashboard, sources, studio, playground, deploy, logs, mcp, demo_origin):
    router.include_router(_module.router)
