"""Auth 路由"""
import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from config import settings
from database import get_session
from models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── 内存验证码存储（开发用，生产换 Redis） ───
_phone_codes: dict[str, dict] = {}


# ─── Schemas ───

class SendCodeRequest(BaseModel):
    phone: str


class PhoneLoginRequest(BaseModel):
    phone: str
    code: str


class EmailRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str = ""


class EmailLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    display_name: str


class ErrorResponse(BaseModel):
    detail: str


# ─── 工具函数 ───

def create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_user_by_email(session: Session, email: str) -> User | None:
    return session.exec(select(User).where(User.supabase_user_id == f"email:{email}")).first()


def create_user(session: Session, auth_id: str, display_name: str = "") -> User:
    user = User(supabase_user_id=auth_id, display_name=display_name or "用户")
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


# ─── 手机验证码 ───

@router.post("/phone-code/request")
def request_phone_code(body: SendCodeRequest):
    """发送验证码（开发环境固定 123456）"""
    code = "123456"  # 开发环境固定码
    _phone_codes[body.phone] = {"code": code, "expires": datetime.utcnow() + timedelta(minutes=5)}
    return {"message": "验证码已发送", "code": code}


@router.post("/phone-code/login", response_model=TokenResponse)
def phone_code_login(body: PhoneLoginRequest, session: Session = Depends(get_session)):
    """手机号验证码登录"""
    record = _phone_codes.get(body.phone)
    if not record:
        raise HTTPException(status_code=400, detail="请先发送验证码")
    if record["code"] != body.code:
        raise HTTPException(status_code=400, detail="验证码错误")
    if datetime.utcnow() > record["expires"]:
        raise HTTPException(status_code=400, detail="验证码已过期")

    auth_id = f"phone:{body.phone}"
    user = session.exec(select(User).where(User.supabase_user_id == auth_id)).first()
    if not user:
        user = create_user(session, auth_id)

    return TokenResponse(
        access_token=create_token(str(user.id)),
        user_id=str(user.id),
        display_name=user.display_name or "用户",
    )


# ─── 邮箱密码 ───

@router.post("/email-register", response_model=TokenResponse)
def email_register(body: EmailRegisterRequest, session: Session = Depends(get_session)):
    """邮箱注册"""
    auth_id = f"email:{body.email}"
    if get_user_by_email(session, body.email):
        raise HTTPException(status_code=400, detail="该邮箱已注册")

    # 密码 hash 存 auth_identities（简化：暂时存 user 表 tbd）
    # 注意：实际应该建独立的 auth_identities 表
    # 这里用 supabase_user_id 拼接，后续完善
    user = create_user(session, auth_id, body.display_name)
    return TokenResponse(
        access_token=create_token(str(user.id)),
        user_id=str(user.id),
        display_name=user.display_name or "用户",
    )


@router.post("/email-login", response_model=TokenResponse)
def email_login(body: EmailLoginRequest, session: Session = Depends(get_session)):
    """邮箱密码登录"""
    auth_id = f"email:{body.email}"
    user = session.exec(select(User).where(User.supabase_user_id == auth_id)).first()
    if not user:
        raise HTTPException(status_code=400, detail="邮箱未注册")

    # TODO: 验证密码（需要 auth_identities 表）
    return TokenResponse(
        access_token=create_token(str(user.id)),
        user_id=str(user.id),
        display_name=user.display_name or "用户",
    )


@router.get("/me")
def get_me(token_user_id: str = Depends(lambda: "TODO"), session: Session = Depends(get_session)):
    """获取当前用户信息"""
    # TODO: 从 JWT 解析 user_id
    return {"user_id": "todo", "display_name": "开发中"}


@router.post("/logout")
def logout():
    return {"message": "已退出"}
