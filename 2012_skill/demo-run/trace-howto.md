# 交互轨迹（trace）使用说明

> 目的：让黑盒 A2A 测试套件把 **test-agent ↔ agent-runtime** 的请求/响应/SSE 全程
> 记录下来，便于复盘"到底发了什么、收到了什么"。

## 1. 为何此前缺失（3 层原因）

1. **skill 侧无"轨迹"环节**：req-test-analyzer 只生成"用例 + 断言"，从未要求记录线缆交互；
   失败时只能看到断言 message，看不到真实请求/响应。
2. **客户端不记录**：`A2aClient` 直接 `httpx` 收发后只返回 `.json()`，请求体、响应体、
   SSE 逐帧内容都未被保存或打印，丢在调用栈里。
3. **SUT 轨迹是灰盒、不北向返回**：agent-runtime 内部有 trajectory/artifact，但不通过 A2A
   响应回吐给客户端，黑盒侧无法从协议层观测，只能靠客户端自记。

## 2. 现在怎么看

- **results.txt**：`run.sh` 用 `-s -rA --log-cli-level=INFO` 运行，logger `a2a` 的人类可读
  行直接落进 results.txt：
  - `>>> [client→runtime] {METHOD} {url}` + 请求头(脱敏) + 请求体（pretty JSON）
  - `<<< [runtime→client] HTTP {status} ({METHOD})` + 响应体（pretty JSON）
  - `<<< [SSE] #{idx} (+{elapsed_ms}ms) kind=... state=...` + 该帧紧凑 JSON
- **trace/<case>.jsonl**：每个用例一份结构化轨迹（每行一条 JSON 记录），便于程序化解析/diff。
- **trace/session.log**：整轮所有用例的同样日志合并文件（带时间戳）。
- **可选 AGENT_RUNTIME_LOG**：若设置该环境变量且文件存在，run.sh 末尾会把服务端日志尾 100 行
  追加进 results.txt（`tail -n 100`，best-effort）。

## 3. 开关与触发

- 设置 `A2A_TRACE_DIR` 即开启 JSONL/session.log 落盘；不设置时仍有控制台日志（仅 `-s` 可见）。
- `run.sh` 已自动 `export A2A_TRACE_DIR="$(pwd)/trace"` 并清空重建。
- conftest 在每个用例开始时 `set_current_case(node.name)`，结束时（开启 trace）`print` 该用例
  轨迹文件路径。

## 4. trace JSONL 字段说明

每条记录公共字段：`ts`（ISO 时间）、`case`（用例名）、`kind`。按 kind 区分：

| kind | 字段 | 说明 |
|------|------|------|
| `request` | `method` / `url` / `headers`(已脱敏) / `body` | 一次 client→runtime 请求；非法字符串体原样记录 |
| `response` | `method` / `status_code` / `body` | runtime→client 响应；`.json()` 失败时 `body` 为原始文本 |
| `sse_event` | `idx` / `elapsed_ms` / `event_kind` / `event_state` / `event` | 一条实时 SSE 帧；`event` 为解析后的 `{event,data}` 结构 |

> 注：`headers` 对 Authorization/token/cookie/secret/api-key 等做了脱敏（`***REDACTED***`）。
> 记录器为纯 Python、异常全吞，绝不影响被测流程或断言结果。
