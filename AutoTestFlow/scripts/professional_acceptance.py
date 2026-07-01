#!/usr/bin/env python3
"""
professional_acceptance.py - deterministic Professional_experience adapter.

This script consumes TestKnowledgeBase/Professional_experience and emits advisory
artifacts for AutoTestFlow Phase A-D:

  Phase A: QualityGates/professional_acceptance.json for stage5 reporting
  Phase B: QualityGates/professional_case_guidance.json for stage3b case design
  Phase C: QualityGates/professional_acceptance.seed.json and
           QualityGates/professional_acceptance.code_gaps.json for stage1/stage2 gates
  Phase D: QualityGates/ai_eval_readiness.json for AI/Agent readiness

It never creates strong assertions. L2 oracles remain contract.md-only.
"""

import argparse
import json
import os
import re
import sys
from collections import Counter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import output_layout as layout


AI_KEYWORDS = (
    "agent", "llm", "prompt", "tool", "tool_call", "rag", "model", "chat",
    "a2a", "智能体", "大模型", "工具调用", "提示词", "对话"
)
PRODUCTION_KEYWORDS = (
    "production", "canary", "rollback", "rollout", "release", "prod",
    "生产", "灰度", "回滚", "发布", "上线"
)
DFX_KEYWORDS = (
    "dfx", "reliability", "timeout", "dependency", "recovery", "observability",
    "可靠性", "超时", "依赖", "恢复", "降级", "可观测"
)


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data, indent=2):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write("\n")


def read_text(path):
    if not path or not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def repo_root():
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, "..", ".."))


def default_knowledge_root():
    return os.path.join(repo_root(), "TestKnowledgeBase")


def safe_load_json(path, default=None):
    if not path or not os.path.exists(path):
        return default
    try:
        return load_json(path)
    except Exception:
        return default


def as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def flatten_text(obj):
    if obj is None:
        return ""
    if isinstance(obj, str):
        return obj
    if isinstance(obj, (int, float, bool)):
        return str(obj)
    if isinstance(obj, list):
        return " ".join(flatten_text(x) for x in obj)
    if isinstance(obj, dict):
        return " ".join(flatten_text(v) for v in obj.values())
    return str(obj)


def has_keyword(text, keywords):
    low = (text or "").lower()
    return any(k.lower() in low for k in keywords)


def load_professional_knowledge(knowledge_root):
    base = os.path.join(knowledge_root, "Professional_experience")
    criteria_path = os.path.join(base, "acceptance_criteria.json")
    cards_path = os.path.join(base, "company_practice_cards.json")
    sources_path = os.path.join(base, "source_registry.json")
    criteria_doc = safe_load_json(criteria_path, {"meta": {}, "criteria": []})
    cards_doc = safe_load_json(cards_path, {"practice_cards": []})
    sources_doc = safe_load_json(sources_path, {"sources": []})
    return {
        "base": base,
        "criteria_path": criteria_path,
        "criteria_meta": criteria_doc.get("meta", {}),
        "criteria": criteria_doc.get("criteria", []),
        "practice_cards": cards_doc.get("practice_cards", []),
        "sources": sources_doc.get("sources", []),
    }


def load_test_design(output_dir):
    path = layout.existing_target_artifact(output_dir, "test_design")
    data = safe_load_json(path, None)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("cases", [])
    return []


def collect_evidence(output_dir):
    test_design = load_test_design(output_dir)
    result_files = layout.existing_glob(output_dir, "TestRun/results/*.json", ".state/results/*.json")
    results = [safe_load_json(p, {}) for p in result_files]
    trace_files = layout.existing_glob(output_dir, "TestRun/trace/*.jsonl", ".state/trace/*.jsonl")
    stage_summary_path = layout.existing_target_artifact(output_dir, "stage_summary")
    code_facts_path = layout.existing_target_artifact(output_dir, "s2_code_facts")
    fault_matches_path = layout.existing_target_artifact(output_dir, "fault_matches")
    knowledge_matches_path = layout.existing_target_artifact(output_dir, "knowledge_matches")
    contract_path = layout.existing_target_artifact(output_dir, "contract")
    test_design_path = layout.existing_target_artifact(output_dir, "test_design")
    case_results_path = layout.existing_target_artifact(output_dir, "case_results")
    report_path = layout.existing_target_artifact(output_dir, "report")
    stage_summary = safe_load_json(stage_summary_path, {}) or {}
    code_facts = safe_load_json(code_facts_path, {}) or {}
    fault_matches = safe_load_json(fault_matches_path, {}) or {}
    knowledge_matches = safe_load_json(knowledge_matches_path, {}) or {}
    case_results = safe_load_json(case_results_path, {}) or {}

    oracle_cases = [
        c for c in test_design
        if isinstance(c.get("oracle_refs"), list) and c.get("oracle_refs")
    ]
    l2_cases = [
        c for c in oracle_cases
        if any((o or {}).get("assert_level") == "L2" for o in c.get("oracle_refs", []))
    ]
    fault_ref_cases = [c for c in test_design if c.get("fault_ref")]
    dfx_cases = [c for c in test_design if c.get("test_type") == "dfx" or c.get("dimension")]
    case_kinds = Counter(c.get("case_kind", "unknown") for c in test_design)
    classes = Counter((r.get("class") or r.get("status") or "unknown") for r in results)

    text_parts = [
        read_text(layout.existing_target_artifact(output_dir, "requirement_analysis")),
        read_text(layout.existing_target_artifact(output_dir, "code_analysis")),
        read_text(contract_path),
        flatten_text(test_design),
        flatten_text(stage_summary),
        flatten_text(code_facts),
        flatten_text(fault_matches),
        flatten_text(knowledge_matches),
    ]
    corpus = " ".join(text_parts)

    return {
        "paths": {
            "contract": contract_path,
            "test_design": test_design_path,
            "case_results": case_results_path,
            "stage_summary": stage_summary_path,
            "fault_matches": fault_matches_path,
            "knowledge_matches": knowledge_matches_path,
        },
        "exists": {
            "contract.md": os.path.exists(contract_path),
            "test_design.json": os.path.exists(test_design_path),
            "case_results.json": os.path.exists(case_results_path),
            "stage_summary.json": os.path.exists(stage_summary_path),
            "fault_matches.json": os.path.exists(fault_matches_path),
            "knowledge_matches.json": os.path.exists(knowledge_matches_path),
            "report.md": os.path.exists(report_path),
        },
        "test_design": test_design,
        "results": results,
        "case_results": case_results,
        "stage_summary": stage_summary,
        "code_facts": code_facts,
        "fault_matches": fault_matches,
        "knowledge_matches": knowledge_matches,
        "result_files": result_files,
        "trace_files": trace_files,
        "counts": {
            "cases": len(test_design),
            "oracle_cases": len(oracle_cases),
            "l2_cases": len(l2_cases),
            "fault_ref_cases": len(fault_ref_cases),
            "dfx_cases": len(dfx_cases),
            "results": len(results),
            "trace_files": len(trace_files),
        },
        "case_kinds": dict(case_kinds),
        "classes": dict(classes),
        "corpus": corpus,
    }


def infer_profile(evidence):
    corpus = evidence.get("corpus", "")
    has_ai = has_keyword(corpus, AI_KEYWORDS)
    has_dfx = (
        has_keyword(corpus, DFX_KEYWORDS)
        or evidence["counts"]["dfx_cases"] > 0
        or "dfx" in flatten_text(evidence.get("knowledge_matches", {})).lower()
    )
    production = has_keyword(corpus, PRODUCTION_KEYWORDS)
    domains = set()
    if "web" in corpus.lower() or "frontend" in corpus.lower() or "页面" in corpus:
        domains.add("web")
    if "api" in corpus.lower() or "http" in corpus.lower() or "接口" in corpus:
        domains.add("rest_api")
    if has_ai:
        domains.add("agent")
    if has_dfx:
        domains.add("dfx")
    if not domains:
        domains.add("rest_api")
    return {
        "domains": sorted(domains),
        "is_ai_or_agent": has_ai,
        "has_dfx_scope": has_dfx,
        "production_rollout_signals": production,
        "high_risk_release": has_dfx or production,
    }


def criterion_stage_scope(criterion):
    return as_list(criterion.get("stage_scope"))


def criterion_applicable(criterion, profile):
    dim = criterion.get("dimension", "")
    applies_to = set(as_list(criterion.get("applies_to")))
    if dim.startswith("ai") or "ai_" in dim:
        return profile["is_ai_or_agent"]
    if criterion.get("standard_id") == "PE-SW-CANARY-READINESS":
        return profile["production_rollout_signals"]
    if criterion.get("standard_id") == "PE-SW-RELIABILITY-DFX":
        return profile["has_dfx_scope"] or profile["high_risk_release"]
    if applies_to:
        return bool(applies_to & set(profile["domains"])) or "rest_api" in applies_to
    return True


def missing_default(criterion):
    return criterion.get("default_status_when_missing") or "warn"


def evidence_hit(evidence, names):
    counts = evidence["counts"]
    exists = evidence["exists"]
    canonical_names = {
        "Contract/contract.md": "contract.md",
        "KnowledgeBase/fault_matches.json": "fault_matches.json",
        "KnowledgeBase/knowledge_matches.json": "knowledge_matches.json",
        "Reports/report.md": "report.md",
        "TestCases/scene_tc_mapping.json": "scene_tc_mapping.json",
        "TestCases/test_design.json": "test_design.json",
        "TestRun/case_results.json": "case_results.json",
    }
    hits = []
    missing = []
    for name in names:
        lookup = canonical_names.get(name, name)
        hit = False
        if lookup in ("test_design.json", "scene_tc_mapping.json"):
            hit = exists["test_design.json"] and counts["cases"] > 0
        elif lookup == "case_results.json":
            hit = exists["case_results.json"] or counts["results"] > 0
        elif lookup in ("runtime_summary", "failure_classification"):
            hit = bool(evidence["classes"]) or exists["case_results.json"]
        elif lookup == "contract.md":
            hit = exists["contract.md"]
        elif lookup == "oracle_refs":
            hit = counts["oracle_cases"] > 0
        elif lookup in ("fault_matches.json", "knowledge_matches.json"):
            hit = exists["fault_matches.json"] or exists["knowledge_matches.json"]
        elif lookup == "trace_files":
            hit = counts["trace_files"] > 0 or any(r.get("trace_file") for r in evidence["results"])
        elif lookup in ("logs", "tool_call_trace", "agent_trace"):
            hit = lookup in evidence["corpus"].lower() or counts["trace_files"] > 0
        elif lookup == "dfx_cases":
            hit = counts["dfx_cases"] > 0 or "dfx" in evidence["corpus"].lower()
        elif lookup in ("fault_injection_scope", "metrics", "recovery_trace"):
            hit = lookup in evidence["corpus"].lower() or "dfx" in evidence["corpus"].lower()
        elif lookup == "report.md":
            hit = exists["report.md"]
        elif lookup == "project_profile":
            hit = True
        else:
            hit = lookup.lower() in evidence["corpus"].lower()
        (hits if hit else missing).append(name)
    return hits, missing


def evaluate_criterion(criterion, evidence, profile):
    sid = criterion.get("standard_id", "")
    evidence_required = as_list(criterion.get("evidence_required"))
    applicable = criterion_applicable(criterion, profile)
    if not applicable:
        return {
            "standard_id": sid,
            "name": criterion.get("name", ""),
            "dimension": criterion.get("dimension", ""),
            "release_gate": criterion.get("release_gate", "warn"),
            "status": "not_applicable",
            "risk": "low",
            "evidence_found": [],
            "evidence_missing": evidence_required,
            "action": "Not applicable for the inferred project profile.",
            "source_refs": criterion.get("source_refs", []),
            "advisory_only": True,
        }

    found, missing = evidence_hit(evidence, evidence_required)
    status = "pass"
    risk = "low"
    action = "Keep the current evidence and continue monitoring."

    if sid == "PE-SW-CONTRACT-COVERAGE":
        if not evidence["exists"]["contract.md"] or evidence["counts"]["oracle_cases"] == 0:
            status, risk, action = "fail", "high", "Add contract.md and contract-backed oracle_refs before release."
        elif evidence["counts"]["l2_cases"] == 0:
            status, risk, action = "warn", "medium", "Add at least one spec-required L2 oracle where contract allows it."
    elif sid == "PE-SW-FAULT-COVERAGE":
        if evidence["exists"]["fault_matches.json"] or evidence["exists"]["knowledge_matches.json"]:
            if evidence["counts"]["fault_ref_cases"] == 0:
                status, risk, action = "warn", "medium", "Generate or retain fault_ref cases from knowledge matches."
        else:
            status, risk, action = "warn", "medium", "Run TestKnowledgeBase matching or document why it is not applicable."
    elif sid == "PE-SW-E2E-BALANCE":
        kinds = set(evidence.get("case_kinds", {}))
        if evidence["counts"]["cases"] > 3 and len(kinds) <= 1:
            status, risk, action = "warn", "medium", "Diversify case_kind coverage; avoid one-shape E2E suites."
    elif sid == "PE-SW-OBSERVABILITY":
        if evidence["counts"]["trace_files"] == 0 and not any(r.get("trace_file") for r in evidence["results"]):
            status, risk, action = "warn", "medium", "Attach trace/log evidence so failures are diagnosable."
    elif sid == "PE-SW-FAST-FEEDBACK":
        if evidence["counts"]["cases"] == 0:
            status, risk, action = "warn", "medium", "Generate at least a small, fast smoke/API feedback layer."
    elif sid == "PE-REPORT-ACTIONABLE":
        if not evidence["exists"]["case_results.json"] and not evidence["results"]:
            status, risk, action = "fail", "high", "Generate classified execution results before release reporting."
        elif not evidence["exists"]["report.md"]:
            status, risk, action = "warn", "medium", "Generate report.md with classifications, evidence, and next actions."
    elif sid.startswith("PE-AI-"):
        if missing:
            status = "fail" if criterion.get("release_gate") in ("must_for_ai_release", "must_for_agent_release") else "warn"
            risk = "high" if status == "fail" else "medium"
            action = "Add AI/Agent readiness evidence: " + ", ".join(missing[:4])
    elif sid in ("PE-SW-RELIABILITY-DFX", "PE-SW-CANARY-READINESS"):
        if missing:
            status = "requires_human_review" if not criterion.get("auto_evaluable", True) else missing_default(criterion)
            risk = "high" if status in ("fail", "requires_human_review") else "medium"
            action = "Provide release/DFX evidence or record an explicit non-applicability decision."
    elif missing:
        status = missing_default(criterion)
        risk = "medium" if status in ("warn", "requires_human_review") else "high"
        action = "Provide missing evidence: " + ", ".join(missing[:4])

    return {
        "standard_id": sid,
        "name": criterion.get("name", ""),
        "dimension": criterion.get("dimension", ""),
        "release_gate": criterion.get("release_gate", "warn"),
        "status": status,
        "risk": risk,
        "evidence_found": found,
        "evidence_missing": missing,
        "action": action,
        "source_refs": criterion.get("source_refs", []),
        "advisory_only": True,
    }


def summarize_gates(gates):
    return dict(Counter(g["status"] for g in gates))


def make_acceptance_refs(gates, criteria_by_id):
    refs = []
    for g in gates:
        if g["status"] == "not_applicable":
            continue
        c = criteria_by_id.get(g["standard_id"], {})
        if "stage3b_case_design" not in criterion_stage_scope(c):
            continue
        refs.append({
            "standard_id": g["standard_id"],
            "dimension": g["dimension"],
            "release_gate": g["release_gate"],
            "reason": c.get("intent", g.get("action", "")),
            "evidence_required": c.get("evidence_required", []),
            "status_hint": g["status"],
        })
    return refs


def build_outputs(knowledge, evidence, profile):
    criteria = knowledge["criteria"]
    criteria_by_id = {c.get("standard_id"): c for c in criteria}
    gates = [evaluate_criterion(c, evidence, profile) for c in criteria]
    acceptance_refs = make_acceptance_refs(gates, criteria_by_id)
    ai_gates = [g for g in gates if g.get("dimension", "").startswith("ai")]
    residual_risks = [
        {
            "standard_id": g["standard_id"],
            "risk": g["risk"],
            "status": g["status"],
            "action": g["action"],
        }
        for g in gates if g["status"] in ("warn", "fail", "requires_human_review")
    ]

    meta = {
        "generated_by": "professional_acceptance.py",
        "knowledge_version": knowledge["criteria_meta"].get("version"),
        "runtime_schema": knowledge["criteria_meta"].get("runtime_schema", "professional_acceptance.v1"),
        "contract_policy": "advisory_only",
    }
    seed = {
        "meta": dict(meta, artifact="professional_acceptance.seed"),
        "project_profile": profile,
        "recommended_gates": [
            g for g in gates
            if "stage1_plan" in criterion_stage_scope(criteria_by_id.get(g["standard_id"], {}))
            and g["status"] != "not_applicable"
        ],
    }
    code_gaps = {
        "meta": dict(meta, artifact="professional_acceptance.code_gaps"),
        "project_profile": profile,
        "gaps": [
            g for g in gates
            if "stage2_code_scan" in criterion_stage_scope(criteria_by_id.get(g["standard_id"], {}))
            and g["status"] in ("warn", "fail", "requires_human_review")
        ],
    }
    case_guidance = {
        "meta": dict(meta, artifact="professional_case_guidance"),
        "project_profile": profile,
        "acceptance_refs": acceptance_refs,
        "evidence_required": sorted({e for ref in acceptance_refs for e in ref.get("evidence_required", [])}),
        "case_generation_notes": [
            "Add acceptance_refs to generated cases when relevant.",
            "Professional_experience is advisory: do not raise assertion levels beyond contract.md.",
            "AI/Agent guidance is not_applicable unless the project profile contains AI/Agent signals.",
        ],
    }
    professional_acceptance = {
        "meta": dict(meta, artifact="professional_acceptance"),
        "project_profile": profile,
        "summary": summarize_gates(gates),
        "gates": gates,
        "residual_risks": residual_risks,
    }
    ai_readiness = {
        "meta": dict(meta, artifact="ai_eval_readiness"),
        "is_ai_or_agent": profile["is_ai_or_agent"],
        "summary": summarize_gates(ai_gates),
        "gates": ai_gates,
        "overall_status": (
            "not_applicable" if not profile["is_ai_or_agent"]
            else "fail" if any(g["status"] == "fail" for g in ai_gates)
            else "requires_human_review" if any(g["status"] == "requires_human_review" for g in ai_gates)
            else "warn" if any(g["status"] == "warn" for g in ai_gates)
            else "pass"
        ),
    }
    return {
        "seed": seed,
        "code_gaps": code_gaps,
        "case_guidance": case_guidance,
        "professional_acceptance": professional_acceptance,
        "ai_eval_readiness": ai_readiness,
    }


def write_outputs(output_dir, outputs, mode):
    targets = {
        "seed": layout.target_artifact(output_dir, "professional_acceptance_seed", create_parent=True),
        "code-gaps": layout.target_artifact(output_dir, "professional_acceptance_code_gaps", create_parent=True),
        "case-guidance": layout.target_artifact(output_dir, "professional_case_guidance", create_parent=True),
        "report": layout.target_artifact(output_dir, "professional_acceptance", create_parent=True),
        "ai-readiness": layout.target_artifact(output_dir, "ai_eval_readiness", create_parent=True),
    }
    selected = {
        "seed": ["seed"],
        "code-gaps": ["code-gaps"],
        "case-guidance": ["case-guidance"],
        "report": ["report", "ai-readiness"],
        "ai-readiness": ["ai-readiness"],
        "all": ["seed", "code-gaps", "case-guidance", "report", "ai-readiness"],
    }[mode]
    payload_by_target = {
        "seed": outputs["seed"],
        "code-gaps": outputs["code_gaps"],
        "case-guidance": outputs["case_guidance"],
        "report": outputs["professional_acceptance"],
        "ai-readiness": outputs["ai_eval_readiness"],
    }
    written = []
    for key in selected:
        save_json(targets[key], payload_by_target[key])
        written.append(targets[key])
    return written


def main():
    parser = argparse.ArgumentParser(description="Generate Professional_experience advisory artifacts")
    parser.add_argument("--output-dir", required=True, help="AutoTestFlow output directory")
    parser.add_argument("--knowledge-root", default=None, help="TestKnowledgeBase root")
    parser.add_argument("--mode", default="all",
                        choices=["all", "seed", "code-gaps", "case-guidance", "report", "ai-readiness"])
    parser.add_argument("--json", action="store_true", help="Print machine-readable summary")
    args = parser.parse_args()

    knowledge_root = os.path.abspath(args.knowledge_root or default_knowledge_root())
    if not os.path.exists(knowledge_root):
        print(f"[professional_acceptance] skip: knowledge root not found: {knowledge_root}")
        return 0

    knowledge = load_professional_knowledge(knowledge_root)
    if not knowledge["criteria"]:
        print("[professional_acceptance] skip: no Professional_experience criteria found")
        return 0

    evidence = collect_evidence(args.output_dir)
    profile = infer_profile(evidence)
    outputs = build_outputs(knowledge, evidence, profile)
    written = write_outputs(args.output_dir, outputs, args.mode)
    summary = {
        "generated_by": "professional_acceptance.py",
        "mode": args.mode,
        "written": written,
        "professional_acceptance": outputs["professional_acceptance"]["summary"],
        "ai_eval_readiness": outputs["ai_eval_readiness"]["overall_status"],
    }
    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print(f"Professional gates: {summary['professional_acceptance']}")
        print(f"AI readiness: {summary['ai_eval_readiness']}")
        for path in written:
            print(f"Output: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
