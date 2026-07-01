# Vault Three-Layer Parsing Design

## 1. Product Result

Vault 的第一阶段产品结果只有一个：

```text
用户输入文件、文字材料、链接和解析提示
-> AI 解析
-> 右侧直接生成或更新结构化职业档案
```

用户不应该看到 candidate、merge proposal、reconciliation queue、conflict review 这类工程概念。用户只需要面对最终履历内容，并能编辑、删除、新增、确认。

## 2. Why The Current One-Shot Parser Will Not Scale

当前实现大致是：

```text
单个 source text + 一个巨大 system prompt -> 完整 parse JSON -> 直接写 CareerEvent
```

这能验证早期闭环，但随着材料数量和 section 字段增加，会出现：

- 材料越多，prompt 越长，模型会漏掉内容。
- section 越多，字段规则越多，模型会把课程、荣誉、教育、证书混在一起。
- 输出越长，JSON 越容易截断或格式错误。
- 重复材料再次解析时，容易重复生成同一条经历。
- 每新增一个 section 都只能继续扩张一个大 prompt，长期不可维护。

下一步要把用户的一次“开始解析”拆成内部多轮小任务，但前端体验仍然是一次点击。

## 3. Target Architecture

```text
Layer 1: Source-level section detection
Layer 2: Section-level event extraction
Layer 3: Event-level duplicate merge
```

完整内部流程：

```text
ParseBatch
  -> SourceMaterial(file/text/url)
  -> SourceSectionMap per source
  -> SectionInputBundle per section
  -> SectionExtractor
  -> ExtractedEvent
  -> EventDeduper
  -> CareerEvent
  -> right-side profile refresh
```

The pipeline is driven by a single schema registry:

```text
Vault Section Schema Registry
  -> prompt field descriptions
  -> section output JSON shape
  -> deterministic normalizer rules
  -> canonical dedupe keys
  -> future frontend edit forms
```

The schema registry is the source of truth. Section prompts must not contain separate hand-maintained field definitions that can drift away from backend normalization or frontend edit forms.

## 4. Section Schema Registry

### Purpose

Each section has a structured schema:

```json
{
  "section_type": "experience",
  "title": "工作/实习",
  "description": "用户的工作、实习、兼职角色。",
  "event_types": ["work", "internship"],
  "dedupe_fields": ["organization", "title", "time_start", "time_end"],
  "fields": [
    {
      "path": "title",
      "label": "职位",
      "type": "string",
      "meaning": "用户在该经历中的职位或角色名称",
      "required": true
    },
    {
      "path": "organization",
      "label": "公司/组织",
      "type": "string",
      "meaning": "雇主、实验室、团队或组织名称",
      "required": false
    },
    {
      "path": "details.bullets",
      "label": "要点",
      "type": "string[]",
      "meaning": "简历中可复用的经历要点，每条应包含贡献、方法或结果",
      "required": false
    }
  ]
}
```

Required backend API:

```python
get_section_schema(section_type: str) -> SectionSchema
render_section_field_instructions(section_type: str) -> str
render_section_output_schema(section_type: str) -> dict
get_section_dedupe_fields(section_type: str) -> list[str]
normalize_event_with_schema(section_type: str, event: dict) -> dict
```

### Required Initial Sections

- profile
- summary
- experience
- projects
- education
- courses
- awards
- skills
- certifications
- research
- languages
- other

### Prompt Generation Rule

Every section extractor prompt uses the same template:

```text
你是 {{section.title}} 抽取器。

Section 含义:
{{section.description}}

字段定义:
{{render_section_field_instructions(section_type)}}

当前已有内容:
{{existing_events_json}}

新材料片段:
{{source_spans_json}}

输出 JSON:
{{render_section_output_schema(section_type)}}
```

This means adding a new field should only require updating the schema registry and related tests. The prompt should update automatically.

## 5. Input Model

Vault has four input channels.

### File

Each file is one independent `SourceMaterial`.

Examples:

- `resume.pdf`
- `transcript.pdf`
- `certificate.png`
- `project-notes.docx`

Reason: each file has its own title, parse status, extraction warning, source evidence, and retry lifecycle.

### Text Material

One submit action creates one text `SourceMaterial`.

Examples:

- pasted resume text
- project description
- self-evaluation
- interview notes
- performance review snippets

The text source may later be chunked internally, but it remains one user-visible source.

### URL

Each URL is one independent `SourceMaterial`.

Examples:

- GitHub project link
- portfolio page
- LinkedIn public profile
- BOSS/LinkedIn text copied from a page

Default behavior:

- Save the link as a profile/material link.
- Fetch and parse only when the user marks it as participating in AI parsing.
- If the URL requires login or blocks scraping, fail clearly and ask the user to paste or upload content.

### AI Instruction

AI instruction is not source material. It is a parse-level instruction.

Examples:

- “重点提取 Agent、算法工程和大模型项目。”
- “这次只解析课程和奖项。”
- “忽略求职目标描述，只保留我的个人经历。”

It belongs to `ParseBatch.instruction`, and every AI call in this batch should receive it.

## 6. Layer 1: Source-Level Section Detection

### Purpose

Each source is classified independently. This layer answers:

```text
这份材料是什么？
它包含哪些 section？
哪些文本片段属于哪个 section？
哪些内容不能解析？
```

This layer must not generate final CareerEvents.

### Input

```json
{
  "source_id": "src_123",
  "source_type": "file | text | url",
  "source_title": "resume.pdf",
  "instruction": "重点提取 Agent 项目",
  "content": "extracted text or markdown"
}
```

### Output

```json
{
  "source_id": "src_123",
  "material_type": "resume",
  "language": "zh-CN",
  "sections_detected": ["profile", "summary", "experience", "projects", "education", "skills"],
  "section_spans": [
    {
      "section_type": "experience",
      "span_title": "工作经历",
      "text": "Agent 算法工程师...",
      "confidence": 0.92
    }
  ],
  "warnings": []
}
```

### Layer 1 Prompt

System:

```text
你是职业档案材料分类器。你的任务是阅读单份用户材料，判断其中包含哪些职业档案 section，并把原文片段分配给对应 section。

你不能生成最终履历事件，不能改写简历 bullet，不能编造材料中不存在的信息。

允许的 section_type:
- profile: 姓名、邮箱、电话、地点、个人链接、头像等身份字段
- summary: 个人简介、职业摘要、自我评价
- experience: 工作、实习、兼职角色
- projects: 项目、开源、产品、创业项目
- education: 学校、学位、专业、GPA、学校期间荣誉
- courses: 课程、相关 coursework、训练营课程
- awards: 荣誉、奖项、奖学金、竞赛奖项
- skills: 技能、工具、技术栈
- certifications: 证书、资格认证
- research: 论文、专利、研究项目
- languages: 语言能力
- other: 志愿、社团、其他经历

输出必须是 JSON，不要输出 Markdown。
```

User:

```text
解析提示:
{{batch_instruction}}

材料信息:
- source_id: {{source_id}}
- source_type: {{source_type}}
- source_title: {{source_title}}

材料正文:
{{source_text}}

请输出:
{
  "source_id": string,
  "material_type": "resume | transcript | certificate | portfolio | project_note | linkedin_export | performance_review | text_note | url_page | unknown",
  "language": string,
  "sections_detected": string[],
  "section_spans": [
    {
      "section_type": string,
      "span_title": string,
      "text": string,
      "confidence": number
    }
  ],
  "warnings": string[]
}
```

## 7. Layer 2: Section-Level Event Extraction

### Purpose

After layer 1, the system groups spans by section:

```text
experience <- spans from resume.pdf + pasted text
projects <- spans from resume.pdf + GitHub page + notes
courses <- spans from transcript.pdf + resume.pdf
```

Each section extractor receives only its own section text, current profile section context, and the batch instruction.

This layer generates structured events, but it still does not expose intermediate objects to the user.

### Common Extractor Input

```json
{
  "section_type": "projects",
  "instruction": "重点提取 Agent 项目",
  "existing_section_events": [],
  "source_spans": [
    {
      "source_id": "src_123",
      "source_title": "resume.pdf",
      "text": "..."
    }
  ]
}
```

### Common Extractor Output

```json
{
  "section_type": "projects",
  "events": [],
  "warnings": []
}
```

### Global Section Extractor Rules

All section extractors must follow these rules:

- Do not invent employers, schools, dates, awards, metrics, links, credentials, or tools.
- Preserve source traceability with `source_ids` and `evidence_quotes`.
- Use `status: draft` unless the content is directly edited or confirmed by the user later.
- Mark uncertain fields in `details.needs_review_fields`.
- Keep fields simple and aligned with the right-side resume-like UI.
- Return JSON only.

## 8. Section Prompt Contracts

The following contracts define the initial schema registry content. The actual code should generate prompt field descriptions and output schema from these definitions instead of duplicating them by hand in every prompt.

### 8.1 Profile Extractor

Fields:

- full_name
- headline
- emails[]
- phones[]
- location
- links[]
- years_of_experience

Prompt user body:

```text
你是职业档案 Profile 字段抽取器。只抽取身份和联系方式字段，不要生成工作、项目或教育事件。

解析提示:
{{batch_instruction}}

当前 Profile:
{{existing_profile_json}}

材料片段:
{{source_spans_json}}

输出 JSON:
{
  "profile_patch": {
    "full_name": string | null,
    "headline": string | null,
    "emails": string[],
    "phones": string[],
    "location": string | null,
    "links": [{"label": string, "url": string, "link_type": string}],
    "years_of_experience": number | null
  },
  "evidence_quotes": string[],
  "warnings": string[]
}
```

### 8.2 Summary Extractor

Fields:

- description

Prompt user body:

```text
你是职业摘要抽取器。只抽取或整理用户已有材料中的职业摘要，不要写营销式自夸，不要编造新能力。

当前摘要:
{{existing_summary}}

材料片段:
{{source_spans_json}}

输出 JSON:
{
  "section_type": "summary",
  "events": [
    {
      "event_type": "custom",
      "title": "专业摘要",
      "description": string,
      "details": {"section_type": "summary"},
      "source_ids": string[],
      "evidence_quotes": string[],
      "status": "draft"
    }
  ],
  "warnings": string[]
}
```

### 8.3 Experience Extractor

Fields:

- title
- organization
- role
- location
- time_start
- time_end
- bullets[]
- skills[]

Prompt user body:

```text
你是工作/实习经历抽取器。只处理工作、实习、兼职角色。一个角色下的项目可以保留为 bullet；如果项目非常独立，也可以在 warnings 中建议 projects extractor 处理。

解析提示:
{{batch_instruction}}

当前已有工作/实习:
{{existing_events_json}}

材料片段:
{{source_spans_json}}

输出 JSON:
{
  "section_type": "experience",
  "events": [
    {
      "event_type": "work | internship",
      "title": string,
      "organization": string | null,
      "role": string | null,
      "location": string | null,
      "time_start": string | null,
      "time_end": string | null,
      "time_precision": "day | month | year | unknown",
      "details": {
        "section_type": "experience",
        "bullets": string[],
        "skills": string[],
        "needs_review_fields": string[]
      },
      "source_ids": string[],
      "evidence_quotes": string[],
      "status": "draft"
    }
  ],
  "warnings": string[]
}

bullet 要保留事实密度，优先包含用户贡献、方法、对象和结果；不要把强 bullet 改写成空泛职责。
```

### 8.4 Project Extractor

Fields:

- title
- role
- organization
- time_start
- time_end
- bullets[]
- tech_stack[]
- url

Prompt user body:

```text
你是项目经历抽取器。只处理具体项目、开源项目、产品、创业项目、研究工程项目。不要把泛泛技能列表当项目。

解析提示:
{{batch_instruction}}

当前已有项目:
{{existing_events_json}}

材料片段:
{{source_spans_json}}

输出 JSON:
{
  "section_type": "projects",
  "events": [
    {
      "event_type": "project | open_source | startup",
      "title": string,
      "role": string | null,
      "organization": string | null,
      "time_start": string | null,
      "time_end": string | null,
      "description": string | null,
      "details": {
        "section_type": "projects",
        "bullets": string[],
        "tech_stack": string[],
        "url": string | null,
        "needs_review_fields": string[]
      },
      "source_ids": string[],
      "evidence_quotes": string[],
      "status": "draft"
    }
  ],
  "warnings": string[]
}
```

### 8.5 Education Extractor

Fields:

- degree
- field
- institution
- time_start
- time_end
- gpa
- honors[]

Prompt user body:

```text
你是教育经历抽取器。只处理学校、学位、专业、GPA、在校荣誉。课程要放入 courses extractor，证书要放入 certifications extractor。

解析提示:
{{batch_instruction}}

当前已有教育:
{{existing_events_json}}

材料片段:
{{source_spans_json}}

输出 JSON:
{
  "section_type": "education",
  "events": [
    {
      "event_type": "education",
      "title": string,
      "organization": string,
      "time_start": string | null,
      "time_end": string | null,
      "details": {
        "section_type": "education",
        "field": string | null,
        "gpa": string | null,
        "honors": string[],
        "needs_review_fields": string[]
      },
      "source_ids": string[],
      "evidence_quotes": string[],
      "status": "draft"
    }
  ],
  "cross_section_hints": [
    {"target_section": "awards", "text": string, "reason": "school honor also belongs in awards"}
  ],
  "warnings": string[]
}
```

### 8.6 Course Extractor

Fields:

- title
- institution
- time_start
- time_end
- url

Prompt user body:

```text
你是课程抽取器。只处理课程、相关 coursework、训练营课程。不要把课程塞进 education.honors 或 skills。

当前已有课程:
{{existing_events_json}}

材料片段:
{{source_spans_json}}

输出 JSON:
{
  "section_type": "courses",
  "events": [
    {
      "event_type": "course",
      "title": string,
      "organization": string | null,
      "time_start": string | null,
      "time_end": string | null,
      "details": {
        "section_type": "courses",
        "url": string | null,
        "needs_review_fields": string[]
      },
      "source_ids": string[],
      "evidence_quotes": string[],
      "status": "draft"
    }
  ],
  "warnings": string[]
}
```

### 8.7 Award And Competition Extractor

Fields:

- title
- issuer
- year
- description
- related_institution

Prompt user body:

```text
你是荣誉、奖项和竞赛抽取器。处理奖学金、优秀学生、比赛奖项、学术/行业荣誉。学校期间荣誉也可以出现在 education.honors 中，但本 section 要单独生成可展示条目。

当前已有荣誉/奖项:
{{existing_events_json}}

材料片段:
{{source_spans_json}}

输出 JSON:
{
  "section_type": "awards",
  "events": [
    {
      "event_type": "award | competition",
      "title": string,
      "organization": string | null,
      "time_end": string | null,
      "description": string | null,
      "details": {
        "section_type": "awards",
        "related_institution": string | null,
        "needs_review_fields": string[]
      },
      "source_ids": string[],
      "evidence_quotes": string[],
      "status": "draft"
    }
  ],
  "warnings": string[]
}
```

### 8.8 Skills Extractor

Fields:

- group title
- skills[]

Prompt user body:

```text
你是技能抽取器。按自然类别整理技能，不要创造过细分类。技能条目必须来自材料，不要凭行业常识补充。

当前已有技能:
{{existing_events_json}}

材料片段:
{{source_spans_json}}

输出 JSON:
{
  "section_type": "skills",
  "events": [
    {
      "event_type": "custom",
      "title": string,
      "details": {
        "section_type": "skills",
        "skills": string[],
        "needs_review_fields": string[]
      },
      "source_ids": string[],
      "evidence_quotes": string[],
      "status": "draft"
    }
  ],
  "warnings": string[]
}
```

### 8.9 Certification Extractor

Fields:

- title
- issuer
- year
- credential_id
- url

Prompt user body:

```text
你是证书抽取器。只处理证书、资格认证、可验证培训证明。普通课程放入 courses。

当前已有证书:
{{existing_events_json}}

材料片段:
{{source_spans_json}}

输出 JSON:
{
  "section_type": "certifications",
  "events": [
    {
      "event_type": "certification",
      "title": string,
      "organization": string | null,
      "time_end": string | null,
      "details": {
        "section_type": "certifications",
        "credential_id": string | null,
        "url": string | null,
        "needs_review_fields": string[]
      },
      "source_ids": string[],
      "evidence_quotes": string[],
      "status": "draft"
    }
  ],
  "warnings": string[]
}
```

### 8.10 Research Extractor

Fields:

- title
- organization
- year
- authors
- url
- description

Prompt user body:

```text
你是论文、专利和研究成果抽取器。处理 publication、patent、research output，不处理普通课程项目。

当前已有论文/专利:
{{existing_events_json}}

材料片段:
{{source_spans_json}}

输出 JSON:
{
  "section_type": "research",
  "events": [
    {
      "event_type": "publication | patent | project",
      "title": string,
      "organization": string | null,
      "time_end": string | null,
      "description": string | null,
      "details": {
        "section_type": "research",
        "authors": string[],
        "url": string | null,
        "needs_review_fields": string[]
      },
      "source_ids": string[],
      "evidence_quotes": string[],
      "status": "draft"
    }
  ],
  "warnings": string[]
}
```

### 8.11 Language Extractor

Fields:

- language
- proficiency

Prompt user body:

```text
你是语言能力抽取器。只抽取语言和熟练度，不要把编程语言放入这里。

当前已有语言:
{{existing_events_json}}

材料片段:
{{source_spans_json}}

输出 JSON:
{
  "section_type": "languages",
  "events": [
    {
      "event_type": "language",
      "title": string,
      "details": {
        "section_type": "languages",
        "proficiency": string | null,
        "needs_review_fields": string[]
      },
      "source_ids": string[],
      "evidence_quotes": string[],
      "status": "draft"
    }
  ],
  "warnings": string[]
}
```

## 9. Layer 3: Event-Level Duplicate Detection And Merge

### Purpose

Layer 3 works inside one section at a time. It compares newly extracted events with existing events and with other newly extracted events.

The UI does not show this layer.

### First-Pass Deterministic Match

Use normalized keys before calling AI:

- experience: normalized organization + title + overlapping dates
- project: normalized title + organization/role
- education: institution + degree + field
- course: title + institution
- award: title + issuer/year
- certification: title + issuer
- skills: group title
- language: language title

### AI Pair Merge Prompt

Only call AI when deterministic matching says two events are likely related but not exactly identical.

System:

```text
你是职业档案事件合并器。你只接收两个同 section 的事件，判断它们是否描述同一个真实经历。

如果是同一个事件，合并成一个更完整、更准确的事件。
如果不是同一个事件，返回 keep_both。

不要编造任何新事实。不要降低 bullet 的信息密度。保留所有 source_ids 和关键 evidence_quotes。
输出 JSON。
```

User:

```text
section_type: {{section_type}}
field_contract:
{{section_field_contract}}

Event A:
{{event_a_json}}

Event B:
{{event_b_json}}

输出:
{
  "decision": "merge | keep_both",
  "confidence": number,
  "merged_event": object | null,
  "reason": string,
  "warnings": string[]
}
```

### Confirmed Event Policy

For first implementation:

- Draft events may be auto-updated.
- Confirmed events are not overwritten silently.
- If a new event matches a confirmed event, attach source/evidence and only add clearly missing non-conflicting fields.
- Conflicting fields should create an event update patch, not silently overwrite the confirmed event.

## 10. Event Update Diff And Undo

### Purpose

When new material updates an existing event, the user should see a simple field-level diff, not an internal merge queue. The right-side profile remains the main surface.

User-visible behavior:

```text
Existing event remains visible
-> event shows "有更新建议"
-> click opens a diff modal
-> user accepts, rejects, edits manually, or leaves it for later
```

### Patch Object

Use an internal `EventUpdatePatch` model or metadata-backed equivalent in the first implementation.

```json
{
  "id": "patch_123",
  "event_id": "evt_123",
  "source_ids": ["src_123"],
  "status": "pending | accepted | rejected | reverted",
  "patch_type": "update_event",
  "before": {},
  "after": {},
  "diff": [
    {
      "field": "details.bullets",
      "change_type": "add | remove | replace",
      "old_value": null,
      "new_value": "支持项目、任务、人员信息的自然语言查询与可视化报告生成。"
    }
  ],
  "reason": "新上传的项目说明补充了技术栈和结果描述"
}
```

### When To Create A Patch

- New event: create `CareerEvent(status="draft")`, no diff needed.
- Exact duplicate: skip or attach evidence, no diff needed.
- Draft event with low-risk additions: auto-apply but save reversible patch history.
- Confirmed event: create pending diff patch; do not overwrite silently.
- Likely duplicate with meaningful differences: create pending diff patch.

### Diff Display

The frontend should display field-level changes, not code-style line diffs:

```text
要点
+ 支持项目、任务、人员信息的自然语言查询与可视化报告生成。
~ 将“提升效率”改为“提升信息检索与决策效率”。

技能
+ LangGraph
+ Tool Calling
```

Actions:

- Accept: apply `after` to the event and mark patch `accepted`.
- Reject: keep current event and mark patch `rejected`.
- Edit manually: open event editor with suggested fields prefilled.
- Undo accepted update: restore `before` snapshot and mark patch `reverted`.

## 11. Data Model Direction

First implementation should avoid adding too many permanent tables. Use existing `SourceMaterial`, `BackgroundJob`, `CareerEvent`, `Claim`, and `Evidence`.

Recommended additions:

### `SourceMaterial.metadata_json`

Store:

- `parse_batch_id`
- `content_hash`
- `ingestion_warnings`
- `section_map`

### `BackgroundJob.payload`

Store:

- `parse_batch_id`
- `instruction`
- `source_ids`
- `pipeline_stage`

### `CareerEvent.details_json`

Store:

- `section_type`
- `section_title`
- `source_ids`
- `canonical_key`
- `needs_review_fields`
- `open_questions`
- `pending_patch_ids`
- `last_applied_patch_id`

### `EventUpdatePatch`

For the first version this can be stored as JSON in a lightweight table or as metadata attached to the event. If update suggestions become central to the UI, promote it to a real table with:

- id
- user_id
- event_id
- source_ids
- status
- before_json
- after_json
- diff_json
- reason
- created_at
- applied_at
- reverted_at

Later, if this grows, split into real `ParseBatch`, `SourceSectionMap`, `ExtractedEvent`, and `EventUpdatePatch` tables.

## 12. Implementation Phases

### Phase 1: Section Schema Registry

- Add `vault_section_schema.py`.
- Define section fields, meanings, output paths, dedupe fields, and prompt rendering helpers.
- Make prompt builders consume schema output instead of hand-written field blocks.

### Phase 2: Prompt Boundary And Internal Types

- Add internal schemas for layer 1 and layer 2 outputs.
- Keep persistence mostly unchanged.
- Add prompt builders for source detection and section extraction.
- Add deterministic normalizers and canonical keys.

### Phase 3: Single-Source Layer 1

- Convert each file/text/url into independent SourceMaterial.
- Run source-level detection per source.
- Store section_map in SourceMaterial metadata.

### Phase 4: Section Extractors

- Group source spans by section.
- Implement extractors for profile, summary, experience, projects, education, courses, awards, skills first.
- Keep certifications, research, languages available but lower priority.

### Phase 5: Event-Level Dedup And Patches

- Add deterministic duplicate detection.
- Add AI pair merge only for likely duplicates.
- Ensure repeated same resume upload does not duplicate work/project/education/course events.
- Generate field-level update patches for confirmed events and risky updates.

### Phase 6: UX Cleanup

- Keep the user flow unchanged: input -> parse -> right side profile.
- Show only high-level status: parsing, failed, completed.
- Show update suggestions only as simple event-level diff badges and modals.
- Do not expose source maps, candidates, merge decisions, or conflict queues.

## 13. Evaluation Fixtures

Required test fixtures:

- same resume uploaded twice
- resume plus transcript where education overlaps and transcript adds courses
- resume plus project note where project details should enrich existing project
- school honors that must appear in education.honors and awards
- link that fails to fetch
- text material with AI instruction “only parse courses”
- confirmed event updated by new source creates pending diff patch instead of silent overwrite
- accepted patch can be reverted to the before snapshot

Pass conditions:

- No duplicate events after repeated identical input.
- Courses are not stored as skills or education description.
- School honors remain inside education and also appear in awards.
- User-facing status remains simple.
- Existing right-side profile rendering continues to work.
- Confirmed events are not silently overwritten.
- User can accept/reject/revert AI update suggestions.

## 14. Immediate Next Task

Implement the backend schema registry first:

```text
vault_section_schema.py
schema-driven prompt rendering
schema-driven output shape
schema-driven canonical key fields
```

Then implement the pipeline skeleton:

```text
source detection prompt
section extractor prompt registry
section span grouping
canonical key generation
deterministic duplicate skip
```

Do not redesign the Vault UI in this phase.
