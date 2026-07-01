"""Typed contracts for the internal Vault parsing pipeline."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class SourceSectionSpan:
    source_id: str
    source_title: str
    section_type: str
    text: str
    span_title: str | None = None
    confidence: float | None = None


@dataclass
class SourceDetectionResult:
    source_id: str
    material_type: str = "unknown"
    language: str = "zh-CN"
    sections_detected: list[str] = field(default_factory=list)
    section_spans: list[SourceSectionSpan] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class ExtractedEvent:
    section_type: str
    event_type: str
    title: str
    fields: dict[str, Any] = field(default_factory=dict)
    source_ids: list[str] = field(default_factory=list)
    evidence_quotes: list[str] = field(default_factory=list)
    status: str = "draft"


@dataclass
class SectionExtractionResult:
    section_type: str
    events: list[ExtractedEvent] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class EventMergeDecision:
    decision: str
    confidence: float
    merged_event: dict[str, Any] | None = None
    reason: str = ""
    warnings: list[str] = field(default_factory=list)
