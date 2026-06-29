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

    fault_domain = manifest.get("domains", {}).get("fault", {})
    registry = fault_domain.get("runtime_registry")
    if registry and not os.path.exists(os.path.join(root, registry)):
        add_error(errors, manifest_path, "runtime_registry does not exist")

    default_lib = os.path.join(root, fault_domain.get("default_runtime_file", ""))
    if not os.path.exists(default_lib):
        add_error(errors, manifest_path, "default_runtime_file does not exist")


def validate_registry(root, parsed, errors):
    registry_path = "TestKnowledgeBase/registry.json"
    registry = parsed.get(registry_path)
    if not registry:
        manifest = parsed.get("TestKnowledgeBase/manifest.json") or {}
        fault_domain = manifest.get("domains", {}).get("fault", {})
        if fault_domain.get("runtime_registry"):
            add_error(errors, registry_path, "runtime_registry is declared but registry is missing")
        return

    if registry.get("status") != "runtime_source_of_truth":
        add_error(errors, registry_path, "status must be runtime_source_of_truth")
    if not registry.get("version"):
        add_error(errors, registry_path, "version is required")

    packages = registry.get("packages")
    if not isinstance(packages, list) or not packages:
        add_error(errors, registry_path, "packages must be a non-empty list")
        return

    seen = set()
    package_ids = set()
    for pkg in packages:
        pid = pkg.get("package_id")
        if not pid:
            add_error(errors, registry_path, "package_id is required")
            continue
        if pid in seen:
            add_error(errors, registry_path, f"duplicate package_id {pid}")
        seen.add(pid)
        package_ids.add(pid)

        path = pkg.get("path")
        if not path:
            add_error(errors, registry_path, f"{pid}: path is required")
        elif not os.path.exists(os.path.join(root, "TestKnowledgeBase", path)):
            add_error(errors, registry_path, f"{pid}: registered path does not exist: {path}")

        if not pkg.get("domain"):
            add_error(errors, registry_path, f"{pid}: domain is required")

        if pkg.get("type") == "fault":
            if not pkg.get("default_branch_class"):
                add_error(errors, registry_path, f"{pid}: default_branch_class is required")
            if not isinstance(pkg.get("default_contract_kinds", []), list):
                add_error(errors, registry_path, f"{pid}: default_contract_kinds must be a list")
            rules = pkg.get("category_rules", [])
            if not isinstance(rules, list):
                add_error(errors, registry_path, f"{pid}: category_rules must be a list")
            for rule in rules:
                if not rule.get("category_prefix"):
                    add_error(errors, registry_path, f"{pid}: category_rule.category_prefix is required")

    default_ids = (registry.get("default_runtime") or {}).get("package_ids", [])
    for pid in default_ids:
        if pid not in package_ids:
            add_error(errors, registry_path, f"default_runtime references unknown package_id {pid}")


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
    validate_registry(root, parsed, errors)
    validate_fault_libraries(root, parsed, errors)
    validate_professional_experience(parsed, errors)

    report = {
        "generated_by": "validate_knowledge_base.py",
        "ok": not errors,
        "test_knowledge_base": "TestKnowledgeBase",
        "default_fault_lib": "TestKnowledgeBase/Fault/rest_api_faults.json",
        "runtime_registry": "TestKnowledgeBase/registry.json",
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
