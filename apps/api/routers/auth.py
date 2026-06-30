"""Auth routes V2 — phone/email verification code, email/password, Google OAuth"""
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from config import settings
from database import get_session
from models import User, AuthIdentity
from auth_deps import get_current_user_id
from services.passwords import hash_password, verify_password
from services.tokens import create_access_token as make_token
from services.verification_codes import create_challenge, verify_challenge
from services.message_delivery import mask_destination, send_verification_code

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ============================================================
# Response schemas
# ============================================================


class AuthUserResponse(BaseModel):
    id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = None


class AuthResponse(BaseModel):
    user: AuthUserResponse
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = None


# ============================================================
# Helper: find or create user from identity
# ============================================================


def _get_or_create_user(session: Session, provider: str, subject: str, name: str = "") -> User:
    identity = session.exec(
        select(AuthIdentity).where(
            AuthIdentity.provider == provider,
            AuthIdentity.provider_subject == subject,
        )
    ).first()
    if identity:
        user = session.get(User, identity.user_id)
        if user:
            return user

    user = User(display_name=name or "用户")
    session.add(user)
    session.flush()

    identity = AuthIdentity(
        user_id=user.id,
        provider=provider,
        provider_subject=subject,
    )
    session.add(identity)
    session.commit()
    session.refresh(user)
    return user


def _user_to_response(user: User) -> AuthUserResponse:
    return AuthUserResponse(
        id=str(user.id),
        email=user.email,
        phone=user.phone,
        name=user.display_name,
    )


def _auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        user=_user_to_response(user),
        access_token=make_token(str(user.id)),
    )


# ============================================================
# Code-based auth (phone + email)
# ============================================================


class CodeRequest(BaseModel):
    channel: Literal["phone", "email"]
    destination: str
    purpose: str = "login"


class CodeVerifyRequest(BaseModel):
    challenge_id: str
    code: str
    name: Optional[str] = None


@router.post("/code/request")
def request_code(body: CodeRequest, session: Session = Depends(get_session)):
    challenge, code = create_challenge(session, body.channel, body.destination, body.purpose)
    send_verification_code(body.channel, body.destination, code)

    response: dict = {
        "challenge_id": str(challenge.id),
        "expires_in_seconds": settings.auth_code_expire_minutes * 60,
        "masked_destination": mask_destination(body.channel, body.destination),
    }
    if settings.auth_dev_code_echo:
        response["dev_code"] = code
    return response


@router.post("/code/verify", response_model=AuthResponse)
def verify_code(body: CodeVerifyRequest, session: Session = Depends(get_session)):
    challenge = verify_challenge(session, body.challenge_id, body.code)

    provider = f"{challenge.channel}_code"
    user = _get_or_create_user(session, provider, challenge.destination, body.name or "")

    # Sync destination to user record
    if challenge.channel == "phone":
        user.phone = challenge.destination
    elif challenge.channel == "email":
        user.email = challenge.destination
    session.add(user)
    session.commit()
    session.refresh(user)

    return _auth_response(user)


# ============================================================
# Email/password auth
# ============================================================


class PasswordSignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class PasswordLoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/signup", status_code=201, response_model=AuthResponse)
def signup(body: PasswordSignupRequest, session: Session = Depends(get_session)):
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="密码至少需要 8 个字符")

    existing = session.exec(
        select(AuthIdentity).where(
            AuthIdentity.provider == "email_password",
            AuthIdentity.provider_subject == body.email,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="该邮箱已注册")

    user = User(display_name=body.name or "用户", email=body.email)
    session.add(user)
    session.flush()

    identity = AuthIdentity(
        user_id=user.id,
        provider="email_password",
        provider_subject=body.email,
        password_hash=hash_password(body.password),
    )
    session.add(identity)
    session.commit()
    session.refresh(user)

    return _auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(body: PasswordLoginRequest, session: Session = Depends(get_session)):
    identity = session.exec(
        select(AuthIdentity).where(
            AuthIdentity.provider == "email_password",
            AuthIdentity.provider_subject == body.email,
        )
    ).first()
    if not identity:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    if not identity.password_hash or not verify_password(body.password, identity.password_hash):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    user = session.get(User, identity.user_id)
    if not user:
        raise HTTPException(status_code=500, detail="用户数据异常")

    return _auth_response(user)


# ============================================================
# Google OAuth
# ============================================================


@router.get("/google/start")
def google_start(next: str = Query("/dashboard")):
    # Encode next into a simple JWT state token
    from jose import jwt as jose_jwt
    state = jose_jwt.encode({"next": next}, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    if not settings.google_client_id:
        return RedirectResponse(
            f"{settings.web_app_url}/login?error=google_not_configured&next={next}"
        )

    from urllib.parse import urlencode
    query = urlencode({
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    })
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{query}")


@router.get("/google/callback")
async def google_callback(code: str, state: str, session: Session = Depends(get_session)):
    # Decode next from state
    try:
        from jose import jwt as jose_jwt
        payload = jose_jwt.decode(state, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        next_url = payload.get("next", "/dashboard")
    except Exception:
        next_url = "/dashboard"

    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=503, detail="Google 登录未配置")

    import httpx
    async with httpx.AsyncClient(timeout=10) as client:
        token_res = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            raise HTTPException(status_code=401, detail="Google 授权失败")
        access_token = token_res.json()["access_token"]

        user_res = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_res.status_code != 200:
            raise HTTPException(status_code=401, detail="无法获取 Google 用户信息")
        google_user = user_res.json()

    if not google_user.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google 邮箱未验证")

    email = google_user["email"]
    name = google_user.get("name", "")

    user = _get_or_create_user(session, "google", email, name)
    if not user.email:
        user.email = email
    if not user.display_name or user.display_name == "用户":
        user.display_name = name
    session.add(user)
    session.commit()

    auth_token = make_token(str(user.id))
    redirect_url = f"{settings.web_app_url}/auth/callback?token={auth_token}&next={next_url}"
    return RedirectResponse(redirect_url)


# ============================================================
# Session
# ============================================================


@router.get("/me", response_model=MeResponse)
def get_me(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    try:
        user_uuid = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(user_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Token 无效")

    user = session.get(User, user_uuid)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return MeResponse(
        id=str(user.id),
        email=user.email,
        phone=user.phone,
        name=user.display_name,
    )


@router.post("/logout")
def logout():
    return {"message": "已退出"}
