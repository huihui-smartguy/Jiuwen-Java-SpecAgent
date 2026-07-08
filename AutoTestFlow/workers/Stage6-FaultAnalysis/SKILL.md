---
name: autotestflow-stage6-fault-analysis
description: Internal AutoTestFlow Worker for original Stage 6 domain-aware fault analysis and remediation planning.
---

# Stage6-FaultAnalysis

## Boundary

This Worker owns original Stage 6 analysis only: domain-aware root cause
analysis, evidence files, fix solution drafts, and remediation plans. It does
not apply patches or submit external issues.

## Original Inputs

- `TestRun/case_results.json`.
- `TestRun/results/*.json`.
- `TestRun/trace/*.jsonl`.
- `Contract/contract.md`.
- `FeatureAnalysis/s2_code_facts.json`.
- `KnowledgeBase/fault_matches.json` when present.
- Valid remediation configuration.
- `AutoTestFlow/templates/stage6_fault_analyze.md`.
- `AutoTestFlow/templates/stage6_defect_analyze.md`.
- `AutoTestFlow/shared/remediation_rules.md`.
- `AutoTestFlow/shared/fault_analysis_profiles.json`.

## Original Mechanics

- Run `AutoTestFlow/scripts/remediation_plan.py` to select analysis targets and
  patchable contract defects.
- Run one analysis Worker per target using the original templates.
- Run `AutoTestFlow/scripts/remediation_plan.py --finalize` to write manifests.
- Preserve the read-only boundary: Stage 6 writes evidence and plans, not
  external side effects.

## Original Outputs

- `FaultAnalysis/analysis_plan.json`.
- `FaultAnalysis/manifest.json`.
- `FaultAnalysis/targets/<target_id>/*`.
- `Remediation/plan.json`.
- `Remediation/manifest.json`.
- `Remediation/defects/<case_id>/*` for patchable targets.

## Gates

- The existing Stage 6 human confirmation gate remains mandatory for
  `--remediate=on` before Stage 7 applies or submits anything.

## Non-Goals

- Do not apply patches.
- Do not submit issues.
- Do not treat advisory knowledge as stronger than `Contract/contract.md`.
