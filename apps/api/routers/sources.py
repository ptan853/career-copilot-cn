"""Sources 路由 — 文件上传与解析"""
import uuid
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlmodel import Session, select

from database import get_session
from models import SourceMaterial, BackgroundJob, User
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


@router.post("/upload")
async def upload_source(
    file: UploadFile = File(...),
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
    upload_dir = Path(settings.s3_endpoint.replace("http://", "").replace(":9000", ""))
    upload_dir = Path("/app/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_id = str(uuid.uuid4())
    ext = Path(file.filename or "file").suffix or ".bin"
    saved_path = upload_dir / f"{file_id}{ext}"
    saved_path.write_bytes(content)

    # 创建 source 记录
    source = SourceMaterial(
        user_id=uuid.uuid4(),  # TODO: 从 JWT 获取真实 user_id
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
