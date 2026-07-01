# Vault Lite Resume Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Vault right panel into a resume-like editable profile while keeping the left input panel intact.

**Architecture:** Keep existing `Profile`, `CareerEvent`, `Claim`, and `Evidence` tables. Add a small Lite schema registry and normalize AI output into stable section fields under `CareerEvent.details_json`, especially `bullets: string[]`. The frontend mirrors the same Lite section model for rendering and typed edit forms.

**Tech Stack:** FastAPI, SQLModel, pytest, Next.js App Router, React, TypeScript, CSS modules/global app CSS.

## Global Constraints

- Keep the existing two-column Vault page layout.
- Right panel becomes resume-like profile display, not event-card grid.
- `details_json.bullets` is a plain `string[]`.
- Do not expose claims/evidence as primary UI.
- Do not add new database tables in this iteration.
- AI may clean or merge content, but must not invent facts.

---

### Task 1: Backend Lite Schema Registry

**Files:**
- Create: `apps/api/services/profile_schema.py`
- Test: `apps/api/tests/test_profile_schema.py`

**Interfaces:**
- Produces: `event_type_to_profile_section(event_type: str) -> ProfileSection`
- Produces: `normalize_lite_details(event_type: str, details: dict) -> dict`

- [x] Write failing tests for section mapping and detail normalization.
- [x] Add `profile_schema.py` with section order, event type mapping, and Lite detail cleanup.
- [x] Run `uv run python -m pytest tests/test_profile_schema.py -q`.
- [ ] Commit if the task is independently green.

### Task 2: AI Prompt and Parse Normalizer

**Files:**
- Modify: `apps/api/services/parse_prompts.py`
- Modify: `apps/api/services/source_parse.py`
- Test: `apps/api/tests/test_source_parse.py`
- Test: `apps/api/tests/test_ai_worker.py`

**Interfaces:**
- Consumes: `normalize_lite_details`
- Produces: `NormalizedEvent.details_json` containing Lite fields such as `bullets`, `skills`, `tech_stack`, `url`, `field`, `gpa`, and `honors`.

- [x] Add failing tests showing AI output with `details.bullets` survives as plain strings.
- [x] Update prompt to require Lite Profile Schema and plain-string bullets.
- [x] Update normalizer to use Lite schema and preserve old context fields only as secondary data.
- [x] Run `uv run python -m pytest tests/test_source_parse.py tests/test_ai_worker.py -q`.
- [ ] Commit if the task is independently green.

### Task 3: Frontend Lite Section Config

**Files:**
- Create: `apps/web/lib/vault-lite-schema.ts`
- Modify: `apps/web/lib/api-client.ts` if type helpers are needed.

**Interfaces:**
- Produces: section ordering, labels, event grouping, detail helpers, and bullet normalization for Vault UI.

- [x] Add a small TypeScript config for Lite sections.
- [x] Add helper functions to read `details_json.bullets` safely as `string[]`.
- [x] Run `npm run build` from `apps/web`.
- [ ] Commit if the task is independently green.

### Task 4: Resume-Style Right Panel

**Files:**
- Modify: `apps/web/app/vault/page.tsx`
- Modify: `apps/web/app/vault/vault.css` or the existing CSS used by `/vault`.

**Interfaces:**
- Consumes: `VaultSection[]` from `getGroupedEvents`.
- Produces: resume-like rendering for profile header, summary, work, project, education, skills, and remaining sections.

- [x] Replace event-card grid with resume section rendering.
- [x] Keep the left source input column intact.
- [x] Hide claim/evidence counters from main content.
- [x] Show bullets directly under work/project items.
- [x] Run frontend build/type check.
- [ ] Commit if the task is independently green.

### Task 5: Typed Edit Forms

**Files:**
- Modify: `apps/web/app/vault/page.tsx`
- Modify: `apps/web/app/vault/vault.css` or existing Vault CSS.

**Interfaces:**
- Consumes: Lite section config.
- Produces: edit modals for work/internship, project, education, and skills in the first pass; generic fallback for other sections.

- [x] Replace the generic context/contribution/outcome editor with Lite fields.
- [x] Store bullets as multiline text converted to `details_json.bullets: string[]`.
- [x] Keep save/delete/confirm actions working.
- [x] Run frontend build/type check.
- [ ] Commit if the task is independently green.

### Task 6: End-to-End Verification

**Files:**
- No required file changes.

**Interfaces:**
- Verifies upload/parse/display/edit/refresh behavior.

- [x] Run backend focused tests.
- [x] Run frontend build/type check.
- [ ] Start or reuse local dev servers.
- [ ] Verify `/vault` loads and the right panel renders with the new profile layout.
- [ ] Commit any final fixes.
