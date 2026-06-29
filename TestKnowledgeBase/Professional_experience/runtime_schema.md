# Professional Experience Runtime Schema

Date: 2026-06-29  
Schema: `professional_acceptance.v1`

## 中文

`Professional_experience` 是 AutoTestFlow 的专业验收知识层，不是故障匹配库，也不是强断言 Oracle。

它通过以下产物进入 AutoTestFlow：

| Phase | 产物 | 消费阶段 | 作用 |
|---|---|---|---|
| A | `.state/professional_acceptance.json` | stage5 | 专业验收、发布门禁、残余风险矩阵 |
| B | `.state/professional_case_guidance.json` | stage3b | 测试组合建议、`acceptance_refs`、证据要求 |
| C | `.state/professional_acceptance.seed.json` | stage1 | 需求可测性和测试计划种子 |
| C | `.state/professional_acceptance.code_gaps.json` | stage2 | 可观测性、配置、依赖、日志和 trace 缺口 |
| D | `.state/ai_eval_readiness.json` | stage5 / AI Agent 场景 | eval dataset、grader、redteam、tool-call trace、监控和漂移就绪度 |

每条 `acceptance_criteria` 可以包含以下 runtime 字段：

| 字段 | 含义 |
|---|---|
| `applies_to` | 适用产品域，如 `rest_api`、`web`、`agent`、`ai_agent`、`dfx` |
| `stage_scope` | 可被消费的 AutoTestFlow 阶段 |
| `auto_evaluable` | 是否允许确定性脚本自动判定 |
| `evidence_map` | 证据名到仓内/输出产物的映射 |
| `default_status_when_missing` | 证据缺失时的默认状态 |
| `risk_scope` | 影响的发布风险层级 |

### 约束

1. `Professional_experience` 只能产生 `pass` / `warn` / `fail` / `not_applicable` / `requires_human_review`。
2. 它不能直接生成强断言。
3. 所有 L2 断言仍必须来自 `contract.md` 的 `spec-required` oracle。
4. AI/Agent 条目在没有 AI/Agent 项目信号时应判为 `not_applicable`，避免非 AI 项目被误报。

## English

`Professional_experience` is AutoTestFlow's professional acceptance knowledge layer. It is not a fault-matching library and not a strong oracle.

It enters AutoTestFlow through these artifacts:

| Phase | Artifact | Consumed By | Purpose |
|---|---|---|---|
| A | `.state/professional_acceptance.json` | stage5 | Professional acceptance, release gates, residual-risk matrix |
| B | `.state/professional_case_guidance.json` | stage3b | Suite guidance, `acceptance_refs`, evidence requirements |
| C | `.state/professional_acceptance.seed.json` | stage1 | Requirement testability and test-plan seed |
| C | `.state/professional_acceptance.code_gaps.json` | stage2 | Observability, configuration, dependency, log, and trace gaps |
| D | `.state/ai_eval_readiness.json` | stage5 / AI Agent scenarios | Eval dataset, grader, redteam, tool-call trace, monitoring, and drift readiness |

Each `acceptance_criteria` item may contain the following runtime fields:

| Field | Meaning |
|---|---|
| `applies_to` | Applicable product domains, such as `rest_api`, `web`, `agent`, `ai_agent`, `dfx` |
| `stage_scope` | AutoTestFlow stages that may consume the item |
| `auto_evaluable` | Whether deterministic scripts may evaluate it automatically |
| `evidence_map` | Mapping from evidence names to repository/output artifacts |
| `default_status_when_missing` | Default status when evidence is missing |
| `risk_scope` | Release risk layer affected by this gate |

### Constraints

1. `Professional_experience` may only produce `pass`, `warn`, `fail`, `not_applicable`, or `requires_human_review`.
2. It must not create strong assertions directly.
3. All L2 assertions must still come from `contract.md` `spec-required` oracles.
4. AI/Agent criteria should become `not_applicable` when no AI/Agent project signal exists, preventing false warnings for non-AI projects.
