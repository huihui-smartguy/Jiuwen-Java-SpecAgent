# Professional_experience 使用指南

## 1. 知识库定位

本目录沉淀专业测试经验和测试验收标准，面向 AutoTestFlow 的三个消费场景：

1. **测试策略生成**：指导 stage3b 生成更平衡的测试组合。
2. **验收门禁生成**：指导 stage5 输出可执行的 release readiness 结论。
3. **AI 测试增强**：为 Agent/LLM/RAG/tool-use 系统补充 eval、红队、安全、监控和漂移标准。

它不是故障库，也不是业务规格库。它不能直接制造 L2 断言，所有强断言必须来自 `contract.md`。

## 2. 三层知识协作

| 层 | 输入 | 输出 | 边界 |
|---|---|---|---|
| 契约层 | 需求、源码、真实样本 | `contract.md`、`oracle_refs` | 唯一强断言来源 |
| 故障层 | `TestKnowledgeBase/Fault/*.json` | `fault_ref`、故障导向测试 | 只决定“哪些故障要测” |
| 经验层 | 本目录 | 验收门禁、测试组合建议、AI eval 标准 | 只决定“什么叫测得专业” |

## 3. AutoTestFlow 消费规则

### Phase A-D Runtime Integration

| Phase | AutoTestFlow 接入点 | 产物 | 说明 |
|---|---|---|---|
| A | stage5 报告前 | `.state/professional_acceptance.json` | 输出专业验收、发布门禁、残余风险矩阵。 |
| B | stage3b 用例设计前 | `.state/professional_case_guidance.json` | 指导 `acceptance_refs`、证据要求、AI eval、DFX、redteam 和 readiness。 |
| C | stage1/stage2 后 | `.state/professional_acceptance.seed.json` / `.state/professional_acceptance.code_gaps.json` | 暴露需求和代码层面的可测性缺口。 |
| D | AI/Agent readiness | `.state/ai_eval_readiness.json` | 检查 eval dataset、grader、redteam、tool-call trace、监控和漂移。 |

所有产物都是 advisory gate，不能越过 `contract.md` 生成强断言。

### Stage1 需求分析

- 使用 `acceptance_criteria.json` 中的 `test_strategy_readiness` 检查需求是否具备可测性。
- 如果需求没有明确用户链路、失败模式、数据边界、权限边界或非功能目标，应标记为需要人工裁决。

### Stage2.5 契约校准

- 不读取本目录来升级断言。
- 可使用本目录提醒契约需要覆盖哪些观察项，例如延迟、错误质量、traceId、tool_call_id、stream_end。

### Stage3b 用例设计

- 使用 `company_practice_cards.json` 和 `acceptance_criteria.json` 生成测试组合建议：
  - 小而快的验证优先。
  - E2E 只覆盖关键用户链路和跨模块风险。
  - AI 场景必须有 eval dataset、grader、红队样本和工具调用验收项。
- 若故障库命中，应把故障导向用例和专业验收项合并到同一测试设计中。

### Stage4 执行

- 继续遵守五分类，不因行业经验把观察项升级为缺陷。
- 对 AI 用例记录 prompt、model/config、tool calls、trace、grader 结果、成本和延迟。

### Stage5 报告

- 输出四个矩阵：
  - contract coverage：契约项覆盖。
  - fault coverage：故障库覆盖。
  - professional acceptance：专业验收门禁通过情况。
  - AI evaluation readiness：AI eval 和安全门禁通过情况。
- 对不满足门禁的项给出下一步行动，而不是只给“通过/失败”。

## 4. 验收原则

| 原则 | 含义 | 不满足时的处理 |
|---|---|---|
| 快速反馈 | PR 前必须有小而快、稳定的测试层 | 标记为测试套件风险 |
| 可定位 | 每个失败能定位到 contract、fault_ref、trace 或环境证据 | 标记为 report_quality_gap |
| 可复现 | 失败必须有输入、配置、响应、日志或 trace | 标记为 evidence_gap |
| 低误报 | 自动判缺陷必须有契约背书 | 降级为 sut_unsatisfied 或观察项 |
| AI 多维评估 | AI 系统不得只看答案对错，还要看安全、工具调用、延迟、成本、漂移 | 标记为 ai_eval_gap |
| 生产闭环 | 上线后需要监控、采样评估、告警和回归沉淀 | 标记为 release_readiness_gap |

## 5. 维护规则

1. 新增经验项必须同步更新 `source_registry.json` 或说明来源为仓内推导。
2. 新增机器可读标准必须进入 `acceptance_criteria.json`。
3. 新增公司实践必须进入 `company_practice_cards.json`，并标注 `confidence`。
4. 不允许写入无法执行的泛泛建议，例如“提高测试质量”。必须能映射到门禁、指标或文件证据。
5. 与故障库冲突时，以 `contract.md` 和故障库的 contract-first 调和结果为准。
