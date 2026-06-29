# API Contract V2

## General Rules

- All app APIs require authenticated user context unless explicitly public.
- Every query must be scoped by `user_id`.
- Background AI operations return a job id.
- Large source text and exported files should be referenced, not duplicated.
- API responses should include stable ids and timestamps.

## Auth

```text
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/phone/request-code
POST /api/auth/phone/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/password/reset-request
POST /api/auth/password/reset-confirm
```

## Dashboard

```text
GET /api/dashboard/summary
GET /api/dashboard/activity
GET /api/dashboard/recommendations
```

## Career Vault

```text
GET   /api/vault/profile
PATCH /api/vault/profile

POST   /api/vault/sources
GET    /api/vault/sources
GET    /api/vault/sources/:sourceId
POST   /api/vault/sources/:sourceId/parse
DELETE /api/vault/sources/:sourceId

GET   /api/vault/events
POST  /api/vault/events
GET   /api/vault/events/:eventId
PATCH /api/vault/events/:eventId
POST  /api/vault/events/:eventId/confirm
POST  /api/vault/events/:eventId/archive

GET   /api/vault/claims
POST  /api/vault/claims
PATCH /api/vault/claims/:claimId
DELETE /api/vault/claims/:claimId

GET /api/vault/review-queue
GET /api/vault/readiness
POST /api/vault/backup
POST /api/vault/restore
```

## Jobs

```text
POST  /api/jobs
GET   /api/jobs
GET   /api/jobs/:jobId
PATCH /api/jobs/:jobId
DELETE /api/jobs/:jobId

POST /api/jobs/:jobId/analyze
GET  /api/jobs/:jobId/analysis
POST /api/jobs/:jobId/match
GET  /api/jobs/:jobId/match
POST /api/jobs/:jobId/evidence-map
GET  /api/jobs/:jobId/evidence-map
```

## Generate

```text
GET  /api/generate/options
POST /api/generate/plan
POST /api/generate/artifact
```

## Artifacts

```text
GET   /api/artifacts
POST  /api/artifacts
GET   /api/artifacts/:artifactId
PATCH /api/artifacts/:artifactId
DELETE /api/artifacts/:artifactId

GET  /api/artifacts/:artifactId/versions
POST /api/artifacts/:artifactId/ai-edit
POST /api/artifacts/:artifactId/patch
POST /api/artifacts/:artifactId/render
POST /api/artifacts/:artifactId/export
POST /api/artifacts/:artifactId/mark-submitted
```

## Interview Prep

```text
POST  /api/interview-prep
GET   /api/interview-prep
GET   /api/interview-prep/:prepId
PATCH /api/interview-prep/:prepId/questions/:questionId
POST  /api/interview-prep/:prepId/regenerate
POST  /api/interview-prep/:prepId/retrospective
```

## Tracker

```text
GET   /api/applications
POST  /api/applications
GET   /api/applications/:applicationId
PATCH /api/applications/:applicationId
POST  /api/applications/:applicationId/status
POST  /api/applications/:applicationId/interview-rounds
POST  /api/applications/:applicationId/outcome
```

## Background Jobs

```text
GET /api/jobs/background/:backgroundJobId
POST /api/jobs/background/:backgroundJobId/cancel
```

## Settings

```text
GET   /api/settings/account
PATCH /api/settings/account
GET   /api/settings/ai-providers
POST  /api/settings/ai-providers
DELETE /api/settings/ai-providers/:providerId
POST  /api/settings/export-data
POST  /api/settings/delete-account-request
POST  /api/settings/delete-account-confirm
```

## Response Standards

Success:

```json
{
  "data": {},
  "meta": {
    "request_id": "req_..."
  }
}
```

Background job:

```json
{
  "job_id": "job_...",
  "status": "queued"
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "User-facing message",
    "details": {}
  }
}
```

