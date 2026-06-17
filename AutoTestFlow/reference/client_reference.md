# client_reference.md（通用黑盒 HTTP 客户端复用资产）

> 本参考描述 stage4 生成 pytest 用例时复用的**通用黑盒脚手架**（`reference/http_client.py`
> + `reference/conftest.py`）。它只依赖 HTTP/SSE 协议形态，不触碰被测系统(SUT)内部组件。
>
> **判据纪律**：具体协议形态（请求体构造、响应字段路径、枚举、错误码、SSE 事件形态）
> **以 stage2.5 的 `contract.md` 为准**；A2A 的具体特化见 `examples/a2a/`。

## 0. 运行前置

- 环境变量 `BASE_URL`（默认 `http://localhost:8080`）指向运行中的 SUT。
- 依赖：`httpx>=0.27`、`pytest`（流式用同步 httpx 的 `stream` 即可）。
- 设置 `A2A_TRACE_DIR` 时，每条用例落 `trace/<case>.jsonl`，会话日志落 `trace/session.log`。

## 1. conftest fixtures（用例直接注入，勿手写 HTTP 细节）

```python
# base_url: str          读取 BASE_URL
# http_client: HttpClient 通用黑盒客户端实例
```

## 2. `HttpClient` 公开方法（通用原语）

| 方法 | 签名 | 说明 | 返回 |
|------|------|------|------|
| GET | `get(path, *, accept="application/json")` | 取一个路径（discovery/health/card 等） | `httpx.Response` |
| POST JSON | `post_json(path, body, *, accept="application/json")` | 发 JSON 请求体 | `httpx.Response` |
| 流式 | `stream(path, body, *, accept="text/event-stream")` | 逐事件 yield SSE 事件 dict（实时记录） | `Iterator[dict]` |
| 原始发送 | `raw_post(path, body: str\|dict, *, accept=...)` | 发任意（含非法）请求体，用于负向用例 | `httpx.Response` |

> SSE 事件 dict 形如 `{"event": <name>, "data": <json or text>}`。
> 客户端**不解读载荷语义**——具体协议字段如何嵌套以 `contract.md` 为准。

## 3. 通用 helpers（断言侧可复用）

| helper | 用途 |
|--------|------|
| `base_url_from_env()` | 读取 `BASE_URL` |
| `id_eq(a, b)` | 类型容差的 id 比较（如 int 回带 vs str 请求） |
| `normalize_state(state)` | 容错带前缀的状态枚举（如 `TASK_STATE_*` 全名） |
| `parse_sse_lines(lines)` | 通用 SSE 行解析器（拆 event/data，不解读语义） |

## 4. 交互轨迹记录器（已内置于客户端，无需手动调用）

`record_request` / `record_response` / `record_sse_event` 在每次交互时自动触发，
逐帧打印 `>>>` / `<<<` / `[SSE]` 行并落 JSONL；请求头自动脱敏（Authorization/token 类）。
任何记录异常都被吞掉，**绝不影响被测流程**。logger 名为 `autotestflow`。

## 5. 约束（务必遵守）

- 只能黑盒经 SUT 对外协议端点观测；**禁止**导入/调用任何 SUT 内部类或私有实现。
- 断言必须落到**可观测判据**，且该判据能在 `contract.md` 找到真实形态证据。
- 无运行服务时连接失败属环境问题（env_issue），非用例缺陷。
- **协议特化以 contract.md 为准；A2A 具体特化见 `examples/a2a/`**（客户端 + 参考）。
