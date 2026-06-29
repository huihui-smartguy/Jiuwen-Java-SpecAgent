# TestKnowledgeBase Transformation Scope

## 1. Product Direction

`TestKnowledgeBase` is the forward source of truth for AutoTestFlow knowledge iteration.

`Specification_Repository` is being replaced by `TestKnowledgeBase` and will not play a practical role in subsequent iterations. It may remain in the repository temporarily for historical demos, old documentation links, and explicit legacy invocations, but new product work must not depend on it.

## 2. Scope

| Area | Future Owner | Rule |
|---|---|---|
| Runtime package registry | `TestKnowledgeBase/registry.json` | AutoTestFlow discovery source for all knowledge/fault packages. |
| REST/API fault patterns | `TestKnowledgeBase/Fault/rest_api_faults.json` | REST/API package registered in the runtime registry. |
| Web, Agent, and DFX fault patterns | `TestKnowledgeBase/Fault/*.json` | Expanded by domain through the registry without changing AutoTestFlow code. |
| Project overlays and self-accumulated history | `TestKnowledgeBase/Fault/project_faults.json` or project-local overlay | Promote into TestKnowledgeBase after review. |
| Professional acceptance and AI readiness | `TestKnowledgeBase/Professional_experience/` | Advisory gates and report quality standards only. |
| Legacy fault repository | `Specification_Repository/` | Compatibility fallback only; not a future iteration target. |

## 3. Runtime Rules

1. AutoTestFlow must prefer `TestKnowledgeBase/registry.json` when no explicit knowledge path is supplied.
2. A fallback to `Specification_Repository/rest_api_common_faults.json` is not part of normal runtime. Old demos may pass that file explicitly with `--fault-lib`.
3. New knowledge entries, overlays, promotions, and validation work must target `TestKnowledgeBase`.
4. `Professional_experience` can add gates, warnings, and report matrices, but must not create L2 assertions without `contract.md`.
5. `Specification_Repository/wiki/` is a legacy beta artifact. New generated wiki material should be derived from `TestKnowledgeBase/Fault/*.json`.

## 4. Validation Gates

Before promoting TestKnowledgeBase changes, run:

```bash
python AutoTestFlow/scripts/validate_knowledge_base.py
```

For AutoTestFlow fault matching smoke checks, use:

```bash
python AutoTestFlow/scripts/match_faults.py \
  --output-dir <output_dir> \
  --knowledge-root TestKnowledgeBase
```
