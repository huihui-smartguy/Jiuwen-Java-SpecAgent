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


def write_text(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


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


class FaultMatcherDomainTests(unittest.TestCase):
    CONTRACT_MD = """
# Contract

## 1. Response wrapper（specId: SPEC-RESP-WRAP）
## 2. ID type（specId: SPEC-ID-TYPE）
## 3. SSE（specId: SPEC-SSE）

| error.code | meaning |
|---|---|
| -32603 | Internal error |

## 7. 字段权威性分级表

| specId | 字段 | spec-required | deployment-config-dependent | needs-runtime-verify | 来源 |
|---|---|---|---|---|---|
| SPEC-RESP-WRAP | result.status | ✅ |  |  | requirement |
| SPEC-ID-TYPE | id | ✅ |  |  | requirement |
| SPEC-SSE | event stream | ✅ |  |  | requirement |
| SPEC-ERR-32603 | error.code | ✅ |  |  | requirement |
"""

    def build_fixture(self, root, scene_name, scene_body, target_id=None, target_name=None):
        base = Path(root)
        out = base / "targets" / target_id if target_id else base
        write_text(out / "Contract" / "contract.md", self.CONTRACT_MD)
        write_json(out / "FeatureAnalysis" / "s1_index.json", {
            "meta": {"source": "requirement"},
            "function_points": [{"id": "FP-001", "name": scene_name, "entry": "POST /run", "priority": "P1", "constraints": [], "source_ids": ["REQ-1"]}],
            "scenario_index": [{
                "id": "FS-001",
                "name": scene_name,
                "type": "flow",
                "priority": "P1",
                "fp_refs": ["FP-001"],
                "file": "FeatureAnalysis/s1_scenarios/FS-001.json",
            }],
        })
        write_json(out / "FeatureAnalysis" / "s1_scenarios" / "FS-001.json", {
            "id": "FS-001",
            "name": scene_name,
            "type": "flow",
            "priority": "P1",
            "verify_points": ["request completes"],
            "steps": [{"seq": 1, "action": scene_body, "fp_ref": "FP-001", "data_scope": "taskId", "check": "observable response"}],
            "branches": {"parameter": [], "boundary": [], "exception": [], "quality": [], "constraint": [], "cross": []},
        })
        if target_id:
            write_json(base / "RunMetadata" / "sut_manifest.normalized.json", {
                "schema_version": "1.0",
                "targets": [{
                    "id": target_id,
                    "name": target_name or target_id,
                    "role": "dependency",
                    "source": {"path": target_name or target_id, "available": False},
                }],
            })
        return out

    def test_all_domains_load_and_agent_scene_preserves_agent_and_dfx_matches(self):
        with tempfile.TemporaryDirectory() as td:
            out = self.build_fixture(
                td,
                "Agent LLM tool streaming workflow",
                "User sends an agent task, the LLM invokes a tool, and the response is streamed back over SSE.",
            )

            plan = match_faults.match(
                str(out),
                fault_lib=None,
                overlay=None,
                max_exception=3,
                max_quality=2,
                knowledge_root=str(REPO / "TestKnowledgeBase"),
                domains=None,
            )

            domains = {m["domain"] for m in plan["fault_matches"]}
            breakdown = plan["meta"]["stats"]["domain_breakdown"]
            self.assertTrue({"rest_api", "web", "agent", "dfx"}.issubset(breakdown.keys()))
            self.assertIn("agent", domains)
            self.assertIn("dfx", domains)
            self.assertGreater(breakdown["agent"]["matched"], 0)
            self.assertGreater(breakdown["dfx"]["matched"], 0)

    def test_front_tool_target_metadata_preserves_web_and_dfx_matches(self):
        with tempfile.TemporaryDirectory() as td:
            out = self.build_fixture(
                td,
                "Operator validates a configured service",
                "User opens the configured service and submits the normal workflow.",
                target_id="front_tool",
                target_name="front_tool",
            )

            plan = match_faults.match(
                str(out),
                fault_lib=None,
                overlay=None,
                max_exception=3,
                max_quality=2,
                knowledge_root=str(REPO / "TestKnowledgeBase"),
                domains=None,
            )

            domains = {m["domain"] for m in plan["fault_matches"]}
            breakdown = plan["meta"]["stats"]["domain_breakdown"]
            self.assertIn("web", domains)
            self.assertIn("dfx", domains)
            self.assertGreater(breakdown["web"]["matched"], 0)
            self.assertGreater(breakdown["dfx"]["matched"], 0)
            self.assertTrue(breakdown["web"]["matched_by_branch"])


class FaultOracleEvaluatorTests(unittest.TestCase):
    def build_case(self, root, case_id, fault_oracles=None, fault_ref="F-TEST-001", status="passed"):
        out = Path(root)
        write_json(out / "TestCases" / "test_design.json", [{
            "case_id": case_id,
            "fault_ref": fault_ref,
            "fault_oracles": fault_oracles or [],
        }])
        write_json(out / "TestRun" / "results" / f"{case_id}.json", {
            "case_id": case_id,
            "status": status,
            "class": None,
            "fault_ref": fault_ref,
            "trace_file": f"TestRun/trace/{case_id}.jsonl",
        })
        return out

    def evaluate_and_write(self, out, case_id):
        results, summary = evaluate_fault_oracles.evaluate(str(out), case_id)
        evaluate_fault_oracles.write_back(str(out), case_id, None, results, summary)
        return json.loads((out / "TestRun" / "results" / f"{case_id}.json").read_text(encoding="utf-8"))

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
            write_trace(out / "TestRun" / "trace" / f"{case_id}.jsonl", [
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
            write_trace(out / "TestRun" / "trace" / f"{case_id}.jsonl", [
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
            write_trace(out / "TestRun" / "trace" / f"{case_id}.jsonl", [
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
            write_trace(out / "TestRun" / "trace" / f"{case_id}.jsonl", [
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
            write_json(out / "TestCases" / "test_design.json", [{"case_id": case_id, "name": "normal"}])
            write_json(out / "TestRun" / "results" / f"{case_id}.json", {
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
            write_json(out / "TestRun" / "results" / "TC_BLOCKED.json", {
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
            case_results = json.loads((out / "TestRun" / "case_results.json").read_text(encoding="utf-8"))

            self.assertEqual(case_results["summary"]["fault_oracle_failed"], 1)
            self.assertEqual(case_results["summary"]["final_pytest_passed_but_fault_oracle_failed"], 1)
            self.assertEqual(case_results["summary"]["fault_oracle_coverage"]["negative"]["failed"], 1)


if __name__ == "__main__":
    unittest.main()
