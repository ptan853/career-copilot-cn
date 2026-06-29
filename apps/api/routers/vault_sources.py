"""Vault Sources 路由 V2"""
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import SourceMaterial, BackgroundJob
from auth_deps import get_current_user_id

router = APIRouter(prefix="/api/vault/sources", tags=["vault-sources"])

ALLOWED_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "image/png",
    "image/jpeg",
}


class MultiSourceInput(BaseModel):
    text: str = ""
    urls: list[str] = []


# ─── Create source (multi-input) ──────────────────────────────

@router.post("")
async def create_source(
    body: MultiSourceInput,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """混合输入：文字 + URL → 创建 SourceMaterial 并创建解析任务"""
    if not body.text.strip() and not body.urls:
        raise HTTPException(status_code=400, detail="请提供文字或至少一个链接")

    title = body.text.strip()[:80] if body.text.strip() else (", ".join(body.urls[:2]))
    source = SourceMaterial(
        user_id=user_id,
        source_type="text",
        title=title or "手动输入",
        raw_text=body.text,
        parse_status="uploaded",
    )
    session.add(source)
    session.commit()
    session.refresh(source)

    job = BackgroundJob(
        user_id=user_id,
        job_type="source_parse",
        payload={
            "source_id": str(source.id),
            "text": body.text,
            "urls": body.urls,
        },
        status="queued",
    )
    session.add(job)
    session.commit()
    session.refresh(job)

    return {
        "source_id": str(source.id),
        "job_id": str(job.id),
        "title": source.title,
        "status": source.parse_status,
    }


# ─── File upload ──────────────────────────────────────────────

@router.post("/upload")
async def upload_source(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """上传文件 → 创建解析任务"""
    if file.content_type and file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {file.content_type}")

    mime = file.content_type or ""
    content = await file.read()

    upload_dir = Path("/app/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_id = str(uuid.uuid4())
    ext = Path(file.filename or "file").suffix or ".bin"
    saved_path = upload_dir / f"{file_id}{ext}"
    saved_path.write_bytes(content)

    source = SourceMaterial(
        user_id=user_id,
        source_type="file",
        title=file.filename or "未命名文件",
        mime_type=mime,
        file_url=str(saved_path),
        parse_status="uploaded",
    )
    session.add(source)
    session.commit()
    session.refresh(source)

    job = BackgroundJob(
        user_id=user_id,
        job_type="source_parse",
        payload={"source_id": str(source.id), "file_path": str(saved_path)},
        status="queued",
    )
    session.add(job)
    session.commit()
    session.refresh(job)

    return {
        "source_id": str(source.id),
        "job_id": str(job.id),
        "title": source.title,
        "status": source.parse_status,
    }


# ─── CRUD ─────────────────────────────────────────────────────

@router.get("")
def list_sources(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    sources = session.exec(
        select(SourceMaterial)
        .where(SourceMaterial.user_id == user_id)
        .order_by(SourceMaterial.created_at.desc())
    ).all()
    return {
        "data": [
            {
                "id": str(s.id),
                "title": s.title,
                "source_type": s.source_type,
                "parse_status": s.parse_status,
                "created_at": s.created_at.isoformat(),
            }
            for s in sources
        ]
    }


@router.get("/{source_id}")
def get_source(
    source_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    source = session.get(SourceMaterial, source_id)
    if not source or str(source.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Source not found")
    return {
        "data": {
            "id": str(source.id),
            "title": source.title,
            "source_type": source.source_type,
            "parse_status": source.parse_status,
            "raw_text_preview": (source.raw_text or "")[:500],
            "created_at": source.created_at.isoformat(),
        }
    }


@router.delete("/{source_id}")
def delete_source(
    source_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    source = session.get(SourceMaterial, source_id)
    if not source or str(source.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Source not found")
    session.delete(source)
    session.commit()
    return {"message": "已删除"}
