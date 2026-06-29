# SuperTest req-test-analyzer 报告 — A2A 核心消息+任务

> 范围：A2A 黑盒 HTTP + JSON-RPC（POST /a2a、GET /.well-known/agent-card.json）。
> SUT：spring-ai-ascend/agent-runtime（Java/Spring），本环境无运行服务。
> module_role = 独立功能；observability = blackbox。

## 1. 静态代码事实（来自 5 个 Java 锚点）

| 事实 | 锚点（代码事实） |
|------|------------------|
| 单一入口 POST /a2a、/a2a/，按 Accept 分阻塞 JSON / 流式 SSE 两个 produces 重载 | A2aJsonRpcController @PostMapping |
| 方法分发 switch：SendMessage/GetTask/ListTasks/CancelTask/PushConfig；流式：SendStreamingMessage、SubscribeToTask；default->METHOD_NOT_FOUND | A2aJsonRpcController.handleBlocking / handleStream |
| parse error -32700：catch JsonProcessingException / com.google.gson.JsonParseException -> A2AErrorCodes.JSON_PARSE | A2aJsonRpcController.handle catch 链 |
| method-not-found -32601：catch MethodNotFoundJsonMappingException / IllegalArgumentException | A2aJsonRpcController.handle catch 链 |
| invalid-request -32600（形状不匹配）、internal -32603（兜底/序列化失败） | A2aJsonRpcController.handle catch 链 |
| 所有 error 经 errorResponse(id, error) -> JSONRPCUtils.toJsonRPCErrorResponse(id, error)，回带原 id | A2aJsonRpcController.errorResponse |
| parse/method-not-found 在分发前抛出，不进入 execute()，不创建 task | handle() 早于 handler.onMessageSend |
| Task 状态机：SUBMITTED->WORKING->COMPLETED/FAILED/CANCELED/INPUT_REQUIRED | A2aAgentExecutor.execute + A2aResultRouter.route |
| COMPLETED 由 emitter.complete(...) 发射（终态延迟执行，先落 trajectory artifact） | A2aResultRouter.route case COMPLETED |
| CANCELED 由 A2aAgentExecutor.cancel -> emitter.cancel()；cancel-through 经 inFlight 注册 | A2aAgentExecutor.cancel |
| SSE 事件名固定 event: jsonrpc；SendStreamingMessage 用 takeUntil(isStreamTerminating)（final 或 interrupted 关闭流）；SubscribeToTask terminateOnInterrupt=false | A2aJsonRpcController.handleStream |
| 流中途失败 onErrorResume 末尾追加一帧 JSON-RPC error（不裸断流） | A2aJsonRpcController.handleStream |
| Agent Card：/.well-known/agent-card.json + 兼容 /.well-known/agent.json，返回 name/skills/capabilities/url(endpoint) | AgentCardController |

## 2. 设计覆盖汇总表

| TC | 名称 | type | pri | scene | oracle 类型 |
|----|------|------|-----|-------|-------------|
| TC-A2A-001 | SendMessage 同步->COMPLETED | 正向 | P0 | E2E_A2A_001 | task_state |
| TC-A2A-002 | SendStreamingMessage SSE 序列->COMPLETED | 正向 | P0 | E2E_A2A_002 | sse_sequence |
| TC-A2A-003 | GetTask 状态一致 | 正向 | P0 | E2E_A2A_001 | id_echo |
| TC-A2A-004 | Agent Card 发现 capabilities/skills/endpoint | 正向 | P0 | E2E_A2A_006 | agent_card |
| TC-A2A-005 | parse error -32700 不创建 task | 异常 | P0 | E2E_A2A_005 | error_code |
| TC-A2A-006 | method-not-found -32601 不创建 task | 异常 | P0 | E2E_A2A_005 | error_code |
| TC-A2A-007 | CancelTask 执行中->CANCELED | 正向 | P1 | E2E_A2A_004 | task_state |
| TC-A2A-008 | 对终态再取消报错（负向） | 异常 | P1 | E2E_A2A_004 | error_code |
| TC-A2A-009 | SubscribeToTask 断线重连续订 | 正向 | P1 | E2E_A2A_003 | sse_sequence |
| TC-A2A-010 | ListTasks 含目标 task | 正向 | P1 | E2E_A2A_001 | task_state |
| TC-A2A-011 | 发现即调用（card endpoint->SendMessage） | 正向 | P1 | E2E_A2A_006 | agent_card |
| TC-A2A-012 | GetTask 不存在 taskId 报错（边界） | 边界 | P1 | E2E_A2A_001 | error_code |

合计 12 例：P0=6 / P1=6；类型 正向 7 / 异常 4 / 边界 1。场景覆盖 E2E_A2A_001..006 全 6 个。
每例含可判定 oracle、>=1 个 L2 断言、内容维+过程维 >=2 维、scene/requirement/java_class 三元 traceability。

## 3. 生成代码状态（stage4a，2 个 P0）

| 文件 | py_compile | 说明 |
|------|-----------|------|
| a2a_client.py | ok | A2aClient + 常量；httpx 惰性导入；A2A_BASE_URL 从 env 读取（默认 localhost:8080） |
| conftest.py | ok | fixtures base_url / a2a_client；注册 a2a/sse marker |
| test_tc_a2a_msg_sync_001.py | ok | TC-A2A-001 SendMessage->COMPLETED |
| test_tc_a2a_parse_error_001.py | ok | TC-A2A-005 parse error -32700 |

- python3 -m py_compile：4/4 通过。
- 无 httpx 时 import a2a_client 成功（惰性导入验证通过）。
- pytest collect-only：2 tests collected。
- pytest 运行：2 failed，失败原因 httpx.ConnectError: [Errno 111] Connection refused（无运行 SUT）。

## 4. 环境限制说明（env_issue 分类）

- 本环境无运行中的 agent-runtime（localhost:8080 拒绝连接），属环境问题（env_issue），非用例缺陷。
- 验证期临时安装 pytest 9.1.0 与 httpx 0.28.1。
- 两个生成用例均 py_compile=ok、可收集；失败为连接拒绝（env_issue）。
- 待 SUT 启动后重跑即可得真实正/负向判定（断言已落在 status.state / error.code / id 回带等可观测判据）。

## 5. 真实运行结果(live)

- 首轮对真实 SUT 运行 12 例 12 failed，全部源于测试侧形态假设错误（非 SUT 缺陷）：
  - R1：Task 实际嵌套在 result.task，而非 result 本身（SendMessage/GetTask/CancelTask/ListTasks）。
  - R2：JSON-RPC id 回带为 int，而测试侧按 str 断言（== 比较类型不符）。
  - R3：SSE 事件 result 为 oneof（task / statusUpdate / artifactUpdate），旧 helper 找 kind/type/eventType 字段恒返回 None。
  - R4：AgentCard.url == 服务 base url 且不含 "/a2a"，public-base-url 未设时可能为空字符串。
- SUT 触达判据处均正确：parse error −32700（且省略 id）、method-not-found −32601、GetTask 不存在 −32001 "Task not found"、终态 TASK_STATE_COMPLETED。
- 0 处确认的 SUT 缺陷；全部失败归因测试侧形态假设。
- harness 已按真实线缆形态修正为可复跑版（result.task 嵌套 / id 类型容差 id_eq / SSE oneof helpers / AgentCard.url 仅校验键存在）。
- 详见 ../results-live.md。

## 6. 交互轨迹采集(v3)

- 在 `a2a_client.py` 加入纯 Python 记录器（`set_current_case` / `record_request` / `record_response` / `record_sse_event` / `_emit` / `_trace_path`），logger 名 `a2a`；httpx 仍惰性导入，记录器异常全吞、绝不影响被测流程。
- 已织入 `_post_json` / `raw_post` / `get_agent_card` / `_stream`：请求/响应落盘+打印，SSE 逐帧实时记录后透传（不改返回类型，调用方仍 `.json()`）。
- `conftest.py` 一次性配置 `a2a` logger 的 stdout handler（+ 设 `A2A_TRACE_DIR` 时加 `session.log` FileHandler，去重），autouse `_trace` fixture 绑定用例名并在收尾打印该用例 `trace/<case>.jsonl` 路径。
- `run.sh` 运行前 `export A2A_TRACE_DIR=$(pwd)/trace` 并清空重建，pytest 加 `-s -rA --log-cli-level=INFO`，请求行 `>>>` / 响应行 `<<<` / SSE 行 `[SSE]` 直接进 results.txt；可选 `AGENT_RUNTIME_LOG` 尾 100 行追加；末尾列出 trace 目录。
- 三类落点：results.txt（人类可读）、trace/<case>.jsonl（结构化）、trace/session.log（合并）；字段说明见 ../trace-howto.md。
- TC-A2A-002 改用"真实流不变量"：真实 SSE = N×TaskStatusUpdate（无独立 TaskAccepted/ArtifactUpdate，输出并入完成消息），故断言"事件非空 + 每帧 kind 均可识别 + 末事件为 TaskStatusUpdate 且末态 COMPLETED"，替代原过严的三段式顺序。
