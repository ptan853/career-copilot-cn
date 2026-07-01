from services.llm_providers import LLMMessage
from services.vault_pipeline_prompts import (
    SECTION_EXTRACTOR_REGISTRY,
    event_pair_merge_prompt,
    section_extraction_prompt,
    source_detection_prompt,
)


def _joined(messages: list[LLMMessage]) -> str:
    return "\n".join(message.content for message in messages)


def test_source_detection_prompt_names_allowed_sections():
    messages = source_detection_prompt(
        source_id="src_1",
        source_type="text",
        source_title="note",
        source_text="Agent project and Imperial College MSc",
        instruction="重点提取 Agent 项目",
    )
    joined = _joined(messages)

    assert "experience" in joined
    assert "projects" in joined
    assert "courses" in joined
    assert "不要生成最终履历事件" in joined
    assert "重点提取 Agent 项目" in joined


def test_section_prompt_uses_section_specific_fields():
    messages = section_extraction_prompt(
        section_type="courses",
        instruction="只解析课程",
        existing_events=[],
        source_spans=[
            {
                "source_id": "src_1",
                "source_title": "resume.pdf",
                "text": "机器学习 (Machine Learning) - 帝国理工大学 - 2023-2025",
            }
        ],
    )
    joined = _joined(messages)

    assert "课程抽取器" in joined
    assert "title" in joined
    assert "organization" in joined
    assert "不要把课程塞进 education" in joined
    assert "details.skills" not in joined
    assert "只解析课程" in joined
    assert "机器学习" in joined


def test_registry_has_initial_sections():
    for section in ["profile", "summary", "experience", "projects", "education", "courses", "awards", "skills"]:
        assert section in SECTION_EXTRACTOR_REGISTRY


def test_event_pair_merge_prompt_uses_field_contract_and_keeps_user_invisible():
    messages = event_pair_merge_prompt(
        section_type="experience",
        event_a={"title": "Agent 算法工程师", "organization": "光庭"},
        event_b={"title": "Agent 工程师", "organization": "武汉光庭信息科技"},
        field_contract="details.bullets 是简历 bullet 列表",
    )
    joined = _joined(messages)

    assert "merge | keep_both" in joined
    assert "details.bullets 是简历 bullet 列表" in joined
    assert "不要要求用户手动合并" in joined
    assert "Agent 算法工程师" in joined
