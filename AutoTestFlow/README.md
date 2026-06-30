# AutoTestFlow · 需求驱动的测试智能体

> 本目录是一个 **Claude Code Skill**：从需求文档出发，对一个**对外协议可观测的源码型被测系统（SUT）**
> 生成测试。当前以**场景化测试**实现（flow/framework/quality），**DFX 测试（性能/可靠性/安全/兼容性等）并行规划中**。
> 标准模式下 stage4 产出 **Python pytest + httpx 黑盒**用例（跨栈黑盒，不依赖被测内部类）。

---

## 1. 这是什么

| 维度 | 说明 |
|------|------|
| **定位** | 需求驱动的测试智能体，按"测试维度"抽象 |
| **测试维度** | `scenario`（场景化，**已实现**）+ `dfx`（性能/可靠性/安全/兼容性等，**规划中、并行轨道**） |
| **输入** | 需求文档 + 一个被测源码模块路径 + 运行中 SUT 的 base-url +（可选）TestKnowledgeBase |
| **输出** | 校准契约 + 测试场景 + 测试设计 + Python 黑盒用例 + 执行报告（含交互轨迹） |
| **被测对象** | Java/Spring、Python Web/API、C++ service/RPC 或未知源码树的 SUT。被测协议/端点/响应契约的真实形态以 stage2.5 校准出的 `contract.md` 为准 |
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
│   └── scenario_schema.md          # 场景 JSON schema
├── reference/                      # 通用黑盒复用资产（按 contract.md 专化）
│   ├── http_client.py              # 通用黑盒 HTTP 客户端 + 交互记录器
│   ├── conftest.py                 # pytest fixtures + 轨迹日志
│   └── client_reference.md         # 客户端方法表与判据约定
├── examples/
│   └── a2a/                        # A2A 示例锚点（客户端专化 + 参考资产）
├── scripts/                        # 确定性脚本（scan-prep / probe / match / merge / select / aggregate / record）
│   ├── prepare_code_scan.py        # stage2 profile adapter 预扫描计划
│   ├── probe_contract.py           # stage2.5 探活校准 → contract.md
│   ├── knowledge_base.py           # TestKnowledgeBase registry/glob adapter
│   ├── match_faults.py             # stage2.6 知识/故障匹配（contract 优先封顶）→ knowledge_matches.json + fault_matches.json
│   ├── professional_acceptance.py  # Professional_experience advisory gates → professional/AI readiness artifacts
│   ├── merge_enriched.py
│   ├── merge_test_design.py
│   ├── select_p0.py
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

```
/auto-test-flow 需求.md <sut源码>/<模块> --sut-base-url http://host:port
```

| 参数 | 说明 |
|------|------|
| `需求.md` | 需求文档路径（必填） |
| `<sut源码>/<模块>` | 被测源码模块路径（stage2 自动识别 Java/Spring、Python Web/API、C++ service/RPC 或 fallback；省略则纯需求模式） |
| `--sut-base-url` | 运行中 SUT 的 base-url（stage2.5 探活 + stage4 就绪门 + 执行） |
| `--knowledge-root` | TestKnowledgeBase 根目录，供 stage2.6 registry/glob discovery 使用（默认仓内 `TestKnowledgeBase`） |
| `--knowledge-domain` | 知识域过滤：`all` / `rest_api` / `web` / `agent` / `dfx`，或逗号分隔 package_id |
| `--fault-lib` | 显式故障库路径，仅用于旧 demo 或临时单文件调试；默认不再自动回退 `Specification_Repository` |
| `--fault-overlay` | 项目级故障库 overlay（覆盖 / 禁用 / 项目特有故障） |
| `--faults` | 故障库启用模式：`auto`（默认，探测到库即启用）/ `on` / `off` |
| `--fault-enrich` | stage2.6b 可选 LLM 增强（模糊绑定 / 占位替换 / contract_conflict 检出）：`on` / `off`（默认）/ `auto` |

> 不提供代码路径/PR/commit 时进入**纯需求模式**（1→2R→3aR→3b），只产出测试设计文档。
> 完整参数（`--output-dir` / `--case-batch-size` / `--p0-count` / `--pr` / `--commit` 等）以 `SKILL.md`《参数》为准；此处仅列常用项。
> 故障库（规格库）的详细用法见下文 **§7 故障库（规格库）使用**。

---

## 6. 端到端流程

```
需求.md + 源码模块 + SUT +（可选）TestKnowledgeBase
   │
   ├─ stage1   需求侧场景分析（flow/framework/quality）        ← 人工裁决 ✅（FP 拆分/场景边界把关）
   ├─ stage2   通用代码扫描 → code_scan_plan.json + code_analysis.md（profile adapter）
   ├─ stage2.5 契约校准：probe_contract.py 探活真实 SUT → contract.md   ← 判据权威性闸
   ├─ stage2.6 TestKnowledgeBase 匹配（可选）：match_faults.py registry/glob discovery + contract 封顶 → knowledge_matches.json + fault_matches.json
   │            └─ 2.6b（可选，--fault-enrich on）LLM 增强：模糊绑定 / 占位替换 / contract_conflict
   ├─ stage2.P Professional_experience（advisory）：professional_acceptance.py → seed/code_gaps/case_guidance
   ├─ stage3a  场景富化（GAP + 框架补充）
   ├─ stage3b  测试用例设计（断言按 contract.md，读取 professional_case_guidance） ← 人工裁决 ✅
   ├─ stage4   就绪门（探活）→ 生成 Python pytest+httpx 用例 → 执行 + 采集交互轨迹
   │            └─ 执行边界5分类：harness_defect / sut_unsatisfied / sdk_defect / env_issue / pass
   └─ stage5   汇总报告（含 professional acceptance / AI readiness / residual risk）+ record_faults.py 闭环
```

`校准 → 设计 → 生成 → 就绪门 → 执行+轨迹 → 报告`：判据先校准、再设计断言；执行前先探活；
失败严格按执行边界5分类——脚本问题自我修复，SUT 当前确实不满足则 skip 标原因，绝不洗绿。

---

## 7. 故障库（规格库）使用

> **是什么**：TestKnowledgeBase 是 AutoTestFlow 的外部可插拔测试知识源，覆盖 REST/API、Web、Agent、DFX 与专业验收经验。后续迭代以 `TestKnowledgeBase/registry.json` + `TestKnowledgeBase/Fault/*.json` 为知识库主干；`Specification_Repository/` 不再承担实际产品迭代职责，仅作为显式旧 demo 输入。流水线判据（Oracle）来自"需求 + 真实契约"，能保证"形态正确、流程跑通"，但缺少"**应该测哪些失败模式**"。TestKnowledgeBase 正是补这块——经 registry/package 注入，**不硬编码**进 Skill 提示词。

### 7.1 默认即启用（零配置）

标准模式下 `--faults auto`（默认）会自动读取 `TestKnowledgeBase/registry.json`；如果当前分支尚未包含 registry，则退化为扫描 `TestKnowledgeBase/Fault/*.json`。AutoTestFlow 不再自动回退 `Specification_Repository`。匹配阶段会按 package/domain/category metadata、场景域、标签、历史缺陷、关联字段、流式信号等规则把知识条目匹配进流水线，并用 `contract.md` 的字段权威性分级对每条故障的断言级别做**契约优先封顶**（spec-required→至多 L2；config-dependent/契约静默/未知→降 L0/L1）。

**优雅降级（硬保证）**：未发现 TestKnowledgeBase / `--faults off` / 无 `contract.md`（纯需求模式）→ **不产出任何文件**，流水线与未接入知识库时**字节级一致**。

### 7.2 启用 / 覆盖 / 增强

| 诉求 | 做法 |
|------|------|
| 默认启用 | 标准调用即可（优先读取 `TestKnowledgeBase/registry.json`，无 registry 时扫描 `TestKnowledgeBase/Fault/*.json`） |
| 知识域过滤 | `--knowledge-domain rest_api` / `--knowledge-domain agent,dfx` |
| 显式指定库 | `--fault-lib <path> --faults on`（旧 demo / 单文件调试） |
| 关闭 | `--faults off`（与未接入完全一致） |
| 项目专化 | 在 `TestKnowledgeBase/Fault/project_faults.json` 或被测项目 `fault_library/project_faults.json` 维护 overlay，用 `--fault-overlay <path>` 注入（覆盖 / 禁用 / 项目特有故障 / 参数占位替换） |
| LLM 增强（可选） | `--fault-enrich on` 开 stage2.6b：把自由文本判据**模糊绑定**到契约 specId、替换 overlay 残留 `{占位符}`、检出 `contract_conflict`（默认 `off`，opt-in） |

```bash
# 默认（自动读取 TestKnowledgeBase registry/glob）
/auto-test-flow 需求.md <sut源码>/<模块> --sut-base-url http://host:port

# 指定知识域 + 项目 overlay + LLM 增强
/auto-test-flow 需求.md <sut源码>/<模块> --sut-base-url http://host:port \
    --knowledge-domain rest_api,dfx \
    --fault-overlay <proj>/fault_library/project_faults.json --fault-enrich on

# 关闭
/auto-test-flow 需求.md <sut源码>/<模块> --sut-base-url http://host:port --faults off
```

### 7.3 闭环自积累

stage5 子步 `record_faults.py` 把执行中**契约背书的真实违例**（仅 `class==sdk_defect`）蒸馏为 `history_faults`，去重后默认写**项目 overlay**（不污染全局精选库），默认 dry-run（`--write` 才落库）：

```bash
python AutoTestFlow/scripts/record_faults.py --output-dir <output_dir> \
    --overlay-path <proj>/fault_library/project_faults.json --write
```

安全收敛：绝不收 `sut_unsatisfied / harness_defect / env_issue`（避免把非缺陷沉淀成"历史缺陷"）。overlay→全局的晋升（人工评审 + PR）进入 `TestKnowledgeBase/Fault/`；`Specification_Repository` 不再作为后续晋升目标。

### 7.4 对人工裁决门的影响（保守降级）

`fault_matches.json` 存在时，**仅 stage3b 门的"异常/边界/质量覆盖完备性"维度由故障库背书自动通过**（展示故障覆盖摘要）；**stage1 门**与 **stage3b 的"FP 拆分映射 / 断言合理性"维度仍强制人工**（故障库不覆盖这些判据）。

### 7.5 产物与可复现 demo

| 产物 | 说明 |
|------|------|
| `.state/knowledge_matches.json` | TestKnowledgeBase 主产物（匹配 + 契约调和 + 配额） |
| `.state/fault_matches.json` | 兼容产物，供现有 stage3b/stage5 读取 |
| `.state/fault_contract_alignment.md` | 故障-契约对齐报告 |
| `.state/new_knowledge_candidates.json` | 本轮闭环候选（dry-run 输出） |
| `.state/new_faults_detected.json` | 兼容候选输出 |
| `.state/professional_acceptance.seed.json` | Phase C：测试计划和需求可测性种子 |
| `.state/professional_acceptance.code_gaps.json` | Phase C：代码/可观测性/依赖证据缺口 |
| `.state/professional_case_guidance.json` | Phase B：stage3b 用例设计指导与 `acceptance_refs` |
| `.state/professional_acceptance.json` | Phase A：stage5 专业验收和发布门禁矩阵 |
| `.state/ai_eval_readiness.json` | Phase D：AI/Agent eval、grader、redteam、tool-call、监控就绪度 |
| 用例字段 `fault_ref` | 故障导向用例的溯源标记 |

### 7.6 Professional_experience advisory gates

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
> **全程门控、默认关闭、不自我认证**：`--remediate=off`（默认）时不产任何修复文件，流水线与 v1.x 字节级一致。

### 8.1 开关与配置

| 参数 | 说明 |
|------|------|
| `--remediate` | `off`（默认）/ `dry-run`（分析 + 本地复验，**不**提交 issue）/ `on`（经**强制人工确认门**后提交 evidence issue；不再提交 PR） |
| `--remediation-config` | 修复配置文件路径，默认探测 `<output_dir>/remediation.config.json` |
| `--remediation-max-defects` | 单轮最多处理的 patchable contract defect 数（默认 5） |

配置用 JSON 声明**被测对象 + 代码仓**：`sut.base_url`、`repo.{upstream_url,ref,clone_path,local_branch_prefix,business_code_roots,selftest_roots}`、`build.{build_cmd,selftest_cmd}`、`run.{restart_cmd,readiness_probe}`、`issue`/`switches`。复制模板 `examples/remediation.config.example.json`（spring-ai-ascend），schema 见 `shared/remediation_config_schema.md`。

```bash
/auto-test-flow 需求.md <sut源码>/<模块> --sut-base-url http://host:port \
    --remediate on --remediation-config <proj>/remediation.config.json
```

### 8.2 阶段（stage5 之后，可选门控）

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
/auto-test-flow 需求.md <sut源码>/<模块> --sut-base-url http://host:port \
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
| **Fault analysis / 自动修复(v2.1)** | `--remediate=off` 默认关闭；真实 clone + 构建 + SUT 重启 + `gh issue` 仅在用户用**真实仓 + 构建工具链 + gh 鉴权**运行 `on` 且过门时走通；自动 PR 已移除。本仓含**离线确定性 demo**（`examples/a2a/remediation_demo/`，fake_repo + 模拟复验）验证编排与产物 |

> 设计立场：Oracle（`contract.md`）必须可信、可追溯，生成器不得自我认证。详见 `DESIGN.md`。
