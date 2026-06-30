#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]


def load_module(rel_path, name):
    spec = importlib.util.spec_from_file_location(name, REPO / rel_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prepare_code_scan = load_module("AutoTestFlow/scripts/prepare_code_scan.py", "prepare_code_scan")


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


class Stage2CodeScanAdapterTests(unittest.TestCase):
    def build(self, files):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / "sut"
            out = Path(td) / "out"
            for rel_path, text in files.items():
                write(root / rel_path, text)
            plan = prepare_code_scan.build_plan(root, out)
            written = prepare_code_scan.write_plan(plan, out)
            self.assertTrue(written.exists())
            loaded = json.loads(written.read_text(encoding="utf-8"))
            self.assertEqual(plan["primary_profile"], loaded["primary_profile"])
            return plan

    def test_detects_java_spring_profile(self):
        plan = self.build({
            "pom.xml": "<project><artifactId>demo</artifactId></project>",
            "src/main/java/demo/App.java": """
                package demo;
                import org.springframework.web.bind.annotation.*;
                @RestController
                class App {
                  @GetMapping("/health")
                  public String health() { return "ok"; }
                }
            """,
        })
        self.assertEqual(plan["primary_profile"], "java.spring")
        self.assertEqual(plan["language"], "java")
        self.assertGreaterEqual(plan["confidence"], 0.8)
        self.assertIn("spring", plan["frameworks"])

    def test_detects_python_web_profile_across_common_styles(self):
        plan = self.build({
            "requirements.txt": "fastapi\nflask\ndjango\n",
            "app.py": """
                from fastapi import FastAPI, APIRouter, HTTPException
                from flask import Flask
                from django.urls import path
                app = FastAPI()
                router = APIRouter()
                flask_app = Flask(__name__)

                @app.post("/items")
                def create_item():
                    raise HTTPException(status_code=400, detail="bad")

                @flask_app.route("/legacy")
                def legacy():
                    return {"ok": True}

                urlpatterns = [path("django/", create_item)]
            """,
        })
        self.assertEqual(plan["primary_profile"], "python.web_api")
        self.assertEqual(plan["language"], "python")
        self.assertGreaterEqual(plan["confidence"], 0.8)
        self.assertTrue({"fastapi", "flask", "django"}.issubset(set(plan["frameworks"])))

    def test_detects_cpp_service_rpc_profile(self):
        plan = self.build({
            "CMakeLists.txt": "add_executable(server main.cpp)\n",
            "api/task.proto": "service TaskService { rpc GetTask(TaskRequest) returns (TaskReply); }\n",
            "src/main.cpp": """
                #include <grpcpp/grpcpp.h>
                class TaskServiceImpl final {
                  grpc::Status GetTask() { return grpc::Status::OK; }
                };
                int main() {
                  grpc::ServerBuilder builder;
                  builder.AddListeningPort("0.0.0.0:50051", grpc::InsecureServerCredentials());
                }
            """,
        })
        self.assertEqual(plan["primary_profile"], "cpp.service_rpc")
        self.assertEqual(plan["language"], "cpp")
        self.assertGreaterEqual(plan["confidence"], 0.8)
        self.assertIn("grpc", plan["frameworks"])

    def test_uses_generic_fallback_for_unknown_tree(self):
        plan = self.build({
            "README.md": "# Demo\n\nThis library has utility functions but no service endpoint.\n",
            "src/data.txt": "plain text\n",
        })
        self.assertEqual(plan["primary_profile"], "generic.source_tree")
        self.assertEqual(plan["language"], "unknown")
        self.assertLess(plan["confidence"], 0.6)

    def test_profiles_have_required_probe_categories(self):
        profiles = json.loads((REPO / "AutoTestFlow/shared/code_scan_profiles.json").read_text(encoding="utf-8"))
        required = set(profiles["required_probe_categories"])
        self.assertEqual(required, {
            "structure",
            "entrypoints",
            "errors",
            "serialization",
            "constraints",
            "streaming",
            "configuration",
            "dependencies",
        })
        profile_ids = {p["profile_id"] for p in profiles["profiles"]}
        self.assertEqual(profile_ids, {
            "java.spring",
            "python.web_api",
            "cpp.service_rpc",
            "generic.source_tree",
        })
        for profile in profiles["profiles"]:
            self.assertTrue(required.issubset(set(profile["probe_categories"])), profile["profile_id"])

    def test_stage2_docs_do_not_restore_java_only_assumption(self):
        guarded = [
            "AutoTestFlow/templates/stage2_code_scan.md",
            "AutoTestFlow/shared/code_analysis_template.md",
            "AutoTestFlow/shared/scenario_schema.md",
            "AutoTestFlow/SKILL.md",
            "AutoTestFlow/README.md",
            "AutoTestFlow/DESIGN.md",
            "AutoTestFlow/templates/stage2_5_contract_calibrate.md",
            "AutoTestFlow/templates/stage1_req_analyze.md",
            "AutoTestFlow/shared/rules.md",
        ]
        java_spring = "Java" + "/Spring"
        java_word = "Java"
        forbidden = [
            "你是 " + java_spring + " 静态分析专家",
            "面向 " + java_spring + " 被测系统",
            "任意 " + java_spring + " SUT",
            java_word + "代码扫描",
            java_spring + " 静态扫描 →",
            java_word + " 源事实",
            java_word + " 源码序列化事实",
            java_word + " 结构静态派生",
        ]
        for rel_path in guarded:
            text = (REPO / rel_path).read_text(encoding="utf-8")
            for phrase in forbidden:
                self.assertNotIn(phrase, text, f"{phrase!r} found in {rel_path}")


if __name__ == "__main__":
    unittest.main()
