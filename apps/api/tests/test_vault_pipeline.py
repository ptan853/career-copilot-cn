from services.vault_pipeline import group_spans_by_section, merge_duplicate_event_update, skip_duplicate_events
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
        self.status = kwargs.get("status", "draft")


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


def test_draft_duplicate_is_auto_merged_with_patch_history():
    existing = ExistingEvent(
        title="PM Agent",
        organization="光庭",
        status="draft",
        details_json={"bullets": ["设计 PM Agent。"], "skills": ["LangChain"]},
    )
    proposed = {
        "title": "PM Agent",
        "organization": "光庭",
        "details": {
            "bullets": ["设计 PM Agent。", "支持项目、任务、人员信息的自然语言查询。"],
            "skills": ["LangChain", "LangGraph"],
        },
    }

    result = merge_duplicate_event_update("projects", existing, proposed, source_ids=["src_1"], reason="新材料补充")

    assert result == "auto_applied"
    assert existing.details_json["bullets"] == ["设计 PM Agent。", "支持项目、任务、人员信息的自然语言查询。"]
    assert existing.details_json["skills"] == ["LangChain", "LangGraph"]
    assert existing.details_json["last_applied_patch"]["status"] == "accepted"


def test_confirmed_duplicate_creates_pending_patch_without_overwriting():
    existing = ExistingEvent(
        title="PM Agent",
        organization="光庭",
        status="confirmed",
        details_json={"bullets": ["设计 PM Agent。"], "skills": ["LangChain"]},
    )
    proposed = {
        "title": "PM Agent",
        "organization": "光庭",
        "details": {
            "bullets": ["设计 PM Agent。", "支持项目、任务、人员信息的自然语言查询。"],
            "skills": ["LangChain", "LangGraph"],
        },
    }

    result = merge_duplicate_event_update("projects", existing, proposed, source_ids=["src_1"], reason="新材料补充")

    assert result == "pending_patch"
    assert existing.details_json["bullets"] == ["设计 PM Agent。"]
    assert existing.details_json["skills"] == ["LangChain"]
    patch = existing.details_json["pending_patches"][0]
    assert patch["status"] == "pending"
    assert patch["source_ids"] == ["src_1"]
    assert {
        "field": "details.skills",
        "change_type": "add",
        "old_value": None,
        "new_value": "LangGraph",
    } in patch["diff"]
