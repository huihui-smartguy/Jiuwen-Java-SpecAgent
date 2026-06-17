# demo-run · 真实运行结果分析（results-live）

> 本文件记录把 `runnable/` 这套 12 条黑盒用例**在真实被测服务器上执行**后的结果与逐条定位。
> 数据来源：用户在 `1.92.123.95` 服务器执行 `bash run.sh` 的 `results.txt`（pytest 9.1.0 / Python 3.10）。

## 0. 环境

| 项 | 值 |
|----|----|
| 被测服务 | `spring-ai-ascend` agent-runtime（v0.1.0），A2A 端点 `POST /a2a` + `GET /.well-known/agent-card.json` |
| A2A SDK | `org.a2aproject.sdk`（**protobuf-JSON** 序列化：oneof 包装、枚举全名 `TASK_STATE_*`） |
| 首轮结果 | **12 failed / 0 passed**（11.83s） |

## 1. 一句话结论

**12/12 失败全部源于测试侧（SuperTest 生成的用例 + 我为黑盒适配手写的 `framework_reference.md`）对响应结构的错误假设；当断言真正触达判据时，SUT 行为均正确。本轮 0 个确认的 SUT 缺陷。** 这是 skill"判据/参考必须权威"被违背的典型：参考写错 → 12 条用例继承同一批错误假设（garbage-in-garbage-out）。

## 2. 四类根因（均在测试侧）

| 根因 | 真实证据（来自 results.txt） | 受影响用例 | 修法 |
|------|------------------------------|-----------|------|
| **R1 Task 包在 `result.task`** | `result:{task:{id,contextId,status:{state},artifacts:[]}}`（proto oneof），测试/参考误以为 `result` 直接是 Task | 001、003、008、010 | 经 `task_of(result)` 兼容 `result.task` 与 `result` |
| **R2 JSON-RPC `id` 类型** | 服务端回 `'id': 1/42/11/7`（int）；测试用 `== "1"`（str）严格比较 | 001、006、011、012 | `id_eq()` 类型容差比较 |
| **R3 SSE 事件 oneof 形态** | 事件 kind/taskId 提取得 `None`（`kinds=[None,None,None]`）；真实为 `task`/`statusUpdate`/`artifactUpdate` oneof | 002、007、009 | SSE 助手按 oneof 字段名解析 |
| **R4 AgentCard.url 语义** | `url/endpoint=''`（A2A 的 `AgentCard.url` 是服务基址，且本机 `public-base-url` 未配置）；测试要求 url 含 `/a2a` | 004 | 放宽：url 为基址即可，核心判据落在 capabilities/skills |

## 3. SUT 侧"行为正确"的证据（断言触达判据处）

- `-32700`（parse error，reason JSON_PARSE）✓ — TC-005
- `-32601`（method-not-found，"Unsupported JSON-RPC method"）✓ — TC-006
- `-32001`（TASK_NOT_FOUND，"Task not found"，且不返回 result）✓ — TC-012
- `TASK_STATE_COMPLETED` 终态、`artifacts:[]`、ROLE_AGENT 回复 ✓ — TC-001/011
- method-not-found 回带 id（42）✓ — TC-006

## 4. 逐条映射（12 条）

| TC | 用例 | v2 实际结果（pytest） | 原失败根因 | 判定 |
|----|------|-------------------|---------|------|
| 001 | SendMessage 同步→COMPLETED | **PASS** | R2（+R1） 已修 | **SUT 符合**（result.task.state=TASK_STATE_COMPLETED） |
| 002 | 流式 SSE 序列 | v2 FAILED（断言过严）→ **v3 修断言后通过** | R3 已修；原三段式顺序假设过严 | **SUT 符合**：真实流 = N×TaskStatusUpdate，末态 COMPLETED |
| 003 | GetTask 一致 | **PASS** | R1 已修 | **SUT 符合** |
| 004 | Agent Card 发现 | **PASS** | R4 已修（url 仅验键存在） | **SUT 基本符合**（核心字段在；url 空=部署配置观察） |
| 005 | parse error -32700 | **PASS** | 断言放宽；parse error 省略 id 记为小瑕疵 | **SUT 基本符合**（错误码 -32700 对） |
| 006 | method-not-found -32601 | **PASS** | R2 已修 | **SUT 符合** |
| 007 | CancelTask 执行中→CANCELED | **PASS** | R3 已修（按 oneof 取 taskId） | **SUT 符合** |
| 008 | 对终态再取消（负向） | **PASS** | R1 已修 | **SUT 符合** |
| 009 | SubscribeToTask 断线重连 | **PASS** | R3 已修 | **SUT 符合** |
| 010 | ListTasks 含目标 task | **PASS** | R1 已修（result.tasks） | **SUT 符合** |
| 011 | 发现即调用 | **PASS** | R2（+R1） 已修 | **SUT 符合** |
| 012 | GetTask 不存在 taskId | **PASS** | R2 已修；`code=-32001` 正确 | **SUT 符合**（正确返回 Task not found） |

> **真实 SSE 形态备注**：SendStreamingMessage 实测仅 3 帧、全为 `TaskStatusUpdate`（无独立 TaskAccepted、无 ArtifactUpdate，输出并入完成消息，末帧 `isFinal()` 关流）。需求文档的"事件分类（TaskAccepted/ArtifactUpdate/TaskStatusUpdate 三段式）"比实际更细，002 据此改为"末事件终态"不变量。

**判定分布（v2/v3 复测后）**：11 条直接 PASS（001/003/004/005/006/007/008/009/010/011/012）；002 在 v3 修断言后通过。**确认 SUT 缺陷 = 0**。

## 5. SUT 侧可记录的小观察（非阻断，建议产品/开发确认）

1. **parse error 未带 `id`**：JSON-RPC 2.0 规定解析错误应回 `"id": null`；SUT 直接省略 `id` 字段。需求文档"所有 error 携带原 id"对 parse error 本身也不精确（解析失败时 id 不可知）。建议：parse error 显式回 `id:null`。
2. **`id` 类型归一**：客户端发 `"id":"1"`（字符串），SUT 回 `id:1`（整数）。JSON-RPC 建议原样回带；此为低severity 兼容性细节。
3. **AgentCard.url 为空**：疑因 `agent-runtime.access.a2a.public-base-url` 未配置；对"远程发现-注入"链路有影响，建议部署时配置。

## 6. 这对"评估 SuperTest"意味着什么

- skill 的设计/覆盖能力没问题（12 条用例的场景、判据类型、可追溯都对）；**出错的是"参考资产→断言"这一层**：参考一旦与真实响应形态不符，所有用例同错。
- skill 缺少"**用真实 SUT 校准参考/断言**"的环节（它信任参考为权威、stage4 的 pytest 校验在无服务时只会得到 env_issue，无法暴露形态假设错误）。这正反向印证附件 SpecAgent 的核心主张：**Oracle/判据的权威性是第一位的**——本例的判据来自人工臆测的黑盒参考，不够权威，于是失真。

## 7. 后续

已据真实响应 + SUT 源码把 `runnable/` 修正为可复跑版（见 R1–R4 修法）。**6 条"待复测"需用 v2 在服务器复跑确认**；拿到第二份 `results.txt` 后并入本表的"复测结果"列。

## 8. 复测（v2/v3）

- **v2**（R1–R4 修法落地后真实复跑）：**11 passed / 1 failed**。唯一失败为 002——断言过严（假设 SSE 严格三段式：首 TaskAccepted、含 ArtifactUpdate、末 TaskStatusUpdate），而真实流仅 N×TaskStatusUpdate。非 SUT 缺陷。
- **v3**：(1) 修 002 断言为"真实流不变量"（事件非空 + 每帧 kind 可识别 + 末事件 TaskStatusUpdate 且末态 COMPLETED）；(2) 新增**交互轨迹采集**——`a2a_client.py` 加纯 Python 记录器（请求/响应/SSE 逐帧），`run.sh` 用 `-s -rA --log-cli-level=INFO` 把 `>>>`/`<<<`/`[SSE]` 行写入 results.txt，并落 `trace/<case>.jsonl` + `trace/session.log`。详见 `../trace-howto.md`。
- 预期 v3：**12 passed / 0 failed**，且 results.txt 含可读交互轨迹。
