---
name: auto-test-flow
description: 需求驱动的测试智能体。面向对外协议可观测的源码型被测系统(SUT)，从需求侧出发，先用运行中的 SUT 校准真实契约，再据真实形态生成可执行黑盒测试。当前以场景化测试实现，DFX 测试并行规划。触发词："/auto-test-flow", "需求测试分析", "需求驱动测试", "自动化测试编排"
---

# AutoTestFlow · 需求驱动的测试智能体

AutoTestFlow 是需求驱动的测试智能体；当前以**场景化测试**(flow/framework/quality)实现，按"测试维度"抽象，**规划与 DFX 测试(性能/可靠性/安全/兼容性等)并行**。

面向对外协议可观测的源码型被测系统(SUT)：从需求侧出发分析测试场景，在生成断言前**先用运行中的 SUT 校准真实契约**，再据真实形态生成可执行黑盒测试，并把"脚本缺陷/SUT 不满足/被测缺陷/环境问题"严格分流，使 Oracle 权威、判定可信。

> **栈说明**：stage2 通过 profile adapter 扫描 Java/Spring、Python Web/API、C++ service/RPC 或未知源码树；执行代码走 **Python pytest + httpx 黑盒**，只打 SUT 的对外端点。黑盒只依赖被测协议的 HTTP/响应契约形态，不触碰被测内部组件。
> **判据权威**：被测协议/端点/响应契约的真实形态一律以 **stage2.5 产出的 `contract.md`** 为准；不得凭需求文档措辞臆造响应结构。
> **故障探针**：带 `fault_ref` 的 TestKnowledgeBase 用例不能仅凭最终 E2E 成功写 pass；stage4 必须在 pytest 通过后继续执行 required `fault_oracles` 的 trace/process/negative 门禁。

## 默认全链路命令

```bash
/auto-test-flow requirements.md --sut-manifest autotestflow.suts.md --remediation-config remediation.config.json --faults on --fault-enrich on --remediate on
```

运行前让用户按项目实际情况修改 `requirements.md`、自然语言 `autotestflow.suts.md` 和 `remediation.config.json`。该默认命令必须读取默认 `TestKnowledgeBase/registry.json`，启用 stage2.6b LLM 增强，并在 stage5 后默认进入门控式 fault analysis / remediation；缺少或非法 remediation 配置时跳过 stage6/7 并说明原因，不强行修复。任何 evidence issue 外发仍必须经 stage6 人工确认门和 `switches.allow_open_issue=true`。

## 测试维度

AutoTestFlow 按"测试维度"组织测试生成，各维度是并行轨道，互不阻塞：

| 维度 | 状态 | 说明 |
|------|------|------|
| `scenario` | **已实现** | 场景化测试：flow(流程驱动) + framework(框架组合) + quality(质量保障)，本文档描述的完整编排流程 |
| `dfx` | **规划中（并行轨道）** | 性能/可靠性/安全/兼容性等非功能维度；当前为 `design_only` 占位，仅产出设计骨架，不生成可执行代码 |

> 测试维度是横向扩展点：`scenario` 与 `dfx` 共享同一套编排器/契约校准/执行边界纪律。新增维度时复用既有调度框架，只扩充对应的场景/用例生成模板。

## 双模式

| 模式 | 触发条件 | 流程 | 输出 |
|------|----------|------|------|
| **标准模式** | 提供 `--sut-manifest`，或 legacy `code_path`/`--pr`/`--commit` + `--sut-base-url` | 0 SUT 描述解析/归一化→1→target loop(2→**2.5**→3a→3b→4a→4b→5)→root report→[6→确认门→7](默认门控) | 每个 target 独立真实契约校准 + 可执行黑盒测试 + target 报告 + root 汇总 + 默认门控 fault analysis + 本地复验 + evidence issue |
| **纯需求模式** | 以上均未提供 | 1→2R→3aR→3b（终止） | 测试设计文档 |

> 标准模式先用 Stage 0 LLM/编排解析自然语言 `autotestflow.suts.md`，再由 `scripts/sut_manifest.py` 确定性校验并归一化为 `RunMetadata/sut_manifest.normalized.json`；legacy Markdown+YAML manifest 仍直接走同一校验器。每个 target 在自己的 `targets/<target_id>/` 下执行阶段2→5，并在阶段2之后**强制插入阶段2.5「契约校准」**，产出 target-local 权威 Oracle `Contract/contract.md`。纯需求模式无代码亦无运行服务，断言点统一标 `needs-runtime-verify`。
> 纯需求模式详细说明已内嵌于 `templates/stage2R_req_summary.md` 和 `templates/stage3aR_framework.md`。

## 核心流程

```
标准模式（multi-SUT）：
  阶段0：sut_manifest.py --sut-manifest {path} --write
    → RunMetadata/sut_description.parse.json
    → RunMetadata/sut_description.review.md
    → RunMetadata/sut_manifest.normalized.json
    → targets/<target_id>/{source/runtime/probes/output paths}

  对每个 target 独立执行：
  ┌─阶段1(S1-Agent)───┐
  │ 需求侧场景分析     │
  │ → s1_index.json   │
  │ → s1_scenarios/*  │
 并│  [人工裁决✅]      │
 行│                   │
  │                   │ → 编排器cp → target 阶段2.5 → ┌─阶段3a-gap─┐ → 阶段3b（小文件）→ Python merge → 阶段4 → target 阶段5
  └─阶段2(S2-Agent)───┘   契约校准           │ GAP场景生成 │      [人工裁决✅]
  │ 源代码事实扫描     │  (probe_contract │ └────────────┘
  │ + 派生框架场景      │   + contract.md)        ↕ 并行
  │ → framework_scenes.json│                ┌─阶段3a-fw──┐
  └───────────────────┘                    │ 框架场景补充 │
                                            │ 读 framework_scenes.json │
                                            │ → s3a_framework.json │
                                            └──────────────┘

  target 阶段2.5 契约校准（关键门）：
    probe_contract.py --target-id {target_id} --base-url {sut_base_url} [--probe-plan {probe_plan}] → targets/<target_id>/Contract/contract_samples.json
      ├─ target 可达 → 采样真实响应 + 结合 target stage2 源码事实 → targets/<target_id>/Contract/contract.md（权威 Oracle）
      └─ target 不可达 → 退化：静态推导(读 target 源/SDK) + 标 needs-runtime-verify

  root report 聚合所有 target 的覆盖、风险、env_issue 与缺陷摘要

纯需求模式：
  阶段1(S1-Agent) → 阶段2R(S2R-Agent) → 阶段3aR(S3aR-Agent) → 阶段3b(终止)
```

## 人工裁决（核心纪律）

> **缺规格库→人工裁决补位评判标准；规格库就位后可降级为自动。**

本 skill 当前**没有业务约束/架构知识的规格库**。需求分析与测试用例设计因此高度依赖 LLM 的理解，缺少客观的评判判据来确认"分析对不对、用例设计全不全"。在规格库就位前，由**人工裁决**补位评判标准：

| 裁决点 | 阶段 | 裁决内容 |
|--------|------|----------|
| **stage1 需求分析** ✅ | 需求侧场景分析完成后 | 确认功能点拆分、场景边界、覆盖范围正确（LLM 分析无规格库可对照，需人工把关） |
| **stage3b 用例设计** ✅ | 测试用例设计 merge 后 | 确认 `test_design.json` 的用例完备性、步骤准确性、断言点合理（同样缺判据，需人工裁决） |
| 4a P0 验证 ✅ | P0 金标准生成后 | 确认 P0 用例质量（断言有 contract 依据、轨迹完整） |
| 4b 批量生成 ✅ | 批量结果聚合后 | 确认批量执行结果与分类 |
| **stage6/7 evidence issue** ✅ | fault analysis manifest 就绪后（仅 `--remediate=on`） | **强制门**：确认本地复验 + evidence issue 提交范围（一切外发副作用前；不再提交 PR） |

stage1 与 stage3b 的裁决默认是**强制门**：阶段完成后**必须**调用 `AskUserQuestion`，得到用户确认才进入下一阶段。

**保守降级（规格库部分就位）**：当 `KnowledgeBase/fault_matches.json` 存在（故障库即首个规格库实例）时，仅 **stage3b 门的"异常/边界/质量覆盖完备性"维度**由故障库背书**自动通过并展示摘要**；**stage1 门**与 **stage3b 的"FP 拆分映射 / 断言合理性"维度仍强制人工确认**——故障库只提供"故障判据"，不覆盖 FP 拆分与断言合理性判据。待规格库进一步完善这些判据后方可继续降级。

```python
AskUserQuestion(questions=[{
    "question": "阶段 X 已完成，是否确认结果并继续执行阶段 X+1？",
    "header": "人工裁决",
    "options": [
        {"label": "确认继续", "description": "结果无误，进入阶段 X+1"},
        {"label": "需修改", "description": "我将手动修改产出文件后再继续"},
        {"label": "重新执行", "description": "重新执行当前阶段（--start-stage=X）"},
        {"label": "跳过后续", "description": "保留当前输出，不再执行后续阶段"}
    ],
    "multiSelect": false
}])
```

## 场景设计原则

**一条用户操作链路 = 一个场景。** 同一链路的配置差异/异常分支不拆独立场景。

| 场景类型 | 来源 | 说明 |
|----------|------|------|
| **flow（流程驱动）** | 主流程 | 每条用户操作链路1个场景，含变体和异常子项 |
| **framework（框架组合）** | 框架场景×FP | 框架场景作为执行环境嵌入用户链路 |
| **quality（质量保障）** | RK/CD/GAP → branches.quality | 作为quality分支附着到已有链路，注入触发条件 |

> **断言来源约束**：任何 flow/framework/quality 场景的预期结果(Oracle)在 stage3b/stage4 落为断言时，**必须能在 `contract.md` 找到对应的真实形态证据**（响应包装/字段路径/枚举/错误码/事件形态）。`contract.md` 未覆盖的断言点须标 `needs-runtime-verify`，不得凭需求文档措辞臆造响应结构。

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `requirement_doc` | 需求文档路径 | **必填** |
| `--sut-manifest` | 自然语言 SUT 描述，标准模式主入口；用户可写 target、URL/IP/端口、环境变量、依赖、源码路径、运行方式；兼容 legacy Markdown+YAML manifest | **标准模式推荐必填** |
| `code_path` | legacy 单 target 源码目录；提供 `--sut-base-url` 时会归一化为 `target_id=default` 的 manifest | **兼容项** |
| `--sut-base-url` | **Deprecated compatibility only**：legacy 单 target 基址；内部归一化为 manifest | 可选 |
| `--output-dir` | 输出目录 | `analysis_output/` |
| `--case-batch-size` | 并行Agent数量（阶段4b） | 5 |
| `--p0-count` | P0用例数量（阶段4a） | 3 |
| `--max-fix-attempts` | 最大修复轮数（阶段4b 有界修复环） | 3 |
| `--start-stage` | 从指定阶段开始 | 自动检测 |
| `--pr` | PR编号，逗号分隔 | 可选（与 code_path/commit 三选一） |
| `--commit` | Commit ID，逗号分隔 | 可选（与 code_path/pr 三选一） |
| `--base` | 基准分支 | 仓库默认分支 |
| `--knowledge-root` | TestKnowledgeBase 根目录，供阶段2.6 registry/glob discovery 使用 | 仓内 `TestKnowledgeBase` |
| `--knowledge-domain` | 知识域过滤：`all` / `rest_api` / `web` / `agent` / `dfx`，或逗号分隔 package_id | `all` |
| `--professional-gates` | Professional_experience advisory artifacts：`auto` / `on` / `off` | `auto` |
| `--fault-lib` | 显式故障库路径，仅用于旧 demo 或单文件调试 | 可选；默认不自动回退 `Specification_Repository` |
| `--fault-overlay` | 项目级故障库 overlay（覆盖/禁用/项目特有故障） | 可选 |
| `--faults` | 故障库启用模式：`on`（默认，读取默认 TestKnowledgeBase）/ `auto` / `off` | `on` |
| `--fault-enrich` | 阶段2.6b LLM 增强（模糊绑定 / 占位替换 / contract_conflict 检出）：`on` / `off` / `auto` | `on` |
| `--remediate` | fault analysis / 自动修复总开关（阶段6/7）：`on`(默认，经**强制人工确认门**后才可提交 evidence issue；不再提交 PR) / `dry-run`(分析+本地复验,**不**提交 issue) / `off`(显式关闭) | `on` |
| `--remediation-config` | 修复配置；默认命令使用项目根 `remediation.config.json`。multi-SUT 优先使用 manifest target 的 `remediation.config_path` 或 `targets/<target_id>/remediation.config.json`；缺失/非法则跳过 stage6/7 | `remediation.config.json` → legacy `<output_dir>/remediation.config.json` → `<work_dir>/.autotestflow/remediation.config.json` |
| `--remediation-max-defects` | 单轮最多处理的 sdk_defect 数（限影响面） | 5 |
| `--beta-wiki` | **Beta 预研开关**（故障库接入 LLM Wiki，Phase A）：`off`(不生成/不读取 wiki，用稳定模板，流水线字节级一致) / `on`(先派生仓内 wiki，再让 stage2.6b/stage6 用 beta 模板读 wiki 作 advisory)。详见 `beta/README.md` | `off` |

**注意**：
- `--sut-manifest` 是标准模式主入口；自然语言描述会生成 `sut_description.parse.json` 与 `sut_description.review.md`，推断出 managed build/start 命令、低置信或缺字段时必须先人工确认；`--sut-base-url` 只保留为旧调用兼容 shim，并会输出 deprecation note。
- direct/predeployed target 可以只提供可达 URL/IP/端口并设置 `source.available=false`；该 target 跳过 stage2 源码扫描/code-only GAP，仍可在可达时执行 stage2.5 契约探测与黑盒测试。
- target 的 `runtime.base_url` 若不可达，target 阶段2.5 自动退化为静态源推导（读 target 源/SDK）并标 `needs-runtime-verify`；该 target 的阶段4 就绪门会标 `env_issue`，不影响其它 target。
- 模块角色、入口目录、代码缺陷从阶段2的 `s2_code_facts.json` + `stage_summary.json` 获取。
- 代码独有能力(code_only)由阶段3a-gap Agent 从 `s2_code_facts.json` 提取并生成 GAP 场景。
- 黑盒脚手架由 `reference/`（`http_client.py` + `conftest.py` + `client_reference.md`）提供，skill 不重新生成；按 stage2.5 校准出的 `contract.md` 专化为具体协议形态。

## 依赖内化

迭代6 的 step1 三件**预生成依赖**（框架场景 / 复用资产参考 / 用例格式模板）在本 skill **已内化**，因此**无需手工 step1 预生成依赖**：

| 迭代6 预生成依赖 | 本 skill 内化方式 |
|------------------|-------------------|
| 复用资产参考 | 脚手架内置于 `reference/`（`http_client.py` + `conftest.py` + `client_reference.md`），按 `contract.md` 专化 |
| 用例格式模板 | 判据形态由 **stage2.5 契约校准**产 `contract.md`，断言形态以其为准 |
| 框架场景（迭代6 外部 `e2e_framework_scenes.md`） | **框架场景由 stage2 从源码结构自动派生** → `FeatureAnalysis/framework_scenes.json`（**纯需求模式由 stage3aR 从需求侧派生**） |

> 因此参数表**无** `--framework-scenes`，也不需要任何外部预生成文件或手工前置步骤。

## 模块角色分流

| 角色 | 场景类型 | 说明 |
|------|----------|------|
| 独立功能 | flow + framework + quality | 流程场景 + 框架组合 + 质量场景 |
| 支持性组件 | framework + quality | 框架场景组合 + 质量场景 |

## 强制覆盖规则

| 来源类型 | 覆盖规则 |
|----------|----------|
| RK_xxx | **强制全覆盖** |
| CD_xxx（高严重度） | **强制全覆盖** |
| GAP_xxx（P0/P1） | **强制全覆盖** |
| FP_xxx | flow+framework场景全覆盖 |
| 主流程 | 每个主流程有对应场景 |
| 相关框架场景 | 每个相关框架场景有对应场景 |
| 不可验证项 | 标注skip_reason，不生成无意义用例 |
| **契约偏差项** | contract.md 与需求文档形态不一致处 → 以 contract.md 为准生成断言，并在 stage5 记为"需求-实现形态差异"观察 |

## 黑盒测试层级约束

**所有测试必须通过用户可见的入口驱动，禁止绕过用户层直接调用内部组件。**

| 规则 | 说明 |
|------|------|
| FP提取聚焦用户入口 | 功能点描述用户可观测行为，入口记录用户触发方式，不提取 processor/handler 等内部组件 |
| 用例步骤用用户操作语言 | 禁止出现内部组件名（processor/handler/offloader/builder），步骤从用户视角描述 |
| 代码生成禁止内部API | 禁止直接实例化 Java 内部组件、调用私有方法、手写内部类 Stub |
| 黑盒执行入口 | 仅经 SUT 对外协议端点，复用 `reference/http_client.py` 暴露的方法，不绕过 |
| 测试入口 | 对外 HTTP API / 公开配置 / 服务发现端点等可被外部客户端观测的入口 |

---

## 编排器原则

**本skill采用纯编排器模式：主Agent（编排器）只做调度，不读业务文件内容。**

| 原则 | 说明 |
|------|------|
| 零知识调度 | 编排器只检查文件存在性、读几KB的 progress.json，不读业务文件 |
| 全Agent隔离 | 每个阶段由独立子Agent执行，编排器只收到一行摘要 |
| 后台化高量 | 阶段4a/4b的case级Agent用 `run_in_background=True`，编排器不累积返回 |
| 文件即协议 | 所有数据通过文件传递，Agent间无上下文依赖；contract.md 是 stage2.5→stage3b/4 的协议载体 |
| 阶段验证后更新 | 验证产出文件存在后，编排器 Write progress.json 更新阶段状态（子Agent不写） |

### 通用子Agent启动模式

对每个阶段，编排器执行：读取模板 → 替换参数 → spawn Agent → 验证输出 → 进入下一阶段。

```
1. Read templates/stage*_*.md → 替换参数得到 prompt
2. Agent(prompt=填充后prompt, description="阶段X", [run_in_background=True])
3. 验证输出文件存在（不读内容）
4. 如需人工裁决 → AskUserQuestion
```

---

## 阶段映射表

| 阶段 | 模板 | 脚本/共享 | 输出 | 后台 | 人工裁决 |
|------|------|-----------|------|------|------|
| 1 需求侧分析 | `templates/stage1_req_analyze.md` | `shared/scenario_schema.md` + `scripts/render_design_markdown.py` | `FeatureAnalysis/s1_index.json` + `FeatureAnalysis/s1_scenarios/*` + `FeatureAnalysis/requirement_analysis.md` + `FeatureAnalysis/s1_scenario_examples.md` | ✅ | **✅** |
| 2 通用代码扫描 | `templates/stage2_code_scan.md` | `scripts/prepare_code_scan.py` + `shared/code_scan_profiles.json` + `shared/code_scan_guide.md` + `shared/code_analysis_template.md` | `FeatureAnalysis/code_scan_plan.json` + `FeatureAnalysis/s2_code_facts.json` + `FeatureAnalysis/stage_summary.json` + `FeatureAnalysis/framework_scenes.json` | ✅ | ❌ |
| 2.5 契约校准 | `templates/stage2_5_contract_calibrate.md` | `scripts/probe_contract.py` | `Contract/contract.md` + `Contract/contract_samples.json` | — | ❌ |
| 2.6 知识/故障匹配（默认） | —（纯脚本） | `scripts/match_faults.py` | `KnowledgeBase/knowledge_matches.json` + `KnowledgeBase/fault_matches.json` + `KnowledgeBase/fault_contract_alignment.md` | — | ❌ |
| 2.6b 故障增强（默认按需） | `templates/stage2_6_fault_match.md` | — | 回写 `KnowledgeBase/fault_matches.json` | ✅ | ❌ |
| 2.P 专业验收（advisory） | —（纯脚本） | `scripts/professional_acceptance.py` | `QualityGates/professional_acceptance*.json` + `QualityGates/professional_case_guidance.json` + `QualityGates/ai_eval_readiness.json` | — | ❌ |
| 2R 需求摘要（纯需求） | `templates/stage2R_req_summary.md` | — | `FeatureAnalysis/stage_summary.json` | — | ❌ |
| 3a-gap GAP场景 | `templates/stage3a_gap.md` | — | `FeatureAnalysis/s3a_enriched/FS-GAP-*.json` | ✅ | ❌ |
| 3a-fw 框架场景 | `templates/stage3a_framework.md` | 输入 `FeatureAnalysis/framework_scenes.json`（stage2 派生） | `FeatureAnalysis/s3a_framework.json` | ✅ | ❌ |
| 3aR 框架场景（纯需求） | `templates/stage3aR_framework.md` | `scripts/render_design_markdown.py` | `TestCases/e2e_scenes.json` + `TestCases/e2e_scenes.md` + `FeatureAnalysis/s3a_scenario_landscape.md` | — | ❌ |
| 3b 用例设计 | `templates/stage3b_batch_design.md` | `scripts/merge_test_design.py` + `scripts/render_design_markdown.py` + `shared/rules.md` | `TestCases/test_design.json` + `TestCases/test_examples.md` + `TestCases/scene_tc_mapping.json` | ✅ | **✅** |
| 3a 合并 | — | `scripts/merge_enriched.py` + `scripts/render_design_markdown.py` | `FeatureAnalysis/s3a_enriched_index.json` + `FeatureAnalysis/s3a_scenario_landscape.md` | — | ❌ |
| 4a P0验证 | `templates/stage4a_p0_verify.md` | `scripts/select_p0.py` + `reference/http_client.py` + `reference/conftest.py` | `TestRun/tests/test_{id}.py` + `TestRun/results/{id}.json` | ✅ | ✅ |
| 4b 批量生成 | `templates/stage4b_batch_gen.md` | `scripts/aggregate_results.py` + `reference/` | `TestRun/tests/test_{id}.py` + `TestRun/case_results.json` | ✅ | ✅ |
| 5 报告 | `templates/stage5_report.md` | — | `Reports/report.md` | ✅ | ❌ |
| 6 fault analysis（默认门控） | `templates/stage6_fault_analyze.md` + `templates/stage6_defect_analyze.md` | `scripts/remediation_plan.py` + `shared/remediation_rules.md` + `shared/fault_analysis_profiles.json` + `reference/remediation_config.py` | `FaultAnalysis/{analysis_plan.json,manifest.json,targets/<id>/*}` + `Remediation/{plan.json,manifest.json,defects/<case>/*}` | ✅(逐目标) | **✅(强制,仅 on)** |
| 7 应用-构建-复验-evidence issue（默认门控） | —（纯脚本） | `scripts/apply_and_reverify.py` + `scripts/submit_remediation.py` | `Remediation/{reverify.json,submitted.json,issue_bodies/<case>.md}` | ❌ | ❌ |

> 共享文件：`shared/scenario_schema.md`（场景JSON schema）、`shared/code_analysis_template.md`（阶段2输出格式）、`shared/rules.md`（断言层级/截断优先级规则/执行边界）、`shared/code_scan_guide.md`（通用代码扫描指引）、`shared/code_scan_profiles.json`（Java/Python/C++/generic profile）、`shared/java_scan_guide.md`（Java/Spring profile 附录）。
> 脚手架：`reference/http_client.py`（通用黑盒 HTTP 客户端 + 交互记录器）、`reference/conftest.py`（pytest fixtures + 轨迹日志）、`reference/client_reference.md`（黑盒客户端方法表与判据约定）。
> **示例锚点见 `examples/a2a/`**：以 A2A/agent-runtime 为具体 SUT 的客户端专化示例（黑盒客户端 + 判据常量 + 参考资产）；换 SUT 时按 `contract.md` 专化 `http_client.py` 即可，A2A 仅为锚点，非硬编码。

---

## 执行流程

### 阶段1+2：并行启动（标准模式）

> 人工裁决：阶段1 ✅（强制） | 模式：标准

```
步骤1: 并行启动（run_in_background=True）
  → Agent-S1（需求侧场景分析）
    模板: templates/stage1_req_analyze.md
    参数: {skill_dir} {output_dir} {requirement_doc} {work_dir} [{fault_lib}]
    输出: FeatureAnalysis/s1_index.json + FeatureAnalysis/s1_scenarios/FS-*.json + FeatureAnalysis/requirement_analysis.md（摘要）+ FeatureAnalysis/s1_scenario_examples.md（JSON投影）
    子Agent内部读取 shared/scenario_schema.md；若传入 {fault_lib} 则做可选历史 P0 富化（best-effort，见模板"第七步（续）"）

  → 编排器前景执行 stage2 profile 预扫描（不启动 Agent）
    python {skill_dir}/scripts/prepare_code_scan.py --code-path {code_path} --output-dir {output_dir}
    输出: FeatureAnalysis/code_scan_plan.json（primary_profile/language/frameworks/confidence/scan_hints）
    若 manifest target 标记 `source.available=false` / `source.skip_code_scan=true`：
      跳过 stage2 源码扫描，写 target-local stage_summary/code_scan_plan 的 no_source 占位，
      后续 stage2.5 仅用真实 SUT 探测校准 contract，所有 code_only GAP 标 `needs-source`

  → Agent-S2（通用代码事实扫描）
    模板: templates/stage2_code_scan.md
    参数: {skill_dir} {output_dir} {code_path}
    输出: FeatureAnalysis/s2_code_facts.json + FeatureAnalysis/stage_summary.json（简化版）+ FeatureAnalysis/framework_scenes.json
    子Agent内部读取 FeatureAnalysis/code_scan_plan.json + shared/code_scan_guide.md + shared/code_scan_profiles.json，
    并按 profile 选择 Java/Spring、Python Web/API、C++ service/RPC 或 generic fallback adapter。
    ⚠️ 不读取需求侧任何文件，不生成场景

  → 等待全部完成，验证文件存在

步骤2: 【人工裁决门 ✅】需求分析裁决（强制，不降级）
  → AskUserQuestion：确认 stage1 的功能点拆分/场景边界/覆盖范围
  → 理由：缺规格库→人工裁决补位评判标准。LLM 的需求分析无客观判据可对照，需人工把关
  → 注：故障库不覆盖 FP 拆分判据，**此门即使 KnowledgeBase/fault_matches.json 存在也保留强制**
  → 确认继续 → 进入阶段2.5；需修改 → 用户改 FeatureAnalysis/s1_* 后续跑；重新执行 → --start-stage=1
```

### 阶段2.5：契约校准（标准模式，核心门）

> 人工裁决：❌ | 条件：标准模式
> **核心原则**：Oracle/断言一律以 `contract.md` 为准，禁止臆测真实响应形态。

```
步骤1: 编排器前景执行 probe（不启动重 Agent，<30s）
  → 执行: python {skill_dir}/scripts/probe_contract.py \
            --target-id {target_id} \
            --base-url {sut_base_url} \
            [--probe-plan {target_probe_plan_json}] \
            --output {target_output_dir}/Contract/contract_samples.json
  → probe 探针（best-effort，单失败不中断其它）：探活 + 采样正常响应 + 非法请求 +
     未知方法 + 不存在资源查询 + 流式响应（如协议支持）
  → 输出 contract_samples.json：{target_id, base_url, reachable, probe_plan_source, samples[{name,request,http_status,
     response,observed}], notes}
  → observed 启发式：响应包装层 / id 类型 / 枚举前缀 / 事件形态 / error.code

步骤2: 子Agent 产出 contract.md（templates/stage2_5_contract_calibrate.md）
  → 输入: {target_output_dir}/Contract/contract_samples.json + {target_output_dir}/FeatureAnalysis/s2_code_facts.json（源码事实；source unavailable 时可缺省/占位）
  → 产出 {target_output_dir}/Contract/contract.md：真实响应包装/字段/枚举/错误码/事件形态
  → 每一条契约项标注 spec-required（规约必须）vs deployment-config-dependent（部署配置相关）
  → 验证: contract.md 存在且含响应包装与错误码两节

步骤3: 可达性分支
  → reachable=true  → target-local contract.md 以真实采样为权威
  → reachable=false → contract_samples.json 写 reachable:false（probe 已 exit 0，不崩溃）
                      → 子Agent 退化：静态推导(读 SUT 源/SDK 序列化) + 全条目标 needs-runtime-verify
                      → 编排器记录：该 target 的 stage4 就绪门将命中 → target 用例 env_issue，不影响其它 target

自动进入阶段2.6（故障匹配）
```

### 阶段2.6：TestKnowledgeBase 知识/故障匹配（默认，纯脚本，前景 <5s）

> 人工裁决：❌ | 条件：标准模式 + `--faults≠off`；默认 `--faults=on`，读取 `TestKnowledgeBase/registry.json`
> **定位**：在 `contract.md` 就位后，通过 `TestKnowledgeBase/registry.json` 或 `TestKnowledgeBase/Fault/*.json` 动态发现知识包并匹配进流水线，再按契约权威性封顶断言级别。`Specification_Repository/` 仅允许显式旧 demo 调用，不再作为自动 fallback。
> **关闭 / 降级**：`--faults=off` / 无 `contract.md` → 跳过且不产出任何文件，流水线与未接入时**字节级一致**。默认 `on` 下未找到 TestKnowledgeBase 应视为配置错误并提示用户修复知识库路径；独立脚本 smoke 可显式用 `--faults auto` 宽松跳过。

```
步骤1: 编排器前景执行（不启动 Agent）
  → 执行: python {skill_dir}/scripts/match_faults.py \
            --output-dir {output_dir} \
            [--knowledge-root {knowledge_root}] [--knowledge-domain all|rest_api|web|agent|dfx] \
            [--fault-lib {explicit_legacy_fault_lib}] [--fault-overlay {fault_overlay}] [--faults on|auto|off]
  → 输入: Contract/contract.md（权威性分级表）+ FeatureAnalysis/s1_index.json + FeatureAnalysis/s1_scenarios/*.json
          + FeatureAnalysis/s2_code_facts.json + TestKnowledgeBase registry/Fault packages[+overlay]
  → 匹配: package/domain/category metadata · 场景域 · 标签 · 历史(test_case_id→P0) · 关联字段(agentId 等) · 流式信号
  → 调和: 每条故障的断言级别按 contract 权威性封顶（spec-required→L2；config-dependent/静默/未知→L0/L1）
  → 输出: KnowledgeBase/knowledge_matches.json（主产物）+ KnowledgeBase/fault_matches.json（兼容产物，含 fault_ref/branch_class/oracle_refs/fault_oracles/reconciliation）

步骤2: 验证
  → 若 KnowledgeBase/fault_matches.json 存在 → stage3b 将据此补充故障导向用例，并原样保留 required fault_oracles
  → 若不存在（降级）→ stage3b 行为与未接入时完全一致

步骤3: 默认增强（当 --fault-enrich on 且 fault_matches.meta.stats.enrichment_needed > 0）
  → 启动子 Agent：templates/stage2_6_fault_match.md（单 Agent）
  → 作用：对 enrich.needs_bind 条目做 specId 绑定 / 占位替换 / contract_conflict 检出，回写 fault_matches.json
  → 契约安全：断言级别不得越权封顶，找不到 specId 的点保留为观察，冲突时契约优先
  → --fault-enrich=off → 显式跳过增强
  → 【Beta · --beta-wiki on】先跑 `python beta/scripts/gen_wiki.py` 刷新仓内 wiki，再改用
    `beta/templates/stage2_6_fault_match.beta.md`（额外把 `wiki_dir` 传入，子 Agent 读 `wiki/{fault_id}.md`
    作 advisory 语义线索）；--beta-wiki=off（默认）→ 仍用稳定模板，行为字节级一致。详见「Beta（预研特性，默认关闭）」节。

自动进入阶段3a
```

### 阶段2.P：Professional_experience 专业验收产物（advisory，纯脚本，前景 <5s）

> 人工裁决：❌ | 条件：`--professional-gates≠off` 且存在 `TestKnowledgeBase/Professional_experience`
> **定位**：把 Professional_experience 转成测试计划、用例设计、AI readiness 和报告门禁产物。它不是 fault matching，不生成 L2 断言。

```
步骤1: 编排器前景执行（不启动 Agent）
  → 执行: python {skill_dir}/scripts/professional_acceptance.py \
            --output-dir {output_dir} \
            [--knowledge-root {knowledge_root}] --mode all
  → 输入: Professional_experience/acceptance_criteria.json + 当前已生成的 contract/test_design/results/knowledge artifacts
  → 输出:
      QualityGates/professional_acceptance.seed.json
      QualityGates/professional_acceptance.code_gaps.json
      QualityGates/professional_case_guidance.json
      QualityGates/professional_acceptance.json
      QualityGates/ai_eval_readiness.json
  → 契约安全：只输出 advisory gate；不得提高 oracle_refs 的 assert_level
```

### 阶段1 / 2R / 3aR：纯需求模式（子Agent执行）

> 人工裁决：阶段1 ✅（强制） | 条件：纯需求模式

- 阶段1：`templates/stage1_req_analyze.md`，输出 `FeatureAnalysis/s1_index.json` + `FeatureAnalysis/s1_scenarios/`，完成后**强制人工裁决**，确认后自动进入 2R。
- 阶段2R：`templates/stage2R_req_summary.md`，从 `FeatureAnalysis/s1_index.json` 提取统计，输出 `FeatureAnalysis/stage_summary.json`（`mode=requirement_only` + `module_role=独立功能` + `cd_list=[]`），自动进入 3aR。
- 阶段3aR：`templates/stage3aR_framework.md`，S1场景直接复用 + 框架场景补充，输出 `TestCases/e2e_scenes.json` + `TestCases/e2e_scenes.md`，进入阶段3b（终止）。
- **纯需求模式不执行阶段2.5**：无运行服务可校准，断言点统一标 `needs-runtime-verify`。

### 阶段3a：GAP场景 + 框架补充（标准模式）

> 人工裁决：❌ | 条件：标准模式
> **设计原则**：S1场景直接复用，仅补充代码独有能力(GAP)和框架场景。

```
步骤1: 编排器内联（不启动Agent）
  → Bash mkdir -p FeatureAnalysis/s3a_enriched/ && cp FeatureAnalysis/s1_scenarios/*.json FeatureAnalysis/s3a_enriched/

步骤2: 2-Agent并行启动（run_in_background=True）
  → Agent-S3a-gap（GAP场景生成）
    模板: templates/stage3a_gap.md
    输入: FeatureAnalysis/s1_index.json + FeatureAnalysis/s2_code_facts.json
    输出: FeatureAnalysis/s3a_enriched/FS-GAP-*.json
  → Agent-S3a-fw（框架场景补充）
    模板: templates/stage3a_framework.md
    输入: FeatureAnalysis/s1_index.json + FeatureAnalysis/framework_scenes.json（stage2 派生的框架场景）+ FeatureAnalysis/stage_summary.json
    输出: FeatureAnalysis/s3a_framework.json
    ⚠️ 不读取 s2_code_facts.json（框架场景已由 stage2 派生为 FeatureAnalysis/framework_scenes.json）
  → 等待全部完成，验证文件存在

步骤3: Python合并脚本（前景，<1秒）
  → 执行: python scripts/merge_enriched.py
  → 输出: FeatureAnalysis/s3a_enriched_index.json

自动进入阶段3b
```

### 阶段3b：测试用例设计（小文件模式，N-Agent + Python merge）

> 人工裁决：✅（强制）——3b merge 后必须裁决，提示用户检查并修改 `test_design.json`

```
步骤1: 编排器读取索引（零知识调度）
  → Read FeatureAnalysis/s3a_enriched_index.json 获取 scenario_index（只读id列表）
  → Read FeatureAnalysis/s3a_framework.json 获取 framework_scenarios 数量
  → 计算批次分配：flow场景 + framework场景按 batch_size 分批

步骤2: 并行启动Batch Agent（run_in_background=True）
  → Agent-S3b-batch-N（按场景ID分配，每批≤batch_size）
    模板: templates/stage3b_batch_design.md
    参数: {skill_dir} {output_dir} {scene_ids} {next_seq}
    输入: 按需Read单场景文件 + contract.md（断言点须落在 contract.md 真实形态上）
    输出: TestCases/test_design_batch_N.json
    ⚠️ 禁止读取大JSON文件，只Read索引、单场景文件、contract.md

步骤3: Python merge脚本（前景执行）
  → 执行: python scripts/merge_test_design.py
  → 输出: TestCases/test_design.json + TestCases/scene_tc_mapping.json + TestCases/e2e_scenes.json（可选）
  → 验证: 三个文件均存在

步骤4: 【人工裁决门 ✅】用例设计裁决（强制，可保守降级）
  → AskUserQuestion：确认 test_design.json 的用例完备性/步骤准确性/断言点合理
  → 保守降级：若 KnowledgeBase/fault_matches.json 存在 → "异常/边界/质量覆盖完备性"维度由故障库背书自动通过，
     仅展示故障覆盖摘要；裁决聚焦"FP 拆分映射 / 断言合理性"（故障库不覆盖此维度，仍需人工）
  → 理由：缺规格库→人工裁决补位评判标准。用例设计无判据评判"全不全"，需人工裁决
  → 确认继续 → 标准模式进入阶段4 / 纯需求模式终止；需修改 → 用户改 test_design.json 后续跑
```

> **小文件模式**：每个Batch Agent只Read索引(~5KB) + 按需单场景文件(~15KB) + contract.md，避免读取大JSON。
> **纯需求模式终止点**：阶段3b人工裁决通过后终止，输出终止提示：

```
## 纯需求模式完成

已生成测试设计文档：
├── FeatureAnalysis/requirement_analysis.md # 需求分析
├── FeatureAnalysis/stage_summary.json      # 需求侧摘要（简化版）
├── TestCases/e2e_scenes.md                 # 端到端场景
├── TestCases/e2e_scenes.json               # 结构化场景数据
├── TestCases/test_design.json              # 测试用例设计（断言点标 needs-runtime-verify）
└── TestCases/scene_tc_mapping.json         # 场景-用例映射

后续阶段（契约校准、代码生成、验证、报告）需要代码 + 运行中的 SUT。
如需继续生成测试代码，请提供 `--sut-manifest` 后重新执行；legacy 单 target 可继续使用 code_path + `--sut-base-url`。
```

### 阶段4：黑盒测试代码生成与验证（多-Agent编排）

> 人工裁决：✅（4a完成后确认P0，4b完成后确认）
> **核心原则**：4a先行P0验证产出金标准 → 4b参考P0批量生成 → 生成 Python pytest + httpx 黑盒，复用 `reference/` 脚手架，打 SUT 对外端点。

```
步骤0: SUT 就绪门（编排器前景执行）
  → 执行: python {skill_dir}/scripts/sut_runtime.py \
            --manifest-normalized {output_dir}/RunMetadata/sut_manifest.normalized.json \
            --target-id {target_id} --action prepare --write
     （predeployed: readiness only；managed: 仅在人工确认后传 --allow-commands 执行 build/start）
  → 读取 sut_ready.json 的 reachable 字段（探活）
  → if reachable == false:
      → 该 target 用例标 env_issue（保留已生成代码，不执行、不误判用例）
      → 写 {target_output_dir}/TestRun/case_results.json（全部 env_issue + note: target 未就绪）
      → AskUserQuestion: "target {target_id} 在 {sut_base_url} 不可达。① 启动 target 后重跑阶段4 ② 仅生成代码不执行（该 target 全标 env_issue）"
      → 选②则跳到阶段5
  → reachable == true → 进入步骤1

步骤1: Python脚本（前景，<1s）
  → 执行: python {skill_dir}/scripts/select_p0.py --output-dir {target_output_dir} --p0-count {p0_count}
  → 输入: target-local TestCases/test_design.json + FeatureAnalysis/stage_summary.json + Contract/contract.md
  → 输出: TestCases/p0_selection.json + TestRun/validate_test.py
  → 验证: 两个文件均存在

步骤2: 4a P0深度验证（max 2并发，run_in_background=True）
  → 读取 p0_selection.json 的 p0_cases 数组
  → 对每个P0用例：
    模板: templates/stage4a_p0_verify.md
    参数: {case_id} {case_name} {steps} {expected} {target_id} {target_output_dir} {work_dir}
          {validate_script} {sut_base_url} {contract_path} {fault_ref} {fault_oracles}
    生成: Python pytest，import reference/http_client.py 的客户端 + 判据助手
          （断言形态以 contract.md 为准；harness_defect 走有界自我修复环，≤max-fix-attempts）
    执行: 设 SUT base-url + 轨迹目录环境变量后跑 pytest；若有 fault_ref，pytest 通过后运行 evaluate_fault_oracles.py --write
    输出: {target_output_dir}/TestRun/tests/test_{case_id}.py + TestRun/results/{case_id}.json（含 fault_oracle_summary）+ TestRun/trace/{case_id}.jsonl

步骤3: P0质量抽检（编排器轻量执行）
  → 对每个P0用例读取 TestRun/results/{case_id}.json（只读 status/error_class/trace_file/assert_level/fault_oracle_summary）
  → 抽检项：断言点有 contract.md 依据 | 轨迹文件存在(trace/{id}.jsonl) | 断言≥L2 | fault_ref 用例 required fault_oracles 已通过或已阻断 pass
  → 失败按执行边界分类判定，不靠改断言洗绿
  → 【人工裁决 ✅】确认P0用例质量

步骤4: 4b 批量生成（滑动窗口 max batch_size 并发，run_in_background=True）
  → 读取 p0_selection.json 的 remaining_cases 数组
  → 对每个剩余用例：
    模板: templates/stage4b_batch_gen.md
    参数: {case_id} {case_name} {steps} {expected} {target_id} {target_output_dir} {work_dir}
          {validate_script} {reference_case_file} {sut_base_url} {contract_path} {fault_ref} {fault_oracles}
  → 滑动窗口：完成1个立即补1个，并发池始终满载
  → 编排器只维护 running 字典（不累积agent输出内容）

步骤5: Python脚本（前景，<1s）
  → 执行: python {skill_dir}/scripts/aggregate_results.py --output-dir {target_output_dir}
  → 输入: TestRun/results/*.json
  → 输出: TestRun/case_results.json（每条含执行分类，fault_ref 用例保留 fault_oracle_summary / fault_oracle_results）
  → 验证: TestRun/case_results.json 存在
  → 【人工裁决 ✅】确认批量结果与分类
```

> **执行边界——修复 vs 忽略（stage4 验证强制分类）**：
> 断言源自 `contract.md`，**不洗绿**。失败/结果统一按下表分流，区分"该修的脚本问题"与"SUT 当前确实不满足"：
>
> | 分类 | 条件 | 处置 |
> |------|------|------|
> | `harness_defect` | 脚本自身问题（导入/语法/API 误用/形态访问错） | **自我修复**（有界修复环，≤ `--max-fix-attempts`） |
> | `sut_unsatisfied` | 脚本可跑通 + SUT 可达正常响应，但断言不达成（SUT 当前确实不满足：特性未实现/行为不同） | **忽略/skip**（标原因，记报告，不计失败） |
> | `sdk_defect` | SUT 报错/5xx/契约违例 且 contract 确认本应正确 | 记确认缺陷（进 stage5 缺陷清单） |
> | `env_issue` | 连接拒绝/超时/未就绪/依赖缺失 | 就绪门拦截，整批保留代码不误判 |
> | `requires_human_review` | fault_ref 用例的 required 过程/否定 oracle 缺失、unsupported 或 trace 不可观察 | 记录人工复核，不得写 pass |
> | `pass` | 非故障用例断言达成；或 fault_ref 用例断言达成且 required fault_oracles 全部通过 | 通过 |
>
> 关键区分：`harness_defect` 是测试侧错（**修脚本**，绝不弱化断言）；`sut_unsatisfied` 是被测当前确实不满足断言（**skip 标原因**，不是测试失败、也不一定是缺陷）；`sdk_defect` 是 contract 背书下的真实被测缺陷。任何分类都**不得通过删弱断言"洗绿"**。
> 对 `fault_ref` 用例，最终响应成功只能说明 pytest 断言暂时通过；`evaluate_fault_oracles.py` 必须基于 trace 再检查 required 过程/否定 oracle，失败或不可观察时覆盖 provisional pass。

> **Prompt大小限制（4a/4b强制）**：传递给子Agent的内容 <5KB。禁止传 test_design.json 全文 / requirement_analysis.md / s2_code_facts.json 全文；只传 case_id + name + steps + expected + 参考路径 + contract_path + sut_base_url + output_dir + work_dir。
> **交互轨迹一等公民**：生成的 pytest 通过 `reference/conftest.py` 的 autouse fixture 绑定 case 名，并在轨迹目录环境变量下逐用例落 `trace/{case}.jsonl`（请求/响应/事件逐帧），pytest 以 `-s -rA --log-cli-level=INFO` 把 `>>>` / `<<<` / `[event]` 行写进日志。stage5 报告含轨迹区；fault_ref 用例的 trace 还会被 fault oracle evaluator 读取。

### 阶段5：测试报告生成（子Agent执行）

> 人工裁决：❌（最终输出）

- 模板：`templates/stage5_report.md`
- 参数：`{skill_dir}` `{output_dir}`
- 输入：`case_results.json` + `contract.md` + `trace/*.jsonl`
- 验证：`report.md` 存在
- 报告须含：执行总结 | 执行边界分类分布 | Fault Oracle Coverage | 确认 SUT 缺陷清单（仅 sdk_defect）| SUT 不满足项清单（sut_unsatisfied，标原因）| 需求-实现形态差异（contract 偏差观察）| **交互轨迹区**（关键用例的 `>>>`/`<<<`/`[event]` 摘录 + trace 文件指引）

### 阶段6：fault analysis（默认门控；每个分析目标一个子Agent）

> 人工裁决：✅（强制确认门，仅 `--remediate=on`）| 条件：标准模式 + 默认 `--remediate=on` + remediation 配置就位 + 存在可分析失败/故障目标
> **定位**：对 `sdk_defect`、带 `fault_ref` 的失败/不满足项、故障库匹配出的诊断目标做 domain-aware 深析。
> Stage6 只产文件：`evidence.json`、`root_cause.md`、`fix_solution.md`、`issue.md`、`confidence.json`；
> 只有 spec-required 且可定位的 contract defect 额外产 `patch.diff` + `regression_test.diff`。
> **只读 + 产文件，无任何外发副作用**。故障库 / wiki 仅 advisory；`contract.md` 仍是唯一 oracle。
> **配置门**：进入 stage6 前先解析 manifest target 的 `remediation.config_path`、target-local `remediation.config.json`、显式 `--remediation-config` 或默认项目根 `remediation.config.json`。缺失/非法时记录清晰跳过原因并终止 stage6/7，不强行修复。

```
步骤1: 编排器前景执行 analysis plan（不启动 Agent）
  → python {skill_dir}/scripts/remediation_plan.py --output-dir {output_dir} [--max-defects {n}] [--max-analysis-targets {m}]
  → 产 FaultAnalysis/analysis_plan.json（所有分析目标）
  → 同时产 Remediation/plan.json（仅 patchable_contract_defect，供 stage7 apply/reverify 兼容）
  → 若 analysis_plan.targets 与 remediation.plan.defects 均为空 → 跳过 stage6/7

步骤2: 逐目标启动子Agent（run_in_background=True，≤ case-batch-size）
  → patchable=true：templates/stage6_defect_analyze.md
  → patchable=false：templates/stage6_fault_analyze.md
  → 产出 FaultAnalysis/targets/{target_id}/{root_cause.md,evidence.json,fix_solution.md,issue.md,confidence.json}
  → patchable 目标额外产出 Remediation/defects/{case_id}/{root_cause.md,evidence.json,fix_solution.md,patch.diff?,regression_test.diff?,issue.md,confidence.json}
  → 【Beta · --beta-wiki on】patchable 目标可继续用 beta 模板读取 wiki 作 advisory 叙事素材。

步骤3: 汇总 manifest（前景）
  → python {skill_dir}/scripts/remediation_plan.py --output-dir {output_dir} --finalize
  → FaultAnalysis/manifest.json + Remediation/manifest.json（后者仅 patchable 子集）

步骤4: 【强制人工确认门 ✅】（默认 --remediate=on；dry-run 不到门，直接到 stage7 复验为止）
  → 读 manifest 小摘要 → AskUserQuestion 展示每目标：
     target_id/case_id | domain | analysis_type | files_touched | +adds/-dels | confidence | issue_title
  → 选项：
     {"label":"确认提交 issue","description":"stage7 将 clone→应用补丁→构建→重启SUT→重跑失败用例→生成实证证据→只提交 upstream evidence issue"}
     {"label":"仅本地复验(dry-run)","description":"执行 clone/apply/build/复验产证据，但不提交 issue"}
     {"label":"取消","description":"保留 stage6 产物，不做任何外发动作"}
  → **任何 gh issue 调用必须在本门返回'确认提交 issue'之后；不再执行 git push / PR 创建**
```

### 阶段7：应用 + 构建 + 复验 + evidence issue（默认门控，纯脚本）

> 人工裁决：❌（动作已在 stage6 门确认）| 条件：经 stage6 门确认（或 `--remediate=dry-run` 自动执行到复验为止）
> **不自我认证**：绿/红由脚本**重跑未改动用例 + 重建后 SUT** 判定，非 LLM；`require_evidence_before_issue` 恒 true（兼容旧 `require_green_before_pr`）。

```
步骤1: 应用 + 本地重建 + 复验（dry-run 与 on 均执行）
  → python {skill_dir}/scripts/apply_and_reverify.py --output-dir {output_dir} [--remediation-config {path}]
  → clone@ref → 建本地验证分支 → git apply（路径白名单：仅 business/selftest 根）→ build_cmd
     → stop/restart SUT + 就绪轮询 → 重跑失败的 test_<case>.py（BASE_URL=重建SUT）+ selftest_cmd
  → Remediation/reverify.json（remediated[] / still_red[]，before红/after绿 证据）
  → 任一构建失败 / 仍红 / 补丁拒绝 → 落 reverify.json、issue 如实呈现实证状态、不抛栈

步骤2: evidence issue 提交（仅 --remediate=on 且门确认；dry-run/取消 → 零 gh 调用）
  → python {skill_dir}/scripts/submit_remediation.py --output-dir {output_dir} --remediate {on|dry-run} [--gate-confirmed]
  → 守卫：remediate=on + gate-confirmed + switches.allow_open_issue + require_evidence_before_issue → 才动作
  → 先生成 Remediation/issue_bodies/{case}.md（stage6 issue + root_cause + fix_solution + 定位过程 + patch 摘要 + reverify 实证；dry-run 也生成）
  → gh issue create (upstream, --body-file issue_bodies/{case}.md)；幂等：先 list 去重复用 URL
  → Remediation/submitted.json（issues / skipped；无 pr 字段）

（auto-remediation 结束；流水线终止）
```

---

## Beta（预研特性，默认关闭）

> Beta 是 AutoTestFlow 的**预研暂存区**：代码物理隔离在 `beta/` 子树，由开关显式开启；**默认关闭时流水线与稳定版字节级一致**。
> Beta 特性**不得违反** `DESIGN.md` §1–§7 与 `shared/rules.md` §4；只能在不变量之上做**增强**。详见 `beta/README.md`。

### v1.0：故障库接入 LLM Wiki（`--beta-wiki`，Phase A）

依据 `FaultsAnalysis/07-LLM_Wiki与故障库知识源分析.md` §九 Phase A：由结构化故障库**单向派生**仓内 NL 文章
（默认 `TestKnowledgeBase/Fault/wiki/*.md`），供 stage2.6b / stage6 的 LLM 子 Agent 按 `fault_id` 确定性取用，
作 **advisory 建议层**——**不作 oracle、不进 `match_faults.py`、断言级别仍由 `contract.md` 封顶**。

```
--beta-wiki off（默认）
  → 不跑 gen_wiki、不读 wiki；stage2.6b/stage6 用稳定模板 → 与 v2.x 字节级一致（优雅降级）。

--beta-wiki on
  步骤A（编排器前景，纯脚本）: python {skill_dir}/beta/scripts/gen_wiki.py [--fault-lib ..][--fault-overlay ..]
      → 由 JSON 单向派生 TestKnowledgeBase/Fault/wiki/{fault_id}.md(+category/index)；幂等、缺库优雅退出。
  步骤B（可选校验）: python {skill_dir}/beta/scripts/check_wiki.py
      → 护栏校验（覆盖/溯源/不漂移/不越权/非matcher）→ QualityGates/wiki_check.json；不绿则不应启用 wiki。
  步骤C（模板切换）:
      stage2.6b → beta/templates/stage2_6_fault_match.beta.md（传 wiki_dir；读 wiki/{fault_id}.md 辅助绑定）
      stage6    → beta/templates/stage6_defect_analyze.beta.md（传 wiki_dir；fault_ref 命中读 wiki/{fault_ref}.md 丰富 issue）
```

**红线**：wiki 仅 advisory；判据唯一来自 `contract.md`；wiki 与 contract 冲突一律以 contract 为准；
确定性脚本（match_faults/record_faults）永不读 wiki。离线 demo：`beta/examples/a2a/wiki_demo/`。

---

## 输出文件（标准模式）

```
{output_dir}/
├── RunMetadata/
│   ├── sut_description.parse.json   # 阶段0 自然语言解析结果 ★
│   ├── sut_description.review.md    # 阶段0 人工确认摘要 ★
│   └── sut_manifest.normalized.json # 阶段0 manifest 归一化 ★
├── FeatureAnalysis/
│   └── requirement_analysis.md      # 阶段1 root 摘要（如适用）
├── Reports/
│   └── report.md                    # root 聚合报告（全部 target 摘要）
├── targets/
│   └── {target_id}/
│       ├── FeatureAnalysis/
│       │   ├── code_scan_plan.json
│       │   ├── code_analysis.md
│       │   ├── s1_index.json
│       │   ├── s1_scenarios/
│       │   ├── s1_scenario_examples.md
│       │   ├── s2_code_facts.json
│       │   ├── stage_summary.json
│       │   ├── framework_scenes.json
│       │   ├── s3a_enriched/
│       │   ├── s3a_framework.json
│       │   ├── s3a_enriched_index.json
│       │   └── s3a_scenario_landscape.md
│       ├── Contract/
│       │   ├── contract.md        # target 阶段2.5（真实契约，权威 Oracle）★
│       │   ├── contract_samples.json
│       │   └── sut_ready.json
│       ├── KnowledgeBase/
│       │   ├── knowledge_matches.json
│       │   ├── fault_matches.json
│       │   ├── fault_contract_alignment.md
│       │   └── new_knowledge_candidates.json
│       ├── QualityGates/
│       │   ├── professional_acceptance.seed.json
│       │   ├── professional_acceptance.code_gaps.json
│       │   ├── professional_case_guidance.json
│       │   ├── professional_acceptance.json
│       │   └── ai_eval_readiness.json
│       ├── TestCases/
│       │   ├── test_design.json
│       │   ├── test_examples.md
│       │   ├── scene_tc_mapping.json
│       │   └── e2e_scenes.json
│       ├── TestRun/
│       │   ├── tests/test_{case_id}.py
│       │   ├── results/{case_id}.json # 含 fault_oracle_summary（fault_ref 用例）
│       │   ├── trace/{case_id}.jsonl
│       │   └── case_results.json
│       ├── Reports/
│       │   └── report.md
│       ├── FaultAnalysis/
│       │   ├── analysis_plan.json
│       │   ├── manifest.json
│       │   └── targets/{target_id}/
│       └── Remediation/
│           ├── plan.json
│           ├── manifest.json
│           ├── defects/{case_id}/
│           ├── reverify.json
│           ├── issue_bodies/{case_id}.md
│           └── submitted.json
```

---

## 文件结构

```
AutoTestFlow/
├── SKILL.md                              # 主入口（编排器调度表）
├── README.md                             # 通用介绍 + 安装 + 调用
├── DESIGN.md                             # 通用设计原则
├── scripts/
│   ├── prepare_code_scan.py              # 阶段2 profile adapter 预扫描计划 ★
│   ├── sut_manifest.py                   # 阶段0 自然语言 SUT 描述解析 / YAML manifest 兼容 / legacy 单 target 归一化 ★
│   ├── sut_runtime.py                    # target readiness + managed runtime command guard ★
│   ├── probe_contract.py                 # 阶段2.5 契约校准探针（探活+采样真实响应）★
│   ├── merge_enriched.py                 # 阶段3a 场景合并
│   ├── merge_test_design.py              # 阶段3b 用例合并
│   ├── render_design_markdown.py         # 阶段1/3 JSON → LLM可读Markdown投影 ★
│   ├── select_p0.py                      # 阶段4-prep P0筛选+门禁脚本生成
│   ├── evaluate_fault_oracles.py         # 阶段4 fault_ref trace/process/negative oracle 门禁 ★
│   ├── aggregate_results.py              # 阶段4-agg 结果聚合（执行分类 + fault oracle coverage）
│   ├── remediation_plan.py               # 阶段6 fault analysis plan/manifest + remediation 子集 ★
│   ├── apply_and_reverify.py             # 阶段7 应用补丁+本地重建+复验（绿门）★
│   └── submit_remediation.py             # 阶段7 提交 evidence issue（issue-only,门控,幂等）★
├── shared/
│   ├── scenario_schema.md                # 场景JSON schema
│   ├── code_analysis_template.md         # 代码分析输出格式（阶段2）
│   ├── rules.md                          # 断言层级/截断优先级/执行边界规则
│   ├── code_scan_guide.md                # 通用代码扫描指引
│   ├── code_scan_profiles.json           # Java/Python/C++/generic profile catalog
│   ├── java_scan_guide.md                # Java/Spring profile 附录
│   ├── remediation_rules.md              # fault-analysis / auto-remediation 安全纪律（v2.1）★
│   ├── remediation_config_schema.md      # 修复配置文件 schema（v2.1）★
│   └── fault_analysis_profiles.json      # 阶段6 可扩展 domain/profile 映射 ★
├── reference/
│   ├── http_client.py                    # 通用黑盒 HTTP 客户端 + 交互记录器 ★
│   ├── conftest.py                       # pytest fixtures + 轨迹日志
│   ├── client_reference.md               # 黑盒客户端方法表与判据约定
│   └── remediation_config.py             # 修复配置 加载/校验（三脚本共用,auto-remediation）★
├── examples/
│   └── a2a/                              # A2A/agent-runtime 示例锚点（客户端专化 + 参考资产）
└── templates/
    ├── stage1_req_analyze.md
    ├── stage2_code_scan.md
    ├── stage2_5_contract_calibrate.md    # 阶段2.5 契约校准 子Agent Prompt ★
    ├── stage2R_req_summary.md
    ├── stage3a_gap.md
    ├── stage3a_framework.md
    ├── stage3aR_framework.md
    ├── stage3b_batch_design.md
    ├── stage4a_p0_verify.md
    ├── stage4b_batch_gen.md
    ├── stage5_report.md
    ├── stage6_defect_analyze.md          # 阶段6 patchable contract defect 子Agent ★
    └── stage6_fault_analyze.md           # 阶段6 domain-aware 通用故障分析子Agent ★
```

---

## 关键检查项（各阶段详细验证已内嵌于对应子Agent模板中）

- 阶段1：禁止查看代码 | FP三原则（单入口/单行为/可验证）| cross分支≤5 | FP清单 + flow_scenarios含steps和6类分支 | **完成后强制人工裁决**
- 阶段2：code_scan_plan.json 含 primary_profile/language/frameworks/confidence | s2_code_facts.json 含对外入口/序列化形态/profile meta + stage_summary.json含module_role | 入口仅编录对外API | 无内部组件
- 阶段2.5：contract_samples.json 由 probe 真实采样（reachable 标记）| contract.md 含响应包装/字段/枚举/错误码/事件形态 | 每项标 spec-required vs deployment-config-dependent | 不可达则全标 needs-runtime-verify（probe exit 0 不崩溃）
- 阶段2R：stage_summary.json 含 `mode: "requirement_only"` + `module_role: "独立功能"` + `cd_list: []`
- 阶段3a：2-Agent并行（gap∥fw）| S1场景直接复制 | GAP从code_only生成 | 框架场景强制覆盖
- 阶段3aR：S1场景直接复用 | 仅框架场景补充 | 无去重/GAP
- 阶段3b：小文件模式（禁止读取大JSON）| 断言点须落在 contract.md 真实形态上，未覆盖标 needs-runtime-verify | fault_ref 用例必须带 required fault_oracles | 截断优先级规则 | 步骤无技术术语 | 预期结果≥2维度 | **merge 后强制人工裁决**
- 阶段4a：SUT 就绪门通过 | 复用 reference/http_client.py 判据助手 | 断言形态以 contract.md 为准 | 轨迹文件 trace/{id}.jsonl 生成 | 断言≥L2 | fault_ref 用例运行 evaluate_fault_oracles.py | 失败按执行边界分类
- 阶段4b：参考P0范例 | 分类落地(harness_defect/sut_unsatisfied/sdk_defect/env_issue/requires_human_review/pass) | harness_defect 走有界修复环，不改断言洗绿 | fault_ref 用例不得仅因最终响应成功 pass | 门禁验证通过 | 轨迹落盘
- 阶段5：report.md 含执行分类分布 + Fault Oracle Coverage + 确认SUT缺陷清单(仅sdk_defect) + SUT不满足项(sut_unsatisfied) + 需求-实现形态差异 + 交互轨迹区
- 阶段6（默认门控）：默认 `--remediate=on`，配置就位且有可分析目标才触发；缺少/非法 remediation 配置则记录原因并跳过 stage6/7；`FaultAnalysis/analysis_plan.json` 覆盖 patchable/issue-only/diagnostic 目标，`Remediation/plan.json` 仅含 patchable contract defect | 每目标产 evidence/root_cause/fix_solution/issue/confidence，只有 spec-required+可定位目标产 patch/selftest | manifest 就绪后 **强制人工确认门** | 定位不到→needs_human、仅记 evidence issue 不强行 patch | **不弱化测试/不改 contract.md**
- 阶段7（默认门控）：绿由 `apply_and_reverify.py` 重跑未改动用例+重建SUT 判定（非LLM）| 构建失败/仍红→写入 reverify 证据、不抛栈 | 提交仅 `on`+过门+`switches.allow_open_issue`+实证前提 | 只创建 upstream evidence issue，幂等去重；不推送 fork、不创建 PR | dry-run/取消→零 gh 调用 | clone仓与轨迹 gitignore
