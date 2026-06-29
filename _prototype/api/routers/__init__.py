"""Career Copilot API — 路由"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/dashboard")
def get_dashboard():
    return {
        "total_sources": 0,
        "total_events": 0,
        "total_targets": 0,
        "total_artifacts": 0,
    }
