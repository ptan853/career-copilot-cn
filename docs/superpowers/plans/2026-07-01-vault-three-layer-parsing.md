# Vault Three-Layer Parsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current one-shot Vault AI parser with an internal three-layer pipeline that detects source sections, extracts section-specific events, and skips or merges duplicates while preserving the same simple user experience.

**Architecture:** Keep the existing Vault UI and persistence model for the first implementation. Add backend-only pipeline modules for source detection, section extractor prompts, section span grouping, canonical keys, and deterministic duplicate handling. Store intermediate section maps in `SourceMaterial.metadata_json` instead of adding new permanent tables in this iteration.

**Tech Stack:** FastAPI, SQLModel, pytest, OpenAI-compatible provider adapter, Next.js Vault UI unchanged except status compatibility if needed.

## Global Constraints

- User flow remains one action: input materials, click parse, right-side profile updates.
- Do not expose candidate, merge proposal, reconciliation queue, or conflict UI.
- AI instruction is parse-level context, not a SourceMaterial.
- Each file is its own SourceMaterial.
- Each URL is its own SourceMaterial.
- Text material from one submit action is one SourceMaterial.
- Source detection is per source; event extraction is per section across grouped source spans.
- Repeated identical input must not create duplicate CareerEvents.
- Confirmed CareerEvents must not be silently overwritten.
- Keep existing `CareerEvent`, `SourceMaterial`, `BackgroundJob`, `Evidence`, and `Claim` tables in this iteration.

---

## File Structure

- Create `apps/api/services/vault_pipeline_types.py`
  - Pydantic/dataclass contracts for source detection, section spans, extracted events, and merge decisions.
- Create `apps/api/services/vault_pipeline_prompts.py`
  - Prompt builders for layer 1 detection, section extractors, and event pair merge.
- Create `apps/api/services/vault_pipeline_keys.py`
  - Canonical key and duplicate matching helpers.
- Create `apps/api/services/vault_pipeline.py`
  - Orchestrates source detection, section grouping, section extraction, duplicate handling, and persistence handoff.
- Modify `apps/api/services/ai_worker.py`
  - Calls the new pipeline instead of the current one-shot parse path.
- Modify `apps/api/routers/vault_sources.py`
  - Splits URLs into separate SourceMaterial rows and passes parse instruction consistently.
- Modify `apps/api/services/source_parse.py`
  - Keep current normalizer as compatibility fallback and reuse detail normalization.
- Create `apps/api/tests/test_vault_pipeline_prompts.py`
  - Verifies prompt registry and required section contracts.
- Create `apps/api/tests/test_vault_pipeline_keys.py`
  - Verifies canonical keys and duplicate matching.
- Create `apps/api/tests/test_vault_pipeline.py`
  - Verifies source maps, section grouping, extraction orchestration, and duplicate skip.
- Modify `apps/api/tests/test_vault_events.py`
  - Add repeated-source regression if needed.

---

### Task 1: Add Pipeline Contracts And Prompt Registry

**Files:**
- Create: `apps/api/services/vault_pipeline_types.py`
- Create: `apps/api/services/vault_pipeline_prompts.py`
- Test: `apps/api/tests/test_vault_pipeline_prompts.py`

**Interfaces:**
- Produces: `SourceSectionSpan`
- Produces: `SourceDetectionResult`
- Produces: `SectionExtractionResult`
- Produces: `EventMergeDecision`
- Produces: `source_detection_prompt(...) -> list[LLMMessage]`
- Produces: `section_extraction_prompt(...) -> list[LLMMessage]`
- Produces: `event_pair_merge_prompt(...) -> list[LLMMessage]`

- [ ] **Step 1: Write prompt registry tests**

Create tests that assert:

```python
from services.vault_pipeline_prompts import (
    SECTION_EXTRACTOR_REGISTRY,
    source_detection_prompt,
    section_extraction_prompt,
)


def test_source_detection_prompt_names_allowed_sections():
    messages = source_detection_prompt(
        source_id="src_1",
        source_type="text",
        source_title="note",
        source_text="Agent project and Imperial College MSc",
        instruction="重点提取 Agent 项目",
    )
    joined = "\n".join(message.content for message in messages)
    assert "experience" in joined
    assert "projects" in joined
    assert "courses" in joined
    assert "不要生成最终履历事件" in joined


def test_section_prompt_uses_section_specific_fields():
    messages = section_extraction_prompt(
        section_type="courses",
        instruction="只解析课程",
        existing_events=[],
        source_spans=[],
    )
    joined = "\n".join(message.content for message in messages)
    assert "课程抽取器" in joined
    assert "title" in joined
    assert "institution" in joined or "organization" in joined
    assert "不要把课程塞进 education" in joined


def test_registry_has_initial_sections():
    for section in ["profile", "summary", "experience", "projects", "education", "courses", "awards", "skills"]:
        assert section in SECTION_EXTRACTOR_REGISTRY
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run pytest tests/test_vault_pipeline_prompts.py -q
```

Expected: import failure because files do not exist yet.

- [ ] **Step 3: Add pipeline type contracts**

Create `vault_pipeline_types.py` with typed contracts:

```python
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
```

- [ ] **Step 4: Add prompt builders**

Create `vault_pipeline_prompts.py` using existing `LLMMessage` from `services.llm_providers`. Implement registry entries for:

```python
SECTION_EXTRACTOR_REGISTRY = {
    "profile": "...",
    "summary": "...",
    "experience": "...",
    "projects": "...",
    "education": "...",
    "courses": "...",
    "awards": "...",
    "skills": "...",
    "certifications": "...",
    "research": "...",
    "languages": "...",
}
```

Implement:

```python
def source_detection_prompt(source_id: str, source_type: str, source_title: str, source_text: str, instruction: str = "") -> list[LLMMessage]:
    ...


def section_extraction_prompt(section_type: str, instruction: str, existing_events: list[dict], source_spans: list[dict]) -> list[LLMMessage]:
    ...


def event_pair_merge_prompt(section_type: str, event_a: dict, event_b: dict, field_contract: str) -> list[LLMMessage]:
    ...
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run pytest tests/test_vault_pipeline_prompts.py -q
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/services/vault_pipeline_types.py apps/api/services/vault_pipeline_prompts.py apps/api/tests/test_vault_pipeline_prompts.py
git commit -m "Add vault parsing prompt registry"
```

---

### Task 2: Add Canonical Keys And Deterministic Duplicate Matching

**Files:**
- Create: `apps/api/services/vault_pipeline_keys.py`
- Test: `apps/api/tests/test_vault_pipeline_keys.py`

**Interfaces:**
- Produces: `canonical_event_key(section_type: str, event: dict) -> str`
- Produces: `is_likely_duplicate(section_type: str, event_a: dict, event_b: dict) -> bool`

- [ ] **Step 1: Write duplicate key tests**

Create tests:

```python
from services.vault_pipeline_keys import canonical_event_key, is_likely_duplicate


def test_experience_key_normalizes_org_title_and_dates():
    event = {
        "title": "Agent 算法工程师",
        "organization": "武汉光庭信息科技",
        "time_start": "2026-03",
        "time_end": "2026-05",
    }
    assert canonical_event_key("experience", event) == "experience|武汉光庭信息科技|agent算法工程师|2026-03|2026-05"


def test_course_duplicate_uses_title_and_institution():
    a = {"title": "机器学习 (Machine Learning)", "organization": "帝国理工大学"}
    b = {"title": "机器学习", "organization": "帝国理工大学"}
    assert is_likely_duplicate("courses", a, b)


def test_project_different_title_is_not_duplicate():
    a = {"title": "PM Agent 智能项目管理助手", "organization": "武汉光庭信息科技"}
    b = {"title": "Infplane Shell Suite", "organization": "个人项目"}
    assert not is_likely_duplicate("projects", a, b)
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run pytest tests/test_vault_pipeline_keys.py -q
```

Expected: import failure.

- [ ] **Step 3: Implement key helpers**

Implement normalization:

```python
def normalize_key_text(value: object) -> str:
    text = str(value or "").strip().lower()
    text = text.replace("（", "(").replace("）", ")")
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"[·•,，。:：/\\|_-]+", "", text)
    return text
```

Implement section key rules:

- experience: organization, title, time_start, time_end
- projects: title, organization or role
- education: organization, title, field
- courses: title, organization
- awards: title, organization, time_end
- certifications: title, organization
- skills: title
- languages: title

- [ ] **Step 4: Run tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run pytest tests/test_vault_pipeline_keys.py -q
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/services/vault_pipeline_keys.py apps/api/tests/test_vault_pipeline_keys.py
git commit -m "Add vault event duplicate keys"
```

---

### Task 3: Split Inputs Into Batch Sources

**Files:**
- Modify: `apps/api/routers/vault_sources.py`
- Test: `apps/api/tests/test_vault_sources.py` or create if absent.

**Interfaces:**
- Consumes: `MultiSourceInput`
- Produces: one SourceMaterial for text input when present
- Produces: one SourceMaterial per URL
- Produces: one BackgroundJob containing `source_ids` and `instruction`

- [ ] **Step 1: Inspect existing route tests**

Run:

```bash
cd apps/api
rg "vault/sources|create_source|upload_source" tests
```

Expected: identify existing tests or confirm a new test file is needed.

- [ ] **Step 2: Write tests for URL splitting**

Test that `POST /api/vault/sources` with one text and two URLs creates three SourceMaterial rows and one queued job with all source ids.

- [ ] **Step 3: Update route implementation**

Modify `create_source`:

- text creates `SourceMaterial(source_type="text")`
- each URL creates `SourceMaterial(source_type="url", source_url=url, title=url)`
- one `BackgroundJob` uses payload:

```python
{
    "parse_batch_id": str(uuid.uuid4()),
    "source_ids": [str(source.id) for source in sources],
    "instruction": body.input_hint,
}
```

Keep backward compatibility by accepting `source_id` payload in worker during migration.

- [ ] **Step 4: Run tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run pytest tests/test_vault_sources.py -q
```

Expected: all route tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/routers/vault_sources.py apps/api/tests/test_vault_sources.py
git commit -m "Split vault parse inputs into batch sources"
```

---

### Task 4: Add Pipeline Orchestrator Skeleton

**Files:**
- Create: `apps/api/services/vault_pipeline.py`
- Test: `apps/api/tests/test_vault_pipeline.py`

**Interfaces:**
- Produces: `group_spans_by_section(results: list[SourceDetectionResult]) -> dict[str, list[SourceSectionSpan]]`
- Produces: `persist_section_map(source: SourceMaterial, detection: SourceDetectionResult) -> None`
- Produces: `skip_duplicate_events(section_type: str, new_events: list[dict], existing_events: list[CareerEvent]) -> list[dict]`

- [ ] **Step 1: Write orchestration unit tests**

Tests:

```python
from services.vault_pipeline import group_spans_by_section
from services.vault_pipeline_types import SourceDetectionResult, SourceSectionSpan


def test_group_spans_by_section_keeps_source_trace():
    detection = SourceDetectionResult(
        source_id="src_1",
        section_spans=[
            SourceSectionSpan(source_id="src_1", source_title="resume.pdf", section_type="projects", text="PM Agent"),
            SourceSectionSpan(source_id="src_1", source_title="resume.pdf", section_type="skills", text="LangGraph"),
        ],
    )
    grouped = group_spans_by_section([detection])
    assert grouped["projects"][0].text == "PM Agent"
    assert grouped["projects"][0].source_id == "src_1"
    assert grouped["skills"][0].text == "LangGraph"
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run pytest tests/test_vault_pipeline.py -q
```

Expected: import failure.

- [ ] **Step 3: Implement skeleton functions**

Create functions only; do not call the LLM in this task.

- [ ] **Step 4: Run tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run pytest tests/test_vault_pipeline.py -q
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/services/vault_pipeline.py apps/api/tests/test_vault_pipeline.py
git commit -m "Add vault parsing pipeline skeleton"
```

---

### Task 5: Wire Worker To Layered Pipeline Behind A Feature Flag

**Files:**
- Modify: `apps/api/services/ai_worker.py`
- Modify: `apps/api/config.py` if a settings flag is preferred.
- Test: `apps/api/tests/test_ai_worker.py`

**Interfaces:**
- Consumes: BackgroundJob payload with either `source_id` or `source_ids`.
- Produces: same user-visible SourceMaterial parse status and CareerEvent rows.

- [ ] **Step 1: Add tests for payload compatibility**

Test:

- old payload `{source_id: "..."}` still works
- new payload `{source_ids: ["..."], instruction: "..."}` is accepted

- [ ] **Step 2: Add feature flag**

Use env var:

```text
VAULT_THREE_LAYER_PARSE=true
```

When false, keep current one-shot parser.

When true, worker calls the new pipeline.

- [ ] **Step 3: Implement new worker branch**

In `_execute_job`, detect source ids:

```python
source_ids = job.payload.get("source_ids") or [job.payload.get("source_id")]
instruction = job.payload.get("instruction") or job.payload.get("input_hint") or ""
```

Call pipeline entrypoint:

```python
run_vault_parse_pipeline(session=session, user_id=job.user_id, source_ids=source_ids, instruction=instruction)
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run pytest tests/test_ai_worker.py tests/test_vault_pipeline.py -q
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/services/ai_worker.py apps/api/config.py apps/api/tests/test_ai_worker.py
git commit -m "Wire vault worker to layered parser"
```

---

### Task 6: Add Repeated Upload Regression

**Files:**
- Modify: `apps/api/tests/test_vault_pipeline.py`
- Modify: `apps/api/tests/test_source_parse.py` if compatibility helper is needed.

**Interfaces:**
- Verifies same resume material does not create duplicate CareerEvents.

- [ ] **Step 1: Add fixture**

Create a test fixture string with:

```text
Agent 算法工程师
武汉光庭信息科技
2026.03 - 2026.05
- PM Agent 智能项目管理助手...
```

- [ ] **Step 2: Add regression test**

Test pipeline output twice against the same existing event set and assert only one resulting event for the same canonical key.

- [ ] **Step 3: Run tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run pytest tests/test_vault_pipeline.py tests/test_vault_pipeline_keys.py -q
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/tests/test_vault_pipeline.py
git commit -m "Test repeated vault parsing dedupe"
```

---

### Task 7: Final Verification

**Files:**
- No required file changes.

**Interfaces:**
- Verifies backend pipeline and frontend type safety.

- [ ] **Step 1: Run backend focused tests**

Run:

```bash
cd apps/api
PYTHONPATH=. uv run pytest tests/test_vault_pipeline_prompts.py tests/test_vault_pipeline_keys.py tests/test_vault_pipeline.py tests/test_source_parse.py tests/test_profile_schema.py tests/test_vault_events.py -q --tb=short
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend type check**

Run:

```bash
cd apps/web
npm exec tsc -- --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Run diff check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 4: Commit final fixes**

If any fixes were needed:

```bash
git add <changed files>
git commit -m "Stabilize vault layered parsing"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: plan covers source splitting, prompt registry, per-source detection, per-section extraction, duplicate keys, worker integration, and repeated-input regression.
- Placeholder scan: no task relies on a placeholder implementation; each task names files, interfaces, test commands, and expected behavior.
- Type consistency: `SourceDetectionResult`, `SourceSectionSpan`, `SectionExtractionResult`, and key helper names are consistent across tasks.
