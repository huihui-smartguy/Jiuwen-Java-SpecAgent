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


render_design_markdown = load_module(
    "AutoTestFlow/scripts/render_design_markdown.py",
    "render_design_markdown_for_tests",
)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


class DesignMarkdownRendererTests(unittest.TestCase):
    def test_renders_stage1_stage3_and_test_examples_with_traceability(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td)
            write_json(out / "FeatureAnalysis" / "s1_index.json", {
                "meta": {"source": "requirement"},
                "function_points": [{"id": "FP-001", "name": "Submit request", "entry": "POST /tasks", "priority": "P0"}],
                "test_suggestions": [{
                    "id": "TS-001",
                    "trigger": "missing resource",
                    "focus": "reject invalid association",
                    "expected": "failed terminal state",
                    "priority": "P0",
                    "method": "exception",
                    "status": "mapped",
                    "source": "requirements.md#testing",
                }],
                "scenario_index": [{
                    "id": "FS-001",
                    "name": "Submit request with validation",
                    "type": "flow",
                    "priority": "P0",
                    "fp_refs": ["FP-001"],
                    "test_suggestion_refs": ["TS-001"],
                    "file": "s1_scenarios/FS-001.json",
                }],
            })
            scene = {
                "id": "FS-001",
                "name": "Submit request with validation",
                "type": "flow",
                "test_type": "scenario",
                "priority": "P0",
                "source": "requirement",
                "test_suggestion_refs": ["TS-001"],
                "verify_points": ["terminal state is FAILED for invalid association"],
                "steps": [
                    {"seq": 1, "action": "Submit task request", "fp_ref": "FP-001", "data_scope": "task", "check": "response received"}
                ],
                "branches": {
                    "parameter": [],
                    "boundary": [],
                    "exception": [{
                        "id": "FS-001-E01",
                        "step_ref": 1,
                        "trigger": "metadata.agentId does not exist",
                        "expected": "terminal state FAILED",
                        "test_suggestion_refs": ["TS-001"],
                    }],
                    "quality": [],
                    "constraint": [],
                    "cross": [],
                },
            }
            write_json(out / "FeatureAnalysis" / "s1_scenarios" / "FS-001.json", scene)
            write_json(out / "FeatureAnalysis" / "s3a_enriched_index.json", {
                "meta": {"source": "requirement"},
                "function_points": [{"id": "FP-001", "name": "Submit request"}],
                "scenario_index": [{
                    "id": "FS-001",
                    "name": "Submit request with validation",
                    "type": "flow",
                    "priority": "P0",
                    "fp_refs": ["FP-001"],
                    "file": "FeatureAnalysis/s3a_enriched/FS-001.json",
                }],
            })
            write_json(out / "FeatureAnalysis" / "s3a_enriched" / "FS-001.json", scene)
            write_json(out / "FeatureAnalysis" / "s3a_framework.json", {
                "framework_scenarios": [{
                    "id": "FS-FW-001",
                    "name": "Framework retry around submit",
                    "type": "framework",
                    "test_type": "scenario",
                    "priority": "P1",
                    "fp_refs": ["FP-001"],
                    "steps": scene["steps"],
                    "verify_points": ["retry remains externally observable"],
                    "branches": {"parameter": [], "boundary": [], "exception": [], "quality": [], "constraint": [], "cross": []},
                }]
            })
            write_json(out / "TestCases" / "test_design.json", [{
                "case_id": "TC_001",
                "name": "Invalid association returns failed state",
                "test_type": "scenario",
                "case_kind": "异常E2E",
                "priority": "P0",
                "source_scene": "FS-001",
                "test_suggestion_refs": ["TS-001"],
                "steps": "1. Submit task request with missing agentId",
                "expected": "The task reaches FAILED and no unexpected 5xx is observed.",
                "oracle_refs": [{"spec_id": "SPEC-RESP-WRAP", "assert_level": "L2", "field": "result.task.status.state", "authority": "spec-required"}],
                "fault_ref": "F-REQ-011",
                "fault_oracles": [{"id": "F-REQ-011:no_5xx", "kind": "negative", "check": "no_unexpected_5xx", "required": True, "authority": "fault-required"}],
                "acceptance_refs": [{"standard_id": "PE-SW-CONTRACT-COVERAGE", "dimension": "software_testing", "release_gate": "must_for_release"}],
                "evidence_required": ["TestRun/trace", "TestRun/case_results.json"],
            }])

            rc = render_design_markdown.main(["--output-dir", str(out), "--stage", "all"])

            self.assertEqual(rc, 0)
            s1 = (out / "FeatureAnalysis" / "s1_scenario_examples.md").read_text(encoding="utf-8")
            self.assertIn("Stage 1 Scenario Examples", s1)
            self.assertIn("FeatureAnalysis/s1_scenarios/FS-001.json", s1)
            self.assertIn("Submit task request", s1)
            self.assertIn("TS-001", s1)
            self.assertIn("exception 1", s1)

            s3a = (out / "FeatureAnalysis" / "s3a_scenario_landscape.md").read_text(encoding="utf-8")
            self.assertIn("Stage 3 Scenario Landscape", s3a)
            self.assertIn("Framework retry around submit", s3a)
            self.assertIn("FeatureAnalysis/s3a_enriched/FS-001.json", s3a)

            tests = (out / "TestCases" / "test_examples.md").read_text(encoding="utf-8")
            self.assertIn("Stage 3 Test Examples", tests)
            self.assertIn("TC_001", tests)
            self.assertIn("SPEC-RESP-WRAP", tests)
            self.assertIn("F-REQ-011", tests)
            self.assertIn("no_unexpected_5xx", tests)
            self.assertIn("PE-SW-CONTRACT-COVERAGE", tests)
            self.assertIn("TestRun/trace", tests)


if __name__ == "__main__":
    unittest.main()
