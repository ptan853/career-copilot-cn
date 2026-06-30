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

from config import settings
from database import engine
from models import SourceMaterial, BackgroundJob, CareerEvent, Claim, Profile, Evidence
from services.parse_prompts import source_parse_system_prompt
from services.source_parse import normalize_source_parse

logger = logging.getLogger("ai_worker")

POLL_INTERVAL_SECONDS = 5
DRY_RUN = os.getenv("AI_PARSE_DRY_RUN", "true").lower() in ("1", "true", "yes")

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


def _resolve_api_key(user_id: str, session: Session) -> tuple[str, str]:
    """解析用户使用的 OpenAI API key。

    优先级：用户自填 key > 平台默认 key（.env 中的 PLATFORM_OPENAI_API_KEY）
    """
    # 尝试查用户 Profile
    profile = session.exec(
        select(Profile).where(Profile.user_id == user_id)
    ).first()

    if profile and profile.ai_api_key:
        return profile.ai_api_key, "openai"

    # 回退到平台默认 key
    if settings.platform_openai_api_key:
        return settings.platform_openai_api_key, "openai"

    # 回退到 .env 中的个人 key
    if settings.openai_api_key:
        return settings.openai_api_key, "openai"

    return "", "openai"


def _resolve_api_base(provider: str) -> str:
    """根据 provider 返回对应的 API base URL。"""
    bases = {
        "openai": settings.openai_api_base,
        "deepseek": settings.deepseek_api_base,
        "qwen": settings.qwen_api_base,
    }
    return bases.get(provider, settings.openai_api_base)


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

    api_key, provider = _resolve_api_key(str(job.user_id), session)
    api_base = _resolve_api_base(provider)

    text = source.raw_text or ""

    urls_from_payload = job.payload.get("urls", [])
    if urls_from_payload:
        fetched = _fetch_urls(urls_from_payload)
        if fetched:
            text = text + "\n\n" + fetched

    if text.strip():
        text = _scan_and_fetch(text)

    if not text.strip():
        job.status = "succeeded"
        job.progress_message = "无文本内容，跳过解析"
        job.completed_at = datetime.utcnow()
        session.add(job)
        session.commit()
        return

    source.parse_status = "extracting"
    session.add(source)
    session.commit()

    if DRY_RUN:
        job.status = "succeeded"
        job.progress_message = "DRY_RUN：跳过 AI 调用"
        job.result = {"events": 0, "claims": 0, "dry_run": True}
        job.completed_at = datetime.utcnow()
        session.add(job)
        session.commit()
        logger.info("job %s dry-run complete", job.id)
        return

    if not api_key:
        raise ValueError("未配置 OpenAI API Key。请在设置中填写 OpenAI API Key，或联系管理员配置平台默认 Key。")

    parsed = _call_ai(api_base, api_key, source_parse_system_prompt(), text)
    normalized = normalize_source_parse(parsed)

    metadata = dict(source.metadata_json or {})
    metadata.update({
        "source_type": normalized.source_type,
        "source_subtype": normalized.source_subtype,
        "language": normalized.language,
        "ai_warnings": normalized.warnings,
        "parse_model": settings.openai_model,
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


def _call_ai(api_base: str, api_key: str, system_prompt: str, user_input: str) -> dict:
    """调用 OpenAI Chat Completions JSON 模式，返回解析后的 dict。"""
    api_base = api_base.rstrip("/")

    with httpx.Client(timeout=120) as client:
        resp = client.post(
            f"{api_base}/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.openai_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_input[:15000]},
                ],
                "temperature": 0.3,
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        body = resp.json()
        content = body["choices"][0]["message"]["content"]
        return json.loads(content)


def _call_deepseek(system_prompt: str, user_input: str) -> dict:
    """兼容旧版调用（直接使用 settings 中的 key）。"""
    return _call_ai(settings.openai_api_base, settings.openai_api_key, system_prompt, user_input)


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
