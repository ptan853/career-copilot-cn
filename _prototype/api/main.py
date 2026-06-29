"""Career Copilot API — 入口"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import router as main_router
from routers.auth import router as auth_router
from routers.sources import router as sources_router
from routers.events import router as events_router
from routers.jobs import router as jobs_router
from routers.profile import router as profile_router
from database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Career Copilot CN API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(main_router)
app.include_router(auth_router)
app.include_router(sources_router)
app.include_router(events_router)
app.include_router(jobs_router)
app.include_router(profile_router)
