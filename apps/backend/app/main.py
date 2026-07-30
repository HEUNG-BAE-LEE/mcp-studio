from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import init_db
from app.seed import backfill_action_source_kind, seed, seed_portal_spec
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
    backfill_action_source_kind()

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
