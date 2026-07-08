---
name: autotestflow-stage5-report
description: Internal AutoTestFlow Worker for Stage 5 target/root reporting and post-report bookkeeping.
---

# Stage5-Report

## Boundary

Owns original Stage 5 report generation, layout normalization, knowledge candidate recording, and final advisory gates.

## Owned Assets

- `templates/stage5_report.md`
- `scripts/record_faults.py`
- `../_common/scripts/output_layout.py`
- `../_common/scripts/professional_acceptance.py`
- `../_common/scripts/knowledge_base.py`

## Inputs

- `TestRun/case_results.json`
- `Contract/contract.md`
- `TestRun/trace/*.jsonl`
- `KnowledgeBase/fault_matches.json` when present
- `QualityGates/*` when present

## Procedure

1. Generate target report with `templates/stage5_report.md`.
2. Run `../_common/scripts/output_layout.py --migrate` when layout normalization is needed.
3. Run `scripts/record_faults.py` when KnowledgeBase is enabled.
4. Run `../_common/scripts/professional_acceptance.py --mode report` when Professional_experience is available.
5. Validate `TestRun/case_results.json` and `Reports/report.md`.
6. If `--remediate=off`, stop after Stage5.
7. If remediation is enabled, validate remediation config before Stage6.
8. Root Supervisor aggregates target reports into root `Reports/report.md`.

## Outputs

- `Reports/report.md`
- `KnowledgeBase/new_knowledge_candidates.json`
- `KnowledgeBase/new_faults_detected.json`
- `KnowledgeBase/project_faults.json`
- Final `QualityGates/*`

## Gates

No new human gate is added.

## Non-Goals

- Do not submit external issues.
- Do not alter execution classifications.
