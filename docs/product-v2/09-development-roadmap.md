# Development Roadmap V2

## Guiding Rule

Do not build isolated demo pages. Build vertical slices that connect frontend, backend, data model, and AI pipeline.

## Phase 0: Decision And Cleanup

Goal: freeze current prototype and prepare V2 implementation.

Tasks:

- Review and approve `docs/product-v2`.
- Decide whether to keep current repo structure.
- Mark old UI as prototype.
- Stop adding features to old auth/vault flow.
- Create migration issue list.

Deliverables:

- Approved product scope.
- Approved data model.
- Approved API contract.
- Approved visual blueprint.

## Phase 1: Foundation

Goal: build reliable app foundation.

Tasks:

- Real auth.
- User-scoped backend.
- PostgreSQL-ready data model.
- Background job model.
- App shell.
- Settings account page.

Deliverables:

- User can sign up, log in, log out.
- `/me` works.
- Every API is user scoped.
- Basic dashboard shell exists.

## Phase 2: Career Vault

Goal: implement our strongest differentiated capability.

Tasks:

- Source upload and paste input.
- Source list.
- Parse job.
- Draft event extraction.
- Review queue.
- Event detail drawer.
- Claim extraction.
- Profile basics.
- Backup/export.

Deliverables:

- User can upload or paste material.
- AI creates draft events.
- User can confirm/edit/skip events.
- Confirmed events and claims become generation-ready.

## Phase 3: Job Targets And Evidence Mapping

Goal: create target-first workflow.

Tasks:

- Job target CRUD.
- JD paste and URL field.
- JD analysis.
- Match score.
- Evidence map.
- Target detail page.

Deliverables:

- User can create a job.
- AI extracts requirements.
- Product shows matched and missing evidence.

## Phase 4: Generate

Goal: generate from plan, not from raw prompt.

Tasks:

- Generate controls.
- Resume/document plan.
- Plan approval.
- Artifact generation.
- Structured artifact schema.

Deliverables:

- User can generate a resume or cover letter after approving a plan.
- Artifact opens in Editor.

## Phase 5: Editor And Export

Goal: make documents usable for real submission.

Tasks:

- Artifact list.
- A4 preview.
- Structured edits.
- AI edit assistant.
- Version history.
- PDF export.
- Markdown/TXT export.
- Verification panel.

Deliverables:

- User can edit, export, and mark submitted version.

## Phase 6: Interview Prep And Tracker

Goal: close the application loop.

Tasks:

- Application tracker.
- Status machine.
- Interview prep sets.
- Questions and STAR answers.
- Retrospective.

Deliverables:

- User can track applications.
- User can prep based on actual submitted resume.

## Phase 7: Browser Extension

Goal: reduce manual JD capture and application friction.

Tasks:

- Extension shell.
- JD capture.
- Save to web app.
- Match sidebar.
- Copy generated message.
- Confirmed field assist.

Deliverables:

- User can capture a job from a supported site.

## Phase 8: Monetization And Ops

Goal: prepare SaaS operations.

Tasks:

- Usage tracking.
- Billing.
- BYOK.
- Admin job monitoring.
- Error queue.
- Privacy exports and deletion.

## Existing Code Treatment

Keep as prototype references:

- Current Next.js app.
- Current FastAPI app.
- Existing event/source/profile concepts.
- Current generated docs.

Rewrite before production:

- Auth.
- User scoping.
- Data model.
- Vault UI.
- API routes.
- AI job orchestration.

Do not delete old code until the replacement module is functional and verified.

