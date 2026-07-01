"""Skeleton helpers for the internal Vault layered parsing pipeline."""

from __future__ import annotations

from typing import Any

from models import SourceMaterial
from services.vault_event_patches import build_event_diff, create_update_patch
from services.vault_pipeline_keys import is_likely_duplicate
from services.vault_pipeline_types import SourceDetectionResult, SourceSectionSpan


def group_spans_by_section(results: list[SourceDetectionResult]) -> dict[str, list[SourceSectionSpan]]:
    grouped: dict[str, list[SourceSectionSpan]] = {}
    for result in results:
        for span in result.section_spans:
            if not span.section_type or not span.text.strip():
                continue
            grouped.setdefault(span.section_type, []).append(span)
    return grouped


def persist_section_map(source: SourceMaterial, detection: SourceDetectionResult) -> None:
    metadata = dict(source.metadata_json or {})
    metadata["section_map"] = {
        "material_type": detection.material_type,
        "language": detection.language,
        "sections_detected": detection.sections_detected,
        "section_spans": [
            {
                "source_id": span.source_id,
                "source_title": span.source_title,
                "section_type": span.section_type,
                "span_title": span.span_title,
                "text": span.text,
                "confidence": span.confidence,
            }
            for span in detection.section_spans
        ],
        "warnings": detection.warnings,
    }
    source.metadata_json = metadata


def skip_duplicate_events(section_type: str, new_events: list[dict[str, Any]], existing_events: list[Any]) -> list[dict[str, Any]]:
    existing_dicts = [_event_to_dict(event) for event in existing_events]
    filtered: list[dict[str, Any]] = []
    for event in new_events:
        if any(is_likely_duplicate(section_type, event, existing_event) for existing_event in existing_dicts):
            continue
        filtered.append(event)
    return filtered


def merge_duplicate_event_update(
    section_type: str,
    existing_event: Any,
    proposed_event: dict[str, Any],
    source_ids: list[str],
    reason: str,
) -> str:
    before = _event_to_dict(existing_event)
    after = _merge_event_dict(before, proposed_event)
    diff = build_event_diff(before, after)
    if not diff:
        return "no_change"

    if getattr(existing_event, "status", "draft") == "confirmed":
        patch = create_update_patch(before, after, source_ids, reason, status="pending")
        details = dict(getattr(existing_event, "details_json", None) or {})
        details.setdefault("pending_patches", []).append(patch)
        existing_event.details_json = details
        return "pending_patch"

    patch = create_update_patch(before, after, source_ids, reason, status="accepted")
    _apply_event_dict(existing_event, after)
    details = dict(getattr(existing_event, "details_json", None) or {})
    details["last_applied_patch"] = patch
    existing_event.details_json = details
    return "auto_applied"


def _merge_event_dict(before: dict[str, Any], proposed: dict[str, Any]) -> dict[str, Any]:
    after = {
        "title": proposed.get("title") or before.get("title"),
        "organization": proposed.get("organization") or before.get("organization"),
        "role": proposed.get("role") or before.get("role"),
        "location": proposed.get("location") or before.get("location"),
        "time_start": proposed.get("time_start") or before.get("time_start"),
        "time_end": proposed.get("time_end") or before.get("time_end"),
        "description": proposed.get("description") or before.get("description"),
        "details": _merge_details(before.get("details") or {}, proposed.get("details") or {}),
        "tags": _merge_list(before.get("tags"), proposed.get("tags")),
    }
    return {key: value for key, value in after.items() if value not in (None, "", [], {})}


def _merge_details(before: dict[str, Any], proposed: dict[str, Any]) -> dict[str, Any]:
    merged = dict(before)
    for key, value in proposed.items():
        if key in {"bullets", "skills", "tech_stack", "honors", "authors"}:
            merged[key] = _merge_list(merged.get(key), value)
        elif value not in (None, "", [], {}) and not merged.get(key):
            merged[key] = value
    return merged


def _merge_list(existing: Any, proposed: Any) -> list[str]:
    merged: list[str] = []
    for value in [existing, proposed]:
        if isinstance(value, list):
            candidates = value
        elif isinstance(value, str) and value.strip():
            candidates = [value]
        else:
            candidates = []
        for item in candidates:
            text = str(item).strip()
            if text and text not in merged:
                merged.append(text)
    return merged


def _apply_event_dict(event: Any, data: dict[str, Any]) -> None:
    for field in ["title", "organization", "role", "location", "time_start", "time_end", "description", "tags"]:
        if field in data:
            setattr(event, field, data[field])
    event.details_json = dict(data.get("details") or {})


def _event_to_dict(event: Any) -> dict[str, Any]:
    if isinstance(event, dict):
        return event
    return {
        "title": getattr(event, "title", None),
        "organization": getattr(event, "organization", None),
        "role": getattr(event, "role", None),
        "location": getattr(event, "location", None),
        "time_start": getattr(event, "time_start", None),
        "time_end": getattr(event, "time_end", None),
        "description": getattr(event, "description", None),
        "details": getattr(event, "details_json", None) or {},
        "tags": getattr(event, "tags", None) or [],
    }
