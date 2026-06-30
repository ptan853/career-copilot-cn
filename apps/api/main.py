"""Career Copilot API V2 — 入口"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from routers.auth import router as auth_router
from routers.core import router as core_router
from routers.vault import router as vault_router
from routers.vault_sources import router as vault_sources_router
from routers.vault_events import router as vault_events_router
from routers.jobs import router as jobs_router
from routers.artifacts import router as artifacts_router


def cors_origins() -> list[str]:
    return [
        origin.strip()
        for origin in settings.cors_origins.split(",")
        if origin.strip()
    ]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Career Copilot CN API V2",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(core_router)
app.include_router(vault_router)
app.include_router(vault_sources_router)
app.include_router(vault_events_router)
app.include_router(jobs_router)
app.include_router(artifacts_router)
