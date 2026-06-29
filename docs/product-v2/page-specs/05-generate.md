# Generate Page Spec

## Purpose

Configure and generate target-specific application materials.

This page should borrow OfferMax's clarity while preserving our target-first plan approval.

## Layout Wireframe

```text
┌─────────────────────────────┬──────────────────────────────────────┐
│ Controls                    │ Plan / Preview                        │
│ - Job target                │ 1. Resume plan before generation      │
│ - Document type             │ 2. Generated preview after approval   │
│ - Language                  │ 3. Warnings and evidence gaps         │
│ - Template                  │                                      │
│ - Sections                  │                                      │
│ - AI/manual evidence        │                                      │
│ - JD / instructions         │                                      │
│ - Generate button           │                                      │
└─────────────────────────────┴──────────────────────────────────────┘
```

## Document Types

- Chinese resume.
- English resume.
- Bilingual resume.
- Cover letter.
- Recruiter email.
- Boss opening message.
- Referral request.
- Referral Q&A.
- Online application answers.
- Interview self-introduction.
- Project deep-dive brief.

## Controls

- Job target.
- Language.
- Page count.
- Template.
- Career stage preset.
- Section inclusion.
- Section order.
- Per-section AI decide/manual pick.
- Bullet count.
- Keyword emphasis.
- Additional instructions.
- Evidence strictness:
  - confirmed only
  - confirmed + needs_review with warning
  - include temporary user-approved claims

## Resume Plan Before Generation

The plan must show:

- Positioning sentence.
- Section order.
- Selected events.
- Selected claims.
- Omitted relevant events.
- Evidence gaps.
- Risk of exaggeration.
- Page-length risk.

## APIs

- `POST /generate/plan`
- `POST /generate/artifact`
- `GET /generate/options`
- `GET /jobs/:id/evidence-map`

## AI Jobs

- Resume plan.
- Section strategy.
- Evidence selection.
- Artifact generation.
- Risk warnings.

## Confirmation Gates

User approval is required before generating formal documents from a plan.

