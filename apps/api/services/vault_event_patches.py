"""Field-level event update patches for Vault profile events."""

from __future__ import annotations

import copy
import uuid
from typing import Any


LIST_DIFF_FIELDS = {"details.bullets", "details.skills", "details.tech_stack", "tags"}


def build_event_diff(before: dict[str, Any], after: dict[str, Any]) -> list[dict[str, Any]]:
    diff: list[dict[str, Any]] = []
    for field_path in sorted(_field_paths(before) | _field_paths(after)):
        old_value = _get_path(before, field_path)
        new_value = _get_path(after, field_path)
        if old_value == new_value:
            continue
        if field_path in LIST_DIFF_FIELDS:
            diff.extend(_list_diff(field_path, old_value, new_value))
        else:
            diff.append({
                "field": field_path,
                "change_type": "replace",
                "old_value": old_value,
                "new_value": new_value,
            })
    return diff


def create_update_patch(
    before: dict[str, Any],
    after: dict[str, Any],
    source_ids: list[str],
    reason: str,
    status: str = "pending",
) -> dict[str, Any]:
    return {
        "id": f"patch_{uuid.uuid4().hex[:12]}",
        "patch_type": "update_event",
        "status": status,
        "source_ids": source_ids,
        "reason": reason,
        "before": copy.deepcopy(before),
        "after": copy.deepcopy(after),
        "diff": build_event_diff(before, after),
    }


def apply_patch_dict(current: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(patch["after"])


def revert_patch_dict(current: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(patch["before"])


def _field_paths(value: dict[str, Any], prefix: str = "") -> set[str]:
    paths: set[str] = set()
    for key, item in value.items():
        field_path = f"{prefix}.{key}" if prefix else key
        if isinstance(item, dict):
            nested = _field_paths(item, field_path)
            paths.update(nested or {field_path})
        else:
            paths.add(field_path)
    return paths


def _get_path(value: dict[str, Any], field_path: str) -> Any:
    current: Any = value
    for part in field_path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def _list_diff(field_path: str, old_value: Any, new_value: Any) -> list[dict[str, Any]]:
    old_items = _string_list(old_value)
    new_items = _string_list(new_value)
    changes: list[dict[str, Any]] = []
    for item in new_items:
        if item not in old_items:
            changes.append({
                "field": field_path,
                "change_type": "add",
                "old_value": None,
                "new_value": item,
            })
    for item in old_items:
        if item not in new_items:
            changes.append({
                "field": field_path,
                "change_type": "remove",
                "old_value": item,
                "new_value": None,
            })
    return changes


def _string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []
