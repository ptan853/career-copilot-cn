"""Verification code generation, hashing, challenge creation, and verification."""
import hashlib
import random
import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlmodel import Session

from config import settings
from models import VerificationChallenge


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def generate_code() -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(settings.auth_code_length))


def create_challenge(
    session: Session,
    channel: str,
    destination: str,
    purpose: str = "login",
) -> tuple[VerificationChallenge, str]:
    if channel not in {"phone", "email"}:
        raise HTTPException(status_code=400, detail="不支持的验证码渠道")
    code = generate_code()
    challenge = VerificationChallenge(
        channel=channel,
        destination=destination,
        code_hash=_hash_code(code),
        purpose=purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=settings.auth_code_expire_minutes),
    )
    session.add(challenge)
    session.commit()
    session.refresh(challenge)
    return challenge, code


def verify_challenge(session: Session, challenge_id: str, code: str) -> VerificationChallenge:
    try:
        challenge_uuid = uuid.UUID(challenge_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="验证码挑战不存在")

    challenge = session.get(VerificationChallenge, challenge_uuid)
    if not challenge:
        raise HTTPException(status_code=400, detail="验证码挑战不存在")
    if challenge.consumed_at is not None:
        raise HTTPException(status_code=400, detail="验证码已使用")
    if datetime.utcnow() > challenge.expires_at:
        raise HTTPException(status_code=400, detail="验证码已过期")
    if challenge.attempt_count >= settings.auth_code_max_attempts:
        raise HTTPException(status_code=429, detail="验证码尝试次数过多")

    if challenge.code_hash != _hash_code(code):
        challenge.attempt_count += 1
        session.add(challenge)
        session.commit()
        raise HTTPException(status_code=401, detail="验证码错误")

    challenge.consumed_at = datetime.utcnow()
    session.add(challenge)
    session.commit()
    session.refresh(challenge)
    return challenge
