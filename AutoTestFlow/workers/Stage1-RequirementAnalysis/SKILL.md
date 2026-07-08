---
name: autotestflow-stage1-requirement-analysis
description: Internal AutoTestFlow Worker for the original Stage 1 requirement-side FP/FS analysis.
---

# Stage1-RequirementAnalysis

## Boundary

This Worker owns original Stage 1 requirement-side scenario analysis. It reads
the requirement document through the existing Stage 1 template and produces the
same feature-analysis artifacts used by downstream stages.

## Original Inputs

- `requirements.md`.
- `AutoTestFlow/templates/stage1_req_analyze.md`.
- `AutoTestFlow/shared/scenario_schema.md`.
- Optional fault library context when the original invocation enables it.

## Original Mechanics

- Extract user-observable function points and flow/framework/quality scenario
  candidates.
- Keep one user operation chain as one scenario.
- Produce JSON as the authoritative stage artifact.
- Use `AutoTestFlow/scripts/render_design_markdown.py` only to render Markdown
  companions from JSON for review.

## Original Outputs

- `FeatureAnalysis/s1_index.json`.
- `FeatureAnalysis/s1_scenarios/*.json`.
- `FeatureAnalysis/requirement_analysis.md`.
- `FeatureAnalysis/s1_scenario_examples.md`.

## Gates

- Stage 1 human confirmation remains mandatory for FP decomposition, scenario
  boundaries, and coverage.

## Non-Goals

- Do not read source-code artifacts.
- Do not change Stage 1 schema, gate semantics, or output paths.
