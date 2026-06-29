# Product V2 Next Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Product V2 from a documented prototype into a stable, testable product foundation. Auth and user data isolation must be implemented before the Vault end-to-end workflow.

**Architecture:** Keep the existing monorepo shape with `apps/web` for the Next.js frontend and `apps/api` for the FastAPI backend. Treat the user's existing `career-timeline` and `career-application` skills as design references for extraction quality, evidence thinking, JD analysis, and generation logic, not as hard runtime dependencies. Product V2 should own its data model, API contracts, UI flows, and AI pipeline, while selectively reusing ideas from those skills where they improve the product.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, shadcn/ui-style component primitives, lucide-react, FastAPI, SQLModel, SQLite for local development, future migration path to Postgres.

## Global Constraints

- Keep the monorepo structure: `apps/web` and `apps/api`.
- Do not delete current V2 work unless a replacement is committed in the same task.
- Keep Chinese as the default product language, but prepare UI copy for centralized replacement.
- Do not implement a marketing landing page before the core workbench is stable.
- Treat OfferMax as a reference for product logic and density, not as a source to copy assets or proprietary UI directly.
- Treat `career-timeline` and `career-application` as reference implementations and product inspiration only; do not directly couple Product V2 runtime to those skills in this plan.
- Preserve the unified input idea: one AI input surface should accept file, pasted text, LinkedIn URL, job description, and free-form notes.
- Preserve event-centric profile architecture: career facts become categorized events that can be reviewed, edited, confirmed, archived, and mapped to evidence.
- Every implementation task must end with a working local verification command.

---

## Current Execution Priority

Do not start Vault Core implementation from this plan until Auth Foundation is complete.

Execute this plan first:

```text
docs/superpowers/plans/2026-06-29-auth-foundation-implementation.md
```

Auth Foundation is the prerequisite for all user-scoped Product V2 data:

- source materials
- career events
- claims and evidence
- job targets
- generated artifacts
- applications
- interview prep

After Auth Foundation passes its completion criteria, return to this plan at the UI foundation and Vault Core tasks.

## Current Baseline

Product V2 currently has a strong planning layer and a partial implementation layer.

Implemented or generated:

- Product docs under `docs/product-v2/`
- Static HTML mockup at `docs/product-v2/frontend-mockups/index.html`
- Web routes under `apps/web/app/`: dashboard, vault, review, jobs, job detail, evidence, generate, editor, prep, tracker
- Shared shell at `apps/web/components/app-shell.tsx`
- Backend routers under `apps/api/routers/`: auth, core, vault, vault_sources, vault_events
- Broad SQLModel schema in `apps/api/models/__init__.py`

Known gaps:

- Current frontend is still custom Tailwind, not a normalized shadcn/ui component system.
- Authentication is development-grade only.
- Vault ingestion creates source/job records, but AI parsing and worker execution are not complete.
- Several pages are visual/static placeholders rather than real workflows.
- Local dev server has shown a stale Next.js chunk error on `/vault`; build passes, but dev runtime needs cleanup.
- Git working tree contains many deletions, modifications, and untracked V2 files; this needs a controlled checkpoint before deeper implementation.

---

## File Structure

Primary files and responsibilities:

- `apps/web/app/layout.tsx`: Root app metadata and global providers.
- `apps/web/app/page.tsx`: Redirect entry into the product workbench.
- `apps/web/components/app-shell.tsx`: Persistent navigation, top bar, workbench frame, active-route behavior.
- `apps/web/app/globals.css`: Theme variables, typography defaults, base layout tokens.
- `apps/web/components/ui/*`: Shared UI primitives to introduce before deep page work.
- `apps/web/lib/api-client.ts`: Typed frontend API boundary.
- `apps/web/app/vault/page.tsx`: Unified input, source list, event timeline, inline event actions.
- `apps/web/app/vault/review/page.tsx`: Event review queue and validation workflow.
- `apps/web/app/jobs/page.tsx`: Job target list and tracking entry point.
- `apps/web/app/jobs/[id]/page.tsx`: Job target detail, evidence map, generation entry.
- `apps/web/app/generate/page.tsx`: Artifact generation workflow.
- `apps/web/app/editor/page.tsx`: Resume/cover letter editing workflow.
- `apps/web/app/prep/page.tsx`: Interview preparation workflow.
- `apps/web/app/tracker/page.tsx`: Application tracking workflow.
- `apps/api/main.py`: FastAPI app composition and router registration.
- `apps/api/database.py`: Engine/session initialization.
- `apps/api/auth_deps.py`: Current-user dependency and development fallback rules.
- `apps/api/models/__init__.py`: Product V2 domain models.
- `apps/api/routers/auth.py`: Signup, login, session, and future production auth boundary.
- `apps/api/routers/core.py`: Health, dashboard, recommendations, and job placeholders.
- `apps/api/routers/vault.py`: Profile, claims, review queue, readiness.
- `apps/api/routers/vault_sources.py`: Source creation/upload/list/delete.
- `apps/api/routers/vault_events.py`: Career event CRUD and review state.
- `docs/product-v2/*`: Product, architecture, data, API, pipeline, and page specs.

---

## Phase 1: Stabilize The Current Work

### Task 1: Create A Safe Baseline Checkpoint

**Files:**
- Inspect: all changed files from `git status --short`
- Create or update: no source files
- Optional commit scope: all Product V2 docs and implementation files after review

**Interfaces:**
- Consumes: current dirty worktree
- Produces: a known checkpoint that can be reviewed, committed, or intentionally split

- [ ] **Step 1: Inspect changed files**

Run:

```bash
git status --short
git diff --stat
```

Expected: Output shows V2 docs, V2 frontend files, V2 backend files, and deleted V1 files.

- [ ] **Step 2: Separate accidental files from product files**

Run:

```bash
git status --short apps/api/career_copilot.db apps/api/uv.lock _prototype docs apps/web apps/api
```

Expected: `apps/api/career_copilot.db` is identified as a local development artifact unless the team explicitly wants to commit it.

- [ ] **Step 3: Decide commit boundary**

Commit group A should contain:

```text
docs/product-v2/**
docs/superpowers/plans/2026-06-29-product-v2-next-steps.md
```

Commit group B should contain:

```text
apps/web/**
apps/api/**
```

Expected: Product planning and implementation can be reviewed independently.

- [ ] **Step 4: Verify no unrelated restore or reset is used**

Run:

```bash
git status --short
```

Expected: No `git reset --hard`, no mass restore, and no deletion of user work outside the agreed V2 scope.

### Task 2: Repair Local Dev Runtime

**Files:**
- Inspect: `apps/web/package.json`
- Inspect: `apps/web/.next` runtime state
- Modify: no source files unless a deterministic source bug is found

**Interfaces:**
- Consumes: existing Next.js app
- Produces: working local frontend at `http://localhost:3000`

- [ ] **Step 1: Stop stale frontend process**

Run:

```bash
ps -axo pid,command | rg "next dev|npm run dev"
```

Expected: Any currently running frontend dev process is visible.

- [ ] **Step 2: Restart frontend cleanly**

Run from `apps/web`:

```bash
npm run dev
```

Expected: Next.js starts on `http://localhost:3000`.

- [ ] **Step 3: Verify key pages**

Run:

```bash
curl -s http://127.0.0.1:3000/dashboard
curl -s http://127.0.0.1:3000/vault
```

Expected: Both return HTML without a Next.js server error.

- [ ] **Step 4: Rebuild if stale chunk remains**

Run from `apps/web`:

```bash
npm run build
```

Expected: Build passes and lists all V2 routes.

### Task 3: Verify Backend Runtime

**Files:**
- Inspect: `apps/api/main.py`
- Inspect: `apps/api/database.py`
- Inspect: `apps/api/routers/*.py`
- Modify: no source files unless health or import errors occur

**Interfaces:**
- Consumes: existing FastAPI app
- Produces: working local backend at `http://127.0.0.1:8000`

- [ ] **Step 1: Compile backend**

Run from `apps/api`:

```bash
uv run python -m compileall .
```

Expected: Exit code `0`.

- [ ] **Step 2: Start backend**

Run from `apps/api`:

```bash
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Expected: Uvicorn starts and imports all routers.

- [ ] **Step 3: Verify health**

Run:

```bash
curl -s http://127.0.0.1:8000/api/health
```

Expected:

```json
{"status":"ok"}
```

---

## Phase 2: Build The Product Foundation

### Task 4: Introduce A Real UI System

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/tailwind.config.js`
- Modify: `apps/web/package.json`
- Create: `apps/web/components/ui/button.tsx`
- Create: `apps/web/components/ui/dialog.tsx`
- Create: `apps/web/components/ui/input.tsx`
- Create: `apps/web/components/ui/textarea.tsx`
- Create: `apps/web/components/ui/tabs.tsx`
- Create: `apps/web/components/ui/badge.tsx`
- Create: `apps/web/components/ui/dropdown-menu.tsx`

**Interfaces:**
- Consumes: existing Tailwind setup and lucide-react dependency
- Produces: shared UI primitives used by all V2 pages

- [ ] **Step 1: Confirm dependency state**

Run from `apps/web`:

```bash
npm ls lucide-react clsx tailwind-merge
```

Expected: All three packages are installed.

- [ ] **Step 2: Add or normalize UI primitives**

Implement primitives with these exported names:

```ts
export { Button };
export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger };
export { Input };
export { Textarea };
export { Tabs, TabsContent, TabsList, TabsTrigger };
export { Badge };
export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger };
```

Expected: Page files can import from `@/components/ui/...`.

- [ ] **Step 3: Centralize theme tokens**

Add variables in `apps/web/app/globals.css` for:

```css
--background
--foreground
--surface
--surface-subtle
--border
--muted
--muted-foreground
--primary
--primary-foreground
--success
--warning
--danger
```

Expected: Page styles use named tokens instead of scattered hard-coded color decisions.

- [ ] **Step 4: Verify frontend build**

Run from `apps/web`:

```bash
npm run build
```

Expected: Build passes.

### Task 5: Centralize Product Copy And Page Metadata

**Files:**
- Create: `apps/web/lib/product-copy.ts`
- Modify: `apps/web/components/app-shell.tsx`
- Modify: `apps/web/app/dashboard/page.tsx`
- Modify: `apps/web/app/vault/page.tsx`

**Interfaces:**
- Consumes: existing Chinese UI copy
- Produces: centralized copy object that can later support language switching

- [ ] **Step 1: Create copy module**

Create `PRODUCT_COPY` with these sections:

```ts
export const PRODUCT_COPY = {
  app: {
    name: "Career Copilot",
    tagline: "Evidence-first job OS",
  },
  nav: {
    dashboard: "首页",
    vault: "职业档案",
    jobs: "目标岗位",
    generate: "生成材料",
    editor: "编辑器",
    prep: "面试准备",
    tracker: "申请追踪",
  },
  vault: {
    unifiedInputPlaceholder: "粘贴简历、LinkedIn、项目经历、JD 或任何职业材料",
    addSource: "添加材料",
    reviewQueue: "待确认事件",
  },
} as const;
```

Expected: Navigation labels no longer live directly inside `app-shell.tsx`.

- [ ] **Step 2: Replace shell copy**

Update `apps/web/components/app-shell.tsx` to read app name, tagline, and nav labels from `PRODUCT_COPY`.

Expected: Shell visual behavior is unchanged.

- [ ] **Step 3: Replace Vault primary copy**

Update the unified input placeholder and key action labels in `apps/web/app/vault/page.tsx`.

Expected: Vault page still renders and copy is easier to maintain.

- [ ] **Step 4: Verify build**

Run from `apps/web`:

```bash
npm run build
```

Expected: Build passes.

---

## Phase 3: Make Vault The First Real End-To-End Workflow

### Task 6: Define Typed Vault API Client

**Files:**
- Modify: `apps/web/lib/api-client.ts`
- Test: use TypeScript build through `npm run build`

**Interfaces:**
- Consumes: backend endpoints from `apps/api/routers/vault.py`, `vault_sources.py`, and `vault_events.py`
- Produces: typed functions for Vault pages

- [ ] **Step 1: Define frontend types**

Add TypeScript types:

```ts
export type SourceMaterial = {
  id: string;
  kind: string;
  title: string;
  status: string;
  created_at: string;
};

export type CareerEvent = {
  id: string;
  event_type: string;
  title: string;
  organization?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  confidence?: number | null;
  review_state: string;
};

export type ReviewQueueItem = CareerEvent & {
  source_title?: string | null;
};
```

Expected: Vault pages stop relying on loose `any` shapes.

- [ ] **Step 2: Normalize API functions**

Expose these functions:

```ts
export async function getSources(): Promise<SourceMaterial[]>;
export async function createTextSource(input: { title: string; content: string; url?: string }): Promise<SourceMaterial>;
export async function uploadSource(file: File): Promise<SourceMaterial>;
export async function getEvents(): Promise<CareerEvent[]>;
export async function updateEvent(id: string, patch: Partial<CareerEvent>): Promise<CareerEvent>;
export async function confirmEvent(id: string): Promise<CareerEvent>;
export async function archiveEvent(id: string): Promise<CareerEvent>;
export async function getReviewQueue(): Promise<ReviewQueueItem[]>;
```

Expected: `vault/page.tsx` and `vault/review/page.tsx` import the same API boundary.

- [ ] **Step 3: Verify build**

Run from `apps/web`:

```bash
npm run build
```

Expected: Build passes without type errors.

### Task 7: Replace Inline Event Editing With A Proper Dialog

**Files:**
- Create: `apps/web/components/vault/event-edit-dialog.tsx`
- Modify: `apps/web/app/vault/page.tsx`
- Modify: `apps/web/app/vault/review/page.tsx`

**Interfaces:**
- Consumes: `CareerEvent`, `updateEvent`, `confirmEvent`, `archiveEvent`
- Produces: reusable edit/review dialog

- [ ] **Step 1: Create component props**

Implement the component with this signature:

```ts
type EventEditDialogProps = {
  event: CareerEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: Partial<CareerEvent>) => Promise<void>;
  onConfirm?: (id: string) => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
};
```

Expected: The dialog can be used from timeline and review queue.

- [ ] **Step 2: Include fixed fields**

The dialog must show fields for:

```text
event_type
title
organization
start_date
end_date
description
confidence
review_state
```

Expected: Empty fields are visible and editable, matching the product direction learned from OfferMax.

- [ ] **Step 3: Add custom field affordance**

Add an "添加字段" button that appends a local custom key/value row in the dialog.

Expected: Custom rows can be edited in the UI even before backend persistence is added.

- [ ] **Step 4: Wire into Vault page**

Clicking an event in `apps/web/app/vault/page.tsx` opens `EventEditDialog`.

Expected: Event editing no longer happens through scattered inline controls.

- [ ] **Step 5: Verify build**

Run from `apps/web`:

```bash
npm run build
```

Expected: Build passes.

### Task 8: Implement Source Processing State

**Files:**
- Modify: `apps/api/models/__init__.py`
- Modify: `apps/api/routers/vault_sources.py`
- Modify: `apps/api/routers/vault.py`
- Modify: `apps/web/app/vault/page.tsx`

**Interfaces:**
- Consumes: source creation/upload endpoints
- Produces: visible lifecycle states for ingestion

- [ ] **Step 1: Normalize statuses**

Use this source status set:

```text
uploaded
queued
processing
needs_review
confirmed
failed
```

Expected: Backend responses never return ambiguous source states.

- [ ] **Step 2: Return processing metadata**

Source list responses should include:

```json
{
  "id": "source-id",
  "kind": "text",
  "title": "Resume paste",
  "status": "queued",
  "created_at": "2026-06-29T00:00:00",
  "event_count": 0,
  "error_message": null
}
```

Expected: Frontend can show progress and failures without guessing.

- [ ] **Step 3: Show state in Vault**

`apps/web/app/vault/page.tsx` should show a source row state badge and event count.

Expected: User can tell whether an input was merely saved or actually parsed.

- [ ] **Step 4: Verify backend and frontend**

Run:

```bash
cd apps/api && uv run python -m compileall .
cd ../web && npm run build
```

Expected: Both pass.

---

## Phase 4: Build Product-Owned AI Pipeline Boundaries

### Task 9: Build Career Event Extraction Boundary

**Files:**
- Create: `apps/api/services/event_extraction.py`
- Modify: `apps/api/routers/vault_sources.py`
- Test: `apps/api/tests/test_event_extraction.py`

**Interfaces:**
- Consumes: source material text
- Produces: normalized event candidates compatible with `CareerEvent`

- [ ] **Step 1: Define event candidate output**

Create:

```py
from typing import TypedDict

class EventCandidate(TypedDict, total=False):
    event_type: str
    title: str
    organization: str | None
    start_date: str | None
    end_date: str | None
    description: str | None
    confidence: float
```

Expected: Output is independent from any one skill's internal format, while preserving the event-centric structure inspired by `career-timeline`.

- [ ] **Step 2: Implement deterministic fallback**

Add function:

```py
def extract_event_candidates(text: str) -> list[EventCandidate]:
    if not text.strip():
        return []
    return [{
        "event_type": "experience",
        "title": text.strip().splitlines()[0][:120],
        "organization": None,
        "start_date": None,
        "end_date": None,
        "description": text.strip()[:1000],
        "confidence": 0.35,
    }]
```

Expected: Product flow works locally before the full AI extraction pipeline is wired.

- [ ] **Step 3: Add unit test**

Test:

```py
def test_extract_event_candidates_returns_event_for_text():
    result = extract_event_candidates("Built offer generation system\nUsed AI pipeline")
    assert result[0]["event_type"] == "experience"
    assert result[0]["title"] == "Built offer generation system"
    assert result[0]["confidence"] == 0.35
```

Expected: Event extraction contract is locked.

- [ ] **Step 4: Verify**

Run from `apps/api`:

```bash
uv run pytest tests/test_event_extraction.py -v
```

Expected: Test passes.

### Task 10: Build Application Generation Planning Boundary

**Files:**
- Create: `apps/api/services/application_planning.py`
- Modify: `apps/api/routers/core.py`
- Test: `apps/api/tests/test_application_planning.py`

**Interfaces:**
- Consumes: job target, confirmed events, claims, and evidence
- Produces: generation plan for resume, cover letter, and interview prep

- [ ] **Step 1: Define generation plan type**

Create:

```py
from typing import TypedDict

class ApplicationGenerationPlan(TypedDict):
    target_role: str
    strongest_events: list[str]
    missing_evidence: list[str]
    recommended_artifacts: list[str]
```

Expected: Generate page can later consume one stable backend shape.

- [ ] **Step 2: Implement deterministic fallback**

Add:

```py
def build_application_plan(target_role: str, event_titles: list[str]) -> ApplicationGenerationPlan:
    return {
        "target_role": target_role,
        "strongest_events": event_titles[:5],
        "missing_evidence": [] if event_titles else ["需要至少 1 条已确认经历事件"],
        "recommended_artifacts": ["resume", "cover_letter", "interview_brief"],
    }
```

Expected: Job flow can operate before full AI generation is connected.

- [ ] **Step 3: Add unit test**

Test:

```py
def test_build_application_plan_reports_missing_evidence():
    plan = build_application_plan("AI Product Manager", [])
    assert plan["target_role"] == "AI Product Manager"
    assert plan["missing_evidence"] == ["需要至少 1 条已确认经历事件"]
    assert "resume" in plan["recommended_artifacts"]
```

Expected: Application planning behavior is explicit and can later incorporate stronger ideas from `career-application` without coupling to it.

- [ ] **Step 4: Verify**

Run from `apps/api`:

```bash
uv run pytest tests/test_application_planning.py -v
```

Expected: Test passes.

---

## Phase 5: Replace Static Pages With Real Workflows

### Task 11: Make Job Targets Real

**Files:**
- Modify: `apps/api/routers/core.py`
- Modify: `apps/web/app/jobs/page.tsx`
- Modify: `apps/web/app/jobs/[id]/page.tsx`
- Modify: `apps/web/lib/api-client.ts`

**Interfaces:**
- Consumes: `JobTarget` model
- Produces: list/create/detail workflow for target jobs

- [ ] **Step 1: Add API client methods**

Expose:

```ts
export async function getJobTargets(): Promise<JobTarget[]>;
export async function createJobTarget(input: { company: string; role: string; jd_text?: string }): Promise<JobTarget>;
export async function getJobTarget(id: string): Promise<JobTarget>;
```

Expected: Frontend stops using `DEMO_JOBS`.

- [ ] **Step 2: Replace static jobs list**

`apps/web/app/jobs/page.tsx` should fetch real job targets and show an empty state with a create button.

Expected: Empty state is useful, not a dead demo.

- [ ] **Step 3: Replace static job detail**

`apps/web/app/jobs/[id]/page.tsx` should render data from API.

Expected: Unknown job ID shows a clear not-found state.

- [ ] **Step 4: Verify**

Run from `apps/web`:

```bash
npm run build
```

Expected: Build passes.

### Task 12: Make Generate Page Consume Real Context

**Files:**
- Modify: `apps/api/routers/core.py`
- Modify: `apps/web/app/generate/page.tsx`
- Modify: `apps/web/lib/api-client.ts`

**Interfaces:**
- Consumes: job target detail, confirmed career events, and application planning service
- Produces: artifact generation plan

- [ ] **Step 1: Add generation-plan endpoint**

Endpoint:

```text
GET /api/jobs/{job_id}/generation-plan
```

Expected response:

```json
{
  "target_role": "AI Product Manager",
  "strongest_events": [],
  "missing_evidence": ["需要至少 1 条已确认经历事件"],
  "recommended_artifacts": ["resume", "cover_letter", "interview_brief"]
}
```

Expected: Generate page has a real backend dependency.

- [ ] **Step 2: Replace static page data**

`apps/web/app/generate/page.tsx` should render the generation plan from the selected job.

Expected: The page explains readiness through actual missing evidence.

- [ ] **Step 3: Verify**

Run:

```bash
cd apps/api && uv run python -m compileall .
cd ../web && npm run build
```

Expected: Both pass.

---

## Phase 6: Production Hardening

### Task 13: Replace Development Auth With Real Password Auth

**Files:**
- Modify: `apps/api/routers/auth.py`
- Modify: `apps/api/auth_deps.py`
- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/app/signup/page.tsx`
- Modify: `apps/web/lib/api-client.ts`

**Interfaces:**
- Consumes: `User` and `AuthIdentity`
- Produces: real login/signup/session behavior

- [ ] **Step 1: Restore login and signup pages**

Routes:

```text
/login
/signup
```

Expected: User can access auth pages again.

- [ ] **Step 2: Implement password hash verification**

Use backend functions:

```py
def hash_password(password: str) -> str
def verify_password(password: str, password_hash: str) -> bool
```

Expected: Signup stores a hash; login rejects wrong passwords.

- [ ] **Step 3: Remove unsafe default user fallback for production**

`auth_deps.py` should allow fallback only when an explicit development flag is enabled.

Expected: Anonymous requests do not silently become the first user outside local development.

- [ ] **Step 4: Verify**

Run:

```bash
cd apps/api && uv run python -m compileall .
cd ../web && npm run build
```

Expected: Both pass.

### Task 14: Add Database Migration Strategy

**Files:**
- Modify: `apps/api/pyproject.toml`
- Create: `apps/api/alembic.ini`
- Create: `apps/api/alembic/env.py`
- Create: `apps/api/alembic/versions/0001_product_v2_initial.py`

**Interfaces:**
- Consumes: SQLModel metadata
- Produces: reproducible schema changes

- [ ] **Step 1: Add Alembic dependency**

Add Alembic to the API dependencies.

Expected: `uv sync` installs migration tooling.

- [ ] **Step 2: Create initial migration**

Initial migration should create all Product V2 tables from `apps/api/models/__init__.py`.

Expected: A new database can be built without relying on implicit `create_all`.

- [ ] **Step 3: Verify migration**

Run from `apps/api`:

```bash
uv run alembic upgrade head
```

Expected: Migration completes on a clean local database.

---

## Recommended Execution Order

1. Task 1: Create a safe baseline checkpoint.
2. Task 2: Repair local dev runtime.
3. Task 3: Verify backend runtime.
4. Task 4: Introduce a real UI system.
5. Task 5: Centralize product copy and page metadata.
6. Task 6: Define typed Vault API client.
7. Task 7: Replace inline event editing with a proper dialog.
8. Task 8: Implement source processing state.
9. Task 9: Build career event extraction boundary.
10. Task 10: Build application generation planning boundary.
11. Task 11: Make job targets real.
12. Task 12: Make Generate page consume real context.
13. Task 13: Replace development auth with real password auth.
14. Task 14: Add database migration strategy.

## First Milestone Acceptance Criteria

The first milestone is complete when:

- `http://localhost:3000/dashboard` works.
- `http://localhost:3000/vault` works.
- `http://127.0.0.1:8000/api/health` returns `{"status":"ok"}`.
- User can paste text into the unified Vault input.
- Backend creates a source record.
- Backend creates at least one event candidate through the product-owned event extraction fallback.
- Event appears in the review queue.
- User can open an event dialog, edit fixed fields, confirm it, or archive it.
- `npm run build` passes in `apps/web`.
- `uv run python -m compileall .` passes in `apps/api`.

## Self-Review

Spec coverage:

- OfferMax-inspired profile logic is covered by Task 7 and Task 8.
- Unified AI input is covered by Task 6 and Task 8.
- The user's existing skill work is respected as reference material by Task 9 and Task 10 without making Product V2 runtime depend on those skills.
- Mature product foundation is covered by Task 4, Task 5, Task 13, and Task 14.
- Non-demo page conversion starts with Task 11 and Task 12.

Placeholder scan:

- This plan does not contain `TBD`, `TODO`, `implement later`, or empty placeholder tasks.

Type consistency:

- Frontend event type is named `CareerEvent`.
- Backend timeline candidate type is named `TimelineEventCandidate`.
- Application generation type is named `ApplicationGenerationPlan`.
- API client methods named in later tasks match the methods introduced in earlier tasks.
