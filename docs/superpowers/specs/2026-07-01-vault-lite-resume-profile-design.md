# Vault Lite Resume Profile Design

Date: 2026-07-01
Status: Approved design direction
Scope: Keep the current Vault two-column layout, redesign the right profile area as a resume-like editable career profile.

## Product Goal

The Vault should feel like a practical career profile workspace, not a claim review dashboard.

Users should be able to upload or paste materials on the left, then see a clean resume-like profile on the right. AI parsing should produce editable sections with a small, stable set of fields. The first version should avoid over-structured bullet analysis and avoid exposing claims/evidence as the main UI.

## Confirmed Direction

Keep the existing page layout:

- Left column: input and source operations.
- Right column: profile display and editing.

Change the right column from event cards into a resume-style profile view:

- Profile header.
- Professional summary.
- Work / internship.
- Projects.
- Education.
- Skills.
- Awards.
- Certifications / courses.
- Publications / patents.
- Volunteer / organization / other.
- Languages.

The right column should directly show the content, similar to a resume. Each item can be edited from an inline edit button that opens a modal.

## Non-Goals

- Do not redesign the whole Vault page layout.
- Do not move material input into a separate full-screen flow.
- Do not make bullets a complex object with action, method, impact, or metric fields.
- Do not expose claims and evidence as primary editing concepts.
- Do not introduce a new database table before the existing `CareerEvent.details_json` approach is exhausted.
- Do not require perfect source-level provenance in the first version.

## Page Layout

### Left Column: Operations

The left column remains the operational panel:

- File upload.
- Text input.
- URL input.
- Optional instruction to AI.
- Start parsing button.
- Uploaded / parsed material list.
- Parse state and failure messages.

Small improvements are acceptable:

- Make parsing status more visible.
- Keep failed states readable.
- Keep clear profile action available, but behind confirmation.

### Right Column: Resume Profile

The right column becomes the user's career profile:

- Render sections vertically.
- Show content directly, not as cards.
- Use resume-like typography and spacing.
- Show edit controls on each section/item.
- Hide claims/evidence from the main display.

For the first version, section ordering is fixed:

1. Profile header
2. Professional summary
3. Work / internship
4. Projects
5. Education
6. Skills
7. Awards
8. Certifications / courses
9. Publications / patents
10. Volunteer / organization / other
11. Languages

## Lite Section Schema

### Profile Header

Source:

- `Profile.full_name`
- `Profile.headline`
- `Profile.emails`
- `Profile.phones`
- `Profile.location`
- `Profile.links`
- `Profile.years_of_experience`

Display:

- Name
- Headline
- Years of experience
- Email
- Phone
- Location
- Links

### Professional Summary

Source:

- `Profile.summary`

Fields:

- summary

### Work / Internship

Event types:

- `work`
- `internship`

Fields:

- title: role / job title
- organization: company
- time_start
- time_end
- location
- details_json.bullets: string[]

Display:

- Role
- Company
- Time range
- Location when present
- Bullet list

### Projects

Event types:

- `project`
- `startup`
- `open_source`

Fields:

- title: project name
- role
- time_start
- time_end
- details_json.tech_stack: string[]
- details_json.url
- details_json.bullets: string[]

Display:

- Project name
- Role and time range
- Tech stack chips
- Link when present
- Bullet list

### Education

Event types:

- `education`

Fields:

- organization: school
- title: degree
- details_json.field
- time_start
- time_end
- details_json.gpa
- details_json.honors

Display:

- Degree and field
- School
- Time range
- GPA / honors when present

### Skills

Event types:

- `language` should not be mixed here.
- Skills may be stored as `custom` events with `details_json.section_kind = "skills"` in the first version if no dedicated model exists.

Fields:

- title: category
- details_json.skills: string[]

Display:

- Skill category
- Skill chips

### Awards

Event types:

- `award`
- `competition`

Fields:

- title: award name
- organization: issuer
- time_start or time_end
- description

Display:

- Award name
- Issuer
- Year / date
- Description when present

### Certifications / Courses

Event types:

- `certification`
- `course`

Fields:

- title: certification or course name
- organization: issuer / institution
- time_start or time_end
- details_json.url
- description

Display:

- Name
- Institution
- Year / date
- Link when present
- Description when present

### Publications / Patents

Event types:

- `publication`
- `patent`

Fields:

- title
- organization: venue / patent office
- time_start or time_end
- details_json.url
- details_json.authors
- description

Display:

- Title
- Venue / patent office
- Year / date
- Authors / inventors when present
- Link when present
- Description when present

### Volunteer / Organization / Other

Event types:

- `volunteer`
- `custom`

Fields:

- title: activity / organization / item name
- role
- organization
- time_start
- time_end
- location
- description

Display:

- Name
- Role / organization
- Time range
- Description

### Languages

Event types:

- `language`

Fields:

- title: language
- details_json.proficiency

Display:

- Language
- Proficiency

## Bullet Rule

`details_json.bullets` is a plain string array.

Example:

```json
{
  "bullets": [
    "设计并开发 PM Agent 项目管理助手，支持项目、任务、人员信息的自然语言查询与报告生成。",
    "通过 ToolManager 统一管理本地与远程工具，支持多步工具调用和复杂查询拆解。"
  ]
}
```

Rules:

- A bullet is exactly one resume point.
- Do not split bullets into action / method / impact objects.
- Do not expose source mode or evidence references in the main bullet field.
- AI may lightly clean formatting.
- AI may merge duplicate material from multiple sources.
- AI must not compress useful content into vague short bullets.
- AI must not invent facts, dates, companies, metrics, awards, or credentials.

## AI Parse Contract

The parser should output a Lite Profile shape that maps into `CareerEvent` and `Profile`.

Parsing instruction:

```text
你的任务是把材料整理成可编辑的职业档案，不是重写简历。
如果原文已有 bullet，尽量保留信息密度。
如果多个材料重复，可以合并整理。
如果原文是长段落，可以整理成清晰 bullet。
不得编造公司、学校、时间、指标、奖项、证书。
输出必须匹配 Lite Profile Schema。
```

The output should prioritize:

- Stable section classification.
- Small fixed field sets.
- High-information bullets.
- Chinese UI-friendly labels and content.
- `details_json.bullets` as plain strings.

Claims and evidence may still be persisted internally, but they are secondary. They should not drive the main Vault UI.

## Editing Behavior

Each profile item has an edit button.

The modal form is selected by event type:

- Work / internship modal.
- Project modal.
- Education modal.
- Skills modal.
- Award modal.
- Certification / course modal.
- Publication / patent modal.
- Volunteer / custom modal.
- Language modal.

The modal edits only the Lite fields for that section.

Saving updates:

- Top-level `CareerEvent` fields such as `title`, `role`, `organization`, `location`, `time_start`, `time_end`, `description`.
- Section-specific fields under `details_json`.

When the user edits bullets, the UI edits a simple multiline list or repeated textarea rows. The stored value remains `details_json.bullets: string[]`.

## Backend Approach

Do not add new tables for this iteration.

Use:

- `Profile` for header and summary.
- `CareerEvent` for all profile items.
- `CareerEvent.details_json` for section-specific Lite fields.
- Existing `Claim` and `Evidence` tables for internal evidence tracking.

Add a schema registry module that defines:

- Section order.
- Event type to section mapping.
- Lite fields per section.
- Field labels for API/UI use.

The registry should be simple Python data, not a database table.

## Frontend Approach

Add a matching TypeScript section config for:

- Section order.
- Section labels.
- Event type grouping.
- Render templates.
- Edit form field definitions.

If duplication with the backend becomes painful later, expose the backend registry through an API endpoint. First version can use mirrored constants.

## Success Criteria

- The left input column still works.
- Parsed profile items render on the right like a resume.
- Work/project items show real bullet lists, not claim/evidence counters.
- The user can edit a work item with fixed fields and save it.
- Refreshing the page preserves edited fields.
- AI parsing creates `details_json.bullets` as plain strings.
- Existing claim/evidence storage still works but is not the main UI.

## Implementation Order

1. Add Lite Profile schema registry and tests.
2. Update AI prompt and normalizer to write Lite fields, especially `details_json.bullets`.
3. Replace right-side event grid with resume-style section rendering.
4. Add typed edit modals for the most important sections first: work/internship, project, education, skills.
5. Add remaining edit modals: award, certification/course, publication/patent, volunteer/custom, language.
6. Verify upload -> parse -> display -> edit -> refresh end to end.
