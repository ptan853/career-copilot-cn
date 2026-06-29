# User Flows V2

## Flow 1: Onboarding To Career Vault Readiness

```mermaid
sequenceDiagram
  actor U as User
  participant W as Web App
  participant API as API
  participant AI as AI Pipeline
  participant DB as Database

  U->>W: Sign up / log in
  W->>U: Ask for initial goal and language
  U->>W: Upload resume or paste career text
  W->>API: Create SourceMaterial
  API->>DB: Save raw source
  API->>AI: Start parse job
  AI->>DB: Draft events and claims
  W->>U: Show review queue
  U->>W: Confirm / edit / mark uncertain / skip
  W->>API: Apply reviewed changes
  API->>DB: Store confirmed events and claims
  W->>U: Career Vault readiness score
```

Key rule from `career-timeline`: raw source must be saved before AI extraction. Draft facts must not silently become trusted facts.

## Flow 2: Add Job Target

```mermaid
flowchart TD
  A["Paste JD / enter URL / extension capture"] --> B["Create Job Target"]
  B --> C["Normalize company, role, city, source"]
  C --> D["AI JD analysis"]
  D --> E["Requirements, keywords, risks, narrative"]
  E --> F["Match against Career Vault"]
  F --> G["Show match score and evidence gaps"]
  G --> H{"User wants to continue?"}
  H -->|Yes| I["Create Application Workspace"]
  H -->|No| J["Archive / save for later"]
```

Key rule from `career-application`: target understanding comes before resume writing.

## Flow 3: Evidence Mapping

```mermaid
flowchart LR
  A["JD Requirements"] --> C["Evidence Map"]
  B["Confirmed Events + Claims"] --> C
  C --> D["Selected Evidence"]
  C --> E["Omitted Relevant Evidence"]
  C --> F["Gaps / Weak Claims"]
  D --> G["Resume Plan"]
  E --> G
  F --> G
```

The user must see which evidence will be used before generation.

## Flow 4: Generate Resume

```mermaid
sequenceDiagram
  actor U as User
  participant W as Generate Page
  participant API as API
  participant AI as AI Pipeline
  participant R as Renderer

  U->>W: Choose document type, language, template, sections
  W->>API: Request resume plan
  API->>AI: Build target-first plan
  AI->>W: Plan with selected events, omitted events, risks
  U->>W: Approve or adjust plan
  W->>API: Generate structured artifact
  API->>AI: Draft artifact JSON
  API->>R: Render preview
  W->>U: Open in Editor
```

Key rule from `career-application`: do not jump directly from JD to final resume. Plan first.

## Flow 5: Editor And Export

```mermaid
flowchart TD
  A["Open Artifact"] --> B["Preview"]
  B --> C{"Need change?"}
  C -->|Small wording| D["AI Edit Assistant"]
  C -->|Manual edit| E["Structured field edit"]
  C -->|Section change| F["Patch plan"]
  D --> G["Version history"]
  E --> G
  F --> H{"User approves structural patch?"}
  H -->|Yes| G
  H -->|No| B
  G --> I["Render"]
  I --> J["PDF/DOCX/Markdown/TXT export"]
  J --> K["Verification"]
  K --> L["Mark submitted version"]
```

PDF export must be verified for page count, text layer, contact fields, and truncation.

## Flow 6: Interview Prep

```mermaid
flowchart TD
  A["Select submitted resume version"] --> B["Select job target"]
  B --> C["Analyze JD + submitted artifact"]
  C --> D["Predict question categories"]
  D --> E["Generate STAR answers from evidence"]
  E --> F["Project deep dive cards"]
  F --> G["User marks: know / weak / need review"]
  G --> H["Interview prep dashboard"]
```

Interview prep should never be detached from the resume version that was actually submitted.

## Flow 7: Tracker Feedback Loop

```mermaid
flowchart LR
  A["Application status changes"] --> B["Tracker"]
  B --> C["Interview / rejection / offer notes"]
  C --> D["Outcome analysis"]
  D --> E["Improve target strategy"]
  E --> F["Improve Career Vault claims"]
  F --> G["Better future generation"]
```

## Confirmation Gates

The product must ask for explicit user approval before:

- Storing AI-extracted draft facts as confirmed facts.
- Using weak or inferred claims in a formal application.
- Applying structural document patches.
- Exporting final application material.
- Auto-filling or submitting fields through the browser extension.
- Deleting source materials, events, claims, artifacts, or account data.

No explicit approval is needed for:

- Saving raw uploaded material the user selected.
- Creating draft AI suggestions.
- Showing match analysis.
- Rendering previews.
- Running non-destructive verification.

