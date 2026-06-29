# AutoTestFlow 深度研读报告

> 角色视角：Senior FDE Engineer
> 仓库：huihui-smartguy/Jiuwen-Java-SpecAgent
> 分支：develop
> 生成日期：2026-06-29

## 0. 研读范围与方法

本次研读以 `develop` 分支为准。由于仓库代码搜索索引未返回命中，我先通过分支比较获得完整文件清单，再按 AutoTestFlow 的运行边界做三轮递进式研读：

1. 全仓结构轮：识别顶层模块、AutoTestFlow 主体、Specification Repository、FaultsAnalysis、ChangeLogs、examples、beta、reference、scripts、templates、shared 等资产。
2. 内核实现轮：聚焦 AutoTestFlow 的编排入口、共享规则、阶段模板、确定性脚本和黑盒参考实现。
3. 演进与验证轮：研读故障库接入、自动修复、Beta LLM Wiki、离线 fixture、规格库治理与 changelog，理解它从设计产物演化为可复现工程资产的过程。

本报告不是复述 README，而是把 AutoTestFlow 的设计原则、工程约束、可扩展点和项目落地含义整理为后续工作的依据。

## 1. 仓库整体结构认知

仓库当前不是传统单一 Java 应用，而是围绕测试智能体方法论与技能资产组织：

| 区域 | 作用 |
|---|---|
| `AutoTestFlow/` | 核心 Skill。本体包含编排说明、阶段模板、共享规则、确定性脚本、黑盒客户端、示例和 Beta 预研区。 |
| `Specification_Repository/` | 规格库和故障库。提供结构化故障模式、历史缺陷、project overlay 模板，以及由 JSON 派生的 wiki 建议层。 |
| `FaultsAnalysis/` | 故障库如何接入 AutoTestFlow 的深度分析与设计论证，解释为什么使用可插拔文件而不是硬编码 prompt。 |
| `ChangeLogs/` | v1.0 故障库、v2.0 自动修复、v3.0 Beta Wiki 的演进记录，保留决策背景、数据契约和验证口径。 |
| `AutoTestFlow/examples/` | A2A 示例锚点、fault_demo、remediation_demo，承担离线可复现验证职责。 |
| `2012_skill/` | 早期或并行的 SuperTest/SpecAgent 分析与 demo 资产，可作为 AutoTestFlow 设计前史和对照材料。 |
| `TestKnowledgeBase/` | 测试知识库占位，包括 Fault 与 Professional_experience 目录。 |

一个重要判断：这个项目的关键资产不是某个单点脚本，而是一套以文件协议连接的测试生成和验证系统。代码、模板、规则、示例、规格库共同构成运行时系统。

## 2. 三轮深度研读结论

### 第一轮：设计目标与不变量

核心文档：`AutoTestFlow/README.md`、`AutoTestFlow/DESIGN.md`、`AutoTestFlow/SKILL.md`、`AutoTestFlow/演讲稿.md`。

AutoTestFlow 的本质是“需求驱动的测试智能体”，但真正的设计目标不是简单生成测试，而是解决 AI 生成测试最容易失真的问题：判据不可信。

我提炼出的第一组不变量：

| 不变量 | 含义 | 工程后果 |
|---|---|---|
| 契约先于断言 | 任何 expected/oracle 必须先由 stage2.5 的 `contract.md` 校准。 | 下游模板和脚本都围绕 specId、权威性分级、真实 SUT 采样设计。 |
| `contract.md` 是唯一 Oracle | 需求文档负责说明意图，真实响应形态以 contract 为准。 | 断言不能凭需求措辞猜字段、枚举、错误码、SSE 形态。 |
| 人工裁决补位规格库 | 在规格库不完整时，需求拆分和用例设计必须有人确认。 | stage1 与 stage3b 保留强制门，故障库只能部分降级覆盖完备性判断。 |
| 执行结果五分类 | pass、harness_defect、sut_unsatisfied、sdk_defect、env_issue 分责清晰。 | “失败”不是一个桶，不同类型有不同处置策略。 |
| 不洗绿 | 不通过删弱 contract-backed 断言制造通过。 | harness 可修脚本，sdk_defect 进缺陷，sut_unsatisfied 记录观察。 |
| 轨迹一等公民 | 请求、响应、SSE 逐帧记录。 | 每个判定需要可追溯证据，报告要能复盘。 |
| 默认关闭的增强必须字节级一致 | fault、remediate、beta 都是开关门控。 | 扩展必须优雅降级，不能污染稳定主流程。 |

这说明 AutoTestFlow 的设计哲学是“高吞吐生成 + 强约束判定”。它允许 LLM 做理解、设计、补全，但把高风险判定锚定在 contract、脚本、文件和人工门上。

### 第二轮：实现机制与阶段边界

核心文件：`shared/rules.md`、`shared/java_scan_guide.md`、`shared/scenario_schema.md`、`reference/http_client.py`、`scripts/*.py`、`templates/*.md`。

AutoTestFlow 采用“纯编排器模式”。主 Agent 只调度，不吸收业务上下文；每个阶段通过文件交接。这一点非常关键，因为它同时解决了上下文膨胀、可恢复、可审计、可并行的问题。

阶段链路可简化为：

```text
需求 + Java/Spring SUT + SUT base-url
  -> stage1 需求场景分析
  -> stage2 Java/Spring 静态扫描
  -> stage2.5 契约校准 contract.md
  -> stage2.6 故障库匹配 fault_matches.json
  -> stage3a 场景富化
  -> stage3b 用例设计 test_design.json
  -> stage4 生成并执行 Python pytest + httpx 黑盒用例
  -> stage5 报告和故障自积累
  -> stage6/7 可选自动修复闭环
```

关键实现观察：

| 文件/组件 | 观察 |
|---|---|
| `probe_contract.py` | 契约探针是通用框架加 A2A 默认示例探针。SUT 不可达时 exit 0 并写 `reachable=false`，体现“回退而非崩溃”。 |
| `match_faults.py` | 故障匹配是确定性脚本。它解析 contract 权威性表、加载故障库和 overlay、按场景匹配并封顶断言级别。这个脚本是 v1.0 的工程核心。 |
| `select_p0.py` | P0 筛选和门禁脚本生成前移到确定性脚本，避免用 LLM 做可机械化的选择。 |
| `aggregate_results.py` | 结果聚合坚持五分类，并兼容历史字段 `sdk_bug`。这是报告和自动修复入口的基础。 |
| `record_faults.py` | 只吸收 `sdk_defect`，默认 dry-run，默认写 overlay，避免把环境问题或测试脚本问题沉淀成历史缺陷。 |
| `apply_and_reverify.py` | 自动修复的绿门。它使用真实应用补丁、构建、重启、重跑未改动黑盒用例，避免 LLM 自证。 |
| `submit_remediation.py` | 外发动作受 `--remediate=on`、人工门、配置 `allow_*`、绿门共同控制。默认 dry-run 零外发。 |
| `reference/http_client.py` | 黑盒客户端只暴露 HTTP 原语和容差 helper，内置轨迹记录、脱敏和代理绕过，不碰 Java 内部。 |

模板层面也体现出同一纪律：

| 模板 | 关键纪律 |
|---|---|
| `stage1_req_analyze.md` | 只读需求，不看代码；场景必须是完整用户链路；分支递归追问；强制人工裁决。 |
| `stage2_code_scan.md` | 不读需求，只扫 Java/Spring 事实；识别端点、异常映射、序列化事实、框架场景。 |
| `stage2_5_contract_calibrate.md` | 真实样本优先，源码兜底，所有契约项标权威性。 |
| `stage3b_batch_design.md` | 小文件模式；每条用例必须有 oracle_refs；故障库用例用 `fault_ref` 同构接入。 |
| `stage4a_p0_verify.md` / `stage4b_batch_gen.md` | 1 case = 1 Agent；就绪门先行；失败五分类；轨迹落盘；禁止洗绿。 |
| `stage5_report.md` | 以 5 分类、轨迹、sdk_defect、sut_unsatisfied、契约观察和故障覆盖组织报告。 |
| `stage6_defect_analyze.md` | 只修 spec-required 的 sdk_defect；定位不到只记 issue，不强行改码。 |

第二轮结论：AutoTestFlow 已经把“LLM 可变部分”和“确定性可验证部分”分离得比较清楚。需要继续保持这个边界，尤其不要把 matcher、aggregate、record、reverify 这类确定性职责回退给提示词。

### 第三轮：演进路线与扩展原则

核心文件：`ChangeLogs/v1.0-*`、`ChangeLogs/v2.0-*`、`ChangeLogs/v3.0-*`、`FaultsAnalysis/README.md`、`Specification_Repository/README.md`、`AutoTestFlow/beta/README.md`、examples。

AutoTestFlow 的演进是三段式的：

| 版本 | 引入能力 | 核心工程策略 |
|---|---|---|
| v1.0 | 规格库/故障库 | 外部可插拔 JSON，通过 `match_faults.py` 物化为 `.state/fault_matches.json`，不硬编码 prompt。 |
| v2.0 | 自动修复闭环 | 仅 `sdk_defect` 触发，stage6 产修复工件，stage7 机器复验，人工门后才外发。 |
| v3.0 | Beta LLM Wiki | JSON 单一真相单向派生 wiki，wiki 只做 advisory，不作 oracle，不进入 matcher。 |

这个演进揭示了 AutoTestFlow 的扩展准则：

1. 新能力优先作为文件协议接入，而不是扩大主 Agent 上下文。
2. 能确定性完成的工作必须脚本化，便于 fixture/golden 验证。
3. 知识源可以增强 LLM，但不能替代 `contract.md` 的判据地位。
4. 外发副作用必须有双门控：运行参数门 + 文件配置门 + 人工确认门。
5. 每个增强默认关闭，关闭时保持旧行为一致。
6. 示例不是装饰，`fault_demo` 和 `remediation_demo` 是系统回归测试的骨架。

## 3. AutoTestFlow 设计原则总表

| 原则 | 当前实现 | 后续工作应遵守的应用方式 |
|---|---|---|
| Oracle 权威性 | `contract.md` + specId + 权威性分级表 | 新增测试维度、故障类型或修复逻辑时，都必须引用 contract specId。 |
| 黑盒边界 | Python pytest/httpx 只打外部端点 | 不直接实例化 Java 类、不 mock 内部处理器、不绕过用户入口。 |
| 文件即协议 | `.state/*`、`contract.md`、`test_design.json`、`case_results.json` | 新增阶段必须定义输入/输出文件 schema，而不是依赖聊天上下文。 |
| 零知识编排 | 主编排器只检查小文件和进度 | 避免主 Agent 读取大业务文件，防止上下文污染和不可复现。 |
| 确定性脚本优先 | match/merge/select/aggregate/record/reverify | 排序、匹配、聚合、去重、提交守卫这类逻辑不要交给 LLM。 |
| 人工门有边界 | stage1、stage3b、stage6 外发前 | 人工门用于判据缺位或副作用确认，不用于弥补脚本缺少校验。 |
| 优雅降级 | `--faults off`、`--remediate off`、`--beta-wiki off` | 所有新增能力都要有“无痕关闭”路径。 |
| 不自我认证 | reverify 机器重跑，require_green_before_pr 强制 true | 修复和执行结论必须来自脚本证据，不来自模型判断。 |

## 4. 对当前项目后续工作的 FDE 应用建议

作为 Senior FDE，后续在本项目继续工作时我会按以下策略执行：

1. 先识别目标属于哪条轨道：稳定主流程、故障库、自动修复、Beta 预研、DFX 规划。不要跨轨道随意改动。
2. 若要新增测试能力，优先定义文件产物和 schema，再写确定性脚本，最后才接模板。
3. 若要增强用例质量，不直接扩大 prompt，而是改 `contract.md`、`fault_matches.json`、`scenario_schema.md` 或 `shared/rules.md` 中的可验证契约。
4. 若要支持新协议/SUT，不硬编码在稳定脚本里。应通过 contract probe 配置、reference client 专化、examples 增加锚点来扩展。
5. 若要改自动修复，必须先证明仍满足三条红线：仅 sdk_defect、只修业务码/新增自测、绿由机器复验。
6. 若要推广 Beta Wiki，必须先让 `check_wiki.py` 和离线 fixture 全绿，再考虑把成熟逻辑晋升到稳定目录。
7. 对任何报告、缺陷、修复 PR，都要带两段证据：规格/契约证据 + 实测 trace 证据。

## 5. 风险与改进机会

| 风险/机会 | 说明 | 建议 |
|---|---|---|
| 默认 probe 仍带 A2A 示例倾向 | `probe_contract.py` 的默认探针是 A2A 示例，对任意 SUT 仍需要专化。 | 后续可增加 probe plan 配置文件，让不同 SUT 显式提供 discovery/sample/error/stream 探针。 |
| `merge_test_design.py` coverage 字段有表达风险 | 当前 `coverage` 计算公式看起来像 `len(mapping)/(scene_total*100)`，可能不是预期百分比。 | 若后续修改脚本，应加 fixture 断言覆盖率格式。 |
| 人工门与子 Agent 模板职责有重复 | stage3b batch 模板内有人工评判，但 SKILL 也描述 merge 后人工门。 | 后续可统一为 merge 后单门，减少多 batch 重复确认风险。 |
| DFX 仍是占位 | schema 和报告支持 `dfx`，但执行链路还未实现。 | DFX 应按并行测试维度接入，不挤进 scenario 分支。 |
| 真实端到端验证缺口 | README 诚实说明中仍要求用户在可达 SUT 上验证。 | 保留离线 fixture，同时补真实 SUT smoke guide 和最小 contract probe 配置。 |
| GitHub/wiki 生成物治理 | wiki 是派生物，存在手改漂移风险。 | `check_wiki.py` 应作为 PR 前检查，确保 JSON 是单一真相。 |

## 6. 我对 AutoTestFlow 的一句话理解

AutoTestFlow 不是“让模型写测试”的工具，而是一个用真实契约、故障知识、文件协议、机器复验和人工门共同约束 LLM 的测试工程系统。它把 AI 的创造力限制在可审计边界内，把判定权交给 contract、trace、脚本和人。

后续所有项目工作都应沿用这个判断：新增能力可以更聪明，但不能更随意；可以更自动，但不能自证；可以引入更多知识源，但不能绕过 contract。