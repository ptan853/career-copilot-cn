"""Vault Events 路由 V2"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select
from typing import Optional

from database import get_session
from models import CareerEvent, Claim, Evidence
from auth_deps import get_current_user_id
from services.source_parse import event_type_to_section

router = APIRouter(prefix="/api/vault/events", tags=["vault-events"])

SECTION_ORDER = ["work", "project", "education", "credential", "research", "portfolio", "skill", "custom"]


class CreateEventBody(BaseModel):
    event_type: str
    title: str = "未命名事件"
    role: Optional[str] = None
    organization: Optional[str] = None
    location: Optional[str] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None
    time_precision: str = "month"
    description: Optional[str] = None
    details_json: Optional[dict] = None
    tags: Optional[list] = None
    visibility: str = "private"


class UpdateEventBody(BaseModel):
    title: Optional[str] = None
    role: Optional[str] = None
    organization: Optional[str] = None
    location: Optional[str] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None
    time_precision: Optional[str] = None
    description: Optional[str] = None
    details_json: Optional[dict] = None
    tags: Optional[list] = None
    visibility: Optional[str] = None
    status: Optional[str] = None


@router.post("")
def create_event(
    body: CreateEventBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user_uuid = _user_uuid(user_id)
    event = CareerEvent(
        user_id=user_uuid,
        event_type=body.event_type,
        title=body.title,
        role=body.role,
        organization=body.organization,
        location=body.location,
        time_start=body.time_start,
        time_end=body.time_end,
        time_precision=body.time_precision,
        description=body.description,
        details_json=body.details_json or {},
        tags=body.tags or [],
        visibility=body.visibility,
    )
    session.add(event)
    session.commit()
    session.refresh(event)
    return {"data": _serialize_event(event, session)}


@router.get("")
def list_events(
    status: str = Query(None),
    event_type: str = Query(None),
    visibility: str = Query(None),
    grouped: bool = Query(False),
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user_uuid = _user_uuid(user_id)
    query = select(CareerEvent).where(CareerEvent.user_id == user_uuid)

    if status:
        query = query.where(CareerEvent.status == status)
    if event_type:
        query = query.where(CareerEvent.event_type == event_type)
    if visibility:
        query = query.where(CareerEvent.visibility == visibility)

    query = query.order_by(CareerEvent.time_start.desc().nullslast())
    events = session.exec(query).all()
    serialized = [_serialize_event(e, session) for e in events]
    if grouped:
        return {"data": _group_events(serialized)}
    return {"data": serialized}


@router.get("/{event_id}")
def get_event(
    event_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    event = session.get(CareerEvent, _uuid(event_id))
    if not event or str(event.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"data": _serialize_event(event, session)}


@router.patch("/{event_id}")
def update_event(
    event_id: str,
    body: UpdateEventBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    event = session.get(CareerEvent, _uuid(event_id))
    if not event or str(event.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = body.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(event, key, val)

    session.add(event)
    session.commit()
    session.refresh(event)
    return {"data": _serialize_event(event, session), "message": "已更新"}


@router.post("/{event_id}/confirm")
def confirm_event(
    event_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    event = session.get(CareerEvent, _uuid(event_id))
    if not event or str(event.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = "confirmed"
    session.add(event)
    session.commit()
    return {"message": "已确认", "event_id": event_id, "status": "confirmed"}


@router.post("/{event_id}/archive")
def archive_event(
    event_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    event = session.get(CareerEvent, _uuid(event_id))
    if not event or str(event.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = "archived"
    session.add(event)
    session.commit()
    return {"message": "已归档", "event_id": event_id, "status": "archived"}


@router.delete("/{event_id}")
def delete_event(
    event_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    event = session.get(CareerEvent, _uuid(event_id))
    if not event or str(event.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Event not found")

    evidences = session.exec(select(Evidence).where(Evidence.career_event_id == event.id)).all()
    for evidence in evidences:
        session.delete(evidence)

    claims = session.exec(select(Claim).where(Claim.career_event_id == event.id)).all()
    for claim in claims:
        session.delete(claim)

    session.delete(event)
    session.commit()
    return {"message": "已删除", "event_id": event_id}


def _user_uuid(user_id: str) -> uuid.UUID:
    return _uuid(user_id)


def _uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=401, detail="Token 无效")


def _section_for_event(e: CareerEvent) -> dict:
    details = e.details_json or {}
    if details.get("section_type") and details.get("section_title"):
        return {
            "section_type": details["section_type"],
            "section_title": details["section_title"],
        }
    return event_type_to_section(e.event_type)


def _serialize_event(e: CareerEvent, session: Session | None = None) -> dict:
    section = _section_for_event(e)
    claims_count = 0
    evidence_count = 0
    if session is not None:
        claims_count = len(session.exec(select(Claim).where(Claim.career_event_id == e.id)).all())
        evidence_count = len(session.exec(select(Evidence).where(Evidence.career_event_id == e.id)).all())
    return {
        "id": str(e.id),
        "section_type": section["section_type"],
        "section_title": section["section_title"],
        "event_type": e.event_type,
        "title": e.title,
        "role": e.role,
        "organization": e.organization,
        "location": e.location,
        "time_start": e.time_start,
        "time_end": e.time_end,
        "time_precision": e.time_precision,
        "description": e.description,
        "details_json": e.details_json,
        "tags": e.tags,
        "status": e.status,
        "visibility": e.visibility,
        "source_confidence": e.source_confidence,
        "source_id": str(e.source_id) if e.source_id else None,
        "claims_count": claims_count,
        "evidence_count": evidence_count,
        "created_at": e.created_at.isoformat(),
        "updated_at": e.updated_at.isoformat(),
    }


def _group_events(events: list[dict]) -> list[dict]:
    groups: dict[str, dict] = {}
    for event in events:
        section_type = event["section_type"]
        if section_type not in groups:
            groups[section_type] = {
                "section_type": section_type,
                "section_title": event["section_title"],
                "events": [],
            }
        groups[section_type]["events"].append(event)
    return sorted(
        groups.values(),
        key=lambda item: SECTION_ORDER.index(item["section_type"]) if item["section_type"] in SECTION_ORDER else len(SECTION_ORDER),
    )
