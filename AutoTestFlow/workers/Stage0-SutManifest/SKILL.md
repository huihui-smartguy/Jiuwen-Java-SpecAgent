---
name: autotestflow-stage0-sut-manifest
description: Internal AutoTestFlow Worker for Stage 0 SUT description parsing, manifest validation, and target normalization.
---

# Stage0-SutManifest

## Boundary

Owns the original Stage 0 flow only. It turns the single `/auto-test-flow`
invocation plus SUT description into canonical run metadata and target output
roots. It is not a public command.

## Owned Assets

- `scripts/sut_manifest.py`
- `shared/sut_manifest_schema.md`
- `examples/quickstart/autotestflow.suts.md`
- `examples/quickstart/remediation.config.json`
- `examples/multi_sut/sut-manifest.md`

## Inputs

- Original `/auto-test-flow` invocation and flags.
- `requirements.md` path.
- `--sut-manifest` natural-language SUT description or legacy manifest input.
- Optional legacy single-target source/runtime inputs.
- Optional remediation config path.

## Procedure

1. Parse the SUT description or legacy manifest into a candidate manifest.
2. Validate target ids, source/runtime sections, readiness probes, command-bearing fields, redacted values, and remediation config references.
3. Normalize legacy single-target inputs into `target_id=default`.
4. For direct/predeployed targets without source, preserve `source.available=false` and allow downstream contract probing.
5. For supported remote GitHub source URLs, keep existing best-effort local cache resolution behavior and record review reasons on failure.
6. Write target-local artifact path metadata under `targets/<target_id>/`.
7. Require human review when fields are missing, low-confidence, redacted, unsafe, or command-bearing.

## Outputs

- `RunMetadata/sut_description.parse.json`
- `RunMetadata/sut_description.review.md`
- `RunMetadata/sut_manifest.normalized.json`
- `targets/<target_id>/` output roots

## Gates

Human confirmation is required when Stage 0 review marks the manifest as requiring review.

## Non-Goals

- Do not change the public invocation.
- Do not add StageTask, stage DAG, or a new execution protocol.
- Do not create executable assertions.
