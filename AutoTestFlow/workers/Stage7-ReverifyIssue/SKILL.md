---
name: autotestflow-stage7-reverify-issue
description: Internal AutoTestFlow Worker for original Stage 7 apply, rebuild, reverify, and gated evidence issue generation.
---

# Stage7-ReverifyIssue

## Boundary

This Worker owns original Stage 7 actions after Stage 6 approval: apply allowed
patches, rebuild, reverify, produce issue bodies, and submit evidence issues
only when existing human and config gates allow it.

## Original Inputs

- `Remediation/plan.json`.
- `Remediation/manifest.json`.
- `Remediation/defects/<case_id>/*`.
- Valid remediation configuration.
- Target runtime/build configuration.
- `AutoTestFlow/scripts/apply_and_reverify.py`.
- `AutoTestFlow/scripts/submit_remediation.py`.

## Original Mechanics

- Apply only approved local remediation artifacts.
- Rebuild and reverify through the existing script.
- Generate issue bodies from evidence artifacts.
- Submit external evidence issues only when both the human gate and
  `switches.allow_open_issue=true` allow submission.
- Preserve dry-run behavior: analyze and reverify without external submission.

## Original Outputs

- `Remediation/reverify.json`.
- `Remediation/issue_bodies/*.md`.
- `Remediation/submitted.json`.

## Gates

- No irreversible action may occur without the original Stage 6 human approval
  and configuration permission.

## Non-Goals

- Do not open PRs.
- Do not submit issues when `allow_open_issue=false`.
- Do not create a new external action protocol.
