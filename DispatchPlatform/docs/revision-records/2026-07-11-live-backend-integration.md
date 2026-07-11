# Live Backend Integration Revision Record / 真实后端联调修订记录

## 中文

### 目的

让 TestWise 与当前真实执行后端兼容，并在不修改后端服务、不触发真实任务的前提下完成只读联调。

### 发现的契约差异

- 任务状态查询返回 `{ success, task }`，而非原先前端假定的扁平任务对象。
- 后端状态使用 `queued`、`pending`、`running`、`completed`、`failed`、`cancelled`；任务创建响应不返回 `trigger_type`。
- 进度位于任务的 `progress`、`total_scripts`、`executed_scripts` 和 `failed_scripts` 字段中；后端没有提供当前执行命令。
- 终态日志地址位于任务的顶层 `download_url`，不是嵌套的 `logs.download_url`。
- 后端未提供浏览器跨域访问头，因此浏览器不能直接调用远端 API。
- 按脚本创建任务时，后端需要同时接收 `product`、`scene`、`feature` 和 `script_name`。

### 前端修订

- 在 API 客户端新增真实后端适配层，同时保留文档中扁平响应的兼容回退。
- 将 `queued` 和 `pending` 映射为前端等待态，`completed` 映射为成功态，并保留取消态及其终态日志导出能力。
- 归一化队列位置、脚本总数、已执行/失败数量、时间戳、日志目录和下载地址；后端未返回命令时，界面明确显示“当前没有返回执行命令”。
- 修复绝对 API Base URL 的构造逻辑；相对 `/api` 路径继续用于同源部署。
- 按脚本模式改为先选择单一特性，再请求该特性的脚本快照；提交时发送完整 SUT 上下文和脚本名。
- 任务创建和上下文加载失败时，优先展示后端返回的错误消息与错误码。
- 为队列位置、取消状态和终态结果补充中英文文案及统一状态样式。
- 增加 `TESTWISE_API_PROXY_TARGET` 驱动的 Vite 开发/预览代理，保留浏览器 Host，使后端生成的下载地址继续经由 TestWise 访问。
- 增加真实后端运行时配置示例，并更新进程级部署与 README 说明。

### 验证记录

- 自动化测试：`npm run test:run`，9 个测试文件、36 个测试通过。
- 构建验证：`npm run build` 通过。
- 本地预览验证：根路由、`/tasks` 刷新回退和 `/config/runtime.json` 均返回成功状态。
- 真实只读接口验证：通过同源代理成功加载 `GET /api/features` 的 15 个特性，以及 `GET /api/scripts` 返回的 5 个“API密钥管理”脚本。
- 浏览器验证：任务页显示真实 SUT、真实特性选择器和脚本快照，控制台无错误或 CORS 告警。
- 本次联调没有调用 `POST /api/tasks`、`DELETE /api/tasks` 或日志下载接口，未创建、取消或执行任何远端任务。

### 部署说明

- 进程级临时联调使用 Vite preview，并通过 `TESTWISE_API_PROXY_TARGET` 指向后端；浏览器运行时配置保持 `/api` 且关闭演示数据回退。
- 容器部署继续使用现有的 `BACKEND_UPSTREAM` 与 Nginx `/api` 反向代理契约。
- 当前沙箱未安装 Docker，因此未执行本地容器启动验证。

## English

### Purpose

Make TestWise compatible with the current live execution backend and complete a read-only integration check without changing the backend service or triggering a real task.

### Observed Contract Differences

- Task status is returned as `{ success, task }`, not the previously assumed flat task object.
- The backend uses `queued`, `pending`, `running`, `completed`, `failed`, and `cancelled`; task creation does not return `trigger_type`.
- Progress is represented by `progress`, `total_scripts`, `executed_scripts`, and `failed_scripts`; the backend does not return a current command.
- Terminal log access is exposed through top-level task `download_url`, rather than nested `logs.download_url`.
- The backend does not provide browser CORS headers, so the browser cannot call the remote API directly.
- Explicit-script creation requires `product`, `scene`, `feature`, and `script_name` together.

### Frontend Changes

- Added a live-backend adapter in the API client while retaining fallback support for the documented flat response.
- Maps `queued` and `pending` to the frontend pending state, maps `completed` to success, and preserves cancellation as a terminal state with eligible log export.
- Normalizes queue position, script totals, executed/failed counts, timestamps, log directory, and download URL. When no command is returned, the UI explicitly states that fact.
- Corrected absolute API-base URL construction while preserving relative `/api` deployment behavior.
- Changed explicit-script mode to select one feature first, load its scoped script snapshot, and submit the full SUT context with script names.
- Shows backend error messages and codes when task creation or context loading fails.
- Added bilingual copy and consistent status styling for queue position, cancellation, and terminal results.
- Added a Vite development/preview proxy controlled by `TESTWISE_API_PROXY_TARGET`, preserving the browser Host so backend-generated download URLs continue through TestWise.
- Added a live-backend runtime-config example and updated process deployment and README guidance.

### Verification Evidence

- Automated checks: `npm run test:run` passed with 9 test files and 36 tests.
- Build check: `npm run build` passed.
- Local preview check: the root route, `/tasks` refresh fallback, and `/config/runtime.json` all returned successful responses.
- Live read-only API check: the same-origin proxy loaded all 15 features from `GET /api/features` and the five API-key-management scripts from `GET /api/scripts`.
- Browser check: the Tasks page displayed the live SUT, real feature selector, and real script snapshot with no console errors or CORS warnings.
- This integration did not call `POST /api/tasks`, `DELETE /api/tasks`, or a log-download URL. No remote task was created, cancelled, or executed.

### Deployment Notes

- Temporary process-level verification uses Vite preview with `TESTWISE_API_PROXY_TARGET`; browser runtime config remains `/api` with mock fallback disabled.
- Container deployment remains compatible with the existing `BACKEND_UPSTREAM` and Nginx `/api` proxy contract.
- Docker is not installed in this sandbox, so local container startup was not executed.
