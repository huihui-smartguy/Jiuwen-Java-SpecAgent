---
name: autotestflow-stage6-fault-analysis
description: Internal AutoTestFlow Worker for Stage 6 domain-aware fault analysis and remediation planning.
---

# Stage6-FaultAnalysis

## Boundary

Owns original Stage 6 analysis only. It writes evidence, root cause, fix plans, and remediation manifests. It does not apply patches or submit issues.

## Owned Assets

- `templates/stage6_fault_analyze.md`
- `templates/stage6_defect_analyze.md`
- `templates/stage6_defect_analyze.beta.md`
- `scripts/remediation_plan.py`
- `shared/remediation_rules.md`
- `shared/fault_analysis_profiles.json`
- `shared/remediation_config_schema.md`
- `examples/remediation.config.example.json`
- `../_common/reference/remediation_config.py`
- `../_common/scripts/output_layout.py`

## Inputs

- `TestRun/case_results.json`
- `TestRun/results/*.json`
- `TestRun/trace/*.jsonl`
- `Contract/contract.md`
- `FeatureAnalysis/s2_code_facts.json`
- `KnowledgeBase/fault_matches.json` when present
- Valid remediation configuration

## Procedure

1. Validate remediation config.
2. Run `scripts/remediation_plan.py --output-dir <target_output_dir>`.
3. Write `FaultAnalysis/analysis_plan.json` for all diagnostic targets.
4. Write `Remediation/plan.json` only for patchable contract-backed defects.
5. Run `templates/stage6_defect_analyze.md` for patchable contract defects.
6. Run `templates/stage6_fault_analyze.md` for diagnostic/non-patchable targets.
7. Use the beta template only when the beta wiki flag is enabled.
8. Run `scripts/remediation_plan.py --finalize`.
9. Present manifest summary to the Stage6 human gate when `--remediate=on`.

## Outputs

- `FaultAnalysis/analysis_plan.json`
- `FaultAnalysis/manifest.json`
- `FaultAnalysis/targets/<target_id>/*`
- `Remediation/plan.json`
- `Remediation/manifest.json`
- `Remediation/defects/<case_id>/*`

## Gates

Mandatory human confirmation for `--remediate=on` before Stage7 applies or submits anything.

## Non-Goals

- Do not apply patches.
- Do not submit issues.
- Do not treat advisory knowledge as stronger than `Contract/contract.md`.
