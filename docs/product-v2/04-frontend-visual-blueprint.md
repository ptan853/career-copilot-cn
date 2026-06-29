# Frontend Visual Blueprint V2

## Design Direction

The product should feel like a serious job-application operating system:

- Quiet, dense, professional.
- Document and data focused.
- Minimal decoration.
- Clear separation between input, structured facts, generated artifacts, and progress.
- Native-feeling editing controls.

Avoid:

- Marketing-style app screens inside the logged-in product.
- Oversized cards that waste workspace.
- Cute or toy-like visual language.
- Single-page demo layouts.

## Layout System

### App Shell

```text
┌────────────────────────────────────────────────────────────────────┐
│ Global top bar: logo, search, create, notifications, account       │
├───────────────┬────────────────────────────────────────────────────┤
│ Side nav      │ Page content                                       │
│ Dashboard     │                                                    │
│ Vault         │                                                    │
│ Jobs          │                                                    │
│ Generate      │                                                    │
│ Editor        │                                                    │
│ Prep          │                                                    │
│ Tracker       │                                                    │
│ Settings      │                                                    │
└───────────────┴────────────────────────────────────────────────────┘
```

### Product Density

Use compact controls and predictable spacing:

- 8px base spacing.
- 4px radius for inputs and small controls.
- 6-8px radius for cards.
- Tables, lists, and panels should support scanning.
- Cards are for repeated items, not for every page section.

## Key Page Layouts

### Career Vault

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Career Vault · readiness 82% · last updated                         │
├───────────────┬───────────────────────────────┬─────────────────────┤
│ Profile       │ Review Queue                  │ Event Detail         │
│ Sources       │ ┌ event card ┐                │ Title                │
│ Events        │ ├ event card ┤                │ Type / Date / Role   │
│ Claims        │ ├ event card ┤                │ Evidence             │
│ Review        │ └ event card ┘                │ Claims               │
│               │                               │ Confirm / Edit       │
└───────────────┴───────────────────────────────┴─────────────────────┘
```

OfferMax influence: two-column profile build.

Our improvement: review queue and evidence drawer are first-class.

### Job Target Detail

```text
┌────────────────────────────────────────────────────────────────────┐
│ Company · Role · status · priority · deadline                      │
├──────────────────────┬──────────────────────┬──────────────────────┤
│ JD / source          │ AI analysis           │ Evidence map         │
│ raw text / URL       │ requirements          │ matched events       │
│ channel metadata     │ keywords              │ gaps                 │
│                      │ risks                 │ generate actions     │
└──────────────────────┴──────────────────────┴──────────────────────┘
```

### Generate

```text
┌──────────────────────────────┬─────────────────────────────────────┐
│ Controls                     │ Plan / Preview                       │
│ Document type                │ Before approval: Resume Plan         │
│ Target                       │ After approval: rendered draft       │
│ Template                     │ Warnings always visible              │
│ Sections                     │                                     │
│ Evidence strictness          │                                     │
│ Instructions                 │                                     │
│ Generate                     │                                     │
└──────────────────────────────┴─────────────────────────────────────┘
```

### Editor

```text
┌────────────────────────────────────────────────────────────────────┐
│ Artifact toolbar: title, saved, template, mode, export             │
├──────────────┬──────────────────────────────────┬──────────────────┤
│ Versions     │ A4 exact preview / structured edit│ AI assistant     │
│ Documents    │                                  │ history          │
│ Job context  │                                  │ quick actions    │
└──────────────┴──────────────────────────────────┴──────────────────┘
```

### Interview Prep

```text
┌────────────────────────────────────────────────────────────────────┐
│ Prep header: Job target + submitted resume version                 │
├──────────────┬───────────────────────────────┬─────────────────────┤
│ Prep sets    │ Question list by category     │ Answer and evidence │
│ Resume links │ status: know/weak/review      │ STAR structure      │
└──────────────┴───────────────────────────────┴─────────────────────┘
```

## Component Inventory

### Navigation

- AppSideNav
- TopCommandBar
- Breadcrumbs
- AccountMenu

### Data Display

- ReadinessMeter
- EvidenceBadge
- StatusPill
- SourceBadge
- MatchScore
- ActivityTimeline
- ApplicationFunnel

### Input And Editing

- UnifiedMaterialInput
- FileDropzone
- LinkInputRow
- StructuredField
- EvidenceDrawer
- SectionEditor
- InlineArtifactEditor
- AIInstructionBox

### Review

- EventReviewCard
- ClaimReviewCard
- WeakClaimWarning
- ConfirmationFooter

### Artifact

- A4PreviewFrame
- ArtifactToolbar
- VersionList
- ExportMenu
- VerificationPanel

## Design Tokens

Initial direction:

- Background: neutral gray, not pure white everywhere.
- Main panels: white.
- Primary: restrained blue.
- Accent: use only for AI/evidence controls.
- Danger: red.
- Warning: amber.
- Success: green.
- Text: near-black, secondary gray.

Typography:

- UI: system sans.
- Document preview: template-specific serif/sans.
- No viewport-based font scaling.
- No negative letter spacing.

## Interaction Principles

- Every AI output should show whether it is draft, confirmed, or weak.
- Every generated document should show its job target and source evidence.
- Destructive operations require confirmation.
- The UI should support keyboard-heavy repeated work.
- Empty states should offer concrete next actions.

