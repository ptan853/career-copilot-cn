"""认证依赖注入 V2 — 从 JWT 提取当前用户"""
import uuid

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlmodel import Session, select

from config import settings
from database import get_session
from models import User

security = HTTPBearer(auto_error=False)


def get_current_user_id(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: Session = Depends(get_session),
) -> uuid.UUID:
    """从 Authorization: Bearer <token> 解析 JWT，返回 user_id UUID。

    开发 fallback：仅在 settings.auth_allow_dev_fallback=True 时，
    无 token 请求才自动绑定第一个用户。生产必须返回 401。
    """
    token = None
    if credentials:
        token = credentials.credentials

    if not token:
        if settings.auth_allow_dev_fallback:
            user = session.exec(select(User).limit(1)).first()
            if user:
                return user.id
        raise HTTPException(status_code=401, detail="请先登录")

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token 无效")
        return uuid.UUID(user_id)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Token 无效或已过期")
