#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render LLM-readable Markdown companions from canonical JSON artifacts.

The JSON files remain the source of truth. This script only projects the same
data into compact, natural Markdown for review, prompting, and issue context.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import output_layout as layout  # noqa: E402


BRANCH_TYPES = ["parameter", "boundary", "exception", "quality", "constraint", "cross"]


def load_json(path: str, default: Any = None) -> Any:
    if not path or not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_text(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text.rstrip() + "\n")


def rel(path: str, output_dir: str) -> str:
    return layout.relpath(path, output_dir).replace(os.sep, "/")


def as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def inline(value: Any, empty: str = "-") -> str:
    if value is None or value == "":
        return empty
    if isinstance(value, list):
        return ", ".join(inline(v, "") for v in value if v not in (None, "")) or empty
    if isinstance(value, dict):
        parts = []
        for key, item in value.items():
            if item not in (None, "", [], {}):
                parts.append("%s=%s" % (key, inline(item, "")))
        return "; ".join(parts) or empty
    return str(value).replace("\n", " ").strip() or empty


def block(value: Any, empty: str = "-") -> str:
    if value is None or value == "":
        return empty
    if isinstance(value, str):
        return value.strip() or empty
    return json.dumps(value, ensure_ascii=False, indent=2)


def table(headers: list[str], rows: list[list[Any]]) -> str:
    out = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]
    if not rows:
        rows = [["-"] * len(headers)]
    for row in rows:
        safe = [inline(cell).replace("|", "\\|") for cell in row]
        out.append("| " + " | ".join(safe) + " |")
    return "\n".join(out)


def find_artifact(output_dir: str, canonical_key: str) -> str:
    return layout.existing_target_artifact(output_dir, canonical_key)


def scene_path_from_index(output_dir: str, scene_entry: dict[str, Any], default_dir: str) -> str:
    file_value = scene_entry.get("file") or ""
    candidates = []
    if file_value:
        candidates.extend([
            Path(output_dir) / file_value,
            Path(output_dir) / "FeatureAnalysis" / file_value,
            Path(output_dir) / ".state" / file_value,
        ])
    sid = scene_entry.get("id") or Path(file_value).stem
    if sid:
        candidates.append(Path(default_dir) / ("%s.json" % sid))
        candidates.append(Path(output_dir) / ".state" / "s1_scenarios" / ("%s.json" % sid))
        candidates.append(Path(output_dir) / ".state" / "s3a_enriched" / ("%s.json" % sid))
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return str(candidates[0]) if candidates else ""


def branch_counts(scene: dict[str, Any]) -> dict[str, int]:
    branches = scene.get("branches") or {}
    return {name: len(as_list(branches.get(name))) for name in BRANCH_TYPES}


def branch_summary_text(scene: dict[str, Any]) -> str:
    counts = branch_counts(scene)
    return " / ".join("%s %s" % (name, counts[name]) for name in BRANCH_TYPES)


def representative_branches(scene: dict[str, Any], limit: int = 6) -> list[list[Any]]:
    rows = []
    branches = scene.get("branches") or {}
    for branch_type in BRANCH_TYPES:
        for item in as_list(branches.get(branch_type)):
            if not isinstance(item, dict):
                continue
            trigger = item.get("trigger")
            expected = item.get("expected")
            if not trigger and item.get("values"):
                trigger = "values: " + inline(item.get("values"))
            if not trigger and item.get("sub_conditions"):
                trigger = "sub_conditions: " + inline(item.get("sub_conditions"))
            rows.append([
                item.get("id", "-"),
                branch_type,
                trigger,
                expected,
                item.get("test_suggestion_refs"),
            ])
            if len(rows) >= limit:
                return rows
    return rows


def render_scene_card(
    scene: dict[str, Any],
    source_path: str,
    output_dir: str,
    title_prefix: str = "Scenario",
) -> str:
    sid = scene.get("id", "unknown")
    title = scene.get("name") or sid
    lines = ["## %s %s - %s" % (title_prefix, sid, title)]
    if source_path:
        lines.append("- JSON source: `%s`" % rel(source_path, output_dir))
    lines.append("- Type/Priority: `%s` / `%s`" % (scene.get("type", "-"), scene.get("priority", "-")))
    lines.append("- Test type: `%s`" % scene.get("test_type", "scenario"))
    lines.append("- FP refs: %s" % inline(scene.get("fp_refs") or scene.get("fp_ref")))
    lines.append("- Test suggestion refs: %s" % inline(scene.get("test_suggestion_refs")))
    lines.append("- Branch summary: %s" % branch_summary_text(scene))

    verify_points = as_list(scene.get("verify_points"))
    if verify_points:
        lines.append("\n**Verify Points**")
        lines.extend("- %s" % inline(item) for item in verify_points)

    steps = [s for s in as_list(scene.get("steps")) if isinstance(s, dict)]
    if steps:
        lines.append("\n**Steps**")
        lines.append(table(
            ["Seq", "Action", "FP", "Check"],
            [[s.get("seq"), s.get("action"), s.get("fp_ref"), s.get("check")] for s in steps],
        ))

    branch_rows = representative_branches(scene)
    if branch_rows:
        lines.append("\n**Representative Branches**")
        lines.append(table(["ID", "Type", "Trigger", "Expected", "TS refs"], branch_rows))

    exploration = scene.get("exploration_log")
    if exploration:
        lines.append("\n**Exploration Log**")
        lines.append("- %s" % inline(exploration))
    return "\n".join(lines)


def render_test_suggestion_ledger(index_data: dict[str, Any]) -> str:
    suggestions = [s for s in as_list(index_data.get("test_suggestions")) if isinstance(s, dict)]
    if not suggestions:
        return ""
    rows = []
    for item in suggestions:
        rows.append([
            item.get("id"),
            item.get("priority"),
            item.get("method"),
            item.get("status"),
            item.get("focus"),
            item.get("source"),
        ])
    return "\n\n## Test Suggestion Ledger\n" + table(
        ["ID", "Priority", "Method", "Status", "Focus", "Source"], rows
    )


def render_s1(output_dir: str) -> str | None:
    index_path = find_artifact(output_dir, "s1_index")
    index_data = load_json(index_path, {})
    if not index_data:
        return None
    lines = [
        "# Stage 1 Scenario Examples",
        "",
        "Generated from JSON artifacts. JSON remains authoritative.",
        "",
        "- Index source: `%s`" % rel(index_path, output_dir),
        "- Function points: %s" % len(as_list(index_data.get("function_points"))),
        "- Scenario entries: %s" % len(as_list(index_data.get("scenario_index"))),
    ]
    default_dir = layout.s1_scenarios_dir(output_dir)
    for entry in as_list(index_data.get("scenario_index")):
        if not isinstance(entry, dict):
            continue
        scene_path = scene_path_from_index(output_dir, entry, default_dir)
        scene = load_json(scene_path, None) or dict(entry)
        scene.setdefault("fp_refs", entry.get("fp_refs", []))
        scene.setdefault("test_suggestion_refs", entry.get("test_suggestion_refs", []))
        lines.append("")
        lines.append(render_scene_card(scene, scene_path, output_dir))
    ledger = render_test_suggestion_ledger(index_data)
    if ledger:
        lines.append(ledger)
    out_path = layout.target_artifact(output_dir, "s1_scenario_examples", create_parent=True)
    write_text(out_path, "\n".join(lines))
    return out_path


def render_s3a(output_dir: str) -> str | None:
    lines = [
        "# Stage 3 Scenario Landscape",
        "",
        "Generated from enriched scenario JSON and framework scenario JSON. JSON remains authoritative.",
    ]
    rendered = 0
    enriched_index_path = find_artifact(output_dir, "s3a_enriched_index")
    enriched_index = load_json(enriched_index_path, {})
    if enriched_index:
        lines.extend([
            "",
            "- Enriched index source: `%s`" % rel(enriched_index_path, output_dir),
            "- Enriched scenarios: %s" % len(as_list(enriched_index.get("scenario_index"))),
        ])
        default_dir = layout.s3a_enriched_dir(output_dir)
        for entry in as_list(enriched_index.get("scenario_index")):
            if not isinstance(entry, dict):
                continue
            scene_path = scene_path_from_index(output_dir, entry, default_dir)
            scene = load_json(scene_path, None) or dict(entry)
            scene.setdefault("fp_refs", entry.get("fp_refs", []))
            lines.append("")
            lines.append(render_scene_card(scene, scene_path, output_dir, "Enriched Scenario"))
            rendered += 1

    framework_path = find_artifact(output_dir, "s3a_framework")
    framework_data = load_json(framework_path, {})
    framework_scenarios = [s for s in as_list(framework_data.get("framework_scenarios")) if isinstance(s, dict)]
    if framework_scenarios:
        lines.extend(["", "## Framework Scenarios", "", "- JSON source: `%s`" % rel(framework_path, output_dir)])
        for scene in framework_scenarios:
            lines.append("")
            lines.append(render_scene_card(scene, framework_path, output_dir, "Framework Scenario"))
            rendered += 1

    e2e_path = find_artifact(output_dir, "e2e_scenes_json")
    e2e_data = load_json(e2e_path, {})
    if not rendered and e2e_data:
        scenarios = [s for s in as_list(e2e_data.get("flow_scenarios")) if isinstance(s, dict)]
        lines.extend(["", "- E2E scene source: `%s`" % rel(e2e_path, output_dir)])
        for scene in scenarios:
            lines.append("")
            lines.append(render_scene_card(scene, e2e_path, output_dir, "E2E Scenario"))
            rendered += 1

    if not rendered:
        return None
    out_path = layout.target_artifact(output_dir, "s3a_scenario_landscape", create_parent=True)
    write_text(out_path, "\n".join(lines))
    return out_path


def load_cases(output_dir: str) -> tuple[str, list[dict[str, Any]]]:
    path = find_artifact(output_dir, "test_design")
    data = load_json(path, [])
    if isinstance(data, list):
        cases = data
    elif isinstance(data, dict):
        cases = []
        for key in ("cases", "test_cases"):
            if isinstance(data.get(key), list):
                cases = data[key]
                break
    else:
        cases = []
    return path, [c for c in cases if isinstance(c, dict)]


def render_refs_table(refs: Any, headers: list[str]) -> str:
    rows = []
    for item in as_list(refs):
        if isinstance(item, dict):
            rows.append([item.get(h) for h in headers])
        else:
            rows.append([item] + [""] * (len(headers) - 1))
    return table(headers, rows)


def render_case_card(case: dict[str, Any], source_path: str, output_dir: str) -> str:
    cid = case.get("case_id") or case.get("id") or "unknown"
    title = case.get("name") or cid
    lines = ["## Test Case %s - %s" % (cid, title)]
    lines.append("- JSON source: `%s`" % rel(source_path, output_dir))
    lines.append("- Kind/Priority/Test type: `%s` / `%s` / `%s`" % (
        case.get("case_kind", "-"), case.get("priority", "-"), case.get("test_type", "scenario")
    ))
    lines.append("- Source scene: `%s`" % case.get("source_scene", "-"))
    lines.append("- Test suggestion refs: %s" % inline(case.get("test_suggestion_refs")))
    lines.append("- Fault ref: %s" % inline(case.get("fault_ref")))
    lines.append("- Evidence required: %s" % inline(case.get("evidence_required")))

    if case.get("preconditions"):
        lines.append("\n**Preconditions**")
        lines.extend("- %s" % inline(item) for item in as_list(case.get("preconditions")))

    if case.get("steps"):
        lines.append("\n**Steps**")
        lines.append("```text\n%s\n```" % block(case.get("steps")))

    if case.get("expected"):
        lines.append("\n**Expected**")
        lines.append("```text\n%s\n```" % block(case.get("expected")))

    if case.get("oracle_refs"):
        lines.append("\n**Oracle Refs**")
        lines.append(render_refs_table(case.get("oracle_refs"), ["spec_id", "assert_level", "field", "authority"]))

    if case.get("fault_oracles"):
        lines.append("\n**Fault Oracles**")
        lines.append(render_refs_table(case.get("fault_oracles"), ["id", "kind", "check", "required", "authority", "spec_id"]))

    if case.get("acceptance_refs"):
        lines.append("\n**Acceptance Refs**")
        lines.append(render_refs_table(case.get("acceptance_refs"), ["standard_id", "dimension", "release_gate"]))

    if case.get("truncated_branches"):
        lines.append("\n**Truncated Branches**")
        lines.append(render_refs_table(case.get("truncated_branches"), ["id", "reason"]))

    return "\n".join(lines)


def render_tests(output_dir: str) -> str | None:
    source_path, cases = load_cases(output_dir)
    if not cases:
        return None
    lines = [
        "# Stage 3 Test Examples",
        "",
        "Generated from test design JSON. JSON remains authoritative.",
        "",
        "- Test design source: `%s`" % rel(source_path, output_dir),
        "- Test cases: %s" % len(cases),
    ]
    for case in cases:
        lines.append("")
        lines.append(render_case_card(case, source_path, output_dir))
    out_path = layout.target_artifact(output_dir, "test_examples", create_parent=True)
    write_text(out_path, "\n".join(lines))
    return out_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Render AutoTestFlow design Markdown companions")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--stage", choices=["all", "s1", "s3a", "test"], default="all")
    args = parser.parse_args(argv)

    generated = []
    if args.stage in ("all", "s1"):
        generated.append(render_s1(args.output_dir))
    if args.stage in ("all", "s3a"):
        generated.append(render_s3a(args.output_dir))
    if args.stage in ("all", "test"):
        generated.append(render_tests(args.output_dir))

    paths = [p for p in generated if p]
    if paths:
        for path in paths:
            print("[render_design_markdown] wrote %s" % path)
    else:
        print("[render_design_markdown] no matching JSON artifacts found")
    return 0


if __name__ == "__main__":
    sys.exit(main())
