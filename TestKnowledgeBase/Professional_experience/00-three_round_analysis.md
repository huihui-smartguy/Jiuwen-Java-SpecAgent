# 三轮深度分析：AutoTestFlow 为什么需要故障库和专业经验库

> 目标：从仓库架构、故障知识和全球一线工程实践三个角度，解释 AutoTestFlow 作为测试智能体为什么不能只依赖需求和模型生成。

## 第一轮：仓库架构分析

AutoTestFlow 的核心不是“让 LLM 写测试”，而是“用文件协议约束 LLM 做可审计的测试工程”。它的关键不变量包括：

| 不变量 | 仓内证据 | 对知识库的要求 |
|---|---|---|
| `contract.md` 是唯一强断言 Oracle | stage2.5 后所有 oracle_refs 都必须指向契约或源码核实事实 | 外部知识不能越权成为强断言 |
| 文件即协议 | `.state/*`、`contract.md`、`test_design.json`、`case_results.json` 贯穿流水线 | 新知识必须以文件注入，而不是硬编码到提示词 |
| 五分类结果 | pass、harness_defect、sut_unsatisfied、sdk_defect、env_issue | 经验库要帮助区分质量不足、环境问题和真实缺陷 |
| 人工门可被规格库逐步替代 | `DESIGN.md` 与 `SKILL.md` 均声明规格库就位后人工门可降级 | 需要可积累、可追溯、可机器读取的专业判断 |

第一轮结论：AutoTestFlow 只靠需求和契约能保证“判据可信”，但不能保证“测试策略足够成熟”。它需要外部知识库补足“怎么测才专业”。

## 第二轮：故障库分析

`TestKnowledgeBase/Fault/` 已经覆盖 Web、REST API、Agent、DFX 四类故障模式。它提供的是“可能坏在哪里”的经验：

- Web 前端：输入、流程、渲染、长连接、鉴权。
- REST API：参数、协议、状态、响应契约。
- Agent：Prompt 输入、LLM 输出、工具调用、流式运行时。
- DFX：依赖失效、资源耗尽、恢复降级、可观测性。

故障库的强项是把缺陷经验结构化成：

| 字段 | 测试价值 |
|---|---|
| `trigger_pattern` | 指导如何构造失败输入或异常环境 |
| `expected_behavior` | 给出期望行为的候选方向 |
| `validation_points` | 给出断言点候选，但必须经 contract 封顶 |
| `severity` | 影响优先级与 P0 提升 |
| `tags` | 与场景、分支、模块、DFX 维度做匹配 |

第二轮结论：故障库解决“覆盖什么失败模式”。但它仍不回答“测试组合是否健康、AI eval 是否可信、上线门禁是否完整、报告是否达到专家验收标准”。因此仍需要 `Professional_experience/`。

## 第三轮：全球工程实践分析

Google、Microsoft、AWS、Netflix、Meta、OpenAI、Anthropic 等实践有高度一致的底层原则：

| 共识 | 代表实践 | 对 AutoTestFlow 的启发 |
|---|---|---|
| 快速、可靠、可定位的反馈比堆 E2E 更重要 | Google 测试金字塔、小中大测试、flaky 控制 | AutoTestFlow 应评估测试组合健康度，避免只有黑盒 happy-path |
| 测试必须成为变更门禁 | Microsoft “代码没有测试即不完整”、PR 前测试、失败阻断合并 | stage5 报告应给出可执行上线门禁 |
| 可靠性要通过失败演练证明 | AWS Well-Architected、Google SRE、Netflix FIT | DFX 用例应覆盖依赖失效、熔断、恢复、容量和 MTTR |
| 自动化测试要可操作，低误报 | Meta Sapienz 强调 UI 可复现、低误报、CI 内近实时反馈 | AutoTestFlow 的 trace、fault_ref、oracle_refs 必须让缺陷可复现 |
| AI 系统需要 eval、红队、监控三段式 | Microsoft Foundry、OpenAI Evals、Anthropic eval guidance | AI Agent 测试必须有数据集、grader、安全红队、生产采样和漂移监控 |
| AI 安全要覆盖新型威胁 | OWASP LLM Top 10、NIST AI RMF | 专业经验库要补充 prompt injection、过度自治、隐私、供应链、输出处理等验收项 |

第三轮结论：AutoTestFlow 要成为测试 agent，不能只有“生成测试”的能力，还必须拥有“专家验收”的能力。`Professional_experience/` 正是把这些成熟组织的质量门禁沉淀为可复用知识。

## 总结：两类知识库缺一不可

```text
需求/源码/运行样本
  -> contract.md 保证断言可信
  -> Fault 库保证失败模式覆盖
  -> Professional_experience 库保证测试策略、AI eval、上线门禁和报告质量达到专家标准
```

如果缺少故障库，AutoTestFlow 容易生成“流程跑通型”用例，测不出具体模块故障。

如果缺少专业经验库，AutoTestFlow 即使覆盖了故障，也可能无法判断测试套件是否平衡、AI 评测是否可信、上线门禁是否充分、报告是否可被工程团队采纳。

最终结论：故障库是 AutoTestFlow 的“缺陷经验记忆”，专业经验库是 AutoTestFlow 的“测试负责人判断力”。二者都必须通过文件协议接入，并始终服从 `contract.md`。

