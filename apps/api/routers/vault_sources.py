"""Vault Sources 路由 V2"""
import logging
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from config import settings
from database import get_session
from models import SourceMaterial, BackgroundJob, CareerEvent, Claim, Evidence
from auth_deps import get_current_user_id
from services.file_reader import extract_text

router = APIRouter(prefix="/api/vault/sources", tags=["vault-sources"])

ALLOWED_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "image/png",
    "image/jpeg",
}

logger = logging.getLogger("vault_sources")


class MultiSourceInput(BaseModel):
    text: str = ""
    urls: list[str] = []
    input_hint: str = ""


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
        metadata_json={"input_hint": body.input_hint.strip()} if body.input_hint.strip() else {},
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
            "input_hint": body.input_hint,
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

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_id = str(uuid.uuid4())
    ext = Path(file.filename or "file").suffix or ".bin"
    saved_path = upload_dir / f"{file_id}{ext}"
    saved_path.write_bytes(content)

    # 提取文本
    raw_text = ""
    if "pdf" in mime or ext in (".pdf", ".docx", ".doc", ".txt", ".md"):
        raw_text = extract_text(str(saved_path), mime)
        if raw_text:
            logger.info("extracted %d chars from %s", len(raw_text), file.filename)
        else:
            logger.warning("no text extracted from %s", file.filename)

    source = SourceMaterial(
        user_id=user_id,
        source_type="file",
        title=file.filename or "未命名文件",
        mime_type=mime,
        file_url=str(saved_path),
        raw_text=raw_text or None,
        parse_status="extracted" if raw_text else "uploaded",
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
                "raw_text_preview": (s.raw_text or "")[:600],
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
    user_uuid = uuid.UUID(str(user_id))
    source = session.get(SourceMaterial, uuid.UUID(source_id))
    if not source or source.user_id != user_uuid:
        raise HTTPException(status_code=404, detail="Source not found")
    return {
        "data": {
            "id": str(source.id),
            "title": source.title,
            "source_type": source.source_type,
            "parse_status": source.parse_status,
            "raw_text_preview": (source.raw_text or "")[:2000],
            "metadata_json": source.metadata_json or {},
            "parse_error": source.parse_error,
            "created_at": source.created_at.isoformat(),
        }
    }


@router.delete("/{source_id}")
def delete_source(
    source_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user_uuid = uuid.UUID(str(user_id))
    source = session.get(SourceMaterial, uuid.UUID(source_id))
    if not source or source.user_id != user_uuid:
        raise HTTPException(status_code=404, detail="Source not found")

    events = session.exec(
        select(CareerEvent).where(CareerEvent.user_id == user_uuid, CareerEvent.source_id == source.id)
    ).all()
    event_ids = [event.id for event in events]
    claims = []
    if event_ids:
        claims = session.exec(select(Claim).where(Claim.career_event_id.in_(event_ids))).all()
    claim_ids = [claim.id for claim in claims]

    evidence_query = select(Evidence).where(Evidence.user_id == user_uuid, Evidence.source_material_id == source.id)
    evidences = session.exec(evidence_query).all()
    if event_ids:
        evidences.extend(session.exec(select(Evidence).where(Evidence.career_event_id.in_(event_ids))).all())
    if claim_ids:
        evidences.extend(session.exec(select(Evidence).where(Evidence.claim_id.in_(claim_ids))).all())

    seen_evidence_ids = set()
    for evidence in evidences:
        if evidence.id in seen_evidence_ids:
            continue
        seen_evidence_ids.add(evidence.id)
        session.delete(evidence)

    for claim in claims:
        session.delete(claim)

    for event in events:
        session.delete(event)

    jobs = session.exec(
        select(BackgroundJob).where(BackgroundJob.user_id == user_uuid, BackgroundJob.job_type == "source_parse")
    ).all()
    for job in jobs:
        if str((job.payload or {}).get("source_id")) == str(source.id):
            session.delete(job)

    session.delete(source)
    session.commit()
    return {"message": "已删除"}
