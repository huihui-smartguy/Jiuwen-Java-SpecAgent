# TestWise

TestWise is a commercial-grade front-end console for scheduling and observing test-agent execution.

中文说明：TestWise 是测试智能体调度平台的商业化前端控制台，核心链路是选择 SUT、创建执行任务、轮询观测执行状态，并在任务结束后导出日志。

## Stack

- React + TypeScript + Vite
- React Router
- TanStack Query
- Lucide icons
- Vitest + Testing Library

## Commands

```bash
npm install
npm run dev
npm run test:run
npm run build
npm run preview
```

## Runtime Config

The built artifact reads `/config/runtime.json` at startup. This keeps the same `dist/` usable in process-level and containerized deployments.

构建产物启动时读取 `/config/runtime.json`，因此同一份 `dist/` 可以用于进程级部署和容器化部署。

The contract is defined by [`deploy/runtime-config.schema.json`](deploy/runtime-config.schema.json). Start from [`deploy/runtime.example.json`](deploy/runtime.example.json) for environment-specific values.

For a temporary read-only integration against the live execution backend, use [`deploy/runtime.live-backend.example.json`](deploy/runtime.live-backend.example.json) with the Vite proxy described in the [process deployment guide](deploy/process.md).

配置契约由 [`deploy/runtime-config.schema.json`](deploy/runtime-config.schema.json) 定义。环境配置可以从 [`deploy/runtime.example.json`](deploy/runtime.example.json) 开始填写。

如需临时以只读方式联调真实执行后端，请使用 [`deploy/runtime.live-backend.example.json`](deploy/runtime.live-backend.example.json)，并按[进程级部署说明](deploy/process.md)配置 Vite 代理。

### Enterprise identity / 企业身份

`auth` is optional. When configured, `profileUrl` returns an `AuthUser` JSON object; a `401` is treated as signed out, while other profile failures leave the application usable and show an identity-unavailable state. `loginUrl`, `registerUrl`, and `logoutUrl` redirect to the enterprise identity provider. TestWise does not collect passwords or persist access tokens.

`auth` 为可选配置。配置后，`profileUrl` 返回 `AuthUser` JSON；`401` 表示未登录，其他身份查询失败不会阻断应用，而是显示身份服务不可用状态。`loginUrl`、`registerUrl` 和 `logoutUrl` 均跳转到企业身份服务。TestWise 不处理密码，也不在前端持久化访问令牌。

### Deployment / 部署

- [Process-level deployment](deploy/process.md) / [进程级部署](deploy/process.md)
- [Containerized deployment](deploy/container.md) / [容器化部署](deploy/container.md)

## Backend Contract

The execution flow uses:

- `GET /api/features?product=&scene=`
- `GET /api/scripts?product=&scene=&feature=&level=`
- `POST /api/tasks`
- `GET /api/tasks/{task_id}`
- `GET /api/tasks/{task_id}/logs`
- `DELETE /api/tasks/{task_id}`

`GET /api/tasks/{task_id}/logs` returns the backend log snapshot as `{ success, total, logs: [{ timestamp, level, message }] }`. TestWise normalizes that payload for display, retains at most the newest 2,000 entries, and never substitutes generated log lines. If a task response supplies a log `view_url`, TestWise uses it; otherwise it resolves the endpoint from the selected environment's API base.

The Run Details workspace (stable route: `/observation`) polls `GET /api/tasks/{task_id}` every five seconds while a task is pending or running. It polls the log snapshot every two seconds while work is active and the log viewport is not paused, performs one final log fetch at the terminal transition, and then stops. Pausing logs never pauses status polling. Log export is terminal-only and uses the backend-provided download URL after compatible task responses are normalized.

`GET /api/tasks/{task_id}/logs` 返回 `{ success, total, logs: [{ timestamp, level, message }] }` 后端日志快照。TestWise 会将其归一化后展示，最多保留最新 2,000 条，并且不会用模拟日志替代真实返回。若任务响应提供日志 `view_url`，前端优先使用；否则根据当前所选 environment 的 API Base 解析日志接口。

运行详情工作区（稳定路由仍为 `/observation`）在任务等待或执行中时每五秒轮询 `GET /api/tasks/{task_id}`。日志视图未暂停时，每两秒读取一次日志快照；进入终态时再执行一次最终日志读取并停止。暂停日志不会暂停状态轮询。日志导出仅在终态开放，并使用归一化后的后端下载地址。
