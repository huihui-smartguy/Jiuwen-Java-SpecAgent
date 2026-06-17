# java-req-test-analyzer · 通用 Java/Spring 需求驱动 E2E 测试生成器

> 本目录是一个 **Claude Code Skill**：从需求文档出发，对一个 **Java/Spring 被测服务（SUT）** 生成
> 端到端测试。stage4 产出 **Python pytest + httpx 黑盒**用例（跨栈黑盒，不依赖被测内部类）。

---

## 1. 这是什么

| 维度 | 说明 |
|------|------|
| **输入** | 需求文档 + 一个 Java/Spring 仓的模块路径 + 运行中 SUT 的 base-url |
| **输出** | 校准契约 + E2E 场景 + 测试设计 + Python 黑盒用例 + 执行报告（含交互轨迹） |
| **被测对象** | **任意 Java/Spring SUT**（REST/RPC）。A2A / agent-runtime 仅作**示例锚点**，**非硬编码**——`reference/` 里的 A2A 资产是该示例的具体实现，换 SUT 时替换即可 |
| **测试栈** | stage4 生成 Python `pytest` + `httpx` 黑盒用例，只经对外协议观测 |

> 通用性边界：场景/设计/契约校准流程与 SUT 无关；`reference/a2a_client.py`、`framework_reference.md`
> 是 A2A 示例的可复用资产，面向新 SUT 时由用户提供等价的黑盒客户端 + 参考。

---

## 2. 与迭代6（req-test-analyzer）的关系

**同架构**：编排器（零知识调度）+ 隔离子 Agent + 文件即协议 + `.state/` 检查点续跑。

在迭代6 基础上做了**七项重点优化**（详见 `CHANGES-vs-迭代6.md`）：

| # | 优化 | 针对的暴露问题 |
|---|------|----------------|
| 1 | **stage2.5 契约校准**（probe → `contract.md`） | 判据臆测（R1–R4 根因） |
| 2 | **形态容差访问器** | R1 result.task / R2 id 类型 / R3 SSE oneof |
| 3 | **断言按 contract 校准**，禁臆测 | garbage-in-garbage-out |
| 4 | **交互轨迹一等公民** | 缺交互轨迹 |
| 5 | **SUT 就绪门 + 错误三分类** | env_issue 掩盖形态错误 |
| 6 | **spec-required vs deployment-config** | R4 AgentCard.url |
| 7 | **stage2 Java 化** + stage4 Python 黑盒 | Python 套 Java 语言错位 |

---

## 3. 目录结构

```
2013_skill/
├── README.md                         # 本文件（入口）
├── CHANGES-vs-迭代6.md               # 逐条映射：暴露问题 → 本次优化
└── java-req-test-analyzer/           # Skill 本体
    ├── SKILL.md                      # 编排器调度表（主入口）
    ├── shared/
    │   ├── rules.md                  # 跨阶段纪律（断言分级/判据来源/三分类/就绪门）
    │   ├── java_scan_guide.md        # Java/Spring 静态扫描指南
    │   ├── code_analysis_template.md # stage2 Java 版输出模板
    │   └── scenario_schema.md        # 场景 JSON schema
    ├── reference/                    # A2A 示例的黑盒复用资产（换 SUT 时替换）
    │   ├── a2a_client.py             # 黑盒客户端 + 容差访问器 + 轨迹记录器
    │   ├── conftest.py               # pytest fixtures
    │   └── framework_reference.md    # 复用资产说明
    ├── scripts/                      # 确定性脚本（probe / merge / select / aggregate）
    │   ├── probe_contract.py         # stage2.5 探活校准 → contract.md
    │   ├── merge_enriched.py
    │   ├── merge_test_design.py
    │   ├── select_p0.py
    │   └── aggregate_results.py
    └── templates/                    # 各阶段子 Agent Prompt
```

---

## 4. 安装

把 `java-req-test-analyzer/`（含 `SKILL.md`）放入 skills 目录之一：

```bash
# 用户级（全局可用）
cp -r 2013_skill/java-req-test-analyzer ~/.claude/skills/

# 或项目级（随仓库）
cp -r 2013_skill/java-req-test-analyzer <你的项目>/.claude/skills/
```

安装后 Claude Code 即可识别 `/java-req-test-analyzer` 触发词。

---

## 5. 调用示例

```
/java-req-test-analyzer 需求.md <java仓>/<模块> --sut-base-url http://host:port
```

| 参数 | 说明 |
|------|------|
| `需求.md` | 需求文档路径（必填） |
| `<java仓>/<模块>` | 被测 Java/Spring 模块路径（stage2 静态扫描对象） |
| `--sut-base-url` | 运行中 SUT 的 base-url（stage2.5 探活 + stage4 就绪门 + 执行） |

---

## 6. 端到端流程

```
需求.md + Java模块 + SUT
   │
   ├─ stage1   需求侧场景分析（flow/framework/quality）
   ├─ stage2   Java/Spring 静态扫描 → code_analysis.md（java_scan_guide）
   ├─ stage2.5 契约校准：probe_contract.py 探活真实 SUT → contract.md   ← 判据权威性闸
   ├─ stage3   场景富化 + 测试设计（断言按 contract.md）
   ├─ stage4   就绪门（探活）→ 生成 Python pytest+httpx 用例 → 执行 + 采集交互轨迹
   │            └─ 错误三分类：env_issue / assertion_failure / sdk_defect
   └─ stage5   汇总报告（含轨迹、三分类分布、spec vs config 观察）
```

`校准 → 设计 → 生成 → 就绪门 → 执行+轨迹 → 报告`：判据先校准、再设计断言，执行前先探活，
未通过项严格三分类，绝不洗绿。

---

## 7. 诚实说明

| 事项 | 状态 |
|------|------|
| **本目录性质** | **设计产物**：已做结构自检（文件命名、容差访问器、阶段产物链一致）|
| **端到端实跑** | 需用户在**可达 SUT** 上验证（探活成功才进入 stage4 执行）|
| **stage4 跨栈** | Python 黑盒测 Java SUT，跨栈但**已在 `2012_skill/demo-run` 真实服务器验证**（v3 预期 12 passed，含可读交互轨迹）|
| **示例锚定** | A2A / agent-runtime 是示例；其他 SUT 需用户提供等价黑盒客户端与参考资产 |

> 设计立场承接 SpecAgent 的 **Oracle 权威性**主张：判据（contract.md）必须可信、可追溯，
> 生成器不得自我认证。详见 `2012_skill/SuperTest-与-SpecAgent-设计思想对照.md` 与 `CHANGES-vs-迭代6.md`。
