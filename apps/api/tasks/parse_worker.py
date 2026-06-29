"""Parsing Worker — 文件解析 + LLM 提取"""
import json
from pathlib import Path
from datetime import datetime

from sqlmodel import Session, select

from database import engine
from models import SourceMaterial, CareerEvent, AiRun, BackgroundJob
from services.parse_service import extract_text_from_file
from services.prompts import build_extract_prompt, SYSTEM_PROMPT_EXTRACT
from ai.deepseek import DeepSeekProvider

EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "profile": {
            "type": "object",
            "properties": {
                "display_name": {"type": "string"},
                "email": {"type": "string"},
                "phone": {"type": "string"},
                "location": {"type": "string"},
                "headline": {"type": "string"},
            },
        },
        "events": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["work", "project", "education", "certification",
                                 "award", "publication", "open_source", "custom"],
                    },
                    "title": {"type": "string"},
                    "organization": {"type": "string"},
                    "role": {"type": "string"},
                    "time_start": {"type": "string"},
                    "time_end": {"type": "string"},
                    "time_precision": {"type": "string", "enum": ["day", "month", "year", "unknown"]},
                    "description": {"type": "string"},
                    "claims": {"type": "array", "items": {"type": "string"}},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "details": {"type": "object"},
                },
                "required": ["type", "title"],
            },
        },
    },
    "required": ["profile", "events"],
}


def process_source_parse(job_id: str):
    """处理 source.parse 任务"""
    session = Session(engine)
    try:
        # 获取 job
        job = session.get(BackgroundJob, job_id)
        if not job:
            return

        job.status = "running"
        session.add(job)
        session.commit()

        source_id = job.payload.get("source_id")
        file_path = job.payload.get("file_path")

        source = session.get(SourceMaterial, source_id)
        if not source:
            job.status = "failed"
            job.error = "Source not found"
            session.add(job)
            session.commit()
            return

        # 更新状态
        source.parse_status = "extracting"
        session.add(source)
        session.commit()

        # 1. 提取文本
        raw_text = extract_text_from_file(file_path, source.mime_type or "")

        if raw_text:
            source.raw_text = raw_text
            source.parse_status = "extracted"
            session.add(source)
            session.commit()
        else:
            # 图片类，需要 OCR 或 LLM vision
            source.parse_status = "extracted"
            source.raw_text = "[扫描件，需 OCR 处理]"
            session.add(source)
            session.commit()

            # 这里先用 placeholder，后续加 OCR fallback
            job.status = "completed"
            job.result = {"message": "扫描件未处理，需 OCR"}
            session.add(job)
            session.commit()
            return

        # 2. 调 LLM 提取
        try:
            llm = DeepSeekProvider()
            prompt = build_extract_prompt(raw_text)
            result = llm.generate_json(prompt, EXTRACT_SCHEMA, system=SYSTEM_PROMPT_EXTRACT)

        except Exception as e:
            source.parse_status = "failed"
            source.parse_error = f"LLM call failed: {str(e)}"
            job.status = "failed"
            job.error = str(e)
            session.add(source)
            session.add(job)
            session.commit()
            return

        # 3. 写入 Events
        profile = result.get("profile", {})
        events = result.get("events", [])

        for evt in events:
            career_event = CareerEvent(
                user_id=source.user_id,
                source_id=source.id,
                event_type=evt.get("type", "custom"),
                title=evt.get("title", "未命名事件"),
                organization=evt.get("organization"),
                role=evt.get("role"),
                time_start=evt.get("time_start"),
                time_end=evt.get("time_end"),
                time_precision=evt.get("time_precision", "month"),
                description=evt.get("description"),
                details=evt.get("details", {}),
                claims=evt.get("claims", []),
                tags=evt.get("tags", []),
                status="draft",
                visibility="private",
            )
            session.add(career_event)

        # 4. 更新 source 状态
        source.parse_status = "parsed"
        session.add(source)

        # 5. 完成 job
        job.status = "completed"
        job.result = {"event_count": len(events), "profile_fields": list(profile.keys())}
        job.completed_at = datetime.utcnow()
        session.add(job)
        session.commit()

    except Exception as e:
        session.rollback()
        job = session.get(BackgroundJob, job_id)
        if job:
            job.status = "failed"
            job.error = str(e)
            session.add(job)
            session.commit()
    finally:
        session.close()


def run_worker():
    """简易 worker 入口（后续替换为 RQ worker）"""
    session = Session(engine)
    jobs = session.exec(
        select(BackgroundJob).where(BackgroundJob.status == "queued")
        .order_by(BackgroundJob.created_at)
        .limit(1)
    ).all()
    session.close()

    for job in jobs:
        print(f"Processing job {job.id}: {job.job_type}")
        if job.job_type == "source.parse":
            process_source_parse(str(job.id))


if __name__ == "__main__":
    run_worker()
