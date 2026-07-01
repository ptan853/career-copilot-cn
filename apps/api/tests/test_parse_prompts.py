from services.parse_prompts import source_parse_system_prompt


def test_source_parse_prompt_renders_section_registry_fields():
    prompt = source_parse_system_prompt()

    assert "Section: 课程 (courses)" in prompt
    assert "details.url（链接, string | null, 可选）" in prompt
    assert "Section: 荣誉/奖项 (awards)" in prompt
    assert "details.related_institution" in prompt
    assert "Section: 项目 (projects)" in prompt
    assert "details.tech_stack" in prompt
    assert "不要把课程塞进 education.honors 或 skills" in prompt


def test_source_parse_prompt_renders_machine_readable_output_schema():
    prompt = source_parse_system_prompt()

    assert '"courses"' in prompt
    assert '"section_type": "courses"' in prompt
    assert '"details": {' in prompt
    assert '"bullets": "string[]"' in prompt
