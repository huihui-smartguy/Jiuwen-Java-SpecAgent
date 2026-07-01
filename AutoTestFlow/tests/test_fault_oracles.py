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


match_faults = load_module("AutoTestFlow/scripts/match_faults.py", "match_faults_for_oracle_tests")
evaluate_fault_oracles = load_module(
    "AutoTestFlow/scripts/evaluate_fault_oracles.py",
    "evaluate_fault_oracles_for_tests",
)
aggregate_results = load_module("AutoTestFlow/scripts/aggregate_results.py", "aggregate_results_for_oracle_tests")


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def write_trace(path, records):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in records) + "\n",
        encoding="utf-8",
    )


class FaultOracleNormalizationTests(unittest.TestCase):
    def test_build_fault_oracles_has_required_process_or_negative_oracle(self):
        fault = {
            "fault_id": "F-REQ-001",
            "name": "id 回带异常",
            "description": "响应 id 必须回带请求 id",
            "tags": ["类型一致性"],
            "_category": "FC-REQ",
            "test_strategy": {
                "expected_behavior": "响应 id 必须回带请求 id，且不得返回 5xx",
                "validation_points": ["id 回带", "无 5xx"],
                "assertion_level": "L2",
            },
        }
        oracle_refs = [{
            "spec_id": "SPEC-ID-TYPE",
            "field": "id",
            "assert_level": "L2",
            "authority": "spec-required",
        }]
        contract = {
            "authority": {"SPEC-ID-TYPE": "spec-required"},
            "present": {"SPEC-ID-TYPE"},
            "error_specids": [],
            "has_sse": False,
        }

        oracles = match_faults.build_fault_oracles(fault, oracle_refs, contract)

        self.assertTrue(oracles)
        self.assertTrue(any(o["required"] and o["kind"] in {"process", "negative"} for o in oracles))
        self.assertIn("correlation_id_preserved", {o["check"] for o in oracles})


class FaultOracleEvaluatorTests(unittest.TestCase):
    def build_case(self, root, case_id, fault_oracles=None, fault_ref="F-TEST-001", status="passed"):
        out = Path(root)
        write_json(out / "test_design.json", [{
            "case_id": case_id,
            "fault_ref": fault_ref,
            "fault_oracles": fault_oracles or [],
        }])
        write_json(out / ".state" / "results" / f"{case_id}.json", {
            "case_id": case_id,
            "status": status,
            "class": None,
            "fault_ref": fault_ref,
            "trace_file": f".state/trace/{case_id}.jsonl",
        })
        return out

    def evaluate_and_write(self, out, case_id):
        results, summary = evaluate_fault_oracles.evaluate(str(out), case_id)
        evaluate_fault_oracles.write_back(str(out), case_id, None, results, summary)
        return json.loads((out / ".state" / "results" / f"{case_id}.json").read_text(encoding="utf-8"))

    def test_final_response_passes_but_error_frame_becomes_sdk_defect(self):
        with tempfile.TemporaryDirectory() as td:
            case_id = "TC_ERR_FRAME"
            out = self.build_case(td, case_id, [{
                "id": "F-TEST-001:no_unexpected_error_frame:1",
                "kind": "negative",
                "check": "no_unexpected_error_frame",
                "required": True,
                "authority": "fault-required",
            }])
            write_trace(out / ".state" / "trace" / f"{case_id}.jsonl", [
                {"kind": "request", "method": "POST", "url": "/rpc", "body": {"id": "1"}},
                {"kind": "response", "method": "POST", "status_code": 200,
                 "body": {"result": {"ok": True}, "error": {"code": -32603}}},
            ])

            result = self.evaluate_and_write(out, case_id)

            self.assertEqual(result["pytest_status"], "passed")
            self.assertEqual(result["status"], "sdk_defect")
            self.assertEqual(result["class"], "sdk_defect")
            self.assertEqual(result["fault_oracle_summary"]["classification"], "sdk_defect")
            self.assertEqual(result["sdk_defect"]["evidence_type"], "fault_oracle_trace")

    def test_missing_required_sse_terminal_event_is_not_passed(self):
        with tempfile.TemporaryDirectory() as td:
            case_id = "TC_SSE_MISSING_TERMINAL"
            out = self.build_case(td, case_id, [{
                "id": "F-TEST-001:sse_terminal_state:1",
                "kind": "process",
                "check": "sse_terminal_state",
                "required": True,
                "authority": "fault-required",
                "expected": {"terminal_states": ["COMPLETED"]},
            }])
            write_trace(out / ".state" / "trace" / f"{case_id}.jsonl", [
                {"kind": "sse_event", "idx": 1, "event": {"event": "message", "data": {"status": "RUNNING"}}},
            ])

            result = self.evaluate_and_write(out, case_id)

            self.assertNotEqual(result["status"], "passed")
            self.assertEqual(result["fault_oracle_results"][0]["status"], "failed")

    def test_duplicate_terminal_event_becomes_sdk_defect(self):
        with tempfile.TemporaryDirectory() as td:
            case_id = "TC_SSE_DUP_TERMINAL"
            out = self.build_case(td, case_id, [{
                "id": "F-TEST-001:no_duplicate_terminal_event:1",
                "kind": "negative",
                "check": "no_duplicate_terminal_event",
                "required": True,
                "authority": "fault-required",
                "expected": {"terminal_states": ["COMPLETED"]},
            }])
            write_trace(out / ".state" / "trace" / f"{case_id}.jsonl", [
                {"kind": "sse_event", "idx": 1, "event": {"event": "message", "data": {"state": "COMPLETED"}}},
                {"kind": "sse_event", "idx": 2, "event": {"event": "message", "data": {"state": "COMPLETED"}}},
            ])

            result = self.evaluate_and_write(out, case_id)

            self.assertEqual(result["status"], "sdk_defect")
            self.assertEqual(result["fault_oracle_results"][0]["status"], "failed")

    def test_required_process_oracle_unobservable_requires_human_review(self):
        with tempfile.TemporaryDirectory() as td:
            case_id = "TC_UNOBSERVABLE"
            out = self.build_case(td, case_id, [{
                "id": "F-TEST-001:resource_not_created:1",
                "kind": "negative",
                "check": "resource_not_created",
                "required": True,
                "authority": "fault-required",
            }])
            write_trace(out / ".state" / "trace" / f"{case_id}.jsonl", [
                {"kind": "request", "method": "POST", "url": "/items", "body": {"name": "x"}},
                {"kind": "response", "method": "POST", "status_code": 200, "body": {"result": {"ok": True}}},
            ])

            result = self.evaluate_and_write(out, case_id)

            self.assertEqual(result["status"], "requires_human_review")
            self.assertEqual(result["fault_oracle_results"][0]["status"], "unobservable")

    def test_non_fault_case_is_not_applicable_and_remains_passed(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td)
            case_id = "TC_NORMAL"
            write_json(out / "test_design.json", [{"case_id": case_id, "name": "normal"}])
            write_json(out / ".state" / "results" / f"{case_id}.json", {
                "case_id": case_id,
                "status": "passed",
                "class": None,
            })

            result = self.evaluate_and_write(out, case_id)

            self.assertEqual(result["status"], "passed")
            self.assertEqual(result["fault_oracle_summary"]["classification"], "not_applicable")

    def test_aggregate_counts_pytest_passed_but_fault_oracle_blocked(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td)
            write_json(out / ".state" / "results" / "TC_BLOCKED.json", {
                "case_id": "TC_BLOCKED",
                "status": "sdk_defect",
                "pytest_status": "passed",
                "fault_ref": "F-TEST-001",
                "fault_oracle_summary": {
                    "classification": "sdk_defect",
                    "counts": {
                        "by_kind": {
                            "negative": {"passed": 0, "failed": 1, "unobservable": 0, "not_applicable": 0}
                        }
                    },
                },
                "fault_oracle_results": [{"kind": "negative", "status": "failed"}],
                "sdk_defect": {"expected": "no error frame", "actual": "error frame"},
            })

            aggregate_results.aggregate(str(out))
            case_results = json.loads((out / "case_results.json").read_text(encoding="utf-8"))

            self.assertEqual(case_results["summary"]["fault_oracle_failed"], 1)
            self.assertEqual(case_results["summary"]["final_pytest_passed_but_fault_oracle_failed"], 1)
            self.assertEqual(case_results["summary"]["fault_oracle_coverage"]["negative"]["failed"], 1)


if __name__ == "__main__":
    unittest.main()
