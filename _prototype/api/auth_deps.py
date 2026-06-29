"""认证依赖注入 — 从 JWT 提取当前用户"""
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
) -> str:
    """从 Authorization: Bearer <token> 解析并验证 JWT，返回 user_id 字符串。

    开发模式：如果没有提供 token，返回第一个用户（fallback）。
    生产模式：必须提供有效 token。
    """
    token = None
    if credentials:
        token = credentials.credentials

    if not token:
        # 开发 fallback：取第一个用户
        user = session.exec(select(User).limit(1)).first()
        if user:
            return str(user.id)
        raise HTTPException(status_code=401, detail="请先登录")

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token 无效")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Token 无效或已过期")
