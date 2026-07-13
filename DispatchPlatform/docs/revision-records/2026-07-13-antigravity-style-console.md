# Antigravity-Style Console Revision Record / Antigravity 风格控制台修订记录

## 中文

### 目的

在保留 TestWise 品牌、现有路由、SUT 上下文、运行时配置、身份入口和任务生命周期契约的前提下，将控制台升级为经批准的 Antigravity 风格信息架构，并接入后端已经存在的实时日志快照接口。本次仅修改前端，不复制 Antigravity 的品牌资产、文案或图像，也未修改后端接口。

### 视觉与交互修订

- 使用 TestWise 作为唯一可见产品品牌；从现有 JPG 提取透明葫芦图标，并新增可复用的 `TestWiseLogo` 组件。
- 将应用外壳重构为 52px 半透明顶部导航，使用白色画布、`#F8F9FC`/`#EFF2F7` 分层表面、`#3279F9` 强调色、渐进圆角、克制阴影和 4/8px 间距节奏。
- 桌面导航保留总览、执行、分析、资产、系统分组；支持同级菜单即时悬停切换、点击、焦点、Enter/Space、方向键和 Escape，且不显示 Enter 按键图形。1024px 以下改为无障碍抽屉。
- 顶栏和移动端均使用字面值 `environment`，保留真实 SUT、健康状态、语言切换、通知和账户行为；删除未使用的搜索入口和非顶栏区域的 TestWise 字样。
- 重排仪表盘、执行焦点和运行详情层级，并使用 12/8/4 列响应式布局、44px 触控目标、可见焦点、文本加颜色状态提示，以及 `prefers-reduced-motion` 降级。
- `/observation` 路由保持不变，界面名称更新为“运行详情 / Run Details”。

### 实时日志集成

- 真实契约为 `GET /api/tasks/{task_id}/logs`，响应形状为 `{ success, total, logs: [{ timestamp, level, message }] }`。
- 新增内部 `TaskLogEntry`/`TaskLogSnapshot` 归一化层，兼容后端级别值并生成稳定行 ID；最多保留最新 2,000 条。
- 若任务数据提供日志 `view_url`，前端优先使用；否则根据当前 environment 的 API Base 构建 `/tasks/{task_id}/logs`，包括 `/testwise/` 子路径重写。
- 等待态和执行态每两秒读取一次日志；进入成功、失败或取消终态时执行一次最终读取后停止。状态查询仍独立保持五秒轮询。
- 日志面板提供级别筛选、暂停/继续、本地清空、自动滚动、时间戳、连接状态、移动端换行和无障碍状态播报。暂停只影响日志读取，筛选和清空不修改后端数据。
- 接口不可用、格式错误或暂无内容时显示明确状态；不会生成或替换任何模拟生产日志，终态导出继续可用。

### 自动化与响应式验证

- 基线：46 个测试通过，生产构建成功。
- 最终自动化：`npm run test:run` 通过，11 个测试文件、63 个测试全部通过。
- 构建：默认生产构建和 `VITE_BASE_PATH=/testwise/ npm run build` 均通过；未引入外部字体、emoji 图标或构建产物。
- 本地浏览器验证覆盖 `/`、`/tasks`、`/observation`，视口为 1440、1024、768 和 375px。
- 已验证桌面同级导航切换、点击与键盘导航、Escape 关闭、移动抽屉、environment 选择、语言根类、焦点顺序、减弱动效、表格局部横向滚动、日志移动端换行和页面无水平溢出。
- TestWise 在各页面仅在顶部导航出现一次；抽屉、页眉内容和页脚均不重复品牌，导航菜单无 Enter 图形。

### 真实前后端非回归验证

- 使用 mock fallback 关闭的生产构建，通过 Vite preview 的 `/testwise/api` 同源代理连接真实后端；真实 environment 为“合一版本 API · Live”。
- 契约探测只执行了一个只读 API Key 列表脚本，确认日志接口在运行态和终态返回同一快照结构；未保存或提交原始日志。
- 成功流程：通过优化后的 UI 创建 `task-cea1ad95`，脚本为只读 `test_tc_040_ak006_list_api_keys`。界面显示真实运行日志，状态最终为 `completed`（前端显示“成功”），进度 1/1；终态导出经 `/testwise/api/download/...` 返回 HTTP 200。
- 取消流程：单脚本计时探测 `task-d6e0bb25` 在 DELETE 到达前已经完成，后端按契约拒绝取消且任务保持终态。随后改用六个只读的 MCP 市场/列表查询脚本创建 `task-814f0e1d`；UI 收到取消确认后持续轮询，最终状态为 `cancelled`、进度 5/6，并完成最终日志刷新；取消任务的终态导出返回 HTTP 200。
- 成功、计时探测、取消重试和契约探测任务均已复查为终态；后端报告 `running_count: 0`、`queue_count: 0`，没有遗留等待或执行任务。
- 已验证真实特性/脚本发现、environment 传播、创建请求上下文、状态与日志轮询、取消请求、子路径代理和导出重写；未观察到重复创建、意外 4xx/5xx、CORS、陈旧 SUT 或路由错误，浏览器控制台无 warning/error。

### 后端契约确认

本次没有修改后端服务或既有接口。前端只新增了对现有 `GET /api/tasks/{task_id}/logs` 的消费，继续使用现有 `GET /api/features`、`GET /api/scripts`、`POST /api/tasks`、`GET /api/tasks/{task_id}`、`DELETE /api/tasks/{task_id}` 和终态下载地址。

## English

### Purpose

Upgrade the console to the approved Antigravity-inspired information architecture while preserving TestWise identity, existing routes, SUT context, runtime configuration, identity entry points, and task-lifecycle contracts. This frontend-only revision consumes the backend's existing live-log snapshot endpoint. It does not copy Antigravity brand assets, copy, or imagery, and it does not change the backend.

### Visual and Interaction Changes

- Made TestWise the only visible product brand, derived a transparent gourd icon from the supplied JPG, and added a reusable `TestWiseLogo` component.
- Rebuilt the application shell as a 52px translucent top bar using a white canvas, `#F8F9FC`/`#EFF2F7` layered surfaces, `#3279F9` accent, progressive radii, restrained shadows, and a 4/8px spacing rhythm.
- Preserved the Overview, Execute, Analysis, Assets, and System groups. Desktop navigation supports immediate sibling hover handoff, click, focus, Enter/Space, arrow keys, and Escape without rendering an Enter-key glyph. Below 1024px it becomes an accessible drawer.
- Uses the literal `environment` label in desktop and mobile controls while retaining live SUT selection, health, language, notification, and account behavior. Removed the unused search affordance and all TestWise copy outside the top bar.
- Reworked the dashboard, execution focus, and Run Details hierarchy with 12/8/4-column responsive grids, 44px touch targets, visible focus, text-plus-color status, and `prefers-reduced-motion` overrides.
- Preserved `/observation` as the stable route while visibly renaming it Run Details.

### Live-Log Integration

- The observed wire contract is `GET /api/tasks/{task_id}/logs` returning `{ success, total, logs: [{ timestamp, level, message }] }`.
- Added normalized `TaskLogEntry`/`TaskLogSnapshot` models, backend-level normalization, stable row IDs, and retention of the newest 2,000 entries.
- Uses a returned log `view_url` when present; otherwise builds `/tasks/{task_id}/logs` from the selected environment API base, including `/testwise/` subpath rebasing.
- Fetches log snapshots every two seconds while pending/running, performs one final fetch on success/failure/cancellation, and leaves the independent five-second status poll unchanged.
- The console provides level filters, pause/resume, local clear, autoscroll, timestamps, connection state, mobile wrapping, and accessible status announcements. Pausing affects only log polling; filters and clear never mutate backend data.
- Unavailable, malformed, and empty responses are explicit. Production logs are never simulated, while terminal export remains available.

### Automated and Responsive Verification

- Verified baseline: 46 tests passing and a successful production build.
- Final automation: `npm run test:run` passed all 63 tests across 11 test files.
- Builds: both the default production build and `VITE_BASE_PATH=/testwise/ npm run build` passed, with no external fonts, emoji icons, or build artifacts added.
- Browser verification covered `/`, `/tasks`, and `/observation` at 1440, 1024, 768, and 375px.
- Verified desktop sibling handoff, click and keyboard navigation, Escape close, mobile drawer, environment selection, language root classes, focus order, reduced motion, local table scrolling, mobile log wrapping, and no page-level horizontal overflow.
- TestWise appears exactly once in the top navigation on every checked page; it is absent from the drawer, content headings, and footer, and no Enter glyph is rendered in menus.

### Live Frontend/Backend Non-Regression Gate

- Ran the mock-disabled production build through a Vite preview proxy at `/testwise/api` against the live backend, using the `合一版本 API · Live` environment.
- A single read-only API-key-list contract probe confirmed the same log snapshot shape during active and terminal states. No raw logs were saved or committed.
- Successful lifecycle: the optimized UI created `task-cea1ad95` with read-only `test_tc_040_ak006_list_api_keys`. Real logs rendered, the backend reached `completed` (displayed as Success), progress reached 1/1, and the rebased terminal export returned HTTP 200.
- Cancellation lifecycle: the one-script timing probe `task-d6e0bb25` completed before DELETE arrived, so the backend correctly rejected cancellation and left it terminal. A retry used six read-only MCP market/list query scripts in `task-814f0e1d`; the UI received cancellation acknowledgement, kept polling to `cancelled` at 5/6, performed its final log refresh, and its terminal export returned HTTP 200.
- The success task, timing probe, cancellation retry, and contract probe were all rechecked as terminal. The backend reported `running_count: 0` and `queue_count: 0` with no queued or running task left behind.
- Verified real feature/script discovery, environment propagation, creation context, status/log polling, DELETE, base-path proxying, and export rebasing. No duplicate creation, unexpected 4xx/5xx, CORS failure, stale SUT context, or route error was observed; browser warning/error logs were empty.

### Backend Contract Confirmation

No backend service or existing contract changed. The frontend only adds consumption of the existing `GET /api/tasks/{task_id}/logs` endpoint and continues to use the existing `GET /api/features`, `GET /api/scripts`, `POST /api/tasks`, `GET /api/tasks/{task_id}`, `DELETE /api/tasks/{task_id}`, and terminal download URL contracts.
