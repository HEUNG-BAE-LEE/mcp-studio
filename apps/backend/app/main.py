from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import init_db
from app.routers import sessions, analysis

app = FastAPI(title="MCP Studio")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # 데모 전용. 운영 전 반드시 좁힐 것
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(analysis.router)

@app.on_event("startup")
def _startup() -> None:
    init_db()

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
