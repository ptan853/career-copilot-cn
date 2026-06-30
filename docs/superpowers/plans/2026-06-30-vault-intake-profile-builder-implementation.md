# Vault Intake Profile Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable career asset workflow: unified input -> OpenAI parse -> sectioned draft events -> modal edit -> user confirmation.

**Architecture:** Reuse the existing FastAPI/SQLModel backend and Next.js frontend. Backend owns parsing, normalization, persistence, and section grouping; frontend owns the two-column `/vault` workspace and event editing modal. AI output is always draft until the user confirms it.

**Tech Stack:** FastAPI, SQLModel, SQLite/local DB, httpx, pytest, Next.js App Router, React client components, TypeScript, Tailwind CSS.

## Global Constraints

- OpenAI first; do not implement multi-provider switching in this phase.
- Keep `/vault` as the route, but rename the visible navigation label to `职业档案`.
- AI output remains `draft` until a user action confirms it.
- Do not mix JD requirements into the user career event library.
- Preserve raw source material before extraction.
- Prefer existing models: `SourceMaterial`, `CareerEvent`, `Claim`, `Evidence`, `BackgroundJob`, `Profile`.
- Use Chinese as primary UI copy.
- Do not return stored API keys to the frontend.
- Do not touch unrelated dirty worktree changes.

---

## File Structure

- `apps/api/services/parse_prompts.py`
  - Owns OpenAI system prompts and the JSON output contract.
- `apps/api/services/source_parse.py`
  - New focused parser/normalizer module for AI output. Converts raw JSON into normalized Python dictionaries and section metadata.
- `apps/api/services/ai_worker.py`
  - Executes queued `source_parse` jobs, calls OpenAI, persists `CareerEvent`, `Claim`, and `Evidence`.
- `apps/api/routers/vault_events.py`
  - Lists, groups, creates, updates, confirms, and deletes events.
- `apps/api/routers/vault.py`
  - Claims/profile/review endpoints. Claim endpoints remain here unless moved later.
- `apps/api/routers/vault_sources.py`
  - Adds `input_hint` and returns source metadata/warnings.
- `apps/api/tests/test_source_parse.py`
  - New unit tests for parser/normalizer.
- `apps/api/tests/test_ai_worker.py`
  - New worker persistence tests.
- `apps/api/tests/test_vault_events.py`
  - New API tests for grouped events and delete behavior.
- `apps/web/lib/api-client.ts`
  - Adds typed vault source/event/claim helpers, delete event, grouped event params, `input_hint`.
- `apps/web/app/vault/page.tsx`
  - Rebuilt as left input + right sectioned profile + event modal.
- `apps/web/components/app-shell.tsx`
  - Visible nav label becomes `职业档案`.

---

### Task 1: Backend Parse Contract And Normalizer

**Files:**
- Modify: `apps/api/services/parse_prompts.py`
- Create: `apps/api/services/source_parse.py`
- Test: `apps/api/tests/test_source_parse.py`

**Interfaces:**
- Produces: `source_parse_system_prompt() -> str`
- Produces: `normalize_source_parse(raw: dict) -> NormalizedParseResult`
- Produces: `event_type_to_section(event_type: str) -> dict[str, str]`
- Consumes: no previous task output

- [ ] **Step 1: Write failing tests for event type section mapping**

Create `apps/api/tests/test_source_parse.py` with:

```python
from services.source_parse import event_type_to_section


def test_event_type_to_section_maps_known_types():
    assert event_type_to_section("work") == {
        "section_type": "work",
        "section_title": "工作经历",
    }
    assert event_type_to_section("internship") == {
        "section_type": "work",
        "section_title": "工作经历",
    }
    assert event_type_to_section("project") == {
        "section_type": "project",
        "section_title": "项目经历",
    }
    assert event_type_to_section("certification") == {
        "section_type": "credential",
        "section_title": "奖项证书",
    }


def test_event_type_to_section_falls_back_to_custom():
    assert event_type_to_section("unknown") == {
        "section_type": "custom",
        "section_title": "自定义",
    }
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run python -m pytest tests/test_source_parse.py -v
```

Expected: FAIL because `services.source_parse` does not exist.

- [ ] **Step 3: Implement `source_parse.py` mapping and dataclasses**

Create `apps/api/services/source_parse.py`:

```python
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
VALID_STATUSES = {"draft", "needs_review"}


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
            section_type = _clean_string(section.get("section_type")) or mapped["section_type"]
            section_title = _clean_string(section.get("section_title")) or mapped["section_title"]
            title = _clean_string(raw_event.get("title")) or "未命名事件"

            claims = []
            for raw_claim in raw_event.get("claims") if isinstance(raw_event.get("claims"), list) else []:
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
            for raw_evidence in raw_event.get("evidence") if isinstance(raw_event.get("evidence"), list) else []:
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
                status=_safe_enum(raw_event.get("status"), VALID_STATUSES, "draft"),
                confidence=raw_event.get("confidence") if isinstance(raw_event.get("confidence"), (int, float)) else None,
                claims=claims,
                evidence=evidence,
            ))

    return result
```

- [ ] **Step 4: Run mapping tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run python -m pytest tests/test_source_parse.py -v
```

Expected: PASS for mapping tests.

- [ ] **Step 5: Add normalizer tests**

Append to `apps/api/tests/test_source_parse.py`:

```python
from services.source_parse import normalize_source_parse


def test_normalize_source_parse_flattens_sections_events_claims_and_evidence():
    raw = {
        "source_type": "resume",
        "source_subtype": "resume",
        "language": "zh-CN",
        "sections": [
            {
                "section_type": "work",
                "section_title": "工作经历",
                "events": [
                    {
                        "event_type": "internship",
                        "title": "增长产品实习",
                        "role": "产品实习生",
                        "organization": "字节跳动",
                        "time_start": "2024-06",
                        "time_end": "2025-03",
                        "details": {
                            "context": "业务需要提升转化效率。",
                            "needs_review_fields": ["outcome"],
                        },
                        "claims": [
                            {
                                "claim_text": "参与增长实验设计。",
                                "claim_type": "responsibility",
                                "strength": "confirmed",
                                "evidence_quote": "负责增长实验设计",
                                "confidence": 0.84,
                            }
                        ],
                        "evidence": [
                            {
                                "quote": "负责增长实验设计",
                                "locator": {"page": 1},
                                "confidence": 0.84,
                            }
                        ],
                        "confidence": 0.84,
                    }
                ],
            }
        ],
        "warnings": ["部分指标缺少原文证据。"],
    }

    result = normalize_source_parse(raw)

    assert result.source_subtype == "resume"
    assert result.warnings == ["部分指标缺少原文证据。"]
    assert len(result.events) == 1
    event = result.events[0]
    assert event.section_type == "work"
    assert event.section_title == "工作经历"
    assert event.event_type == "internship"
    assert event.details_json["needs_review_fields"] == ["outcome"]
    assert event.claims[0].evidence_quote == "负责增长实验设计"
    assert event.evidence[0].locator == {"page": 1}


def test_normalize_source_parse_ignores_legacy_flat_events_shape():
    result = normalize_source_parse({"events": [{"title": "旧格式"}], "claims": []})
    assert result.events == []
```

- [ ] **Step 6: Run normalizer tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run python -m pytest tests/test_source_parse.py -v
```

Expected: PASS.

- [ ] **Step 7: Update prompt to require the new contract**

Replace `source_parse_system_prompt()` in `apps/api/services/parse_prompts.py` with a Chinese OpenAI-first prompt that requires the `sections[].events[]` contract. Keep `jd_analysis_system_prompt()` intact unless it contains outdated non-OpenAI wording.

Required content:

```python
def source_parse_system_prompt() -> str:
    """从自由材料中提取 section/event/claim/evidence 草稿。"""
    return (
        "你是一个职业资产解析助手。你的任务不是写简历，而是把用户提供的材料拆成可编辑、可验证、可复用的职业档案草稿。\\n\\n"
        "必须只返回 JSON object，不要输出 Markdown。\\n\\n"
        "## 顶层 JSON\\n"
        "{\\n"
        '  "source_type": "resume | jd | project_note | certificate | screenshot | profile_page | mixed | unknown",\\n'
        '  "source_subtype": "resume | jd | project_note | certificate | screenshot | profile_page | mixed | unknown",\\n'
        '  "language": "zh-CN",\\n'
        '  "sections": [],\\n'
        '  "warnings": []\\n'
        "}\\n\\n"
        "## section shape\\n"
        "{\\n"
        '  "section_type": "work | project | education | credential | research | portfolio | skill | custom",\\n'
        '  "section_title": "工作经历",\\n'
        '  "events": []\\n'
        "}\\n\\n"
        "## event shape\\n"
        "{\\n"
        '  "event_type": "work | internship | project | education | certification | award | publication | patent | course | competition | open_source | startup | volunteer | language | custom",\\n'
        '  "title": "",\\n'
        '  "role": null,\\n'
        '  "organization": null,\\n'
        '  "location": null,\\n'
        '  "time_start": null,\\n'
        '  "time_end": null,\\n'
        '  "time_precision": "day | month | year | unknown",\\n'
        '  "description": "",\\n'
        '  "details": {\\n'
        '    "context": "",\\n'
        '    "contribution": "",\\n'
        '    "implementation": "",\\n'
        '    "outcome": "",\\n'
        '    "open_questions": [],\\n'
        '    "needs_review_fields": []\\n'
        "  },\\n"
        '  "claims": [],\\n'
        '  "evidence": [],\\n'
        '  "status": "draft",\\n'
        '  "confidence": 0.0\\n'
        "}\\n\\n"
        "## claim shape\\n"
        "{\\n"
        '  "claim_text": "",\\n'
        '  "claim_type": "achievement | skill | metric | responsibility | credential | preference",\\n'
        '  "strength": "confirmed | inferred | weak",\\n'
        '  "evidence_quote": null,\\n'
        '  "confidence": 0.0\\n'
        "}\\n\\n"
        "## evidence shape\\n"
        "{\\n"
        '  "quote": "",\\n'
        '  "locator": {"page": null, "url": null, "file_path": null, "text_offset": null, "image_region": null},\\n'
        '  "confidence": 0.0\\n'
        "}\\n\\n"
        "## 规则\\n"
        "1. 不得编造公司、学校、日期、指标、奖项、证书。\\n"
        "2. 如果文本是 JD，只在 warnings 说明这是岗位描述，不要生成用户 CareerEvent，除非文本明确包含用户自己的经历。\\n"
        "3. 每个 claim 尽量提供原文 evidence_quote；没有证据时 strength 必须是 weak 或 inferred。\\n"
        "4. 一个工作经历中的独立项目可以拆成 project event。\\n"
        "5. 缺失或不确定字段写入 details.needs_review_fields 和 details.open_questions。\\n"
        "6. 所有可本地化字段默认中文，专业术语和工具名可保留英文。\\n"
        "7. 所有 event.status 必须是 draft。\\n"
    )
```

- [ ] **Step 8: Run parser tests again**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run python -m pytest tests/test_source_parse.py -v
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add apps/api/services/parse_prompts.py apps/api/services/source_parse.py apps/api/tests/test_source_parse.py
git commit -m "feat: define vault source parse contract"
```

---

### Task 2: Persist Parsed Events, Claims, Evidence, And Source Metadata

**Files:**
- Modify: `apps/api/services/ai_worker.py`
- Modify: `apps/api/routers/vault_sources.py`
- Test: `apps/api/tests/test_ai_worker.py`

**Interfaces:**
- Consumes: `normalize_source_parse(raw: dict) -> NormalizedParseResult`
- Produces: persisted `CareerEvent.details_json`, `Claim`, `Evidence`, `SourceMaterial.metadata_json.ai_warnings`

- [ ] **Step 1: Write failing worker persistence test**

Create `apps/api/tests/test_ai_worker.py`:

```python
import uuid
from datetime import datetime

from sqlmodel import Session, select

import services.ai_worker as ai_worker
from models import BackgroundJob, CareerEvent, Claim, Evidence, SourceMaterial, User


def test_execute_job_persists_events_claims_evidence_and_metadata(monkeypatch, session: Session):
    user = User(email="worker@example.com", display_name="Worker User")
    session.add(user)
    session.commit()
    session.refresh(user)

    source = SourceMaterial(
        user_id=user.id,
        source_type="text",
        title="简历片段",
        raw_text="负责增长实验设计",
        parse_status="uploaded",
    )
    session.add(source)
    session.commit()
    session.refresh(source)

    job = BackgroundJob(
        user_id=user.id,
        job_type="source_parse",
        payload={"source_id": str(source.id), "text": source.raw_text},
        status="queued",
    )
    session.add(job)
    session.commit()
    session.refresh(job)

    monkeypatch.setattr(ai_worker, "DRY_RUN", False)
    monkeypatch.setattr(ai_worker, "_resolve_api_key", lambda user_id, session: ("sk-test", "openai"))
    monkeypatch.setattr(ai_worker, "_call_ai", lambda api_base, api_key, prompt, text: {
        "source_type": "resume",
        "source_subtype": "resume",
        "language": "zh-CN",
        "sections": [
            {
                "section_type": "work",
                "section_title": "工作经历",
                "events": [
                    {
                        "event_type": "internship",
                        "title": "增长产品实习",
                        "role": "产品实习生",
                        "organization": "字节跳动",
                        "time_start": "2024-06",
                        "time_end": "2025-03",
                        "details": {"context": "增长场景", "needs_review_fields": ["outcome"]},
                        "claims": [
                            {
                                "claim_text": "参与增长实验设计。",
                                "claim_type": "responsibility",
                                "strength": "confirmed",
                                "evidence_quote": "负责增长实验设计",
                                "confidence": 0.84,
                            }
                        ],
                        "evidence": [
                            {"quote": "负责增长实验设计", "locator": {"page": 1}, "confidence": 0.84}
                        ],
                        "confidence": 0.84,
                    }
                ],
            }
        ],
        "warnings": ["部分指标缺少原文证据。"],
    })

    ai_worker._execute_job(session, job)

    session.refresh(source)
    session.refresh(job)
    event = session.exec(select(CareerEvent).where(CareerEvent.source_id == source.id)).one()
    claim = session.exec(select(Claim).where(Claim.career_event_id == event.id)).one()
    evidence = session.exec(select(Evidence).where(Evidence.claim_id == claim.id)).one()

    assert source.parse_status == "parsed"
    assert source.metadata_json["source_subtype"] == "resume"
    assert source.metadata_json["ai_warnings"] == ["部分指标缺少原文证据。"]
    assert job.status == "succeeded"
    assert event.status == "draft"
    assert event.details_json["context"] == "增长场景"
    assert event.details_json["needs_review_fields"] == ["outcome"]
    assert claim.claim_text == "参与增长实验设计。"
    assert evidence.quote == "负责增长实验设计"
    assert evidence.locator_json == {"page": 1}
```

If the existing test fixture is not named `session`, adapt only the fixture name to the project’s current `tests/test_auth.py` fixture pattern. Do not change assertions.

- [ ] **Step 2: Run worker test and verify failure**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run python -m pytest tests/test_ai_worker.py -v
```

Expected: FAIL because `ai_worker` still expects legacy `events` / `claims`.

- [ ] **Step 3: Update imports and remove legacy claim parsing**

In `apps/api/services/ai_worker.py`, change imports:

```python
from models import SourceMaterial, BackgroundJob, CareerEvent, Claim, Profile, Evidence
from services.parse_prompts import source_parse_system_prompt, jd_analysis_system_prompt
from services.source_parse import normalize_source_parse
```

Keep `jd_analysis_system_prompt` only if still used; otherwise remove the unused import.

- [ ] **Step 4: Persist normalized events, claims, and evidence**

Inside `_execute_job`, replace the legacy `events_data = parsed.get("events", [])` and `claims_data = parsed.get("claims", [])` block with:

```python
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

        event_level_evidence_ids = []
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
            session.flush()
            event_level_evidence_ids.append(evidence.id)
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
```

- [ ] **Step 5: Fix duplicated source parse status assignment**

In `_execute_job`, replace the duplicated lines:

```python
    source.parse_status = "extracting"
    source.parse_status = "extracting"
```

with:

```python
    source.parse_status = "extracting"
```

- [ ] **Step 6: Add `input_hint` to source creation**

In `apps/api/routers/vault_sources.py`, update `MultiSourceInput`:

```python
class MultiSourceInput(BaseModel):
    text: str = ""
    urls: list[str] = []
    input_hint: str = ""
```

In `create_source`, set:

```python
metadata_json={"input_hint": body.input_hint.strip()} if body.input_hint.strip() else {},
```

and include `input_hint` in the job payload:

```python
"input_hint": body.input_hint,
```

- [ ] **Step 7: Return metadata and longer preview from source detail**

In `get_source`, return:

```python
"raw_text_preview": (source.raw_text or "")[:2000],
"metadata_json": source.metadata_json or {},
"parse_error": source.parse_error,
```

- [ ] **Step 8: Run worker test**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run python -m pytest tests/test_ai_worker.py -v
```

Expected: PASS.

- [ ] **Step 9: Run related backend tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run python -m pytest tests/test_source_parse.py tests/test_ai_worker.py tests/test_auth.py -v
```

Expected: PASS.

- [ ] **Step 10: Commit Task 2**

```bash
git add apps/api/services/ai_worker.py apps/api/routers/vault_sources.py apps/api/tests/test_ai_worker.py
git commit -m "feat: persist parsed vault evidence"
```

---

### Task 3: Vault Event API Cleanup

**Files:**
- Modify: `apps/api/routers/vault_events.py`
- Modify: `apps/api/routers/vault.py`
- Test: `apps/api/tests/test_vault_events.py`

**Interfaces:**
- Consumes: `CareerEvent.details_json.section_type` and `Claim` / `Evidence` rows from Task 2.
- Produces: `GET /api/vault/events?grouped=true`, `DELETE /api/vault/events/{event_id}`, event serializer with `claims_count` and `evidence_count`.

- [ ] **Step 1: Write failing tests for grouped events and delete cascade**

Create `apps/api/tests/test_vault_events.py`:

```python
from sqlmodel import Session, select

from models import CareerEvent, Claim, Evidence, SourceMaterial, User


def test_grouped_events_include_section_metadata(auth_client, session: Session):
    user = User(email="group@example.com", display_name="Group User")
    session.add(user)
    session.commit()
    session.refresh(user)
    client, headers = auth_client(user)

    event = CareerEvent(
        user_id=user.id,
        event_type="internship",
        title="增长产品实习",
        details_json={"section_type": "work", "section_title": "工作经历"},
        status="draft",
    )
    session.add(event)
    session.commit()

    response = client.get("/api/vault/events?grouped=true", headers=headers)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data[0]["section_type"] == "work"
    assert data[0]["section_title"] == "工作经历"
    assert data[0]["events"][0]["title"] == "增长产品实习"


def test_delete_event_removes_claims_and_evidence(auth_client, session: Session):
    user = User(email="delete@example.com", display_name="Delete User")
    session.add(user)
    session.commit()
    session.refresh(user)
    client, headers = auth_client(user)

    source = SourceMaterial(user_id=user.id, source_type="text", title="source")
    session.add(source)
    session.commit()
    session.refresh(source)

    event = CareerEvent(user_id=user.id, event_type="project", title="项目", source_id=source.id)
    session.add(event)
    session.commit()
    session.refresh(event)

    claim = Claim(user_id=user.id, career_event_id=event.id, claim_text="做了项目")
    session.add(claim)
    session.commit()
    session.refresh(claim)

    evidence = Evidence(
        user_id=user.id,
        source_material_id=source.id,
        career_event_id=event.id,
        claim_id=claim.id,
        quote="做了项目",
    )
    session.add(evidence)
    session.commit()

    response = client.delete(f"/api/vault/events/{event.id}", headers=headers)

    assert response.status_code == 200
    assert session.get(CareerEvent, event.id) is None
    assert session.exec(select(Claim).where(Claim.career_event_id == event.id)).all() == []
    assert session.exec(select(Evidence).where(Evidence.career_event_id == event.id)).all() == []
```

If `auth_client` fixture does not exist, create it using existing auth test helpers. The fixture must return `(client, headers)` for a provided `User`.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run python -m pytest tests/test_vault_events.py -v
```

Expected: FAIL because grouped output and delete endpoint are missing.

- [ ] **Step 3: Add section helper and grouped query param**

In `apps/api/routers/vault_events.py`, import:

```python
from models import CareerEvent, Claim, Evidence
from services.source_parse import event_type_to_section
```

Update `list_events` signature:

```python
def list_events(
    status: str = Query(None),
    event_type: str = Query(None),
    visibility: str = Query(None),
    grouped: bool = Query(False),
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
```

After fetching `events`, return grouped data when requested:

```python
    serialized = [_serialize_event(e, session) for e in events]
    if grouped:
        return {"data": _group_events(serialized)}
    return {"data": serialized}
```

- [ ] **Step 4: Update serializer with counts and section**

Replace `_serialize_event` with:

```python
def _section_for_event(e: CareerEvent) -> dict:
    details = e.details_json or {}
    if details.get("section_type") and details.get("section_title"):
        return {
            "section_type": details["section_type"],
            "section_title": details["section_title"],
        }
    return event_type_to_section(e.event_type)


def _serialize_event(e: CareerEvent, session: Session | None = None) -> dict:
    section = _section_for_event(e)
    claims_count = 0
    evidence_count = 0
    if session is not None:
        claims_count = len(session.exec(select(Claim).where(Claim.career_event_id == e.id)).all())
        evidence_count = len(session.exec(select(Evidence).where(Evidence.career_event_id == e.id)).all())
    return {
        "id": str(e.id),
        "section_type": section["section_type"],
        "section_title": section["section_title"],
        "event_type": e.event_type,
        "title": e.title,
        "role": e.role,
        "organization": e.organization,
        "location": e.location,
        "time_start": e.time_start,
        "time_end": e.time_end,
        "time_precision": e.time_precision,
        "description": e.description,
        "details_json": e.details_json,
        "tags": e.tags,
        "status": e.status,
        "visibility": e.visibility,
        "source_confidence": e.source_confidence,
        "source_id": str(e.source_id) if e.source_id else None,
        "claims_count": claims_count,
        "evidence_count": evidence_count,
        "created_at": e.created_at.isoformat(),
        "updated_at": e.updated_at.isoformat(),
    }
```

Update existing calls to `_serialize_event(event)` to `_serialize_event(event, session)`.

- [ ] **Step 5: Add group function**

Add to `apps/api/routers/vault_events.py`:

```python
SECTION_ORDER = ["work", "project", "education", "credential", "research", "portfolio", "skill", "custom"]


def _group_events(events: list[dict]) -> list[dict]:
    groups: dict[str, dict] = {}
    for event in events:
        section_type = event["section_type"]
        if section_type not in groups:
            groups[section_type] = {
                "section_type": section_type,
                "section_title": event["section_title"],
                "events": [],
            }
        groups[section_type]["events"].append(event)
    return sorted(
        groups.values(),
        key=lambda item: SECTION_ORDER.index(item["section_type"]) if item["section_type"] in SECTION_ORDER else len(SECTION_ORDER),
    )
```

- [ ] **Step 6: Add delete endpoint**

Add before helper functions:

```python
@router.delete("/{event_id}")
def delete_event(
    event_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    event = session.get(CareerEvent, event_id)
    if not event or str(event.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Event not found")

    evidences = session.exec(select(Evidence).where(Evidence.career_event_id == event.id)).all()
    for evidence in evidences:
        session.delete(evidence)

    claims = session.exec(select(Claim).where(Claim.career_event_id == event.id)).all()
    for claim in claims:
        session.delete(claim)

    session.delete(event)
    session.commit()
    return {"message": "已删除", "event_id": event_id}
```

- [ ] **Step 7: Make claim ownership checks validate event ownership**

In `apps/api/routers/vault.py`, update `create_claim` before creating the claim:

```python
    event = session.get(CareerEvent, body.event_id)
    if not event or str(event.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Event not found")
```

In `list_claims`, when `event_id` is provided, validate the event belongs to the user before returning claims.

- [ ] **Step 8: Run API tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run python -m pytest tests/test_vault_events.py tests/test_auth.py -v
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```bash
git add apps/api/routers/vault_events.py apps/api/routers/vault.py apps/api/tests/test_vault_events.py
git commit -m "feat: group and manage vault events"
```

---

### Task 4: Frontend API Client And Navigation Contract

**Files:**
- Modify: `apps/web/lib/api-client.ts`
- Modify: `apps/web/components/app-shell.tsx`
- Test: TypeScript compile

**Interfaces:**
- Consumes: backend endpoints from Task 3.
- Produces: typed helpers used by `/vault` page.

- [ ] **Step 1: Add frontend types**

In `apps/web/lib/api-client.ts`, add near the top after auth exports:

```ts
export type VaultClaim = {
  id: string
  career_event_id: string
  claim_text: string
  claim_type: string
  strength: string
  visibility?: string
}

export type VaultEvent = {
  id: string
  section_type?: string
  section_title?: string
  event_type: string
  title: string
  role?: string | null
  organization?: string | null
  location?: string | null
  time_start?: string | null
  time_end?: string | null
  time_precision?: string
  description?: string | null
  details_json?: Record<string, any>
  tags?: string[]
  status: string
  visibility: string
  source_confidence?: number | null
  source_id?: string | null
  claims_count?: number
  evidence_count?: number
}

export type VaultSection = {
  section_type: string
  section_title: string
  events: VaultEvent[]
}

export type VaultSourceInput = {
  text: string
  urls: string[]
  input_hint?: string
}
```

- [ ] **Step 2: Update source creation helper**

Replace:

```ts
export const createSource = (data: { text: string; urls: string[] }) =>
```

with:

```ts
export const createSource = (data: VaultSourceInput) =>
```

- [ ] **Step 3: Add grouped event helper and delete helper**

Add:

```ts
export const getGroupedEvents = (params?: { status?: string }) => {
  const q = new URLSearchParams()
  q.set('grouped', 'true')
  if (params?.status) q.set('status', params.status)
  return fetchAPI<{ data: VaultSection[] }>(`/api/vault/events?${q.toString()}`)
}

export const deleteEvent = (id: string) =>
  fetchAPI(`/api/vault/events/${id}`, { method: 'DELETE' })
```

- [ ] **Step 4: Update visible nav label**

In `apps/web/components/app-shell.tsx`, find the nav item for `/vault` and change its visible label from any older name to:

```ts
职业档案
```

Keep the route as `/vault`.

- [ ] **Step 5: Run type check**

Run:

```bash
cd apps/web
./node_modules/.bin/tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add apps/web/lib/api-client.ts apps/web/components/app-shell.tsx
git commit -m "feat: add vault profile client contract"
```

---

### Task 5: Rebuild `/vault` As Two-Column Profile Builder

**Files:**
- Modify: `apps/web/app/vault/page.tsx`
- Test: TypeScript compile

**Interfaces:**
- Consumes: `createSource`, `uploadSource`, `getGroupedEvents`, `updateEvent`, `confirmEvent`, `deleteEvent`, claim helpers.
- Produces: user-facing unified input, sectioned events, modal editor.

- [ ] **Step 1: Replace page state imports**

In `apps/web/app/vault/page.tsx`, import:

```ts
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createSource,
  uploadSource as uploadSourceFile,
  getGroupedEvents,
  updateEvent,
  confirmEvent,
  deleteEvent,
  getClaims,
  createClaim,
  updateClaim,
  deleteClaim,
  type VaultEvent,
  type VaultSection,
  type VaultClaim,
} from '@/lib/api-client'
```

Remove unused old imports such as `archiveEvent`, `getReadiness`, `getSources`, and `getSource` unless the new page uses them explicitly.

- [ ] **Step 2: Define section and form constants**

Add:

```ts
const STATUS_LABELS: Record<string, string> = {
  draft: '待确认',
  needs_review: '需补充',
  confirmed: '已确认',
  archived: '已归档',
}

const EVENT_TYPE_OPTIONS = [
  ['work', '工作'],
  ['internship', '实习'],
  ['project', '项目'],
  ['education', '教育'],
  ['certification', '证书'],
  ['award', '奖项'],
  ['publication', '论文/发表'],
  ['open_source', '开源'],
  ['startup', '创业'],
  ['language', '语言'],
  ['custom', '自定义'],
]

const EMPTY_DETAILS = {
  context: '',
  contribution: '',
  implementation: '',
  outcome: '',
  open_questions: [],
  needs_review_fields: [],
}

function eventToForm(event: VaultEvent) {
  return {
    title: event.title || '',
    event_type: event.event_type || 'custom',
    role: event.role || '',
    organization: event.organization || '',
    location: event.location || '',
    time_start: event.time_start || '',
    time_end: event.time_end || '',
    time_precision: event.time_precision || 'month',
    description: event.description || '',
    visibility: event.visibility || 'private',
    status: event.status || 'draft',
    tags_text: (event.tags || []).join('，'),
    details: { ...EMPTY_DETAILS, ...(event.details_json || {}) },
  }
}

function splitTags(value: string) {
  return value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean)
}
```

- [ ] **Step 3: Build source input panel**

Implement left panel state:

```ts
const [text, setText] = useState('')
const [urls, setUrls] = useState('')
const [inputHint, setInputHint] = useState('')
const [fileUploading, setFileUploading] = useState(false)
const [submitting, setSubmitting] = useState(false)
const [statusMessage, setStatusMessage] = useState('')
const fileRef = useRef<HTMLInputElement>(null)
```

Add submit handlers:

```ts
async function submitTextSource() {
  const cleanText = text.trim()
  const cleanUrls = urls.split('\n').map((url) => url.trim()).filter((url) => url.startsWith('http'))
  if (!cleanText && cleanUrls.length === 0) {
    setStatusMessage('请先输入文字或链接')
    return
  }
  setSubmitting(true)
  setStatusMessage('正在创建解析任务...')
  try {
    await createSource({ text: cleanText, urls: cleanUrls, input_hint: inputHint.trim() })
    setText('')
    setUrls('')
    setInputHint('')
    setStatusMessage('已提交，正在解析。右侧会自动刷新。')
    await loadSections()
  } catch {
    setStatusMessage('提交失败，请检查登录状态或 API 设置')
  } finally {
    setSubmitting(false)
  }
}

async function submitFile(file: File) {
  setFileUploading(true)
  setStatusMessage('正在上传文件...')
  try {
    await uploadSourceFile(file)
    setStatusMessage('文件已上传，正在解析。')
    await loadSections()
  } catch {
    setStatusMessage('文件上传失败')
  } finally {
    setFileUploading(false)
  }
}
```

- [ ] **Step 4: Load grouped sections with polling-friendly function**

Add:

```ts
const [sections, setSections] = useState<VaultSection[]>([])
const [loading, setLoading] = useState(true)

async function loadSections() {
  setLoading(true)
  try {
    const response = await getGroupedEvents()
    setSections(response.data || [])
  } finally {
    setLoading(false)
  }
}

useEffect(() => {
  loadSections()
  const timer = window.setInterval(loadSections, 5000)
  return () => window.clearInterval(timer)
}, [])
```

- [ ] **Step 5: Build sectioned event panel**

Render right panel:

```tsx
<section className="vault-profile">
  <div className="vault-profile-header">
    <div>
      <p className="eyebrow">职业档案</p>
      <h1>把材料整理成可复用的经历资产</h1>
    </div>
    <button onClick={loadSections}>刷新</button>
  </div>

  {loading ? (
    <div className="empty-state">正在加载职业档案...</div>
  ) : sections.length === 0 ? (
    <div className="empty-state">左侧输入材料后，AI 会在这里按分类生成经历卡片。</div>
  ) : (
    sections.map((section) => (
      <div key={section.section_type} className="profile-section">
        <div className="section-heading">
          <h2>{section.section_title}</h2>
          <span>{section.events.length} 个事件</span>
        </div>
        <div className="event-grid">
          {section.events.map((event) => (
            <button key={event.id} className="event-card" onClick={() => openEvent(event)}>
              <div className="event-card-top">
                <span>{STATUS_LABELS[event.status] || event.status}</span>
                <span>{Math.round((event.source_confidence || 0) * 100) || '--'}%</span>
              </div>
              <h3>{event.title}</h3>
              <p>{[event.organization, event.role].filter(Boolean).join(' · ') || '未填写组织/角色'}</p>
              <p>{[event.time_start, event.time_end].filter(Boolean).join(' - ') || '时间待补充'}</p>
              <div className="event-meta-row">
                <span>{event.claims_count || 0} claims</span>
                <span>{event.evidence_count || 0} evidence</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    ))
  )}
</section>
```

- [ ] **Step 6: Build event modal state and save handlers**

Add:

```ts
const [activeEvent, setActiveEvent] = useState<VaultEvent | null>(null)
const [eventForm, setEventForm] = useState<any>(null)
const [claims, setClaims] = useState<VaultClaim[]>([])
const [newClaimText, setNewClaimText] = useState('')

async function openEvent(event: VaultEvent) {
  setActiveEvent(event)
  setEventForm(eventToForm(event))
  const response: any = await getClaims({ event_id: event.id })
  setClaims(response.data || [])
}

async function saveEvent() {
  if (!activeEvent || !eventForm) return
  await updateEvent(activeEvent.id, {
    title: eventForm.title,
    event_type: eventForm.event_type,
    role: eventForm.role || null,
    organization: eventForm.organization || null,
    location: eventForm.location || null,
    time_start: eventForm.time_start || null,
    time_end: eventForm.time_end || null,
    time_precision: eventForm.time_precision,
    description: eventForm.description || null,
    details_json: eventForm.details,
    tags: splitTags(eventForm.tags_text),
    visibility: eventForm.visibility,
    status: eventForm.status,
  })
  setStatusMessage('事件已保存')
  await loadSections()
}

async function confirmActiveEvent() {
  if (!activeEvent) return
  await confirmEvent(activeEvent.id)
  setActiveEvent(null)
  await loadSections()
}

async function deleteActiveEvent() {
  if (!activeEvent) return
  if (!window.confirm('确定删除这个事件？相关 claims 和 evidence 也会删除。')) return
  await deleteEvent(activeEvent.id)
  setActiveEvent(null)
  await loadSections()
}
```

- [ ] **Step 7: Add claim edit operations in modal**

Add:

```ts
async function addClaim() {
  if (!activeEvent || !newClaimText.trim()) return
  await createClaim({
    event_id: activeEvent.id,
    claim_text: newClaimText.trim(),
    claim_type: 'achievement',
    strength: 'confirmed',
  })
  setNewClaimText('')
  await openEvent(activeEvent)
  await loadSections()
}

async function removeClaim(claimId: string) {
  if (!activeEvent) return
  await deleteClaim(claimId)
  await openEvent(activeEvent)
  await loadSections()
}

async function renameClaim(claim: VaultClaim, claimText: string) {
  if (!activeEvent) return
  await updateClaim(claim.id, { claim_text: claimText })
  await openEvent(activeEvent)
}
```

- [ ] **Step 8: Render event modal**

Render when `activeEvent && eventForm`:

```tsx
<div className="modal-backdrop" onClick={() => setActiveEvent(null)}>
  <div className="event-modal" onClick={(event) => event.stopPropagation()}>
    <div className="modal-header">
      <div>
        <p className="eyebrow">编辑事件</p>
        <h2>{activeEvent.title}</h2>
      </div>
      <button onClick={() => setActiveEvent(null)}>关闭</button>
    </div>

    <div className="modal-grid">
      <label>标题<input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} /></label>
      <label>类型<select value={eventForm.event_type} onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}>{EVENT_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>角色<input value={eventForm.role} onChange={(e) => setEventForm({ ...eventForm, role: e.target.value })} /></label>
      <label>组织<input value={eventForm.organization} onChange={(e) => setEventForm({ ...eventForm, organization: e.target.value })} /></label>
      <label>地点<input value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} /></label>
      <label>开始时间<input value={eventForm.time_start} onChange={(e) => setEventForm({ ...eventForm, time_start: e.target.value })} /></label>
      <label>结束时间<input value={eventForm.time_end} onChange={(e) => setEventForm({ ...eventForm, time_end: e.target.value })} /></label>
      <label>标签<input value={eventForm.tags_text} onChange={(e) => setEventForm({ ...eventForm, tags_text: e.target.value })} /></label>
    </div>

    <label>描述<textarea value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} /></label>
    <label>背景<textarea value={eventForm.details.context} onChange={(e) => setEventForm({ ...eventForm, details: { ...eventForm.details, context: e.target.value } })} /></label>
    <label>个人贡献<textarea value={eventForm.details.contribution} onChange={(e) => setEventForm({ ...eventForm, details: { ...eventForm.details, contribution: e.target.value } })} /></label>
    <label>实现方法<textarea value={eventForm.details.implementation} onChange={(e) => setEventForm({ ...eventForm, details: { ...eventForm.details, implementation: e.target.value } })} /></label>
    <label>结果<textarea value={eventForm.details.outcome} onChange={(e) => setEventForm({ ...eventForm, details: { ...eventForm.details, outcome: e.target.value } })} /></label>

    <div className="claims-panel">
      <h3>Claims</h3>
      {claims.map((claim) => (
        <div key={claim.id} className="claim-row">
          <input defaultValue={claim.claim_text} onBlur={(e) => renameClaim(claim, e.target.value)} />
          <button onClick={() => removeClaim(claim.id)}>删除</button>
        </div>
      ))}
      <div className="claim-row">
        <input value={newClaimText} onChange={(e) => setNewClaimText(e.target.value)} placeholder="新增可复用事实" />
        <button onClick={addClaim}>添加</button>
      </div>
    </div>

    <div className="modal-actions">
      <button onClick={deleteActiveEvent} className="danger">删除</button>
      <button onClick={saveEvent}>保存修改</button>
      <button onClick={confirmActiveEvent} className="primary">确认入库</button>
    </div>
  </div>
</div>
```

- [ ] **Step 9: Add page CSS in the same file or existing globals pattern**

Use existing styling pattern in `apps/web/app/vault/page.tsx` or `apps/web/app/globals.css`. Required layout CSS:

```css
.vault-builder {
  display: grid;
  grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
  gap: 24px;
  min-height: calc(100vh - 96px);
}

.source-panel,
.vault-profile,
.event-modal {
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 28px;
  box-shadow: 0 18px 60px rgba(33, 58, 92, 0.08);
}

.event-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.32);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 50;
}

.event-modal {
  width: min(920px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  padding: 24px;
}

@media (max-width: 980px) {
  .vault-builder {
    grid-template-columns: 1fr;
  }
}
```

Adapt class names to the actual JSX if needed. Keep text readable on mobile.

- [ ] **Step 10: Run type check**

Run:

```bash
cd apps/web
./node_modules/.bin/tsc --noEmit
```

Expected: PASS.

- [ ] **Step 11: Commit Task 5**

```bash
git add apps/web/app/vault/page.tsx apps/web/app/globals.css
git commit -m "feat: rebuild vault profile builder"
```

---

### Task 6: End-To-End Verification And Cleanup

**Files:**
- Modify only files needed to fix failures discovered in verification.
- Test: backend pytest, frontend type check, local API smoke test.

**Interfaces:**
- Consumes all previous tasks.
- Produces verified local flow.

- [ ] **Step 1: Run backend focused tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run python -m pytest tests/test_source_parse.py tests/test_ai_worker.py tests/test_vault_events.py tests/test_auth.py -v
```

Expected: PASS.

- [ ] **Step 2: Run frontend type check**

Run:

```bash
cd apps/web
./node_modules/.bin/tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run diff check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 4: Start backend and frontend if they are not already running**

Backend:

```bash
cd apps/api
PYTHONPATH=. uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd apps/web
npm run dev
```

Expected:

- Backend serves `http://127.0.0.1:8000/api/health`.
- Frontend serves `http://localhost:3000/vault`.

- [ ] **Step 5: Smoke test health endpoint**

Run:

```bash
curl -s http://127.0.0.1:8000/api/health
```

Expected response contains healthy status, for example:

```json
{"status":"ok"}
```

- [ ] **Step 6: Manual browser flow**

In browser:

1. Log in.
2. Open `http://localhost:3000/vault`.
3. Paste this sample into the left input:

```text
2024.06-2025.03，我在字节跳动做增长产品实习生，负责抖音电商增长实验设计和数据分析，使用 A/B 测试和 SQL 分析转化链路，并参与实验复盘。
```

4. Click `解析并整理`.
5. If `AI_PARSE_DRY_RUN=true`, set it to false and restart backend/worker before expecting AI output.
6. Confirm right side displays a draft event under `工作经历`.
7. Open the event modal.
8. Edit `个人贡献`.
9. Add one claim.
10. Save.
11. Confirm the event.
12. Refresh and verify it remains visible as confirmed.

- [ ] **Step 7: Check no secrets are returned**

Open browser devtools or use API client to call:

```bash
curl -s http://127.0.0.1:8000/api/vault/profile
```

Expected: response may include `has_ai_api_key`, but must not include `ai_api_key`.

- [ ] **Step 8: Commit verification fixes**

If any verification fixes were made:

```bash
git add <fixed-files>
git commit -m "fix: verify vault profile builder flow"
```

If no fixes were made, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage:
  - Unified input: Task 5.
  - OpenAI parse contract: Task 1.
  - Persist events/claims/evidence: Task 2.
  - Grouped section display API: Task 3.
  - Event modal edit/confirm/delete: Tasks 3 and 5.
  - Chinese UI and `/vault` route decision: Tasks 4 and 5.
  - API key not returned: Task 6 verification plus existing profile serializer.
- Scope intentionally excludes full resume generation, multi-provider settings, browser plugin capture, and automated platform scraping.
- No task should change unrelated pages except `app-shell` nav label.
