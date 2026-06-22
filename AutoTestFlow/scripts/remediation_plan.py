#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
remediation_plan.py - stage6 缺陷深析的确定性前/后处理（worklist + manifest）

prep（默认）：读 .state/results/*.json，过滤 class==sdk_defect（仿 record_faults），产
  .state/remediation/plan.json —— 每条 sdk_defect 一项（spec_id/field/expected/actual/
  trace_file/oracle_refs/fault_ref），按 --max-defects 截断。编排器据此对每个缺陷启动
  stage6_defect_analyze 子 Agent。
finalize（--finalize）：汇总各 defects/<case>/confidence.json → .state/remediation/manifest.json
  （门面小文件，供强制确认门读取展示）。

纯确定性、无网络、无时间戳（可复现）。**仅** sdk_defect（contract 背书的真实违例）入计划——
sut_unsatisfied / harness_defect / env_issue 不进入修复闭环。

用法：
    python remediation_plan.py --output-dir <dir> [--max-defects 5]
    python remediation_plan.py --output-dir <dir> --finalize
"""

import argparse
import os
import sys
from glob import glob

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "reference"))
from remediation_config import load_json, save_json  # noqa: E402


def collect_sdk_defects(output_dir):
    """读取 .state/results/*.json，返回 class==sdk_defect 的 (case_id, result) 列表。"""
    results_dir = os.path.join(output_dir, ".state", "results")
    out = []
    for fp in sorted(glob(os.path.join(results_dir, "*.json"))):
        r = load_json(fp)
        case_id = r.get("case_id") or os.path.basename(fp).replace(".json", "")
        cls = r.get("class") or r.get("status")
        if cls == "sdk_defect":
            out.append((case_id, r))
    return out


def build_worklist(output_dir, max_defects):
    defects = collect_sdk_defects(output_dir)
    items = []
    for case_id, r in defects:
        sd = r.get("sdk_defect") or r.get("sdk_bug") or {}
        items.append({
            "case_id": case_id,
            "spec_id": sd.get("spec_id", ""),
            "field": sd.get("field", ""),
            "expected": sd.get("expected", ""),
            "actual": sd.get("actual", ""),
            "trace_file": r.get("trace_file"),
            "oracle_refs": r.get("oracle_refs", []),
            "fault_ref": r.get("fault_ref"),
        })
    selected = items[:max_defects]
    return {
        "generated_by": "remediation_plan.py",
        "total_sdk_defects": len(items),
        "max_defects": max_defects,
        "selected": len(selected),
        "defects": selected,
    }


def finalize(output_dir):
    rem_dir = os.path.join(output_dir, ".state", "remediation")
    defects_dir = os.path.join(rem_dir, "defects")
    entries = []
    localizable = needs_human = 0
    for case_dir in sorted(glob(os.path.join(defects_dir, "*"))):
        conf_fp = os.path.join(case_dir, "confidence.json")
        if not (os.path.isdir(case_dir) and os.path.exists(conf_fp)):
            continue
        c = load_json(conf_fp)
        entries.append({
            "case_id": c.get("case_id") or os.path.basename(case_dir),
            "spec_id": c.get("spec_id", ""),
            "files_touched": c.get("files_touched", []),
            "adds": c.get("adds", 0),
            "dels": c.get("dels", 0),
            "confidence": c.get("confidence", "low"),
            "localizable": bool(c.get("localizable")),
            "needs_human": bool(c.get("needs_human")),
            "issue_title": c.get("issue_title", ""),
        })
        localizable += 1 if c.get("localizable") else 0
        needs_human += 1 if c.get("needs_human") else 0
    return {
        "generated_by": "remediation_plan.py --finalize",
        "defects": entries,
        "totals": {"sdk_defects": len(entries), "localizable": localizable,
                   "needs_human": needs_human},
    }


def main():
    parser = argparse.ArgumentParser(description="stage6 缺陷深析 worklist/manifest 生成")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--max-defects", type=int, default=5)
    parser.add_argument("--finalize", action="store_true",
                        help="汇总 defects/<case>/confidence.json → manifest.json")
    args = parser.parse_args()

    rem_dir = os.path.join(args.output_dir, ".state", "remediation")

    if args.finalize:
        manifest = finalize(args.output_dir)
        save_json(os.path.join(rem_dir, "manifest.json"), manifest)
        t = manifest["totals"]
        print("[remediation_plan] manifest: %d defects | localizable %d | needs_human %d"
              % (t["sdk_defects"], t["localizable"], t["needs_human"]))
        return 0

    plan = build_worklist(args.output_dir, args.max_defects)
    save_json(os.path.join(rem_dir, "plan.json"), plan)
    print("[remediation_plan] sdk_defects %d → selected %d (max %d)"
          % (plan["total_sdk_defects"], plan["selected"], plan["max_defects"]))
    for d in plan["defects"]:
        print("  · %s %s %s" % (d["case_id"], d["spec_id"], d["field"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
