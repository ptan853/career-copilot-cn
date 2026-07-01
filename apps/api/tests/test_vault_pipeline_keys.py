from services.vault_pipeline_keys import canonical_event_key, is_likely_duplicate


def test_experience_key_normalizes_org_title_and_dates():
    event = {
        "title": "Agent 算法工程师",
        "organization": "武汉光庭信息科技",
        "time_start": "2026-03",
        "time_end": "2026-05",
    }

    assert canonical_event_key("experience", event) == "experience|武汉光庭信息科技|agent算法工程师|2026-03|2026-05"


def test_course_duplicate_uses_title_and_institution():
    a = {"title": "机器学习 (Machine Learning)", "organization": "帝国理工大学"}
    b = {"title": "机器学习", "organization": "帝国理工大学"}

    assert is_likely_duplicate("courses", a, b)


def test_project_different_title_is_not_duplicate():
    a = {"title": "PM Agent 智能项目管理助手", "organization": "武汉光庭信息科技"}
    b = {"title": "Infplane Shell Suite", "organization": "个人项目"}

    assert not is_likely_duplicate("projects", a, b)


def test_nested_dedupe_field_reads_details_value():
    event = {
        "title": "工学学士",
        "organization": "中国石油大学（北京）",
        "details": {"field": "自动化"},
    }

    assert canonical_event_key("education", event) == "education|中国石油大学(北京)|工学学士|自动化"


def test_award_duplicate_allows_related_institution_as_org_fallback():
    a = {
        "title": "学业优秀奖学金（一等）",
        "organization": "",
        "time_end": "2021",
        "details": {"related_institution": "中国石油大学（北京）"},
    }
    b = {"title": "学业优秀奖学金一等", "organization": "中国石油大学（北京）", "time_end": "2021"}

    assert is_likely_duplicate("awards", a, b)
