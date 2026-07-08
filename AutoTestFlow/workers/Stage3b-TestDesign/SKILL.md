---
name: autotestflow-stage3b-test-design
description: Internal AutoTestFlow Worker for Stage 3b batch test design and merge.
---

# Stage3b-TestDesign

## Boundary

Owns original Stage 3b small-file test design. It converts enriched scenarios into canonical `TestCases` artifacts.

## Owned Assets

- `templates/stage3b_batch_design.md`
- `scripts/merge_test_design.py`
- `../_common/shared/rules.md`
- `../_common/shared/scenario_schema.md`
- `../_common/scripts/render_design_markdown.py`

## Inputs

- `FeatureAnalysis/s3a_enriched_index.json`
- `FeatureAnalysis/s3a_enriched/*.json`
- `FeatureAnalysis/s3a_framework.json`
- `Contract/contract.md`
- `KnowledgeBase/fault_matches.json` when present
- `QualityGates/professional_case_guidance.json` when present

## Procedure

1. Supervisor reads only indexes and calculates batches by scenario id.
2. Each batch Worker reads only assigned scenario files, `Contract/contract.md`, and bounded guidance artifacts.
3. The template creates `TestCases/test_design_batch_*.json`.
4. Run `scripts/merge_test_design.py --output-dir <target_output_dir>`.
5. Validate `TestCases/test_design.json`, `TestCases/test_examples.md`, and `TestCases/scene_tc_mapping.json`.
6. Preserve `fault_ref`, `fault_oracles`, `acceptance_refs`, and `oracle_refs`.
7. In requirement-only mode, stop after the human gate.

## Outputs

- `TestCases/test_design_batch_*.json`
- `TestCases/test_design.json`
- `TestCases/test_examples.md`
- `TestCases/scene_tc_mapping.json`
- Optional `TestCases/e2e_scenes.json`

## Gates

Mandatory human gate after merge. Knowledge can reduce only the abnormal/boundary coverage review dimension; FP mapping and assertion reasonableness still require user confirmation.

## Non-Goals

- Do not create pytest code.
- Do not assert anything not backed by `Contract/contract.md`.
