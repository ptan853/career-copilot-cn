# Career Copilot CN — 开发计划与验收标准

## 一、整体节奏

共 4 个 Phase，每个 Phase 2-3 周。每个 Phase 结束后，功能是可用的、可验收的。

```
Phase 0: 基础架构   (第 1-2 周) → 能跑通上传→解析→展示的流程
Phase 1: 核心闭环   (第 3-5 周) → 能跑通岗位→生成→导出的流程
Phase 2: 产品化     (第 6-8 周) → 编辑器、面试、投递追踪
Phase 3: 增强       (第 9-12周) → 扩展、计费、迭代
```

---

## 二、Phase 0 — 基础架构（第 1-2 周）

### 目标
用户可以上传简历，系统自动解析出个人信息和工作经历，用户能看到并确认。

### 具体任务

#### D0: 项目初始化（2 天）
- [ ] 本地确认项目能启动（后端 uvicorn + 前端 next dev）
- [ ] docker-compose up 全套环境正常
- [ ] 数据库 migration 跑通，表创建成功
- [ ] GitHub 仓库配置完成

#### D1: 用户认证（2 天）
- [ ] 手机号验证码登录（后端 API）
- [ ] 邮箱密码登录（后端 API）
- [ ] 登录状态持久化（JWT）
- [ ] 前端登录页 + 注册页
- [ ] 登录后跳转到 Dashboard
- [ ] 未登录跳转到登录页

#### D2: 文件上传与解析（3 天）
- [ ] 前端上传组件（拖拽 + 点击选择）
- [ ] 文件上传 API → 存到对象存储
- [ ] PyMuPDF 提取纯文本
- [ ] DeepSeek LLM 调用 → 输出结构化 Profile + Events
- [ ] 解析后的 Profile 写入 profiles 表
- [ ] 解析后的 Events 写入 career_events 表（status=draft）
- [ ] 后台任务状态轮询（前端显示"解析中..."）

#### D3: 审核与展示（3 天）
- [ ] Events 列表页（按时间倒序）
- [ ] 审核卡组件：显示事件字段、证据 excerpt、疑点
- [ ] 审核操作：确认、编辑、标记待确认、跳过
- [ ] 确认后更新 status → confirmed
- [ ] Profile 展示页 + 编辑功能
- [ ] Timeline 视图（按时间轴展示 confirmed 事件）

### Phase 0 验收标准

```
基础：
  □ 新用户能注册登录
  □ 能上传 PDF 简历（支持中文和英文）
  □ 上传后 30 秒内完成解析
  □ 解析出的 Profile 信息正确（姓名、邮箱、电话、所在地）
  □ 解析出的 Events 正确（公司、职位、时间）
  □ 用户能看到审核卡
  □ 用户能确认事件（status → confirmed）
  □ 用户能编辑事件字段
  □ Profile 页面能正常展示和编辑

质量：
  □ 不支持的文件类型给出明确提示
  □ 解析失败时有错误提示和重试按钮
  □ 上传进度有 loading 状态
  □ 页面适配桌面端（1024px+）
```

---

## 三、Phase 1 — 核心闭环（第 3-5 周）

### 目标
用户可以创建目标岗位，AI 分析 JD 并生成定制简历，支持预览和 PDF 导出。

### 具体任务

#### W3: 岗位管理（3 天）
- [ ] JobTarget 创建页（粘贴 JD + 填写公司/岗位/城市）
- [ ] 岗位列表页（展示所有 target）
- [ ] 岗位详情页（展示 JD 原文）
- [ ] Target 状态管理（draft → researching → plan_ready → generating → done）

#### W4: 岗位分析 + 简历计划（4 天）
- [ ] AI Target Research（JD 分析 → 公司背景、技能、关键词、风险）
- [ ] Research 结果展示页
- [ ] Resume Plan 生成（Section 策略 + 证据选择）
- [ ] Resume Plan 展示 + 用户确认/调整
- [ ] Timeline Readiness 检查（确认事件不够时提示）

#### W5: 生成 + 导出（3 天）
- [ ] AI 简历生成（调 LLM → resume_document.json）
- [ ] HTML 预览（A4 比例居中展示）
- [ ] PDF 导出（Playwright 渲染）
- [ ] Markdown 复制
- [ ] 生成历史管理（同一岗位可多次生成）

### Phase 1 验收标准

```
  □ 能创建岗位（粘贴 JD）
  □ AI 能分析出公司背景和技能要求
  □ Resume Plan 能展示并确认
  □ 简历能生成并在浏览器中预览
  □ 简历内容来源于 Career Vault 中的 confirmed 事件
  □ 能导出 PDF（文本可复制、联系方式存在）
  □ 能复制 Markdown
  □ 页面数不超过用户指定
```

---

## 四、Phase 2 — 产品化（第 6-8 周）

### 目标
支持简历编辑器、AI 编辑、面试准备、投递追踪。

### 具体任务

#### W6: 编辑器
- [ ] 结构化编辑器：点击 section/item/bullet 直接修改
- [ ] AI 快捷编辑：更简洁、更量化、加关键词、压缩到一页
- [ ] 版本管理（Version History）
- [ ] Source View（Markdown/JSON 切换）
- [ ] Undo / Reset

#### W7: 面试准备 + Dashbaord
- [ ] Interview Prep 生成（基于 JD + 简历版本）
- [ ] 问题列表（分类展示 + STAR 答案）
- [ ] 问题状态跟踪（新/需复习/已掌握）
- [ ] Interview Round 管理
- [ ] Dashboard 统计（指标卡、投递漏斗、热力图）
- [ ] 空状态引导

#### W8: 投递追踪 + 更多导出
- [ ] Application Tracker（Kanban 视图）
- [ ] 状态变更（draft → applied → interview → offer/rejected）
- [ ] Cover Letter 生成
- [ ] Boss 开场白生成
- [ ] DOCX 导出

### Phase 2 验收标准

```
  □ Editor 中能点击编辑任意文本
  □ AI 快捷编辑能正常修改内容
  □ Version History 能回溯
  □ Dashboard 数据正确
  □ Interview Prep 能生成
  □ Tracker Kanban 能拖拽变更状态
  □ Cover Letter 能生成
  □ DOCX 导出可用
```

---

## 五、Phase 3 — 产品增强（第 9-12 周）

### 目标
浏览器扩展、BYOK 计费、多模型支持、迭代优化。

### 具体任务

| 周 | 任务 |
|---|------|
| 9 | Browser Extension MVP（Boss 直聘 JD 抓取 + 侧边栏 Match Score）|
| 10 | BYOK 设置页 + 多 Provider 切换（DeepSeek/Qwen/Claude）|
| 10 | Usage Ledger + 计费（Free/Pro/BYOK 三层）|
| 11 | GitHub URL 导入 + 个人网页导入 |
| 11 | 用户反馈收集 + Bug 修复 |
| 12 | 性能优化 + 安全审计 + 部署上线 |

### Phase 3 验收标准

```
  □ 扩展能抓取 Boss 直聘 JD
  □ 扩展侧边栏显示 Match Score
  □ 用户能配置自己的 API Key
  □ 能切换 AI 模型
  □ 额度用量正确统计
  □ GitHub 链接能导入并解析
```

---

## 六、质量标准（贯穿所有 Phase）

### 前端
```
  □ 所有页面有 loading 状态（Skeleton）
  □ 所有页面有空状态提示
  □ 所有接口错误有 toast 提示和重试
  □ 响应式桌面端（1024px+）
  □ 页面切换流畅无闪烁
```

### 后端
```
  □ 所有 API 有输入校验（Pydantic）
  □ 所有 API 有错误处理
  □ AI 调用有超时和重试机制
  □ 用户数据隔离（user_id 强制校验）
  □ AI 不虚构事实（只从 source text 提取）
  □ 敏感字段不记录日志
```

### AI 质量
```
  □ 不虚构公司、学校、时间、指标
  □ 每个 bullet 可溯源到 CareerEvent
  □ needs_review 事件不进入最终简历
  □ 中英文输出符合目标语境
  □ PDF text layer 可抽取
  □ PDF 页数不超过用户指定
```

---

## 七、每日/每周工作方式

### 每天早上
1. 看任务面板，今天要做的事
2. 如果有阻塞项，先解决或提出来

### 每个功能点完成时
1. 本地跑通所有相关功能
2. 检查验收标准里的对应项
3. 提交代码（git commit）
4. 推到 GitHub

### 每个 Phase 结束时
1. 对照验收标准逐条检查
2. 标记未完成项到下一 Phase
3. 确认没有架构上的技术债

---

## 八、GitHub 协作规范

### 项目管理

使用 **GitHub Projects** 跟踪进度：

1. 在仓库页点击 Projects tab → New project → Board 视图
2. 创建 4 列: `📋 Backlog` → `🚧 In Progress` → `👀 In Review` → `✅ Done`
3. 将 DEV_PLAN.md 中的每个任务转成 Issue，挂到 Project

### Issue 规范

每个开发任务拆成独立的 Issue，标题格式：

```
[Phase 0] 用户认证 — 手机验证码登录
[Phase 0] 文件上传 — PDF/DOCX 解析
[Phase 1] 岗位管理 — JD 粘贴与 AI 分析
```

每个 Issue 必须包含：
- 所属 Phase
- 具体任务描述
- Acceptance Criteria（验收标准）
- 涉及范围标签（前端/后端/两端）

### Branch 策略 — Trunk-based

```
main                        ← 始终可部署，受保护
  └── feat/phone-auth       ← 一个 Issue 一个分支
  └── feat/file-upload
  └── fix/parse-timeout
```

规则：
- 从 main 切分支，一个功能一个分支
- 开发完成后开 PR → main
- 自审通过后 Squash Merge
- branch 命名: `feat/功能简称` 或 `fix/问题简称`

### PR 流程

1. 推送分支: `git push origin feat/xxx`
2. 去 GitHub 开 Pull Request（仓库有 PR 模板）
3. 填写模板、关联 Issue（`Closes #X`）
4. 自审通过 → Squash merge → 删除分支

### 保护 main 分支

在仓库 Settings → Branches → Add rule:
- Branch name pattern: `main`
- ☑ Require a pull request before merging
- ☑ Require status checks to pass before merging (后续加 CI 再用)

### 当前状态

项目处于 Phase 0 开发中，已完成:

```
✅ D0: 项目初始化
✅ D1: 用户认证（后端 API）
✅ D2: 文件上传与解析（后端 API）
🔄 D3: 审核与展示（前端 UI 开发中）
```
