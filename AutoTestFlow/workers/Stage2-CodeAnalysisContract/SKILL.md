---
name: autotestflow-stage2-code-analysis-contract
description: Internal AutoTestFlow Worker that groups original Stage 2 code analysis and Stage 2.5 contract calibration with parity behavior.
---

# Stage2-CodeAnalysisContract

## Boundary

This Worker groups the original Stage 2 and Stage 2.5 responsibilities. It
does not collapse their internal order: code scan planning and code facts are
produced first, then contract calibration generates `Contract/contract.md`.

## Original Inputs

- Target-local source information from `RunMetadata/sut_manifest.normalized.json`.
- `AutoTestFlow/templates/stage2_code_scan.md`.
- `AutoTestFlow/templates/stage2_5_contract_calibrate.md`.
- `AutoTestFlow/shared/code_scan_profiles.json`.
- `AutoTestFlow/shared/code_scan_guide.md`.
- `AutoTestFlow/shared/java_scan_guide.md`.
- `AutoTestFlow/shared/code_analysis_template.md`.
- Target runtime/base URL and optional probe plan.

## Original Mechanics

- Run `AutoTestFlow/scripts/prepare_code_scan.py` to create the profile scan
  plan.
- Execute the original Stage 2 code scan prompt against bounded source facts.
- Preserve no-source behavior: write no-source placeholders and continue to
  contract calibration where the target is reachable.
- Run `AutoTestFlow/scripts/probe_contract.py` for live/static contract samples.
- Execute `templates/stage2_5_contract_calibrate.md` to produce the target-local
  strong oracle.
- Treat `Contract/contract.md` as the only strong executable oracle.

## Original Outputs

- `FeatureAnalysis/code_scan_plan.json`.
- `FeatureAnalysis/s2_code_facts.json`.
- `FeatureAnalysis/stage_summary.json`.
- `FeatureAnalysis/framework_scenes.json`.
- `Contract/contract_samples.json`.
- `Contract/contract.md`.

## Gates

- No human gate is added here.
- Target reachability still controls later Stage 4 readiness behavior.

## Non-Goals

- Do not invent additional contract formats.
- Do not change the Stage 2 or Stage 2.5 artifact names.
- Do not pass large source files through Supervisor context.
