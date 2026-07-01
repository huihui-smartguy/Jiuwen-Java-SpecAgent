# AutoTestFlow · 需求驱动的测试智能体

> 本目录是一个 **Claude Code Skill**：从需求文档出发，对一个**对外协议可观测的源码型被测系统（SUT）**
> 生成测试。当前以**场景化测试**实现（flow/framework/quality），**DFX 测试（性能/可靠性/安全/兼容性等）并行规划中**。
> 标准模式下 stage4 产出 **Python pytest + httpx 黑盒**用例（跨栈黑盒，不依赖被测内部类）。

---

## 默认全链路命令（推荐）

```bash
/auto-test-flow requirements.md --sut-manifest autotestflow.suts.md --remediation-config remediation.config.json --faults on --fault-enrich on --remediate on
```

运行前只需按项目实际情况修改 `requirements.md`、自然语言 `autotestflow.suts.md` 和 `remediation.config.json`。该命令默认接入 `TestKnowledgeBase/registry.json`、启用故障库 LLM 增强，并在报告后进入门控式 fault analysis / remediation；外发 evidence issue 仍必须经过人工确认门和 `switches.allow_open_issue=true`。

---

## 1. 这是什么

| 维度 | 说明 |
|------|------|
| **定位** | 需求驱动的测试智能体，按"测试维度"抽象 |
| **测试维度** | `scenario`（场景化，**已实现**）+ `dfx`（性能/可靠性/安全/兼容性等，**规划中、并行轨道**） |
| **输入** | 需求文档 + 自然语言 SUT 描述（兼容 legacy Markdown+YAML manifest，支持一个或多个 target）+ 默认 TestKnowledgeBase + remediation 配置（门控修复） |
| **输出** | 每个 target 的校准契约 + 测试场景 + 测试设计 + Python 黑盒用例 + target 报告，以及根级汇总报告 |
| **被测对象** | Java/Spring、Python Web/API、C++ service/RPC 或未知源码树的 SUT target。每个 target 的协议/端点/响应契约真实形态以 target-local `contract.md` 为准 |
| **测试栈** | stage4 生成 Python `pytest` + `httpx` 黑盒用例，只经对外协议观测 |

> 通用性边界：场景/设计/契约校准/执行流程与具体协议无关；黑盒脚手架 `reference/http_client.py`
> 在 stage2.5 校准后按真实 `contract.md` 专化为具体协议形态。A2A/agent-runtime 仅作**示例**，见 `examples/a2a/`。

> **无需 step1 预生成依赖**：脚手架内置于 `reference/`、判据形态由 stage2.5 契约校准产 `contract.md`、框架场景由 stage2 从代码结构自动派生（纯需求模式由 stage3aR 从需求侧派生）。

---

## 2. 测试维度

| 维度 | 状态 | 说明 |
|------|------|------|
| `scenario` | **已实现** | flow（流程驱动）+ framework（框架组合）+ quality（质量保障），完整编排到可执行用例 + 报告 |
| `dfx` | **规划中（并行轨道）** | 非功能维度；当前为 `design_only` 占位，仅产出设计骨架，与 `scenario` 共享同一编排/契约校准/执行边界纪律 |

---

## 3. 目录结构

```
AutoTestFlow/                       # Skill 本体
├── SKILL.md                        # 编排器调度表（主入口）
├── README.md                       # 本文件（入口）
├── DESIGN.md                       # 通用设计原则
├── shared/
│   ├── rules.md                    # 跨阶段纪律（断言分级/判据来源/执行边界/就绪门）
│   ├── code_scan_guide.md          # stage2 通用代码扫描指南
│   ├── code_scan_profiles.json     # Java/Python/C++/generic profile catalog
│   ├── java_scan_guide.md          # Java/Spring profile 附录
│   ├── code_analysis_template.md   # stage2 输出模板
│   ├── scenario_schema.md          # 场景 JSON schema
│   └── sut_manifest_schema.md      # 自然语言 SUT 描述 + canonical manifest schema
├── reference/                      # 通用黑盒复用资产（按 contract.md 专化）
│   ├── http_client.py              # 通用黑盒 HTTP 客户端 + 交互记录器
│   ├── conftest.py                 # pytest fixtures + 轨迹日志
│   └── client_reference.md         # 客户端方法表与判据约定
├── examples/
│   ├── a2a/                        # A2A 示例锚点（客户端专化 + 参考资产）
│   └── multi_sut/                  # 多 SUT 示例
├── scripts/                        # 确定性脚本（scan-prep / probe / match / merge / select / aggregate / record）
│   ├── prepare_code_scan.py        # stage2 profile adapter 预扫描计划
│   ├── sut_manifest.py             # 自然语言 SUT 描述解析 / YAML manifest 兼容 / legacy 单 SUT 归一化
│   ├── sut_runtime.py              # target readiness + managed runtime command guard
│   ├── probe_contract.py           # stage2.5 target 探活校准 → target-local contract.md
│   ├── knowledge_base.py           # TestKnowledgeBase registry/glob adapter
│   ├── match_faults.py             # stage2.6 知识/故障匹配（contract 优先封顶）→ knowledge_matches.json + fault_matches.json
│   ├── professional_acceptance.py  # Professional_experience advisory gates → professional/AI readiness artifacts
│   ├── merge_enriched.py
│   ├── merge_test_design.py
│   ├── select_p0.py
│   ├── evaluate_fault_oracles.py   # stage4 子步：fault_ref 用例 trace/process/negative oracle 门禁
│   ├── aggregate_results.py
│   └── record_faults.py            # stage5 子步：sdk_defect 闭环自积累（默认 overlay/dry-run）
└── templates/                      # 各阶段子 Agent Prompt
```

---

## 4. 安装

把 `AutoTestFlow/`（含 `SKILL.md`）放入 skills 目录之一：

```bash
# 用户级（全局可用）
cp -r AutoTestFlow ~/.claude/skills/

# 或项目级（随仓库）
cp -r AutoTestFlow <你的项目>/.claude/skills/
```

安装后 Claude Code 即可识别 `/auto-test-flow` 触发词（亦可用"需求测试分析""需求驱动测试""自动化测试编排"）。

---

## 5. 调用示例

```bash
/auto-test-flow requirements.md --sut-manifest autotestflow.suts.md --remediation-config remediation.config.json --faults on --fault-enrich on --remediate on
```

兼容的最小标准调用仍可使用：

```bash
/auto-test-flow 需求.md --sut-manifest autotestflow.suts.md
```

| 参数 | 说明 |
|------|------|
| `需求.md` | 需求文档路径（必填） |
| `--sut-manifest` | 自然语言 SUT 描述（标准模式主入口；可写 target、URL/IP/端口、环境变量、依赖、源码路径、运行方式；兼容 legacy Markdown+YAML manifest） |
| `--sut-base-url` | **Deprecated compatibility only**：兼容旧单 target 调用；内部归一化为 `target_id=default` 的 manifest |
| `--knowledge-root` | TestKnowledgeBase 根目录，供 stage2.6 registry/glob discovery 使用（默认仓内 `TestKnowledgeBase`） |
| `--knowledge-domain` | 知识域过滤：`all` / `rest_api` / `web` / `agent` / `dfx`，或逗号分隔 package_id |
| `--fault-lib` | 显式故障库路径，仅用于旧 demo 或临时单文件调试；默认不再自动回退 `Specification_Repository` |
| `--fault-overlay` | 项目级故障库 overlay（覆盖 / 禁用 / 项目特有故障） |
| `--faults` | 故障库启用模式：`on`（默认，读取默认 TestKnowledgeBase）/ `auto` / `off` |
| `--fault-enrich` | stage2.6b LLM 增强（模糊绑定 / 占位替换 / contract_conflict 检出）：`on`（默认）/ `off` / `auto` |
| `--remediate` | fault analysis / 自动修复总开关：`on`（默认，门控执行）/ `dry-run` / `off` |
| `--remediation-config` | 修复配置文件路径；默认命令使用项目根 `remediation.config.json` |

> 不提供代码路径/PR/commit 时进入**纯需求模式**（1→2R→3aR→3b），只产出测试设计文档。
> 完整参数（`--output-dir` / `--case-batch-size` / `--p0-count` / `--pr` / `--commit` 等）以 `SKILL.md`《参数》为准；此处仅列常用项。
> 故障库（规格库）的详细用法见下文 **§7 故障库（规格库）使用**。

`autotestflow.suts.md` 推荐用自然语言编写，例如：

```markdown
[Catalog API]
ip: 127.0.0.1
port: 8081
Accessible directly

[Checkout API]
Source path: services/checkout
URL: http://localhost:8082/actuator/health
Requires creation in conjunction with Catalog API
Build: mvn -q -DskipTests package
Start: java -jar target/checkout.jar --server.port=8082
Environment variables: CHECKOUT_TOKEN=<provided at runtime>
```

AutoTestFlow 会在 stage0 生成 `RunMetadata/sut_description.parse.json`、`RunMetadata/sut_description.review.md`
和 `RunMetadata/sut_manifest.normalized.json`。推断出 managed build/start 命令、低置信或缺字段时会先进入人工确认；legacy YAML manifest 继续兼容。示例见 [`examples/multi_sut/sut-manifest.md`](examples/multi_sut/sut-manifest.md)，schema 见
[`shared/sut_manifest_schema.md`](shared/sut_manifest_schema.md)。每个 target 会被归一化到
`<output_dir>/targets/<target_id>/`，并拥有独立的 `Contract/contract.md`、`TestCases/`、`TestRun/`
和 `Reports/report.md`，根级 `Reports/report.md` 只做聚合。

直接可访问但没有源码的 target 会标记为 `source.available=false`：跳过源码扫描/code-only GAP，
但仍在可达时执行 stage2.5 契约探测和后续黑盒测试。

---

## 6. 端到端流程

```
需求.md + SUT 描述 + TestKnowledgeBase + remediation.config.json
   │
   ├─ stage0   自然语言 SUT 描述解析 → parse/review/normalized manifest（必要时人工确认）
   ├─ stage1   需求侧场景分析（flow/framework/quality）        ← 人工裁决 ✅（FP 拆分/场景边界把关）
   ├─ target loop（每个 targets/<target_id>/ 独立执行）
   │  ├─ stage2   通用代码扫描 → code_scan_plan.json + code_analysis.md（profile adapter）
   │  ├─ stage2.5 契约校准：probe_contract.py --target-id → target-local contract.md ← 判据权威性闸
   │  ├─ stage2.6 TestKnowledgeBase 匹配（默认）：registry/glob discovery + target contract 封顶
   │            └─ 2.6b（默认按需）LLM 增强：模糊绑定 / 占位替换 / contract_conflict
   │  ├─ stage2.P Professional_experience（advisory）：professional_acceptance.py → seed/code_gaps/case_guidance
   │  ├─ stage3a  场景富化（GAP + 框架补充）
   │  ├─ stage3b  测试用例设计（断言按 target contract.md） ← 人工裁决 ✅
   │  ├─ stage4   target 就绪门 → 生成 Python pytest+httpx 用例 → 执行 + 采集交互轨迹
   │            └─ fault_ref 用例追加 fault oracle 门禁：pytest 通过后仍需过程/否定 oracle 通过
   │            └─ 执行边界分类：harness_defect / sut_unsatisfied / sdk_defect / env_issue / requires_human_review / pass
   │  └─ stage5   target 报告 + record_faults.py 闭环
   ├─ stage6   fault analysis / 修复方案 / evidence issue 草稿（默认门控，需配置）
   ├─ stage7   本地应用 + 构建 + 复验 + evidence issue（仅人工确认 + allow_open_issue 后外发）
   └─ root report 聚合全部 target 的覆盖、风险、env_issue 与缺陷摘要
```

`校准 → 设计 → 生成 → 就绪门 → 执行+轨迹 → 报告`：判据先校准、再设计断言；执行前先探活；
失败严格按执行边界分类——脚本问题自我修复，SUT 当前确实不满足则 skip 标原因，绝不洗绿。带 `fault_ref` 的故障库用例是缺陷探针，最终 E2E 响应成功后仍必须通过 required `fault_oracles`（过程/否定/结果 oracle），否则归为 `sdk_defect` / `sut_unsatisfied` / `requires_human_review`，不得写 pass。

---

## 7. 故障库（规格库）使用

> **是什么**：TestKnowledgeBase 是 AutoTestFlow 的外部可插拔测试知识源，覆盖 REST/API、Web、Agent、DFX 与专业验收经验。后续迭代以 `TestKnowledgeBase/registry.json` + `TestKnowledgeBase/Fault/*.json` 为知识库主干；`Specification_Repository/` 不再承担实际产品迭代职责，仅作为显式旧 demo 输入。流水线判据（Oracle）来自"需求 + 真实契约"，能保证"形态正确、流程跑通"，但缺少"**应该测哪些失败模式**"。TestKnowledgeBase 正是补这块——经 registry/package 注入，**不硬编码**进 Skill 提示词。

### 7.1 默认即启用（零配置）

标准模式下 `--faults on`（默认）会读取 `TestKnowledgeBase/registry.json`；如果 registry 暂不可用，则读取 `TestKnowledgeBase/Fault/*.json`。AutoTestFlow 不再自动回退 `Specification_Repository`。匹配阶段会按 package/domain/category metadata、场景域、标签、历史缺陷、关联字段、流式信号等规则把知识条目匹配进流水线，并用 `contract.md` 的字段权威性分级对每条故障的断言级别做**契约优先封顶**（spec-required→至多 L2；config-dependent/契约静默/未知→降 L0/L1）。

**显式关闭 / 降级**：`--faults off` / 无 `contract.md`（纯需求模式）→ **不产出任何故障匹配文件**，流水线与未接入知识库时**字节级一致**。单独运行确定性脚本时仍可使用 `--faults auto` 做宽松 smoke。

### 7.2 启用 / 覆盖 / 增强

| 诉求 | 做法 |
|------|------|
| 默认启用 | 标准调用即可（优先读取 `TestKnowledgeBase/registry.json`，无 registry 时扫描 `TestKnowledgeBase/Fault/*.json`） |
| 知识域过滤 | `--knowledge-domain rest_api` / `--knowledge-domain agent,dfx` |
| 显式指定库 | `--fault-lib <path> --faults on`（旧 demo / 单文件调试） |
| 关闭 | `--faults off`（与未接入完全一致） |
| 项目专化 | 在 `TestKnowledgeBase/Fault/project_faults.json` 或被测项目 `fault_library/project_faults.json` 维护 overlay，用 `--fault-overlay <path>` 注入（覆盖 / 禁用 / 项目特有故障 / 参数占位替换） |
| LLM 增强 | `--fault-enrich on`（默认）开 stage2.6b：把自由文本判据**模糊绑定**到契约 specId、替换 overlay 残留 `{占位符}`、检出 `contract_conflict` |

```bash
# 默认（读取 TestKnowledgeBase registry/glob，并启用 LLM 增强）
/auto-test-flow 需求.md --sut-manifest autotestflow.suts.md --faults on --fault-enrich on

# 指定知识域 + 项目 overlay + LLM 增强
/auto-test-flow 需求.md --sut-manifest autotestflow.suts.md \
    --knowledge-domain rest_api,dfx \
    --fault-overlay <proj>/fault_library/project_faults.json --fault-enrich on

# 关闭
/auto-test-flow 需求.md --sut-manifest autotestflow.suts.md --faults off
```

### 7.3 闭环自积累

stage5 子步 `record_faults.py` 把执行中**契约背书的真实违例**（仅 `class==sdk_defect`）蒸馏为 `history_faults`，去重后默认写**项目 overlay**（不污染全局精选库），默认 dry-run（`--write` 才落库）：

```bash
python AutoTestFlow/scripts/record_faults.py --output-dir <output_dir> \
    --overlay-path <proj>/fault_library/project_faults.json --write
```

安全收敛：绝不收 `sut_unsatisfied / harness_defect / env_issue`（避免把非缺陷沉淀成"历史缺陷"）。overlay→全局的晋升（人工评审 + PR）进入 `TestKnowledgeBase/Fault/`；`Specification_Repository` 不再作为后续晋升目标。

### 7.4 fault_ref 用例的过程/否定 oracle

TestKnowledgeBase 生成的 `fault_ref` 用例不能只验证"最终返回成功/失败"。阶段2.6 会为每条命中补齐 `fault_oracles`，阶段3b 必须原样写入 `TestCases/test_design.json`，且至少包含 1 条 required 的 `process` 或 `negative` oracle。阶段4 在 pytest 通过后运行 `scripts/evaluate_fault_oracles.py` 读取 `TestRun/trace/<case>.jsonl`，检查 `no_unexpected_5xx`、`no_unexpected_error_frame`、`correlation_id_preserved`、`sse_terminal_state`、`no_duplicate_terminal_event`、`resource_not_created`、`state_not_mutated`、`retry_or_timeout_observed` 等黑盒可观察项。

只有 `fault_oracle_summary.classification=="passed"` 时，故障导向用例才能保持 `status=passed`。如果最终响应看似成功但中间 trace 暴露 5xx、error frame、重复终态事件、id 未回带或状态副作用，结果会转为 `sdk_defect` / `sut_unsatisfied`；无法机器观察的 required oracle 会转为 `requires_human_review`，而不是静默通过。

### 7.5 对人工裁决门的影响（保守降级）

`fault_matches.json` 存在时，**仅 stage3b 门的"异常/边界/质量覆盖完备性"维度由故障库背书自动通过**（展示故障覆盖摘要）；**stage1 门**与 **stage3b 的"FP 拆分映射 / 断言合理性"维度仍强制人工**（故障库不覆盖这些判据）。

### 7.6 产物与可复现 demo

| 产物 | 说明 |
|------|------|
| `targets/<target_id>/KnowledgeBase/knowledge_matches.json` | TestKnowledgeBase 主产物（匹配 + 契约调和 + 配额） |
| `targets/<target_id>/KnowledgeBase/fault_matches.json` | 兼容产物，供 target-local stage3b/stage5 读取 |
| `targets/<target_id>/KnowledgeBase/fault_contract_alignment.md` | 故障-契约对齐报告 |
| `targets/<target_id>/TestRun/results/<case_id>.json` 中的 `fault_oracle_summary` | `fault_ref` 用例的过程/否定 oracle 门禁结果 |
| `targets/<target_id>/KnowledgeBase/new_knowledge_candidates.json` | 本轮闭环候选（dry-run 输出） |
| `targets/<target_id>/KnowledgeBase/new_faults_detected.json` | 兼容候选输出 |
| `targets/<target_id>/QualityGates/professional_acceptance.seed.json` | Phase C：测试计划和需求可测性种子 |
| `targets/<target_id>/QualityGates/professional_acceptance.code_gaps.json` | Phase C：代码/可观测性/依赖证据缺口 |
| `targets/<target_id>/QualityGates/professional_case_guidance.json` | Phase B：stage3b 用例设计指导与 `acceptance_refs` |
| `targets/<target_id>/QualityGates/professional_acceptance.json` | Phase A：stage5 专业验收和发布门禁矩阵 |
| `targets/<target_id>/QualityGates/ai_eval_readiness.json` | Phase D：AI/Agent eval、grader、redteam、tool-call、监控就绪度 |
| 用例字段 `fault_ref` | 故障导向用例的溯源标记 |
| 用例字段 `fault_oracles` | 故障导向用例的 required 过程/否定/结果 oracle |

### 7.7 Professional_experience advisory gates

`Professional_experience` 不参与 fault matching，也不生成强断言。它通过 `professional_acceptance.py` 生成 advisory artifacts，服务于测试计划、用例设计、执行证据、AI/Agent readiness 和 stage5 报告：

```bash
python AutoTestFlow/scripts/professional_acceptance.py \
    --output-dir <output_dir> \
    --knowledge-root TestKnowledgeBase \
    --mode all
```

所有输出只产生 `pass / warn / fail / not_applicable / requires_human_review` 门禁结论；任何 L2 断言仍必须引用 `contract.md`。

**无需 SUT 即可复现**（确定性脚本）：见 [`examples/a2a/fault_demo/README.md`](examples/a2a/fault_demo/README.md)，含 match / aggregate / record 与 `--faults off` 降级回归的完整命令与 golden。

**延伸阅读**：故障库结构 / overlay / 治理见 [`TestKnowledgeBase/README.md`](../TestKnowledgeBase/README.md) 与 [`TestKnowledgeBase/TRANSFORMATION_SCOPE.md`](../TestKnowledgeBase/TRANSFORMATION_SCOPE.md)；特性总览见 [`ChangeLogs/v1.0-引入规格库与故障库.md`](../ChangeLogs/v1.0-引入规格库与故障库.md)；设计与论证见 [`FaultsAnalysis/`](../FaultsAnalysis/)。

---

## 8. Fault Analysis + 自动修复（v2.1）

> **是什么**：报告（stage5）之后，对 `sdk_defect`、带 `fault_ref` 的失败/不满足项、故障库匹配出的高价值目标做
> **domain-aware fault analysis**。Stage6 产根因、证据、修复方案和 issue 草稿；只有 spec-required 且可定位的
> contract defect 才额外产业务补丁和回归自测。Stage7 负责本地应用/构建/复验，并且**只提交 upstream evidence issue**；
> 自动 PR 提交已移除。
> **默认开启但全程门控、不自我认证**：默认命令使用 `--remediate on`。缺少 `remediation.config.json`、无可分析目标或配置不合法时跳过 stage6/7 并给出说明；任何 evidence issue 外发仍必须经过人工确认门与 `switches.allow_open_issue=true`。

### 8.1 开关与配置

| 参数 | 说明 |
|------|------|
| `--remediate` | `on`（默认，经**强制人工确认门**后才可提交 evidence issue；不再提交 PR）/ `dry-run`（分析 + 本地复验，**不**提交 issue）/ `off`（显式关闭） |
| `--remediation-config` | 修复配置文件路径，默认命令使用 `remediation.config.json`；缺失时跳过 stage6/7 |
| `--remediation-max-defects` | 单轮最多处理的 patchable contract defect 数（默认 5） |

配置用 JSON 声明**被测对象 + 代码仓**：`sut.base_url`、`repo.{upstream_url,ref,clone_path,local_branch_prefix,business_code_roots,selftest_roots}`、`build.{build_cmd,selftest_cmd}`、`run.{restart_cmd,readiness_probe}`、`issue`/`switches`。多 SUT 模式优先读取 manifest target 的 `remediation.config_path` 或 `targets/<target_id>/remediation.config.json`；全局 `--remediation-config` 仅用于 legacy 单 target 运行。复制模板 `examples/remediation.config.example.json`（spring-ai-ascend），schema 见 `shared/remediation_config_schema.md`。

```bash
/auto-test-flow requirements.md --sut-manifest autotestflow.suts.md --remediation-config remediation.config.json --faults on --fault-enrich on --remediate on
```

### 8.2 阶段（stage5 之后，默认门控）

- **stage6 fault analysis**（只读，每目标一个子 Agent）：产 `evidence.json` + `root_cause.md` + `fix_solution.md` + `issue.md` + `confidence.json`；patchable 目标额外产 `patch.diff` + `regression_test.diff`。
- **强制人工确认门**：`--remediate=on` 时，任何外发动作前必须经 `AskUserQuestion` 确认（展示目标 domain / 类型 / 文件 / ±行 / 置信 / issue 标题）；可选"提交 evidence issue / 仅 dry-run / 取消"。
- **stage7 应用-构建-复验-issue**（纯脚本）：clone@ref → git apply → 构建 → 重启 SUT → 重跑失败用例 → 生成含修复方案和实证复验的 issue body → 开 upstream issue。

### 8.3 安全红线

- **不自我认证**：绿/红由脚本**重跑未改动用例 + 重建后 SUT** 判定，issue 中必须带实证状态（`require_evidence_before_issue` 不可关闭，兼容旧 `require_green_before_pr`）。
- **不洗绿**：只改业务码使其符合契约；不弱化/删 AutoTestFlow 测试或既有断言、不改 `contract.md`；回归自测只新增。
- **分析可扩展，patch 收敛**：未来故障模式通过 `shared/fault_analysis_profiles.json` 扩展；只有 spec-required contract defect 可进入 patch 子集。
- **门控 + 文件级 `switches.allow_open_issue` 第二层保险**；不推 fork、不创建 PR；clone 仓与复验轨迹 gitignore；不读/印 token（用 ambient `gh auth`）。

**无需真实 SUT/仓即可复现**：见 [`examples/a2a/remediation_demo/README.md`](examples/a2a/remediation_demo/README.md)（内置 fake_repo + no-op 构建 + 模拟复验，离线跑通 分析→应用→复验→dry-run issue 提交）。安全纪律见 [`shared/remediation_rules.md`](shared/remediation_rules.md) 与 `DESIGN.md` §7；特性总览见 [`ChangeLogs/v2.0-引入自动修复闭环.md`](../ChangeLogs/v2.0-引入自动修复闭环.md)。

---

## Beta（预研特性，默认关闭）

> Beta 是**预研暂存区**：代码物理隔离在 [`beta/`](beta/)，由 `--beta-*` 开关显式开启，**默认关闭时流水线与稳定版字节级一致**；不得违反 `DESIGN.md` §1–§8。

### v1.0：故障库接入 LLM Wiki（`--beta-wiki`）

依据 [`FaultsAnalysis/07`](../FaultsAnalysis/07-LLM_Wiki与故障库知识源分析.md) §九 **Phase A**：由结构化故障库**单向派生**仓内 NL 文章（默认目标为 `TestKnowledgeBase/Fault/wiki/*.md`），供 **stage2.6b / stage6** 的 LLM 子 Agent 按 `fault_id` 确定性取用，作 **advisory 建议层**——**不作 oracle、不进 `match_faults.py`、断言仍由 `contract.md` 封顶**。

```bash
# 启用：先派生 wiki，再让 stage2.6b/stage6 用 beta 模板读 wiki 作 advisory
python AutoTestFlow/beta/scripts/gen_wiki.py            # 故障库 JSON → wiki/*.md（单向派生、幂等）
python AutoTestFlow/beta/scripts/check_wiki.py          # 护栏校验（覆盖/溯源/不漂移/不越权/非matcher）
/auto-test-flow 需求.md --sut-manifest autotestflow.suts.md \
    --faults on --fault-enrich on --beta-wiki on

# 关闭（默认）：--beta-wiki off → 用稳定模板、不读 wiki，与 v2.x 字节级一致
```

**无需真实 SUT/LLM 即可复现**：见 [`beta/examples/a2a/wiki_demo/README.md`](beta/examples/a2a/wiki_demo/README.md)（sample 库 + golden + 纸面 trace）。总览见 [`beta/README.md`](beta/README.md) 与 [`ChangeLogs/v3.0-Beta预研_故障库接入LLM_Wiki.md`](../ChangeLogs/v3.0-Beta预研_故障库接入LLM_Wiki.md)。

---

## 9. 诚实说明

| 事项 | 状态 |
|------|------|
| **本目录性质** | **设计产物**：已做结构自检（文件命名、客户端访问器、阶段产物链一致）|
| **端到端实跑** | 需用户在**可达 SUT** 上验证（探活成功才进入 stage4 执行）|
| **stage4 跨栈** | Python 黑盒测 Java SUT，跨栈方案；需用户在可达 SUT 上端到端验证 |
| **示例锚定** | A2A/agent-runtime 是示例（见 `examples/a2a/`）；其他 SUT 按校准出的 `contract.md` 专化 `reference/http_client.py` |
| **人工裁决** | TestKnowledgeBase 已接入，后续默认知识源为 `TestKnowledgeBase/registry.json` + `TestKnowledgeBase/Fault/`；stage3b 的故障覆盖完备性维度可由知识库背书自动通过，stage1 与 FP 拆分/断言合理性仍人工 |
| **Fault analysis / 自动修复(v2.1)** | 默认命令使用 `--remediate=on`，但缺少/非法 `remediation.config.json` 或无可分析目标会跳过 stage6/7；真实 clone + 构建 + SUT 重启 + `gh issue` 仅在用户用**真实仓 + 构建工具链 + gh 鉴权**且过门、并设置 `switches.allow_open_issue=true` 时走通；自动 PR 已移除。本仓含**离线确定性 demo**（`examples/a2a/remediation_demo/`，fake_repo + 模拟复验）验证编排与产物 |

> 设计立场：Oracle（`contract.md`）必须可信、可追溯，生成器不得自我认证。详见 `DESIGN.md`。
