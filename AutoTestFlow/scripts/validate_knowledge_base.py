#!/usr/bin/env python3
"""
validate_knowledge_base.py - deterministic TestKnowledgeBase governance checks.

This script validates the repository knowledge layer without using network or LLMs.
It treats TestKnowledgeBase as the forward source of truth and keeps
Specification_Repository out of the required validation path.
"""

import argparse
import json
import os
import sys
from glob import glob


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def repo_root():
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, "..", ".."))


def rel(root, path):
    return os.path.relpath(path, root)


def add_error(errors, path, message):
    errors.append({"file": path, "message": message})


def validate_json_files(root, errors):
    parsed = {}
    for path in sorted(glob(os.path.join(root, "TestKnowledgeBase", "**", "*.json"), recursive=True)):
        rpath = rel(root, path)
        try:
            parsed[rpath] = load_json(path)
        except Exception as exc:
            add_error(errors, rpath, f"invalid JSON: {exc}")
    return parsed


def validate_manifest(root, parsed, errors):
    manifest_path = "TestKnowledgeBase/manifest.json"
    manifest = parsed.get(manifest_path)
    if not manifest:
        add_error(errors, manifest_path, "missing TestKnowledgeBase manifest")
        return
    if manifest.get("status") != "forward_source_of_truth":
        add_error(errors, manifest_path, "status must be forward_source_of_truth")
    if manifest.get("replaces") != "Specification_Repository":
        add_error(errors, manifest_path, "replaces must name Specification_Repository")

    default_lib = os.path.join(root, manifest.get("domains", {}).get("fault", {}).get("default_runtime_file", ""))
    if not os.path.exists(default_lib):
        add_error(errors, manifest_path, "default_runtime_file does not exist")


def validate_fault_libraries(root, parsed, errors):
    seen = {}
    fault_files = [
        p for p in sorted(parsed)
        if p.startswith("TestKnowledgeBase/Fault/") and p.endswith(".json")
    ]
    if not fault_files:
        add_error(errors, "TestKnowledgeBase/Fault", "no fault JSON files found")

    for path in fault_files:
        doc = parsed[path]
        meta = doc.get("meta", {})
        if not meta.get("version"):
            add_error(errors, path, "meta.version is required")
        if not isinstance(doc.get("fault_categories", []), list):
            add_error(errors, path, "fault_categories must be a list")

        for cat in doc.get("fault_categories", []):
            if not cat.get("category_id"):
                add_error(errors, path, "category_id is required")
            for fault in cat.get("faults", []):
                fid = fault.get("fault_id")
                if not fid:
                    add_error(errors, path, "fault_id is required")
                    continue
                if fid in seen:
                    add_error(errors, path, f"duplicate fault_id {fid}; first seen in {seen[fid]}")
                seen[fid] = path
                if not fault.get("name"):
                    add_error(errors, path, f"{fid}: name is required")
                strategy = fault.get("test_strategy")
                if not isinstance(strategy, dict):
                    add_error(errors, path, f"{fid}: test_strategy is required")
                    continue
                if not strategy.get("trigger_pattern"):
                    add_error(errors, path, f"{fid}: test_strategy.trigger_pattern is required")
                if not strategy.get("expected_behavior"):
                    add_error(errors, path, f"{fid}: test_strategy.expected_behavior is required")
                if not isinstance(strategy.get("validation_points", []), list):
                    add_error(errors, path, f"{fid}: validation_points must be a list")

        for hist in doc.get("history_faults", []):
            fid = hist.get("fault_id")
            if not fid:
                add_error(errors, path, "history fault_id is required")
                continue
            if fid in seen:
                add_error(errors, path, f"duplicate fault_id {fid}; first seen in {seen[fid]}")
            seen[fid] = path


def validate_professional_experience(parsed, errors):
    base = "TestKnowledgeBase/Professional_experience"
    sources_doc = parsed.get(f"{base}/source_registry.json")
    cards_doc = parsed.get(f"{base}/company_practice_cards.json")
    criteria_doc = parsed.get(f"{base}/acceptance_criteria.json")
    if not sources_doc or not cards_doc or not criteria_doc:
        add_error(errors, base, "source_registry, company_practice_cards, and acceptance_criteria are required")
        return

    sources = {}
    for src in sources_doc.get("sources", []):
        sid = src.get("source_id")
        if not sid:
            add_error(errors, f"{base}/source_registry.json", "source_id is required")
            continue
        if sid in sources:
            add_error(errors, f"{base}/source_registry.json", f"duplicate source_id {sid}")
        sources[sid] = src

    def check_refs(path, items, id_key):
        for item in items:
            item_id = item.get(id_key, "<unknown>")
            for ref in item.get("source_refs", []):
                if ref not in sources:
                    add_error(errors, path, f"{item_id}: unknown source_ref {ref}")

    check_refs(
        f"{base}/company_practice_cards.json",
        cards_doc.get("practice_cards", []),
        "practice_id",
    )
    check_refs(
        f"{base}/acceptance_criteria.json",
        criteria_doc.get("criteria", []),
        "standard_id",
    )


def main():
    parser = argparse.ArgumentParser(description="Validate TestKnowledgeBase governance rules")
    parser.add_argument("--json", action="store_true", help="emit machine-readable report")
    args = parser.parse_args()

    root = repo_root()
    errors = []
    parsed = validate_json_files(root, errors)
    validate_manifest(root, parsed, errors)
    validate_fault_libraries(root, parsed, errors)
    validate_professional_experience(parsed, errors)

    report = {
        "generated_by": "validate_knowledge_base.py",
        "ok": not errors,
        "test_knowledge_base": "TestKnowledgeBase",
        "default_fault_lib": "TestKnowledgeBase/Fault/rest_api_faults.json",
        "legacy_compatibility_only": "Specification_Repository",
        "json_files_checked": len(parsed),
        "errors": errors,
    }

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        if errors:
            print("Knowledge base validation failed:")
            for err in errors:
                print(f"- {err['file']}: {err['message']}")
        else:
            print(
                "Knowledge base validation passed "
                f"({len(parsed)} JSON files; default fault lib: TestKnowledgeBase/Fault/rest_api_faults.json)"
            )

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
