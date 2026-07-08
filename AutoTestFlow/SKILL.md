---
name: auto-test-flow
description: 需求驱动的测试智能体。面向对外协议可观测的源码型被测系统(SUT)，从需求侧出发，先用运行中的 SUT 校准真实契约，再据真实形态生成可执行黑盒测试。当前以场景化测试实现，DFX 测试并行规划。触发词："/auto-test-flow", "需求测试分析", "需求驱动测试", "自动化测试编排"
---

# AutoTestFlow Supervisor

AutoTestFlow 的公开入口只保留 `/auto-test-flow`。本文件是 Supervisor
调度契约：解析用户命令、选择模式、调度 Worker、验证阶段产物、执行人工门和恢复逻辑。具体阶段步骤、模板、脚本、共享 schema、示例和参考脚手架均由
`AutoTestFlow/workers/` 下的 Worker 直接拥有。

## Default Command

```bash
/auto-test-flow requirements.md --sut-manifest autotestflow.suts.md --remediation-config remediation.config.json --faults on --fault-enrich on --remediate on
```

首次运行可复制 Worker-local starter：

```bash
cp AutoTestFlow/workers/Stage0-SutManifest/examples/quickstart/autotestflow.suts.md .
cp AutoTestFlow/workers/Stage0-SutManifest/examples/quickstart/remediation.config.json .
```

输入校验：

```bash
python AutoTestFlow/workers/Stage0-SutManifest/scripts/sut_manifest.py --sut-manifest autotestflow.suts.md
python AutoTestFlow/workers/_common/reference/remediation_config.py --check remediation.config.json
```

缺少 starter 时指向：

- `AutoTestFlow/workers/Stage0-SutManifest/examples/quickstart/autotestflow.suts.md`
- `AutoTestFlow/workers/Stage0-SutManifest/shared/sut_manifest_schema.md`
- `AutoTestFlow/workers/Stage0-SutManifest/examples/quickstart/remediation.config.json`
- `AutoTestFlow/workers/Stage6-FaultAnalysis/examples/remediation.config.example.json`
- `AutoTestFlow/workers/Stage6-FaultAnalysis/shared/remediation_config_schema.md`

## Modes

| Mode | Trigger | Flow | Output |
|------|---------|------|--------|
| Standard | `--sut-manifest` or legacy SUT/runtime inputs | 0 -> 1 -> per-target 2/2.5 -> 2.6 -> 3a -> 3b -> 4 -> 5 -> optional 6/7 -> root report | calibrated contract, executable black-box tests, reports, optional fault analysis/remediation evidence |
| Requirement-only | no runnable/source SUT input | 1 -> 2R -> 3aR -> 3b | requirement-side test design with `needs-runtime-verify` assertions |

`--sut-base-url` and legacy single-target arguments remain compatibility shims and must normalize into the same manifest flow.

## Supervisor Rules

- Do not add another public command; Workers are internal implementation units.
- Do not introduce StageTask, stage DAG, `supervisor_runtime.py`, or another execution protocol.
- Keep all stage data exchange file-based. Supervisor validates expected files and reads only small metadata/status summaries.
- Never pass large source files, large JSON artifacts, traces, or reports through Supervisor context.
- `Contract/contract.md` is the only strong executable Oracle.
- TestKnowledgeBase and Professional_experience are external knowledge/advisory sources; do not hard-code knowledge into prompts.
- Stage outputs stay in the existing target/root archive layout.
- Root asset folders are not execution paths. Worker-local paths under `AutoTestFlow/workers/` are canonical.

## Parameters

| Parameter | Meaning | Default |
|-----------|---------|---------|
| `requirement_doc` | requirement document path | required |
| `--sut-manifest` | natural-language or legacy SUT manifest | recommended for standard mode |
| `code_path` | legacy single-target source path | optional compatibility |
| `--sut-base-url` | legacy single-target base URL | optional compatibility |
| `--output-dir` | run output directory | `analysis_output/` |
| `--case-batch-size` | case Worker concurrency | `5` |
| `--p0-count` | P0 case count | `3` |
| `--max-fix-attempts` | bounded harness self-fix attempts | `3` |
| `--start-stage` | resume from stage | auto-detect |
| `--knowledge-root` | TestKnowledgeBase root | repository `TestKnowledgeBase` |
| `--knowledge-domain` | knowledge package/domain filter | `all` |
| `--fault-lib` | explicit legacy fault lib for demos/debugging | unset |
| `--fault-overlay` | project overlay | unset |
| `--faults` | knowledge/fault matching mode | `on` |
| `--fault-enrich` | Stage26 LLM enrichment mode | `on` |
| `--professional-gates` | Professional_experience advisory artifacts | `auto` |
| `--remediate` | Stage6/7 mode: `on`, `dry-run`, `off` | `on` |
| `--remediation-config` | remediation config path | `remediation.config.json` |
| `--remediation-max-defects` | max defects in one remediation pass | `5` |
| `--beta-wiki` | optional advisory wiki enrichment | `off` |

## Worker Dispatch Table

| Worker | Original stages | Canonical assets | Required outputs |
|--------|-----------------|------------------|------------------|
| `workers/Stage0-SutManifest/SKILL.md` | 0 | `Stage0-SutManifest/{scripts,shared,examples}` | `RunMetadata/sut_description.parse.json`, `RunMetadata/sut_description.review.md`, `RunMetadata/sut_manifest.normalized.json` |
| `workers/Stage1-RequirementAnalysis/SKILL.md` | 1 | `Stage1-RequirementAnalysis/templates`, `_common/shared`, `_common/scripts` | `FeatureAnalysis/s1_index.json`, `FeatureAnalysis/s1_scenarios/*`, `FeatureAnalysis/requirement_analysis.md`, `FeatureAnalysis/s1_scenario_examples.md` |
| `workers/Stage2-CodeAnalysisContract/SKILL.md` | 2 + 2.5 | `Stage2-CodeAnalysisContract/{templates,scripts,shared}` | `FeatureAnalysis/code_scan_plan.json`, `FeatureAnalysis/s2_code_facts.json`, `FeatureAnalysis/stage_summary.json`, `FeatureAnalysis/framework_scenes.json`, `Contract/contract_samples.json`, `Contract/contract.md` |
| `workers/Stage26-KnowledgeMatch/SKILL.md` | 2.6 + 2.6b + 2.P | `Stage26-KnowledgeMatch/{templates,scripts,shared,examples}`, `_common/scripts` | `KnowledgeBase/knowledge_matches.json`, `KnowledgeBase/fault_matches.json`, `KnowledgeBase/fault_contract_alignment.md`, `QualityGates/*` |
| `workers/Stage3a-ScenarioEnrichment/SKILL.md` | 2R + 3a + 3aR | `Stage3a-ScenarioEnrichment/{templates,scripts}`, `_common/shared`, `_common/scripts` | `FeatureAnalysis/s3a_enriched/*`, `FeatureAnalysis/s3a_framework.json`, `FeatureAnalysis/s3a_enriched_index.json`, `FeatureAnalysis/s3a_scenario_landscape.md` |
| `workers/Stage3b-TestDesign/SKILL.md` | 3b | `Stage3b-TestDesign/{templates,scripts}`, `_common/shared`, `_common/scripts` | `TestCases/test_design.json`, `TestCases/test_examples.md`, `TestCases/scene_tc_mapping.json` |
| `workers/Stage4-TestGenerationRun/SKILL.md` | 4 | `Stage4-TestGenerationRun/{templates,scripts,reference,examples}`, `_common/scripts` | `TestCases/p0_selection.json`, `TestRun/tests/*`, `TestRun/results/*`, `TestRun/trace/*`, `TestRun/case_results.json` |
| `workers/Stage5-Report/SKILL.md` | 5 | `Stage5-Report/{templates,scripts}`, `_common/scripts` | `Reports/report.md`, knowledge candidates, final `QualityGates/*` |
| `workers/Stage6-FaultAnalysis/SKILL.md` | 6 | `Stage6-FaultAnalysis/{templates,scripts,shared,examples}`, `_common/reference`, `_common/scripts` | `FaultAnalysis/analysis_plan.json`, `FaultAnalysis/manifest.json`, `FaultAnalysis/targets/*`, `Remediation/plan.json`, `Remediation/manifest.json` |
| `workers/Stage7-ReverifyIssue/SKILL.md` | 7 | `Stage7-ReverifyIssue/{scripts,examples}`, `_common/reference`, `_common/scripts` | `Remediation/reverify.json`, `Remediation/issue_bodies/*`, `Remediation/submitted.json` |

## Human Gates

| Gate | Condition | Decision |
|------|-----------|----------|
| Stage0 manifest review | low confidence, missing target data, unsafe command-bearing config | user confirms or edits manifest |
| Stage1 requirement analysis | always after Stage1 | user confirms FP split, scenario boundaries, coverage |
| Stage3b test design | always after merge | user confirms FP mapping and assertion reasonableness |
| Stage4 P0 | after P0 generation/execution | user confirms P0 quality and classification |
| Stage4 batch | after aggregation | user confirms batch result classifications |
| Stage6/7 external effect | `--remediate=on` with actionable targets | user confirms apply/reverify/evidence issue scope |

No external issue may be submitted unless the human gate passes and `switches.allow_open_issue=true`.

## Execution Classifications

Stage4 and downstream reports must preserve these categories:

- `pass`
- `harness_defect`
- `sut_unsatisfied`
- `sdk_defect`
- `env_issue`
- `requires_human_review`

Do not weaken assertions or remove fault oracles to force a pass.

## Output Layout

Standard mode preserves the existing archive layout:

```text
RunMetadata/
targets/<target_id>/
├── FeatureAnalysis/
├── Contract/
├── KnowledgeBase/
├── QualityGates/
├── TestCases/
├── TestRun/
├── Reports/
├── FaultAnalysis/
└── Remediation/
Reports/report.md
```

The canonical per-file list is maintained by `workers/_common/scripts/output_layout.py` and the relevant Worker manuals.

## Validation Checklist

Before reporting success:

- `python3 -m unittest discover AutoTestFlow/tests` passes.
- No execution reference points to removed root asset folders.
- No forbidden runtime concepts are introduced: `stage_registry.json`, `stage_task_schema.md`, `supervisor_runtime.py`, `stage_dag`, or new task-file protocol.
- Root `AutoTestFlow/SKILL.md` stays Supervisor-only; stage details live in Worker `SKILL.md` files.
- `Contract/contract.md` remains the strong Oracle for executable assertions.
