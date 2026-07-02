#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = REPO / "AutoTestFlow" / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))


def load_module(rel_path, name):
    spec = importlib.util.spec_from_file_location(name, REPO / rel_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


merge_test_design = load_module(
    "AutoTestFlow/scripts/merge_test_design.py",
    "merge_test_design_for_requirement_suggestion_tests",
)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


class RequirementSuggestionCoverageTests(unittest.TestCase):
    def test_merge_reports_each_suggestion_as_covered_or_not_applicable(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td)
            write_json(out / "FeatureAnalysis" / "s3a_enriched_index.json", {
                "meta": {"source": "requirement"},
                "scenario_index": [
                    {"id": "FS-001", "name": "main flow", "type": "flow", "priority": "P1", "fp_refs": ["FP-001"], "file": "s3a_enriched/FS-001.json"},
                    {"id": "FS-002", "name": "retry flow", "type": "flow", "priority": "P1", "fp_refs": ["FP-002"], "file": "s3a_enriched/FS-002.json"},
                ],
                "test_suggestions": [
                    {"id": "TS-001", "trigger": "normal", "focus": "happy path", "expected": "ok", "priority": "P1", "method": "E2E", "gate": None, "source": "testing_recommendations.md#1", "status": "mapped"},
                    {"id": "TS-002", "trigger": "retry", "focus": "retry path", "expected": "eventual success", "priority": "P1", "method": "exception", "gate": None, "source": "testing_recommendations.md#2", "status": "mapped"},
                    {"id": "TS-003", "trigger": "offline chaos", "focus": "manual infra", "expected": "operator runbook", "priority": "P2", "method": "manual", "gate": None, "source": "testing_recommendations.md#3", "status": "not_applicable", "not_applicable_reason": "requires external chaos environment"},
                ],
            })
            write_json(out / "TestCases" / "test_design_batch_001.json", {
                "cases": [
                    {"case_id": "TC_001", "source_scene": "FS-001", "case_kind": "正常E2E", "test_suggestion_refs": ["TS-001"]},
                    {"case_id": "TC_002", "source_scene": "FS-002", "case_kind": "异常E2E", "test_suggestion_refs": ["TS-002"]},
                ]
            })

            rc = merge_test_design.main(["--output-dir", str(out)])

            self.assertEqual(rc, 0)
            mapping = json.loads((out / "TestCases" / "scene_tc_mapping.json").read_text(encoding="utf-8"))
            coverage = mapping["test_suggestion_coverage"]
            self.assertEqual(coverage["coverage"], "2/2 (100%)")
            self.assertEqual(coverage["missing"], [])
            self.assertEqual(coverage["mapping"]["TS-001"], ["TC_001"])
            self.assertEqual(coverage["mapping"]["TS-002"], ["TC_002"])
            self.assertEqual(coverage["not_applicable"][0]["id"], "TS-003")


if __name__ == "__main__":
    unittest.main()
