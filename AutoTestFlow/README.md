# AutoTestFlow · 需求驱动的测试智能体

> 本目录是一个 **Claude Code Skill**：从需求文档出发，对一个 **Java/Spring 被测系统（SUT）**
> 生成测试。当前以**场景化测试**实现（flow/framework/quality），**DFX 测试（性能/可靠性/安全/兼容性等）并行规划中**。
> 标准模式下 stage4 产出 **Python pytest + httpx 黑盒**用例（跨栈黑盒，不依赖被测内部类）。

---

## 1. 这是什么

| 维度 | 说明 |
|------|------|
| **定位** | 需求驱动的测试智能体，按"测试维度"抽象 |
| **测试维度** | `scenario`（场景化，**已实现**）+ `dfx`（性能/可靠性/安全/兼容性等，**规划中、并行轨道**） |
| **输入** | 需求文档 + 一个 Java/Spring 仓的模块路径 + 运行中 SUT 的 base-url +（可选）故障库（规格库） |
| **输出** | 校准契约 + 测试场景 + 测试设计 + Python 黑盒用例 + 执行报告（含交互轨迹） |
| **被测对象** | **任意 Java/Spring SUT**（REST/RPC）。被测协议/端点/响应契约的真实形态以 stage2.5 校准出的 `contract.md` 为准 |
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
│   ├── java_scan_guide.md          # Java/Spring 静态扫描指南
│   ├── code_analysis_template.md   # stage2 输出模板
│   └── scenario_schema.md          # 场景 JSON schema
├── reference/                      # 通用黑盒复用资产（按 contract.md 专化）
│   ├── http_client.py              # 通用黑盒 HTTP 客户端 + 交互记录器
│   ├── conftest.py                 # pytest fixtures + 轨迹日志
│   └── client_reference.md         # 客户端方法表与判据约定
├── examples/
│   └── a2a/                        # A2A 示例锚点（客户端专化 + 参考资产）
├── scripts/                        # 确定性脚本（probe / match / merge / select / aggregate / record）
│   ├── probe_contract.py           # stage2.5 探活校准 → contract.md
│   ├── match_faults.py             # stage2.6 故障库匹配（contract 优先封顶）→ fault_matches.json
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
/auto-test-flow 需求.md <java仓>/<模块> --sut-base-url http://host:port
```

| 参数 | 说明 |
|------|------|
| `需求.md` | 需求文档路径（必填） |
| `<java仓>/<模块>` | 被测 Java/Spring 模块路径（stage2 静态扫描对象；省略则纯需求模式） |
| `--sut-base-url` | 运行中 SUT 的 base-url（stage2.5 探活 + stage4 就绪门 + 执行） |
| `--fault-lib` | 故障库（规格库）路径，供 stage2.6 匹配（默认自动探测 `Specification_Repository/rest_api_common_faults.json`） |
| `--fault-overlay` | 项目级故障库 overlay（覆盖 / 禁用 / 项目特有故障） |
| `--faults` | 故障库启用模式：`auto`（默认，探测到库即启用）/ `on` / `off` |
| `--fault-enrich` | stage2.6b 可选 LLM 增强（模糊绑定 / 占位替换 / contract_conflict 检出）：`on` / `off`（默认）/ `auto` |

> 不提供代码路径/PR/commit 时进入**纯需求模式**（1→2R→3aR→3b），只产出测试设计文档。
> 完整参数（`--output-dir` / `--case-batch-size` / `--p0-count` / `--pr` / `--commit` 等）以 `SKILL.md`《参数》为准；此处仅列常用项。
> 故障库（规格库）的详细用法见下文 **§7 故障库（规格库）使用**。

---

## 6. 端到端流程

```
需求.md + Java模块 + SUT +（可选）故障库
   │
   ├─ stage1   需求侧场景分析（flow/framework/quality）        ← 人工裁决 ✅（FP 拆分/场景边界把关）
   ├─ stage2   Java/Spring 静态扫描 → code_analysis.md（java_scan_guide）
   ├─ stage2.5 契约校准：probe_contract.py 探活真实 SUT → contract.md   ← 判据权威性闸
   ├─ stage2.6 故障库匹配（可选）：match_faults.py 四类触发 + contract 封顶 → fault_matches.json
   │            └─ 2.6b（可选，--fault-enrich on）LLM 增强：模糊绑定 / 占位替换 / contract_conflict
   ├─ stage3a  场景富化（GAP + 框架补充）
   ├─ stage3b  测试用例设计（断言按 contract.md）             ← 人工裁决 ✅（故障覆盖完备性由故障库背书自动通过；FP 拆分/断言仍人工）
   ├─ stage4   就绪门（探活）→ 生成 Python pytest+httpx 用例 → 执行 + 采集交互轨迹
   │            └─ 执行边界5分类：harness_defect / sut_unsatisfied / sdk_defect / env_issue / pass
   └─ stage5   汇总报告（含轨迹、5分类分布、需求-实现形态差异观察）+ record_faults.py 闭环（仅 sdk_defect → 去重 → overlay）
```

`校准 → 设计 → 生成 → 就绪门 → 执行+轨迹 → 报告`：判据先校准、再设计断言；执行前先探活；
失败严格按执行边界5分类——脚本问题自我修复，SUT 当前确实不满足则 skip 标原因，绝不洗绿。

---

## 7. 故障库（规格库）使用

> **是什么**：故障库（规格库）是一份**外部可插拔**的缺陷经验知识源（`Specification_Repository/rest_api_common_faults.json`：通用故障类目 + 历史缺陷）。流水线判据（Oracle）来自"需求 + 真实契约"，能保证"形态正确、流程跑通"，但缺少"**应该测哪些失败模式**"。故障库正是补这块——经**文件注入**，**不硬编码**进 Skill 提示词。

### 7.1 默认即启用（零配置）

标准模式下 `--faults auto`（默认）会**自动探测** `Specification_Repository/rest_api_common_faults.json`；探到即在 **stage2.6** 把故障按四类触发（端点/方法、标签、历史缺陷、关联字段）匹配进流水线，并用 `contract.md` 的字段权威性分级对每条故障的断言级别做**契约优先封顶**（spec-required→至多 L2；config-dependent/契约静默/未知→降 L0/L1）。

**优雅降级（硬保证）**：未发现故障库 / `--faults off` / 无 `contract.md`（纯需求模式）→ **不产出任何文件**，流水线与未接入故障库时**字节级一致**。

### 7.2 启用 / 覆盖 / 增强

| 诉求 | 做法 |
|------|------|
| 默认启用 | 标准调用即可（库在 `Specification_Repository/` 时自动探测） |
| 显式指定库 | `--fault-lib <path> --faults on` |
| 关闭 | `--faults off`（与未接入完全一致） |
| 项目专化 | 复制 `Specification_Repository/project_faults.example.json` 为 `<proj>/fault_library/project_faults.json`，用 `--fault-overlay <path>` 注入（覆盖 / 禁用 / 项目特有故障 / 参数占位替换） |
| LLM 增强（可选） | `--fault-enrich on` 开 stage2.6b：把自由文本判据**模糊绑定**到契约 specId、替换 overlay 残留 `{占位符}`、检出 `contract_conflict`（默认 `off`，opt-in） |

```bash
# 默认（自动探测 Specification_Repository/）
/auto-test-flow 需求.md <java仓>/<模块> --sut-base-url http://host:port

# 显式库 + 项目 overlay + LLM 增强
/auto-test-flow 需求.md <java仓>/<模块> --sut-base-url http://host:port \
    --fault-lib Specification_Repository/rest_api_common_faults.json \
    --fault-overlay <proj>/fault_library/project_faults.json --fault-enrich on

# 关闭
/auto-test-flow 需求.md <java仓>/<模块> --sut-base-url http://host:port --faults off
```

### 7.3 闭环自积累

stage5 子步 `record_faults.py` 把执行中**契约背书的真实违例**（仅 `class==sdk_defect`）蒸馏为 `history_faults`，去重后默认写**项目 overlay**（不污染全局精选库），默认 dry-run（`--write` 才落库）：

```bash
python AutoTestFlow/scripts/record_faults.py --output-dir <output_dir> \
    --fault-lib Specification_Repository/rest_api_common_faults.json \
    --overlay-path <proj>/fault_library/project_faults.json --write
```

安全收敛：绝不收 `sut_unsatisfied / harness_defect / env_issue`（避免把非缺陷沉淀成"历史缺陷"）。overlay→全局的晋升（人工评审 + PR）见 `Specification_Repository/README.md`。

### 7.4 对人工裁决门的影响（保守降级）

`fault_matches.json` 存在时，**仅 stage3b 门的"异常/边界/质量覆盖完备性"维度由故障库背书自动通过**（展示故障覆盖摘要）；**stage1 门**与 **stage3b 的"FP 拆分映射 / 断言合理性"维度仍强制人工**（故障库不覆盖这些判据）。

### 7.5 产物与可复现 demo

| 产物 | 说明 |
|------|------|
| `.state/fault_matches.json` | 故障注入计划（匹配 + 契约调和 + 配额） |
| `.state/fault_contract_alignment.md` | 故障-契约对齐报告 |
| `.state/new_faults_detected.json` | 本轮闭环候选（dry-run 输出） |
| 用例字段 `fault_ref` | 故障导向用例的溯源标记 |

**无需 SUT 即可复现**（确定性脚本）：见 [`examples/a2a/fault_demo/README.md`](examples/a2a/fault_demo/README.md)，含 match / aggregate / record 与 `--faults off` 降级回归的完整命令与 golden。

**延伸阅读**：故障库结构 / overlay / 治理见 [`Specification_Repository/README.md`](../Specification_Repository/README.md)；特性总览见 [`ChangeLogs/v1.0-引入规格库与故障库.md`](../ChangeLogs/v1.0-引入规格库与故障库.md)；设计与论证见 [`FaultsAnalysis/`](../FaultsAnalysis/)。

---

## 8. 自动修复（auto-remediation, v2.0）

> **是什么**：报告（stage5）之后，对"测试不通过"中的 `sdk_defect`（contract 背书的真实违例）**可选地闭环修复**——深度分析 → 修被测仓**业务代码** + 加**回归自测** → **本地重建并复验转绿** → 开 **fork→upstream PR** + 在 upstream 开 **bug issue**（讲清"根据规格库哪些知识 + 哪些实测结果，推断该 bug 成立"）。
> **全程门控、默认关闭、不自我认证**：`--remediate=off`（默认）时不产任何修复文件，流水线与 v1.x 字节级一致。

### 8.1 开关与配置

| 参数 | 说明 |
|------|------|
| `--remediate` | `off`（默认）/ `dry-run`（深析 + 本地复验，**不**推送/PR/issue）/ `on`（经**强制人工确认门**后真实提交） |
| `--remediation-config` | 修复配置文件路径，默认探测 `<output_dir>/remediation.config.json` |
| `--remediation-max-defects` | 单轮最多处理的 sdk_defect 数（默认 5） |

配置用 JSON 声明**被测对象 + 代码仓**：`sut.base_url`、`repo.{upstream_url,ref,fork_url,clone_path,business_code_roots,selftest_roots}`、`build.{build_cmd,selftest_cmd}`、`run.{restart_cmd,readiness_probe}`、`pr`/`issue`/`switches`。复制模板 `examples/remediation.config.example.json`（spring-ai-ascend），schema 见 `shared/remediation_config_schema.md`。

```bash
/auto-test-flow 需求.md <java仓>/<模块> --sut-base-url http://host:port \
    --remediate on --remediation-config <proj>/remediation.config.json
```

### 8.2 阶段（stage5 之后，可选门控）

- **stage6 缺陷深析**（只读，每个 sdk_defect 一个子 Agent）：定位根因 → 产 `patch.diff`(业务码) + `regression_test.diff`(开发仓自测) + `issue.md`(规格库 + 实测两段证据) + `confidence.json`。
- **强制人工确认门**：`--remediate=on` 时，任何外发动作前必须经 `AskUserQuestion` 确认（展示每缺陷 spec / 文件 / ±行 / 置信 / issue 标题）；可选"仅记 issue 不提 PR / 仅 dry-run / 取消"。
- **stage7 应用-构建-复验-提交**（纯脚本）：clone@ref → git apply → 构建 → 重启 SUT → **重跑失败用例须转绿** → 推 fork PR + 开 upstream issue。

### 8.3 安全红线

- **不自我认证**：绿由脚本**重跑未改动用例 + 重建后 SUT** 判定，未转绿不开 PR（`require_green_before_pr` 不可关闭）。
- **不洗绿**：只改业务码使其符合契约；不弱化/删 AutoTestFlow 测试或既有断言、不改 `contract.md`；回归自测只新增。
- **仅 `sdk_defect` 触发**；定位不到 → 只记 issue 不改码。
- **门控 + 文件级 `switches.allow_*` 第二层保险**；PR 默认 draft；clone 仓与复验轨迹 gitignore；不读/印 token（用 ambient `gh auth`）。

**无需真实 SUT/仓即可复现**：见 [`examples/a2a/remediation_demo/README.md`](examples/a2a/remediation_demo/README.md)（内置 fake_repo + no-op 构建 + 模拟复验，离线跑通 深析→应用→复验→dry-run 提交）。安全纪律见 [`shared/remediation_rules.md`](shared/remediation_rules.md) 与 `DESIGN.md` §7；特性总览见 [`ChangeLogs/v2.0-引入自动修复闭环.md`](../ChangeLogs/v2.0-引入自动修复闭环.md)。

---

## 9. 诚实说明

| 事项 | 状态 |
|------|------|
| **本目录性质** | **设计产物**：已做结构自检（文件命名、客户端访问器、阶段产物链一致）|
| **端到端实跑** | 需用户在**可达 SUT** 上验证（探活成功才进入 stage4 执行）|
| **stage4 跨栈** | Python 黑盒测 Java SUT，跨栈方案；需用户在可达 SUT 上端到端验证 |
| **示例锚定** | A2A/agent-runtime 是示例（见 `examples/a2a/`）；其他 SUT 按校准出的 `contract.md` 专化 `reference/http_client.py` |
| **人工裁决** | 故障库（规格库）已接入（`Specification_Repository`）；stage3b 的故障覆盖完备性维度可由故障库背书自动通过，stage1 与 FP 拆分/断言合理性仍人工 |
| **自动修复(v2.0)** | `--remediate=off` 默认关闭；真实 clone + 构建 + SUT 重启 + `gh` PR/issue 仅在用户用**真实仓 + 构建工具链 + gh 鉴权**运行 `on/dry-run` 时走通。本仓含**离线确定性 demo**（`examples/a2a/remediation_demo/`，fake_repo + 模拟复验）验证编排与产物 |

> 设计立场：Oracle（`contract.md`）必须可信、可追溯，生成器不得自我认证。详见 `DESIGN.md`。
