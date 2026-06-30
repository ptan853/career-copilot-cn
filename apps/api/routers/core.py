"""Jobs / Dashboard / Background Jobs 路由 V2"""
import uuid

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from auth_deps import get_current_user_id
from database import get_session
from models import CareerEvent, Claim, SourceMaterial

router = APIRouter(prefix="/api", tags=["core"])


@router.get("/health")
def health():
    return {"status": "ok"}


def build_dashboard_summary(session: Session, user_id: str) -> dict:
    user_uuid = uuid.UUID(str(user_id))
    events = session.exec(
        select(CareerEvent).where(CareerEvent.user_id == user_uuid)
    ).all()
    sources = session.exec(
        select(SourceMaterial).where(SourceMaterial.user_id == user_uuid)
    ).all()
    claims = session.exec(
        select(Claim).where(Claim.user_id == user_uuid)
    ).all()

    confirmed = [event for event in events if event.status == "confirmed"]
    needs_review = [event for event in events if event.status == "needs_review"]
    draft = [event for event in events if event.status == "draft"]
    archived = [event for event in events if event.status == "archived"]
    usable_total = [event for event in events if event.status != "archived"]

    readiness = 0
    if usable_total:
        readiness = round(len(confirmed) / len(usable_total) * 100)

    return {
        "vault_readiness_pct": readiness,
        "source_count": len(sources),
        "total_events": len(usable_total),
        "confirmed_events": len(confirmed),
        "draft_events": len(draft),
        "needs_review": len(needs_review),
        "archived_events": len(archived),
        "claim_count": len(claims),
    }


@router.get("/dashboard/summary")
def dashboard_summary(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """Dashboard 指标：只统计当前用户的真实数据。"""
    return {"data": build_dashboard_summary(session, user_id)}


@router.get("/dashboard/activity")
def dashboard_activity(user_id: str = Depends(get_current_user_id)):
    return {"data": []}


@router.get("/dashboard/recommendations")
def dashboard_recommendations(user_id: str = Depends(get_current_user_id)):
    return {"data": [
        {"action": "upload_resume", "text": "上传简历或粘贴经历，AI 将提取职业事件"},
        {"action": "add_job", "text": "添加一个目标岗位，开始定向投递准备"},
    ]}


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str, user_id: str = Depends(get_current_user_id)):
    """后台任务状态（占位，后续接 BackgroundJob 表，已加 user scoping）"""
    return {"job_id": job_id, "status": "queued"}
