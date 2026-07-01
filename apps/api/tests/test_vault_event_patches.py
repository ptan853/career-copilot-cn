from services.vault_event_patches import build_event_diff, apply_patch_dict, revert_patch_dict


def test_build_event_diff_shows_added_bullet_and_skill():
    before = {
        "title": "PM Agent",
        "details": {"bullets": ["设计 PM Agent。"], "skills": ["LangChain"]},
    }
    after = {
        "title": "PM Agent",
        "details": {
            "bullets": ["设计 PM Agent。", "支持项目、任务、人员信息的自然语言查询。"],
            "skills": ["LangChain", "LangGraph"],
        },
    }

    diff = build_event_diff(before, after)

    assert {
        "field": "details.bullets",
        "change_type": "add",
        "old_value": None,
        "new_value": "支持项目、任务、人员信息的自然语言查询。",
    } in diff
    assert {
        "field": "details.skills",
        "change_type": "add",
        "old_value": None,
        "new_value": "LangGraph",
    } in diff


def test_build_event_diff_shows_scalar_replace_and_removed_tag():
    before = {"title": "PM Agent", "tags": ["Agent", "草稿"], "details": {"url": "https://old.example"}}
    after = {"title": "PM Agent 平台", "tags": ["Agent"], "details": {"url": "https://new.example"}}

    diff = build_event_diff(before, after)

    assert {
        "field": "title",
        "change_type": "replace",
        "old_value": "PM Agent",
        "new_value": "PM Agent 平台",
    } in diff
    assert {
        "field": "tags",
        "change_type": "remove",
        "old_value": "草稿",
        "new_value": None,
    } in diff
    assert {
        "field": "details.url",
        "change_type": "replace",
        "old_value": "https://old.example",
        "new_value": "https://new.example",
    } in diff


def test_patch_can_be_applied_and_reverted():
    before = {"title": "PM Agent", "details": {"skills": ["LangChain"]}}
    after = {"title": "PM Agent", "details": {"skills": ["LangChain", "LangGraph"]}}
    patch = {"before": before, "after": after, "diff": build_event_diff(before, after)}

    assert apply_patch_dict(before, patch) == after
    assert revert_patch_dict(after, patch) == before
