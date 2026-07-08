---
name: autotestflow-stage4-test-generation-run
description: Internal AutoTestFlow Worker for original Stage 4 P0 verification, test generation, execution, tracing, and aggregation.
---

# Stage4-TestGenerationRun

## Boundary

This Worker owns original Stage 4 black-box test generation and execution. It
keeps P0 verification, batch generation, trace capture, result classification,
and aggregation unchanged.

## Original Inputs

- `TestCases/test_design.json`.
- `FeatureAnalysis/stage_summary.json`.
- `Contract/contract.md`.
- `TestCases/scene_tc_mapping.json`.
- Target runtime readiness information.
- `AutoTestFlow/reference/http_client.py`.
- `AutoTestFlow/reference/conftest.py`.
- `AutoTestFlow/templates/stage4a_p0_verify.md`.
- `AutoTestFlow/templates/stage4b_batch_gen.md`.

## Original Mechanics

- Run `AutoTestFlow/scripts/sut_runtime.py` for the target readiness gate.
- Run `AutoTestFlow/scripts/select_p0.py`.
- Generate and execute P0 tests first.
- Generate remaining cases through the original sliding-window batch pattern.
- Run `AutoTestFlow/scripts/evaluate_fault_oracles.py` for `fault_ref` cases.
- Run `AutoTestFlow/scripts/aggregate_results.py`.
- Preserve the existing execution boundary classifications:
  `harness_defect`, `sut_unsatisfied`, `sdk_defect`, `env_issue`,
  `requires_human_review`, and `pass`.

## Original Outputs

- `TestCases/p0_selection.json`.
- `TestRun/validate_test.py`.
- `TestRun/tests/test_<case_id>.py`.
- `TestRun/results/<case_id>.json`.
- `TestRun/trace/<case_id>.jsonl`.
- `TestRun/case_results.json`.

## Gates

- Existing P0 quality confirmation and batch result confirmation remain.
- Managed runtime commands still require the original safety confirmation.

## Non-Goals

- Do not bypass the public SUT protocol.
- Do not weaken or delete assertions to make tests pass.
