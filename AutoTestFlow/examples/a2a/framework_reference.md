# framework_reference.md（黑盒 A2A 测试复用资产）

> ⚠️ 演示适配说明：SuperTest 原生的 `framework_reference.md` 由 `extract-framework-aw` 从 **Python 测试框架**
> 抽取，描述 openjiuwen Python SDK。被测 `spring-ai-ascend/agent-runtime` 是 **Java 服务**，A2A 是其对外
> **黑盒 HTTP + JSON-RPC** 协议（`POST /a2a` + `GET /.well-known/agent-card.json`）。因此本参考由人工编写，
> 描述一个**基于 httpx 的黑盒客户端**，供 stage4 生成 pytest 用例时复用。**禁止猜测**未在此列出的 API。

## 0. 运行前置

- 环境变量 `A2A_BASE_URL`（默认 `http://localhost:8080`）指向运行中的 agent-runtime。
- 依赖：`httpx>=0.27`、`pytest`、`pytest-asyncio`（流式可用同步 httpx 的 `stream` 亦可）。

## 1. 复用客户端：`a2a_client`（conftest fixture）

```python
# conftest.py 已提供以下 fixtures（用例直接注入，勿手写 HTTP 细节）
# - base_url: str                      读取 A2A_BASE_URL
# - a2a_client: A2aClient              黑盒客户端实例
```

`A2aClient` 公开方法（**仅可使用这些**）：

| 方法 | 签名 | 说明 | 返回 |
|------|------|------|------|
| 同步发送 | `send_message(text, *, context_id=None, message_id=None, req_id="1") -> dict` | Accept: application/json，阻塞 | JSON-RPC response dict（`result` 为 Task） |
| 流式发送 | `send_streaming_message(text, *, context_id=None, message_id=None, req_id="1") -> Iterator[dict]` | Accept: text/event-stream，逐事件 yield | SSE 事件 dict 迭代器 |
| 查询任务 | `get_task(task_id, *, req_id="1") -> dict` | method=GetTask | JSON-RPC response dict |
| 取消任务 | `cancel_task(task_id, *, req_id="1") -> dict` | method=CancelTask | JSON-RPC response dict |
| 续订任务 | `subscribe_to_task(task_id, *, req_id="1") -> Iterator[dict]` | method=SubscribeToTask（SSE） | SSE 事件 dict 迭代器 |
| 列出任务 | `list_tasks(*, req_id="1") -> dict` | method=ListTasks | JSON-RPC response dict |
| 取 Agent Card | `get_agent_card() -> dict` | GET /.well-known/agent-card.json | AgentCard dict |
| 原始发送 | `raw_post(body: str|dict, *, accept="application/json") -> httpx.Response` | 发任意（含非法）请求体，用于协议合规负向用例 | httpx.Response |

## 2. JSON-RPC 请求/响应约定（来自需求文档）

- 请求：`{"jsonrpc":"2.0","method":<Method>,"id":<id>,"params":{...}}`
- message 形如：`{"role":"ROLE_USER","messageId":<mid>,"contextId":<ctx>,"parts":[{"text":<text>}]}`
- 成功响应含 `result`（Task）；错误响应含 `error.code`/`error.message`，**且必须回带原 `id`**。
- Task 形如：`{"id":..., "contextId":..., "status":{"state":<TaskState>}, "artifacts":[...]}`

## 3. 关键判据常量（断言用，来自需求文档，勿臆造）

```python
# Task 状态机
TASK_STATES = ["SUBMITTED","WORKING","COMPLETED","FAILED","CANCELED","INPUT_REQUIRED"]
TERMINAL_STATES = {"COMPLETED","FAILED","CANCELED"}
# 注意：ListTasks 示例返回里状态可能为 TASK_STATE_* 前缀形式（需断言时容错两种写法）

# JSON-RPC 标准错误码
ERR_PARSE = -32700        # 非法 JSON 请求体
ERR_INVALID_REQUEST = -32600
ERR_METHOD_NOT_FOUND = -32601  # 未知 method
ERR_INTERNAL = -32603

# SSE 事件类型（流式）
SSE_EVENTS_ORDER = ["TaskAccepted", "ArtifactUpdate", "TaskStatusUpdate"]

# 端点
A2A_ENDPOINT = "/a2a"
AGENT_CARD_PATHS = ["/.well-known/agent-card.json", "/.well-known/agent.json"]
```

## 4. SSE 解析助手（client 内部已实现，事件 dict 字段）

每个 SSE 事件被解析为：`{"event": "jsonrpc", "data": {<JSON-RPC payload>}}`，其中 `data.result` 携带
`TaskAccepted` / `ArtifactUpdate` / `TaskStatusUpdate` 的具体载荷（含 `status.state`、`artifact` 等）。

## 5. 约束（务必遵守）

- 只能黑盒通过 `/a2a` 与 Agent Card 端点观测；**禁止**导入/调用任何 Java 内部类或私有实现。
- 断言必须落到**可观测判据**：`status.state`、`error.code`、SSE 事件序列/终态、`id` 回带、Agent Card 字段。
- 无运行服务时连接失败属环境问题（env_issue），非用例缺陷。
