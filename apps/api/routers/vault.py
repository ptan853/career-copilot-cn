"""Vault Profile / Claims / Review / Backup 路由 V2"""
import uuid
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from typing import Optional

from database import get_session
from models import BackgroundJob, Evidence, Profile, CareerEvent, Claim, SourceMaterial
from auth_deps import get_current_user_id

router = APIRouter(prefix="/api/vault", tags=["vault"])


@router.post("/clear")
def clear_vault(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user_uuid = _uuid(user_id)

    for evidence in session.exec(select(Evidence).where(Evidence.user_id == user_uuid)).all():
        session.delete(evidence)

    for claim in session.exec(select(Claim).where(Claim.user_id == user_uuid)).all():
        session.delete(claim)

    for event in session.exec(select(CareerEvent).where(CareerEvent.user_id == user_uuid)).all():
        session.delete(event)

    for job in session.exec(select(BackgroundJob).where(BackgroundJob.user_id == user_uuid)).all():
        session.delete(job)

    for source in session.exec(select(SourceMaterial).where(SourceMaterial.user_id == user_uuid)).all():
        session.delete(source)

    profile = session.exec(select(Profile).where(Profile.user_id == user_uuid)).first()
    if profile:
        session.delete(profile)

    session.commit()
    return {"message": "已清空职业档案"}

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
    ai_provider_name: Optional[str] = None
    ai_api_base: Optional[str] = None
    ai_model_name: Optional[str] = None
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
        "links": normalize_profile_links(profile.links),
        "summary": profile.summary,
        "years_of_experience": profile.years_of_experience,
        "language_preferences": profile.language_preferences,
        "ai_provider": getattr(profile, "ai_provider", "openai") or "openai",
        "ai_provider_name": getattr(profile, "ai_provider_name", None),
        "ai_api_base": getattr(profile, "ai_api_base", None),
        "ai_model_name": getattr(profile, "ai_model_name", None),
        "has_ai_api_key": bool(getattr(profile, "ai_api_key", None)),
        "updated_at": profile.updated_at.isoformat(),
    }


def normalize_profile_links(links: list | None) -> list[dict]:
    normalized = []
    for item in links or []:
        if isinstance(item, str):
            raw = {"url": item}
        elif isinstance(item, dict):
            raw = dict(item)
        else:
            continue

        url = _normalize_link_url(str(raw.get("url") or "").strip())
        if not url:
            continue

        link_type = raw.get("link_type") or _infer_link_type(url)
        normalized.append({
            "label": raw.get("label") or _infer_link_label(link_type, url),
            "url": url,
            "link_type": link_type,
            "show_in_materials": bool(raw.get("show_in_materials", True)),
            "use_for_ai_parsing": bool(raw.get("use_for_ai_parsing", False)),
            "parse_status": raw.get("parse_status") or "not_started",
            "last_parse_error": raw.get("last_parse_error"),
        })
    return normalized


def _normalize_link_url(url: str) -> str:
    if not url:
        return ""
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    parsed = urlparse(url)
    if parsed.netloc.lower() == "www.linkedin.com" and parsed.path.startswith("/in/") and not parsed.path.endswith("/"):
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}/"
    return url


def _infer_link_type(url: str) -> str:
    host = urlparse(url).netloc.lower()
    path = urlparse(url).path
    if host.endswith("linkedin.com") and path.startswith("/in/"):
        return "linkedin_profile"
    if host == "github.com":
        parts = [part for part in path.split("/") if part]
        if len(parts) >= 2:
            return "github_repo"
        return "github_profile"
    if "portfolio" in host:
        return "portfolio"
    return "website"


def _infer_link_label(link_type: str, url: str) -> str:
    labels = {
        "linkedin_profile": "LinkedIn",
        "github_profile": "GitHub",
        "github_repo": "GitHub",
        "portfolio": "Portfolio",
    }
    return labels.get(link_type) or (urlparse(url).netloc or "Link")


@router.get("/profile")
def get_profile(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user_uuid = _uuid(user_id)
    profile = session.exec(
        select(Profile).where(Profile.user_id == user_uuid)
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
    user_uuid = _uuid(user_id)
    profile = session.exec(
        select(Profile).where(Profile.user_id == user_uuid)
    ).first()
    if not profile:
        profile = Profile(user_id=user_uuid)

    update_data = body.model_dump(exclude_none=True)
    if "links" in update_data:
        update_data["links"] = normalize_profile_links(update_data["links"])
    for key, val in update_data.items():
        setattr(profile, key, val)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return {"message": "已更新", "data": serialize_profile(profile)}


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
        if not event or event.user_id != user_uuid:
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
    if not event or event.user_id != user_uuid:
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
    user_uuid = _uuid(user_id)
    claim = session.get(Claim, _uuid(claim_id))
    if not claim or claim.user_id != user_uuid:
        raise HTTPException(status_code=404, detail="Claim not found")
    update_data = body.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(claim, key, val)
    session.add(claim)
    session.commit()
    session.refresh(claim)
    return {"data": {"id": str(claim.id), "claim_text": claim.claim_text}, "message": "已更新"}


@router.delete("/claims/{claim_id}")
def delete_claim(
    claim_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user_uuid = _uuid(user_id)
    claim = session.get(Claim, _uuid(claim_id))
    if not claim or claim.user_id != user_uuid:
        raise HTTPException(status_code=404, detail="Claim not found")
    session.delete(claim)
    session.commit()
    return {"message": "已删除", "claim_id": claim_id}


def _uuid(value: str | uuid.UUID) -> uuid.UUID:
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=404, detail="Resource not found")


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
