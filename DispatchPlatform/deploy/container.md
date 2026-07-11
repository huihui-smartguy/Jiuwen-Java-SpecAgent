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

3. Override the `/api` upstream in `deploy/nginx.conf` or through the platform ingress. Proxy a same-origin identity profile route as well when `auth.profileUrl` is relative.
4. Supply environment-specific SUT and SSO values by mounting `/config/runtime.json`; never rebuild the image just to change those values.
5. For Docker Compose, run from this directory:

   ```bash
   BACKEND_UPSTREAM=backend:3000 docker compose up --build
   ```

   Point `BACKEND_UPSTREAM` at the reachable execution service. The image still starts and answers `/healthz` before that service is available; `/api` calls will return an upstream error until the service is reachable.
6. Verify:
   - `GET /healthz` returns `ok`.
   - `GET /config/runtime.json` returns the mounted config.
   - SPA refresh fallback works for `/tasks` and `/observation`.
   - Log export opens the backend-provided `logs.download_url`.
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

3. 在 `deploy/nginx.conf` 或平台网关中调整 `/api` 上游。若 `auth.profileUrl` 使用相对路径，也应在网关中代理同源身份档案路由。
4. 通过挂载 `/config/runtime.json` 注入环境对应的 SUT 与 SSO 配置；不要为了修改这些配置而重新构建镜像。
5. 使用 Docker Compose 时，在当前目录执行：

   ```bash
   BACKEND_UPSTREAM=backend:3000 docker compose up --build
   ```

   将 `BACKEND_UPSTREAM` 指向可访问的执行服务。执行服务尚未就绪时，镜像仍可启动并响应 `/healthz`；在服务可达前，`/api` 调用会返回上游错误。
6. 验证：
   - `GET /healthz` 返回 `ok`。
   - `GET /config/runtime.json` 返回挂载配置。
   - `/tasks` 和 `/observation` 刷新时仍回退到 SPA。
   - 日志导出打开后端返回的 `logs.download_url`。
   - 企业网关中的 SSO 档案接口返回 `AuthUser` 或 `401`。
