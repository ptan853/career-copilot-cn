# Career Copilot CN — Page-by-Page Feature Audit & Development Plan

**Date**: 2026-06-30
**Version**: After Auth Foundation completion (22 tests, 16 routes green)

---

## Part 1: Page-by-Page Feature Summary

### 1. Backend (FastAPI — `apps/api`)

#### 1.1 Auth Router (`routers/auth.py`) — 8 endpoints

**Implemented:**
- `POST /api/auth/code/request` — Phone/email verification code request (SHA256 hash, 5min expiry, 5 attempts max)
- `POST /api/auth/code/verify` — Verify code → returns JWT + creates user if first time
- `POST /api/auth/signup` — Email/password registration (bcrypt hash via passlib, password ≥8 chars)
- `POST /api/auth/login` — Email/password login → returns JWT (7-day expiry, HS256)
- `GET /api/auth/google/start` — Google OAuth redirect with JWT-encoded state CSRF
- `GET /api/auth/google/callback` — Handles Google callback, creates/links user
- `GET /api/auth/me` — Returns current user from Bearer token
- `POST /api/auth/logout` — Placeholder (returns success)

**Missing:**
- No password reset flow
- No phone code request for signup purpose (currently `purpose` hardcoded to 'login')
- Google OAuth not fully tested with real credentials
- Verification code delivery is no-op (`send_verification_code` does nothing in dev)

#### 1.2 Core Router (`routers/core.py`) — 5 endpoints

**Implemented:**
- `GET /api/health` — Healthcheck
- `GET /api/dashboard/summary` — User-scoped vault metrics (real data from CareerEvent, SourceMaterial, Claim)
- `GET /api/dashboard/activity` — Returns empty `[]` (placeholder)
- `GET /api/dashboard/recommendations` — Hardcoded 2-step recommendations
- `GET /api/jobs/{job_id}` — Placeholder returns `{job_id, status: "queued"}`

**Missing / Bugs:**
- `total_jobs` and `total_artifacts` hardcoded to 0 in `build_dashboard_summary()`
- `active_interviews` and `applied_count` hardcoded to 0
- No job POST/PATCH/DELETE endpoints
- No activity feed implementation

#### 1.3 Vault Events Router (`routers/vault_events.py`) — 6 endpoints ✅ Full CRUD

**Implemented:**
- `POST /api/vault/events` — Create event (15 event types + custom fields)
- `GET /api/vault/events` — List with optional status/type/visibility filters
- `GET /api/vault/events/{event_id}` — Get single event by ID
- `PATCH /api/vault/events/{event_id}` — Update event fields
- `POST /api/vault/events/{event_id}/confirm` — Set status to "confirmed"
- `POST /api/vault/events/{event_id}/archive` — Set status to "archived"

All endpoints are user-scoped via `get_current_user_id`.

#### 1.4 Vault Sources Router (`routers/vault_sources.py`) — 5 endpoints ✅ Full CRUD

**Implemented:**
- `POST /api/vault/sources` — Create from text + URLs (creates BackgroundJob)
- `POST /api/vault/sources/upload` — File upload (PDF, DOCX, TXT, MD, PNG, JPEG)
- `GET /api/vault/sources` — List sources
- `GET /api/vault/sources/{source_id}` — Get with raw_text preview
- `DELETE /api/vault/sources/{source_id}` — Delete source

Uploaded files saved to `/app/uploads/`. Background jobs created with `source_parse` type.

#### 1.5 Vault Router (`routers/vault.py`) — 6 endpoints

**Implemented:**
- `GET /api/vault/profile` — Get user profile (returns null if none)
- `PATCH /api/vault/profile` — Update profile fields
- `GET /api/vault/claims` — List claims (optional event_id filter)
- `POST /api/vault/claims` — Create claim linked to career event
- `GET /api/vault/review-queue` — List draft/needs_review events
- `GET /api/vault/readiness` — Calculate readiness % (confirmed / total)

#### 1.6 Missing Backend Endpoints

| Feature Area | Needed |
|---|---|
| Jobs CRUD (POST/PATCH/DELETE) | None exist — only placeholder |
| Job analysis (JD parsing, matching) | None |
| Evidence mapping engine | None |
| Resume generation | None |
| Document management (artifacts) | None |
| Interview question generation | None |
| Application tracker CRUD | None |
| Activity/audit log | Placeholder returns `[]` |
| AI pipeline (parsing, extraction, generation) | BackgroundJob model exists but workers are stubs |

---

### 2. Frontend (Next.js — `apps/web`)

#### 2.1 `/` — Home Page (`app/page.tsx`)
**Status**: ✅ AuthEntryPage (landing)
- AuthEntryPage with `initialMode="signup"`, `initialModalOpen={false}`
- Shows: TopNav, hero with CTA, 4-step workflow section, features grid
- Auth modal: email/password login/signup + Google OAuth button
- If user IS logged in → redirects to `/dashboard`
- **Missing**: Verification code auth UI is not present in the modal

#### 2.2 `/login` — Login Page (`app/login/page.tsx`)
**Status**: ✅ AuthEntryPage
- AuthEntryPage with `initialMode="login"`, `initialModalOpen={true}`
- Auth modal auto-opens for unauthenticated users
- Same modal: email/password + Google OAuth, no verification code tabs

#### 2.3 `/signup` — Signup Page (`app/signup/page.tsx`)
**Status**: ✅ AuthEntryPage
- AuthEntryPage with `initialMode="signup"`, `initialModalOpen={true}`

#### 2.4 `/auth/callback` — Google OAuth Callback
**Status**: ⚠️ Code exists but not verified with real Google credentials

#### 2.5 `/dashboard` — Dashboard (`app/dashboard/page.tsx`)
**Status**: ✅ Data-driven, connected to real API
- Reads `getDashboardSummary`, `getEvents`, `getSources` from API
- Shows: vault readiness %, source count, event count, confirmed, pending
- Next actions dynamically generated based on actual data state
- Empty states when no data: shows "空资料库" with CTA to /vault
- Recent sources and events from API
- **Minor issue**: Event status badges don't include "archived" — archived events still show in timeline

#### 2.6 `/vault` — Career Vault (`app/vault/page.tsx`)
**Status**: ✅ Full CRUD, connected to real API — ~465 lines
- **Implemented:**
  - Unified input: text + URLs → create source
  - File upload: drag-drop zone → upload to API
  - Manual event creation form (15 event types, full fields)
  - Inline event editing (click to edit)
  - Confirm/archive buttons on each event
  - Grouped timeline by event type with color coding
  - Source list sidebar
  - Metric cards (total events, confirmed, needs review)
  - Tabs: Timeline / Sources
  - Empty states with CTAs
- **Missing:**
  - No source detail view (clicking a source does nothing)
  - No auto-parse feedback (BackgroundJob created but no polling)
  - No claims/evidence inline view per event
  - No profile editing (profile endpoint exists but no UI)

#### 2.7 `/vault/review` — Review Queue (`app/vault/review/page.tsx`)
**Status**: ✅ Connected to real API — ~158 lines
- **Implemented:**
  - Queue list from `getReviewQueue()` API
  - Select item → detail card with confidence score
  - Confirm / Skip actions that call real API
  - Uncertainty panel with hardcoded categories
- **Missing:**
  - No inline editing in review mode (only confirm/skip)
  - Uncertainty panel data is hardcoded, not AI-generated
  - No bulk confirm action (button exists but no-op)

#### 2.8 `/jobs` — Job Targets (`app/jobs/page.tsx`)
**Status**: ❌ Static demo data — ~118 lines
- Uses `DEMO_JOBS` array (3 hardcoded jobs)
- Shows card list with: title, company, location, priority, match score, status
- Priority: high/medium/low with colored badges
- **Missing:**
  - Not connected to any API (no backend CRUD for jobs)
  - "添加岗位" (Add Job) button is non-functional
  - No search/filter
  - No real match scores

#### 2.9 `/jobs/[id]` — Job Detail (`app/jobs/[id]/page.tsx`)
**Status**: ❌ Static demo data — ~137 lines
- Uses `params.id` but ignores it — always shows `DEMO_JOB`
- 3-column: Raw JD, AI analysis, Evidence gaps
- All data hardcoded (DeepSeek Harness Engineer)
- **Missing:**
  - No API call — not connected
  - Ignores URL param (any job ID shows same content)
  - "Generate materials" button is decorative
  - No real JD ingestion pipeline

#### 2.10 `/evidence` — Evidence Map (`app/evidence/page.tsx`)
**Status**: ❌ Static demo data — ~179 lines
- `DEMO_MATRIX` with 4 hardcoded requirements
- Shows: JD requirement → Selected evidence → Gap/risk
- Selected/Omitted panels with hardcoded event IDs
- Target selector is hardcoded (2 options)
- **Missing:**
  - No backend API for evidence mapping
  - "Regenerate map" button is decorative
  - "Approve map" button is decorative
  - No real event-to-requirement linking

#### 2.11 `/generate` — Generate (`app/generate/page.tsx`)
**Status**: ❌ Static — ~232 lines
- Document type selector (Resume, Cover Letter, Boss Opening, Referral Q&A)
- Controls: target, language, template, evidence strictness
- Section checkboxes (Contact, Summary, Experience, etc.)
- Hardcoded plan preview with positioning + events table
- **Missing:**
  - No backend — all data is hardcoded strings
  - "Generate resume" button is decorative
  - "Approve plan and generate" button is decorative
  - No integration with vault events or jobs

#### 2.12 `/editor` — Editor (`app/editor/page.tsx`)
**Status**: ❌ Static — ~149 lines
- Hardcoded A4 resume preview (Peifeng's resume)
- Document list sidebar (3 hardcoded docs)
- AI edit assistant with 4 presets
- Template selector (ATS / Modern)
- Export verification badges
- **Missing:**
  - No real content — all hardcoded Chinese resume text
  - "Export PDF", "Preview", "Source" buttons are decorative
  - AI edit buttons don't call any API
  - No version history (sidebar shows static strings)

#### 2.13 `/prep` — Interview Prep (`app/prep/page.tsx`)
**Status**: ❌ Static — ~151 lines
- 2 hardcoded prep sets (DeepSeek, Kuaishou)
- 4 hardcoded predicted questions
- 1 hardcoded STAR answer with evidence
- Know / Needs practice buttons
- **Missing:**
  - No backend — no question generation API
  - "Regenerate prep" button is decorative
  - No real question-to-event linking
  - No save functionality

#### 2.14 `/tracker` — Application Tracker (`app/tracker/page.tsx`)
**Status**: ❌ Static — ~79 lines
- 4-stage kanban board (待投递, 已投递, 面试中, Offer/结束)
- 4 hardcoded applications with priority + notes
- Stages rendered as colored columns
- **Missing:**
  - No backend CRUD for applications
  - "添加投递" (Add Application) button is decorative
  - No drag-and-drop between stages
  - No real status tracking

#### 2.15 `/settings` — Settings
**Status**: ❌ Empty directory — no page yet

#### 2.16 `/targets` — Targets
**Status**: ❌ Empty directory — no page yet

---

### 3. Shared Components & Infrastructure

#### 3.1 Auth Screen (`components/auth/auth-screen.tsx`) — ~600+ lines
**Implemented:**
- TopNav with user menu + dashboard link (when logged in)
- Hero section with CTA button
- 4-step workflow section (upload → extract → review → generate)
- Feature grid (6 icons: upload, AI parse, evidence, review, generate, prep)
- AuthModal: email/password login/signup + Google OAuth button
- Error display from URL params (for Google callback failures)
- Brand: "求索 Copilot", slogan "让每一段经历，都成为下一次机会的证据"
- Color: #3b82f6 blue palette

**Missing:**
- **Verification code auth UI is entirely absent** — modal has no phone/email verification code tabs
- The backend `POST /api/auth/code/request` and `POST /api/auth/code/verify` exist but have no frontend entry point

#### 3.2 App Shell (`components/app-shell.tsx`)
**Implemented:**
- Dark sidebar with nav items: Dashboard, Vault, Jobs, Evidence, Generate, Editor, Prep, Tracker
- Top bar with page title, search placeholder, user avatar
- Brand: "Career Copilot", tagline "Evidence-first job OS"
- Color: --app-blue #4a7dff, mint-to-blue gradient background

#### 3.3 Auth Gate (`components/auth/auth-gate.tsx`)
**Implemented:**
- Checks auth status via `/api/auth/me`
- Redirects unauthenticated users to `/login?next=...`
- Wraps AppShell only for authenticated users
- Public paths exempt: `/login`, `/signup`, `/auth/callback`

#### 3.4 API Client (`lib/api-client.ts`)
**Implemented:**
- Bearer token auto-attach via `auth.ts` functions
- 401 auto-clears token
- Typed functions for all backend endpoints
- File upload support (FormData)
- Re-exports auth functions for convenience

#### 3.5 Auth Client (`lib/auth.ts`)
**Implemented:**
- `requestAuthCode`, `verifyAuthCode` — code-based auth (unused by UI)
- `signup`, `login` — password auth (used by auth-screen modal)
- `getGoogleLoginUrl` — Google OAuth redirect
- `getCurrentUser`, `logout` — session management
- Token storage in localStorage

#### 3.6 Design Tokens (`globals.css`)
- Two parallel visual systems coexist:
  1. Auth-screen: #3b82f6 blue, "求索 Copilot" brand
  2. App-shell: #4a7dff blue, "Career Copilot" brand, mint-to-blue gradient

---

### 4. Identified Issues & Regressions

| # | Issue | Severity | Impact |
|---|---|---|---|
| 1 | Verification code auth has no frontend UI | **Critical** | Phone/email code login exists in backend but users can't access it |
| 2 | Product name inconsistency: "Career Copilot" vs "求索 Copilot" | Medium | Brand confusion across auth and workbench |
| 3 | Color system split: #3b82f6 vs #4a7dff | Medium | Visual inconsistency; separate CSS patterns duplicating work |
| 4 | 8 of 16 pages use static DEMO data | High | Users see fake data after login; no real workflow possible |
| 5 | No backend CRUD for Jobs, Evidence, Generate, Editor, Prep, Tracker | High | Even if frontend connected, there's nothing to connect to |
| 6 | Dashboard `total_jobs`/`total_artifacts`/`active_interviews`/`applied_count` hardcoded to 0 | Low | Dashboard card always shows 0 for these metrics |
| 7 | Empty settings/ and targets/ directories | Low | Broken links in sidebar |
| 8 | Inline CSS duplication — each page redeclares `.btn`, `.input`, `.badge-*` classes | Medium | Maintenance burden; not using centralized globals.css `@apply` classes |

---

## Part 2: Complete Development Plan

The plan follows a dependency-first ordering: fix critical bugs → unify foundation → connect real data pathways → add AI intelligence → harden for real usage.

### Phase A: Fix & Stabilize (1-2 weeks)

**Goal**: Fix all critical regressions from the auth-screen rewrite, unify the visual system, and eliminate fake data from core pages.

| Task | Description | Effort |
|---|---|---|
| **A1. Restore verification code auth UI** | Add phone/email code auth tabs back to auth-modal in auth-screen.tsx. Wire `requestAuthCode` + `verifyAuthCode` from `lib/auth.ts`. Include: phone input with masked feedback, email input, 6-digit code input, countdown timer, error states. | 3-4d |
| **A2. Unify branding** | Decide on one brand name (suggest: "求索 Copilot" for CN market, or dual-mode). Sync the tagline. Ensure TopNav, auth-screen, app-shell, and page titles use the same name. | 1d |
| **A3. Unify color system** | Pick one blue as primary (`--app-blue`). Migrate auth-screen from #3b82f6 to --app-blue tokens. Remove duplicated inline `<style jsx>` where possible — extend globals.css `@layer components` with `.auth-btn`, `.auth-input`, `.auth-card` as needed. | 2d |
| **A4. Fix dashboard stale field names** | Connect `total_jobs`, `total_artifacts`, `active_interviews`, `applied_count` to real data sources (or remove them from the card if not ready). | 1d |
| **A5. Add Jobs CRUD backend** | Create `routers/jobs.py`: POST, GET (list + by id), PATCH, DELETE for JobTarget model. User-scoped. This is the prerequisite for making the Jobs page real. | 2-3d |
| **A6. Connect Jobs pages to API** | Swap `DEMO_JOBS` with `getJobs()` API call. Add create job modal/form. Wire job detail to actual `params.id` with API fetch. Add delete/archive. | 3d |
| **A7. Fill empty pages** | Create `/settings` page (at minimum: display_name, email, password change). Create `/targets` page (redirect or merge with /jobs for now). | 2d |

### Phase B: Core Workflow — Vault → Evidence → Jobs (2-3 weeks)

**Goal**: Build the evidence-first pipeline: users add sources → extract events → review → map evidence to job requirements.

| Task | Description | Effort |
|---|---|---|
| **B1. Source → Event parsing pipeline** | Implement or integrate LLM-based parsing. When a source is created/uploaded, the BackgroundJob gets picked up by a worker. Extracts structured events with confidence scores. Events land in draft status. | 5d |
| **B2. Source detail + inline claims** | Add click-to-expand on sources in /vault showing raw text preview. Add claims list per event (GET /api/vault/claims). Allow adding/editing claims inline. | 3d |
| **B3. Evidence mapping backend** | Create endpoints to link events to job requirements: `POST /api/jobs/{job_id}/requirements`, `POST /api/jobs/{job_id}/map` (auto-map events to requirements using embeddings or keyword match). `GET /api/jobs/{job_id}/evidence-map`. | 4d |
| **B4. Connect Evidence Map page** | Replace `DEMO_MATRIX` with API data. Wire target selector to real jobs list. Show real selected/omitted events. "Regenerate" calls backend mapping. | 3d |
| **B5. Review Queue v2** | Add inline editing in review page (not just confirm/skip). Add confidence score visualization. Auto-populate uncertainty panel from parsed event metadata. Bulk confirm. | 3d |

### Phase C: Document Generation (2-3 weeks)

**Goal**: From confirmed evidence + job target → structured documents. The "workbench" becomes real.

| Task | Description | Effort |
|---|---|---|
| **C1. Document/Artifact model** | Add Artifact model (user_id, job_id, doc_type, template, status, content_json). Backend CRUD: `POST /api/generate/{job_id}/plan`, `POST /api/generate/{job_id}/draft`, `GET /api/artifacts`. | 3d |
| **C2. Resume generation engine** | LLM-powered: takes job requirements + selected evidence → structured resume content. Section-by-section generation with evidence citations. Language mode (CN/EN/Bilingual). Template rendering (ATS/Modern). | 5d |
| **C3. Connect Generate page** | Wire document type selector, controls, section checkboxes to real API. "Approve plan and generate" kicks off generation job. Show progress. Display generated plan with real events. | 3d |
| **C4. Connect Editor page** | Show real artifact list from user's generated documents. A4 preview renders actual content JSON. AI edit assistant calls `POST /api/artifacts/{id}/edit` with prompt. Export PDF generates real file. | 4d |

### Phase D: Interview Prep & Tracking (1-2 weeks)

**Goal**: The final two application workflow pages.

| Task | Description | Effort |
|---|---|---|
| **D1. Interview question generation** | `POST /api/prep/{job_id}/generate` — generates questions from JD requirements + evidence gaps. Categorizes by type (tech, behavioral, motivation). Links questions to specific evidence items. | 3d |
| **D2. Connect Prep page** | Wire prep sets to real job targets. Load real questions. STAR answer drafting backed by evidence. Save answer drafts. Track know/practice status per question. | 3d |
| **D3. Application tracker backend** | Model: JobApplication (user_id, job_id, stage, priority, notes, dates). CRUD endpoints. Stage transitions (applied → interviewing → offer → closed). | 2d |
| **D4. Connect Tracker page** | Replace hardcoded applications with API data. Add application form/modal. Drag-and-drop between kanban columns (PATCH stage). Filter by priority. | 3d |

### Phase E: AI Pipeline & Polish (2-3 weeks)

**Goal**: The deeper AI features — LLM parsing, embedding-based matching, intelligent suggestions.

| Task | Description | Effort |
|---|---|---|
| **E1. Background job worker** | Implement `parse_worker.py` that polls BackgroundJob table. Calls LLM for source parsing (structured events extraction). Updates parse_status. Handles failures. | 4d |
| **E2. Embedding-based JD matching** | Compute embeddings for job requirements and event claims. Cosine similarity for evidence mapping. Match score per job based on coverage. | 3d |
| **E3. Activity feed** | Record user actions (source added, event confirmed, doc generated). `GET /api/dashboard/activity` returns real timeline. | 2d |
| **E4. Settings page** | Full profile editing form (all Profile model fields). Password change. Account deletion. | 2d |
| **E5. UI polish & consistency** | Audit all pages for consistent use of globals.css tokens. Remove duplicated `<style jsx>` blocks — centralize in globals.css where possible. Responsive fixes. Loading state refinements. Error boundary component. | 4d |

### Phase F: Hardening (1-2 weeks)

**Goal**: Production readiness.

| Task | Description | Effort |
|---|---|---|
| **F1. Test coverage** | Backend: add tests for vault_events, vault_sources, vault routers. Frontend: smoke tests for key flows (login → dashboard → vault → review). | 4d |
| **F2. Error handling audit** | Every API call should show user-friendly error messages, not raw fetch errors. Add toast/notification system. Handle network offline gracefully. | 3d |
| **F3. Mobile responsive audit** | Test all pages at mobile widths. Fix sidebar collapse, table overflow, form layouts. | 3d |
| **F4. Performance** | Lazy loading for heavy pages. Image optimization. API response caching. | 2d |
| **F5. Google OAuth live verification** | Test with real Google app credentials. Fix callback URL, user creation/linking edge cases. | 1d |

---

## Priority Summary

**Immediate (next sprint):**
1. A1 — Restore verification code auth UI (regression fix)
2. A2 + A3 — Unify branding and colors (foundational)
3. A5 + A6 — Jobs CRUD + connect Jobs pages (first real data page beyond Vault)
4. A7 — Fill empty /settings and /targets pages

**Short-term (sprint 2-3):**
5. B1-B5 — Vault → Evidence → Jobs pipeline
6. C1-C4 — Document generation and Editor

**Medium-term (sprint 4-5):**
7. D1-D4 — Interview Prep + Tracker
8. E1-E3 — AI pipeline
9. E4-E5 — Polish

**Before launch:**
10. F1-F5 — Hardening
