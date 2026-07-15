# Process-Level Deployment

## English

Use process-level deployment for a VM, internal server, or early private delivery.

1. Build the static app:

   ```bash
   npm ci
   npm run build
   ```

2. Serve `dist/` with Nginx, Caddy, Apache, or a Node static server.
3. Serve `/config/runtime.json` with `Cache-Control: no-store`.
4. Reverse proxy `/api/reports` and `/api/reports/*` to the report service (for example `http://localhost:3001/api/reports...`) before routing the remaining `/api/*` requests to the task service on port `3000`.
5. Manage the serving process with systemd, PM2, Supervisor, or enterprise orchestration.
6. For enterprise SSO, set `auth` in `/config/runtime.json`. Keep `profileUrl` on the same trusted origin through the gateway, or configure its CORS and cookie policy deliberately. Login, registration, and logout URLs are redirect-only.
7. Verify:
   - `/` returns the SPA.
   - `/config/runtime.json` is reachable.
   - Refreshing `/tasks` or `/observation` falls back to `index.html`.
   - `/api/features?product=高码java&scene=场景` reaches the backend.
   - `/api/reports?software_version=build-1&limit=20&offset=0` reaches the report backend without exposing port `3001` to the browser.
   - `auth.profileUrl` returns the documented user profile or `401` behind an authenticated gateway.

### Temporary live-backend verification

For a short-lived local integration check, keep `apiBaseUrl` and every SUT `apiBaseUrl` as `/api`, disable mock fallback, and start Vite preview with both upstreams:

```bash
TESTWISE_API_PROXY_TARGET=http://127.0.0.1:3000 \
TESTWISE_REPORT_API_PROXY_TARGET=http://127.0.0.1:3001 \
npm run preview
```

The report matcher has boundary-safe precedence over the task fallback. The preview proxy preserves the browser host, so backend-provided download URLs continue through TestWise rather than requiring browser CORS.

Use [`runtime.live-backend.example.json`](runtime.live-backend.example.json) as the shape for the mounted local runtime configuration. Keep task execution and cancellation under the deployment team's approved change window.

### Existing Nginx gateway path

When the host already has a public Nginx server, build the same artifact with a path base and include [`nginx.data1.locations.conf`](nginx.data1.locations.conf) inside that server block:

```bash
VITE_BASE_PATH=/testwise/ npm run build
```

Deploy the release under `/data1/testwise/releases/<release-id>/`, point `/data1/testwise/current` at the active release, and use [`runtime.data1.example.json`](runtime.data1.example.json) as the runtime configuration. This layout serves the SPA at `/testwise/`, its health check at `/testwise/healthz`, report requests through port `3001`, and every other `/testwise/api/` request through port `3000`, without taking over the host's root application.

## 中文

进程级部署适用于虚拟机、内部服务器或早期私有化交付。

1. 构建静态应用：

   ```bash
   npm ci
   npm run build
   ```

2. 使用 Nginx、Caddy、Apache 或 Node 静态服务托管 `dist/`。
3. `/config/runtime.json` 应设置 `Cache-Control: no-store`。
4. 先将 `/api/reports` 与 `/api/reports/*` 反向代理到报告服务（例如 `http://localhost:3001/api/reports...`），再将其余 `/api/*` 请求代理到 `3000` 端口的任务服务。
5. 使用 systemd、PM2、Supervisor 或企业编排系统守护进程。
6. 如需企业 SSO，在 `/config/runtime.json` 中配置 `auth`。`profileUrl` 建议通过网关保持在同一受信任来源；如使用跨域地址，需明确配置 CORS 与 Cookie 策略。登录、注册和退出登录 URL 均只负责跳转。
7. 验证：
   - `/` 返回 SPA。
   - `/config/runtime.json` 可访问。
   - 刷新 `/tasks` 或 `/observation` 能回退到 `index.html`。
   - `/api/features?product=高码java&scene=场景` 能到达后端。
   - `/api/reports?software_version=build-1&limit=20&offset=0` 能到达报告服务，浏览器无需直接访问 `3001` 端口。
   - 已认证网关下的 `auth.profileUrl` 返回约定的用户档案或 `401`。

### 临时联调验证

短期本地联调时，`apiBaseUrl` 和每个 SUT 的 `apiBaseUrl` 均保持为 `/api`，关闭演示数据回退，并为 Vite preview 同时设置两个上游：

```bash
TESTWISE_API_PROXY_TARGET=http://127.0.0.1:3000 \
TESTWISE_REPORT_API_PROXY_TARGET=http://127.0.0.1:3001 \
npm run preview
```

报告匹配规则会以边界安全的方式优先于任务回退规则。Preview 代理会保留浏览器主机名，因此后端返回的日志下载地址仍通过 TestWise 访问，无需浏览器 CORS。

本地运行时配置可参考 [`runtime.live-backend.example.json`](runtime.live-backend.example.json) 的结构。任务创建与取消应仅在部署团队批准的变更窗口内执行。

### 已有 Nginx 网关的路径部署

当主机已经通过 Nginx 对外提供服务时，使用路径 Base 构建同一份产物，并将 [`nginx.data1.locations.conf`](nginx.data1.locations.conf) include 到现有 server 块内：

```bash
VITE_BASE_PATH=/testwise/ npm run build
```

将发布内容放入 `/data1/testwise/releases/<release-id>/`，再将 `/data1/testwise/current` 指向当前发布目录；运行时配置可参考 [`runtime.data1.example.json`](runtime.data1.example.json)。该方式会在 `/testwise/` 提供 SPA、在 `/testwise/healthz` 提供健康检查，将报告请求代理到 `3001`，将其余 `/testwise/api/` 请求代理到 `3000`，且不会接管服务器根路径应用。
