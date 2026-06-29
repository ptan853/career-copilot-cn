# Dashboard Page Spec

## Purpose

Show job-hunt progress and the next best action.

## Layout Wireframe

```text
┌────────────────────────────────────────────────────────────────────┐
│ Top nav: logo, search, add material, add job, account              │
├────────────────────────────────────────────────────────────────────┤
│ Welcome / next action banner                                       │
├──────────────┬──────────────┬──────────────┬──────────────┬───────┤
│ Job targets  │ Generated    │ Applied      │ Interviews   │ Offers│
├──────────────────────────────┬─────────────────────────────────────┤
│ Application funnel           │ Upcoming deadlines / next actions   │
├──────────────────────────────┴─────────────────────────────────────┤
│ Recent activity                                                     │
├────────────────────────────────────────────────────────────────────┤
│ Recommended actions: review events, add JD, generate resume         │
└────────────────────────────────────────────────────────────────────┘
```

## Core Objects

- User
- Career Vault readiness
- Job targets
- Applications
- Artifacts
- Interview prep sets
- Activities

## States

- New user: no sources, no jobs.
- Vault ready, no job targets.
- Jobs created, no generated artifacts.
- Active applications.
- Interview upcoming.
- Dormant user.

## Required Cards

- Vault readiness.
- Job target count.
- Generated artifact count.
- Applied count.
- Interview count.
- Offer count.
- Application funnel.
- Upcoming deadlines.
- Recent activity.
- Recommended next action.

## APIs

- `GET /dashboard/summary`
- `GET /dashboard/activity`
- `GET /dashboard/recommendations`

## AI Jobs

- None by default.
- May call recommendation summarizer after significant activity.

