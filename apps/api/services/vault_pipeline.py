"""Skeleton helpers for the internal Vault layered parsing pipeline."""

from __future__ import annotations

from typing import Any

from models import SourceMaterial
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
