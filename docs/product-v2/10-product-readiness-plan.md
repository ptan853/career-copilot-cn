# Product V2 Readiness Plan

## 目标定义

当前 Product V2 处在 skeleton / alpha foundation 阶段：页面、模型、部分 API 已经存在，但还没有形成用户可以稳定完成任务的产品闭环。

真正可以使用的产品分两层：

- Alpha usable：你自己或小范围用户可以真实导入经历、确认档案、创建目标岗位、生成一版材料。
- Beta usable：外部用户可以注册登录、长期保存数据、导出材料、跟踪申请，失败时有可恢复路径。

不要先追求所有页面都完整。优先做一条能跑通的主链路：

```text
登录/进入产品
-> Vault 统一输入
-> Source 保存与解析
-> Event Review
-> 确认后的 Career Profile
-> 创建 Job Target
-> JD 分析与 Evidence Map
-> 生成 Resume/Cover Letter
-> Editor 修改
-> Export
-> Tracker/Interview Prep
```

## 当前已具备

- `apps/web` 已有 V2 页面骨架：Dashboard、Vault、Review、Jobs、Job Detail、Evidence、Generate、Editor、Prep、Tracker。
- `apps/api` 已有 V2 后端基础：auth、core、vault、vault_sources、vault_events。
- `apps/api/models/__init__.py` 已有较完整的数据模型。
- `docs/product-v2` 已有产品策略、页面结构、API、AI pipeline、mockup。
- 本地前端页面和后端端点可以启动验证。

## 当前缺口

### 1. Auth 和用户数据隔离还不是产品级

真正可用产品必须先回答：

```text
谁在使用产品？
这份 source/event/job/artifact 属于谁？
未登录用户能不能访问？
用户 A 会不会看到用户 B 的数据？
```

这是所有后续功能的基础。

### 2. 产品还没有主链路闭环

现在页面和 API 分散存在，但用户还不能稳定完成：

```text
输入材料 -> 自动生成待确认事件 -> 编辑确认 -> 用这些事件生成求职材料
```

这是最核心缺口。

### 3. AI pipeline 还没有产品化

需要实现产品自己的 pipeline，而不是直接绑定现有 skill：

- source classification
- text extraction
- event candidate extraction
- field normalization
- confidence scoring
- duplicate detection
- review queue creation
- confirmed profile update

`career-timeline` 和 `career-application` 只作为参考，不作为当前 runtime 依赖。

### 4. UI 还没有统一设计系统

当前 UI 能看，但还不是成熟产品级：

- 没有统一组件库边界
- 没有统一表单、弹窗、按钮、状态 badge、空状态
- 没有统一中文文案管理
- 没有明确 loading/error/success 状态规范

### 5. Auth 还不是生产可用

当前 auth 是开发级：

- 验证码还没有真实 provider、过期、限流、尝试次数控制
- 密码校验不完整
- Google OAuth 尚未接入
- dev fallback user 风险
- session/token 行为需要明确

### 6. 生成和编辑还停留在 demo

Generate、Editor、Prep、Tracker 还没有真正基于用户数据工作。

### 7. 数据库和部署还没产品化

缺少：

- migration
- seed/dev data 策略
- 数据导出/删除
- 后台 job 状态
- 错误日志和重试
- 基础安全边界

## 阶段计划

## Phase 0: Stabilize And Freeze Baseline

目标：先把当前成果固定住，避免继续在混乱状态上叠功能。

必须实现：

- 整理 git working tree。
- 明确哪些是 V2 正式文件，哪些是 prototype。
- 确认前端所有页面可访问。
- 确认后端所有 router 可注册。
- 移除或忽略本地数据库、缓存等不该提交的产物。

涉及文件：

- `docs/product-v2/**`
- `docs/superpowers/plans/**`
- `apps/web/**`
- `apps/api/**`
- `.gitignore`

验收标准：

- `npm run build` 在 `apps/web` 通过。
- `uv run python -m compileall .` 在 `apps/api` 通过。
- `GET /api/health` 返回 `{"status":"ok"}`。
- `git status --short` 中没有无法解释的临时文件。

## Phase 1: Auth And User Data Foundation

目标：先建立账号体系和数据隔离，避免后续 Vault、Job、Artifact 数据全部变成无主数据。

必须实现：

- 手机号验证码登录/注册。
- 邮箱验证码登录/注册。
- email/password signup/login。
- Google OAuth login/signup。
- logout。
- `/api/auth/me`。
- password hashing。
- verification code expiry/rate limit。
- token/session 持久化。
- 前端 protected route。
- 登录后跳转 dashboard。
- 未登录访问私有页面跳转 login。
- API 使用 current user 过滤数据。
- dev fallback user 只能在明确开发模式启用。

涉及文件：

- `apps/api/routers/auth.py`
- `apps/api/auth_deps.py`
- `apps/api/models/__init__.py`
- `apps/api/services/verification_codes.py`
- `apps/api/services/message_delivery.py`
- `apps/api/services/google_oauth.py`
- `apps/web/app/login/page.tsx`
- `apps/web/app/signup/page.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/components/app-shell.tsx`
- `apps/web/lib/api-client.ts`
- `apps/web/lib/auth.ts`
- `apps/web/middleware.ts`

验收标准：

- 用户可以用手机号验证码注册/登录。
- 用户可以用邮箱验证码注册/登录。
- 用户可以用 email/password 注册/登录。
- 用户可以用 Google 注册/登录。
- 用户可以退出。
- 刷新页面后仍能通过 `/api/auth/me` 获取当前用户。
- 未登录访问 `/dashboard`、`/vault`、`/jobs` 会跳转到 `/login`。
- 已登录访问 `/login` 会跳转到 `/dashboard`。
- 密码不明文存储。
- 用户 A 不能读取用户 B 的 source/event/job/artifact。
- `npm run build` 和 `uv run python -m compileall .` 通过。

## Phase 2: Product UI Foundation

目标：先建立产品级 UI 基础，再继续写页面功能。

必须实现：

- shadcn 风格 UI primitives。
- 统一 design tokens。
- 统一 AppShell。
- 统一 PageHeader、SectionHeader、EmptyState、StatusBadge。
- 统一 Dialog/Drawer/Form/Table/Tabs。
- 统一中文 copy 文件。

涉及文件：

- `apps/web/app/globals.css`
- `apps/web/tailwind.config.js`
- `apps/web/components/app-shell.tsx`
- `apps/web/components/ui/*`
- `apps/web/components/layout/*`
- `apps/web/lib/product-copy.ts`

验收标准：

- 所有页面使用同一套基础组件。
- 页面不再散落大量一次性按钮、badge、输入框样式。
- 修改主色、圆角、密度、中文文案时，不需要逐页搜索替换。
- `npm run build` 通过。

## Phase 3: Vault Main Loop

目标：完成第一个真正可用闭环。

用户能力：

- 用户可以在 Vault 粘贴文本。
- 用户可以上传文件。
- 用户可以输入 LinkedIn/profile URL 作为 source。
- 系统创建 source record。
- 系统创建 background job 或同步 fallback extraction。
- 系统生成 pending career events。
- 用户可以按 section 查看 events。
- 用户可以点开 event dialog 编辑固定字段。
- 用户可以添加自定义字段。
- 用户可以 confirm/archive event。

后端必须实现：

- `POST /api/vault/sources/text`
- `POST /api/vault/sources/upload`
- `POST /api/vault/sources/url`
- `GET /api/vault/sources`
- `GET /api/vault/events`
- `GET /api/vault/review`
- `PATCH /api/vault/events/{event_id}`
- `POST /api/vault/events/{event_id}/confirm`
- `POST /api/vault/events/{event_id}/archive`
- `apps/api/services/event_extraction.py`

前端必须实现：

- Vault unified input。
- Source list。
- Source status。
- Event grouped sections。
- Event edit dialog。
- Review queue。

涉及文件：

- `apps/api/routers/vault_sources.py`
- `apps/api/routers/vault_events.py`
- `apps/api/routers/vault.py`
- `apps/api/services/event_extraction.py`
- `apps/web/app/vault/page.tsx`
- `apps/web/app/vault/review/page.tsx`
- `apps/web/components/vault/*`
- `apps/web/lib/api-client.ts`

验收标准：

- 粘贴一段经历文本后，数据库生成 1 条 `SourceMaterial`。
- 同一次操作生成至少 1 条 `CareerEvent(review_state="pending")`。
- Review 页面出现该 event。
- 点击 event 打开 dialog。
- 修改标题、组织、日期、描述后保存成功。
- confirm 后 event 从 pending 变为 confirmed。
- archive 后 event 不再出现在 active review queue。

## Phase 4: Profile, Claims, Evidence Map

目标：把确认后的 events 变成生成材料可用的职业资产。

用户能力：

- 看到结构化 Career Profile。
- 每个 section 显示 confirmed events。
- 空字段也可见并可编辑。
- 用户可以新增 custom section。
- 用户可以为 event 添加 claim。
- 用户可以为 claim 绑定 evidence。
- 用户可以看到 profile readiness。

后端必须实现：

- confirmed event -> profile section aggregation。
- claim CRUD。
- evidence CRUD。
- profile readiness calculation。

前端必须实现：

- Profile section view。
- Claim editor。
- Evidence panel。
- Readiness panel。

涉及文件：

- `apps/api/routers/vault.py`
- `apps/api/routers/vault_events.py`
- `apps/web/app/evidence/page.tsx`
- `apps/web/components/vault/*`
- `apps/web/components/evidence/*`

验收标准：

- confirmed event 自动进入对应 section。
- 用户可以创建 claim。
- claim 可以关联到 event。
- Evidence Map 能显示 matched/missing/weak evidence。

## Phase 5: Job Target And JD Analysis

目标：让用户可以围绕具体岗位组织材料。

用户能力：

- 创建 Job Target。
- 粘贴 JD。
- 保存公司、职位、地点、链接、状态。
- 系统抽取 JD requirements。
- 系统展示 match score。
- 系统展示 matched evidence 和 missing evidence。

后端必须实现：

- `POST /api/jobs`
- `GET /api/jobs`
- `GET /api/jobs/{job_id}`
- `PATCH /api/jobs/{job_id}`
- `POST /api/jobs/{job_id}/analyze`
- `GET /api/jobs/{job_id}/evidence-map`
- `apps/api/services/jd_analysis.py`
- `apps/api/services/evidence_mapping.py`

前端必须实现：

- Jobs list。
- Job create dialog。
- Job detail。
- JD analysis panel。
- Evidence map panel。

涉及文件：

- `apps/api/routers/core.py` 或新增 `apps/api/routers/jobs.py`
- `apps/api/services/jd_analysis.py`
- `apps/api/services/evidence_mapping.py`
- `apps/web/app/jobs/page.tsx`
- `apps/web/app/jobs/[id]/page.tsx`
- `apps/web/app/evidence/page.tsx`
- `apps/web/lib/api-client.ts`

验收标准：

- 用户可以创建一个目标岗位。
- 粘贴 JD 后生成 requirements。
- Evidence Map 能用 confirmed events/claims 匹配 JD。
- 页面明确显示缺什么经历或证据。

## Phase 6: Generation Planning And Artifact Creation

目标：从“直接生成文档”改成“先生成计划，再生成材料”。

用户能力：

- 选择 job target。
- 选择 artifact type：resume、cover letter、interview brief。
- 看到生成计划。
- 用户可以批准或调整计划。
- 系统生成 artifact draft。
- artifact 自动进入 Editor。

后端必须实现：

- `GET /api/jobs/{job_id}/generation-plan`
- `POST /api/artifacts`
- `GET /api/artifacts`
- `GET /api/artifacts/{artifact_id}`
- `POST /api/artifacts/{artifact_id}/versions`
- `apps/api/services/application_planning.py`
- `apps/api/services/artifact_generation.py`

前端必须实现：

- Generate page 使用真实 job/context。
- Generation plan review。
- Artifact type controls。
- Generate loading/error/success。
- Artifact list。

涉及文件：

- `apps/api/routers/artifacts.py`
- `apps/api/services/application_planning.py`
- `apps/api/services/artifact_generation.py`
- `apps/web/app/generate/page.tsx`
- `apps/web/app/editor/page.tsx`
- `apps/web/lib/api-client.ts`

验收标准：

- 用户选择 job 后能看到基于 evidence 的生成计划。
- 点击生成后创建 artifact。
- Editor 能打开该 artifact。
- artifact 版本可保存。

## Phase 7: Editor And Export

目标：让生成结果能真正用于投递。

用户能力：

- 在 Editor 修改 resume/cover letter。
- 看到结构化 section。
- 使用 AI edit assistant。
- 预览 A4/PDF 样式。
- 导出 PDF、Markdown、TXT。
- 保留版本历史。

后端必须实现：

- artifact versioning。
- export file creation。
- export metadata。

前端必须实现：

- Editor document canvas。
- Section editor。
- AI edit sidebar。
- Version history。
- Export controls。

涉及文件：

- `apps/api/routers/artifacts.py`
- `apps/api/services/export_service.py`
- `apps/web/app/editor/page.tsx`
- `apps/web/components/editor/*`

验收标准：

- 用户能编辑并保存 artifact。
- 用户能导出 PDF。
- 用户能回到旧版本。
- 导出的文件内容与当前版本一致。

## Phase 8: Interview Prep And Application Tracker

目标：完成求职闭环。

用户能力：

- 为 job 创建 application。
- 维护 application status。
- 根据 JD 和最终 resume 生成 interview prep。
- 生成 STAR answers。
- 面试后记录复盘。

后端必须实现：

- application CRUD。
- application status machine。
- interview prep generation。
- interview round records。

前端必须实现：

- Tracker board/table。
- Application detail。
- Interview prep page。
- STAR answer editor。

涉及文件：

- `apps/api/routers/applications.py`
- `apps/api/routers/interview.py`
- `apps/api/services/interview_prep.py`
- `apps/web/app/tracker/page.tsx`
- `apps/web/app/prep/page.tsx`

验收标准：

- 用户可以把 job 标记为 applied/interview/offer/rejected。
- Interview Prep 使用该 job 的 JD 和 artifact。
- 用户可以保存面试问题和答案。

## Phase 9: Data Safety And SaaS Basics

目标：在 Auth Foundation 之上补齐外部用户可用所需的数据安全和 SaaS 基础。

必须实现：

- database migration。
- privacy export。
- account deletion。
- background job retry。
- error logging。
- rate limiting。

涉及文件：

- `apps/api/routers/auth.py`
- `apps/api/auth_deps.py`
- `apps/api/database.py`
- `apps/api/alembic/*`
- `apps/web/app/login/page.tsx`
- `apps/web/app/signup/page.tsx`
- `apps/web/lib/api-client.ts`

验收标准：

- 新用户注册后只能看到自己的数据。
- 未登录用户不能访问私有 API。
- 数据库 schema 可通过 migration 创建。
- 用户可以导出和删除自己的数据。

## Phase 10: Production QA And Deployment

目标：让产品可以稳定部署和演示。

必须实现：

- backend unit tests。
- frontend build checks。
- API contract smoke tests。
- Playwright happy path tests。
- seed demo user。
- deployment environment variables。
- health checks。
- error boundary。

关键测试路径：

```text
signup
-> create vault source
-> review event
-> create job
-> analyze JD
-> generate artifact
-> edit artifact
-> export
-> update tracker
```

验收标准：

- 一条 Playwright 测试能跑完整 happy path。
- 后端关键服务有单元测试。
- 部署环境能通过 health check。
- 演示数据可以一键初始化。

## 推荐实现顺序

### Milestone 1: Auth + App Foundation

先做账号体系、数据隔离和产品 UI 基础。

任务顺序：

1. Phone/email verification code auth。
2. Email/password signup/login。
3. Google OAuth。
4. Logout and `/me`。
5. Password hashing。
6. Protected routes。
7. API user scoping。
8. UI foundation。
9. Copy registry。

完成后，所有后续数据都有明确 owner，产品可以安全推进 Vault。

### Milestone 2: Vault Core

只做一件事：Vault 主链路真实可用。

任务顺序：

1. Typed API client。
2. Unified text input。
3. Event extraction fallback。
4. Review queue。
5. Event edit dialog。
6. Confirm/archive。

完成后，产品可以证明核心差异化：把用户的经历材料变成可维护的职业档案。

### Milestone 3: Job-Aware Generation

任务顺序：

1. Job CRUD。
2. JD analysis fallback。
3. Evidence map。
4. Generation plan。
5. Artifact draft。
6. Editor basic save。

完成后，产品可以证明求职价值：根据目标岗位生成材料。

### Milestone 4: Submission Ready

任务顺序：

1. Editor polish。
2. PDF export。
3. Version history。
4. Application tracker。
5. Interview prep。

完成后，产品可以支持真实投递。

### Milestone 5: External Beta

任务顺序：

1. Migration。
2. User scoping audit。
3. Privacy/export/delete。
4. Tests。
5. Deployment。

完成后，产品可以给外部用户试用。

## 最小可用 Alpha 的验收清单

Alpha 不要求所有页面完整，但必须满足：

- 用户能进入产品工作台。
- 用户能用手机号验证码注册、登录、退出。
- 用户能用邮箱验证码注册、登录、退出。
- 用户能用 Google 注册、登录、退出。
- 未登录用户不能进入私有工作台页面。
- 所有 source/event/job/artifact 都属于当前用户。
- 用户能粘贴一段经历文本。
- 系统能创建 source。
- 系统能生成 pending event。
- 用户能编辑 event。
- 用户能 confirm event。
- confirmed event 能进入 profile/evidence context。
- 用户能创建 job target。
- 用户能粘贴 JD。
- 系统能显示 matched/missing evidence。
- 用户能生成一版 resume draft。
- 用户能在 editor 修改并保存。

如果这条链路没有跑通，继续做 Interview Prep、Tracker、Extension、Billing 都是过早。

## 下一步立即执行

建议下一步只执行 Milestone 1，不要同时推进所有模块。

第一批具体任务：

1. 完成 `docs/product-v2/feature-specs/01-auth-foundation.md`。
2. 实现手机号/邮箱验证码 request + verify。
3. 实现 email/password signup/login。
4. 实现 Google OAuth start/callback。
5. 实现 logout 和 `/api/auth/me`。
6. 实现前端 route guard。
7. 审计 Vault/Job/Artifact API 的 user scoping。
8. 确认 `npm run build` 和 `uv run python -m compileall .` 通过。

这批完成后，再进入 Vault Main Loop。
