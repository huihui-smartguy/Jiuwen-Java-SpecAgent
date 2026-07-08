---
name: autotestflow-stage1-requirement-analysis
description: Internal AutoTestFlow Worker for Stage 1 requirement-side FP/FS analysis.
---

# Stage1-RequirementAnalysis

## Boundary

Owns requirement-side feature and scenario analysis. It does not read source
code or runtime artifacts.

## Owned Assets

- `templates/stage1_req_analyze.md`
- `../_common/shared/scenario_schema.md`
- `../_common/scripts/render_design_markdown.py`

## Inputs

- `requirements.md`
- Optional fault context when the original invocation enables it
- `../_common/shared/scenario_schema.md`

## Procedure

1. Read the requirement document and extract user-observable function points.
2. Model one user operation chain as one scenario; keep variants and abnormal branches inside the same scenario where appropriate.
3. Produce flow/framework/quality scenario candidates.
4. Extract request/response or event-stream examples into `FeatureAnalysis/skeleton/` only when the requirement document shows them.
5. Write one scenario file per scenario plus a lightweight index.
6. Run `../_common/scripts/render_design_markdown.py --stage s1` to render the Markdown companion.
7. Return only a short status summary to Supervisor.

## Outputs

- `FeatureAnalysis/s1_index.json`
- `FeatureAnalysis/s1_scenarios/*.json`
- `FeatureAnalysis/requirement_analysis.md`
- `FeatureAnalysis/s1_scenario_examples.md`

## Gates

Mandatory human gate after Stage 1. The user confirms FP split, scenario boundaries, and coverage before downstream stages proceed.

## Non-Goals

- Do not read source-code facts.
- Do not create test cases.
- Do not weaken the Stage 1 human gate.
