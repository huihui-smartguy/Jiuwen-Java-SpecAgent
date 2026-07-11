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

配置契约由 [`deploy/runtime-config.schema.json`](deploy/runtime-config.schema.json) 定义。环境配置可以从 [`deploy/runtime.example.json`](deploy/runtime.example.json) 开始填写。

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

Log export is terminal-only and uses `logs.download_url` from task status.

The Observation workspace polls `GET /api/tasks/{task_id}` every five seconds while a task is pending or running. It stops on success or failure; no live-log stream is created or simulated.

执行观测台会在任务处于等待或执行中时每五秒轮询 `GET /api/tasks/{task_id}`，成功或失败后停止。系统不会创建或模拟实时日志流。
