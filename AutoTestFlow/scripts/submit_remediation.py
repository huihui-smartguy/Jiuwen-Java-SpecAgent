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
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "reference"))
from remediation_config import (  # noqa: E402
    load_json, save_json, load_config, resolve_config_path, ConfigError, upstream_slug,
)


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
    return open(path, encoding="utf-8").read() if os.path.exists(path) else ""


def _clip(text, limit=6000):
    if len(text) <= limit:
        return text
    return text[:limit] + "\n\n... [truncated for issue body]\n"


def _rel(path, base):
    return os.path.relpath(path, base) if path and os.path.exists(path) else path


def _load_manifests(rem_dir, output_dir):
    rem_manifest = load_json(os.path.join(rem_dir, "manifest.json")) if \
        os.path.exists(os.path.join(rem_dir, "manifest.json")) else {"defects": []}
    analysis_manifest_path = os.path.join(output_dir, ".state", "fault_analysis", "manifest.json")
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
    rem_case = os.path.join(rem_dir, "defects", case or "")
    if case and os.path.isdir(rem_case):
        return rem_case
    analysis_case = os.path.join(output_dir, ".state", "fault_analysis", "targets", entry.get("target_id") or case or "")
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
    issue = _read(os.path.join(artifact_dir, "issue.md"))
    root_cause = _read(os.path.join(artifact_dir, "root_cause.md"))
    fix_solution = _read(os.path.join(artifact_dir, "fix_solution.md"))
    patch = _read(os.path.join(artifact_dir, "patch.diff"))
    regression = _read(os.path.join(artifact_dir, "regression_test.diff"))
    evidence = _read(os.path.join(artifact_dir, "evidence.json"))

    parts = []
    parts.append(issue or "# Evidence issue for %s\n\nStage6 did not provide issue.md." % case)
    parts.append("\n\n## Stage6 analysis metadata\n")
    parts.append("- case_id: %s" % case)
    parts.append("- target_id: %s" % entry.get("target_id", case))
    parts.append("- analysis_type: %s" % entry.get("analysis_type", "unknown"))
    parts.append("- domain: %s" % entry.get("domain", "unknown"))
    parts.append("- fault_id: %s" % (entry.get("fault_id") or "-"))
    parts.append("- evidence_level: %s" % entry.get("evidence_level", "unknown"))
    parts.append("- recommended_action: %s" % entry.get("recommended_action", "unknown"))
    parts.append("- confidence: %s" % entry.get("confidence", "unknown"))
    parts.append("- needs_human: %s" % entry.get("needs_human", True))

    parts.append("\n\n## Proposed fixed solution\n")
    if fix_solution:
        parts.append(fix_solution)
    elif root_cause:
        parts.append(root_cause)
    else:
        parts.append("No standalone fix_solution.md/root_cause.md was produced; see Stage6 metadata and patch summary.")

    parts.append("\n\n## Empirical reverify evidence\n")
    parts.append(_reverify_block(case, reverify))

    if evidence:
        parts.append("\n\n## Structured evidence\n")
        parts.append("```json\n%s\n```" % _clip(evidence, 4000))

    if patch:
        parts.append("\n\n## Patch summary / excerpt\n")
        parts.append("Source: `%s`\n" % _rel(os.path.join(artifact_dir, "patch.diff"), output_dir))
        parts.append("```diff\n%s\n```" % _clip(patch, 5000))
    else:
        parts.append("\n\n## Patch summary / excerpt\n")
        parts.append("No patch.diff was produced; this is an issue-only diagnostic or needs-human target.")

    if regression:
        parts.append("\n\n## Regression test excerpt\n")
        parts.append("```diff\n%s\n```" % _clip(regression, 3000))

    return "\n".join(parts).rstrip() + "\n"


def main():
    parser = argparse.ArgumentParser(description="stage7 evidence issue submission (issue-only)")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--remediation-config", default=None)
    parser.add_argument("--work-dir", default=None)
    parser.add_argument("--remediate", default="dry-run", choices=["off", "dry-run", "on"])
    parser.add_argument("--gate-confirmed", action="store_true",
                        help="orchestrator passes this after the human confirmation gate")
    parser.add_argument("--issue-only", action="store_true",
                        help="deprecated no-op; submission is always issue-only")
    args = parser.parse_args()

    rem_dir = os.path.join(args.output_dir, ".state", "remediation")
    submitted = {
        "generated_by": "submit_remediation.py",
        "schema_version": "2.1",
        "mode": "dry-run",
        "issues": [],
        "skipped": [],
        "deprecated": {"pr_submission": "removed", "push": "removed"},
    }

    def finish(msg):
        save_json(os.path.join(rem_dir, "submitted.json"), submitted)
        print("[submit_remediation] %s" % msg)
        return 0

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
    reverify = load_json(os.path.join(rem_dir, "reverify.json")) if \
        os.path.exists(os.path.join(rem_dir, "reverify.json")) else {}
    candidates = _load_manifests(rem_dir, args.output_dir)
    body_dir = os.path.join(rem_dir, "issue_bodies")
    os.makedirs(body_dir, exist_ok=True)

    for d in candidates:
        case = d.get("case_id") or d.get("target_id")
        if not case:
            continue
        artifact_dir = _artifact_dir(rem_dir, args.output_dir, d)
        title = d.get("issue_title") or ("[fault-analysis] %s (%s)" % (d.get("spec_id") or d.get("fault_id") or "target", case))
        body = _build_issue_body(args.output_dir, rem_dir, d, artifact_dir, reverify)
        body_fp = os.path.join(body_dir, "%s.md" % case)
        with open(body_fp, "w", encoding="utf-8") as f:
            f.write(body)

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
