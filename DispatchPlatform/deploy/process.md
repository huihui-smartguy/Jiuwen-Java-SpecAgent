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
4. Reverse proxy `/api` to the backend base URL, for example `http://localhost:3000/api`.
5. Manage the serving process with systemd, PM2, Supervisor, or enterprise orchestration.
6. For enterprise SSO, set `auth` in `/config/runtime.json`. Keep `profileUrl` on the same trusted origin through the gateway, or configure its CORS and cookie policy deliberately. Login, registration, and logout URLs are redirect-only.
7. Verify:
   - `/` returns the SPA.
   - `/config/runtime.json` is reachable.
   - Refreshing `/tasks` or `/observation` falls back to `index.html`.
   - `/api/features?product=高码java&scene=场景` reaches the backend.
   - `auth.profileUrl` returns the documented user profile or `401` behind an authenticated gateway.

## 中文

进程级部署适用于虚拟机、内部服务器或早期私有化交付。

1. 构建静态应用：

   ```bash
   npm ci
   npm run build
   ```

2. 使用 Nginx、Caddy、Apache 或 Node 静态服务托管 `dist/`。
3. `/config/runtime.json` 应设置 `Cache-Control: no-store`。
4. 将 `/api` 反向代理到后端服务，例如 `http://localhost:3000/api`。
5. 使用 systemd、PM2、Supervisor 或企业编排系统守护进程。
6. 如需企业 SSO，在 `/config/runtime.json` 中配置 `auth`。`profileUrl` 建议通过网关保持在同一受信任来源；如使用跨域地址，需明确配置 CORS 与 Cookie 策略。登录、注册和退出登录 URL 均只负责跳转。
7. 验证：
   - `/` 返回 SPA。
   - `/config/runtime.json` 可访问。
   - 刷新 `/tasks` 或 `/observation` 能回退到 `index.html`。
   - `/api/features?product=高码java&scene=场景` 能到达后端。
   - 已认证网关下的 `auth.profileUrl` 返回约定的用户档案或 `401`。
