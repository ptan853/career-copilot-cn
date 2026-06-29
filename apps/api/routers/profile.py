"""Profile 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional

from database import get_session
from models import Profile

router = APIRouter(prefix="/api/profile", tags=["profile"])


class UpdateProfileBody(BaseModel):
    legal_name: Optional[str] = None
    preferred_name: Optional[str] = None
    headline: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location_city: Optional[str] = None
    target_cities: Optional[list] = None
    target_roles: Optional[list] = None


@router.get("")
def get_profile(session: Session = Depends(get_session)):
    """获取 Profile"""
    # TODO: 根据 user_id 获取
    profile = session.exec(select(Profile).limit(1)).first()
    if not profile:
        return {"profile": None}
    return {
        "legal_name": profile.legal_name,
        "preferred_name": profile.preferred_name,
        "headline": profile.headline,
        "email": profile.email,
        "phone": profile.phone,
        "location_city": profile.location_city,
        "target_cities": profile.target_cities,
        "target_roles": profile.target_roles,
    }


@router.patch("")
def update_profile(body: UpdateProfileBody, session: Session = Depends(get_session)):
    """更新 Profile"""
    profile = session.exec(select(Profile).limit(1)).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    update_data = body.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(profile, key, val)
    session.add(profile)
    session.commit()
    return {"message": "已更新"}
