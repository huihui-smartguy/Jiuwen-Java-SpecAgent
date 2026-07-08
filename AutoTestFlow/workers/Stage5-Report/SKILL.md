---
name: autotestflow-stage5-report
description: Internal AutoTestFlow Worker for original Stage 5 target and root reporting.
---

# Stage5-Report

## Boundary

This Worker owns original Stage 5 reporting and post-report deterministic
bookkeeping. It preserves target reports, root aggregation, knowledge candidate
recording, and final advisory gates.

## Original Inputs

- `TestRun/case_results.json`.
- `Contract/contract.md`.
- `TestRun/trace/*.jsonl`.
- `KnowledgeBase/fault_matches.json` when present.
- `QualityGates/*` when present.
- `AutoTestFlow/templates/stage5_report.md`.

## Original Mechanics

- Generate the target report from existing execution artifacts.
- Run `AutoTestFlow/scripts/output_layout.py --migrate` where the original flow
  requires layout normalization.
- Run `AutoTestFlow/scripts/record_faults.py` when KnowledgeBase is available.
- Run `AutoTestFlow/scripts/professional_acceptance.py --mode report` when the
  advisory knowledge source is available.
- Preserve the original decision after Stage 5: stop when remediation is off,
  otherwise validate remediation configuration before Stage 6.

## Original Outputs

- `Reports/report.md`.
- `KnowledgeBase/new_knowledge_candidates.json`.
- `KnowledgeBase/new_faults_detected.json`.
- `KnowledgeBase/project_faults.json`.
- Final `QualityGates/*` artifacts when available.
- Root `Reports/report.md` aggregation across targets.

## Gates

- No new human gate is added in Stage 5.

## Non-Goals

- Do not submit external issues.
- Do not change report sections or classification semantics.
