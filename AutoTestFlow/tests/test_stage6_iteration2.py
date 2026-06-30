#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]


def load_module(rel_path, name):
    spec = importlib.util.spec_from_file_location(name, REPO / rel_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


remediation_plan = load_module("AutoTestFlow/scripts/remediation_plan.py", "remediation_plan")
remediation_config = load_module("AutoTestFlow/reference/remediation_config.py", "remediation_config")


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


class Stage6Iteration2Tests(unittest.TestCase):
    def test_planner_keeps_patchable_subset_and_future_profiles(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td)
            (out / "contract.md").write_text(
                "\n".join([
                    "# contract",
                    "## 7. 字段权威性分级表",
                    "| specId | 字段/形态 | spec-required | deployment-config-dependent | needs-runtime-verify | 来源 |",
                    "|---|---|:---:|:---:|:---:|---|",
                    "| SPEC-ID-TYPE | id | ✅ | | | sample |",
                ]),
                encoding="utf-8",
            )
            write_json(out / ".state/results/TC_SDK.json", {
                "case_id": "TC_SDK",
                "class": "sdk_defect",
                "trace_file": ".state/trace/TC_SDK.jsonl",
                "fault_ref": "F-REQ-001",
                "oracle_refs": ["SPEC-ID-TYPE"],
                "sdk_defect": {
                    "spec_id": "SPEC-ID-TYPE",
                    "field": "id",
                    "expected": "string",
                    "actual": "number",
                },
            })
            write_json(out / ".state/results/TC_DFX.json", {
                "case_id": "TC_DFX",
                "class": "sut_unsatisfied",
                "trace_file": ".state/trace/TC_DFX.jsonl",
                "fault_ref": "F-DFX-001",
                "oracle_refs": [],
            })
            write_json(out / ".state/fault_matches.json", {
                "meta": {"fault_lib_version": "test"},
                "fault_matches": [
                    {"fault_id": "F-DFX-001", "name": "下游API超时", "target_scenes": ["FS-1"],
                     "severity": "高", "expected_behavior_raw": "应降级"},
                    {"fault_id": "F-FUTURE-001", "name": "未来故障模式", "target_scenes": ["FS-2"],
                     "severity": "中", "expected_behavior_raw": "未来诊断"},
                ],
            })

            analysis, remediation = remediation_plan.build_plans(str(out), 5, 10)
            self.assertEqual(remediation["selected"], 1)
            self.assertEqual(remediation["defects"][0]["case_id"], "TC_SDK")
            targets = {t["target_id"]: t for t in analysis["targets"]}
            self.assertEqual(targets["TC_SDK"]["analysis_type"], "patchable_contract_defect")
            self.assertTrue(targets["TC_SDK"]["patchable"])
            self.assertEqual(targets["TC_DFX"]["domain"], "dfx_reliability")
            future = next(t for t in analysis["targets"] if t["fault_id"] == "F-FUTURE-001")
            self.assertEqual(future["domain"], "future_failure_mode")
            self.assertFalse(future["publishable"])

    def test_config_accepts_new_guard_and_old_alias(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "remediation.config.json"
            base = {
                "sut": {"base_url": "http://localhost"},
                "repo": {"upstream_url": "fake_repo", "ref": "v1", "clone_path": ".state/remediation/repo"},
                "switches": {"require_evidence_before_issue": True},
            }
            write_json(path, base)
            cfg = remediation_config.load_config(str(path))
            self.assertTrue(cfg["switches"]["require_evidence_before_issue"])
            self.assertEqual(cfg["repo"]["local_branch_prefix"], "autotestflow/fix")

            base["switches"] = {"require_green_before_pr": True}
            write_json(path, base)
            cfg = remediation_config.load_config(str(path))
            self.assertTrue(cfg["switches"]["require_evidence_before_issue"])

            base["switches"] = {"require_evidence_before_issue": False}
            write_json(path, base)
            with self.assertRaises(remediation_config.ConfigError):
                remediation_config.load_config(str(path))

    def test_submitter_has_no_pr_or_push_command_path(self):
        text = (REPO / "AutoTestFlow/scripts/submit_remediation.py").read_text(encoding="utf-8")
        self.assertNotIn('"gh", "pr"', text)
        self.assertNotIn('"git", "push"', text)
        self.assertIn('"issue"', text)


if __name__ == "__main__":
    unittest.main()
