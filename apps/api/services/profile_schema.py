"""Lite profile section schema for resume-like Vault rendering."""

from dataclasses import dataclass
from typing import Any


PROFILE_SECTION_ORDER = [
    "summary",
    "experience",
    "projects",
    "education",
    "skills",
    "awards",
    "courses",
    "certifications",
    "research",
    "other",
    "languages",
]


@dataclass(frozen=True)
class ProfileSection:
    section_type: str
    section_title: str


SECTION_BY_EVENT_TYPE = {
    "work": ProfileSection("experience", "工作/实习"),
    "internship": ProfileSection("experience", "工作/实习"),
    "project": ProfileSection("projects", "项目"),
    "startup": ProfileSection("projects", "项目"),
    "open_source": ProfileSection("projects", "项目"),
    "education": ProfileSection("education", "教育"),
    "award": ProfileSection("awards", "荣誉/奖项"),
    "competition": ProfileSection("awards", "荣誉/奖项"),
    "certification": ProfileSection("certifications", "证书"),
    "course": ProfileSection("courses", "课程"),
    "publication": ProfileSection("research", "论文/专利"),
    "patent": ProfileSection("research", "论文/专利"),
    "volunteer": ProfileSection("other", "志愿/社团/其他"),
    "language": ProfileSection("languages", "语言"),
    "custom": ProfileSection("other", "志愿/社团/其他"),
}


LITE_FIELDS_BY_EVENT_TYPE = {
    "work": {"bullets", "skills"},
    "internship": {"bullets", "skills"},
    "project": {"bullets", "tech_stack", "url"},
    "startup": {"bullets", "tech_stack", "url"},
    "open_source": {"bullets", "tech_stack", "url"},
    "education": {"field", "gpa", "honors"},
    "award": set(),
    "competition": set(),
    "certification": {"url"},
    "course": {"url"},
    "publication": {"url", "authors"},
    "patent": {"url", "authors"},
    "volunteer": set(),
    "language": {"proficiency"},
    "custom": {"section_kind", "skills"},
}

LEGACY_AUX_FIELDS = {"context", "contribution", "implementation", "outcome", "open_questions", "needs_review_fields"}


def event_type_to_profile_section(event_type: str) -> ProfileSection:
    return SECTION_BY_EVENT_TYPE.get(event_type, SECTION_BY_EVENT_TYPE["custom"])


def normalize_lite_details(event_type: str, details: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(details, dict):
        return {}

    allowed_fields = LITE_FIELDS_BY_EVENT_TYPE.get(event_type, LITE_FIELDS_BY_EVENT_TYPE["custom"])
    normalized: dict[str, Any] = {}

    for field in allowed_fields | LEGACY_AUX_FIELDS:
        if field not in details:
            continue
        value = _normalize_field(field, details[field])
        if value not in ("", [], None):
            normalized[field] = value

    return normalized


def _normalize_field(field: str, value: Any) -> Any:
    if field == "bullets":
        return _string_list(value)
    if field in {"skills", "tech_stack", "honors", "authors", "open_questions", "needs_review_fields"}:
        return _string_list(value)
    return _clean_string(value)


def _string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        raw_items = value.replace("，", ",").split(",")
    elif isinstance(value, list):
        raw_items = value
    else:
        raw_items = [value]

    items = []
    for item in raw_items:
        if isinstance(item, dict):
            text = item.get("text") or item.get("value") or item.get("label")
        else:
            text = item
        cleaned = _clean_string(text)
        if cleaned:
            items.append(cleaned)
    return items


def _clean_string(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()
