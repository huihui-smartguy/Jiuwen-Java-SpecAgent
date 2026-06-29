# 代码分析 — A2A 协议适配层（黑盒可观测锚点）

> module_role = "独立功能"
> 锚点目录：`/tmp/st-run/sut/agent-runtime/src/main/java/com/huawei/ascend/runtime`
> 说明：黑盒测试不导入 Java 类，仅用于 traceability（断言落在 HTTP/JSON-RPC 可观测面）。

## 1. 五个 A2A 锚点类

| 类 | 路径 | 职责 | 对外可观测面 |
|----|------|------|-------------|
| A2aJsonRpcController | `boot/A2aJsonRpcController.java` | JSON-RPC 解析 + 方法分发 + 阻塞/流式分支 | `POST /a2a`（JSON 与 SSE 两个 produces 重载） |
| AgentCardController | `boot/AgentCardController.java` | Agent Card 发现端点 | `GET /.well-known/agent-card.json`、`/.well-known/agent.json`（兼容） |
| A2aAgentExecutor | `engine/a2a/A2aAgentExecutor.java` | A2A SDK AgentExecutor ↔ Handler SPI 桥接、任务生命周期、cancel-through | 通过 emitter.submit/startWork/complete/fail/cancel 驱动 Task 状态 |
| A2aResultRouter | `engine/a2a/A2aResultRouter.java` | Agent 执行结果 → A2A Task 表面路由 | OUTPUT→artifact；COMPLETED/FAILED/INTERRUPTED→终态 emission |
| AgentCardProvider | `engine/a2a/AgentCardProvider.java` | Agent Card SPI（Handler 可实现以替换自动生成卡） | agentCard() → name/skills/capabilities |

## 2. 端点（黑盒）

- `POST /a2a` 与 `POST /a2a/`（method 分发；Accept 决定阻塞 JSON 还是 SSE）。
  - `produces=application/json`：`handle(...)` 阻塞分支。
  - `produces=text/event-stream`：`handleSse(...)` 流式分支。
- `GET /.well-known/agent-card.json`（标准）+ `GET /.well-known/agent.json`（兼容）。

## 3. 方法分发（A2aJsonRpcController.handleBlocking switch）

SendMessage / GetTask / ListTasks / CancelTask / Create|Get|List|Delete TaskPushNotificationConfig；
流式分支（handleStream）：SendStreamingMessage（terminateOnInterrupt=true）、SubscribeToTask（false）。
default → METHOD_NOT_FOUND。

## 4. Task 状态机（A2aAgentExecutor + A2aResultRouter 发射）

`SUBMITTED → WORKING → COMPLETED | FAILED | CANCELED | INPUT_REQUIRED(中断)`
- COMPLETED：`A2aResultRouter.route` 的 COMPLETED 分支 → `emitter.complete(...)`（log `task state=COMPLETED`）。
- CANCELED：`A2aAgentExecutor.cancel` → `emitter.cancel()`（log `task state=CANCELED`）。
- FAILED：执行异常 → `emitter.fail(...)`。
- 终态集 TERMINAL = {COMPLETED, FAILED, CANCELED}。

## 5. JSON-RPC 错误码映射（A2aJsonRpcController.handle catch 链 — 直接代码事实）

| 异常 | 映射 code | 常量 |
|------|----------|------|
| `JsonProcessingException` / `com.google.gson.JsonParseException` | -32700 | A2AErrorCodes.JSON_PARSE |
| `MethodNotFoundJsonMappingException` / `IllegalArgumentException` | -32601 | A2AErrorCodes.METHOD_NOT_FOUND |
| `JsonMappingException`（形状不匹配） | -32600 | A2AErrorCodes.INVALID_REQUEST |
| 其它 `Exception` / 序列化失败 | -32603 | A2AErrorCodes.INTERNAL |

- 所有错误经 `errorResponse(id, error)` → `JSONRPCUtils.toJsonRPCErrorResponse(id, error)`，**回带原 request id**。
- SSE 解析失败（handleSse 的 catch）→ 单帧 `errorEvent(null, JSON_PARSE)`。
- parse error / method-not-found 在分发前抛出，**不进入 execute()，不创建 task**（代码事实：解析/分发失败早于 handler.onMessageSend）。

## 6. SSE 行为（A2aJsonRpcController.handleStream）

- 事件名固定 `event: jsonrpc`；data 为 `SendStreamingMessageResponse` 的 JSON（含 result 载荷）。
- `SendStreamingMessage`：`flux.takeUntil(isStreamTerminating)` — 在 `TaskStatusUpdateEvent.status.state.isFinal() || isInterrupted()` 时关闭流。
- 中途失败 `onErrorResume` 末尾追加一帧 JSON-RPC error（不裸断流）。
- `SubscribeToTask`：terminateOnInterrupt=false（中断态不关闭，续订语义）。

## 7. Agent Card 字段（AgentCardController + AgentCard）

返回 AgentCard JSON，含 name / description / version / skills / capabilities(streaming, pushNotifications) / url(endpoint，base 由 public-base-url 或请求推导)。
