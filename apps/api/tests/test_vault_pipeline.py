from services.vault_pipeline import group_spans_by_section, skip_duplicate_events
from services.vault_pipeline_types import SourceDetectionResult, SourceSectionSpan


class ExistingEvent:
    def __init__(self, **kwargs):
        self.title = kwargs.get("title")
        self.organization = kwargs.get("organization")
        self.role = kwargs.get("role")
        self.location = kwargs.get("location")
        self.time_start = kwargs.get("time_start")
        self.time_end = kwargs.get("time_end")
        self.description = kwargs.get("description")
        self.details_json = kwargs.get("details_json") or {}
        self.tags = kwargs.get("tags") or []


def test_group_spans_by_section_keeps_source_trace():
    detection = SourceDetectionResult(
        source_id="src_1",
        section_spans=[
            SourceSectionSpan(source_id="src_1", source_title="resume.pdf", section_type="projects", text="PM Agent"),
            SourceSectionSpan(source_id="src_1", source_title="resume.pdf", section_type="skills", text="LangGraph"),
        ],
    )

    grouped = group_spans_by_section([detection])

    assert grouped["projects"][0].text == "PM Agent"
    assert grouped["projects"][0].source_id == "src_1"
    assert grouped["skills"][0].text == "LangGraph"


def test_skip_duplicate_events_removes_existing_course_match():
    existing_events = [
        ExistingEvent(title="机器学习", organization="帝国理工大学"),
    ]
    new_events = [
        {"title": "机器学习 (Machine Learning)", "organization": "帝国理工大学"},
        {"title": "反演和优化", "organization": "帝国理工大学"},
    ]

    filtered = skip_duplicate_events("courses", new_events, existing_events)

    assert filtered == [{"title": "反演和优化", "organization": "帝国理工大学"}]


def test_skip_duplicate_events_keeps_distinct_projects():
    existing_events = [
        ExistingEvent(title="PM Agent 智能项目管理助手", organization="武汉光庭信息科技"),
    ]
    new_events = [
        {"title": "Infplane Shell Suite", "organization": "个人项目"},
    ]

    assert skip_duplicate_events("projects", new_events, existing_events) == new_events
