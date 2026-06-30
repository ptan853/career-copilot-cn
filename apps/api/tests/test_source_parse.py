from services.source_parse import event_type_to_section, normalize_source_parse


def test_event_type_to_section_maps_known_types():
    assert event_type_to_section("work") == {
        "section_type": "work",
        "section_title": "工作经历",
    }
    assert event_type_to_section("internship") == {
        "section_type": "work",
        "section_title": "工作经历",
    }
    assert event_type_to_section("project") == {
        "section_type": "project",
        "section_title": "项目经历",
    }
    assert event_type_to_section("certification") == {
        "section_type": "credential",
        "section_title": "奖项证书",
    }


def test_event_type_to_section_falls_back_to_custom():
    assert event_type_to_section("unknown") == {
        "section_type": "custom",
        "section_title": "自定义",
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
    assert event.section_type == "work"
    assert event.section_title == "工作经历"
    assert event.event_type == "internship"
    assert event.details_json["needs_review_fields"] == ["outcome"]
    assert event.claims[0].evidence_quote == "负责增长实验设计"
    assert event.evidence[0].locator == {"page": 1}


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
    assert result.events[0].section_type == "work"
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

    assert result.events[0].section_type == "work"
    assert result.events[0].section_title == "工作经历"
    assert result.events[0].status == "draft"
