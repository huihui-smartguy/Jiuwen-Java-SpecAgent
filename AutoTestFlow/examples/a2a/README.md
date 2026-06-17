# examples/a2a/ —— A2A 工作锚点（worked anchor）

> 本目录是本 skill 的 **A2A 实例化锚点**：一份**已在真实 SUT 验证**的协议特化示例
> （对齐 `spring-ai-ascend` 的 `agent-runtime`，`POST /a2a` + JSON-RPC + GET AgentCard）。
> 它演示如何把通用脚手架（`reference/http_client.py` + `reference/conftest.py`）
> **针对某一具体协议契约特化**。换 SUT/协议时，照此目录另起一份等价示例即可。

## 文件

| 文件 | 说明 |
|------|------|
| `a2a_client.py` | **A2A 特化客户端**：扩展通用黑盒模式，增加 A2A 专有方法（`send_message`/`get_task`/`send_streaming_message`/...）、JSON-RPC 常量（`ERR_PARSE`/`TASK_STATES`/...）与协议形态访问器（`task_of`/`event_kind`/`event_state`/`event_task_id`） |
| `framework_reference.md` | A2A 复用资产说明：列出 `A2aClient` 公开方法、JSON-RPC 约定、判据常量、SSE 解析约定与黑盒约束 |

## 与通用 `reference/` 的关系

- `reference/http_client.py` 提供**协议无关**的黑盒原语（`get`/`post_json`/`stream`/`raw_post`）、
  交互轨迹记录器（`record_request/response/sse_event`、脱敏、never-raise）、
  通用 helpers（`id_eq`/`normalize_state`/`parse_sse_lines`）。
- 本目录的 `a2a_client.py` 在此通用模式之上**特化**：构造 JSON-RPC envelope、按 `result.task`
  / SSE `oneof`（`task`/`statusUpdate`/`artifactUpdate`）等真实线缆形态读取响应。

## stage4 如何据契约特化

stage2.5 探活校准产出权威 `contract.md` 后，stage4 据其把通用 `reference/http_client` 特化为
针对某协议的客户端：

1. 构造该协议的请求 envelope（A2A 例：`{"jsonrpc":"2.0","method":...,"id":...,"params":...}`）；
2. 按 `contract.md` 记录的真实响应包装/字段路径/枚举/错误码/SSE 事件形态写访问器
   （A2A 例：`task_of`/`event_kind`/`event_state`，容错 id 类型与 `TASK_STATE_*` 前缀）；
3. 断言一律落在 `contract.md` 背书的可观测判据上，禁止臆测响应形态。

> 本 A2A 示例即按上述流程，针对 agent-runtime 的真实契约特化而成，可作为新协议特化的范本。
