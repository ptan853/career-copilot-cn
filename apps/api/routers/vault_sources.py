"""Vault Sources 路由 V2"""
import logging
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from config import settings
from database import get_session
from models import SourceMaterial, BackgroundJob, CareerEvent, Claim, Evidence
from auth_deps import get_current_user_id
from services.ingestion import ingest_file

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


def _run_source_parse_worker_once():
    from services.ai_worker import run_once

    run_once()


def _schedule_source_parse(background_tasks: BackgroundTasks):
    background_tasks.add_task(_run_source_parse_worker_once)


# ─── Create source (multi-input) ──────────────────────────────

@router.post("")
async def create_source(
    body: MultiSourceInput,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """混合输入：文字 + URL → 创建 SourceMaterial 并创建解析任务"""
    if not body.text.strip() and not body.urls:
        raise HTTPException(status_code=400, detail="请提供文字或至少一个链接")

    user_uuid = uuid.UUID(str(user_id))
    title = body.text.strip()[:80] if body.text.strip() else (", ".join(body.urls[:2]))
    source = SourceMaterial(
        user_id=user_uuid,
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
        user_id=user_uuid,
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
    _schedule_source_parse(background_tasks)

    return {
        "source_id": str(source.id),
        "job_id": str(job.id),
        "title": source.title,
        "status": source.parse_status,
    }


# ─── File upload ──────────────────────────────────────────────

@router.post("/upload")
async def upload_source(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """上传文件 → 创建解析任务"""
    if file.content_type and file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {file.content_type}")

    mime = file.content_type or ""
    content = await file.read()
    user_uuid = uuid.UUID(str(user_id))

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_id = str(uuid.uuid4())
    ext = Path(file.filename or "file").suffix or ".bin"
    saved_path = upload_dir / f"{file_id}{ext}"
    saved_path.write_bytes(content)

    ingested = ingest_file(str(saved_path), mime, title=file.filename or "未命名文件")
    raw_text = ingested.content
    if raw_text:
        logger.info("ingested %d chars from %s", len(raw_text), file.filename)
    else:
        logger.warning("no text extracted from %s", file.filename)

    source = SourceMaterial(
        user_id=user_uuid,
        source_type="file",
        title=file.filename or "未命名文件",
        mime_type=mime,
        file_url=str(saved_path),
        raw_text=raw_text or None,
        parse_status="extracted" if raw_text else "uploaded",
        metadata_json={
            **ingested.metadata,
            "content_type": ingested.content_type,
            "warnings": ingested.warnings,
        },
    )
    session.add(source)
    session.commit()
    session.refresh(source)

    job = BackgroundJob(
        user_id=user_uuid,
        job_type="source_parse",
        payload={"source_id": str(source.id), "file_path": str(saved_path)},
        status="queued",
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    _schedule_source_parse(background_tasks)

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
    confirmed_events = [event for event in events if event.status == "confirmed"]
    removable_events = [event for event in events if event.status != "confirmed"]
    removable_event_ids = [event.id for event in removable_events]
    claims = []
    if removable_event_ids:
        claims = session.exec(select(Claim).where(Claim.career_event_id.in_(removable_event_ids))).all()
    claim_ids = [claim.id for claim in claims]

    evidence_query = select(Evidence).where(Evidence.user_id == user_uuid, Evidence.source_material_id == source.id)
    evidences = session.exec(evidence_query).all()
    if removable_event_ids:
        evidences.extend(session.exec(select(Evidence).where(Evidence.career_event_id.in_(removable_event_ids))).all())
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

    for event in removable_events:
        session.delete(event)

    for event in confirmed_events:
        event.source_id = None
        session.add(event)

    jobs = session.exec(
        select(BackgroundJob).where(BackgroundJob.user_id == user_uuid, BackgroundJob.job_type == "source_parse")
    ).all()
    for job in jobs:
        if str((job.payload or {}).get("source_id")) == str(source.id):
            session.delete(job)

    session.delete(source)
    session.commit()
    return {"message": "已删除"}
