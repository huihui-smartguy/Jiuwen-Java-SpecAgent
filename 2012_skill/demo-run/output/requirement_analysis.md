# 需求分析 — A2A 协议标准支持（核心消息 + 任务）

> 来源：`/tmp/st-run/ai_reference/requirement.md`（A2A 协议串讲）、`e2e_framework_scenes.json`
> 观测方式：黑盒 HTTP + JSON-RPC（`POST /a2a`）与 Agent Card 发现端点（`GET /.well-known/agent-card.json`）。
> 模块定位：独立功能（A2A 协议适配层，对外黑盒可观测）。

## 1. 特性点（feature points）

| FP | 特性点 | 入口 | 可观测判据 |
|----|--------|------|-----------|
| FP-1 | SendMessage 同步阻塞返回完整 Task | `POST /a2a`, method=SendMessage, Accept: application/json | `result.status.state` ∈ TERMINAL（期望 COMPLETED）；`id` 回带 |
| FP-2 | SendStreamingMessage 流式 SSE 推送至终态 | `POST /a2a`, method=SendStreamingMessage, Accept: text/event-stream | SSE 事件序列 TaskAccepted → ArtifactUpdate(×N) → TaskStatusUpdate(COMPLETED)；终态后流关闭 |
| FP-3 | GetTask 查询任务状态 | method=GetTask, params.id | `result.id` 回显；`result.status.state` 一致 |
| FP-4 | CancelTask 执行中取消 | method=CancelTask, params.id | `result.status.state` == CANCELED |
| FP-5 | CancelTask 对终态再取消（负向） | method=CancelTask 对已终态 task | 返回标准 error（error.code 非空，error 回带 id） |
| FP-6 | SubscribeToTask 断线重连续订 | method=SubscribeToTask, params.id | 恢复 SSE，续收 ArtifactUpdate/TaskStatusUpdate 至终态 |
| FP-7 | ListTasks 列出任务 | method=ListTasks | `result` 为数组；含目标 taskId；状态写法容错 TASK_STATE_* 前缀 |
| FP-8 | JSON-RPC parse error | 非法 JSON 体 | `error.code` == -32700；`id` 回带；不创建 task |
| FP-9 | method-not-found | 未知 method | `error.code` == -32601；`id` 回带；不创建 task |
| FP-10 | Agent Card 发现 | `GET /.well-known/agent-card.json` | 返回 name/description/capabilities/skills/endpoint(url) |

## 2. 任务状态机（来自需求 §4）

`SUBMITTED → WORKING → COMPLETED / FAILED / CANCELED / INPUT_REQUIRED`
- 终态集合 TERMINAL_STATES = {COMPLETED, FAILED, CANCELED}
- 状态只允许向前流转；SSE 流必须在 INTERRUPTED / FAILED / CANCELED 后关闭。
- 注意：ListTasks 返回里状态可能带 `TASK_STATE_` 前缀（断言需容错两种写法）。

## 3. JSON-RPC 错误码（来自需求 §4 接口说明）

| 名称 | code | 触发 |
|------|------|------|
| Parse Error | -32700 | 非法 JSON 请求体 |
| Invalid Request | -32600 | 合法 JSON 但形状不匹配任何 A2A 请求 |
| Method Not Found | -32601 | 未知 method（不创建 task） |
| Internal Error | -32603 | 内部异常 / 序列化失败 |

规则：所有 JSON-RPC error response 必须回带原 request 的 `id`。

## 4. 场景清单（映射 e2e_framework_scenes.json）

| 场景 id | 名称 | 覆盖 FP |
|---------|------|---------|
| E2E_A2A_001 | SendMessage(sync) → GetTask → ListTasks | FP-1, FP-3, FP-7 |
| E2E_A2A_002 | SendStreamingMessage 全流事件序列 | FP-2 |
| E2E_A2A_003 | 断线重连续订（SubscribeToTask） | FP-6 |
| E2E_A2A_004 | 执行中取消 → CANCELED；终态再取消报错 | FP-4, FP-5 |
| E2E_A2A_005 | 协议合规报错：-32700 / -32601 不创建 task | FP-8, FP-9 |
| E2E_A2A_006 | 发现即调用：Agent Card → endpoint 回调 SendMessage | FP-10, FP-1 |

## 5. P0 项（来自需求 §6 开发自测门禁=是）

SendMessage 同步→COMPLETED、SendStreamingMessage SSE 全流、GetTask、Agent Card 发现、parse error(-32700)、method-not-found(-32601) 为 P0；CancelTask / SubscribeToTask / ListTasks 为 P1。
