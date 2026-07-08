---
name: autotestflow-stage26-knowledge-match
description: Internal AutoTestFlow Worker for original Stage 2.6 TestKnowledgeBase matching, optional enrichment, and advisory professional gates.
---

# Stage26-KnowledgeMatch

## Boundary

This Worker owns the original Stage 2.6 knowledge/fault matching flow, optional
Stage 2.6b enrichment, and the existing Professional_experience advisory sidecar
when enabled.

## Original Inputs

- `Contract/contract.md`.
- `FeatureAnalysis/s1_index.json`.
- `FeatureAnalysis/s1_scenarios/*.json`.
- `FeatureAnalysis/s2_code_facts.json`.
- `TestKnowledgeBase/registry.json` and discovered knowledge packages.
- Optional fault overlay or explicit legacy fault library.
- `AutoTestFlow/templates/stage2_6_fault_match.md` when enrichment is enabled.

## Original Mechanics

- Run `AutoTestFlow/scripts/match_faults.py`.
- Apply contract authority capping: knowledge can guide coverage but cannot
  exceed `contract.md`.
- When `--fault-enrich on` and enrichment is needed, use the original enrichment
  template to bind fuzzy validation points, replace placeholders, and record
  contract conflicts.
- Run `AutoTestFlow/scripts/professional_acceptance.py` as advisory only when
  the existing option and knowledge source allow it.

## Original Outputs

- `KnowledgeBase/knowledge_matches.json`.
- `KnowledgeBase/fault_matches.json`.
- `KnowledgeBase/fault_contract_alignment.md`.
- `QualityGates/professional_acceptance.seed.json`.
- `QualityGates/professional_acceptance.code_gaps.json`.
- `QualityGates/professional_case_guidance.json`.
- `QualityGates/professional_acceptance.json`.
- `QualityGates/ai_eval_readiness.json`.

## Gates

- No human gate is added.
- Missing knowledge behavior follows the existing `--faults` mode.

## Non-Goals

- Do not hard-code knowledge into prompts.
- Do not turn Professional_experience advisory output into strong oracle output.
