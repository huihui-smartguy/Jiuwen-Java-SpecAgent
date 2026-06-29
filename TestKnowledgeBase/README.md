# TestKnowledgeBase

`TestKnowledgeBase` is the forward knowledge source for AutoTestFlow.

It replaces `Specification_Repository` for subsequent product iterations. The old repository may remain as a legacy compatibility source, but new fault patterns, professional acceptance criteria, generated wiki material, project overlays, and promotion work should land here.

## Structure

| Path | Role |
|---|---|
| `Fault/` | Fault-driven testing knowledge for REST/API, Web, Agent, and DFX. |
| `Professional_experience/` | Advisory testing strategy, release gates, AI evaluation readiness, and report quality standards. |
| `manifest.json` | Machine-readable ownership and replacement policy. |
| `TRANSFORMATION_SCOPE.md` | Migration scope and runtime rules. |

## AutoTestFlow Integration

AutoTestFlow now prefers:

```text
TestKnowledgeBase/Fault/rest_api_faults.json
```

when `--fault-lib` is omitted. `Specification_Repository/rest_api_common_faults.json` is kept only as a legacy fallback.

## Validation

Run:

```bash
python AutoTestFlow/scripts/validate_knowledge_base.py
```

The validator checks JSON parseability, fault ID uniqueness, required fault fields, and `Professional_experience` source references.
