# 02 · AutoTestFlow 现状与可注入点分析

> 目的：把流水线的阶段、产物、纪律讲清楚，找出"故障库该插在哪、为什么是那里"，
> 并用 a2a 的真实产物实证"测不出模块"的根因。

---

## 一、流水线阶段与产物（文件即协议）

标准模式：`0(可选)→1→2→2.5→3a→3b→4a→4b→5`（`SKILL.md`）。各阶段是**隔离子 Agent**，
数据**只经文件**流转：

| 阶段 | 模板 | 关键产物 | 角色 |
|---|---|---|---|
| 1 需求侧分析 | `stage1_req_analyze.md` | `.state/s1_index.json`、`.state/s1_scenarios/FS-*.json` | 拆功能点(FP)/场景(FS)，含 `branches` |
| 2 Java 代码扫描 | `stage2_code_scan.md` | `.state/s2_code_facts.json`、`.state/framework_scenes.json` | entry_catalog / exception / constraint / code_defects / serialization_facts |
| **2.5 契约校准** | `stage2_5_contract_calibrate.md` | **`contract.md`** ★、`.state/contract_samples.json` | **唯一权威 Oracle**；脚本 `probe_contract.py` |
| 3a-gap / 3a-fw | `stage3a_gap.md` / `stage3a_framework.md` | `.state/s3a_enriched/*.json`、`.state/s3a_framework.json` | 代码独有能力 GAP + 框架场景 |
| 3a 合并 | （脚本） | `.state/s3a_enriched_index.json` | `merge_enriched.py` |
| **3b 用例设计** | `stage3b_batch_design.md` | **`test_design.json`** ★、`scene_tc_mapping.json` | 出用例；脚本 `merge_test_design.py` |
| 4a/4b 生成执行 | `stage4a_p0_verify.md` / `stage4b_batch_gen.md` | `test_{id}.py`、`.state/results/{id}.json`、`case_results.json` | pytest 执行 + 5 分类；脚本 `select_p0.py` / `aggregate_results.py` |
| 5 报告 | `stage5_report.md` | `report.md` | 汇总 + 缺陷清单 |

### 编排器原则（`SKILL.md` §编排器原则）——为何"外置文件"是正解

| 原则 | 原文要点 |
|---|---|
| 零知识调度 | 编排器只检查文件存在性、读几 KB 的 progress.json，**不读业务文件** |
| 全 Agent 隔离 | 每阶段独立子 Agent，编排器只收一行摘要 |
| **文件即协议** | 所有数据通过文件传递；**`contract.md` 是 stage2.5→stage3b/4 的协议载体** |
| 后台化高量 | 4a/4b case 级 Agent `run_in_background=True` |

> 这意味着：要给流水线"加知识"，**标准做法就是加一个文件 + 一个产出它的步骤**，然后让下游按
> "文件存在性"来条件消费。故障库走这条路，与 `contract.md` 完全同构；硬编码进提示词则违背零知识调度
> 与文件即协议，是仓库里唯一的反模式。

### 既有确定性脚本模式——`match_faults.py` 的范本

`scripts/` 下 `select_p0.py` / `probe_contract.py` / `merge_test_design.py` / `merge_enriched.py` /
`aggregate_results.py` 全是**纯 Python**：做选择、合并、聚合、探活这类**确定性 join/筛选**逻辑，
不进 LLM 热路径。**故障匹配（集合交、等值 join、按表降级）恰是这种形状**，因此应做成同款脚本
（可单测、可复现），而非 LLM 阶段。

---

## 二、流水线里"早已为故障留好的位置"

并非要硬塞——很多概念已经存在，故障只是**填进去**：

1. **场景 `branches`**：`branches.{parameter, boundary, exception, quality, constraint, cross}`
   （`shared/scenario_schema.md`）。故障按 `tags` 天然落到 `exception/boundary/quality`。
2. **`code_defects`（CD）**：stage2 已会识别代码缺陷并强制全覆盖（`SKILL.md` 强制覆盖规则
   "CD_xxx（高严重度）强制全覆盖"）。故障是它的"经验侧"补充。
3. **`oracle_refs{spec_id, assert_level, authority}`**：用例已用它把断言指回 `contract.md` 的 specId。
   故障用例**复用同一结构**即可，断言源不变。
4. **断言分级 L0–L3 与 spec-required/deployment-config-dependent**（`shared/rules.md` §1/§6）：
   故障的 `assertion_level` 直接对齐这套分级。
5. **`test_type: scenario | dfx`**：性能/可靠性/安全等非功能维度已有 `dfx` 占位轨道，
   FC-PERF/FC-SEC 类故障可走 `dfx`（规划占位）或 `quality` 分支。

### 已预留的"规格库 seam"（最强信号）

- `DESIGN.md` §3：缺规格库 → 人工裁决补位；**规格库就位后可降级为自动**。
- `SKILL.md` §人工裁决：stage1、stage3b 后两道**强制** `AskUserQuestion` 门，是"判据缺位"的临时补偿；
  **规格库就位后这两个门可降级为自动通过**。
- `rules.md` §3：人工确认结论应"沉淀进**规格库**（如 `.state/spec_decisions.json` 或文档）"。
- `spec.md`：`Specification_Repository/` 自述为"**与测试智能体对接的规格库目录**"。

> 故障库是这个 seam 的首个实例。把它接进来，不仅能补故障覆盖，长期还能让 stage3b 的人工门
> （"某断言点是 spec-required 还是观察项、边界取值"）逐步降级为自动——这正是 `DESIGN.md` 许诺的演进。

---

## 三、a2a"测不出模块"的实证（根因）

### 3.1 a2a 场景与 SUT

- A2A = Agent-to-Agent，HTTP + JSON-RPC；SUT = spring-ai-ascend / agent-runtime。
- 单入口 `POST /a2a`（按 body 内 `method` 分发：SendMessage / SendStreamingMessage / GetTask /
  CancelTask / ListTasks / SubscribeToTask），加发现端点 `GET /.well-known/agent-card.json`。
- 三种模式：同步阻塞、SSE 流式、异步查询（`a2a-protocol-support-walkthrough.md`）。

### 3.2 生成用例的性质（`2012_skill/demo-run/`）

12 条用例：约 **7 正向 / 4 异常 / 1 边界**；oracle 类型集中在 `task_state / sse_sequence / id_echo /
agent_card / error_code`——**全是"可见协议契约结果"**，断言基本在确认"流程跑通、终态对、错误码对"。

- TC-A2A-001 SendMessage 同步：`assert state == "COMPLETED"`、id 回带、artifacts 是 list —— happy-path。
- TC-A2A-002 SSE：消费整条流，断言事件 kind 合法、末事件终态 == COMPLETED —— happy-path 骨架。
- TC-A2A-005 parse error（-32700）、TC-A2A-006 method-not-found（-32601）—— **仅有的 2 条真实负向**。
- TC-A2A-008 对终态任务再取消 —— 唯一边界。

### 3.3 缺口（与故障库分类逐一对照）

| 维度 | 当前覆盖 | 故障库可补 |
|---|---|---|
| Happy-path E2E | ✓✓✓ | — |
| 协议违例（FC-PROTO） | 仅 parse/method | 缺：非法 envelope、缺 method/id、类型不符、超大载荷 |
| 状态机（FC-STATE） | 仅终态再取消 | 缺：双重取消、交错操作、陈旧引用 |
| **SSE 流式（FC-SSE）** | **0** | 半截流、损坏帧、乱序/重复、缺终态帧 |
| **超时/性能（FC-PERF）** | **0** | 30s 阻塞超时快照、流 keepalive、重连上限 |
| **关联资源（F-REQ-011）** | **0** | agentId/sessionId 不存在 → 应失败 |
| **错误质量（FC-RES）** | **0** | error 缺 id 回带、HTTP 码不当、编码 |
| 安全/并发（FC-SEC） | 0 | 越权、注入、并发竞态 |

`testing_recommendations.md` 已明列却未测：30s 超时返回 WORKING 快照、SSE 必须终态后关闭、
Runtime 就绪门拒绝、Handler 异常须在 SSE 末追加 error 帧。**这些恰是故障库 FC-SSE/FC-STATE/FC-PERF
要系统性补的。**

### 3.4 SUT 模块视角——为何"测不出模块"

spring-ai-ascend 是多模块平台：**agent-runtime**（A2A 接入面/Run 生命周期/引擎调度/会话/任务控制/
事件队列）、**agent-service**（注册发现）、**agent-bus**（跨面控制 ingress/callback）、**agent-sdk**、
及 config/discovery/gate 等。a2a 用例**只触达 agent-runtime 的 A2A 接入面，且只走 happy-path**——
自然"测不出模块"：它没有用失败模式去逼出某个模块（资源校验、SSE 发射器、超时控制、任务存储）的真实行为。
**故障库的作用，就是用每条故障把一个具体模块的失败处理逼出来。**

---

## 四、关键事实（影响匹配设计，务必记牢）

1. **`entry_catalog` 无 HTTP 动词字段**：其 schema 为 `{class, method, signature, params, source_file}`
   （`shared/scenario_schema.md`），HTTP 动词/路径在 `contract.md` / `code_analysis.md` 的散文里；
   a2a 的真实分发键是 body 内 JSON-RPC `method`。
   → 故障"端点匹配"**不能**按 `entry_catalog` 的 verb 直连；要从 `contract.md`（含 `SPEC-ERR-*`、
   `SPEC-SSE` 等）+ RPC 方法清单构建"端点/方法清单"，verb 只作宽松过滤，真正的区分靠 specId/标签/历史/关联字段。
2. **`merge_test_design.py` 逐字透传整个用例 dict**：新字段 `fault_ref` 可安全穿过合并，无需改合并脚本。
3. **`aggregate_results.py` 存在键名不一致**：它按 `sdk_bug` 取数，而 stage4 写的是 `sdk_defect`
   （`rules.md`/模板均用 `sdk_defect`）。→ 闭环反馈与报告计数依赖该字段，**Phase 2 需顺手修正**。
4. **5 分类是最终兜底**：`harness_defect`（自修）/`sut_unsatisfied`（skip 不算失败）/`sdk_defect`
   （契约背书的真实缺陷）/`env_issue`（就绪门拦截）/`pass`。故障用例即便断言写宽了，也只会落
   `sut_unsatisfied`（skip），不会误判缺陷——**没有任何故障能"洗绿"或被高估为缺陷**（`rules.md` §4 红线）。

---

## 五、本章结论：注入点定位

综合"文件即协议 + contract-first + 确定性脚本范本 + 关联资源/SSE 缺口"：

> **最自然的注入点 = 在 stage2.5（`contract.md` 就位）之后、stage3b（用例设计）之前，
> 新增一个确定性"故障匹配"步骤（2.6）。**

- 必须在 2.5 之后：契约调和需要 `contract.md` 才能给断言封顶（contract-first 的前提）。
- 必须在 3b 之前：3b 要消费匹配计划来产出故障用例。
- 放在 2.5 紧后（而非塞进 3a）：保持它是一道**干净的确定性门**，与 `probe_contract.py` 先于 2.5、
  `select_p0.py` 先于 stage4 的现有节律一致。

具体架构、`fault_matches.json` schema、模板钩子与契约安全见 `03-集成设计方案.md`。
