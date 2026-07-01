"""Prompt builders for the internal Vault three-layer parsing pipeline."""

import json
from typing import Any

from services.llm_providers import LLMMessage
from services.vault_section_schema import (
    SOURCE_PARSE_SECTION_TYPES,
    render_section_field_instructions,
    render_section_output_schema,
)


SECTION_EXTRACTOR_REGISTRY = {
    "profile": "职业档案 Profile 字段抽取器",
    "summary": "职业摘要抽取器",
    "experience": "工作/实习经历抽取器",
    "projects": "项目经历抽取器",
    "education": "教育经历抽取器",
    "courses": "课程抽取器",
    "awards": "荣誉、奖项和竞赛抽取器",
    "skills": "技能抽取器",
    "certifications": "证书抽取器",
    "research": "论文、专利和研究成果抽取器",
    "languages": "语言能力抽取器",
    "other": "其他职业材料抽取器",
}


def source_detection_prompt(
    source_id: str,
    source_type: str,
    source_title: str,
    source_text: str,
    instruction: str = "",
) -> list[LLMMessage]:
    allowed_sections = ["profile", *SOURCE_PARSE_SECTION_TYPES]
    system = (
        "你是 Vault 三层解析流水线的 Layer 1 source detector。\n"
        "你的任务是判断单个 source 中包含哪些职业档案 section，并切出对应原文 span。\n"
        "不要生成最终履历事件，不要改写 bullet，不要合并不同 source。\n"
        "只返回 JSON object。\n\n"
        "允许的 section_type:\n"
        f"{json.dumps(allowed_sections, ensure_ascii=False)}\n\n"
        "输出格式:\n"
        "{\n"
        '  "source_id": "string",\n'
        '  "material_type": "resume | note | profile_page | certificate | screenshot | jd | unknown",\n'
        '  "language": "zh-CN",\n'
        '  "sections_detected": ["section_type"],\n'
        '  "section_spans": [\n'
        '    {"source_id": "string", "source_title": "string", "section_type": "section_type", "span_title": "string | null", "text": "原文片段", "confidence": 0.0}\n'
        "  ],\n"
        '  "warnings": []\n'
        "}\n\n"
        "规则:\n"
        "1. 课程必须标为 courses；奖学金、竞赛、荣誉必须标为 awards，同时可保留在 education span 中。\n"
        "2. JD 只能标 warnings，不要把 JD 要求当成用户经历。\n"
        "3. span.text 必须来自输入原文，可以截取但不要重写。\n"
        "4. 如果解析提示要求重点关注某类内容，只影响 span 选择，不改变事实。"
    )
    user = _format_json_block(
        {
            "source_id": source_id,
            "source_type": source_type,
            "source_title": source_title,
            "instruction": instruction,
            "source_text": source_text,
        }
    )
    return [LLMMessage(role="system", content=system), LLMMessage(role="user", content=user)]


def section_extraction_prompt(
    section_type: str,
    instruction: str,
    existing_events: list[dict[str, Any]],
    source_spans: list[dict[str, Any]],
) -> list[LLMMessage]:
    extractor_name = SECTION_EXTRACTOR_REGISTRY.get(section_type, SECTION_EXTRACTOR_REGISTRY["other"])
    field_contract = render_section_field_instructions(section_type)
    output_schema = render_section_output_schema(section_type)
    system = (
        f"你是 Vault 三层解析流水线的 Layer 2 {extractor_name}。\n"
        "你的任务是只从给定 source spans 中提取本 section 的结构化事件。\n"
        "不要解析其他 section，不要把一个字段塞到未声明的 details 字段里。\n"
        "只返回 JSON object。\n\n"
        "字段契约:\n"
        f"{field_contract}\n\n"
        "输出 schema:\n"
        f"{json.dumps(output_schema, ensure_ascii=False, indent=2)}\n\n"
        "规则:\n"
        "1. 每条 event.status 必须是 draft。\n"
        "2. source_ids 和 evidence_quotes 必须来自输入 spans。\n"
        "3. 如果 existing_events 里已有相似事件，也先输出当前材料能证明的事实，不要自行覆盖既有事件。\n"
        "4. details.bullets 必须是 string[]，每个元素是一条可进入简历的 bullet。"
    )
    user = _format_json_block(
        {
            "section_type": section_type,
            "instruction": instruction,
            "existing_events": existing_events,
            "source_spans": source_spans,
        }
    )
    return [LLMMessage(role="system", content=system), LLMMessage(role="user", content=user)]


def event_pair_merge_prompt(
    section_type: str,
    event_a: dict[str, Any],
    event_b: dict[str, Any],
    field_contract: str,
) -> list[LLMMessage]:
    system = (
        "你是 Vault 三层解析流水线的 Layer 3 event pair merger。\n"
        "你的任务是判断两个同 section 事件是否描述同一件事，并在可以安全合并时给出 merged_event。\n"
        "不要要求用户手动合并；用户界面只会看到最终事件或字段级 diff。\n"
        "只返回 JSON object。\n\n"
        "输出格式:\n"
        "{\n"
        '  "decision": "merge | keep_both",\n'
        '  "confidence": 0.0,\n'
        '  "merged_event": object | null,\n'
        '  "reason": "string",\n'
        '  "warnings": []\n'
        "}\n\n"
        "合并规则:\n"
        "1. 只有同一学校/公司/项目/课程/奖项的同一事实才能 merge。\n"
        "2. 不得编造新事实；只可清洗、去重、合并互补字段。\n"
        "3. 如果时间、组织、标题冲突且无法解释，返回 keep_both。\n"
        "4. confirmed event 的覆盖由后续 field diff patch 处理，这里只产出候选 merged_event。\n\n"
        "字段契约:\n"
        f"{field_contract}"
    )
    user = _format_json_block(
        {
            "section_type": section_type,
            "event_a": event_a,
            "event_b": event_b,
        }
    )
    return [LLMMessage(role="system", content=system), LLMMessage(role="user", content=user)]


def _format_json_block(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2)
