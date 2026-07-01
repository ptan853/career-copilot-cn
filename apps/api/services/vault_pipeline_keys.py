"""Canonical keys and deterministic duplicate helpers for Vault events."""

from __future__ import annotations

import re
from typing import Any

from services.vault_section_schema import get_section_dedupe_fields


_PARENS_CONTENT = re.compile(r"\([^)]*\)")
_SEPARATORS = re.compile(r"[·•,，。:：/\\|_\-\s]+")
_PUNCTUATION = re.compile(r"[【】\[\]《》<>“”\"'`]")


def canonical_event_key(section_type: str, event: dict[str, Any]) -> str:
    parts = [section_type]
    for field_path in get_section_dedupe_fields(section_type):
        parts.append(_canonical_value(section_type, field_path, _get_path(event, field_path)))
    return "|".join(parts)


def is_likely_duplicate(section_type: str, event_a: dict[str, Any], event_b: dict[str, Any]) -> bool:
    dedupe_fields = get_section_dedupe_fields(section_type)
    if not dedupe_fields:
        return False

    for field_path in dedupe_fields:
        value_a = _canonical_value(section_type, field_path, _get_path_with_fallback(section_type, event_a, field_path))
        value_b = _canonical_value(section_type, field_path, _get_path_with_fallback(section_type, event_b, field_path))
        if not value_a or not value_b:
            continue
        if value_a == value_b:
            continue
        if _contains_alias(value_a, value_b):
            continue
        return False
    return True


def normalize_key_text(value: object) -> str:
    text = str(value or "").strip().lower()
    text = text.replace("（", "(").replace("）", ")")
    text = _SEPARATORS.sub("", text)
    text = _PUNCTUATION.sub("", text)
    return text


def _canonical_value(section_type: str, field_path: str, value: Any) -> str:
    if field_path in {"time_start", "time_end"}:
        return str(value or "").strip()
    if section_type == "awards" and field_path == "title":
        return _strip_award_rank_punctuation(value)
    return normalize_key_text(value)


def _strip_award_rank_punctuation(value: Any) -> str:
    text = normalize_key_text(value)
    text = text.replace("(", "").replace(")", "")
    return text.replace("一等", "1等").replace("一等奖", "1等奖")


def _contains_alias(value_a: str, value_b: str) -> bool:
    return value_a in value_b or value_b in value_a


def _get_path(event: dict[str, Any], field_path: str) -> Any:
    current: Any = event
    for part in field_path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def _get_path_with_fallback(section_type: str, event: dict[str, Any], field_path: str) -> Any:
    value = _get_path(event, field_path)
    if value not in ("", None, []):
        return value
    if section_type == "awards" and field_path == "organization":
        return _get_path(event, "details.related_institution")
    return value
