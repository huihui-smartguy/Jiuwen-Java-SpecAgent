# 共享规则与跨阶段纪律

> 本文件定义 `java-req-test-analyzer` 所有阶段必须遵守的共用纪律。
> 核心立场：**判据（Oracle）权威性第一**。断言只能基于已校准的契约或核实过的源码，
> 绝不臆测响应形态。本纪律直接吸收上一轮 demo-run 暴露的 R1–R4 反例（见 §2）。

---

## 核心保证

1. **判据先于断言** —— 任何期望值出现前，必须能指回 `contract.md`（stage2.5 校准产物）或 Grep 核实的源码行。
2. **单用例责任制** —— 1 用例 = 1 Agent，独立完成生成→执行→修复→记录，**不允许任何理由合并**。
3. **交互轨迹强制采集** —— 记录器已内置于 `reference/a2a_client.py`，每条用例必须产出可读请求/响应/SSE 轨迹。
4. **就绪门后才执行** —— stage4 执行前必须探活 SUT，不就绪即 `env_issue` 并保留代码，绝不"洗绿"。
5. **断言必须能发现缺陷** —— 禁止无效断言，每条断言都要能捕获被测服务的真实偏差。

---

## 1. 断言质量规则

### 等级定义

| 等级 | 特征 | 能否发现缺陷 | 示例（黑盒 A2A） |
|------|------|:---:|------|
| **L0 禁止** | 仅存在性/非空 | 否 | `assert resp is not None` / `assert len(events) > 0` |
| **L1 最低** | 检查关键字段值 | 勉强 | `assert task_of(resp["result"])["status"]["state"] == "COMPLETED"` |
| **L2 合格** | 结构 + 值语义 + 类型/数量 | 能 | `assert normalize_state(...) == "COMPLETED"` 且 `assert id_eq(resp["id"], req_id)` |
| **L3 优秀** | L2 + 过程/状态/轨迹验证 | 高 | L2 + SSE 末事件终态校验 + GetTask 复查一致 |

### 强制要求

- **所有断言 ≥ L1**：L0 不得作为最终断言。
- **正例（positive）用例 ≥ L2**：必须验证返回结构关键字段的**值语义**，而非仅存在性。
- **每个用例至少包含 1 条 L2（值语义）断言** —— 值语义=对字段取值/枚举/错误码做精确判定。
- **每个用例 ≥ 2 个维度**的断言：
  - **内容维**：返回值内容/结构/字段取值（如 `status.state`、`error.code`、Agent Card 字段）。
  - **过程维**：执行过程产生的事件序列/SSE 终态/状态前后对比/交互轨迹（如 SSE 末事件 = 终态、GetTask 复查）。

```python
# 内容维 + 过程维 双维示例
assert normalize_state(task_of(resp["result"])["status"]["state"]) == "COMPLETED"   # 内容维(L2)
assert event_state(events[-1]) in TERMINAL_STATES                                   # 过程维
```

---

## 2. 判据来源纪律（最高红线）

**断言与期望值一律源自以下二者之一，二者之外一律视为臆测、禁止：**

| 合法来源 | 说明 |
|----------|------|
| **`contract.md`** | stage2.5 用真实 SUT 探活校准得到的响应契约（线缆形态、错误码、状态枚举、SSE 形态、id 类型）。|
| **Grep 核实的源码** | 在被测 Java 仓中实际命中的注解/常量/枚举/序列化逻辑（标注 `文件:行号`）。|

### 禁止臆测响应形态 —— 点名上轮反例

| 编号 | 臆测错误（反例） | 真实形态 | 纪律 |
|------|------------------|----------|------|
| **R1** | 以为 `result` 直接是 Task | Task 包在 `result.task`（proto oneof） | 用 `task_of(result)`，勿裸取 `result["status"]` |
| **R2** | 用 `== "1"` 严格比较 JSON-RPC `id` | SUT 回带 `id` 为 **int**（请求侧为 str） | 用 `id_eq(actual, expected)` 类型容差 |
| **R3** | 假设 SSE 严格三段式 / 裸取 `event["kind"]` | 事件 result 是 oneof：`task`/`statusUpdate`/`artifactUpdate` | 用 `event_kind/event_state/event_task_id` |
| **R4** | 要求 `AgentCard.url` 含 `/a2a` | `url` 是服务基址，且依赖 `public-base-url` 配置（可能为空） | 见 §6，按部署配置相关项处理 |

> 教训（demo-run §6）：参考一旦写错，12 条用例继承同一批错误假设（garbage-in-garbage-out）。
> 所以本 skill 把"用真实 SUT 校准判据"（stage2.5）作为硬环节，而非信任手写参考。

---

## 3. 形态容差访问器（强制使用）

`reference/a2a_client.py` 已提供以下容差访问器。**断言一律经访问器读取，禁止裸字段访问**（裸访问会重蹈 R1–R4）：

| 访问器 | 用途 | 替代的裸访问（禁止） |
|--------|------|----------------------|
| `task_of(result)` | 提取 Task（兼容 `result.task` 与 `result` 自身） | `result["status"]` / `result["id"]` |
| `id_eq(actual, expected)` | JSON-RPC id 类型容差比较 | `resp["id"] == "1"` |
| `event_kind(ev)` | SSE 事件骨架名（按 oneof 形状映射） | `ev["kind"]` |
| `event_state(ev)` | SSE 事件 `status.state`（已归一前缀） | `ev["data"]["status"]["state"]` |
| `normalize_state(state)` | 容错 `TASK_STATE_*` 前缀写法 | 直接比较带前缀字符串 |

> 配套：`event_task_id`、`event_payload`、`event_is_final` 亦可用；轨迹记录器（`record_request/response/sse_event`）已在客户端内联，无需手动调用。

---

## 4. 错误三分类（不得用弱化断言"洗绿"）

每条未通过用例必须归入且仅归入以下一类：

| 分类 | 触发条件 | 处理 |
|------|----------|------|
| **env_issue** | 连接失败 / SUT 未就绪 / 依赖缺失（httpx、网络、服务未起） | 标记，**保留代码**，不修改断言 |
| **assertion_failure** | 断言与实际响应不符 | 进一步细分（见下），**禁止**通过删弱断言来转绿 |
| **sdk_defect** | 被测服务抛错 / 返回 5xx / 协议违例 | 标记为疑似 SUT 缺陷，记录证据 |

### assertion_failure 二次细分

| 子类 | 判定 | 正确动作 |
|------|------|----------|
| **断言需按 contract 校准** | 断言基于臆测形态（如 R1–R4），contract.md 显示真实形态不同 | 回到 contract.md / Grep 修正断言（仍 ≥L2） |
| **疑似 SUT 缺陷** | 断言已对齐 contract，但实际响应仍违反协议必需约束 | 记录为观察/缺陷，**不削弱断言** |

> **红线**：不得通过弱化由 contract 背书的断言（如把 L2 降成 L0、删去值语义判定）来让用例转绿。
> 转绿的唯一合法路径是"断言确实臆测错了，按 contract 校准"，而非"判据本身不可信但强行放行"。

---

## 5. SUT 就绪门（stage4 前置）

stage4 生成/执行任何用例**之前**，编排器必须探活 SUT：

```
探活：GET /.well-known/agent-card.json（或 /health）→ 2xx 且可解析 AgentCard
  ├── 就绪      → 进入 stage4 执行
  └── 不就绪    → 全部用例标记 env_issue，保留已生成代码，不计为 assertion_failure / 缺陷
```

> 目的：避免无服务时 pytest 只得到 env_issue 却掩盖了形态假设错误（demo-run §6 反思）。
> 就绪门把"环境不可达"与"判据不符"彻底分开，二者绝不混为一谈。

---

## 6. spec-required vs deployment-config-dependent

字段断言强度按其规约地位分级：

| 类别 | 定义 | 断言强度 | 示例 |
|------|------|----------|------|
| **spec-required** | 协议必需字段 | **硬断言**（违反即缺陷） | `error.code`、Task `status.state`、JSON-RPC `id` 回带 |
| **deployment-config-dependent** | 取值取决于部署配置 | **观察项**（记录，不作硬失败） | `AgentCard.url`（依赖 `public-base-url`，未配置时可空） |

> R4 即典型：`AgentCard.url` 为空是部署配置观察项，核心判据应落在 `capabilities`/`skills` 等 spec-required 字段。

---

## 7. 并发与隔离

| 规则 | 说明 |
|------|------|
| **1 用例 = 1 Agent** | 硬性约束，违反即任务失败回滚；即使用例来自同一设计文件也独立 Agent |
| **批次大小** | `--case-batch-size` 控制并发（默认 5），滑动窗口满载 |
| **Agent 间无状态** | 仅经文件协议传递；结果各自记录到 `case_results.json` |
| **轨迹一等公民** | 每条用例落 `trace/<case>.jsonl`，会话日志落 `trace/session.log`（设置 `A2A_TRACE_DIR` 启用）|

---

## 8. 禁止事项速查

| 禁止行为 | 正确做法 |
|----------|----------|
| 臆测响应形态（R1–R4 类） | 查 `contract.md` 或 Grep 源码核实 |
| 裸字段访问 SUT 响应 | 用 §3 容差访问器 |
| 弱化 contract 背书的断言以转绿 | 仅当断言确为臆测错误时按 contract 校准 |
| 仅 L0 断言 / 只有 1 条断言 | ≥L1 且 ≥2 维度，正例 ≥L2，含 ≥1 条值语义 |
| 1 个 Agent 处理多用例 | 1 用例 1 Agent |
| 无服务时仍判 assertion_failure | 探活不就绪 → env_issue，保留代码 |
| 把部署配置相关字段当硬断言 | 按 deployment-config-dependent 记为观察项 |
