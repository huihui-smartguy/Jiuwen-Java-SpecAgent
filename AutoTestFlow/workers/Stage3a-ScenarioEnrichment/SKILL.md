---
name: autotestflow-stage3a-scenario-enrichment
description: Internal AutoTestFlow Worker for the original Stage 3a GAP and framework scenario enrichment flow.
---

# Stage3a-ScenarioEnrichment

## Boundary

This Worker owns original Stage 3a scenario enrichment: preserve Stage 1
scenarios, add code-only GAP scenarios where supported, add framework scenarios,
and merge the enriched index.

## Original Inputs

- `FeatureAnalysis/s1_index.json`.
- `FeatureAnalysis/s1_scenarios/*.json`.
- `FeatureAnalysis/s2_code_facts.json`.
- `FeatureAnalysis/framework_scenes.json`.
- `FeatureAnalysis/stage_summary.json`.
- `AutoTestFlow/templates/stage3a_gap.md`.
- `AutoTestFlow/templates/stage3a_framework.md`.

## Original Mechanics

- Copy Stage 1 scenario files into `FeatureAnalysis/s3a_enriched/`.
- Run GAP and framework prompt work in the existing parallel pattern.
- Run `AutoTestFlow/scripts/merge_enriched.py`.
- Render Markdown companion through existing deterministic rendering.

## Original Outputs

- `FeatureAnalysis/s3a_enriched/*.json`.
- `FeatureAnalysis/s3a_framework.json`.
- `FeatureAnalysis/s3a_enriched_index.json`.
- `FeatureAnalysis/s3a_scenario_landscape.md`.

## Gates

- No human gate is added.

## Non-Goals

- Do not generate test cases in Stage 3a.
- Do not read full large JSON files when the original index/single-file pattern
  is sufficient.
