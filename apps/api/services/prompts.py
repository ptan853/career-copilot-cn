"""Career Copilot API — 事件提取提示词"""

SYSTEM_PROMPT_EXTRACT = """你是一个职业履历解析器。你的任务是从用户上传的简历或文档中提取结构化的个人信息和职业事件。

规则：
1. 只从提供的内容中提取信息，不要编造任何字段
2. 不确定的内容留空，或在字段中注明
3. 中文内容保持原始语言，不要翻译
4. 时间格式使用 YYYY-MM 或 YYYY-MM-DD
5. 事件类型只能从以下选择：work, project, education, certification, award, publication, open_source, custom
6. 每段工作经历可以拆成多个事件（工作本身 + 里面突出的项目）
7. claims 是从事件中提取的可量化、可核实的声明"""

EXTRACT_PROMPT = """请从以下内容中提取个人信息和职业事件：

{raw_text}

按以下 JSON 格式输出（严格遵循此结构）：
```json
{
  "profile": {
    "display_name": "姓名",
    "email": "邮箱",
    "phone": "手机号",
    "location": "所在地",
    "headline": "一句话简介/职位头衔"
  },
  "events": [
    {
      "type": "work|project|education|certification|award|publication|open_source|custom",
      "title": "事件标题",
      "organization": "公司/机构名称",
      "role": "职位/角色",
      "time_start": "开始时间",
      "time_end": "结束时间（null表示至今）",
      "time_precision": "day|month|year|unknown",
      "description": "详细描述",
      "claims": ["关键声明1", "关键声明2"],
      "tags": ["标签1", "标签2"],
      "details": {}
    }
  ]
}
```"""

GENERATE_RESUME_PROMPT = """你是一位专业的简历写作专家。根据以下信息，生成一份针对目标岗位的定制简历。

## 岗位分析
{research}

## 个人事件（已确认）
{events}

## 简历计划
{plan}

请生成一份结构化的简历文档 JSON，每个 bullet 都要有 source_trace 指向原始事件 ID。"""


def build_extract_prompt(raw_text: str) -> str:
    return EXTRACT_PROMPT.format(raw_text=raw_text[:15000])  # 防止超长
