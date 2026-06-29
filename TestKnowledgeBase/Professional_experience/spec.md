# 行业测试经验知识库

> 版本：v1.0.0  
> 最后更新：2026-06-29  
> 定位：面向 AutoTestFlow 的专业测试经验、AI 测试验收标准与行业实践知识库。

## 1. 为什么需要本目录

`TestKnowledgeBase/Fault/` 回答的是“历史上和行业中哪些故障模式高发”，适合驱动异常、边界、SSE、可靠性、安全等故障导向用例。

`Professional_experience/` 回答的是“成熟工程组织如何判断测试是否足够、结果是否可信、AI 系统是否可以上线”，适合驱动测试策略、验收门禁、质量报告、人工裁决降级和后续自动化治理。

两者关系如下：

| 知识源 | 关注问题 | AutoTestFlow 中的作用 |
|---|---|---|
| `contract.md` | 当前 SUT 承诺什么 | 唯一强断言 Oracle |
| `TestKnowledgeBase/Fault/` | 什么容易坏 | 生成故障导向用例和历史缺陷回归 |
| `Professional_experience/` | 什么叫测得专业且可上线 | 生成验收门禁、测试组合、AI 评测和报告质量标准 |

本目录不替代 `contract.md`，不直接升级断言级别。它只提供测试工程经验、门禁建议和接受标准。所有强断言仍必须引用 `contract.md` 的 `spec_id`。

## 2.1 与 Specification_Repository 的关系

后续产品迭代以 `TestKnowledgeBase` 作为知识库主干，`Specification_Repository` 不再承担实际迭代职责。`Professional_experience/` 与 `Fault/` 的新增、晋升、校验和 AutoTestFlow 接入工作都应落在 `TestKnowledgeBase` 下；旧 `Specification_Repository` 仅保留为历史示例和兼容路径。

## 3. 文件结构

| 文件 | 作用 |
|---|---|
| `00-three_round_analysis.md` | 三轮深度分析结论：为什么 AutoTestFlow 同时需要故障库和专业经验库。 |
| `guide.md` | 面向 FDE/测试智能体的使用指南、治理规则和维护方法。 |
| `autotestflow_mapping.md` | 将行业经验映射到 AutoTestFlow 各阶段的消费方式。 |
| `acceptance_criteria.json` | 可机器读取的软件测试与 AI 测试验收标准。 |
| `company_practice_cards.json` | Google、Microsoft、AWS、Netflix、Meta、OpenAI、Anthropic 等实践卡片。 |
| `source_registry.json` | 外部来源登记表，记录来源、领域、可信度与提炼用途。 |

## 4. 使用原则

1. **Contract-first**：本目录只能影响“测什么”和“何时需要人工确认”，不能凭行业经验生成强断言。
2. **经验可解释**：每条专业经验必须能追溯到公司实践、公开标准或 AutoTestFlow 仓内证据。
3. **门禁可执行**：验收标准必须能落到文件、指标、trace、CI 结果、评审结论或人工裁决记录。
4. **AI 测试分层**：AI 系统要同时覆盖任务质量、安全、工具调用、状态管理、漂移、成本、延迟和可观测性。
5. **故障库协同**：故障库负责故障模式，专业经验库负责策略和门禁。两者在 stage3b/stage5 汇合。

## 5. 适用场景

- 为 REST/API、Web、Agent、DFX 测试生成验收清单。
- 判断测试套件是否过度依赖 E2E，是否缺少小而快的反馈层。
- 为 AI Agent 增加 eval dataset、grader、红队、安全、工具调用和生产监控标准。
- 将人工专家判断沉淀为结构化质量规则，逐步降低 AutoTestFlow 的人工门依赖。
