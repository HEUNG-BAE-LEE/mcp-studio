"""이음 API 라우터 모음. `app.main` 이 `router` 하나만 붙인다."""
from fastapi import APIRouter

from app.ieum.routers import dashboard, demo_legacy, demo_origin, deploy, discovery, logs, playground, sources, studio

router = APIRouter()
for _module in (dashboard, sources, studio, discovery, playground, deploy, logs, demo_origin, demo_legacy):
    router.include_router(_module.router)
