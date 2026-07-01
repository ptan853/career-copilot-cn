from services.profile_schema import (
    PROFILE_SECTION_ORDER,
    event_type_to_profile_section,
    normalize_lite_details,
)


def test_event_type_to_profile_section_maps_lite_sections():
    assert event_type_to_profile_section("work").section_type == "experience"
    assert event_type_to_profile_section("internship").section_title == "工作/实习"
    assert event_type_to_profile_section("project").section_type == "projects"
    assert event_type_to_profile_section("education").section_title == "教育"
    assert event_type_to_profile_section("award").section_type == "awards"
    assert event_type_to_profile_section("award").section_title == "荣誉/奖项"
    assert event_type_to_profile_section("course").section_type == "courses"
    assert event_type_to_profile_section("course").section_title == "课程"
    assert event_type_to_profile_section("certification").section_title == "证书"
    assert event_type_to_profile_section("publication").section_type == "research"
    assert event_type_to_profile_section("language").section_type == "languages"


def test_profile_section_order_keeps_resume_sequence():
    assert PROFILE_SECTION_ORDER[:5] == [
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
    ]


def test_normalize_lite_details_keeps_bullets_plain_strings():
    details = normalize_lite_details(
        "work",
        {
            "bullets": [
                "  设计 PM Agent  ",
                {"text": "旧结构应降级成纯文本"},
                "",
                123,
            ],
            "skills": "LLM Agent, FastAPI，Tool Calling",
            "context": "旧字段保留为辅助信息",
        },
    )

    assert details["bullets"] == ["设计 PM Agent", "旧结构应降级成纯文本", "123"]
    assert details["skills"] == ["LLM Agent", "FastAPI", "Tool Calling"]
    assert details["context"] == "旧字段保留为辅助信息"


def test_normalize_lite_details_keeps_only_relevant_lite_fields():
    details = normalize_lite_details(
        "education",
        {
            "field": "应用计算科学与工程",
            "gpa": "88.6/100",
            "honors": ["优秀毕业生", "奖学金"],
            "tech_stack": ["Python"],
            "unknown": "drop me",
        },
    )

    assert details == {
        "field": "应用计算科学与工程",
        "gpa": "88.6/100",
        "honors": ["优秀毕业生", "奖学金"],
    }
