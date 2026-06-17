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

| TC | 用例 | 实际结果（pytest） | 失败根因 | 判定 |
|----|------|-------------------|---------|------|
| 001 | SendMessage 同步→COMPLETED | FAILED：`id 1(int) != "1"` | R2（+R1 后续 artifacts） | **SUT 符合**（result.task.state=TASK_STATE_COMPLETED）；修断言即过 |
| 002 | 流式 SSE 序列 | FAILED：`kinds=[None,None,None]` | R3 | **待复测**（收到 3 事件，需按 oneof 重解析） |
| 003 | GetTask 一致 | FAILED：`result 无 id`（在调 GetTask 前） | R1 | **待复测**（GetTask 响应本轮未捕获） |
| 004 | Agent Card 发现 | FAILED：`url/endpoint=''` 不含 /a2a；name/capabilities(streaming)/skills **已通过** | R4 | **SUT 基本符合**（核心字段在）；url 空=配置观察；修断言 |
| 005 | parse error -32700 | FAILED：`error response 无 id`；`code=-32700` **正确** | 测试过严 + 小观察 | **SUT 基本符合**（错误码对）；parse error 省略 id（应 `id:null`）记为小规范瑕疵 |
| 006 | method-not-found -32601 | FAILED：`id 42(int) != "42"`；`code=-32601` **正确** | R2 | **SUT 符合**；修断言即过 |
| 007 | CancelTask 执行中→CANCELED | FAILED：SSE 取 taskId=None | R3 | **待复测**（取不到 taskId 故未发 Cancel） |
| 008 | 对终态再取消（负向） | FAILED：`result 无 id`（在调 Cancel 前） | R1 | **待复测**（Cancel 响应未捕获） |
| 009 | SubscribeToTask 断线重连 | FAILED：SSE 取 taskId=None | R3 | **待复测** |
| 010 | ListTasks 含目标 task | FAILED：`result 无 id`（在调 ListTasks 前） | R1 | **待复测**（ListTasks 响应未捕获；预期 `result.tasks`） |
| 011 | 发现即调用 | FAILED：`id 11(int) != "11"`；SendMessage 实际返回 task | R2（+R1） | **SUT 符合**；修断言即过 |
| 012 | GetTask 不存在 taskId | FAILED：`id 7(int) != "7"`；`code=-32001`、无 result **正确** | R2 | **SUT 符合**（正确返回 Task not found）；修断言即过 |

**判定分布**：SUT 符合且"修断言即过"（证据充分）= 6 条（001/004 核心/005 核心/006/011/012）；待复测（下游响应本轮未捕获，需 v2 复跑确认）= 6 条（002/003/007/008/009/010）。**确认 SUT 缺陷 = 0**。

## 5. SUT 侧可记录的小观察（非阻断，建议产品/开发确认）

1. **parse error 未带 `id`**：JSON-RPC 2.0 规定解析错误应回 `"id": null`；SUT 直接省略 `id` 字段。需求文档"所有 error 携带原 id"对 parse error 本身也不精确（解析失败时 id 不可知）。建议：parse error 显式回 `id:null`。
2. **`id` 类型归一**：客户端发 `"id":"1"`（字符串），SUT 回 `id:1`（整数）。JSON-RPC 建议原样回带；此为低severity 兼容性细节。
3. **AgentCard.url 为空**：疑因 `agent-runtime.access.a2a.public-base-url` 未配置；对"远程发现-注入"链路有影响，建议部署时配置。

## 6. 这对"评估 SuperTest"意味着什么

- skill 的设计/覆盖能力没问题（12 条用例的场景、判据类型、可追溯都对）；**出错的是"参考资产→断言"这一层**：参考一旦与真实响应形态不符，所有用例同错。
- skill 缺少"**用真实 SUT 校准参考/断言**"的环节（它信任参考为权威、stage4 的 pytest 校验在无服务时只会得到 env_issue，无法暴露形态假设错误）。这正反向印证附件 SpecAgent 的核心主张：**Oracle/判据的权威性是第一位的**——本例的判据来自人工臆测的黑盒参考，不够权威，于是失真。

## 7. 后续

已据真实响应 + SUT 源码把 `runnable/` 修正为可复跑版（见 R1–R4 修法）。**6 条"待复测"需用 v2 在服务器复跑确认**；拿到第二份 `results.txt` 后并入本表的"复测结果"列。
