---
name: autotestflow-stage4-test-generation-run
description: Internal AutoTestFlow Worker for Stage 4 P0 verification, black-box test generation, execution, trace capture, and result aggregation.
---

# Stage4-TestGenerationRun

## Boundary

Owns original Stage 4. It generates and runs Python pytest/httpx black-box tests through public SUT protocols only.

## Owned Assets

- `templates/stage4a_p0_verify.md`
- `templates/stage4b_batch_gen.md`
- `scripts/sut_runtime.py`
- `scripts/select_p0.py`
- `scripts/evaluate_fault_oracles.py`
- `scripts/aggregate_results.py`
- `reference/http_client.py`
- `reference/conftest.py`
- `reference/client_reference.md`
- `examples/a2a/`
- `../_common/scripts/output_layout.py`

## Inputs

- `TestCases/test_design.json`
- `TestCases/scene_tc_mapping.json`
- `FeatureAnalysis/stage_summary.json`
- `Contract/contract.md`
- Target runtime readiness data
- Optional `KnowledgeBase/fault_matches.json`

## Procedure

1. Run `scripts/sut_runtime.py` for readiness. If not reachable, mark cases `env_issue` and preserve generated artifacts.
2. Run `scripts/select_p0.py` to produce P0 selection and validator.
3. Generate and execute P0 tests with `templates/stage4a_p0_verify.md`.
4. Copy `reference/http_client.py` and `reference/conftest.py` into `TestRun/`.
5. For `fault_ref` cases, run `scripts/evaluate_fault_oracles.py` after pytest passes.
6. Ask the user to confirm P0 quality.
7. Generate remaining cases using `templates/stage4b_batch_gen.md` with sliding-window concurrency.
8. Run `scripts/aggregate_results.py`.
9. Ask the user to confirm aggregate classifications.

## Outputs

- `TestCases/p0_selection.json`
- `TestRun/validate_test.py`
- `TestRun/tests/test_<case_id>.py`
- `TestRun/results/<case_id>.json`
- `TestRun/trace/<case_id>.jsonl`
- `TestRun/case_results.json`

## Gates

P0 quality and batch result confirmation remain. Managed runtime commands still require the original safety confirmation.

## Non-Goals

- Do not call SUT internals.
- Do not remove or weaken assertions to pass.
- Do not treat final HTTP success as enough for `fault_ref` cases; required fault oracles must also pass.
