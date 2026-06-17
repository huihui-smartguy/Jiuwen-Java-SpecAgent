# CHANGES vs 迭代6 —— 暴露的测试问题 → 本次优化

> 本文逐条映射**前几轮（迭代6 + 2012_skill/demo-run 真实复跑）暴露的测试问题**，
> 给出每条的「问题 / 证据 / 根因 / 对应优化 / 与 SpecAgent『Oracle 权威性』的呼应」。
>
> 证据来源：`2012_skill/demo-run/results-live.md`（R1–R4 + 缺轨迹 + env_issue 掩盖 + 跨栈错位）。
> 主张来源：`2012_skill/SuperTest-与-SpecAgent-设计思想对照.md`（SpecAgent BR-3「Oracle 只取规格库、永不自我认证」）。

---

## 总论

demo-run §1 一句话结论：**12/12 失败全部源于测试侧对响应结构的错误假设；当断言真正触达判据时 SUT 行为均正确，本轮 0 个确认 SUT 缺陷。** 即问题不在覆盖能力，而在 **「参考资产→断言」这一层不够权威**（garbage-in-garbage-out）。

> 这反向印证 SpecAgent 核心主张：**判据/Oracle 的权威性是第一位的**。本次优化的主线即：
> 把"信任手写参考"升级为"用真实 SUT 校准判据（contract.md）"，并用容差访问器 + 三分类 + 就绪门把"判据不符"与"环境/缺陷"彻底分开。

---

## 七条问题逐条映射

### 问题1 · R1：Task 包在 `result.task`（响应包装臆测）

| 项 | 内容 |
|----|------|
| 证据 | demo-run R1：`result:{task:{id,...,status:{state}}}`（proto oneof），测试误以为 `result` 直接是 Task；影响 001/003/008/010 |
| 根因 | 手写黑盒参考臆测了响应形态，未经真实 SUT 核实 |
| 对应优化 | **stage2.5 契约校准**（`probe_contract.py`→`contract.md` 记录真实嵌套）+ **容差访问器** `task_of(result)`（兼容 `result.task` 与 `result`） |
| 呼应 SpecAgent | Oracle 不再来自臆测，而来自对真实 SUT 的探活校准——判据权威性 |

### 问题2 · R2：JSON-RPC `id` 类型错配

| 项 | 内容 |
|----|------|
| 证据 | demo-run R2：服务端回 `id:1`（int），测试用 `== "1"`（str）严格比较；影响 001/006/011/012 |
| 根因 | 对线缆类型臆测，未做类型容差 |
| 对应优化 | **容差访问器** `id_eq(actual, expected)`；contract.md 记录真实 id 类型 |
| 呼应 SpecAgent | 判据落到"可观测且经校准"的事实，而非主观类型假设 |

### 问题3 · R3：SSE 事件 oneof 形态

| 项 | 内容 |
|----|------|
| 证据 | demo-run R3：事件 kind/taskId 提取得 None；真实为 `task`/`statusUpdate`/`artifactUpdate` oneof；影响 002/007/009 |
| 根因 | 假设 SSE 严格三段式 + 裸取 `kind`，与真实 oneof 流不符（真实流仅 N×TaskStatusUpdate）|
| 对应优化 | **容差访问器** `event_kind/event_state/event_task_id/event_is_final`；断言改为 probe 校准的**真实流不变量**（事件非空 + 每帧 kind 可识别 + 末事件终态）|
| 呼应 SpecAgent | 不可验证/过细的规约项不强判，断言对齐真实可观测形态 |

### 问题4 · R4：AgentCard.url 语义（部署配置相关）

| 项 | 内容 |
|----|------|
| 证据 | demo-run R4：`url=''`（依赖未配的 `public-base-url`），测试硬要求 url 含 `/a2a`；影响 004 |
| 根因 | 把**部署配置相关字段**当成协议必需字段做硬断言 |
| 对应优化 | **spec-required vs deployment-config-dependent 分级**：url 为部署观察项（非硬失败），核心判据落 `capabilities/skills` |
| 呼应 SpecAgent | 区分"红线必需"与"环境/部署相关"，避免假性结论（对应现状标签思想）|

### 问题5 · 缺交互轨迹

| 项 | 内容 |
|----|------|
| 证据 | demo-run §8 v3：原版无可读交互记录，定位全靠人工反推；v3 才补记录器 + `trace/<case>.jsonl` + `session.log` |
| 根因 | 执行链路不产出"请求/响应/SSE 逐帧"证据，判据失真时难溯源 |
| 对应优化 | **交互轨迹一等公民**：记录器内置 `reference/a2a_client.py`，`rules.md` 强制每用例落轨迹（`A2A_TRACE_DIR`），报告含可读轨迹 |
| 呼应 SpecAgent | 可追溯是治理层要件——判据与证据可对账 |

### 问题6 · env_issue 掩盖形态错误

| 项 | 内容 |
|----|------|
| 证据 | demo-run §6：无服务时 pytest 只得 env_issue，**无法暴露**形态假设错误；且错误分类未防"洗绿" |
| 根因 | 缺"执行前确认 SUT 就绪"的环节；env_issue 与 assertion_failure 混淆 |
| 对应优化 | **SUT 就绪门**（stage4 前探活，不就绪→env_issue 保留代码）+ **错误三分类**（env_issue / assertion_failure〔再细分"按 contract 校准" vs"疑似 SUT 缺陷"〕/ sdk_defect），并**禁止弱化 contract 背书的断言洗绿** |
| 呼应 SpecAgent | BR-1「永不自我认证」「`design_only` 不判绿」——不可达/未校准不产生假性绿 |

### 问题7 · Python 套 Java 语言错位

| 项 | 内容 |
|----|------|
| 证据 | demo-run §0/§6：迭代6 的 `framework_reference.md`/code_analysis 面向 Python SDK，被测是 Java 服务，参考层语言错位 |
| 根因 | 迭代6 stage2 按 Python 抽取，与 Java/Spring SUT 不匹配 |
| 对应优化 | **stage2 Java 化**（`java_scan_guide.md` + Java 版 `code_analysis_template.md`：扫 @RestController/@ControllerAdvice/枚举全名/oneof 包装/SSE/配置）+ **stage4 固定为 Python 黑盒**（经协议观测，不碰 Java 内部类，跨栈但解耦）|
| 呼应 SpecAgent | 锚定 Java/Spring SUT 黑盒经 `/a2a`，判据来自协议契约而非实现语言 |

> **七条全覆盖**：R1 / R2 / R3 / R4 / 缺交互轨迹 / env_issue 掩盖 / Python 套 Java 错位 —— 逐条均有对应优化。

---

## 迭代6 → java-req-test-analyzer 结构差异表

| 结构项 | 迭代6（req-test-analyzer） | java-req-test-analyzer | 性质 |
|--------|----------------------------|------------------------|------|
| **stage2.5 契约校准** | 无 | **新增**：`scripts/probe_contract.py` 探活 → `contract.md` | 新增 |
| **probe_contract.py** | 无 | **新增**：真实 SUT 探活，校准响应形态/错误码/状态枚举/SSE | 新增 |
| **shared/rules.md** | 无（规则散落 batch-gen-tests）| **新增**：断言分级 + 判据来源 + 容差 + 三分类 + 就绪门 + spec/config | 新增 |
| **shared/java_scan_guide.md** | 无 | **新增**：Java/Spring 静态扫描指南（ripgrep 模式）| 新增 |
| **reference/** | 用户提供 `ai_reference/`（Python）| **新增内置**：`a2a_client.py`（容差访问器 + 轨迹记录器）/ `conftest.py` / `framework_reference.md` | 新增 |
| **stage2 扫描** | Python 抽取（framework_reference Python）| **Java 化**：@RestController/@ControllerAdvice/枚举全名/oneof/SSE/配置 | 改造 |
| **code_analysis_template.md** | Python 取向 | **Java 版**：入口端点表/异常错误码表/枚举/序列化形态/配置分级 | 改造 |
| **stage4 用例** | Python pytest（测 Python SDK，灰盒）| **Python pytest + httpx 黑盒**：探活就绪门 + 交互轨迹 + 错误三分类 | 改造 |
| **错误分类** | passed/env_issue/sdk_issue/failed | **三分类**：env_issue / assertion_failure〔二次细分〕/ sdk_defect | 改造 |
| **断言纪律** | L0–L3、≥L1、正例≥L2、≥2维度 | **+ 判据来源纪律（contract/Grep）+ 禁臆测形态 + ≥1 值语义 + 禁洗绿** | 强化 |
| 编排器/文件即协议/.state 续跑 | 有 | **沿用** | 不变 |
| scenario_schema / merge / select_p0 / aggregate | 有 | **沿用** | 不变 |
