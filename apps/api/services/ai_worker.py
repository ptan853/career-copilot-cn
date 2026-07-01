"""后台 AI worker — 轮询 BackgroundJob 表，调用 OpenAI 解析源材料

设计：
- 同步轮询循环，每次跑一个任务，避免并行带来的数据库锁问题
- 支持 dry-run 模式（不真正调用 API，返回空结果）
- 所有异常被捕获，不影响后续任务
- 自动扫描用户输入中的 URL 并抓取网页内容
"""

import json
import logging
import os
import re
import time
import uuid
from datetime import datetime

import httpx
from sqlmodel import Session, select

from database import engine
from models import SourceMaterial, BackgroundJob, CareerEvent, Claim, Evidence
from services.ingestion import IngestionError, ingest_url
from services.llm_providers import LLMGenerateRequest, LLMMessage, OpenAICompatibleProvider, resolve_provider_config
from services.parse_prompts import source_parse_system_prompt
from services.source_parse import normalize_source_parse

logger = logging.getLogger("ai_worker")

POLL_INTERVAL_SECONDS = 5


def _dry_run_enabled() -> bool:
    return os.getenv("AI_PARSE_DRY_RUN", "false").lower() in ("1", "true", "yes")


DRY_RUN = _dry_run_enabled()

# URL 正则
URL_PATTERN = re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+')

MAX_FETCH_CHARS = 8000  # 每个 URL 最多取 8000 字


def _fetch_urls(urls: list[str]) -> str:
    """抓取一批 URL，返回拼接后的文本。"""
    if not urls:
        return ""
    lines = []
    with httpx.Client(timeout=15, follow_redirects=True) as client:
        for url in urls:
            try:
                resp = client.get(url, headers={
                    "User-Agent": "QiuSuo-Copilot/1.0 (career-parser)",
                })
                resp.raise_for_status()
                text = resp.text[:MAX_FETCH_CHARS]
                lines.append(f"\n[来源: {url}]\n{text}")
                logger.info("fetched %d chars from %s", len(text), url)
            except Exception as e:
                logger.warning("failed to fetch %s: %s", url, e)
                lines.append(f"\n[来源: {url} — 抓取失败: {e}]")
    return "\n".join(lines)


def _scan_and_fetch(text: str) -> str:
    """扫描文本中的 URL，抓取内容并拼接到原始文本后面。"""
    urls = list(set(URL_PATTERN.findall(text)))
    if not urls:
        return text
    logger.info("found %d URLs in input text", len(urls))
    fetched = _fetch_urls(urls)
    if fetched:
        return text + "\n\n===== 网页抓取内容 =====\n" + fetched
    return text


def run_once() -> int:
    """公开的轮询入口 — 兼容旧版调用方式。"""
    return _run_once()


def _run_once() -> int:
    """执行一轮轮询：取一个 queued 的 job，执行它。返回处理的 job 数。"""
    with Session(engine) as session:
        job = session.exec(
            select(BackgroundJob)
            .where(BackgroundJob.status == "queued", BackgroundJob.job_type == "source_parse")
            .order_by(BackgroundJob.created_at)
            .limit(1)
        ).first()

        if not job:
            return 0

        try:
            _execute_job(session, job)
        except Exception as e:
            logger.exception("job %s failed: %s", job.id, e)
            job.status = "failed"
            job.error_message = str(e)[:1000]
            job.completed_at = datetime.utcnow()
            session.add(job)
            session.commit()

        return 1


def _execute_job(session: Session, job: BackgroundJob) -> None:
    """执行单个解析任务。"""
    job.status = "running"
    job.started_at = datetime.utcnow()
    job.progress_message = "正在解析源材料..."
    session.add(job)
    session.commit()

    source_id_raw = job.payload.get("source_id")
    if not source_id_raw:
        raise ValueError("payload 缺少 source_id")

    source_id = uuid.UUID(source_id_raw) if isinstance(source_id_raw, str) else source_id_raw
    source = session.get(SourceMaterial, source_id)
    if not source:
        raise ValueError(f"SourceMaterial {source_id} 不存在")

    text = source.raw_text or ""

    urls_from_payload = job.payload.get("urls", [])
    if urls_from_payload:
        fetched_parts = []
        for url in urls_from_payload:
            try:
                doc = ingest_url(url)
                fetched_parts.append(f"\n[来源: {url}]\n{doc.content}")
            except IngestionError as exc:
                fetched_parts.append(f"\n[来源: {url} — 抓取失败: {exc}]")
        if fetched_parts:
            text = text + "\n\n" + "\n".join(fetched_parts)

    if text.strip():
        text = _scan_and_fetch(text)

    if not text.strip():
        message = "未提取到可解析文本，请上传可复制文本的 PDF/Word，或直接粘贴文字内容。"
        source.parse_status = "failed"
        source.parse_error = message
        job.status = "failed"
        job.progress_message = message
        job.error_message = message
        job.completed_at = datetime.utcnow()
        session.add(source)
        session.add(job)
        session.commit()
        return

    source.parse_status = "extracting"
    session.add(source)
    session.commit()

    if DRY_RUN:
        message = "AI_PARSE_DRY_RUN 已开启，系统跳过了真实 AI 解析。请关闭 dry-run 后重试。"
        source.parse_status = "failed"
        source.parse_error = message
        job.status = "failed"
        job.progress_message = message
        job.error_message = message
        job.result = {"events": 0, "claims": 0, "dry_run": True}
        job.completed_at = datetime.utcnow()
        session.add(source)
        session.add(job)
        session.commit()
        logger.info("job %s dry-run blocked real parsing", job.id)
        return

    try:
        config = resolve_provider_config(job.user_id, session)
        result = OpenAICompatibleProvider(config).generate(
            LLMGenerateRequest(
                response_format="json",
                messages=[
                    LLMMessage(role="system", content=source_parse_system_prompt()),
                    LLMMessage(role="user", content=text[:15000]),
                ],
            )
        )
        parsed = result.json_data or json.loads(result.text)
    except Exception as exc:
        message = _user_facing_error(exc)
        source.parse_status = "failed"
        source.parse_error = message
        job.status = "failed"
        job.error_message = message
        job.completed_at = datetime.utcnow()
        session.add(source)
        session.add(job)
        session.commit()
        return

    normalized = normalize_source_parse(parsed)

    metadata = dict(source.metadata_json or {})
    metadata.update({
        "source_type": normalized.source_type,
        "source_subtype": normalized.source_subtype,
        "language": normalized.language,
        "ai_warnings": normalized.warnings,
        "parse_provider": result.provider,
        "parse_model": result.model,
    })
    source.metadata_json = metadata

    created_events = 0
    created_claims = 0
    created_evidence = 0

    for parsed_event in normalized.events:
        event = CareerEvent(
            user_id=job.user_id,
            source_id=source.id,
            event_type=parsed_event.event_type,
            title=parsed_event.title,
            role=parsed_event.role,
            organization=parsed_event.organization,
            location=parsed_event.location,
            time_start=parsed_event.time_start,
            time_end=parsed_event.time_end,
            time_precision=parsed_event.time_precision,
            description=parsed_event.description,
            details_json={
                **parsed_event.details_json,
                "section_type": parsed_event.section_type,
                "section_title": parsed_event.section_title,
            },
            tags=parsed_event.tags,
            source_confidence=parsed_event.confidence,
            status="draft",
            visibility="private",
        )
        session.add(event)
        session.flush()
        created_events += 1

        for parsed_evidence in parsed_event.evidence:
            evidence = Evidence(
                user_id=job.user_id,
                source_material_id=source.id,
                career_event_id=event.id,
                quote=parsed_evidence.quote,
                locator_json=parsed_evidence.locator,
                confidence=parsed_evidence.confidence,
            )
            session.add(evidence)
            created_evidence += 1

        for parsed_claim in parsed_event.claims:
            claim = Claim(
                user_id=job.user_id,
                career_event_id=event.id,
                claim_text=parsed_claim.claim_text,
                claim_type=parsed_claim.claim_type,
                strength=parsed_claim.strength,
                visibility=parsed_claim.visibility,
            )
            session.add(claim)
            session.flush()
            created_claims += 1

            if parsed_claim.evidence_quote:
                evidence = Evidence(
                    user_id=job.user_id,
                    source_material_id=source.id,
                    career_event_id=event.id,
                    claim_id=claim.id,
                    quote=parsed_claim.evidence_quote,
                    locator_json={},
                    confidence=parsed_claim.confidence,
                )
                session.add(evidence)
                created_evidence += 1

    source.parse_status = "parsed"
    session.add(source)

    job.status = "succeeded"
    job.progress_message = f"提取了 {created_events} 条事件、{created_claims} 条声明"
    job.result = {
        "events": created_events,
        "claims": created_claims,
        "evidence": created_evidence,
        "warnings": normalized.warnings,
    }
    job.completed_at = datetime.utcnow()
    session.add(job)
    session.commit()

    logger.info(
        "job %s complete: %d events, %d claims",
        job.id, created_events, created_claims,
    )


def _user_facing_error(exc: Exception) -> str:
    raw = str(exc).strip()
    parsed_message = raw
    parsed_code = ""

    if raw.startswith("{"):
        try:
            payload = json.loads(raw)
            error = payload.get("error") if isinstance(payload, dict) else None
            if isinstance(error, dict):
                parsed_message = str(error.get("message") or raw)
                parsed_code = str(error.get("code") or "")
        except json.JSONDecodeError:
            parsed_message = raw

    normalized = f"{parsed_code} {parsed_message}".lower()
    if "invalid_api_key" in normalized or "invalid api-key" in normalized or "invalid api key" in normalized:
        return "API Key 无效，请检查设置里的模型服务密钥。"
    if "quota" in normalized or "insufficient" in normalized:
        return "模型服务额度不足或限额已用完，请检查账户额度。"
    if "unauthorized" in normalized or "permission" in normalized or "forbidden" in normalized:
        return "模型服务鉴权失败，请检查 API Key、Base URL 和模型权限。"

    return parsed_message[:1000] or "模型服务调用失败，请检查 AI 配置后重试。"


def _safe_enum(value: str, valid: list[str], fallback: str) -> str:
    return value if value in valid else fallback


def main_loop():
    """主循环：持续轮询，直到进程被 kill。"""
    logger.info("ai_worker started (poll_interval=%ds, dry_run=%s)", POLL_INTERVAL_SECONDS, DRY_RUN)
    while True:
        try:
            processed = run_once()
            if processed == 0:
                time.sleep(POLL_INTERVAL_SECONDS)
        except Exception:
            logger.exception("unexpected error in main loop")
            time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s %(message)s")
    main_loop()
