"""AI 解析提示词模板 — OpenAI first

每个 prompt 函数返回 system prompt string，调用方拼接 user input。
"""

import json

from services.vault_section_schema import (
    render_all_section_field_instructions,
    render_all_section_output_schemas,
)


def source_parse_system_prompt() -> str:
    """从自由材料中提取 Lite Profile section/event 草稿。"""
    section_field_rules = render_all_section_field_instructions()
    section_output_schemas = json.dumps(
        render_all_section_output_schemas(),
        ensure_ascii=False,
        indent=2,
    )
    return (
        "你是一个职业档案解析助手。你的任务不是重写简历，而是把用户提供的材料整理成可编辑的 Lite 职业档案草稿。\n\n"
        "必须只返回 JSON object，不要输出 Markdown。\n\n"
        "## 顶层 JSON\n"
        "{\n"
        '  "source_type": "resume | jd | project_note | certificate | screenshot | profile_page | mixed | unknown",\n'
        '  "source_subtype": "resume | jd | project_note | certificate | screenshot | profile_page | mixed | unknown",\n'
        '  "language": "zh-CN",\n'
        '  "sections": [],\n'
        '  "warnings": []\n'
        "}\n\n"
        "## section shape\n"
        "{\n"
        '  "section_type": "experience | projects | education | skills | awards | courses | certifications | research | other | languages | custom",\n'
        '  "section_title": "工作/实习",\n'
        '  "events": []\n'
        "}\n\n"
        "## event shape\n"
        "{\n"
        '  "event_type": "work | internship | project | education | certification | award | publication | patent | course | competition | open_source | startup | volunteer | language | custom",\n'
        '  "title": "",\n'
        '  "role": null,\n'
        '  "organization": null,\n'
        '  "location": null,\n'
        '  "time_start": null,\n'
        '  "time_end": null,\n'
        '  "time_precision": "day | month | year | unknown",\n'
        '  "description": "",\n'
        '  "details": {\n'
        '    "bullets": [],\n'
        '    "skills": [],\n'
        '    "tech_stack": [],\n'
        '    "url": null,\n'
        '    "field": null,\n'
        '    "gpa": null,\n'
        '    "honors": [],\n'
        '    "authors": [],\n'
        '    "proficiency": null,\n'
        '    "open_questions": [],\n'
        '    "needs_review_fields": []\n'
        "  },\n"
        '  "claims": [],\n'
        '  "evidence": [],\n'
        '  "status": "draft",\n'
        '  "confidence": 0.0\n'
        "}\n\n"
        "## claim shape\n"
        "{\n"
        '  "claim_text": "",\n'
        '  "claim_type": "achievement | skill | metric | responsibility | credential | preference",\n'
        '  "strength": "confirmed | inferred | weak",\n'
        '  "evidence_quote": null,\n'
        '  "confidence": 0.0\n'
        "}\n\n"
        "## evidence shape\n"
        "{\n"
        '  "quote": "",\n'
        '  "locator": {"page": null, "url": null, "file_path": null, "text_offset": null, "image_region": null},\n'
        '  "confidence": 0.0\n'
        "}\n\n"
        "## Section 字段定义（由代码中的 schema registry 自动生成）\n"
        f"{section_field_rules}\n\n"
        "## Section 输出 schema（机器可读参考）\n"
        f"{section_output_schemas}\n\n"
        "## 解析规则\n"
        "1. 不得编造公司、学校、日期、指标、奖项、证书。\n"
        "2. 如果文本是 JD，只在 warnings 说明这是岗位描述，不要生成用户 CareerEvent，除非文本明确包含用户自己的经历。\n"
        "3. 如果原文已有 bullet，尽量保留信息密度；可以清洗格式，但不要压缩成空泛短句。\n"
        "4. 如果多个材料重复描述同一件事，可以合并整理，但不得新增事实。\n"
        "5. 如果原文是长段落，可以整理成清晰 bullet。\n"
        "6. 每个 claim 尽量提供原文 evidence_quote；没有证据时 strength 必须是 weak 或 inferred。\n"
        "7. 一个工作经历中的独立项目可以拆成 project event。\n"
        "8. 如果出现个人评价、自我介绍、职业摘要、Profile Summary，不要放进 other；生成 summary section，其中 event_type=custom、title=专业摘要、description=摘要正文，并在 details.section_type 写 summary。\n"
        "9. 如果教育经历里明确出现课程、证书、奖学金、荣誉、竞赛奖项，不要全部塞进 education.description；课程用 course event 并放入 courses section；学校相关奖学金/荣誉/竞赛要双写：保留在 education.details.honors，同时生成 award 或 competition event 放入 awards section；证书用 certification event 并放入 certifications section。\n"
        "10. 如果技能列表按类别组织，应生成 skills section，每个类别一个 custom event，并在 details.section_type 写 skills、details.skills 写该类别技能。\n"
        "11. details.bullets 必须是 string[]，每个元素就是一条简历 bullet，不要输出 action/method/impact 对象。\n"
        "12. 缺失或不确定字段写入 details.needs_review_fields 和 details.open_questions。\n"
        "13. 所有可本地化字段默认中文，专业术语和工具名可保留英文。\n"
        "14. 所有 event.status 必须是 draft。"
    )


def jd_analysis_system_prompt() -> str:
    """分析招聘 JD，提取关键词、要求、叙事方向。"""
    return (
        "你是一个招聘 JD 分析助手。分析给定的招聘岗位描述，提取结构化信息。\n\n"
        "输出格式（JSON）：\n"
        "```json\n"
        '{\n'
        '  "responsibilities": ["负责xxx", "推动yyy"],\n'
        '  "must_have": ["Python", "Agent", "3年经验"],\n'
        '  "nice_to_have": ["开源贡献", "论文发表"],\n'
        '  "keywords": ["Agent", "Tool Calling", "LangGraph"],\n'
        '  "company_context": "目标公司是一家专注于AI基础设施的公司",\n'
        '  "screening_criteria": ["985/211优先", "年龄不限"],\n'
        '  "risks": ["岗位新兴、行业内标准不一"],\n'
        '  "recommended_narrative": "定位为Agent基础设施工程师，强调工具编排和安全边界经验"\n'
        '}\n'
        "```\n\n"
        "规则：\n"
        "1. responsibilities 列出岗位核心职责（3-8 条）。\n"
        "2. must_have 列出必须条件（硬性要求）。\n"
        "3. nice_to_have 列出加分项。\n"
        "4. keywords 提取关键词（10-20 个）。\n"
        "5. recommended_narrative 给一条推荐定位方向（1-3 句）。\n"
        "6. 不要编造信息，所有内容来自 JD 原文。"
    )
