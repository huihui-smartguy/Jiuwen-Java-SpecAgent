---
name: autotestflow-stage26-knowledge-match
description: Internal AutoTestFlow Worker for Stage 2.6 TestKnowledgeBase matching, enrichment, and professional advisory gates.
---

# Stage26-KnowledgeMatch

## Boundary

Owns original Stage 2.6, optional Stage 2.6b enrichment, and Professional_experience advisory artifacts. Knowledge can guide coverage but cannot exceed `Contract/contract.md`.

## Owned Assets

- `scripts/match_faults.py`
- `scripts/validate_knowledge_base.py`
- `scripts/gen_wiki.py`
- `scripts/check_wiki.py`
- `templates/stage2_6_fault_match.md`
- `templates/stage2_6_fault_match.beta.md`
- `shared/wiki_rules.md`
- `shared/wiki_schema.md`
- `examples/a2a/fault_demo/`
- `examples/a2a/wiki_demo/`
- `../_common/scripts/knowledge_base.py`
- `../_common/scripts/professional_acceptance.py`

## Inputs

- `Contract/contract.md`
- `FeatureAnalysis/s1_index.json`
- `FeatureAnalysis/s1_scenarios/*.json`
- `FeatureAnalysis/s2_code_facts.json`
- TestKnowledgeBase registry/packages
- Optional overlay, explicit legacy fault library, and beta wiki flag

## Procedure

1. If `--faults=off`, skip without producing matching artifacts.
2. Run `scripts/match_faults.py` with the selected knowledge root/domain/overlay.
3. Match packages by registry metadata, domain, category, scenario tags, history, related fields, and streaming signals.
4. Cap every fault oracle by `Contract/contract.md` authority.
5. Write `KnowledgeBase/knowledge_matches.json`, `KnowledgeBase/fault_matches.json`, and `KnowledgeBase/fault_contract_alignment.md`.
6. If enrichment is enabled and needed, run the stable or beta enrichment template to bind fuzzy validation points, replace placeholders, and record contract conflicts.
7. Run `../_common/scripts/professional_acceptance.py` when Professional_experience is available and advisory gates are enabled.

## Outputs

- `KnowledgeBase/knowledge_matches.json`
- `KnowledgeBase/fault_matches.json`
- `KnowledgeBase/fault_contract_alignment.md`
- `QualityGates/professional_acceptance.seed.json`
- `QualityGates/professional_acceptance.code_gaps.json`
- `QualityGates/professional_case_guidance.json`
- `QualityGates/professional_acceptance.json`
- `QualityGates/ai_eval_readiness.json`

## Gates

No human gate is added. Missing knowledge behavior follows the original `--faults` mode.

## Non-Goals

- Do not hard-code knowledge into prompts.
- Do not turn advisory knowledge into a strong Oracle.
- Do not let beta wiki content feed deterministic matchers.
