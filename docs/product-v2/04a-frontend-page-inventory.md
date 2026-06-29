# Frontend Page Inventory V2

## Purpose

This document is the frontend-facing page checklist. It answers:

- How many pages does the mature product need?
- What content appears on each page?
- What are the main components?
- What data does each page depend on?

The page specs in `page-specs/` go deeper. This file is the top-level frontend map.

## Page Count Summary

The mature product has 11 product areas and about 31 concrete pages.

| Area | Page Count | Purpose |
| --- | ---: | --- |
| Public and Auth | 7 | Explain product and manage account entry |
| App Shell | 1 | Shared logged-in layout |
| Dashboard | 1 | Job-hunt command center |
| Career Vault | 5 | Career memory, sources, events, claims, profile |
| Job Targets | 4 | JD intake, job analysis, evidence mapping |
| Generate | 2 | Configure and generate application materials |
| Editor | 3 | Edit, version, export artifacts |
| Interview Prep | 3 | Prepare for interviews based on submitted resume |
| Tracker | 3 | Track applications and next actions |
| Settings | 5 | Account, AI provider, privacy, billing |
| Admin / Ops | 4 | SaaS operations and failure monitoring |

## Public And Auth Pages

### 1. Landing Page `/`

Main content:

- Hero: "Build your career profile once, tailor every application."
- Product loop: Career Vault -> Job Target -> Generate -> Editor -> Interview Prep.
- Feature sections:
  - Evidence-backed career vault.
  - JD match and evidence mapping.
  - Resume / cover letter / message generation.
  - A4 editor and exports.
  - Interview prep from submitted resume.
- Trust/privacy section.
- CTA: start free, sign in.

Main components:

- PublicHeader
- Hero
- ProductLoopDiagram
- FeatureGrid
- PrivacyPanel
- CTASection

Data dependency:

- Static content.

### 2. Pricing Page `/pricing`

Main content:

- Free plan.
- Pro plan.
- BYOK option.
- Usage limits.
- FAQ.

Main components:

- PricingTable
- UsageLimitList
- FAQAccordion

### 3. Privacy Page `/privacy`

Main content:

- What data is stored.
- How AI providers receive data.
- Export/delete controls.
- Sensitive information policy.

### 4. Login Page `/login`

Main content:

- Email/password login.
- Phone code login.
- Forgot password.
- Link to signup.

### 5. Signup Page `/signup`

Main content:

- Email/password signup.
- Phone signup.
- Initial language/region.
- Link to login.

### 6. Password Reset `/forgot-password`

Main content:

- Email input.
- Reset confirmation.

### 7. Onboarding `/app/onboarding`

Main content:

- Goal selection: internship, school recruitment, social recruitment, overseas.
- Language preference.
- First material input:
  - upload resume
  - paste career text
  - skip for now

## Logged-In App Shell

### 8. App Layout `/app/*`

Main content:

- Left navigation.
- Top command bar.
- Global search.
- Add material button.
- Add job target button.
- Account menu.

Main nav:

- Dashboard
- Career Vault
- Job Targets
- Generate
- Editor
- Interview Prep
- Tracker
- Settings

Main components:

- AppShell
- SidebarNav
- TopCommandBar
- GlobalCreateMenu
- AccountMenu
- NotificationCenter

## Dashboard

### 9. Dashboard `/app/dashboard`

Main content:

- Next best action banner.
- Career Vault readiness.
- Job targets count.
- Generated artifacts count.
- Applied/interview/offer counts.
- Application funnel.
- Upcoming deadlines.
- Recent activity.
- Recommended actions.

Main components:

- NextActionBanner
- MetricStrip
- VaultReadinessCard
- ApplicationFunnel
- DeadlineList
- ActivityTimeline
- RecommendationList

Data dependency:

- Dashboard summary.
- Activity feed.
- Recommendations.

## Career Vault

### 10. Vault Overview `/app/vault`

Main content:

- Readiness score.
- Last updated.
- Add source.
- Review queue preview.
- Source count.
- Confirmed event count.
- Claim count.
- Recent extracted events.

Main components:

- VaultHeader
- ReadinessMeter
- UnifiedMaterialInput
- ReviewQueuePreview
- VaultStats

### 11. Profile `/app/vault/profile`

Main content:

- Basic information.
- Contact information.
- Personal links.
- Application answers.
- Professional summary.
- Visibility and language preferences.
- Backup/restore.

Main components:

- ProfileForm
- LinkListEditor
- ApplicationAnswersForm
- BackupRestorePanel

### 12. Sources `/app/vault/sources`

Main content:

- Source list.
- Upload/paste/link input.
- Parse status.
- Re-analyze action.
- Source detail preview.

Main components:

- SourceList
- SourceUploader
- SourceDetailDrawer
- ParseStatusBadge

### 13. Events `/app/vault/events`

Main content:

- Filterable event list.
- Event cards by type/status.
- Event detail drawer.
- Evidence and claims.
- Confirm/edit/archive actions.

Main components:

- EventFilterBar
- EventList
- EventDetailDrawer
- EvidenceBadge
- ClaimList

### 14. Claims `/app/vault/claims`

Main content:

- Claim bank.
- Claim strength: confirmed/inferred/weak.
- Linked event.
- Linked evidence.
- Visibility controls.

Main components:

- ClaimTable
- ClaimDetailDrawer
- StrengthBadge

### 15. Review Queue `/app/vault/review`

Main content:

- AI-extracted draft events.
- Uncertain fields.
- Evidence preview.
- Confirm/edit/needs_review/skip controls.

Main components:

- EventReviewCard
- ReviewDecisionFooter
- BatchReviewToolbar

## Job Targets

### 16. Job List `/app/jobs`

Main content:

- Job target table.
- Status, company, role, priority, deadline.
- Match score.
- Filters.
- Add job button.

Main components:

- JobTargetTable
- JobFilters
- MatchScoreBadge

### 17. New Job `/app/jobs/new`

Main content:

- Paste JD.
- Job URL.
- Manual company/role fields.
- Channel selection.
- Create and analyze button.

Main components:

- JDInputPanel
- JobMetadataForm

### 18. Job Detail `/app/jobs/:jobId`

Main content:

- Company and role header.
- Raw JD.
- AI analysis.
- Match score.
- Gaps.
- Actions: evidence map, generate, track.

Main components:

- JobHeader
- JDPanel
- JDAnalysisPanel
- MatchSummary
- JobActionBar

### 19. Evidence Map `/app/jobs/:jobId/evidence`

Main content:

- JD requirements.
- Matched events and claims.
- Omitted relevant events.
- Weak or missing evidence.
- Approve evidence map.

Main components:

- RequirementList
- EvidenceMapMatrix
- GapPanel
- ApprovalFooter

## Generate

### 20. Generate Home `/app/generate`

Main content:

- Select job target.
- Select document type.
- Select language.
- Select template.
- Select sections.
- Evidence strictness.
- Additional instructions.
- Plan preview.

Main components:

- DocumentTypeGrid
- TemplateSelector
- SectionSelector
- EvidenceStrictnessControl
- AdditionalInstructionsBox
- PlanPreviewPanel

### 21. Job Generate `/app/jobs/:jobId/generate`

Same as Generate Home, but job target is preselected and page focuses on that workspace.

## Editor

### 22. Editor Home `/app/editor`

Main content:

- Artifact list.
- Recent documents.
- Filters by job/company/type.
- Empty state to generate first document.

Main components:

- ArtifactList
- ArtifactFilters

### 23. Artifact Editor `/app/editor/:artifactId`

Main content:

- Document list/version list.
- A4 preview.
- Structured edit mode.
- Source view.
- AI edit assistant.
- Export menu.
- Verification panel.

Main components:

- ArtifactToolbar
- VersionList
- A4PreviewFrame
- StructuredEditor
- SourceView
- AIEditAssistant
- ExportMenu
- VerificationPanel

### 24. Artifact Compare `/app/editor/:artifactId/compare`

Main content:

- Compare two versions.
- Show changed sections/bullets.
- Restore or create new version.

Main components:

- VersionCompare
- DiffSidebar

## Interview Prep

### 25. Prep Home `/app/interview-prep`

Main content:

- Select job target.
- Select submitted resume version.
- Existing prep sets.

Main components:

- PrepTargetSelector
- SubmittedArtifactSelector
- PrepSetList

### 26. Prep Detail `/app/interview-prep/:prepId`

Main content:

- Question categories.
- Question list.
- STAR answer.
- Evidence references.
- User status: know/weak/needs_review.
- Regenerate controls.

Main components:

- QuestionCategoryTabs
- QuestionList
- AnswerPanel
- EvidenceReferenceList
- PrepStatusControl

### 27. Interview Retrospective `/app/interview-prep/:prepId/retrospective`

Main content:

- Record actual questions.
- Record response quality.
- Lessons learned.
- Update future prep.

Main components:

- RetrospectiveForm
- OutcomeSummary

## Application Tracker

### 28. Tracker Kanban `/app/tracker`

Main content:

- Application columns: draft, ready, applied, online test, interview, offer, rejected, archived.
- Cards with company, role, deadline, next action.

Main components:

- ApplicationKanban
- ApplicationCard

### 29. Tracker Table `/app/tracker/table`

Main content:

- Sortable table.
- Status, priority, deadline, channel, submitted version.

Main components:

- ApplicationTable
- SavedViews

### 30. Application Detail `/app/tracker/:applicationId`

Main content:

- Application status history.
- Submitted resume version.
- Notes.
- Interview rounds.
- Outcome.
- Next action.

Main components:

- ApplicationHeader
- StatusTimeline
- SubmittedArtifactLink
- InterviewRoundList
- OutcomePanel

## Settings

### 31. Account Settings `/app/settings/account`

Main content:

- Name.
- Email.
- Phone.
- Password.
- Connected providers.

### 32. AI Settings `/app/settings/ai`

Main content:

- Model provider.
- BYOK.
- Usage preferences.
- Logging controls.

### 33. Privacy Settings `/app/settings/privacy`

Main content:

- Data export.
- Delete account.
- Raw source retention.
- Sensitive field controls.

### 34. Billing Settings `/app/settings/billing`

Main content:

- Plan.
- Usage.
- Invoices.

### 35. Extension Settings `/app/settings/extension`

Main content:

- Extension connection status.
- Supported sites.
- Autofill confirmation settings.

## Admin / Ops

### 36. Admin Users `/admin/users`

Main content:

- User list.
- Support diagnostics.
- Plan/status.

### 37. AI Jobs `/admin/ai-jobs`

Main content:

- Queue status.
- Failed jobs.
- Retry.
- Error category.

### 38. Exports `/admin/exports`

Main content:

- Failed PDF/DOCX exports.
- Verification failures.

### 39. Usage `/admin/usage`

Main content:

- Model usage.
- Cost.
- Billing events.

## Implementation Priority

Build order should be:

1. App shell, auth, dashboard skeleton.
2. Career Vault overview, profile, sources, review queue.
3. Events and claims.
4. Job targets and evidence map.
5. Generate.
6. Editor.
7. Tracker.
8. Interview prep.
9. Settings.
10. Extension and admin.

