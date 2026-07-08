---
name: autotestflow-stage2-code-analysis-contract
description: Internal AutoTestFlow Worker that owns original Stage 2 code analysis and Stage 2.5 contract calibration.
---

# Stage2-CodeAnalysisContract

## Boundary

Owns original Stage 2 plus Stage 2.5. The merge is an ownership merge only:
code analysis still happens first, then contract calibration immediately
generates `Contract/contract.md`.

## Owned Assets

- `scripts/prepare_code_scan.py`
- `scripts/probe_contract.py`
- `templates/stage2_code_scan.md`
- `templates/stage2_5_contract_calibrate.md`
- `shared/code_scan_profiles.json`
- `shared/code_scan_guide.md`
- `shared/java_scan_guide.md`
- `shared/code_analysis_template.md`
- `../_common/shared/scenario_schema.md`

## Inputs

- Target source/runtime info from `RunMetadata/sut_manifest.normalized.json`
- Target source tree when available
- Target base URL and optional probe plan
- Stage 1 artifacts when contract calibration needs scenario context

## Procedure

1. Read normalized manifest target source/runtime metadata.
2. If source is unavailable or explicitly skipped, write the original no-source placeholders and continue to contract calibration when the target is reachable.
3. Run `scripts/prepare_code_scan.py --code-path <source> --output-dir <target_output_dir>`.
4. Use `templates/stage2_code_scan.md` to extract bounded static code facts, entry catalogs, module roles, code-only gaps, and framework scenes.
5. Validate `FeatureAnalysis/code_scan_plan.json`, `FeatureAnalysis/s2_code_facts.json`, `FeatureAnalysis/stage_summary.json`, and `FeatureAnalysis/framework_scenes.json`.
6. Run `scripts/probe_contract.py` to produce `Contract/contract_samples.json`.
7. Use `templates/stage2_5_contract_calibrate.md` to produce `Contract/contract.md`.
8. Mark unreachable targets as `needs-runtime-verify` through the original contract fallback; Stage4 readiness later determines `env_issue`.

## Outputs

- `FeatureAnalysis/code_scan_plan.json`
- `FeatureAnalysis/s2_code_facts.json`
- `FeatureAnalysis/stage_summary.json`
- `FeatureAnalysis/framework_scenes.json`
- `Contract/contract_samples.json`
- `Contract/contract.md`

## Gates

No new human gate is added. `Contract/contract.md` must exist before Stage26, Stage3b, or Stage4 can create executable assertions.

## Non-Goals

- Do not invent a second contract format.
- Do not let source inference override live contract evidence.
- Do not pass large source files through Supervisor context.
