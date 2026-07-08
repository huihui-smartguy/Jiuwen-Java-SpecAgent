---
name: autotestflow-stage7-reverify-issue
description: Internal AutoTestFlow Worker for Stage 7 apply, rebuild, reverify, and gated evidence issue generation.
---

# Stage7-ReverifyIssue

## Boundary

Owns original Stage 7 after Stage6 approval. It may apply approved patches, rebuild, reverify, generate issue bodies, and submit evidence issues only when gates allow.

## Owned Assets

- `scripts/apply_and_reverify.py`
- `scripts/submit_remediation.py`
- `examples/a2a/remediation_demo/`
- `../_common/reference/remediation_config.py`
- `../_common/scripts/output_layout.py`

## Inputs

- `Remediation/plan.json`
- `Remediation/manifest.json`
- `Remediation/defects/<case_id>/*`
- Valid remediation configuration
- Target repo/build/runtime configuration

## Procedure

1. Confirm Stage6 human gate and remediation config permissions.
2. Run `scripts/apply_and_reverify.py --output-dir <target_output_dir>`.
3. Apply only approved patch artifacts within configured path allowlists.
4. Rebuild, restart/readiness-check, rerun affected tests, and write reverify evidence.
5. Generate evidence issue bodies under `Remediation/issue_bodies/`.
6. Run `scripts/submit_remediation.py` in `dry-run` or gated `on` mode.
7. Submit external issues only when `--remediate=on`, `--gate-confirmed`, and `switches.allow_open_issue=true`.

## Outputs

- `Remediation/reverify.json`
- `Remediation/issue_bodies/*.md`
- `Remediation/submitted.json`

## Gates

No irreversible action may occur without the original human confirmation and config permission.

## Non-Goals

- Do not open PRs.
- Do not submit issues when `allow_open_issue=false`.
- Do not create a new external action protocol.
