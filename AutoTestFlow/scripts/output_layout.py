#!/usr/bin/env python3
"""Canonical AutoTestFlow output archive layout.

New runs write to functional directories. Readers use canonical paths first and
then fall back to the historical flat/.state layout so old archives remain
inspectable.
"""

from __future__ import annotations

import os
from glob import glob
from pathlib import Path


ROOT_DIRS = {
    "run_metadata": "RunMetadata",
    "feature_analysis": "FeatureAnalysis",
    "reports": "Reports",
}

TARGET_DIRS = {
    "feature_analysis": "FeatureAnalysis",
    "contract": "Contract",
    "knowledge_base": "KnowledgeBase",
    "quality_gates": "QualityGates",
    "test_cases": "TestCases",
    "test_run": "TestRun",
    "test_run_tests": "TestRun/tests",
    "test_run_results": "TestRun/results",
    "test_run_trace": "TestRun/trace",
    "reports": "Reports",
    "fault_analysis": "FaultAnalysis",
    "fault_analysis_targets": "FaultAnalysis/targets",
    "remediation": "Remediation",
    "remediation_defects": "Remediation/defects",
    "remediation_issue_bodies": "Remediation/issue_bodies",
    "remediation_trace": "Remediation/trace",
}

ROOT_ARTIFACTS = {
    "normalized_manifest": ("RunMetadata/sut_manifest.normalized.json", [".state/sut_manifest.normalized.json"]),
    "sut_description_parse": ("RunMetadata/sut_description.parse.json", [".state/sut_description.parse.json"]),
    "sut_description_review": ("RunMetadata/sut_description.review.md", [".state/sut_description.review.md"]),
    "aggregate_report": ("Reports/report.md", ["report.md"]),
}

TARGET_ARTIFACTS = {
    "code_scan_plan": ("FeatureAnalysis/code_scan_plan.json", [".state/code_scan_plan.json"]),
    "requirement_analysis": ("FeatureAnalysis/requirement_analysis.md", ["requirement_analysis.md"]),
    "s1_scenario_examples": ("FeatureAnalysis/s1_scenario_examples.md", [".state/s1_scenario_examples.md"]),
    "code_analysis": ("FeatureAnalysis/code_analysis.md", ["code_analysis.md"]),
    "s1_index": ("FeatureAnalysis/s1_index.json", [".state/s1_index.json"]),
    "s2_code_facts": ("FeatureAnalysis/s2_code_facts.json", [".state/s2_code_facts.json"]),
    "stage_summary": ("FeatureAnalysis/stage_summary.json", [".state/stage_summary.json"]),
    "framework_scenes": ("FeatureAnalysis/framework_scenes.json", [".state/framework_scenes.json"]),
    "fp_mapping": ("FeatureAnalysis/fp_mapping.json", [".state/fp_mapping.json"]),
    "s3a_framework": ("FeatureAnalysis/s3a_framework.json", [".state/s3a_framework.json"]),
    "s3a_enriched_index": ("FeatureAnalysis/s3a_enriched_index.json", [".state/s3a_enriched_index.json"]),
    "s3a_scenario_landscape": ("FeatureAnalysis/s3a_scenario_landscape.md", [".state/s3a_scenario_landscape.md"]),
    "defect_hints": ("FeatureAnalysis/defect_hints.json", [".state/defect_hints.json"]),
    "contract": ("Contract/contract.md", ["contract.md"]),
    "contract_samples": ("Contract/contract_samples.json", [".state/contract_samples.json"]),
    "sut_ready": ("Contract/sut_ready.json", [".state/sut_ready.json"]),
    "knowledge_matches": ("KnowledgeBase/knowledge_matches.json", [".state/knowledge_matches.json"]),
    "fault_matches": ("KnowledgeBase/fault_matches.json", [".state/fault_matches.json"]),
    "fault_contract_alignment": ("KnowledgeBase/fault_contract_alignment.md", [".state/fault_contract_alignment.md"]),
    "new_knowledge_candidates": ("KnowledgeBase/new_knowledge_candidates.json", [".state/new_knowledge_candidates.json"]),
    "new_faults_detected": ("KnowledgeBase/new_faults_detected.json", [".state/new_faults_detected.json"]),
    "professional_acceptance_seed": (
        "QualityGates/professional_acceptance.seed.json",
        [".state/professional_acceptance.seed.json"],
    ),
    "professional_acceptance_code_gaps": (
        "QualityGates/professional_acceptance.code_gaps.json",
        [".state/professional_acceptance.code_gaps.json"],
    ),
    "professional_case_guidance": (
        "QualityGates/professional_case_guidance.json",
        [".state/professional_case_guidance.json"],
    ),
    "professional_acceptance": (
        "QualityGates/professional_acceptance.json",
        [".state/professional_acceptance.json"],
    ),
    "ai_eval_readiness": ("QualityGates/ai_eval_readiness.json", [".state/ai_eval_readiness.json"]),
    "test_design": ("TestCases/test_design.json", ["test_design.json"]),
    "test_examples": ("TestCases/test_examples.md", ["test_examples.md"]),
    "scene_tc_mapping": ("TestCases/scene_tc_mapping.json", ["scene_tc_mapping.json"]),
    "e2e_scenes_json": ("TestCases/e2e_scenes.json", ["e2e_scenes.json"]),
    "e2e_scenes_md": ("TestCases/e2e_scenes.md", ["e2e_scenes.md"]),
    "p0_selection": ("TestCases/p0_selection.json", [".state/p0_selection.json"]),
    "validate_test": ("TestRun/validate_test.py", [".state/validate_test.py"]),
    "http_client": ("TestRun/http_client.py", ["http_client.py"]),
    "conftest": ("TestRun/conftest.py", ["conftest.py"]),
    "case_results": ("TestRun/case_results.json", ["case_results.json"]),
    "report": ("Reports/report.md", ["report.md"]),
    "fault_analysis_plan": ("FaultAnalysis/analysis_plan.json", [".state/fault_analysis/analysis_plan.json"]),
    "fault_analysis_manifest": ("FaultAnalysis/manifest.json", [".state/fault_analysis/manifest.json"]),
    "remediation_plan": ("Remediation/plan.json", [".state/remediation/plan.json"]),
    "remediation_manifest": ("Remediation/manifest.json", [".state/remediation/manifest.json"]),
    "remediation_reverify": ("Remediation/reverify.json", [".state/remediation/reverify.json"]),
    "remediation_submitted": ("Remediation/submitted.json", [".state/remediation/submitted.json"]),
}


def _join(base: str | os.PathLike, rel: str) -> str:
    return str(Path(base) / rel)


def ensure_parent(path: str | os.PathLike) -> str:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    return str(path)


def ensure_dir(path: str | os.PathLike) -> str:
    Path(path).mkdir(parents=True, exist_ok=True)
    return str(path)


def relpath(path: str | os.PathLike, output_dir: str | os.PathLike) -> str:
    try:
        return os.path.relpath(path, output_dir)
    except ValueError:
        return str(path)


def root_dir(output_dir: str, key: str, create: bool = False) -> str:
    path = _join(output_dir, ROOT_DIRS[key])
    return ensure_dir(path) if create else path


def target_dir(output_dir: str, key: str, create: bool = False) -> str:
    path = _join(output_dir, TARGET_DIRS[key])
    return ensure_dir(path) if create else path


def root_artifact_dirs(output_dir: str, create: bool = False) -> dict[str, str]:
    return {key: root_dir(output_dir, key, create=create) for key in ROOT_DIRS}


def target_artifact_dirs(output_dir: str, create: bool = False) -> dict[str, str]:
    return {key: target_dir(output_dir, key, create=create) for key in TARGET_DIRS}


def root_artifact(output_dir: str, key: str, create_parent: bool = False) -> str:
    path = _join(output_dir, ROOT_ARTIFACTS[key][0])
    return ensure_parent(path) if create_parent else path


def target_artifact(output_dir: str, key: str, create_parent: bool = False) -> str:
    path = _join(output_dir, TARGET_ARTIFACTS[key][0])
    return ensure_parent(path) if create_parent else path


def root_artifacts(output_dir: str) -> dict[str, str]:
    return {key: root_artifact(output_dir, key) for key in ROOT_ARTIFACTS}


def target_artifacts(output_dir: str) -> dict[str, str]:
    return {key: target_artifact(output_dir, key) for key in TARGET_ARTIFACTS}


def _existing(base: str, canonical_rel: str, legacy_rels: list[str]) -> str:
    candidates = [canonical_rel] + list(legacy_rels)
    for rel in candidates:
        path = _join(base, rel)
        if os.path.exists(path):
            return path
    return _join(base, canonical_rel)


def existing_root_artifact(output_dir: str, key: str) -> str:
    canonical, legacy = ROOT_ARTIFACTS[key]
    return _existing(output_dir, canonical, legacy)


def existing_target_artifact(output_dir: str, key: str) -> str:
    canonical, legacy = TARGET_ARTIFACTS[key]
    return _existing(output_dir, canonical, legacy)


def existing_glob(output_dir: str, canonical_pattern: str, *legacy_patterns: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for pattern in (canonical_pattern,) + legacy_patterns:
        for path in sorted(glob(_join(output_dir, pattern))):
            norm = os.path.abspath(path)
            if norm not in seen:
                seen.add(norm)
                out.append(path)
    return out


def s1_scenarios_dir(output_dir: str, create: bool = False) -> str:
    path = _join(output_dir, "FeatureAnalysis/s1_scenarios")
    return ensure_dir(path) if create else path


def s3a_enriched_dir(output_dir: str, create: bool = False) -> str:
    path = _join(output_dir, "FeatureAnalysis/s3a_enriched")
    return ensure_dir(path) if create else path


def skeleton_dir(output_dir: str, create: bool = False) -> str:
    path = _join(output_dir, "FeatureAnalysis/skeleton")
    return ensure_dir(path) if create else path


def test_file(output_dir: str, case_id_lower: str, create_parent: bool = False) -> str:
    path = _join(output_dir, f"TestRun/tests/test_{case_id_lower}.py")
    return ensure_parent(path) if create_parent else path


def existing_test_file(output_dir: str, case_id_lower: str) -> str:
    canonical = f"TestRun/tests/test_{case_id_lower}.py"
    return _existing(output_dir, canonical, [f"test_{case_id_lower}.py"])


def result_file(output_dir: str, case_id: str, create_parent: bool = False) -> str:
    path = _join(output_dir, f"TestRun/results/{case_id}.json")
    return ensure_parent(path) if create_parent else path


def existing_result_file(output_dir: str, case_id: str) -> str:
    canonical = f"TestRun/results/{case_id}.json"
    return _existing(output_dir, canonical, [f".state/results/{case_id}.json"])


def trace_file(output_dir: str, filename: str, create_parent: bool = False) -> str:
    path = _join(output_dir, f"TestRun/trace/{filename}")
    return ensure_parent(path) if create_parent else path


def fault_analysis_target_dir(output_dir: str, target_id: str, create: bool = False) -> str:
    path = _join(output_dir, f"FaultAnalysis/targets/{target_id}")
    return ensure_dir(path) if create else path


def existing_fault_analysis_target_dir(output_dir: str, target_id: str) -> str:
    canonical = f"FaultAnalysis/targets/{target_id}"
    return _existing(output_dir, canonical, [f".state/fault_analysis/targets/{target_id}"])


def remediation_defect_dir(output_dir: str, case_id: str, create: bool = False) -> str:
    path = _join(output_dir, f"Remediation/defects/{case_id}")
    return ensure_dir(path) if create else path


def existing_remediation_defect_dir(output_dir: str, case_id: str) -> str:
    canonical = f"Remediation/defects/{case_id}"
    return _existing(output_dir, canonical, [f".state/remediation/defects/{case_id}"])
