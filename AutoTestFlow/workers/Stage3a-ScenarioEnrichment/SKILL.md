---
name: autotestflow-stage3a-scenario-enrichment
description: Internal AutoTestFlow Worker for requirement-only summaries and Stage 3a scenario enrichment.
---

# Stage3a-ScenarioEnrichment

## Boundary

Owns original Stage 2R, Stage 3a, and Stage 3aR prompt/script assets. In standard mode it enriches scenarios after contract/code facts exist. In requirement-only mode it produces design-only framework scenes.

## Owned Assets

- `templates/stage2R_req_summary.md`
- `templates/stage3aR_framework.md`
- `templates/stage3a_gap.md`
- `templates/stage3a_framework.md`
- `scripts/merge_enriched.py`
- `../_common/shared/scenario_schema.md`
- `../_common/scripts/render_design_markdown.py`

## Inputs

- `FeatureAnalysis/s1_index.json`
- `FeatureAnalysis/s1_scenarios/*.json`
- `FeatureAnalysis/s2_code_facts.json` when source is available
- `FeatureAnalysis/framework_scenes.json`
- `FeatureAnalysis/stage_summary.json`

## Procedure

1. Standard mode: copy Stage 1 scenario files into `FeatureAnalysis/s3a_enriched/`.
2. Run GAP enrichment against `s2_code_facts.json` to produce code-only scenarios.
3. Run framework enrichment against `framework_scenes.json` and `stage_summary.json`.
4. Run `scripts/merge_enriched.py --output-dir <target_output_dir>`.
5. Validate `FeatureAnalysis/s3a_enriched_index.json` and `FeatureAnalysis/s3a_scenario_landscape.md`.
6. Requirement-only mode: run Stage 2R summary and Stage 3aR framework design, then terminate after Stage3b.

## Outputs

- `FeatureAnalysis/stage_summary.json` for requirement-only mode
- `FeatureAnalysis/s3a_enriched/*.json`
- `FeatureAnalysis/s3a_framework.json`
- `FeatureAnalysis/s3a_enriched_index.json`
- `FeatureAnalysis/s3a_scenario_landscape.md`
- `TestCases/e2e_scenes.json` and `TestCases/e2e_scenes.md` in requirement-only mode

## Gates

No human gate is added in Stage3a.

## Non-Goals

- Do not create executable test cases.
- Do not read full large JSON files when index/single-scene files are enough.
