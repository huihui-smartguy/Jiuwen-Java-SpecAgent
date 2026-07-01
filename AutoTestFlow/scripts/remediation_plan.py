#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
remediation_plan.py - stage6 fault analysis planner + compatibility remediation worklist

prep (default):
  - reads TestRun/results/*.json, KnowledgeBase/fault_matches.json,
    TestCases/test_design.json, Contract/contract.md, and
    known fault libraries
  - writes FaultAnalysis/analysis_plan.json for all actionable/diagnostic targets
  - writes Remediation/plan.json only for the patchable contract-backed subset

finalize (--finalize):
  - summarizes stage6 artifacts into FaultAnalysis/manifest.json
  - preserves Remediation/manifest.json for stage7 apply/reverify compatibility

Pure deterministic preprocessing/postprocessing. Stage6 remains side-effect free; stage7 alone
may apply patches, reverify, and submit evidence-rich issues after the human gate.
"""

import argparse
import json
import os
import re
import sys
from glob import glob

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "reference"))
from remediation_config import load_json, save_json  # noqa: E402
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import output_layout as layout  # noqa: E402


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
REPO_ROOT = os.path.abspath(os.path.join(SKILL_DIR, ".."))
PROFILE_PATH = os.path.join(SKILL_DIR, "shared", "fault_analysis_profiles.json")


def _load_json_if(path, default):
    if path and os.path.exists(path):
        return load_json(path)
    return default


def _safe_id(text):
    out = re.sub(r"[^A-Za-z0-9_.-]+", "_", text or "")
    return out.strip("_") or "target"


def _as_list(value):
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _status_of(result):
    return (result.get("class") or result.get("status") or "").strip().lower()


def _case_id_from(path, result):
    return result.get("case_id") or os.path.basename(path).replace(".json", "")


def _contract_authority(output_dir, spec_id):
    """Minimal parser for contract.md §7 authority table."""
    if not spec_id:
        return "unknown"
    path = layout.existing_target_artifact(output_dir, "contract")
    if not os.path.exists(path):
        return "unknown"
    with open(path, encoding="utf-8") as f:
        text = f.read()

    def checked(cell):
        return bool(re.search(r"[✅✔√xX]|yes|YES|是", cell.strip()))

    for line in text.splitlines():
        if spec_id not in line or "|" not in line:
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if not cells or not any(c == spec_id or c.startswith(spec_id + " ") for c in cells):
            continue
        try:
            idx = next(i for i, c in enumerate(cells) if c == spec_id or c.startswith(spec_id + " "))
        except StopIteration:
            continue
        tri = cells[idx + 2:idx + 5]
        if len(tri) >= 3:
            if checked(tri[0]):
                return "spec-required"
            if checked(tri[1]):
                return "deployment-config-dependent"
            if checked(tri[2]):
                return "needs-runtime-verify"
    return "unknown"


def _discover_fault_libs():
    patterns = [
        os.path.join(REPO_ROOT, "TestKnowledgeBase", "Fault", "*_faults.json"),
        os.path.join(REPO_ROOT, "Specification_Repository", "rest_api_common_faults.json"),
    ]
    out = []
    for pat in patterns:
        out.extend(sorted(glob(pat)))
    return out


def _load_fault_library_index():
    index = {}
    meta = []
    for path in _discover_fault_libs():
        try:
            doc = load_json(path)
        except Exception:
            continue
        rel = os.path.relpath(path, REPO_ROOT)
        meta.append({
            "path": rel,
            "version": (doc.get("meta") or {}).get("version"),
            "description": (doc.get("meta") or {}).get("description", ""),
        })
        for cat in doc.get("fault_categories", []):
            cid = cat.get("category_id", "")
            cname = cat.get("category_name", "")
            for f in cat.get("faults", []):
                fid = f.get("fault_id")
                if not fid:
                    continue
                item = dict(f)
                item["_library_path"] = rel
                item["_category"] = cid
                item["_category_name"] = cname
                index.setdefault(fid, item)
        for f in doc.get("history_faults", []):
            fid = f.get("fault_id")
            if not fid:
                continue
            item = dict(f)
            item["_library_path"] = rel
            item["_category"] = "HISTORY"
            item["_category_name"] = "历史缺陷"
            index.setdefault(fid, item)
    return index, meta


def _load_profiles():
    doc = _load_json_if(PROFILE_PATH, {})
    default = doc.get("default_profile") or {
        "id": "generic_future_fault",
        "domain": "future_failure_mode",
        "analysis_type": "fault_pattern_regression",
        "recommended_action": "needs_human_review",
    }
    return doc.get("profiles", []), default, doc.get("schema_version", "fallback")


def _load_results(output_dir):
    out = {}
    for fp in layout.existing_glob(output_dir, "TestRun/results/*.json", ".state/results/*.json"):
        r = load_json(fp)
        out[_case_id_from(fp, r)] = r
    return out


def _load_case_context(output_dir):
    ctx = {}
    td_path = layout.existing_target_artifact(output_dir, "test_design")
    if not os.path.exists(td_path):
        return ctx
    try:
        td = load_json(td_path)
    except Exception:
        return ctx
    cases = td if isinstance(td, list) else td.get("cases", [])
    for c in cases:
        cid = c.get("case_id") or c.get("id")
        if not cid:
            continue
        ctx[cid] = {
            "fault_ref": c.get("fault_ref"),
            "name": c.get("name", ""),
            "priority": c.get("priority", ""),
            "case_kind": c.get("case_kind", ""),
            "source_scene": c.get("source_scene") or c.get("source_scene_id"),
        }
    return ctx


def _load_fault_matches(output_dir):
    plan = _load_json_if(layout.existing_target_artifact(output_dir, "fault_matches"), {})
    matches = {}
    by_scene = []
    for m in plan.get("fault_matches", []):
        fid = m.get("fault_id")
        if fid:
            matches.setdefault(fid, m)
        by_scene.append(m)
    return matches, by_scene, plan.get("meta", {})


def _match_profile(fault_ref, match, fault_doc, profiles, default_profile):
    tags = set(_as_list((match or {}).get("tags")) + _as_list((fault_doc or {}).get("tags")))
    apps = set(_as_list((fault_doc or {}).get("applicable_scenarios")) +
               _as_list((match or {}).get("applicable_scenarios")))
    category = ((fault_doc or {}).get("_category") or (match or {}).get("_category") or
                (match or {}).get("category_id") or "")
    hay = " ".join([fault_ref or "", category] + sorted(tags) + sorted(apps) +
                   [(match or {}).get("name", ""), (fault_doc or {}).get("name", "")])
    for profile in profiles:
        if any((fault_ref or "").startswith(p) for p in profile.get("fault_id_prefixes", [])):
            return profile
        if any(category.startswith(p) for p in profile.get("category_prefixes", [])):
            return profile
    for profile in profiles:
        if any(a in apps for a in profile.get("applicable_scenarios", [])):
            return profile
        if any(k and k in hay for k in profile.get("tag_keywords", [])):
            return profile
    return default_profile


def _fault_context(fault_ref, match, fault_doc):
    return {
        "fault_id": fault_ref,
        "name": (match or {}).get("name") or (fault_doc or {}).get("name", ""),
        "severity": (match or {}).get("severity") or (fault_doc or {}).get("severity", ""),
        "category": (fault_doc or {}).get("_category") or (match or {}).get("_category", ""),
        "source": (match or {}).get("source") or (fault_doc or {}).get("source", {}),
        "library_path": (fault_doc or {}).get("_library_path"),
        "trigger": (match or {}).get("trigger") or ((fault_doc or {}).get("test_strategy") or {}).get("trigger_pattern", ""),
        "expected_behavior_raw": (
            (match or {}).get("expected_behavior_raw") or
            ((fault_doc or {}).get("test_strategy") or {}).get("expected_behavior", "")
        ),
        "oracle_refs": (match or {}).get("oracle_refs", []),
        "fault_oracles": (match or {}).get("fault_oracles", []),
        "validation_points": ((fault_doc or {}).get("test_strategy") or {}).get("validation_points", []),
        "match_reason": (match or {}).get("match_reason", []),
    }


def _target_from_result(case_id, result, ctx, matches, fault_index, profiles, default_profile, output_dir):
    sd = result.get("sdk_defect") or result.get("sdk_bug") or {}
    status = _status_of(result)
    fault_ref = result.get("fault_ref") or ctx.get("fault_ref")
    match = matches.get(fault_ref, {}) if fault_ref else {}
    fault_doc = fault_index.get(fault_ref, {}) if fault_ref else {}
    profile = _match_profile(fault_ref, match, fault_doc, profiles, default_profile)
    spec_id = sd.get("spec_id", "")
    authority = _contract_authority(output_dir, spec_id)
    patchable = status == "sdk_defect" and authority == "spec-required"
    has_fault_oracle_evidence = bool(result.get("fault_oracle_summary"))
    evidence_level = "contract_trace" if patchable else (
        "fault_oracle_trace" if has_fault_oracle_evidence else
        "runtime_trace" if result.get("trace_file") else "result_summary"
    )
    if patchable:
        analysis_type = "patchable_contract_defect"
        recommended_action = "patch_and_reverify"
        publishable = True
        needs_human = False
    elif status == "sdk_defect":
        analysis_type = "issue_only_contract_defect"
        recommended_action = "open_evidence_issue"
        publishable = True
        needs_human = True
    elif status in ("sut_unsatisfied", "env_issue") and fault_ref:
        analysis_type = profile.get("analysis_type", "fault_pattern_regression")
        recommended_action = profile.get("recommended_action", "needs_human_review")
        publishable = status == "sut_unsatisfied"
        needs_human = True
    else:
        analysis_type = profile.get("analysis_type", "fault_pattern_regression")
        recommended_action = "needs_human_review"
        publishable = False
        needs_human = True

    target = {
        "target_id": case_id,
        "case_id": case_id,
        "status": status,
        "analysis_type": analysis_type,
        "domain": profile.get("domain", "future_failure_mode"),
        "profile_id": profile.get("id", "generic_future_fault"),
        "fault_id": fault_ref,
        "spec_id": spec_id,
        "field": sd.get("field", ""),
        "expected": sd.get("expected", ""),
        "actual": sd.get("actual", ""),
        "trace_file": result.get("trace_file"),
        "oracle_refs": result.get("oracle_refs", []),
        "fault_oracle_summary": result.get("fault_oracle_summary"),
        "fault_oracle_results": result.get("fault_oracle_results", []),
        "contract_authority": authority,
        "evidence_level": evidence_level,
        "recommended_action": recommended_action,
        "publishable": publishable,
        "patchable": patchable,
        "needs_human": needs_human,
        "output_dir": "FaultAnalysis/targets/%s" % case_id,
        "remediation_dir": "Remediation/defects/%s" % case_id if patchable else None,
        "fault_context": _fault_context(fault_ref, match, fault_doc),
    }
    return target


def _target_from_match(match, fault_index, profiles, default_profile, seen_ids):
    fault_ref = match.get("fault_id")
    if not fault_ref:
        return None
    scenes = match.get("target_scenes") or ["unbound"]
    target_id = _safe_id("%s-%s" % (fault_ref, scenes[0]))
    if target_id in seen_ids:
        return None
    fault_doc = fault_index.get(fault_ref, {})
    profile = _match_profile(fault_ref, match, fault_doc, profiles, default_profile)
    return {
        "target_id": target_id,
        "case_id": None,
        "status": "planned",
        "analysis_type": profile.get("analysis_type", "fault_pattern_regression"),
        "domain": profile.get("domain", "future_failure_mode"),
        "profile_id": profile.get("id", "generic_future_fault"),
        "fault_id": fault_ref,
        "spec_id": "",
        "field": "",
        "expected": match.get("expected_behavior_raw", ""),
        "actual": "",
        "trace_file": None,
        "oracle_refs": match.get("oracle_refs", []),
        "fault_oracles": match.get("fault_oracles", []),
        "contract_authority": "unknown",
        "evidence_level": "planned_fault_pattern",
        "recommended_action": "design_or_execute_fault_case",
        "publishable": False,
        "patchable": False,
        "needs_human": True,
        "output_dir": "FaultAnalysis/targets/%s" % target_id,
        "remediation_dir": None,
        "fault_context": _fault_context(fault_ref, match, fault_doc),
    }


def build_plans(output_dir, max_defects, max_analysis_targets):
    profiles, default_profile, profile_version = _load_profiles()
    fault_index, fault_lib_meta = _load_fault_library_index()
    matches, match_list, match_meta = _load_fault_matches(output_dir)
    case_ctx = _load_case_context(output_dir)
    results = _load_results(output_dir)

    targets = []
    for case_id, result in results.items():
        status = _status_of(result)
        if status in ("passed", "pass", "harness_defect"):
            continue
        ctx = case_ctx.get(case_id, {})
        target = _target_from_result(case_id, result, ctx, matches, fault_index,
                                     profiles, default_profile, output_dir)
        if target["patchable"] or target["fault_id"] or status == "sdk_defect":
            targets.append(target)

    seen = {t["target_id"] for t in targets}
    executed_faults = {t.get("fault_id") for t in targets if t.get("fault_id")}
    for match in match_list:
        if match.get("fault_id") in executed_faults:
            continue
        if len([t for t in targets if not t["patchable"]]) >= max_analysis_targets:
            break
        target = _target_from_match(match, fault_index, profiles, default_profile, seen)
        if target:
            targets.append(target)
            seen.add(target["target_id"])

    patchable = [t for t in targets if t["patchable"]]
    selected_patchable = patchable[:max_defects]
    selected_patch_ids = {t["target_id"] for t in selected_patchable}
    selected_targets = []
    non_patch_count = 0
    for t in targets:
        if t["patchable"]:
            if t["target_id"] in selected_patch_ids:
                selected_targets.append(t)
        elif non_patch_count < max_analysis_targets:
            selected_targets.append(t)
            non_patch_count += 1

    remediation_items = []
    for t in selected_patchable:
        remediation_items.append({
            "case_id": t["case_id"],
            "spec_id": t["spec_id"],
            "field": t["field"],
            "expected": t["expected"],
            "actual": t["actual"],
            "trace_file": t["trace_file"],
            "oracle_refs": t["oracle_refs"],
            "fault_ref": t["fault_id"],
            "analysis_type": t["analysis_type"],
            "domain": t["domain"],
            "evidence_level": t["evidence_level"],
            "recommended_action": t["recommended_action"],
            "publishable": t["publishable"],
        })

    analysis_plan = {
        "generated_by": "remediation_plan.py",
        "schema_version": "2.1",
        "profile_schema_version": profile_version,
        "fault_libraries": fault_lib_meta,
        "fault_matches_meta": match_meta,
        "max_patchable_defects": max_defects,
        "max_analysis_targets": max_analysis_targets,
        "totals": {
            "results": len(results),
            "targets": len(targets),
            "selected": len(selected_targets),
            "patchable": len(patchable),
            "issue_only_or_diagnostic": len([t for t in targets if not t["patchable"]]),
        },
        "targets": selected_targets,
    }
    remediation_plan = {
        "generated_by": "remediation_plan.py",
        "schema_version": "2.1",
        "total_sdk_defects": len([1 for r in results.values() if _status_of(r) == "sdk_defect"]),
        "total_patchable_defects": len(patchable),
        "max_defects": max_defects,
        "selected": len(remediation_items),
        "defects": remediation_items,
        "fault_analysis_plan": "FaultAnalysis/analysis_plan.json",
    }
    return analysis_plan, remediation_plan


def _count_changes(diff_text):
    adds = sum(1 for l in diff_text.splitlines() if l.startswith("+") and not l.startswith("+++"))
    dels = sum(1 for l in diff_text.splitlines() if l.startswith("-") and not l.startswith("---"))
    return adds, dels


def _confidence_entry(case_dir, target_lookup):
    conf_fp = os.path.join(case_dir, "confidence.json")
    if not os.path.exists(conf_fp):
        return None
    c = load_json(conf_fp)
    target_id = c.get("target_id") or c.get("case_id") or os.path.basename(case_dir)
    target = target_lookup.get(target_id) or target_lookup.get(c.get("case_id")) or {}
    patch_fp = os.path.join(case_dir, "patch.diff")
    adds, dels = c.get("adds", 0), c.get("dels", 0)
    if os.path.exists(patch_fp) and not (adds or dels):
        adds, dels = _count_changes(open(patch_fp, encoding="utf-8").read())
    return {
        "target_id": target_id,
        "case_id": c.get("case_id") or target.get("case_id") or os.path.basename(case_dir),
        "spec_id": c.get("spec_id") or target.get("spec_id", ""),
        "fault_id": c.get("fault_id") or target.get("fault_id"),
        "analysis_type": c.get("analysis_type") or target.get("analysis_type", "patchable_contract_defect"),
        "domain": c.get("domain") or target.get("domain", "unknown"),
        "evidence_level": c.get("evidence_level") or target.get("evidence_level", ""),
        "recommended_action": c.get("recommended_action") or target.get("recommended_action", ""),
        "publishable": bool(c.get("publishable", target.get("publishable", True))),
        "files_touched": c.get("files_touched", []),
        "adds": adds,
        "dels": dels,
        "confidence": c.get("confidence", "low"),
        "localizable": bool(c.get("localizable")),
        "needs_human": bool(c.get("needs_human", target.get("needs_human", True))),
        "issue_title": c.get("issue_title", ""),
        "artifact_dir": os.path.relpath(case_dir, os.path.dirname(os.path.dirname(case_dir))),
    }


def finalize(output_dir):
    analysis_plan = _load_json_if(layout.existing_target_artifact(output_dir, "fault_analysis_plan"), {"targets": []})
    target_lookup = {t.get("target_id"): t for t in analysis_plan.get("targets", [])}
    for t in analysis_plan.get("targets", []):
        if t.get("case_id"):
            target_lookup.setdefault(t["case_id"], t)

    remediation_entries = []
    for case_dir in layout.existing_glob(output_dir, "Remediation/defects/*", ".state/remediation/defects/*"):
        if os.path.isdir(case_dir):
            entry = _confidence_entry(case_dir, target_lookup)
            if entry:
                remediation_entries.append(entry)

    analysis_entries = []
    for target_dir in layout.existing_glob(output_dir, "FaultAnalysis/targets/*", ".state/fault_analysis/targets/*"):
        if os.path.isdir(target_dir):
            entry = _confidence_entry(target_dir, target_lookup)
            if entry:
                analysis_entries.append(entry)

    # Patchable stage6 artifacts may still be produced only under Remediation/defects.
    seen = {e["target_id"] for e in analysis_entries}
    for entry in remediation_entries:
        if entry["target_id"] not in seen:
            analysis_entries.append(entry)

    planned_only = [
        {
            "target_id": t.get("target_id"),
            "case_id": t.get("case_id"),
            "fault_id": t.get("fault_id"),
            "analysis_type": t.get("analysis_type"),
            "domain": t.get("domain"),
            "evidence_level": t.get("evidence_level"),
            "recommended_action": t.get("recommended_action"),
            "publishable": bool(t.get("publishable")),
            "artifact_status": "planned",
        }
        for t in analysis_plan.get("targets", [])
        if t.get("target_id") not in {e["target_id"] for e in analysis_entries}
    ]

    rem_manifest = {
        "generated_by": "remediation_plan.py --finalize",
        "schema_version": "2.1",
        "defects": remediation_entries,
        "totals": {
            "sdk_defects": len(remediation_entries),
            "localizable": sum(1 for e in remediation_entries if e.get("localizable")),
            "needs_human": sum(1 for e in remediation_entries if e.get("needs_human")),
        },
        "fault_analysis_manifest": "FaultAnalysis/manifest.json",
    }
    analysis_manifest = {
        "generated_by": "remediation_plan.py --finalize",
        "schema_version": "2.1",
        "targets": analysis_entries,
        "planned_targets": planned_only,
        "totals": {
            "targets": len(analysis_entries),
            "planned_only": len(planned_only),
            "patchable": sum(1 for e in analysis_entries if e.get("analysis_type") == "patchable_contract_defect"),
            "publishable": sum(1 for e in analysis_entries if e.get("publishable")),
            "needs_human": sum(1 for e in analysis_entries if e.get("needs_human")),
        },
    }
    return rem_manifest, analysis_manifest


def main():
    parser = argparse.ArgumentParser(description="stage6 fault analysis plan / manifest generator")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--max-defects", type=int, default=5,
                        help="max patchable contract defects entering Remediation/plan.json")
    parser.add_argument("--max-analysis-targets", type=int, default=20,
                        help="max non-patchable analysis targets entering FaultAnalysis/analysis_plan.json")
    parser.add_argument("--finalize", action="store_true",
                        help="summarize stage6 artifacts into remediation and fault_analysis manifests")
    args = parser.parse_args()

    layout.target_dir(args.output_dir, "remediation", create=True)
    layout.target_dir(args.output_dir, "fault_analysis", create=True)

    if args.finalize:
        rem_manifest, analysis_manifest = finalize(args.output_dir)
        save_json(layout.target_artifact(args.output_dir, "remediation_manifest", create_parent=True), rem_manifest)
        save_json(layout.target_artifact(args.output_dir, "fault_analysis_manifest", create_parent=True), analysis_manifest)
        rt = rem_manifest["totals"]
        at = analysis_manifest["totals"]
        print("[remediation_plan] manifest: remediation %d | analysis %d | publishable %d | needs_human %d"
              % (rt["sdk_defects"], at["targets"], at["publishable"], at["needs_human"]))
        return 0

    analysis_plan, remediation_plan = build_plans(
        args.output_dir, args.max_defects, args.max_analysis_targets
    )
    save_json(layout.target_artifact(args.output_dir, "fault_analysis_plan", create_parent=True), analysis_plan)
    save_json(layout.target_artifact(args.output_dir, "remediation_plan", create_parent=True), remediation_plan)

    t = analysis_plan["totals"]
    print("[remediation_plan] stage6 targets %d → selected %d | patchable %d | diagnostic %d"
          % (t["targets"], t["selected"], t["patchable"], t["issue_only_or_diagnostic"]))
    for d in remediation_plan["defects"]:
        print("  · patchable %s %s %s" % (d["case_id"], d["spec_id"], d["field"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
