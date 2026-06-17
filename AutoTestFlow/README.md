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
| **输入** | 需求文档 + 一个 Java/Spring 仓的模块路径 + 运行中 SUT 的 base-url |
| **输出** | 校准契约 + 测试场景 + 测试设计 + Python 黑盒用例 + 执行报告（含交互轨迹） |
| **被测对象** | **任意 Java/Spring SUT**（REST/RPC）。被测协议/端点/响应契约的真实形态以 stage2.5 校准出的 `contract.md` 为准 |
| **测试栈** | stage4 生成 Python `pytest` + `httpx` 黑盒用例，只经对外协议观测 |

> 通用性边界：场景/设计/契约校准/执行流程与具体协议无关；黑盒脚手架 `reference/http_client.py`
> 在 stage2.5 校准后按真实 `contract.md` 专化为具体协议形态。A2A/agent-runtime 仅作**示例**，见 `examples/a2a/`。

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
├── scripts/                        # 确定性脚本（probe / merge / select / aggregate）
│   ├── probe_contract.py           # stage2.5 探活校准 → contract.md
│   ├── merge_enriched.py
│   ├── merge_test_design.py
│   ├── select_p0.py
│   └── aggregate_results.py
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

> 不提供代码路径/PR/commit 时进入**纯需求模式**（1→2R→3aR→3b），只产出测试设计文档。

---

## 6. 端到端流程

```
需求.md + Java模块 + SUT
   │
   ├─ stage1   需求侧场景分析（flow/framework/quality）        ← 人工裁决 ✅（缺规格库，需把关）
   ├─ stage2   Java/Spring 静态扫描 → code_analysis.md（java_scan_guide）
   ├─ stage2.5 契约校准：probe_contract.py 探活真实 SUT → contract.md   ← 判据权威性闸
   ├─ stage3a  场景富化（GAP + 框架补充）
   ├─ stage3b  测试用例设计（断言按 contract.md）             ← 人工裁决 ✅（用例完备性把关）
   ├─ stage4   就绪门（探活）→ 生成 Python pytest+httpx 用例 → 执行 + 采集交互轨迹
   │            └─ 执行边界5分类：harness_defect / sut_unsatisfied / sdk_defect / env_issue / pass
   └─ stage5   汇总报告（含轨迹、5分类分布、需求-实现形态差异观察）
```

`校准 → 设计 → 生成 → 就绪门 → 执行+轨迹 → 报告`：判据先校准、再设计断言；执行前先探活；
失败严格按执行边界5分类——脚本问题自我修复，SUT 当前确实不满足则 skip 标原因，绝不洗绿。

---

## 7. 诚实说明

| 事项 | 状态 |
|------|------|
| **本目录性质** | **设计产物**：已做结构自检（文件命名、客户端访问器、阶段产物链一致）|
| **端到端实跑** | 需用户在**可达 SUT** 上验证（探活成功才进入 stage4 执行）|
| **stage4 跨栈** | Python 黑盒测 Java SUT，跨栈方案；需用户在可达 SUT 上端到端验证 |
| **示例锚定** | A2A/agent-runtime 是示例（见 `examples/a2a/`）；其他 SUT 按校准出的 `contract.md` 专化 `reference/http_client.py` |
| **人工裁决** | 当前无业务规格库，stage1/stage3b 由人工裁决补位评判标准；规格库就位后可降级为自动 |

> 设计立场：Oracle（`contract.md`）必须可信、可追溯，生成器不得自我认证。详见 `DESIGN.md`。
