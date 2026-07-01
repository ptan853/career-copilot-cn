from services.vault_section_schema import (
    get_section_dedupe_fields,
    get_section_schema,
    normalize_event_with_schema,
    render_section_field_instructions,
    render_section_output_schema,
)


def test_experience_schema_contains_bullet_meaning_and_dedupe_fields():
    schema = get_section_schema("experience")
    field_paths = [field.path for field in schema.fields]

    assert schema.title == "工作/实习"
    assert "title" in field_paths
    assert "organization" in field_paths
    assert "details.bullets" in field_paths
    assert get_section_dedupe_fields("experience") == ["organization", "title", "time_start", "time_end"]

    instructions = render_section_field_instructions("experience")
    assert "details.bullets" in instructions
    assert "贡献、方法或结果" in instructions


def test_course_schema_excludes_skills_and_education_honors():
    instructions = render_section_field_instructions("courses")

    assert "课程" in instructions
    assert "不要把课程塞进 education" in instructions
    assert "details.skills" not in instructions
    assert "details.honors" not in instructions


def test_output_schema_is_generated_from_section_fields():
    output_schema = render_section_output_schema("projects")
    event_schema = output_schema["events"][0]

    assert event_schema["details"]["bullets"] == "string[]"
    assert event_schema["details"]["tech_stack"] == "string[]"
    assert event_schema["details"]["url"] == "string | null"


def test_normalize_event_with_schema_keeps_declared_fields_only():
    normalized = normalize_event_with_schema(
        "projects",
        {
            "title": " PM Agent ",
            "organization": " 光庭 ",
            "time_start": "2026-03",
            "details": {
                "bullets": "设计项目管理 Agent，支持自然语言查询",
                "tech_stack": ["LangGraph", "FastAPI", ""],
                "skills": ["should drop"],
                "url": " https://example.com ",
            },
            "unknown": "drop me",
        },
    )

    assert normalized == {
        "title": "PM Agent",
        "organization": "光庭",
        "time_start": "2026-03",
        "details": {
            "section_type": "projects",
            "bullets": ["设计项目管理 Agent", "支持自然语言查询"],
            "tech_stack": ["LangGraph", "FastAPI"],
            "url": "https://example.com",
        },
    }
