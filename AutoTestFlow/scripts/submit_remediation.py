#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
submit_remediation.py - stage7 evidence issue submission (issue-only)

Only creates upstream issues after:
  - --remediate=on
  - --gate-confirmed
  - switches.allow_open_issue=true

The script never pushes branches and never creates PRs. Issue bodies are assembled from stage6
analysis artifacts plus stage7 empirical reverify evidence, so submission remains in stage7.

Usage:
    python submit_remediation.py --output-dir <dir> --remediate dry-run|on \
        [--gate-confirmed] [--remediation-config <path>]
"""

import argparse
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "reference"))
from remediation_config import (  # noqa: E402
    load_json, save_json, load_config, resolve_config_path, ConfigError, upstream_slug,
)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import output_layout as layout  # noqa: E402


def _run(cmd, cwd=None, timeout=120):
    """Run an external gh command. Return (rc, out) without raising."""
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, ((p.stdout or "") + (p.stderr or "")).strip()
    except FileNotFoundError as e:
        return 127, "command not found: %r" % e
    except Exception as e:  # pragma: no cover - defensive
        return 1, repr(e)


def _read(path):
    if not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8") as f:
        return f.read()


def _clip(text, limit=6000):
    if len(text) <= limit:
        return text
    return text[:limit] + "\n\n... [truncated for issue body]\n"


def _rel(path, base):
    return os.path.relpath(path, base) if path and os.path.exists(path) else path


def _first_heading(text):
    for line in (text or "").splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip()
    return ""


def _strip_first_heading(text):
    lines = (text or "").splitlines()
    for idx, line in enumerate(lines):
        if line.strip().startswith("#"):
            return "\n".join(lines[:idx] + lines[idx + 1:]).strip()
    return (text or "").strip()


def _issue_title(entry, issue_text, case):
    return (
        entry.get("issue_title") or
        _first_heading(issue_text) or
        "[fault-analysis] %s (%s)" % (entry.get("spec_id") or entry.get("fault_id") or "target", case)
    )


def _append_section(parts, title, body, fallback):
    parts.append("\n\n## %s\n" % title)
    content = (body or "").strip()
    parts.append(content if content else fallback)


def _json_object(text):
    if not text:
        return {}
    try:
        data = json.loads(text)
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _evidence_value(evidence_data, *keys):
    for key in keys:
        value = evidence_data.get(key)
        if value not in (None, "", [], {}):
            return value
    return None


def _format_value(value):
    if value in (None, "", [], {}):
        return "-"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _load_manifests(rem_dir, output_dir):
    rem_manifest_path = layout.existing_target_artifact(output_dir, "remediation_manifest")
    rem_manifest = load_json(rem_manifest_path) if os.path.exists(rem_manifest_path) else {"defects": []}
    analysis_manifest_path = layout.existing_target_artifact(output_dir, "fault_analysis_manifest")
    analysis_manifest = load_json(analysis_manifest_path) if os.path.exists(analysis_manifest_path) else {"targets": []}

    candidates = []
    seen = set()
    for d in rem_manifest.get("defects", []):
        key = d.get("case_id") or d.get("target_id")
        if key:
            candidates.append(d)
            seen.add(key)
    for d in analysis_manifest.get("targets", []):
        key = d.get("case_id") or d.get("target_id")
        if key and key not in seen and d.get("publishable"):
            candidates.append(d)
            seen.add(key)
    return candidates


def _artifact_dir(rem_dir, output_dir, entry):
    case = entry.get("case_id") or entry.get("target_id")
    rem_case = layout.existing_remediation_defect_dir(output_dir, case or "")
    if case and os.path.isdir(rem_case):
        return rem_case
    analysis_case = layout.existing_fault_analysis_target_dir(output_dir, entry.get("target_id") or case or "")
    if os.path.isdir(analysis_case):
        return analysis_case
    return rem_case


def _reverify_block(case, reverify):
    if not reverify:
        return "No reverify.json was produced."
    defect = (reverify.get("defects") or {}).get(case, {})
    lines = [
        "- mode: %s" % reverify.get("mode", "unknown"),
        "- build: %s" % reverify.get("build", "unknown"),
        "- sut_ready: %s" % reverify.get("sut_ready", "unknown"),
        "- selftest: %s" % reverify.get("selftest", "unknown"),
        "- before: %s" % defect.get("before", "unknown"),
        "- after: %s" % defect.get("after", "not_reverified"),
        "- applied: %s" % defect.get("applied", "not_applied"),
    ]
    if defect.get("apply_error"):
        lines.append("- apply_error: %s" % defect["apply_error"])
    if reverify.get("branch"):
        lines.append("- local_verification_branch: %s" % reverify["branch"])
    return "\n".join(lines)


def _build_issue_body(output_dir, rem_dir, entry, artifact_dir, reverify):
    case = entry.get("case_id") or entry.get("target_id") or "unknown"
    issue_raw = _read(os.path.join(artifact_dir, "issue.md"))
    issue = _strip_first_heading(issue_raw)
    root_cause = _read(os.path.join(artifact_dir, "root_cause.md"))
    fix_solution = _read(os.path.join(artifact_dir, "fix_solution.md"))
    patch = _read(os.path.join(artifact_dir, "patch.diff"))
    regression = _read(os.path.join(artifact_dir, "regression_test.diff"))
    evidence = _read(os.path.join(artifact_dir, "evidence.json"))
    evidence_data = _json_object(evidence)

    parts = []
    parts.append("# %s" % _issue_title(entry, issue_raw, case))
    _append_section(
        parts,
        "Problem",
        issue,
        "Stage6 did not provide issue.md. Review the metadata and evidence sections below for the target.",
    )
    _append_section(
        parts,
        "Root Cause",
        root_cause,
        "Stage6 did not provide root_cause.md. Treat this issue as needing human localization.",
    )

    positioning = [
        "The issue is positioned by correlating the authoritative contract or fault knowledge with "
        "the failing run evidence, then checking the localized source or runtime evidence recorded by Stage6.",
        "",
        "- contract_refs: %s" % _format_value(_evidence_value(evidence_data, "contract_refs", "contract_ref")),
        "- fault_ref: %s" % (entry.get("fault_id") or _format_value(_evidence_value(evidence_data, "fault_ref", "fault_id"))),
        "- trace_refs: %s" % _format_value(_evidence_value(evidence_data, "trace_refs", "trace_ref")),
        "- source_refs: %s" % _format_value(_evidence_value(evidence_data, "source_refs", "source_ref", "source_location")),
        "",
        "- case_id: %s" % case,
        "- target_id: %s" % entry.get("target_id", case),
        "- analysis_type: %s" % entry.get("analysis_type", "unknown"),
        "- domain: %s" % entry.get("domain", "unknown"),
        "- fault_id: %s" % (entry.get("fault_id") or "-"),
        "- spec_id: %s" % (entry.get("spec_id") or "-"),
        "- evidence_level: %s" % entry.get("evidence_level", "unknown"),
        "- recommended_action: %s" % entry.get("recommended_action", "unknown"),
        "- confidence: %s" % entry.get("confidence", "unknown"),
        "- needs_human: %s" % entry.get("needs_human", True),
        "- stage6_artifact_dir: `%s`" % _rel(artifact_dir, output_dir),
    ]
    _append_section(parts, "Problem Positioning Process", "\n".join(positioning), "")
    _append_section(
        parts,
        "Fix Construction",
        fix_solution,
        "Stage6 did not provide fix_solution.md. Use the root-cause and evidence sections to plan the repair.",
    )
    _append_section(parts, "Empirical Reverify Evidence", _reverify_block(case, reverify), "")

    if evidence:
        parts.append("\n\n## Structured Evidence\n")
        parts.append("```json\n%s\n```" % _clip(evidence, 4000))

    if patch:
        parts.append("\n\n## Patch Summary / Excerpt\n")
        parts.append("Source: `%s`\n" % _rel(os.path.join(artifact_dir, "patch.diff"), output_dir))
        parts.append("```diff\n%s\n```" % _clip(patch, 5000))
    else:
        parts.append("\n\n## Patch Summary / Excerpt\n")
        parts.append("No patch.diff was produced; this is an issue-only diagnostic or needs-human target.")

    if regression:
        parts.append("\n\n## Regression Test Excerpt\n")
        parts.append("```diff\n%s\n```" % _clip(regression, 3000))

    return "\n".join(parts).rstrip() + "\n"


def _public_body_record(record, output_dir):
    return {
        "case_id": record["case_id"],
        "target_id": record["entry"].get("target_id", record["case_id"]),
        "title": record["title"],
        "body_file": record["body_file"],
        "body_file_rel": _rel(record["body_file"], output_dir),
        "artifact_dir": _rel(record["artifact_dir"], output_dir),
    }


def _generate_issue_bodies(output_dir, rem_dir, reverify):
    body_dir = layout.target_dir(output_dir, "remediation_issue_bodies", create=True)
    os.makedirs(body_dir, exist_ok=True)
    records = []
    for d in _load_manifests(rem_dir, output_dir):
        case = d.get("case_id") or d.get("target_id")
        if not case:
            continue
        artifact_dir = _artifact_dir(rem_dir, output_dir, d)
        issue_text = _read(os.path.join(artifact_dir, "issue.md"))
        title = _issue_title(d, issue_text, case)
        body = _build_issue_body(output_dir, rem_dir, d, artifact_dir, reverify)
        body_fp = os.path.join(body_dir, "%s.md" % case)
        with open(body_fp, "w", encoding="utf-8") as f:
            f.write(body)
        records.append({
            "case_id": case,
            "entry": d,
            "title": title,
            "body_file": body_fp,
            "artifact_dir": artifact_dir,
        })
    return records


def main(argv=None):
    parser = argparse.ArgumentParser(description="stage7 evidence issue submission (issue-only)")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--remediation-config", default=None)
    parser.add_argument("--work-dir", default=None)
    parser.add_argument("--remediate", default="dry-run", choices=["off", "dry-run", "on"])
    parser.add_argument("--gate-confirmed", action="store_true",
                        help="orchestrator passes this after the human confirmation gate")
    parser.add_argument("--issue-only", action="store_true",
                        help="deprecated no-op; submission is always issue-only")
    args = parser.parse_args(argv)

    rem_dir = layout.target_dir(args.output_dir, "remediation", create=True)
    submitted = {
        "generated_by": "submit_remediation.py",
        "schema_version": "2.1",
        "mode": "dry-run",
        "issues": [],
        "skipped": [],
        "deprecated": {"pr_submission": "removed", "push": "removed"},
    }

    def finish(msg):
        save_json(layout.target_artifact(args.output_dir, "remediation_submitted", create_parent=True), submitted)
        print("[submit_remediation] %s" % msg)
        return 0

    reverify_path = layout.existing_target_artifact(args.output_dir, "remediation_reverify")
    reverify = load_json(reverify_path) if os.path.exists(reverify_path) else {}
    body_records = _generate_issue_bodies(args.output_dir, rem_dir, reverify)
    submitted["issue_bodies"] = [_public_body_record(r, args.output_dir) for r in body_records]

    cfg_path = resolve_config_path(args.output_dir, args.work_dir, args.remediation_config)
    if not cfg_path:
        submitted["skipped"].append({"action": "issue", "reason": "no remediation config"})
        return finish("无配置，跳过。")
    try:
        cfg = load_config(cfg_path)
    except ConfigError as e:
        submitted["skipped"].append({"action": "issue", "reason": "config_error: %s" % e})
        return finish("配置非法：%s" % e)

    is_on = (args.remediate == "on") and args.gate_confirmed
    if not is_on:
        submitted["mode"] = "dry-run"
        submitted["skipped"].append({
            "action": "issue",
            "reason": "remediate=%s gate_confirmed=%s（非 on 或未过门）" %
                      (args.remediate, args.gate_confirmed)})
        return finish("dry-run：未做任何外发动作（issue 跳过）。")

    sw = cfg["switches"]
    submitted["mode"] = "issue-only"
    if not sw.get("allow_open_issue"):
        submitted["skipped"].append({"action": "issue", "reason": "allow_open_issue=false"})
        return finish("issue disabled by config.")

    slug = upstream_slug(cfg["repo"]["upstream_url"])
    for record in body_records:
        case = record["case_id"]
        title = record["title"]
        body_fp = record["body_file"]

        rc, out = _run(["gh", "issue", "list", "--repo", slug, "--search", case,
                        "--json", "url", "-q", ".[0].url"])
        if rc == 0 and out.startswith("http"):
            submitted["issues"].append({"case_id": case, "url": out, "reused": True,
                                        "body_file": body_fp})
            continue
        cmd = ["gh", "issue", "create", "--repo", slug, "--title", title,
               "--body-file", body_fp]
        for lb in cfg["issue"].get("labels", []):
            cmd += ["--label", lb]
        rc, out = _run(cmd)
        submitted["issues"].append({"case_id": case, "url": out if rc == 0 else None,
                                    "ok": rc == 0, "detail": None if rc == 0 else out[-300:],
                                    "body_file": body_fp})

    return finish("mode=issue-only issues=%d skipped=%d" % (
        len(submitted["issues"]), len(submitted["skipped"])))


if __name__ == "__main__":
    sys.exit(main())
