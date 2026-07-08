# AutoTestFlow Supervisor-Workers Stage-Skill Refactoring Technical Architecture

# AutoTestFlow 总控-阶段 Worker 技术架构方案

## 1. Executive Summary / 总览

**中文**

本方案将 AutoTestFlow 重构为“总控 Supervisor + 阶段 Worker”的工程组织形态，但短期内不改变任何运行能力、公开命令、阶段顺序、人工门或结构化输出。唯一公开入口仍然是：

```bash
/auto-test-flow requirements.md --sut-manifest autotestflow.suts.md --remediation-config remediation.config.json --faults on --fault-enrich on --remediate on
```

短期重构只做阶段职责拆分：`AutoTestFlow/SKILL.md` 保持 Supervisor 编排入口，`AutoTestFlow/workers/*/SKILL.md` 记录每个阶段 Worker 的原职责、原输入、原输出、原模板/脚本依赖和原人工门，便于不同工程师按阶段维护。不得新增 StageTask、stage DAG、runtime helper 或新执行协议。

按用户要求，原 stage2 与 stage2.5 合并为一个工程 Worker：`Stage2-CodeAnalysisContract`。内部顺序严格保持原功能：先执行代码分析，产出 `FeatureAnalysis/*` 源码事实；随后立即执行契约校准，产出 target-local `Contract/contract.md`，作为后续 stage3b/stage4 的唯一强 Oracle。

**English**

This solution refactors AutoTestFlow into an engineering organization shaped as
“Supervisor + stage Workers” without changing short-term runtime behavior,
public invocation, stage order, human gates, or structured outputs. The only
public entrypoint remains:

```bash
/auto-test-flow requirements.md --sut-manifest autotestflow.suts.md --remediation-config remediation.config.json --faults on --fault-enrich on --remediate on
```

The short-term refactor is an ownership split only. `AutoTestFlow/SKILL.md`
remains the Supervisor orchestration entrypoint, while
`AutoTestFlow/workers/*/SKILL.md` documents each stage Worker's original
responsibility, inputs, outputs, template/script dependencies, and gates. No
StageTask, stage DAG, runtime helper, or new execution protocol is introduced.

Per the requirement, original stage2 and stage2.5 are merged into one engineering
Worker: `Stage2-CodeAnalysisContract`. Its internal order remains strictly
equivalent: perform code analysis first and produce `FeatureAnalysis/*` source
facts, then immediately run contract calibration and produce target-local
`Contract/contract.md`, the only strong Oracle for stage3b/stage4.

## 2. Design Principles / 设计原则

| Principle / 原则 | 中文说明 | English |
|---|---|---|
| Single public invocation / 单一公开入口 | 用户仍只调用 `/auto-test-flow ...`。Worker 不提供新的用户命令。 | Users still invoke only `/auto-test-flow ...`; Workers expose no new user command. |
| Strict parity / 严格等价 | 短期只拆维护边界，不改功能、阶段、路径、门控、分类语义。 | Short-term work splits ownership only; no behavior, stage, path, gate, or classification changes. |
| File-first discipline / 文件即协议 | 阶段之间仍通过现有文件传递数据，Supervisor 不读取大业务文件。 | Stages keep exchanging data through existing files; Supervisor avoids large business artifacts. |
| Worker opacity / Worker 黑盒化 | Worker 产出规范文件，不把长推理 transcript 回灌给 Supervisor。 | Workers produce canonical files instead of long reasoning transcripts. |
| Contract authority / 契约权威 | `Contract/contract.md` 仍是可执行断言唯一强 Oracle。 | `Contract/contract.md` remains the only strong executable Oracle. |
| Future optional protocols / 长期协议可选 | A2A/MCP/checkpoint/audit 仅作为长期可选演进，短期不得落地为新协议。 | A2A/MCP/checkpoint/audit are long-term optional evolutions, not short-term protocol changes. |

## 3. Supervisor Boundary / 总控边界

**中文**

`AutoTestFlow/SKILL.md` 继续作为 Supervisor。它负责：

- 解析单一 `/auto-test-flow` 调用和原有 flags；
- 执行原 stage0 manifest 解析与归一化；
- 按原流程调度 stage1、target loop、stage2/2.5、stage2.6、stage3a、stage3b、stage4、stage5、stage6、stage7；
- 验证每个阶段的既有产物是否存在；
- 保持原人工确认门；
- 根据 `--start-stage` 和已有文件进行原有恢复逻辑；
- 聚合 target 报告为 root report。

Supervisor 不做：

- 不新增 StageTask 文件；
- 不新增 stage DAG；
- 不新增 `supervisor_runtime.py`；
- 不替换现有模板/脚本；
- 不读取大业务文件或将大 JSON/source 放入上下文；
- 不改变原输出目录结构。

**English**

`AutoTestFlow/SKILL.md` remains the Supervisor. It is responsible for:

- Parsing the single `/auto-test-flow` invocation and existing flags.
- Running original stage0 manifest parsing and normalization.
- Dispatching the original flow: stage1, target loop, stage2/2.5, stage2.6,
  stage3a, stage3b, stage4, stage5, stage6, and stage7.
- Validating that existing stage artifacts are present.
- Preserving original human gates.
- Resuming through existing file artifacts and `--start-stage`.
- Aggregating target reports into the root report.

The Supervisor does not:

- Add StageTask files.
- Add a stage DAG.
- Add `supervisor_runtime.py`.
- Replace existing templates/scripts.
- Read large business files or pass large JSON/source into context.
- Change the original output directory structure.

## 4. Worker Boundary / 阶段 Worker 边界

**中文**

Worker 是阶段级维护单元，而不是新的运行时协议。每个 Worker 的 `SKILL.md` 只记录：

- 原阶段职责；
- 原输入文件；
- 原输出文件；
- 原模板与脚本依赖；
- 原人工门；
- 禁止事项。

短期 Worker 目录如下：

```text
AutoTestFlow/workers/
├── Stage0-SutManifest/
├── Stage1-RequirementAnalysis/
├── Stage2-CodeAnalysisContract/
├── Stage26-KnowledgeMatch/
├── Stage3a-ScenarioEnrichment/
├── Stage3b-TestDesign/
├── Stage4-TestGenerationRun/
├── Stage5-Report/
├── Stage6-FaultAnalysis/
└── Stage7-ReverifyIssue/
```

**English**

A Worker is a stage-level ownership unit, not a new runtime protocol. Each
Worker `SKILL.md` documents only:

- Original stage responsibility.
- Original input files.
- Original output files.
- Original template and script dependencies.
- Original human gates.
- Non-goals and prohibited changes.

The short-term Worker directory is:

```text
AutoTestFlow/workers/
├── Stage0-SutManifest/
├── Stage1-RequirementAnalysis/
├── Stage2-CodeAnalysisContract/
├── Stage26-KnowledgeMatch/
├── Stage3a-ScenarioEnrichment/
├── Stage3b-TestDesign/
├── Stage4-TestGenerationRun/
├── Stage5-Report/
├── Stage6-FaultAnalysis/
└── Stage7-ReverifyIssue/
```

## 5. Stage Mechanics / 各阶段原始工作原理

| Worker | Original Stage / 原阶段 | Mechanics / 工作原理 | Inputs / 输入 | Outputs / 输出 | Gates / 门控 | Scripts/Templates / 脚本与模板 |
|---|---|---|---|---|---|---|
| Stage0-SutManifest | 0 | Parse natural-language or legacy SUT manifest, normalize targets, prepare target output roots. / 解析自然语言或 legacy SUT manifest，归一化 target，准备输出根。 | Original invocation, `--sut-manifest`, legacy compatibility args, remediation config refs. | `RunMetadata/sut_description.parse.json`, `RunMetadata/sut_description.review.md`, `RunMetadata/sut_manifest.normalized.json`, `targets/<target_id>/`. | Human review for low-confidence/missing/unsafe command-bearing config. / 低置信、缺字段或命令风险时人工确认。 | `scripts/sut_manifest.py`, `shared/sut_manifest_schema.md`. |
| Stage1-RequirementAnalysis | 1 | Analyze requirement-side FP/FS, flow/framework/quality scenarios, render review Markdown. / 需求侧 FP/FS 与场景分析，渲染审阅 Markdown。 | `requirements.md`, optional fault context. | `FeatureAnalysis/s1_index.json`, `FeatureAnalysis/s1_scenarios/*`, `FeatureAnalysis/requirement_analysis.md`, `FeatureAnalysis/s1_scenario_examples.md`. | Mandatory human gate for FP split and scenario boundary. / FP 拆分和场景边界强制人工门。 | `templates/stage1_req_analyze.md`, `shared/scenario_schema.md`, `scripts/render_design_markdown.py`. |
| Stage2-CodeAnalysisContract | 2 + 2.5 | Run profile scan plan, extract code facts, derive framework scenes, then probe/calibrate contract. / 先 profile 预扫描与源码事实抽取，再探测并校准契约。 | Target source/runtime info, code scan guides, probe plan/base URL. | `FeatureAnalysis/code_scan_plan.json`, `FeatureAnalysis/s2_code_facts.json`, `FeatureAnalysis/stage_summary.json`, `FeatureAnalysis/framework_scenes.json`, `Contract/contract_samples.json`, `Contract/contract.md`. | No new human gate; target reachability affects later readiness. / 不新增人工门；可达性影响后续就绪门。 | `scripts/prepare_code_scan.py`, `templates/stage2_code_scan.md`, `scripts/probe_contract.py`, `templates/stage2_5_contract_calibrate.md`, `shared/code_scan_*`, `shared/code_analysis_template.md`. |
| Stage26-KnowledgeMatch | 2.6 + 2.6b + 2.P | Match TestKnowledgeBase by registry/domain/contract, cap assertions by contract, optionally enrich fuzzy bindings, produce advisory professional gates. / 基于知识库与契约匹配，按 contract 封顶断言，按需增强模糊绑定，生成专业验收 advisory。 | `Contract/contract.md`, S1 scenarios, S2 facts, TestKnowledgeBase registry/packages, optional overlay. | `KnowledgeBase/knowledge_matches.json`, `KnowledgeBase/fault_matches.json`, `KnowledgeBase/fault_contract_alignment.md`, `QualityGates/*`. | Existing `--faults` and `--fault-enrich` modes; no human gate. / 保持原开关，无人工门。 | `scripts/match_faults.py`, `templates/stage2_6_fault_match.md`, `scripts/professional_acceptance.py`. |
| Stage3a-ScenarioEnrichment | 3a | Copy S1 scenarios, add GAP and framework scenarios, merge enriched index and Markdown companion. / 复用 S1 场景，补 GAP 与框架场景，合并索引和 Markdown。 | S1 index/scenarios, S2 facts, framework scenes, stage summary. | `FeatureAnalysis/s3a_enriched/*`, `FeatureAnalysis/s3a_framework.json`, `FeatureAnalysis/s3a_enriched_index.json`, `FeatureAnalysis/s3a_scenario_landscape.md`. | None. / 无。 | `templates/stage3a_gap.md`, `templates/stage3a_framework.md`, `scripts/merge_enriched.py`, `scripts/render_design_markdown.py`. |
| Stage3b-TestDesign | 3b | Batch by scenario ids, read small files and contract, design tests, merge canonical TestCases. / 按场景 id 分批，小文件读取并按 contract 设计用例，合并产物。 | Enriched index/scenarios, framework file, contract, optional fault/professional guidance. | `TestCases/test_design_batch_*.json`, `TestCases/test_design.json`, `TestCases/test_examples.md`, `TestCases/scene_tc_mapping.json`, optional `TestCases/e2e_scenes.json`. | Mandatory human gate after merge. / merge 后强制人工门。 | `templates/stage3b_batch_design.md`, `scripts/merge_test_design.py`, `scripts/render_design_markdown.py`, `shared/rules.md`. |
| Stage4-TestGenerationRun | 4 | Readiness gate, select P0, generate pytest/httpx black-box tests, execute, trace, evaluate fault oracles, aggregate. / 就绪门、P0、生成 pytest/httpx 黑盒用例、执行、trace、fault oracle、聚合。 | Test design, stage summary, contract, runtime info, reference harness. | `TestCases/p0_selection.json`, `TestRun/validate_test.py`, `TestRun/tests/*`, `TestRun/results/*`, `TestRun/trace/*`, `TestRun/case_results.json`. | P0 quality and batch result human confirmations remain. / P0 与批量结果确认门保持。 | `scripts/sut_runtime.py`, `scripts/select_p0.py`, `templates/stage4a_p0_verify.md`, `templates/stage4b_batch_gen.md`, `scripts/evaluate_fault_oracles.py`, `scripts/aggregate_results.py`, `reference/*`. |
| Stage5-Report | 5 | Generate target/root reports, normalize layout, record knowledge candidates, run final advisory gates, decide remediation branch. / 生成 target/root 报告，归档布局，记录知识候选，运行最终 advisory，决定是否进入修复。 | Case results, contract, traces, knowledge/professional artifacts. | `Reports/report.md`, `KnowledgeBase/new_knowledge_candidates.json`, `KnowledgeBase/new_faults_detected.json`, `KnowledgeBase/project_faults.json`, final `QualityGates/*`, root report. | None added; remediation config controls next stages. / 不新增门；修复配置控制后续。 | `templates/stage5_report.md`, `scripts/output_layout.py`, `scripts/record_faults.py`, `scripts/professional_acceptance.py`. |
| Stage6-FaultAnalysis | 6 | Select analysis targets, run domain-aware fault analysis, write evidence/fix/issue drafts, finalize manifests. / 选择分析目标，领域化 fault analysis，写证据/方案/issue 草稿，汇总 manifest。 | Case results, per-case results, traces, contract, S2 facts, fault matches, remediation config. | `FaultAnalysis/analysis_plan.json`, `FaultAnalysis/manifest.json`, `FaultAnalysis/targets/*`, `Remediation/plan.json`, `Remediation/manifest.json`, `Remediation/defects/*`. | Mandatory confirmation for `--remediate=on`. / `--remediate=on` 强制确认。 | `scripts/remediation_plan.py`, `templates/stage6_fault_analyze.md`, `templates/stage6_defect_analyze.md`, `shared/remediation_rules.md`, `shared/fault_analysis_profiles.json`. |
| Stage7-ReverifyIssue | 7 | Apply approved patches, rebuild, reverify, generate issue bodies, submit evidence issues only when allowed. / 应用批准补丁，重建复验，生成 issue body，并仅在允许时外发 evidence issue。 | Remediation plan/manifest/defects, remediation config, target runtime/build config. | `Remediation/reverify.json`, `Remediation/issue_bodies/*`, `Remediation/submitted.json`. | Existing human gate plus `allow_open_issue=true` for external submission. / 原人工门 + `allow_open_issue=true`。 | `scripts/apply_and_reverify.py`, `scripts/submit_remediation.py`. |

## 6. Merged Stage2 + Stage2.5 Internal Sequence / 合并后 Stage2 内部顺序

**中文**

`Stage2-CodeAnalysisContract` 的合并是工程责任合并，不是功能混写。内部顺序必须固定：

1. 从 normalized manifest 读取 target 的 source/runtime 信息。
2. 若 `source.available=false` 或 `source.skip_code_scan=true`，写原 no-source 占位并保留后续契约校准能力。
3. 执行 `prepare_code_scan.py` 生成 `FeatureAnalysis/code_scan_plan.json`。
4. 使用 `templates/stage2_code_scan.md` 生成 `FeatureAnalysis/s2_code_facts.json`、`FeatureAnalysis/stage_summary.json`、`FeatureAnalysis/framework_scenes.json`。
5. 执行 `probe_contract.py` 生成 `Contract/contract_samples.json`。
6. 使用 `templates/stage2_5_contract_calibrate.md` 生成 `Contract/contract.md`。
7. 验证 `Contract/contract.md` 存在后，才允许进入 Stage26/Stage3b/Stage4 的断言设计与执行。

**English**

`Stage2-CodeAnalysisContract` merges engineering ownership, not functional
semantics. Its internal order must remain fixed:

1. Read target source/runtime information from the normalized manifest.
2. If `source.available=false` or `source.skip_code_scan=true`, write original
   no-source placeholders while preserving contract calibration.
3. Run `prepare_code_scan.py` to produce `FeatureAnalysis/code_scan_plan.json`.
4. Use `templates/stage2_code_scan.md` to produce
   `FeatureAnalysis/s2_code_facts.json`, `FeatureAnalysis/stage_summary.json`,
   and `FeatureAnalysis/framework_scenes.json`.
5. Run `probe_contract.py` to produce `Contract/contract_samples.json`.
6. Use `templates/stage2_5_contract_calibrate.md` to produce
   `Contract/contract.md`.
7. Validate `Contract/contract.md` before any downstream assertion design or
   execution in Stage26/Stage3b/Stage4.

## 7. Short-Term Refactoring Plan / 短期重构计划

**中文**

短期目标是快速把阶段拆成可分工维护的 Worker，同时严格保持原 AutoTestFlow 功能等价：

1. 新增 `AutoTestFlow/workers/*/SKILL.md`，每个 Worker 只记录原阶段边界和依赖。
2. 保留 `AutoTestFlow/templates/` 作为初版 Worker 的唯一 prompt 来源。
3. 保留 `AutoTestFlow/scripts/` 作为确定性工具边界。
4. 更新 `AutoTestFlow/SKILL.md` 和 `README.md`，只说明 Worker 组织，不改调度协议。
5. 合并 stage2/stage2.5 的工程所有权为 `Stage2-CodeAnalysisContract`，但内部仍按原顺序执行。
6. 使用原单一命令验证 output layout、人工门和 demo 兼容性。

**English**

The short-term goal is to split stage ownership quickly while preserving strict
AutoTestFlow parity:

1. Add `AutoTestFlow/workers/*/SKILL.md`, each documenting only original stage
   boundaries and dependencies.
2. Keep `AutoTestFlow/templates/` as the first-version Worker prompt source.
3. Keep `AutoTestFlow/scripts/` as the deterministic tool boundary.
4. Update `AutoTestFlow/SKILL.md` and `README.md` only to describe Worker
   organization, not to change orchestration protocol.
5. Merge stage2/stage2.5 engineering ownership into
   `Stage2-CodeAnalysisContract`, while preserving internal order.
6. Validate output layout, human gates, and demo compatibility through the
   original single command.

## 8. Long-Term Iteration Roadmap / 长期迭代路线

**中文**

长期演进参考企业级 Supervisor-Workers 架构，但必须在短期等价拆分稳定后逐步引入：

- Worker 独立 fixture：每个 Worker 增加阶段级输入/输出 fixture，验证原产物路径与 schema。
- Worker ownership metadata：增加 owner、reviewer、变更规则、兼容性说明。
- A2A 可选远程化：只有在本地 Worker 产物稳定后，才允许把 Worker 包装为远程黑盒；远程结果必须先物化为本地版本化 artifact。
- MCP 可选工具化：知识库、代码仓、运行环境工具可通过 MCP 暴露，但下游只能消费本地 snapshot。
- Checkpoint/audit 可选化：长任务可增加事件溯源和 checkpoint，但不得绕过现有文件产物。
- Irreversible-action guard：Stage7 外发 issue、未来 PR 或其它不可逆动作必须保留人工门、配置门和审计记录。
- Routing loop guard：若未来引入动态路由，必须有确定性重访计数器和硬阈值，默认最大重访 3 次。

**English**

Long-term evolution follows the enterprise Supervisor-Workers architecture, but
only after the short-term parity split is stable:

- Worker fixtures: add per-Worker input/output fixtures validating original
  artifact paths and schemas.
- Worker ownership metadata: add owner, reviewer, changelog, and compatibility
  rules.
- Optional A2A remote Workers: only after local Worker outputs are stable; remote
  results must materialize as versioned local artifacts before downstream use.
- Optional MCP tooling: knowledge, repository, and runtime tools may be exposed
  through MCP, but downstream stages consume only local snapshots.
- Optional checkpoint/audit: long-running enterprise runs may add event sourcing
  and checkpoints without bypassing existing file artifacts.
- Irreversible-action guard: Stage7 issue submission, future PRs, or any
  irreversible action must retain human gates, config gates, and audit records.
- Routing loop guard: if dynamic routing is introduced later, deterministic
  revisit counters and hard thresholds are mandatory, with default max revisit 3.

## 9. No Extra Functionality Constraints / 不新增额外能力约束

**中文**

本轮短期重构禁止新增：

- 新公开命令；
- 新 flags；
- `stage_registry.json`；
- `shared/stage_task_schema.md`；
- `scripts/supervisor_runtime.py`；
- `tests/test_supervisor_runtime.py`；
- `RunMetadata/stage_dag.json`；
- `RunMetadata/stage_tasks/*`；
- 新 stage DAG；
- 新 Worker 调用协议；
- 新外部提交动作；
- 新 Oracle 来源。

**English**

This short-term refactor must not add:

- New public commands.
- New flags.
- `stage_registry.json`.
- `shared/stage_task_schema.md`.
- `scripts/supervisor_runtime.py`.
- `tests/test_supervisor_runtime.py`.
- `RunMetadata/stage_dag.json`.
- `RunMetadata/stage_tasks/*`.
- A new stage DAG.
- A new Worker invocation protocol.
- New external submission actions.
- New Oracle sources.

## 10. Unchanged Structured Output List / 最终结构化输出保持原样清单

The refactor preserves the existing structured output layout:

```text
RunMetadata/
├── sut_description.parse.json
├── sut_description.review.md
└── sut_manifest.normalized.json

targets/<target_id>/
├── FeatureAnalysis/
│   ├── s1_index.json
│   ├── s1_scenarios/*.json
│   ├── requirement_analysis.md
│   ├── s1_scenario_examples.md
│   ├── code_scan_plan.json
│   ├── s2_code_facts.json
│   ├── stage_summary.json
│   ├── framework_scenes.json
│   ├── s3a_enriched/*.json
│   ├── s3a_framework.json
│   ├── s3a_enriched_index.json
│   └── s3a_scenario_landscape.md
├── Contract/
│   ├── contract_samples.json
│   ├── contract.md
│   └── sut_ready.json
├── KnowledgeBase/
│   ├── knowledge_matches.json
│   ├── fault_matches.json
│   ├── fault_contract_alignment.md
│   ├── new_knowledge_candidates.json
│   ├── new_faults_detected.json
│   └── project_faults.json
├── QualityGates/
│   ├── professional_acceptance.seed.json
│   ├── professional_acceptance.code_gaps.json
│   ├── professional_case_guidance.json
│   ├── professional_acceptance.json
│   └── ai_eval_readiness.json
├── TestCases/
│   ├── test_design_batch_*.json
│   ├── test_design.json
│   ├── test_examples.md
│   ├── scene_tc_mapping.json
│   ├── e2e_scenes.json
│   ├── e2e_scenes.md
│   └── p0_selection.json
├── TestRun/
│   ├── validate_test.py
│   ├── tests/*.py
│   ├── results/*.json
│   ├── trace/*.jsonl
│   └── case_results.json
├── Reports/
│   └── report.md
├── FaultAnalysis/
│   ├── analysis_plan.json
│   ├── manifest.json
│   └── targets/*/*
└── Remediation/
    ├── plan.json
    ├── manifest.json
    ├── defects/*/*
    ├── reverify.json
    ├── issue_bodies/*.md
    └── submitted.json

Reports/report.md
```

## 11. Verification Plan / 验证计划

**中文**

- `python3 -m unittest discover AutoTestFlow/tests` 必须通过或明确说明失败原因。
- 检查仓库内不包含本轮禁止新增的 StageTask/runtime/DAG 文件。
- 检查 `AutoTestFlow/workers/*/SKILL.md` 只描述原阶段职责与依赖。
- 用 remote branch diff 确认变更范围只包含：等价 Worker 组织、双语架构方案、双语 changelog、主文档说明。
- 现有 A2A fault/remediation demo 应继续产出同名 canonical artifacts。

**English**

- `python3 -m unittest discover AutoTestFlow/tests` must pass, or failures must
  be explained clearly.
- Verify the repository does not contain prohibited StageTask/runtime/DAG files.
- Verify `AutoTestFlow/workers/*/SKILL.md` only documents original stage
  responsibility and dependencies.
- Compare with the remote branch to confirm the scope is limited to parity
  Worker organization, bilingual architecture plan, bilingual changelog, and
  documentation notes.
- Existing A2A fault/remediation demos should continue producing the same
  canonical artifacts.
