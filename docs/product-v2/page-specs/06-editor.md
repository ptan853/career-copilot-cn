# Editor Page Spec

## Purpose

Review, edit, version, and export generated artifacts.

## Layout Wireframe

```text
┌────────────────────────────────────────────────────────────────────┐
│ Artifact title, saved status, template, preview/edit/source, export│
├───────────────┬───────────────────────────────────┬────────────────┤
│ Document list │ A4 / Letter exact preview          │ AI assistant   │
│ Versions      │ Inline field editing               │ Suggestions    │
│ Job context   │ Section selection                  │ Change history │
└───────────────┴───────────────────────────────────┴────────────────┘
```

## Core Objects

- Artifact
- ArtifactVersion
- RenderedDocument
- EditOperation
- ExportFile

## Modes

- Preview.
- Structured edit.
- Source view.
- Compare versions.

## Edit Types

- Manual field edit.
- AI small rewrite.
- AI section rewrite.
- Structural patch.
- Template change.
- Section order change.
- Compression to page count.

## AI Assistant Presets

- Make more concise.
- Use stronger action verbs.
- Add quantified achievements, only if evidence exists.
- Make tone more confident.
- Fix grammar and flow.
- Add JD keywords.
- Translate to Chinese.
- Translate to English.
- Compress to one page.

## Export Formats

- PDF.
- DOCX.
- Markdown.
- HTML.
- TXT.
- JSON artifact backup.

## Verification

PDF verification must check:

- Page count.
- Text layer exists.
- Contact fields present.
- No obvious truncation.
- File generated successfully.

## APIs

- `GET /artifacts`
- `GET /artifacts/:id`
- `PATCH /artifacts/:id`
- `POST /artifacts/:id/ai-edit`
- `POST /artifacts/:id/patch`
- `POST /artifacts/:id/render`
- `POST /artifacts/:id/export`
- `GET /artifacts/:id/versions`
- `POST /artifacts/:id/mark-submitted`

## Confirmation Gates

User approval is required for:

- Structural patch.
- Final export.
- Marking a version as submitted.

