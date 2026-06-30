# Vault Intake + AI Profile Builder Design

Date: 2026-06-30
Status: Draft for user review
Scope: 输入材料 -> AI 拆解 -> Section/Event 展示 -> 弹窗编辑 -> 确认职业档案

## Product Goal

第一阶段不做完整简历生成，也不做复杂岗位匹配。核心目标是让用户把任意职业材料交给 AI，系统自动整理成可编辑、可确认、可复用的职业资产库。

理想体验：

```text
用户输入文字 / 上传文件 / 粘贴链接
  -> AI 识别材料类型并抽取职业信息
  -> 右侧按 section 分类展示 event
  -> 用户点击 event 打开弹窗修改
  -> 用户确认、删除或新增 event
  -> confirmed event 成为后续 agent / 简历 / 面试 / 求职材料的事实来源
```

## Non-Goals

- 本阶段不实现完整简历生成器。
- 本阶段不实现多 provider 切换，OpenAI first。
- 本阶段不实现浏览器插件和外部平台自动抓取。
- 本阶段不把 JD 要求混入用户职业经历。JD 只能作为 job target 单独解析。
- 本阶段不要求所有文件都直接传给 OpenAI。可以先抽文本，但数据模型保留文件和 evidence 位置。

## Core Page

主页面使用现有 `/vault`，但重构为双栏工作台。

### Left: Unified AI Input

左侧是统一输入区，而不是多个分散入口。

功能：

- 大文本框：支持粘贴简历、项目记录、经历描述、面试复盘、求职材料。
- URL 输入：支持粘贴个人主页、项目链接、BOSS/拉勾/猎聘等岗位链接或材料链接。第一阶段只保存 URL 和用户粘贴文本，不保证自动抓取全部网页。
- 文件上传：支持 PDF、DOCX、TXT、MD、PNG、JPG。
- 附加说明：用户可以写“这是我的实习经历”“这是一个项目复盘”“这是一段岗位 JD”。
- CTA：`解析并整理`。

左侧提交后：

1. 创建 `SourceMaterial`。
2. 创建 `BackgroundJob(type=source_parse)`。
3. UI 显示解析中状态。
4. 右侧自动刷新 draft events。

### Right: Sectioned Career Profile

右侧展示 AI 解析后的职业档案，按 section 分组。

默认 sections：

- 工作经历
- 项目经历
- 教育背景
- 奖项证书
- 研究/论文
- 开源/作品
- 技能与偏好
- 自定义

Section 行为：

- 每个 section 可折叠。
- 每个 section 可新增 event。
- 空 section 显示轻量空状态。
- 后续允许用户新增自定义 section。

Event 卡片：

- 显示 event type、title、organization、role、time range、status、confidence。
- 显示 claim 数量和 evidence 状态。
- 点击卡片打开编辑弹窗。
- 支持快速删除。
- draft / needs_review / confirmed 使用不同状态标记。

## Event Edit Modal

Event 弹窗是本阶段最重要的编辑界面。

字段：

- title
- event_type
- section_type
- role
- organization
- location
- time_start
- time_end
- time_precision
- description
- details.context
- details.contribution
- details.implementation
- details.outcome
- tags
- visibility
- status

Claims 区：

- claim_text
- claim_type
- strength
- visibility
- linked evidence quote
- 支持新增、编辑、删除 claim

Evidence 区：

- quote
- source title
- locator_json：page、url、file_path、text_offset、image_region 等
- confidence

操作：

- 保存修改
- 确认 event
- 标记需要补充
- 删除 event
- 关闭不保存

## Data Model

现有模型方向基本正确，第一阶段优先复用：

- `SourceMaterial`
- `CareerEvent`
- `Claim`
- `Evidence`
- `BackgroundJob`
- `Profile`

需要补强的点：

1. `CareerEvent.details_json` 必须规范化，至少支持：

```json
{
  "context": "",
  "contribution": "",
  "implementation": "",
  "outcome": "",
  "open_questions": [],
  "needs_review_fields": []
}
```

2. `Claim` 当前缺少直接 evidence 字段，但可以通过 `Evidence.claim_id` 关联。

3. `SourceMaterial.metadata_json` 用来保存：

```json
{
  "source_subtype": "resume | jd | project_note | certificate | screenshot | profile_page | mixed | unknown",
  "input_hint": "",
  "ai_warnings": [],
  "parse_model": "gpt-4.1-mini"
}
```

4. 需要建立 section 映射，但暂不新增表。先由 `event_type` 映射到 section：

```text
work, internship -> 工作经历
project, startup -> 项目经历
education, course -> 教育背景
award, certification, competition -> 奖项证书
publication, patent, research -> 研究/论文
open_source -> 开源/作品
language, custom preference claims -> 技能与偏好 / 自定义
```

如果之后用户需要真正自定义 section 排序，再新增 `ProfileSection` 表。

## AI Pipeline

Provider：OpenAI first。

第一阶段调用方式：

- 文本和已抽取文件内容：走 Chat Completions / Responses 的 JSON schema 输出。
- 图片：可以先走 OpenAI vision；如果未配置或失败，保存 source 并标记 `needs_review`。
- PDF/DOCX：先用本地抽文本，保留后续直接文件输入的扩展位。

### Pipeline Steps

```text
SourceMaterial uploaded
  -> classify source
  -> parse sections/events/claims/evidence
  -> validate output
  -> persist draft events
  -> persist claims and evidence
  -> update parse_status
```

### AI Output Contract

AI 必须返回 JSON object：

```json
{
  "source_type": "resume",
  "source_subtype": "resume",
  "language": "zh-CN",
  "sections": [
    {
      "section_type": "work",
      "section_title": "工作经历",
      "events": [
        {
          "event_type": "internship",
          "title": "增长产品实习",
          "role": "产品实习生",
          "organization": "字节跳动",
          "location": "北京",
          "time_start": "2024-06",
          "time_end": "2025-03",
          "time_precision": "month",
          "description": "负责增长实验与数据分析相关工作。",
          "details": {
            "context": "业务需要提升转化效率。",
            "contribution": "参与实验设计、数据分析和策略复盘。",
            "implementation": "使用 A/B 测试、SQL 和指标看板分析实验结果。",
            "outcome": "具体提升幅度需用户确认。",
            "open_questions": ["转化率提升幅度是否有明确数据？"],
            "needs_review_fields": ["outcome"]
          },
          "claims": [
            {
              "claim_text": "参与增长实验设计与数据分析。",
              "claim_type": "responsibility",
              "strength": "confirmed",
              "evidence_quote": "原文中支持该 claim 的片段",
              "confidence": 0.84
            }
          ],
          "evidence": [
            {
              "quote": "原文片段",
              "locator": {
                "page": 1,
                "text_offset": null,
                "url": null
              },
              "confidence": 0.84
            }
          ],
          "status": "draft",
          "confidence": 0.84
        }
      ]
    }
  ],
  "warnings": [
    "部分指标缺少原文证据，已标记 needs_review。"
  ]
}
```

### AI Guardrails

- 不得编造公司、学校、日期、指标、奖项、证书。
- 不得把 JD 里的岗位要求当成用户经历。
- 如果来源像 JD，只输出 `warnings`，不生成用户 CareerEvent，除非文本明确包含用户自己的经历。
- 每个 claim 尽量提供 `evidence_quote`。
- 没有证据的 claim 必须标记 `weak` 或加入 `needs_review_fields`。
- 事件要拆小：一个工作经历里多个项目可以拆成多个 project events，并用 `details` 说明关系。
- 所有存储字段默认中文，专业术语可保留英文缩写。

## API Design

Reuse and extend existing endpoints.

### Sources

- `POST /api/vault/sources`
  - 输入 text、urls、input_hint。
  - 返回 source_id、job_id。

- `POST /api/vault/sources/upload`
  - 上传文件。
  - 返回 source_id、job_id。

- `GET /api/vault/sources`
  - 返回 source 列表和 parse_status。

- `GET /api/vault/sources/{source_id}`
  - 返回 source 详情、raw_text preview、metadata、warnings。

### Events

- `GET /api/vault/events?status=&section=`
  - 返回按 section 分组的 events。

- `POST /api/vault/events`
  - 手动新增 event。

- `PATCH /api/vault/events/{event_id}`
  - 更新 event 字段和 details_json。

- `POST /api/vault/events/{event_id}/confirm`
  - 标记 confirmed。

- `DELETE /api/vault/events/{event_id}`
  - 删除 event，同时处理 claims/evidence。

### Claims

- `POST /api/vault/claims`
- `PATCH /api/vault/claims/{claim_id}`
- `DELETE /api/vault/claims/{claim_id}`

### Jobs

- `GET /api/jobs/{job_id}`
  - 查询 source_parse job 状态。

## Frontend Implementation

Primary route: `/vault`

State layout:

```text
VaultPage
  SourceInputPanel
  SectionedProfilePanel
    ProfileSection
      EventCard
  EventEditModal
```

Important UI behavior:

- 提交材料后，左侧保持输入历史和解析状态。
- 右侧轮询 job 或 sources/events，直到 draft events 出现。
- Event modal 使用本地 form state，保存时 PATCH。
- 删除操作需要轻量确认。
- 如果 OpenAI key 未配置，输入区显示设置引导。

Visual style:

- 使用清新现代的浅色工作台风格。
- 保留左侧窄导航和大圆角工作区。
- 卡片使用柔和色块区分 section，但避免沉闷大面积深色。
- 页面语言以中文为主。

## Dashboard Role

`/dashboard` 不作为主操作页。它只展示真实状态：

- 待解析材料数量
- 待确认 events 数量
- 已确认 events 数量
- 最近一次解析状态
- 快捷入口：进入职业档案

不要放没有真实数据来源的搜索框、添加岗位按钮或演示卡片。

## Error Handling

- OpenAI key 缺失：source 可保存，job 标记 failed，错误信息提示去 settings 配置。
- OpenAI 返回非 JSON：job failed，source parse_status failed，保留原文。
- 部分字段缺失：event 仍保存为 draft，缺失字段进入 needs_review_fields。
- 文件无法抽文本：source 保存，parse_status failed 或 needs_review，允许用户手动补充文字。
- 图片无法识别：source 保存，不阻塞其他输入。

## Testing

Backend:

- prompt output parser unit tests。
- source create creates BackgroundJob。
- AI parse result persists CareerEvent, Claim, Evidence。
- JD-like input does not create user events。
- event update / delete / confirm endpoints。
- API key never returned to frontend。

Frontend:

- `/vault` renders input panel and grouped sections。
- submitting text creates source/job。
- draft event card opens modal。
- modal save calls PATCH。
- confirm/delete update UI。
- settings missing key state renders correctly。

Manual acceptance:

1. 登录后进入 `/vault`。
2. 粘贴一段简历文字，点击解析。
3. 右侧出现按 section 分组的 draft events。
4. 点击 event 打开弹窗。
5. 修改字段、增加 claim、保存。
6. 确认 event。
7. 刷新页面后 confirmed event 仍然存在。

## Implementation Order

1. Backend schema contract
   - Update `parse_prompts.py` to new JSON contract.
   - Add parser/normalizer helper for AI output.

2. Backend persistence
   - Update `ai_worker.py` to persist sections/events/claims/evidence.
   - Store warnings in `SourceMaterial.metadata_json`.
   - Add tests.

3. API cleanup
   - Ensure events endpoint returns section-grouped payload.
   - Finish claim PATCH/DELETE and event DELETE if missing.
   - Resolve duplicate job route conflicts.

4. Frontend `/vault`
   - Replace current page with left input + right sectioned profile.
   - Add event cards.
   - Add modal editor.

5. Frontend status handling
   - Poll parse job/source status.
   - Add OpenAI key missing state.
   - Add empty states.

6. Verification
   - Backend tests.
   - Frontend type check.
   - Manual browser flow.

## Product Decisions

1. Keep `/vault` as the route, but rename the visible navigation label to `职业档案`.
2. For images, try OpenAI vision when an API key is available. If vision parsing fails, keep the source and ask the user to add text manually.
3. `confirmed` always requires a user action. High-confidence AI output may be visually marked as reliable, but it still remains `draft` until confirmed.
