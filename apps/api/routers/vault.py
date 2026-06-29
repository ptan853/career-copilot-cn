"""Vault Profile / Claims / Review / Backup 路由 V2"""
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
    return {"data": {
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
        "updated_at": profile.updated_at.isoformat(),
    }}


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
    query = select(Claim).where(Claim.user_id == user_id)
    if event_id:
        query = query.where(Claim.career_event_id == event_id)
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
    claim = Claim(
        user_id=user_id,
        career_event_id=body.event_id,
        claim_text=body.claim_text,
        claim_type=body.claim_type,
        strength=body.strength,
    )
    session.add(claim)
    session.commit()
    session.refresh(claim)
    return {"data": {"id": str(claim.id), "claim_text": claim.claim_text}}


# ============================================================
# Review Queue
# ============================================================

@router.get("/review-queue")
def get_review_queue(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """获取需要审核的事件列表"""
    events = session.exec(
        select(CareerEvent).where(
            CareerEvent.user_id == user_id,
            CareerEvent.status.in_(["draft", "needs_review"]),
        ).order_by(CareerEvent.updated_at.desc())
    ).all()

    return {"data": [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "title": e.title,
            "status": e.status,
            "source_confidence": e.source_confidence,
            "updated_at": e.updated_at.isoformat(),
        }
        for e in events
    ]}


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
