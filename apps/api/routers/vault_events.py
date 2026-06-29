"""Vault Events 路由 V2"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select
from typing import Optional

from database import get_session
from models import CareerEvent
from auth_deps import get_current_user_id

router = APIRouter(prefix="/api/vault/events", tags=["vault-events"])


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
    event = CareerEvent(
        user_id=user_id,
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
    return {"data": _serialize_event(event)}


@router.get("")
def list_events(
    status: str = Query(None),
    event_type: str = Query(None),
    visibility: str = Query(None),
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    query = select(CareerEvent).where(CareerEvent.user_id == user_id)

    if status:
        query = query.where(CareerEvent.status == status)
    if event_type:
        query = query.where(CareerEvent.event_type == event_type)
    if visibility:
        query = query.where(CareerEvent.visibility == visibility)

    query = query.order_by(CareerEvent.time_start.desc().nullslast())
    events = session.exec(query).all()
    return {"data": [_serialize_event(e) for e in events]}


@router.get("/{event_id}")
def get_event(
    event_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    event = session.get(CareerEvent, event_id)
    if not event or str(event.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"data": _serialize_event(event)}


@router.patch("/{event_id}")
def update_event(
    event_id: str,
    body: UpdateEventBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    event = session.get(CareerEvent, event_id)
    if not event or str(event.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = body.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(event, key, val)

    session.add(event)
    session.commit()
    session.refresh(event)
    return {"data": _serialize_event(event), "message": "已更新"}


@router.post("/{event_id}/confirm")
def confirm_event(
    event_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    event = session.get(CareerEvent, event_id)
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
    event = session.get(CareerEvent, event_id)
    if not event or str(event.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = "archived"
    session.add(event)
    session.commit()
    return {"message": "已归档", "event_id": event_id, "status": "archived"}


def _serialize_event(e: CareerEvent) -> dict:
    return {
        "id": str(e.id),
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
        "created_at": e.created_at.isoformat(),
        "updated_at": e.updated_at.isoformat(),
    }
