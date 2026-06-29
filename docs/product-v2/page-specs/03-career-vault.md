# Career Vault Page Spec

## Purpose

Manage the user's durable professional memory.

This is where our `career-timeline` route must remain stronger than OfferMax.

## Layout Wireframe

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Career Vault header: readiness, last updated, import/export         │
├───────────────┬───────────────────────────────┬─────────────────────┤
│ Left tabs     │ Main list                      │ Detail drawer       │
│ - Profile     │ Sources / Events / Claims      │ Fields + evidence   │
│ - Sources     │ Review cards                   │ Status controls     │
│ - Events      │ Filters by type/status/source  │ AI suggestions      │
│ - Claims      │                               │ Save/confirm        │
│ - Review      │                               │                     │
└───────────────┴───────────────────────────────┴─────────────────────┘
```

## Core Objects

- Profile
- SourceMaterial
- CareerEvent
- Claim
- Evidence
- ReviewDecision

## Inputs

- File upload: PDF, DOCX, Markdown, TXT, image.
- Paste text: self-review, project notes, LinkedIn About, portfolio text.
- Add URL: GitHub, portfolio, blog, LinkedIn, Maimai, Zhihu.
- Browser extension import.
- JSON backup restore.

## Event Types

- work
- internship
- project
- education
- award
- publication
- patent
- certification
- course
- competition
- open_source
- startup
- volunteer
- language
- custom

## Event Status

- draft
- needs_review
- confirmed
- archived

## Review Card Fields

- Title
- Type
- Time span
- Role
- Organization
- Location
- Description
- Details
- Claims
- Evidence
- Uncertain fields
- Visibility

## Key Actions

- Add source.
- Parse source.
- Re-analyze source.
- Confirm event.
- Edit event.
- Mark needs_review.
- Skip event.
- Create claim.
- Merge duplicate events.
- Export vault JSON.
- Restore vault JSON.

## Confirmation Gates

User confirmation is required before:

- AI draft event becomes confirmed.
- Weak claim becomes usable in formal generation.
- Source or event deletion.
- Backup restore overwrites existing data.

## APIs

- `GET /vault/profile`
- `PATCH /vault/profile`
- `POST /vault/sources`
- `GET /vault/sources`
- `GET /vault/sources/:id`
- `POST /vault/sources/:id/parse`
- `DELETE /vault/sources/:id`
- `GET /vault/events`
- `POST /vault/events`
- `PATCH /vault/events/:id`
- `POST /vault/events/:id/confirm`
- `POST /vault/events/:id/archive`
- `GET /vault/claims`
- `POST /vault/claims`
- `PATCH /vault/claims/:id`
- `GET /vault/review-queue`
- `POST /vault/backup`
- `POST /vault/restore`

## AI Jobs

- Source parse.
- Event extraction.
- Claim extraction.
- Duplicate detection.
- Readiness scoring.

