---
name: autotestflow-stage0-sut-manifest
description: Internal AutoTestFlow Worker for the original Stage 0 SUT manifest parsing and normalization flow.
---

# Stage0-SutManifest

## Boundary

This Worker owns the original Stage 0 behavior only: parse the single
`/auto-test-flow ...` invocation, normalize the SUT description, validate the
manifest, and prepare target-local paths. It is not a separate public command.

## Original Inputs

- The original AutoTestFlow invocation and flags.
- `requirements.md` path as provided to the Supervisor.
- `--sut-manifest` natural-language SUT description, or legacy single-target
  compatibility inputs.
- Optional `--remediation-config` and target-level remediation config paths.
- `AutoTestFlow/shared/sut_manifest_schema.md`.

## Original Mechanics

- Use `AutoTestFlow/scripts/sut_manifest.py` for deterministic validation and
  normalization.
- Preserve legacy Markdown/YAML manifest compatibility.
- For direct/predeployed targets without source, preserve
  `source.available=false` behavior.
- If the existing Stage 0 logic resolves a supported remote source URL to a
  local cache, preserve that behavior and its review notes.

## Original Outputs

- `RunMetadata/sut_description.parse.json`.
- `RunMetadata/sut_description.review.md`.
- `RunMetadata/sut_manifest.normalized.json`.
- `targets/<target_id>/` output roots and target-local path metadata.

## Gates

- Human confirmation remains required when Stage 0 reports low-confidence,
  missing, unsafe, or command-bearing SUT information.

## Non-Goals

- Do not add StageTask, stage DAG, or a new runtime helper.
- Do not change public invocation flags or output paths.
