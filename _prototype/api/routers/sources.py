"""Sources 路由 — 文件上传 + 多源解析"""
import uuid
import json
from pathlib import Path
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import SourceMaterial, BackgroundJob, User
from auth_deps import get_current_user_id
from config import settings

router = APIRouter(prefix="/api/sources", tags=["sources"])

# 允许的文件类型
ALLOWED_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "image/png",
    "image/jpeg",
}


# ─── Multi-source input ─────────────────────────────────────────────

class MultiSourceInput(BaseModel):
    text: str = ""
    urls: list[str] = []


@router.post("/ingest")
async def ingest_multi_source(
    body: MultiSourceInput,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """混合输入：文字 + URL 列表 → 创建解析任务"""
    if not body.text.strip() and not body.urls:
        raise HTTPException(status_code=400, detail="请提供文字或至少一个链接")

    # 创建 source 记录
    title = body.text.strip()[:80] if body.text.strip() else ", ".join(body.urls[:2])
    source = SourceMaterial(
        user_id=user_id,
        source_type="note",
        title=title or "手动输入",
        original_filename="手动输入",
        mime_type="text/plain",
        object_key="manual_input",
        raw_text=body.text,
        parse_status="uploaded",
    )
    session.add(source)
    session.commit()
    session.refresh(source)

    # 创建后台任务
    job = BackgroundJob(
        user_id=source.user_id,
        job_type="multi_source.parse",
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


# ─── File upload ────────────────────────────────────────────────────

@router.post("/upload")
async def upload_source(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """上传文件并创建解析任务"""
    # 校验文件类型
    if file.content_type not in ALLOWED_MIME and file.content_type:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {file.content_type}")

    # 确定源类型
    mime = file.content_type or ""
    if "pdf" in mime:
        source_type = "resume"
    elif "wordprocessingml" in mime:
        source_type = "resume"
    elif "text" in mime or "markdown" in mime:
        source_type = "note"
    elif "image" in mime:
        source_type = "resume"
    else:
        source_type = "note"

    # 读取文件内容
    content = await file.read()

    # 保存到本地文件系统（后续替换为对象存储）
    upload_dir = Path("/app/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_id = str(uuid.uuid4())
    ext = Path(file.filename or "file").suffix or ".bin"
    saved_path = upload_dir / f"{file_id}{ext}"
    saved_path.write_bytes(content)

    # 创建 source 记录
    source = SourceMaterial(
        user_id=user_id,
        source_type=source_type,
        title=file.filename or "未命名文件",
        original_filename=file.filename or "",
        mime_type=file.content_type or "",
        object_key=str(saved_path),
        parse_status="uploaded",
    )
    session.add(source)
    session.commit()
    session.refresh(source)

    # 创建后台任务
    job = BackgroundJob(
        user_id=source.user_id,
        job_type="source.parse",
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


# ─── List / Get / Delete ────────────────────────────────────────────

@router.get("")
def list_sources(session: Session = Depends(get_session)):
    """获取 sources 列表"""
    sources = session.exec(
        select(SourceMaterial).order_by(SourceMaterial.created_at.desc())
    ).all()
    return [
        {
            "id": str(s.id),
            "title": s.title,
            "source_type": s.source_type,
            "parse_status": s.parse_status,
            "created_at": s.created_at.isoformat(),
        }
        for s in sources
    ]


@router.get("/{source_id}")
def get_source(source_id: str, session: Session = Depends(get_session)):
    """获取单个 source 详情"""
    source = session.get(SourceMaterial, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return {
        "id": str(source.id),
        "title": source.title,
        "source_type": source.source_type,
        "parse_status": source.parse_status,
        "raw_text_preview": (source.raw_text or "")[:500],
        "created_at": source.created_at.isoformat(),
    }


@router.delete("/{source_id}")
def delete_source(source_id: str, session: Session = Depends(get_session)):
    """删除 source"""
    source = session.get(SourceMaterial, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    session.delete(source)
    session.commit()
    return {"message": "已删除"}
