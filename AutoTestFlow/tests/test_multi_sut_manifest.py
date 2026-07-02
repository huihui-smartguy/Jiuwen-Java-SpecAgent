#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import importlib.util
import json
import os
import tempfile
import unittest
from unittest import mock
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]


def load_module(rel_path, name):
    spec = importlib.util.spec_from_file_location(name, REPO / rel_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


sut_manifest = load_module("AutoTestFlow/scripts/sut_manifest.py", "sut_manifest")
probe_contract = load_module("AutoTestFlow/scripts/probe_contract.py", "probe_contract")
sut_runtime = load_module("AutoTestFlow/scripts/sut_runtime.py", "sut_runtime")


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


VALID_MANIFEST = """---
schema_version: autotestflow.sut-manifest.v1
suite:
  id: demo-suite
  output_dir: out
  defaults:
    knowledge_domain: rest_api
targets:
  - id: api
    name: API
    role: primary
    source:
      path: services/api
    runtime:
      mode: predeployed
      base_url: http://localhost:8080
      readiness_probe:
        method: GET
        path: /health
        expect_status_lt: 500
    probes:
      - name: health
        method: GET
        path: /health
  - id: worker
    name: Worker
    role: dependency
    depends_on: [api]
    source:
      path: services/worker
    runtime:
      mode: managed
      base_url: http://localhost:8090
      readiness_probe:
        method: GET
        path: /ready
        expect_status_lt: 500
      commands:
        build: "echo build-worker"
        start: "echo start-worker"
---

# Demo
"""


DIRECT_NL_SUT = """# SUT Description

[Catalog API]
ip: 127.0.0.1
port: 8081
Accessible directly
Environment variables: API_TOKEN=secret-value, REGION
"""


MANAGED_NL_SUT = """# Test environment

[Checkout API]
Source path: services/checkout
URL: http://localhost:8082/actuator/health
Requires creation before tests
Build: mvn -q -DskipTests package
Start command: java -jar target/checkout.jar --server.port=8082
Stop command: pkill -f checkout.jar || true
Environment variables: CHECKOUT_SECRET=very-secret
"""


MULTI_DEP_NL_SUT = """# SUT Description

[Catalog]
URL: http://localhost:8081/health
Accessible directly

[Checkout]
Source path: services/checkout
URL: http://localhost:8082/actuator/health
Requires creation in conjunction with Catalog
Build: mvn package
Start: java -jar target/checkout.jar
"""


EDPA_MULTI_SUT_NL = """# Multi-SUT Test Environment

[environment1]

name = EDPA

ip = 1.92.123.95

port = 8190

[environment2]

name = versatile_mock

ip = 1.92.123.95

port = 30001

[environment3]

name = front_tool

ip = 1.92.123.95

port = 3010

Services on all three ports are running.

[LLM]

base_url = *********

api_key = **********

model = *********

If the test environment (SUT)/service involved in the feature requires LLM, please replace the environment variables with the above configuration.

[source_path] The source code path is **************

If it is not accessible locally, the source code is: https://github.com/Bensinanren/spring-ai-ascend/tree/edpa_java
"""


PAIRED_LIST_NL_SUT = """The modules tested here are xx and yy, with corresponding test environments at http://xx:xx and http://yy:yy, and their corresponding source code addresses at xx and yy, respectively.
"""


class MultiSutManifestTests(unittest.TestCase):
    def test_valid_two_target_manifest_normalizes_paths_and_artifacts(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            manifest_path = root / "autotestflow.suts.md"
            write(manifest_path, VALID_MANIFEST)

            data = sut_manifest.load_manifest(str(manifest_path))
            normalized = sut_manifest.validate_and_normalize(
                data,
                manifest_path=str(manifest_path),
                output_dir=str(root / "analysis"),
            )

            self.assertEqual(normalized["schema_version"], sut_manifest.SCHEMA_VERSION)
            self.assertEqual([t["id"] for t in normalized["targets"]], ["api", "worker"])
            api = normalized["targets"][0]
            worker = normalized["targets"][1]
            self.assertEqual(api["knowledge_domain"], "rest_api")
            self.assertEqual(worker["depends_on"], ["api"])
            self.assertTrue(api["source"]["abs_path"].endswith("services/api"))
            self.assertTrue(api["target_output_dir"].endswith("analysis/targets/api"))
            self.assertTrue(worker["contract_path"].endswith("analysis/targets/worker/Contract/contract.md"))
            self.assertTrue(worker["artifact_dirs"]["test_cases"].endswith("analysis/targets/worker/TestCases"))
            self.assertTrue(worker["artifacts"]["report"].endswith("analysis/targets/worker/Reports/report.md"))

            written = sut_manifest.write_normalized(normalized)
            self.assertTrue(Path(written).exists())

    def test_rejects_duplicate_target_ids(self):
        text = VALID_MANIFEST.replace("id: worker", "id: api", 1)
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "manifest.md"
            write(path, text)
            data = sut_manifest.load_manifest(str(path))
            with self.assertRaisesRegex(sut_manifest.ManifestError, "Duplicate target id"):
                sut_manifest.validate_and_normalize(data, manifest_path=str(path))

    def test_rejects_missing_runtime_fields(self):
        text = VALID_MANIFEST.replace("      base_url: http://localhost:8080\n", "", 1)
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "manifest.md"
            write(path, text)
            data = sut_manifest.load_manifest(str(path))
            with self.assertRaisesRegex(sut_manifest.ManifestError, "runtime.base_url"):
                sut_manifest.validate_and_normalize(data, manifest_path=str(path))

    def test_rejects_invalid_dependency(self):
        text = VALID_MANIFEST.replace("depends_on: [api]", "depends_on: [missing]")
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "manifest.md"
            write(path, text)
            data = sut_manifest.load_manifest(str(path))
            with self.assertRaisesRegex(sut_manifest.ManifestError, "unknown target missing"):
                sut_manifest.validate_and_normalize(data, manifest_path=str(path))

    def test_legacy_sut_base_url_converts_to_default_target(self):
        with tempfile.TemporaryDirectory() as td:
            normalized = sut_manifest.normalize_legacy(
                requirement_doc="req.md",
                code_path="src/service",
                sut_base_url="http://localhost:8080/",
                output_dir=str(Path(td) / "out"),
            )
            self.assertEqual(normalized["targets"][0]["id"], "default")
            self.assertEqual(normalized["targets"][0]["runtime"]["base_url"], "http://localhost:8080")
            self.assertTrue(normalized["compatibility"]["from_sut_base_url"])

    def test_example_manifest_validates(self):
        example = REPO / "AutoTestFlow/examples/multi_sut/sut-manifest.md"
        data = sut_manifest.load_manifest(str(example))
        normalized = sut_manifest.validate_and_normalize(data, manifest_path=str(example))
        self.assertEqual([t["id"] for t in normalized["targets"]], ["catalog", "checkout"])

    def test_natural_language_direct_access_target_normalizes_without_source(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            manifest_path = root / "autotestflow.suts.md"
            write(manifest_path, DIRECT_NL_SUT)

            data = sut_manifest.load_manifest(str(manifest_path))
            normalized = sut_manifest.validate_and_normalize(
                data,
                manifest_path=str(manifest_path),
                output_dir=str(root / "analysis"),
            )

            self.assertEqual(normalized["input_format"], "natural_language")
            target = normalized["targets"][0]
            self.assertEqual(target["id"], "catalog-api")
            self.assertEqual(target["runtime"]["mode"], "predeployed")
            self.assertEqual(target["runtime"]["base_url"], "http://127.0.0.1:8081")
            self.assertFalse(target["source"]["available"])
            self.assertTrue(target["source"]["skip_code_scan"])
            self.assertFalse(normalized["sut_description_parse"]["review_required"])

    def test_natural_language_managed_target_records_commands_and_requires_review(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            manifest_path = root / "autotestflow.suts.md"
            write(manifest_path, MANAGED_NL_SUT)

            data = sut_manifest.load_manifest(str(manifest_path))
            normalized = sut_manifest.validate_and_normalize(
                data,
                manifest_path=str(manifest_path),
                output_dir=str(root / "analysis"),
            )

            target = normalized["targets"][0]
            self.assertEqual(target["runtime"]["mode"], "managed")
            self.assertEqual(target["runtime"]["base_url"], "http://localhost:8082")
            self.assertEqual(target["runtime"]["readiness_probe"]["path"], "/actuator/health")
            self.assertEqual(target["runtime"]["commands"]["build"], "mvn -q -DskipTests package")
            self.assertTrue(normalized["sut_description_parse"]["review_required"])
            self.assertIn(
                "managed_runtime_requires_confirmation",
                normalized["sut_description_parse"]["risky_inferences"],
            )

    def test_natural_language_multi_sut_dependency_maps_by_component_name(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            manifest_path = root / "autotestflow.suts.md"
            write(manifest_path, MULTI_DEP_NL_SUT)

            data = sut_manifest.load_manifest(str(manifest_path))
            normalized = sut_manifest.validate_and_normalize(
                data,
                manifest_path=str(manifest_path),
                output_dir=str(root / "analysis"),
            )

            self.assertEqual([t["id"] for t in normalized["targets"]], ["catalog", "checkout"])
            self.assertEqual(normalized["targets"][1]["depends_on"], ["catalog"])

    def test_natural_language_edpa_multi_sut_keeps_global_config_out_of_targets(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            manifest_path = root / "autotestflow.suts.md"
            write(manifest_path, EDPA_MULTI_SUT_NL)

            data = sut_manifest.load_manifest(str(manifest_path))
            normalized = sut_manifest.validate_and_normalize(
                data,
                manifest_path=str(manifest_path),
                output_dir=str(root / "analysis"),
            )

            self.assertEqual([t["id"] for t in normalized["targets"]], ["edpa", "versatile_mock", "front_tool"])
            self.assertEqual([t["name"] for t in normalized["targets"]], ["EDPA", "versatile_mock", "front_tool"])
            self.assertEqual([t["runtime"]["base_url"] for t in normalized["targets"]], [
                "http://1.92.123.95:8190",
                "http://1.92.123.95:30001",
                "http://1.92.123.95:3010",
            ])
            self.assertNotIn("llm", {t["id"] for t in normalized["targets"]})

            primary = normalized["targets"][0]
            self.assertFalse(primary["source"]["available"])
            self.assertEqual(primary["source"]["path"], "**************")
            self.assertTrue(primary["source"]["redacted"])
            self.assertTrue(primary["source"]["skip_code_scan"])
            self.assertIsNone(primary["source"]["abs_path"])
            self.assertEqual(
                primary["source"]["remote_url"],
                "https://github.com/Bensinanren/spring-ai-ascend/tree/edpa_java",
            )
            self.assertIsNone(normalized["targets"][1]["source"]["path"])
            self.assertIsNone(normalized["targets"][2]["source"]["path"])

            defaults_env = normalized["suite"]["defaults"]["environment"]["variables"]
            by_name = {item["name"]: item for item in defaults_env}
            self.assertTrue(by_name["api_key"]["redacted"])
            self.assertEqual(by_name["api_key"]["value"], sut_manifest.REDACTED_VALUE)
            self.assertTrue(normalized["sut_description_parse"]["review_required"])
            self.assertIn("global_source_applied_to_primary", normalized["sut_description_parse"]["reasons"])
            self.assertIn("masked_source_path_requires_review", normalized["sut_description_parse"]["reasons"])
            self.assertIn("role_inference_requires_review", normalized["sut_description_parse"]["reasons"])

    def test_natural_language_global_source_availability_requires_real_local_path(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "src").mkdir()
            manifest_path = root / "autotestflow.suts.md"
            text = """# SUT

[environment1]
name = EDPA
ip = 127.0.0.1
port = 8190

[source_path] The source code path is src
"""
            write(manifest_path, text)

            data = sut_manifest.load_manifest(str(manifest_path))
            normalized = sut_manifest.validate_and_normalize(
                data,
                manifest_path=str(manifest_path),
                output_dir=str(root / "analysis"),
            )

            source = normalized["targets"][0]["source"]
            self.assertTrue(source["available"])
            self.assertEqual(source["path"], "src")
            self.assertFalse(source["skip_code_scan"])
            self.assertEqual(source["abs_path"], str(root / "src"))

    def test_natural_language_compact_paired_list_maps_targets_urls_and_sources(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            manifest_path = root / "autotestflow.suts.md"
            write(manifest_path, PAIRED_LIST_NL_SUT)

            data = sut_manifest.load_manifest(str(manifest_path))
            normalized = sut_manifest.validate_and_normalize(
                data,
                manifest_path=str(manifest_path),
                output_dir=str(root / "analysis"),
            )

            self.assertEqual([t["id"] for t in normalized["targets"]], ["xx", "yy"])
            self.assertEqual([t["name"] for t in normalized["targets"]], ["xx", "yy"])
            self.assertEqual([t["runtime"]["base_url"] for t in normalized["targets"]], [
                "http://xx:xx",
                "http://yy:yy",
            ])
            self.assertEqual([t["source"]["path"] for t in normalized["targets"]], ["xx", "yy"])
            self.assertEqual([t["runtime"]["mode"] for t in normalized["targets"]], ["predeployed", "predeployed"])
            self.assertTrue(all(t["source"]["available"] for t in normalized["targets"]))
            self.assertIn(
                "paired_list_targets_inferred_requires_review",
                normalized["sut_description_parse"]["reasons"],
            )
            self.assertIn("role_inference_requires_review", normalized["sut_description_parse"]["reasons"])

    def test_natural_language_missing_base_url_is_review_required_and_rejected_by_validator(self):
        text = """[Worker]\nSource path: services/worker\nRequires creation before tests\nBuild: echo build\n"""
        candidate, parse_doc = sut_manifest.parse_natural_language_description(text, manifest_path="autotestflow.suts.md")
        self.assertTrue(parse_doc["review"]["required"])
        self.assertIn("missing_base_url", parse_doc["review"]["reasons"])
        with self.assertRaisesRegex(sut_manifest.ManifestError, "runtime.base_url"):
            sut_manifest.validate_and_normalize(candidate, manifest_path="autotestflow.suts.md")

    def test_secret_like_environment_values_are_redacted(self):
        candidate, parse_doc = sut_manifest.parse_natural_language_description(DIRECT_NL_SUT, manifest_path="autotestflow.suts.md")
        variables = parse_doc["candidate_manifest"]["targets"][0]["environment"]["variables"]
        by_name = {item["name"]: item for item in variables}
        self.assertEqual(by_name["API_TOKEN"]["value"], sut_manifest.REDACTED_VALUE)
        self.assertTrue(by_name["API_TOKEN"]["redacted"])
        self.assertIsNone(by_name["REGION"]["value"])

    def test_write_outputs_parse_review_artifacts_for_natural_language(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            manifest_path = root / "autotestflow.suts.md"
            write(manifest_path, DIRECT_NL_SUT)

            rc = sut_manifest.main([
                "--sut-manifest", str(manifest_path),
                "--output-dir", str(root / "analysis"),
                "--write",
            ])
            self.assertEqual(rc, 0)
            self.assertTrue((root / "analysis/RunMetadata/sut_manifest.normalized.json").exists())
            self.assertTrue((root / "analysis/RunMetadata/sut_description.parse.json").exists())
            self.assertTrue((root / "analysis/RunMetadata/sut_description.review.md").exists())
            normalized_doc = json.loads((root / "analysis/RunMetadata/sut_manifest.normalized.json").read_text(encoding="utf-8"))
            self.assertNotIn("_sut_description_parse", normalized_doc)


class ProbeContractMultiSutTests(unittest.TestCase):
    def test_probe_plan_dry_run_records_target_and_probe_source(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            probe_plan = root / "probes.json"
            out = root / "contract_samples.json"
            write_json(probe_plan, {
                "probes": [
                    {"name": "health", "method": "GET", "path": "/health", "accept": "application/json"}
                ]
            })
            rc = probe_contract.main([
                "--target-id", "api",
                "--base-url", "http://localhost:8080",
                "--probe-plan", str(probe_plan),
                "--dry-run",
                "--output", str(out),
            ])
            self.assertEqual(rc, 0)
            doc = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(doc["target_id"], "api")
            self.assertEqual(doc["probe_plan_source"], os.path.abspath(str(probe_plan)))
            self.assertEqual(doc["samples"][0]["name"], "health")

    def test_unreachable_target_is_graceful_and_keeps_target_id(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "samples.json"
            rc = probe_contract.main([
                "--target-id", "closed",
                "--base-url", "http://127.0.0.1:1",
                "--timeout", "0.1",
                "--output", str(out),
            ])
            self.assertEqual(rc, 0)
            doc = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(doc["status"], "unreachable")
            self.assertEqual(doc["target_id"], "closed")
            self.assertFalse(doc["reachable"])

    def test_legacy_fallback_still_uses_a2a_example_probes(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "samples.json"
            rc = probe_contract.main([
                "--base-url", "http://localhost:8080",
                "--dry-run",
                "--output", str(out),
            ])
            self.assertEqual(rc, 0)
            doc = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(doc["target_id"], "default")
            self.assertEqual(doc["probe_plan_source"], "default:a2a-example")
            self.assertEqual(doc["samples"][0]["name"], "discovery")


class RuntimeOrchestrationTests(unittest.TestCase):
    def target(self, base_url, mode="predeployed", commands=None, out=None, target_id="api"):
        out = Path(out or tempfile.mkdtemp())
        return {
            "id": target_id,
            "source": {"abs_path": str(out)},
            "runtime": {
                "mode": mode,
                "base_url": base_url,
                "readiness_probe": {"method": "GET", "path": "/health", "expect_status_lt": 500},
                "commands": commands or {},
            },
            "ready_path": str(out / "targets" / target_id / "Contract" / "sut_ready.json"),
            "case_results_path": str(out / "targets" / target_id / "TestRun" / "case_results.json"),
        }

    def test_predeployed_readiness_success(self):
        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def getcode(self):
                return 200

        with mock.patch.object(sut_runtime.urllib.request, "urlopen", return_value=FakeResponse()):
            target = self.target("http://127.0.0.1:8080")
            result = sut_runtime.orchestrate_target(target, action="ready", timeout=1.0)
            self.assertEqual(result["status"], "ready")
            self.assertTrue(result["reachable"])

    def test_managed_commands_are_dry_run_or_blocked_without_gate(self):
        commands = {"build": "echo build", "start": "echo start"}
        target = self.target("http://127.0.0.1:1", mode="managed", commands=commands)

        dry = sut_runtime.orchestrate_target(target, action="prepare", dry_run=True, timeout=0.1)
        self.assertEqual(dry["status"], "dry_run")
        self.assertEqual([c["name"] for c in dry["commands"]], ["build", "start"])

        blocked = sut_runtime.orchestrate_target(target, action="prepare", dry_run=False, timeout=0.1)
        self.assertEqual(blocked["status"], "command_blocked")
        self.assertFalse(blocked["reachable"])

    def test_env_issue_output_is_target_local(self):
        with tempfile.TemporaryDirectory() as td:
            api = self.target("http://127.0.0.1:1", out=td, target_id="api")
            worker = self.target("http://127.0.0.1:2", out=td, target_id="worker")
            path = sut_runtime.write_target_env_issue(api, "api is down", ["TC_1"])
            self.assertTrue(Path(path).exists())
            self.assertFalse(Path(worker["case_results_path"]).exists())
            doc = json.loads(Path(path).read_text(encoding="utf-8"))
            self.assertEqual(doc["target_id"], "api")
            self.assertEqual(doc["results"][0]["target_id"], "api")


class DocumentationGuardTests(unittest.TestCase):
    def test_docs_present_manifest_as_primary_invocation(self):
        readme = (REPO / "AutoTestFlow/README.md").read_text(encoding="utf-8")
        skill = (REPO / "AutoTestFlow/SKILL.md").read_text(encoding="utf-8")
        self.assertIn("/auto-test-flow 需求.md --sut-manifest autotestflow.suts.md", readme)
        self.assertIn("`--sut-manifest`", skill)
        self.assertNotIn("/auto-test-flow 需求.md <sut源码>/<模块> --sut-base-url", readme)
        self.assertIn("Deprecated compatibility", readme)


if __name__ == "__main__":
    unittest.main()
