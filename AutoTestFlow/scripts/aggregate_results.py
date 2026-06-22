#!/usr/bin/env python3
"""
aggregate_results.py - 阶段4-agg：结果聚合

读取 .state/results/*.json，生成 case_results.json。
替代原 Agent 方式，执行时间 <1s。

用法：
    python aggregate_results.py --output-dir <dir>
"""

import argparse
import json
import os
import sys
from glob import glob


def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, data, indent=2):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)


def classify_status(raw_status: str) -> str:
    """统一 status 字段（处理大小写不一致）。"""
    s = raw_status.strip().upper()
    if s == "PASS":
        return "passed"
    return raw_status.strip().lower()


def aggregate(output_dir: str):
    state_dir = os.path.join(output_dir, ".state")
    results_dir = os.path.join(state_dir, "results")

    # 读取所有结果文件
    details = {}
    for fp in sorted(glob(os.path.join(results_dir, "*.json"))):
        r = load_json(fp)
        case_id = os.path.basename(fp).replace(".json", "")
        status = classify_status(r.get("status", "unknown"))
        details[case_id] = {
            "status": status,
            "fix_rounds": r.get("fix_rounds", 0),
        }
        # 当前 stage4 模板写 sdk_defect（对象）；兼容历史字段名 sdk_bug
        sdk = r.get("sdk_defect") or r.get("sdk_bug")
        if sdk:
            details[case_id]["sdk_defect"] = sdk
        if r.get("fault_ref"):
            details[case_id]["fault_ref"] = r["fault_ref"]
        if r.get("mock_file"):
            details[case_id]["mock_file"] = r["mock_file"]

    # 统计（5 分类：passed / harness_defect / sut_unsatisfied / sdk_defect / env_issue）
    total = len(details)

    def _count(name):
        return sum(1 for d in details.values() if d["status"] == name)

    passed = _count("passed")
    harness_defects = _count("harness_defect")
    sut_unsatisfied = _count("sut_unsatisfied")
    sdk_defects = _count("sdk_defect")
    env_issues = _count("env_issue")

    case_results = {
        "summary": {
            "total": total,
            "passed": passed,
            "harness_defects": harness_defects,
            "sut_unsatisfied": sut_unsatisfied,
            "sdk_defects": sdk_defects,
            "env_issues": env_issues,
        },
        "details": details,
    }

    # 写入
    output_path = os.path.join(output_dir, "case_results.json")
    save_json(output_path, case_results)

    # 输出摘要
    print(f"Total: {total} | Passed: {passed} | sdk_defect: {sdk_defects} | "
          f"sut_unsatisfied: {sut_unsatisfied} | harness: {harness_defects} | env: {env_issues}")
    print(f"Output: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="阶段4-agg 结果聚合")
    parser.add_argument("--output-dir", required=True, help="输出目录")
    args = parser.parse_args()
    aggregate(args.output_dir)


if __name__ == "__main__":
    main()
