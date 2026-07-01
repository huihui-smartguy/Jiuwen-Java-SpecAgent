#!/usr/bin/env python3
"""
aggregate_results.py - 阶段4-agg：结果聚合

读取 TestRun/results/*.json，生成 TestRun/case_results.json。
替代原 Agent 方式，执行时间 <1s。

用法：
    python aggregate_results.py --output-dir <dir>
"""

import argparse
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import output_layout as layout


def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, data, indent=2):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)


def classify_status(raw_status: str) -> str:
    """统一 status 字段（处理大小写不一致）。"""
    s = str(raw_status or "").strip().upper()
    if s == "PASS":
        return "passed"
    return str(raw_status or "").strip().lower()


def fault_oracle_blocked(summary: dict) -> bool:
    """True when required fault oracles kept a fault_ref case from passing."""
    if not isinstance(summary, dict):
        return False
    classification = classify_status(summary.get("classification") or summary.get("overall_status"))
    return classification not in ("", "passed", "not_applicable")


def merge_fault_oracle_coverage(coverage: dict, summary: dict):
    if not isinstance(summary, dict):
        return
    counts = summary.get("counts", {}) or {}
    by_kind = counts.get("by_kind", {}) or {}
    for kind, item in by_kind.items():
        bucket = coverage.setdefault(kind, {"passed": 0, "failed": 0, "unobservable": 0, "not_applicable": 0})
        for status in ("passed", "failed", "unobservable", "not_applicable"):
            bucket[status] += int((item or {}).get(status, 0) or 0)


def aggregate(output_dir: str):
    # 读取所有结果文件
    details = {}
    for fp in layout.existing_glob(output_dir, "TestRun/results/*.json", ".state/results/*.json"):
        r = load_json(fp)
        case_id = os.path.basename(fp).replace(".json", "")
        status = classify_status(r.get("status", "unknown"))
        details[case_id] = {
            "status": status,
            "fix_rounds": r.get("fix_rounds", 0),
        }
        for key in ("target_id", "class", "trace_file", "pytest_status", "skip_reason", "review_reason"):
            if r.get(key) is not None:
                details[case_id][key] = r[key]
        # 当前 stage4 模板写 sdk_defect（对象）；兼容历史字段名 sdk_bug
        sdk = r.get("sdk_defect") or r.get("sdk_bug")
        if sdk:
            details[case_id]["sdk_defect"] = sdk
        if r.get("fault_ref"):
            details[case_id]["fault_ref"] = r["fault_ref"]
        if r.get("oracle_refs"):
            details[case_id]["oracle_refs"] = r["oracle_refs"]
        if r.get("fault_oracle_summary"):
            details[case_id]["fault_oracle_summary"] = r["fault_oracle_summary"]
        if r.get("fault_oracle_results"):
            details[case_id]["fault_oracle_results"] = r["fault_oracle_results"]
        if r.get("mock_file"):
            details[case_id]["mock_file"] = r["mock_file"]

    # 统计（执行边界分类 + fault oracle gating）
    total = len(details)

    def _count(name):
        return sum(1 for d in details.values() if d["status"] == name)

    passed = _count("passed")
    harness_defects = _count("harness_defect")
    sut_unsatisfied = _count("sut_unsatisfied")
    sdk_defects = _count("sdk_defect")
    env_issues = _count("env_issue")
    requires_human_review = _count("requires_human_review")
    fault_oracle_failed = 0
    final_pytest_passed_but_fault_oracle_failed = 0
    fault_oracle_coverage = {}
    for detail in details.values():
        summary = detail.get("fault_oracle_summary")
        merge_fault_oracle_coverage(fault_oracle_coverage, summary)
        if fault_oracle_blocked(summary):
            fault_oracle_failed += 1
            if classify_status(detail.get("pytest_status")) in ("passed", "pass"):
                final_pytest_passed_but_fault_oracle_failed += 1

    case_results = {
        "summary": {
            "total": total,
            "passed": passed,
            "harness_defects": harness_defects,
            "sut_unsatisfied": sut_unsatisfied,
            "sdk_defects": sdk_defects,
            "env_issues": env_issues,
            "requires_human_review": requires_human_review,
            "fault_oracle_failed": fault_oracle_failed,
            "final_pytest_passed_but_fault_oracle_failed": final_pytest_passed_but_fault_oracle_failed,
            "fault_oracle_coverage": fault_oracle_coverage,
        },
        "details": details,
    }

    # 写入
    output_path = layout.target_artifact(output_dir, "case_results", create_parent=True)
    save_json(output_path, case_results)

    # 输出摘要
    print(f"Total: {total} | Passed: {passed} | sdk_defect: {sdk_defects} | "
          f"sut_unsatisfied: {sut_unsatisfied} | harness: {harness_defects} | "
          f"env: {env_issues} | review: {requires_human_review} | "
          f"fault_oracle_blocked: {fault_oracle_failed}")
    print(f"Output: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="阶段4-agg 结果聚合")
    parser.add_argument("--output-dir", required=True, help="输出目录")
    args = parser.parse_args()
    aggregate(args.output_dir)


if __name__ == "__main__":
    main()
