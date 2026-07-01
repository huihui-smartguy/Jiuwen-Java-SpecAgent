#!/usr/bin/env python3
"""
TestKnowledgeBase runtime adapter.

This module keeps AutoTestFlow decoupled from concrete knowledge package files.
It supports the new TestKnowledgeBase registry and falls back to glob discovery
inside TestKnowledgeBase/Fault for branches that have not merged the registry yet.
"""

import json
import os
import re
from glob import glob


HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}


def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def repo_root() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, "..", ".."))


def default_knowledge_root() -> str:
    return os.path.join(repo_root(), "TestKnowledgeBase")


def norm_category(category_id: str) -> str:
    parts = (category_id or "").split("-")
    return "-".join(parts[:2]) if len(parts) >= 2 else (category_id or "")


def substitute_placeholders(obj, params: dict):
    if isinstance(obj, str):
        def repl(m):
            key = m.group(1)
            return str(params.get(key, m.group(0)))
        return re.sub(r"\{([a-zA-Z0-9_]+)\}", repl, obj)
    if isinstance(obj, list):
        return [substitute_placeholders(x, params) for x in obj]
    if isinstance(obj, dict):
        return {k: substitute_placeholders(v, params) for k, v in obj.items()}
    return obj


def parse_domain_filter(value):
    if not value or value == "all":
        return None
    out = set()
    for part in re.split(r"[,，\s]+", value):
        if part:
            out.add(part)
    return out or None


def _infer_domain_from_path(path: str) -> str:
    name = os.path.basename(path)
    if "web" in name:
        return "web"
    if "agent" in name:
        return "agent"
    if "dfx" in name or "reliability" in name:
        return "dfx"
    return "rest_api"


def _default_package_for_path(path, root=None):
    path = os.path.abspath(path)
    root = os.path.abspath(root) if root else None
    domain = _infer_domain_from_path(path)
    stem = os.path.splitext(os.path.basename(path))[0]
    package_id = f"fault.{stem}"
    if "Specification_Repository" in path:
        package_id = "legacy.specification_repository"
        domain = "rest_api"
    rel_path = os.path.relpath(path, root) if root and os.path.commonpath([root, path]) == root else path
    return {
        "package_id": package_id,
        "type": "fault",
        "domain": domain,
        "path": rel_path,
        "active": True,
        "default_branch_class": "quality" if domain in {"web", "agent", "dfx"} else "exception",
        "default_contract_kinds": ["RESP_WRAP", "ID_TYPE"] if domain in {"rest_api", "agent"} else ["RESP_WRAP"],
        "scenario_signals": {
            "include_domains": [domain] if domain != "dfx" else ["rest_api", "web", "agent"],
            "cross_cutting": domain == "dfx",
        },
        "category_rules": [],
    }


def _load_registry(knowledge_root):
    path = os.path.join(knowledge_root, "registry.json")
    if os.path.exists(path):
        doc = load_json(path)
        doc["_path"] = path
        return doc
    return None


def _registry_packages(knowledge_root: str, registry: dict) -> list:
    default_ids = set((registry.get("default_runtime") or {}).get("package_ids") or [])
    packages = []
    for pkg in registry.get("packages", []):
        if pkg.get("type") != "fault" or not pkg.get("active", True):
            continue
        if default_ids and pkg.get("package_id") not in default_ids:
            continue
        item = dict(pkg)
        item["_abs_path"] = os.path.join(knowledge_root, item.get("path", ""))
        packages.append(item)
    return packages


def _glob_packages(knowledge_root: str) -> list:
    fault_dir = os.path.join(knowledge_root, "Fault")
    out = []
    for path in sorted(glob(os.path.join(fault_dir, "*.json"))):
        if os.path.basename(path) == "project_faults.json":
            continue
        pkg = _default_package_for_path(path, knowledge_root)
        pkg["_abs_path"] = path
        out.append(pkg)
    return out


def _package_selected(pkg, domains):
    if not domains:
        return True
    return (
        pkg.get("domain") in domains
        or pkg.get("package_id") in domains
        or os.path.basename(pkg.get("path", "")) in domains
    )


def category_rule_for(pkg: dict, category_id: str) -> dict:
    norm = norm_category(category_id)
    for rule in pkg.get("category_rules", []):
        prefix = rule.get("category_prefix", "")
        if not prefix:
            continue
        if category_id.startswith(prefix) or norm == prefix or norm.startswith(prefix):
            return rule
    return {}


def _contract_kinds(pkg: dict, rule: dict) -> list:
    out = []
    for source in (rule.get("contract_kinds", []), pkg.get("default_contract_kinds", [])):
        for kind in source:
            if kind not in out:
                out.append(kind)
    return out


def _normalize_fault(fault, pkg, category, is_history):
    item = dict(fault)
    category_id = (category or {}).get("category_id", "HISTORY" if is_history else "PROJECT")
    rule = category_rule_for(pkg, category_id)
    item["_package_id"] = pkg.get("package_id")
    item["_package_path"] = pkg.get("path")
    item["_domain"] = pkg.get("domain", "rest_api")
    item["_scenario_signals"] = pkg.get("scenario_signals", {})
    item["_category_id"] = category_id
    item["_category"] = "HISTORY" if is_history else norm_category(category_id)
    item["_category_name"] = (category or {}).get("category_name", "")
    item["_is_history"] = is_history
    item["_category_rule"] = rule
    item["_match_rule"] = dict(rule.get("match", {}))
    branch_class = rule.get("branch_class")
    if not branch_class and (pkg.get("category_rules") or pkg.get("domain") != "rest_api"):
        branch_class = pkg.get("default_branch_class", "quality")
    item["_branch_class"] = branch_class
    item["_contract_kinds"] = _contract_kinds(pkg, rule)
    return item


def _apply_overlay(faults, overlay_path, default_pkg):
    overlay_meta = None
    if not overlay_path or not os.path.exists(overlay_path):
        return faults, overlay_meta

    overlay = load_json(overlay_path)
    overlay_meta = dict(overlay.get("meta", {}))
    params = overlay.get("parameter_config", {}) or {}

    disabled = {d.get("ref_fault_id") for d in overlay.get("disabled_faults", [])}
    if disabled:
        faults = [f for f in faults if f.get("fault_id") not in disabled]

    overrides = {o.get("ref_fault_id"): o for o in overlay.get("fault_overrides", [])}
    for fault in faults:
        entry = overrides.get(fault.get("fault_id"))
        if entry and entry.get("custom_test_strategy"):
            fault["test_strategy"] = substitute_placeholders(entry["custom_test_strategy"], params)
            fault["_overridden"] = True

    project_pkg = dict(default_pkg)
    project_pkg["package_id"] = overlay_meta.get("package_id") or "project.overlay"
    project_pkg["domain"] = overlay_meta.get("domain") or default_pkg.get("domain", "rest_api")
    project_pkg["path"] = overlay_path
    for project_fault in overlay.get("project_specific_faults", []):
        item = substitute_placeholders(dict(project_fault), params)
        item = _normalize_fault(item, project_pkg, {"category_id": "PROJECT"}, False)
        item["_source_overlay"] = overlay_path
        faults.append(item)

    for hist in overlay.get("history_faults", []):
        item = substitute_placeholders(dict(hist), params)
        item = _normalize_fault(item, project_pkg, {"category_id": "HISTORY"}, True)
        item["_source_overlay"] = overlay_path
        faults.append(item)

    return faults, overlay_meta


def load_faults(
    fault_lib_path=None,
    overlay_path=None,
    knowledge_root=None,
    domains=None,
):
    """Load TestKnowledgeBase fault packages into a canonical in-memory shape."""
    knowledge_root = os.path.abspath(knowledge_root or default_knowledge_root())
    packages = []
    registry = None

    if fault_lib_path:
        abs_path = os.path.abspath(fault_lib_path)
        pkg = _default_package_for_path(abs_path, knowledge_root if os.path.exists(knowledge_root) else None)
        pkg["_abs_path"] = abs_path
        packages = [pkg]
    else:
        registry = _load_registry(knowledge_root)
        packages = _registry_packages(knowledge_root, registry) if registry else _glob_packages(knowledge_root)

    packages = [pkg for pkg in packages if _package_selected(pkg, domains)]

    faults = []
    loaded_packages = []
    versions = []
    for pkg in packages:
        path = pkg.get("_abs_path") or os.path.join(knowledge_root, pkg.get("path", ""))
        if not os.path.exists(path):
            continue
        doc = load_json(path)
        meta = doc.get("meta", {})
        versions.append(meta.get("version"))
        loaded_packages.append({
            "package_id": pkg.get("package_id"),
            "domain": pkg.get("domain"),
            "path": pkg.get("path"),
            "version": meta.get("version"),
        })
        for cat in doc.get("fault_categories", []):
            for fault in cat.get("faults", []):
                faults.append(_normalize_fault(fault, pkg, cat, False))
        for hist in doc.get("history_faults", []):
            faults.append(_normalize_fault(hist, pkg, {"category_id": "HISTORY"}, True))

    default_pkg = packages[0] if packages else _default_package_for_path(
        os.path.join(knowledge_root, "Fault", "rest_api_faults.json"),
        knowledge_root,
    )
    faults, overlay_meta = _apply_overlay(faults, overlay_path, default_pkg)

    meta = {
        "version": (registry or {}).get("version") or ",".join(v for v in versions if v),
        "source": "explicit_fault_lib" if fault_lib_path else ("registry" if registry else "glob"),
        "knowledge_root": knowledge_root,
        "registry_path": (registry or {}).get("_path"),
        "packages": loaded_packages,
    }
    return faults, meta, overlay_meta


def recording_policy(knowledge_root=None):
    knowledge_root = os.path.abspath(knowledge_root or default_knowledge_root())
    registry = _load_registry(knowledge_root)
    policy = (registry or {}).get("recording", {})
    default_overlay = policy.get("default_overlay") or "Fault/project_faults.json"
    return {
        "default_overlay": os.path.join(knowledge_root, default_overlay),
        "candidate_output": policy.get("candidate_output", "KnowledgeBase/new_knowledge_candidates.json"),
        "legacy_candidate_output": policy.get("legacy_candidate_output", "KnowledgeBase/new_faults_detected.json"),
        "eligible_result_classes": policy.get("eligible_result_classes", ["sdk_defect"]),
    }
