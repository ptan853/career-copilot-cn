from services.source_parse import event_type_to_section, normalize_source_parse


def test_event_type_to_section_maps_known_types():
    assert event_type_to_section("work") == {
        "section_type": "experience",
        "section_title": "工作/实习",
    }
    assert event_type_to_section("internship") == {
        "section_type": "experience",
        "section_title": "工作/实习",
    }
    assert event_type_to_section("project") == {
        "section_type": "projects",
        "section_title": "项目",
    }
    assert event_type_to_section("certification") == {
        "section_type": "certifications",
        "section_title": "证书",
    }
    assert event_type_to_section("course") == {
        "section_type": "courses",
        "section_title": "课程",
    }


def test_event_type_to_section_falls_back_to_custom():
    assert event_type_to_section("unknown") == {
        "section_type": "other",
        "section_title": "志愿/社团/其他",
    }


def test_normalize_source_parse_flattens_sections_events_claims_and_evidence():
    raw = {
        "source_type": "resume",
        "source_subtype": "resume",
        "language": "zh-CN",
        "sections": [
            {
                "section_type": "work",
                "section_title": "工作经历",
                "events": [
                    {
                        "event_type": "internship",
                        "title": "增长产品实习",
                        "role": "产品实习生",
                        "organization": "字节跳动",
                        "time_start": "2024-06",
                        "time_end": "2025-03",
                        "details": {
                            "context": "业务需要提升转化效率。",
                            "needs_review_fields": ["outcome"],
                        },
                        "claims": [
                            {
                                "claim_text": "参与增长实验设计。",
                                "claim_type": "responsibility",
                                "strength": "confirmed",
                                "evidence_quote": "负责增长实验设计",
                                "confidence": 0.84,
                            }
                        ],
                        "evidence": [
                            {
                                "quote": "负责增长实验设计",
                                "locator": {"page": 1},
                                "confidence": 0.84,
                            }
                        ],
                        "confidence": 0.84,
                    }
                ],
            }
        ],
        "warnings": ["部分指标缺少原文证据。"],
    }

    result = normalize_source_parse(raw)

    assert result.source_subtype == "resume"
    assert result.warnings == ["部分指标缺少原文证据。"]
    assert len(result.events) == 1
    event = result.events[0]
    assert event.section_type == "experience"
    assert event.section_title == "工作/实习"
    assert event.event_type == "internship"
    assert event.details_json["needs_review_fields"] == ["outcome"]
    assert event.claims[0].evidence_quote == "负责增长实验设计"
    assert event.evidence[0].locator == {"page": 1}


def test_normalize_source_parse_preserves_lite_bullets_as_plain_strings():
    raw = {
        "source_type": "resume",
        "source_subtype": "resume",
        "sections": [
            {
                "section_type": "experience",
                "section_title": "工作/实习",
                "events": [
                    {
                        "event_type": "work",
                        "title": "Agent 算法工程师",
                        "organization": "武汉光庭信息科技",
                        "details": {
                            "bullets": [
                                "设计并开发 PM Agent 项目管理助手。",
                                {"text": "通过 ToolManager 统一管理本地与远程工具。"},
                            ],
                            "skills": "LLM Agent, FastAPI，Tool Calling",
                        },
                    }
                ],
            }
        ],
    }

    result = normalize_source_parse(raw)

    details = result.events[0].details_json
    assert details["bullets"] == [
        "设计并开发 PM Agent 项目管理助手。",
        "通过 ToolManager 统一管理本地与远程工具。",
    ]
    assert details["skills"] == ["LLM Agent", "FastAPI", "Tool Calling"]


def test_normalize_source_parse_maps_lite_section_titles():
    raw = {
        "source_type": "resume",
        "source_subtype": "resume",
        "sections": [
            {
                "section_type": "work",
                "section_title": "工作经历",
                "events": [{"event_type": "internship", "title": "产品实习"}],
            }
        ],
    }

    result = normalize_source_parse(raw)

    assert result.events[0].section_type == "experience"
    assert result.events[0].section_title == "工作/实习"


def test_normalize_source_parse_ignores_legacy_flat_events_shape():
    result = normalize_source_parse({"events": [{"title": "旧格式"}], "claims": []})
    assert result.events == []


def test_normalize_source_parse_keeps_jd_warning_when_no_events():
    raw = {
        "source_type": "jd",
        "source_subtype": "jd",
        "sections": [],
        "warnings": ["这是岗位描述。"],
    }

    result = normalize_source_parse(raw)

    assert result.events == []
    assert "这是岗位描述。" in result.warnings


def test_normalize_source_parse_preserves_explicit_user_events_from_mixed_jd():
    raw = {
        "source_type": "jd",
        "source_subtype": "jd",
        "sections": [
            {
                "section_type": "work",
                "section_title": "工作经历",
                "events": [
                    {"event_type": "internship", "title": "我在字节跳动做增长产品实习"}
                ],
            }
        ],
        "warnings": ["输入包含岗位描述，也包含用户自己的经历。"],
    }

    result = normalize_source_parse(raw)

    assert len(result.events) == 1
    assert result.events[0].title == "我在字节跳动做增长产品实习"
    assert result.events[0].section_type == "experience"
    assert result.events[0].status == "draft"


def test_normalize_source_parse_maps_section_from_event_type_and_forces_draft():
    raw = {
        "source_type": "resume",
        "source_subtype": "resume",
        "sections": [
            {
                "section_type": "credential",
                "section_title": "奖项证书",
                "events": [
                    {
                        "event_type": "internship",
                        "title": "增长产品实习",
                        "status": "needs_review",
                    }
                ],
            }
        ],
    }

    result = normalize_source_parse(raw)

    assert result.events[0].section_type == "experience"
    assert result.events[0].section_title == "工作/实习"
    assert result.events[0].status == "draft"


def test_normalize_source_parse_preserves_explicit_section_for_custom_events():
    raw = {
        "source_type": "resume",
        "source_subtype": "resume",
        "sections": [
            {
                "section_type": "project",
                "section_title": "项目经历",
                "events": [
                    {
                        "event_type": "custom",
                        "title": "AI 求职助手",
                    }
                ],
            }
        ],
    }

    result = normalize_source_parse(raw)

    assert result.events[0].section_type == "projects"
    assert result.events[0].section_title == "项目"


def test_normalize_source_parse_uses_event_detail_section_for_custom_events():
    raw = {
        "source_type": "resume",
        "source_subtype": "resume",
        "sections": [
            {
                "section_type": "other",
                "section_title": "其他",
                "events": [
                    {
                        "event_type": "custom",
                        "title": "专业摘要",
                        "description": "具备算法服务和 Agent 工具链经验。",
                        "details": {"section_type": "summary"},
                    },
                    {
                        "event_type": "custom",
                        "title": "大模型与 Agent",
                        "details": {"section_type": "skills", "skills": ["LangGraph", "Tool Calling"]},
                    },
                ],
            }
        ],
    }

    result = normalize_source_parse(raw)

    assert result.events[0].section_type == "summary"
    assert result.events[0].section_title == "专业摘要"
    assert result.events[1].section_type == "skills"
    assert result.events[1].section_title == "技能"
    assert result.events[1].details_json["skills"] == ["LangGraph", "Tool Calling"]


def test_normalize_source_parse_keeps_education_honors_and_duplicates_them_into_award_events():
    raw = {
        "source_type": "resume",
        "source_subtype": "resume",
        "sections": [
            {
                "section_type": "education",
                "section_title": "教育",
                "events": [
                    {
                        "event_type": "education",
                        "title": "工学学士",
                        "organization": "中国石油大学（北京）",
                        "time_start": "2017-09",
                        "time_end": "2021-06",
                        "details": {
                            "field": "自动化",
                            "gpa": "88.60/100",
                            "honors": ["2021 年学业优秀奖学金（一等）", "全国大学生数学竞赛二等奖"],
                        },
                    }
                ],
            }
        ],
    }

    result = normalize_source_parse(raw)

    education_event = result.events[0]
    assert education_event.section_type == "education"
    assert education_event.details_json["honors"] == ["2021 年学业优秀奖学金（一等）", "全国大学生数学竞赛二等奖"]

    award_events = result.events[1:]
    assert [event.section_type for event in award_events] == ["awards", "awards"]
    assert [event.event_type for event in award_events] == ["award", "competition"]
    assert [event.title for event in award_events] == ["2021 年学业优秀奖学金（一等）", "全国大学生数学竞赛二等奖"]
    assert all(event.organization == "中国石油大学（北京）" for event in award_events)


def test_normalize_source_parse_clamps_invalid_time_precision():
    raw = {
        "source_type": "resume",
        "source_subtype": "resume",
        "sections": [
            {
                "events": [
                    {
                        "event_type": "project",
                        "title": "AI 求职助手",
                        "time_precision": "quarter",
                    }
                ],
            }
        ],
    }

    result = normalize_source_parse(raw)

    assert result.events[0].time_precision == "unknown"
