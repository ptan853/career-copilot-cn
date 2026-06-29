"""Events 路由 — 事件 CRUD 与审核"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from database import get_session
from models import CareerEvent
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/events", tags=["events"])


class UpdateEventBody(BaseModel):
    title: Optional[str] = None
    organization: Optional[str] = None
    role: Optional[str] = None
    description: Optional[str] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None
    details: Optional[dict] = None
    tags: Optional[list] = None


@router.get("")
def list_events(
    status: str = Query(None),
    event_type: str = Query(None, alias="type"),
    session: Session = Depends(get_session),
):
    """获取事件列表"""
    query = select(CareerEvent).order_by(CareerEvent.time_start.desc().nullslast())
    if status:
        query = query.where(CareerEvent.status == status)
    if event_type:
        query = query.where(CareerEvent.event_type == event_type)

    events = session.exec(query).all()
    return [
        {
            "id": str(e.id),
            "type": e.event_type,
            "title": e.title,
            "organization": e.organization,
            "role": e.role,
            "time_start": e.time_start,
            "time_end": e.time_end,
            "time_precision": e.time_precision,
            "description": e.description,
            "status": e.status,
            "visibility": e.visibility,
            "tags": e.tags,
            "details": e.details,
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]


@router.patch("/{event_id}")
def update_event(event_id: str, body: UpdateEventBody, session: Session = Depends(get_session)):
    """更新事件字段"""
    event = session.get(CareerEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = body.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(event, key, val)

    session.add(event)
    session.commit()
    return {"message": "已更新", "id": event_id}


@router.post("/{event_id}/confirm")
def confirm_event(event_id: str, session: Session = Depends(get_session)):
    """确认事件"""
    event = session.get(CareerEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = "confirmed"
    session.add(event)
    session.commit()
    return {"message": "已确认", "id": event_id, "status": "confirmed"}


@router.post("/{event_id}/archive")
def archive_event(event_id: str, session: Session = Depends(get_session)):
    """归档事件"""
    event = session.get(CareerEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = "archived"
    session.add(event)
    session.commit()
    return {"message": "已归档", "id": event_id, "status": "archived"}
