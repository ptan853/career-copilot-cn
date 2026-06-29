# Interview Prep Page Spec

## Purpose

Prepare for interviews using the actual job target and submitted resume version.

## Layout Wireframe

```text
┌────────────────────────────────────────────────────────────────────┐
│ Select job target + submitted artifact                             │
├───────────────┬───────────────────────────────┬────────────────────┤
│ Prep sets     │ Question categories           │ Answer/detail pane │
│ Resume links  │ Technical / project / HR      │ STAR answer        │
│ Status marks  │ JD-specific / resume-specific │ Evidence links     │
└───────────────┴───────────────────────────────┴────────────────────┘
```

## Core Objects

- InterviewPrepSet
- InterviewQuestion
- AnswerDraft
- EvidenceReference
- InterviewRound

## Question Categories

- Self-introduction.
- Resume challenge.
- Project deep dive.
- Technical fundamentals.
- System/design thinking.
- Behavioral.
- Motivation.
- Company and business understanding.
- HR and compensation.
- Questions to ask interviewer.

## User States

- Not started.
- Prep generated.
- User reviewed.
- Needs practice.
- Interview completed.
- Retrospective saved.

## APIs

- `POST /interview-prep`
- `GET /interview-prep`
- `GET /interview-prep/:id`
- `PATCH /interview-prep/:id/questions/:questionId`
- `POST /interview-prep/:id/regenerate`
- `POST /interview-prep/:id/retrospective`

## AI Jobs

- Question prediction.
- STAR answer drafting.
- Resume challenge generation.
- Project deep dive card generation.
- Interview retrospective summary.

