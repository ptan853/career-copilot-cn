"""Events 路由 — 事件 CRUD 与审核"""
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from database import get_session
from models import CareerEvent
from auth_deps import get_current_user_id
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/events", tags=["events"])


class CreateEventBody(BaseModel):
    event_type: str
    title: str = "未命名事件"
    organization: Optional[str] = None
    role: Optional[str] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None
    time_precision: str = "month"
    description: Optional[str] = None
    details: Optional[dict] = None
    tags: Optional[list] = None


class UpdateEventBody(BaseModel):
    title: Optional[str] = None
    organization: Optional[str] = None
    role: Optional[str] = None
    description: Optional[str] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None
    details: Optional[dict] = None
    tags: Optional[list] = None


@router.post("")
def create_event(
    body: CreateEventBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """创建新事件"""
    event = CareerEvent(
        user_id=user_id,
        event_type=body.event_type,
        title=body.title,
        organization=body.organization,
        role=body.role,
        time_start=body.time_start,
        time_end=body.time_end,
        time_precision=body.time_precision,
        description=body.description,
        details=body.details or {},
        tags=body.tags or [],
        status="draft",
        visibility="private",
    )
    session.add(event)
    session.commit()
    session.refresh(event)

    return {
        "id": str(event.id),
        "type": event.event_type,
        "title": event.title,
        "organization": event.organization,
        "role": event.role,
        "time_start": event.time_start,
        "time_end": event.time_end,
        "time_precision": event.time_precision,
        "description": event.description,
        "status": event.status,
        "visibility": event.visibility,
        "tags": event.tags,
        "details": event.details,
        "created_at": event.created_at.isoformat(),
    }


@router.get("")
def list_events(
    status: str = Query(None),
    event_type: str = Query(None, alias="type"),
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """获取当前用户事件列表"""
    query = select(CareerEvent).where(
        CareerEvent.user_id == user_id
    ).order_by(CareerEvent.time_start.desc().nullslast())

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
def update_event(
    event_id: str,
    body: UpdateEventBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """更新事件字段"""
    event = session.get(CareerEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if str(event.user_id) != user_id:
        raise HTTPException(status_code=403, detail="无权修改此事件")

    update_data = body.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(event, key, val)

    session.add(event)
    session.commit()
    return {"message": "已更新", "id": event_id}


@router.post("/{event_id}/confirm")
def confirm_event(
    event_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """确认事件"""
    event = session.get(CareerEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if str(event.user_id) != user_id:
        raise HTTPException(status_code=403, detail="无权修改此事件")
    event.status = "confirmed"
    session.add(event)
    session.commit()
    return {"message": "已确认", "id": event_id, "status": "confirmed"}


@router.post("/{event_id}/archive")
def archive_event(
    event_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """归档事件"""
    event = session.get(CareerEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if str(event.user_id) != user_id:
        raise HTTPException(status_code=403, detail="无权修改此事件")
    event.status = "archived"
    session.add(event)
    session.commit()
    return {"message": "已归档", "id": event_id, "status": "archived"}
