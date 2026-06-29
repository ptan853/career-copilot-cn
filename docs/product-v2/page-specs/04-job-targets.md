# Job Targets Page Spec

## Purpose

Manage job targets and create one workspace per role.

## Layout Wireframe

```text
┌────────────────────────────────────────────────────────────────────┐
│ Job Targets header: add JD, import URL, filters                    │
├──────────────────┬─────────────────────────────────────────────────┤
│ Target list      │ Selected target detail                          │
│ - status         │ JD analysis                                     │
│ - company        │ Match score                                     │
│ - role           │ Requirements                                    │
│ - priority       │ Evidence gaps                                   │
│ - deadline       │ Actions: generate, evidence map, track          │
└──────────────────┴─────────────────────────────────────────────────┘
```

## Core Objects

- JobTarget
- JDAnalysis
- MatchScore
- EvidenceMap
- Application

## Create Methods

- Paste JD.
- Enter job URL.
- Extension capture.
- Manual company/role.
- Duplicate existing target.

## Job Target Fields

- Company
- Role
- City
- Work mode
- Industry/domain
- Source URL
- Raw JD
- Channel
- Deadline
- Priority
- Status
- Tags

## AI Analysis Output

- Company/product context.
- Job responsibilities.
- Must-have requirements.
- Nice-to-have requirements.
- Keywords.
- Screening criteria.
- Candidate positioning.
- Gaps and risks.
- Suggested application narrative.

## APIs

- `POST /jobs`
- `GET /jobs`
- `GET /jobs/:id`
- `PATCH /jobs/:id`
- `POST /jobs/:id/analyze`
- `GET /jobs/:id/match`
- `POST /jobs/:id/evidence-map`
- `PATCH /jobs/:id/status`

## AI Jobs

- JD normalization.
- Company research, if enabled.
- Requirement extraction.
- Match scoring.
- Evidence mapping.

