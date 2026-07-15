# Containerized Deployment

## English

Use the container image when deploying through Docker Compose, Kubernetes, or enterprise PaaS.

1. Build the image:

   ```bash
     docker build -t testwise:latest .
   ```

2. Run with a mounted runtime config:

   ```bash
   docker run --rm -p 8080:8080 \
     -v "$PWD/public/config/runtime.json:/usr/share/nginx/html/config/runtime.json:ro" \
     testwise:latest
   ```

3. Configure the task upstream with `BACKEND_UPSTREAM` and the report upstream with `REPORT_BACKEND_UPSTREAM`. The image routes `/api/reports` and its descendants to the report service; every other `/api` request goes to the task service. Proxy a same-origin identity profile route as well when `auth.profileUrl` is relative.
4. Supply environment-specific SUT and SSO values by mounting `/config/runtime.json`; never rebuild the image just to change those values.
5. For Docker Compose, run from this directory:

   ```bash
   BACKEND_UPSTREAM=backend:3000 \
   REPORT_BACKEND_UPSTREAM=backend:3001 \
   docker compose up --build
   ```

   Point `BACKEND_UPSTREAM` at the reachable task service and `REPORT_BACKEND_UPSTREAM` at the report service. The image still starts and answers `/healthz` before either service is available; requests for an unavailable upstream return a gateway error.
6. Verify:
   - `GET /healthz` returns `ok`.
   - `GET /config/runtime.json` returns the mounted config.
   - SPA refresh fallback works for `/tasks` and `/observation`.
   - `GET /api/versions` reaches the task service and `GET /api/reports?...` reaches the report service.
   - Live logs load from `GET /api/tasks/{task_id}/logs`, and terminal export opens the normalized backend-provided `download_url`.
   - The SSO profile endpoint returns an `AuthUser` response or `401` through the enterprise gateway.

## 中文

容器化部署适用于 Docker Compose、Kubernetes 或企业 PaaS。

1. 构建镜像：

   ```bash
     docker build -t testwise:latest .
   ```

2. 挂载运行时配置启动：

   ```bash
   docker run --rm -p 8080:8080 \
     -v "$PWD/public/config/runtime.json:/usr/share/nginx/html/config/runtime.json:ro" \
     testwise:latest
   ```

3. 使用 `BACKEND_UPSTREAM` 配置任务服务，使用 `REPORT_BACKEND_UPSTREAM` 配置报告服务。镜像会将 `/api/reports` 及其子路径转发到报告服务，其余 `/api` 请求转发到任务服务。若 `auth.profileUrl` 使用相对路径，也应在网关中代理同源身份档案路由。
4. 通过挂载 `/config/runtime.json` 注入环境对应的 SUT 与 SSO 配置；不要为了修改这些配置而重新构建镜像。
5. 使用 Docker Compose 时，在当前目录执行：

   ```bash
   BACKEND_UPSTREAM=backend:3000 \
   REPORT_BACKEND_UPSTREAM=backend:3001 \
   docker compose up --build
   ```

   将 `BACKEND_UPSTREAM` 指向可访问的任务服务，将 `REPORT_BACKEND_UPSTREAM` 指向报告服务。任一服务尚未就绪时，镜像仍可启动并响应 `/healthz`；访问不可用上游时会返回网关错误。
6. 验证：
   - `GET /healthz` 返回 `ok`。
   - `GET /config/runtime.json` 返回挂载配置。
   - `/tasks` 和 `/observation` 刷新时仍回退到 SPA。
   - `GET /api/versions` 到达任务服务，`GET /api/reports?...` 到达报告服务。
   - 实时日志通过 `GET /api/tasks/{task_id}/logs` 加载，终态日志导出打开归一化后的后端 `download_url`。
   - 企业网关中的 SSO 档案接口返回 `AuthUser` 或 `401`。
