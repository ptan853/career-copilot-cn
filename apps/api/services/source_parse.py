"""Normalize OpenAI source-parse JSON into persisted career-vault shapes."""

from dataclasses import dataclass, field
from typing import Any


VALID_EVENT_TYPES = {
    "work", "internship", "project", "education", "certification", "award",
    "publication", "patent", "course", "competition", "open_source",
    "startup", "volunteer", "language", "custom",
}

VALID_CLAIM_TYPES = {
    "achievement", "skill", "metric", "responsibility", "credential", "preference",
}

VALID_STRENGTHS = {"confirmed", "inferred", "weak"}
SECTION_BY_EVENT_TYPE = {
    "work": ("work", "工作经历"),
    "internship": ("work", "工作经历"),
    "project": ("project", "项目经历"),
    "startup": ("project", "项目经历"),
    "education": ("education", "教育背景"),
    "course": ("education", "教育背景"),
    "award": ("credential", "奖项证书"),
    "certification": ("credential", "奖项证书"),
    "competition": ("credential", "奖项证书"),
    "publication": ("research", "研究/论文"),
    "patent": ("research", "研究/论文"),
    "open_source": ("portfolio", "开源/作品"),
    "language": ("skill", "技能与偏好"),
    "volunteer": ("custom", "自定义"),
    "custom": ("custom", "自定义"),
}


@dataclass
class NormalizedClaim:
    claim_text: str
    claim_type: str = "achievement"
    strength: str = "confirmed"
    visibility: str = "private"
    evidence_quote: str | None = None
    confidence: float | None = None


@dataclass
class NormalizedEvidence:
    quote: str | None = None
    locator: dict[str, Any] = field(default_factory=dict)
    confidence: float | None = None


@dataclass
class NormalizedEvent:
    section_type: str
    section_title: str
    event_type: str
    title: str
    role: str | None = None
    organization: str | None = None
    location: str | None = None
    time_start: str | None = None
    time_end: str | None = None
    time_precision: str = "month"
    description: str | None = None
    details_json: dict[str, Any] = field(default_factory=dict)
    tags: list[str] = field(default_factory=list)
    status: str = "draft"
    confidence: float | None = None
    claims: list[NormalizedClaim] = field(default_factory=list)
    evidence: list[NormalizedEvidence] = field(default_factory=list)


@dataclass
class NormalizedParseResult:
    source_type: str = "unknown"
    source_subtype: str = "unknown"
    language: str = "zh-CN"
    warnings: list[str] = field(default_factory=list)
    events: list[NormalizedEvent] = field(default_factory=list)


def event_type_to_section(event_type: str) -> dict[str, str]:
    section_type, section_title = SECTION_BY_EVENT_TYPE.get(
        event_type,
        SECTION_BY_EVENT_TYPE["custom"],
    )
    return {"section_type": section_type, "section_title": section_title}


def _safe_enum(value: Any, allowed: set[str], fallback: str) -> str:
    return value if isinstance(value, str) and value in allowed else fallback


def _clean_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _details(raw: dict[str, Any]) -> dict[str, Any]:
    details = raw.get("details") if isinstance(raw.get("details"), dict) else {}
    return {
        "context": _clean_string(details.get("context")) or "",
        "contribution": _clean_string(details.get("contribution")) or "",
        "implementation": _clean_string(details.get("implementation")) or "",
        "outcome": _clean_string(details.get("outcome")) or "",
        "open_questions": details.get("open_questions") if isinstance(details.get("open_questions"), list) else [],
        "needs_review_fields": details.get("needs_review_fields") if isinstance(details.get("needs_review_fields"), list) else [],
    }


def normalize_source_parse(raw: dict[str, Any]) -> NormalizedParseResult:
    result = NormalizedParseResult(
        source_type=_clean_string(raw.get("source_type")) or "unknown",
        source_subtype=_clean_string(raw.get("source_subtype")) or "unknown",
        language=_clean_string(raw.get("language")) or "zh-CN",
        warnings=raw.get("warnings") if isinstance(raw.get("warnings"), list) else [],
    )

    if result.source_type == "jd" or result.source_subtype == "jd":
        if not result.warnings:
            result.warnings.append("输入内容被识别为岗位描述，未写入用户职业经历。")
        return result

    sections = raw.get("sections") if isinstance(raw.get("sections"), list) else []
    for section in sections:
        if not isinstance(section, dict):
            continue
        raw_events = section.get("events") if isinstance(section.get("events"), list) else []
        for raw_event in raw_events:
            if not isinstance(raw_event, dict):
                continue
            event_type = _safe_enum(raw_event.get("event_type"), VALID_EVENT_TYPES, "custom")
            mapped = event_type_to_section(event_type)
            section_type = mapped["section_type"]
            section_title = mapped["section_title"]
            title = _clean_string(raw_event.get("title")) or "未命名事件"

            claims = []
            raw_claims = raw_event.get("claims") if isinstance(raw_event.get("claims"), list) else []
            for raw_claim in raw_claims:
                if not isinstance(raw_claim, dict):
                    continue
                claim_text = _clean_string(raw_claim.get("claim_text"))
                if not claim_text:
                    continue
                claims.append(NormalizedClaim(
                    claim_text=claim_text,
                    claim_type=_safe_enum(raw_claim.get("claim_type"), VALID_CLAIM_TYPES, "achievement"),
                    strength=_safe_enum(raw_claim.get("strength"), VALID_STRENGTHS, "confirmed"),
                    evidence_quote=_clean_string(raw_claim.get("evidence_quote")),
                    confidence=raw_claim.get("confidence") if isinstance(raw_claim.get("confidence"), (int, float)) else None,
                ))

            evidence = []
            raw_evidences = raw_event.get("evidence") if isinstance(raw_event.get("evidence"), list) else []
            for raw_evidence in raw_evidences:
                if not isinstance(raw_evidence, dict):
                    continue
                evidence.append(NormalizedEvidence(
                    quote=_clean_string(raw_evidence.get("quote")),
                    locator=raw_evidence.get("locator") if isinstance(raw_evidence.get("locator"), dict) else {},
                    confidence=raw_evidence.get("confidence") if isinstance(raw_evidence.get("confidence"), (int, float)) else None,
                ))

            result.events.append(NormalizedEvent(
                section_type=section_type,
                section_title=section_title,
                event_type=event_type,
                title=title,
                role=_clean_string(raw_event.get("role")),
                organization=_clean_string(raw_event.get("organization")),
                location=_clean_string(raw_event.get("location")),
                time_start=_clean_string(raw_event.get("time_start")),
                time_end=_clean_string(raw_event.get("time_end")),
                time_precision=_clean_string(raw_event.get("time_precision")) or "month",
                description=_clean_string(raw_event.get("description")),
                details_json=_details(raw_event),
                tags=raw_event.get("tags") if isinstance(raw_event.get("tags"), list) else [],
                status="draft",
                confidence=raw_event.get("confidence") if isinstance(raw_event.get("confidence"), (int, float)) else None,
                claims=claims,
                evidence=evidence,
            ))

    return result
