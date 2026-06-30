"""Vault Profile / Claims / Review / Backup 路由 V2"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from typing import Optional

from database import get_session
from models import Profile, CareerEvent, Claim
from auth_deps import get_current_user_id

router = APIRouter(prefix="/api/vault", tags=["vault"])

# ============================================================
# Profile
# ============================================================

class UpdateProfileBody(BaseModel):
    full_name: Optional[str] = None
    headline: Optional[str] = None
    emails: Optional[list] = None
    phones: Optional[list] = None
    location: Optional[str] = None
    target_locations: Optional[list] = None
    target_roles: Optional[list] = None
    links: Optional[list] = None
    summary: Optional[str] = None
    years_of_experience: Optional[int] = None
    language_preferences: Optional[list] = None
    ai_provider: Optional[str] = None
    ai_api_key: Optional[str] = None


def serialize_profile(profile: Profile) -> dict:
    return {
        "full_name": profile.full_name,
        "headline": profile.headline,
        "emails": profile.emails,
        "phones": profile.phones,
        "location": profile.location,
        "target_locations": profile.target_locations,
        "target_roles": profile.target_roles,
        "links": profile.links,
        "summary": profile.summary,
        "years_of_experience": profile.years_of_experience,
        "language_preferences": profile.language_preferences,
        "ai_provider": profile.ai_provider or "openai",
        "has_ai_api_key": bool(profile.ai_api_key),
        "updated_at": profile.updated_at.isoformat(),
    }


@router.get("/profile")
def get_profile(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    profile = session.exec(
        select(Profile).where(Profile.user_id == user_id)
    ).first()
    if not profile:
        return {"data": None}
    return {"data": serialize_profile(profile)}


@router.patch("/profile")
def update_profile(
    body: UpdateProfileBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    profile = session.exec(
        select(Profile).where(Profile.user_id == user_id)
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    update_data = body.model_dump(exclude_none=True)
    if "ai_provider" in update_data:
        update_data["ai_provider"] = "openai"
    for key, val in update_data.items():
        setattr(profile, key, val)
    session.add(profile)
    session.commit()
    return {"message": "已更新"}


# ============================================================
# Claims
# ============================================================

class CreateClaimBody(BaseModel):
    event_id: str
    claim_text: str
    claim_type: str = "achievement"
    strength: str = "confirmed"


class UpdateClaimBody(BaseModel):
    claim_text: Optional[str] = None
    claim_type: Optional[str] = None
    strength: Optional[str] = None
    visibility: Optional[str] = None


@router.get("/claims")
def list_claims(
    event_id: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user_uuid = _uuid(user_id)
    query = select(Claim).where(Claim.user_id == user_uuid)
    if event_id:
        event_uuid = _uuid(event_id)
        event = session.get(CareerEvent, event_uuid)
        if not event or str(event.user_id) != user_id:
            raise HTTPException(status_code=404, detail="Event not found")
        query = query.where(Claim.career_event_id == event_uuid)
    claims = session.exec(query).all()
    return {"data": [
        {
            "id": str(c.id),
            "career_event_id": str(c.career_event_id),
            "claim_text": c.claim_text,
            "claim_type": c.claim_type,
            "strength": c.strength,
            "visibility": c.visibility,
            "created_at": c.created_at.isoformat(),
        }
        for c in claims
    ]}


@router.post("/claims")
def create_claim(
    body: CreateClaimBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user_uuid = _uuid(user_id)
    event_uuid = _uuid(body.event_id)
    event = session.get(CareerEvent, event_uuid)
    if not event or str(event.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Event not found")
    claim = Claim(
        user_id=user_uuid,
        career_event_id=event_uuid,
        claim_text=body.claim_text,
        claim_type=body.claim_type,
        strength=body.strength,
    )
    session.add(claim)
    session.commit()
    session.refresh(claim)
    return {"data": {"id": str(claim.id), "claim_text": claim.claim_text}}


@router.patch("/claims/{claim_id}")
def update_claim(
    claim_id: str,
    body: UpdateClaimBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    claim = session.get(Claim, _uuid(claim_id))
    if not claim or str(claim.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Claim not found")
    update_data = body.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(claim, key, val)
    session.add(claim)
    session.commit()
    return {"message": "已更新", "claim_id": claim_id}


@router.delete("/claims/{claim_id}")
def delete_claim(
    claim_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    claim = session.get(Claim, _uuid(claim_id))
    if not claim or str(claim.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Claim not found")
    session.delete(claim)
    session.commit()
    return {"message": "已删除", "claim_id": claim_id}


def _uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=404, detail="Resource not found")


# ============================================================
# Review Queue
# ============================================================

class BatchConfirmBody(BaseModel):
    event_ids: list[str]


@router.get("/review-queue")
def get_review_queue(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """获取需要审核的事件列表（含 claims）"""
    events = session.exec(
        select(CareerEvent).where(
            CareerEvent.user_id == user_id,
            CareerEvent.status.in_(["draft", "needs_review"]),
        ).order_by(CareerEvent.updated_at.desc())
    ).all()

    result = []
    for e in events:
        claims = session.exec(
            select(Claim).where(Claim.career_event_id == e.id)
        ).all()
        result.append({
            "id": str(e.id),
            "event_type": e.event_type,
            "title": e.title,
            "role": e.role,
            "organization": e.organization,
            "time_start": e.time_start,
            "time_end": e.time_end,
            "description": e.description,
            "tags": e.tags,
            "status": e.status,
            "source_confidence": e.source_confidence,
            "updated_at": e.updated_at.isoformat(),
            "claims": [
                {
                    "id": str(c.id),
                    "claim_text": c.claim_text,
                    "claim_type": c.claim_type,
                    "strength": c.strength,
                }
                for c in claims
            ],
        })

    # 统计
    total = session.exec(
        select(CareerEvent).where(CareerEvent.user_id == user_id)
    ).all()
    confirmed_count = sum(1 for e in total if e.status == "confirmed")
    review_count = len(events)

    return {
        "data": result,
        "meta": {
            "total_events": len(total),
            "confirmed_events": confirmed_count,
            "review_pending": review_count,
            "progress_pct": round(confirmed_count / max(len(total), 1) * 100, 1),
        },
    }


@router.post("/review-queue/batch-confirm")
def batch_confirm(
    body: BatchConfirmBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """批量确认事件"""
    if not body.event_ids:
        raise HTTPException(status_code=400, detail="请提供事件 ID 列表")

    confirmed = 0
    for eid in body.event_ids:
        event = session.get(CareerEvent, eid)
        if event and str(event.user_id) == user_id:
            event.status = "confirmed"
            session.add(event)
            confirmed += 1

    session.commit()
    return {"message": f"已确认 {confirmed} 个事件", "confirmed_count": confirmed}


# ============================================================
# Readiness
# ============================================================

@router.get("/readiness")
def get_readiness(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """Vault 就绪度统计"""
    total = session.exec(
        select(CareerEvent).where(CareerEvent.user_id == user_id)
    ).all()
    confirmed = [e for e in total if e.status == "confirmed"]
    needs_review = [e for e in total if e.status == "needs_review"]
    draft = [e for e in total if e.status == "draft"]

    coverage = len(confirmed) / max(len(total), 1) * 100
    return {"data": {
        "total_events": len(total),
        "confirmed_events": len(confirmed),
        "needs_review": len(needs_review),
        "draft_events": len(draft),
        "readiness_pct": round(coverage, 1),
        "status": "good" if coverage >= 60 else "needs_work",
    }}
