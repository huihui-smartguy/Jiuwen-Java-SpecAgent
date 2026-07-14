# TestWise Antigravity Console R2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the TestWise console so every route matches the approved TestWise Antigravity Figma frames exactly, while preserving the existing backend, task, authentication, deployment, and live-log behavior.

**Architecture:** Keep `AppShell` as the owner of shared route, Object, language, account, active-task, and session-task state. Extract an exact `ConsoleHeader`, a locally owned inline fairy-spark, and only the shared page primitives that do not compromise frame geometry. Keep API-shaped types and requests unchanged; route components convert existing runtime/task/script data into Figma-specific view models locally. Replace the legacy CSS cascade with ordered foundation, shell, primitive, and route stylesheets.

**Tech Stack:** React 19, TypeScript 5.8, React Router 7, TanStack Query 5, Vite 6, Vitest 3, Testing Library, Lucide React, semantic HTML, CSS.

## Global Constraints

- The approved Figma file is the visual authority: [TestWise Antigravity Console Demo](https://www.figma.com/design/dZShT2fYtwd9cCYCXpYGAA/TestWise-Antigravity-Console-Demo?node-id=10-3).
- Follow the approved design specification at `docs/superpowers/specs/2026-07-14-testwise-antigravity-console-design.md`.
- Render no visible navigation item, card, label, action, badge, dialog, route, or decorative section absent from the route's approved Figma frame.
- Keep the direct navigation labels fixed in English and in this order: Overview, Tasks, Observe, Results, Scripts, Knowledge, Settings.
- Keep internal `SutTarget` and API field names unchanged. Only visible terminology becomes Object.
- Do not change `DispatchPlatform/src/api/client.ts`, endpoints, request unions, response normalization, auth contracts, base-path helpers, Vite proxying, deployment files, or runtime-config loading.
- Preserve status polling at 5 seconds and active log polling at 2 seconds, including terminal refresh, incremental-log validation, cancellation acknowledgement, and terminal-only log export.
- Do not add dependencies, web fonts, backend endpoints, persistence, uploads, modals, notification flows, or fake success feedback.
- Overview 查看全部 and 查看交互说明; Results 筛选, 导出报告, and 查看用例; Scripts 导入脚本; Knowledge 新建条目, 查看全部, and each 补充; and Settings 保存更改 are focusable presentation controls with `aria-disabled="true"` and no behavior.
- Tasks 更换对象 focuses the existing shell Object selector. Tasks script search, Results recent-report search, Scripts search/Level/Feature filters, and Knowledge search filter already-rendered local data only.
- Use `ui-ux-pro-max` during implementation to audit hierarchy, contrast, responsive behavior, focus, touch targets, and overflow. It validates the approved Figma decisions; it does not add or reinterpret UI.
- Use `superpowers:test-driven-development` for every production change, `superpowers:systematic-debugging` for any unexpected failure, `superpowers:requesting-code-review` before integration, and `superpowers:verification-before-completion` before any completion claim.
- Work only in `Jiuwen-Java-SpecAgent/DispatchPlatform`. Never copy the stale workspace-level `DispatchPlatform` into the clone.
- Never commit `node_modules`, `dist`, screenshots, credentials, or temporary live-backend output.

## Approved Frame Matrix

| Route | Figma node | Required page title |
| --- | --- | --- |
| `/` | `10:3` | `测试看板` |
| `/tasks` | `10:2` | `任务调度` |
| `/observation` | `10:6` | `执行观测` |
| `/results` | `10:4` | `结果与报告` |
| `/scripts` | `10:5` | `脚本资产` |
| `/knowledge` | `10:8` | `知识库` |
| `/settings` | `10:7` | `系统设置` |

## Shared Interfaces

Use these page-facing interfaces. Keep them local unless two or more files require the exact type.

~~~ts
interface ConsoleHeaderProps {
  language: Language;
  selectedObjectId: string;
  objects: readonly SutTarget[];
  auth?: AuthConfig;
  drawerOpen: boolean;
  objectFocusRequest: number;
  onObjectChange: (id: string) => void;
  onLanguageToggle: () => void;
  onDrawerOpenChange: (open: boolean) => void;
}

interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}
~~~

Use narrow route props:

~~~ts
type OverviewProps = {
  language: Language;
  selectedSut: SutTarget;
  activeTask: NormalizedTaskStatus;
  runtimeConfig: RuntimeConfig;
};

type TasksProps = {
  language: Language;
  selectedSut: SutTarget;
  runtimeConfig: RuntimeConfig;
  onTaskCreated: (response: TaskCreateResponse) => void;
  onRequestObjectChange: () => void;
};

type ObservationProps = {
  language: Language;
  selectedSut: SutTarget;
  activeTask: NormalizedTaskStatus;
  runtimeConfig: RuntimeConfig;
  onTaskStatusChange: (task: NormalizedTaskStatus) => void;
};

type ResultsProps = {
  language: Language;
  selectedSut: SutTarget;
  activeTask: NormalizedTaskStatus;
  sessionTasks: NormalizedTaskStatus[];
  runtimeConfig: RuntimeConfig;
};

type ScriptsProps = {
  language: Language;
  selectedSut: SutTarget;
  runtimeConfig: RuntimeConfig;
};

type KnowledgeProps = {
  language: Language;
};

type SettingsProps = {
  language: Language;
  selectedSut: SutTarget;
  runtimeConfig: RuntimeConfig;
  onObjectChange: (id: string) => void;
  onLanguageChange: (language: Language) => void;
};
~~~

## Preflight: Establish a Trustworthy Baseline

**Working directory for every command below:** repository root `Jiuwen-Java-SpecAgent`. NPM commands use `--prefix DispatchPlatform`; file and Git paths remain repository-root relative.

- [ ] Load the required execution skill, `superpowers:test-driven-development`, and `ui-ux-pro-max` before editing source code.

- [ ] Install repository-locked dependencies.

~~~bash
npm --prefix DispatchPlatform ci
~~~

Expected: installation succeeds from `package-lock.json`; `package.json` and `package-lock.json` remain unchanged.

- [ ] Run the existing suite before changing production code.

~~~bash
npm --prefix DispatchPlatform run test:run
~~~

Expected: the baseline suite passes. If it does not, invoke `superpowers:systematic-debugging`, identify whether the failure is environmental or already present in the authoritative clone, and do not normalize a real failure into the redesign.

- [ ] Confirm the branch and implementation baseline.

~~~bash
git status --short --branch
git rev-parse --abbrev-ref HEAD
git log -2 --oneline
~~~

Expected: branch `lalala/testwise-antigravity-console` and no unreviewed source changes.

---

## Task 1: Implement the Exact Console Shell

**Figma target:** the shared header on all seven approved nodes.

**Files:**

- Create: `DispatchPlatform/src/components/FairySparkLogo.tsx`
- Create: `DispatchPlatform/src/components/ConsoleHeader.tsx`
- Create: `DispatchPlatform/src/styles/foundations.css`
- Create: `DispatchPlatform/src/styles/shell.css`
- Create: `DispatchPlatform/src/styles/primitives.css`
- Modify: `DispatchPlatform/src/AppShell.tsx`
- Modify: `DispatchPlatform/src/AppShell.test.tsx`
- Modify: `DispatchPlatform/src/components/AccountMenu.tsx`
- Modify: `DispatchPlatform/src/components/AccountMenu.test.tsx`
- Modify: `DispatchPlatform/src/i18n.ts`
- Replace: `DispatchPlatform/src/styles.css`
- Delete: `DispatchPlatform/src/components/TestWiseLogo.tsx`
- Delete: `DispatchPlatform/public/testwise-gourd.png`

- [ ] Rewrite shell tests first so they fail against the grouped navigation.

Use this exact direct-navigation contract:

~~~ts
const expectedNavigation = [
  ['Overview', '/'],
  ['Tasks', '/tasks'],
  ['Observe', '/observation'],
  ['Results', '/results'],
  ['Scripts', '/scripts'],
  ['Knowledge', '/knowledge'],
  ['Settings', '/settings']
] as const;

const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
expect(within(navigation).getAllByRole('link').map((link) => [
  link.textContent,
  link.getAttribute('href')
])).toEqual(expectedNavigation);
~~~

Also assert one visible Console wordmark, one inline SVG named Fairy spark, one active `aria-current="page"` link, an Object control with selected target name/version/status, compact EN in Chinese mode, visible TW on the closed account trigger, and no visible TestWise, Test Agent Console, 测试指挥控制台, TESTWISE CONTROL PLANE, Health, bell, grouped trigger, menu, or menuitem.

Keep drawer tests for the same seven links and Object/language/account controls, focus trap, Escape, navigation close, focus restoration, and header/main inerting.

- [ ] Run the focused tests and confirm the intended red state.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/AppShell.test.tsx src/components/AccountMenu.test.tsx
~~~

Expected: failures identify the old brand, grouped navigation, environment label, health badge, bell, and account-trigger presentation.

- [ ] Add the fixed navigation data.

~~~ts
export const navigationItems = [
  { label: 'Overview', to: '/', end: true },
  { label: 'Tasks', to: '/tasks' },
  { label: 'Observe', to: '/observation' },
  { label: 'Results', to: '/results' },
  { label: 'Scripts', to: '/scripts' },
  { label: 'Knowledge', to: '/knowledge' },
  { label: 'Settings', to: '/settings' }
] as const;
~~~

`ConsoleHeader` renders the desktop header and responsive drawer. `AppShell` retains drawer state, selected Object, language, active task, session tasks, routes, inerting, task normalization, and task callbacks. Remove grouped-menu refs/timers/handlers, group icons, Bell, and standalone shell StatusBadge only.

- [ ] Implement `FairySparkLogo` as a 28×28 inline SVG with a four-point fairy silhouette and locally scoped red/amber/green/blue/violet gradient. Use `role="img"` and `aria-label="Fairy spark"`. Use no external image source.

- [ ] Change only the closed `AccountMenu` trigger to circular TW. Preserve the profile query, outside click, Escape, sign-in, registration, sign-out, and unavailable-session behavior.

- [ ] Replace the CSS cascade rather than appending a third override layer.

`styles.css` initially contains only:

~~~css
@import './styles/foundations.css';
@import './styles/shell.css';
@import './styles/primitives.css';
~~~

Implement the approved tokens; 64px sticky translucent header; 1360px inner maximum; 26px horizontal padding; centered direct links; active `#EDF4FF`/`#155FD8` treatment; Object/EN/TW only; 1180px drawer breakpoint; visible focus; 44px responsive targets; no page-level overflow; reduced motion.

- [ ] Run focused tests, the full suite, and build.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/AppShell.test.tsx src/components/AccountMenu.test.tsx
npm --prefix DispatchPlatform run test:run
npm --prefix DispatchPlatform run build
~~~

Expected: all pass; route paths, shared state, and account behavior are unchanged.

- [ ] Commit the shell task.

~~~bash
git add DispatchPlatform/src DispatchPlatform/public/testwise-gourd.png
git commit -m "feat: implement approved TestWise Console shell"
~~~

---

## Task 2: Match the Approved Overview Frame

**Figma target:** Overview node `10:3`.

**Files:**

- Create: `DispatchPlatform/src/components/PageHeader.tsx`
- Create: `DispatchPlatform/src/components/MetricCard.tsx`
- Create: `DispatchPlatform/src/components/PresentationOnlyButton.tsx`
- Create: `DispatchPlatform/src/pages/Dashboard.test.tsx`
- Create: `DispatchPlatform/src/styles/routes/overview.css`
- Modify: `DispatchPlatform/src/components/ExecutionFocus.tsx`
- Modify: `DispatchPlatform/src/pages/Dashboard.tsx`
- Modify: `DispatchPlatform/src/AppShell.test.tsx`
- Modify: `DispatchPlatform/src/i18n.ts`
- Modify: `DispatchPlatform/src/styles.css`

- [ ] Add failing tests for the exact Overview composition and order:

1. 测试看板, approved subtitle, and functional 新建任务 link to `/tasks`.
2. Real current-run strip with task ID, completed/total progress, current command, and 打开观测台 link to `/observation`.
3. One 质量摘要 card with score 93.6 and exactly 基本功能, 性能测试, 场景化, DFX 测试.
4. Exactly three metric cards with mock-fallback values 24, 93.6%, and 7.
5. One five-stage 执行路径.
6. One 最近活动 with exactly three rows and a presentation-only 查看全部 affordance.
7. One warning-toned 需要关注 card with a presentation-only 查看交互说明 affordance.

Assert absence of the Object eyebrow, control-plane copy, four separate legacy quality cards, and any unapproved block.

- [ ] Confirm the intended red state.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/pages/Dashboard.test.tsx src/AppShell.test.tsx
~~~

- [ ] Implement `PageHeader` and `MetricCard` with the shared interfaces. Implement `PresentationOnlyButton` as a focusable `type="button"` control with `aria-disabled="true"` and no state, request, overlay, route, or message. Keep the score ring, path, activity, and attention markup route-specific.

- [ ] Reshape `ExecutionFocus` into the approved horizontal strip. Compute all dynamic content from `activeTask` and `selectedSut`. Never synthesize a live task or log line.

- [ ] Recompose `Dashboard` into the 4-column quality card and 8-column right region. Use approved presentation values only under mock fallback; real task state always powers the current-run strip.

- [ ] Add `overview.css` and import it after primitives. Match the 1320px main maximum, 48/44/80px padding, 12-column grid, 18px gutters, 20px card radii, approved shadows, and frame vertical rhythm. Collapse in source order at 8- and 4-column breakpoints.

- [ ] Run targeted/full verification and commit.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/pages/Dashboard.test.tsx src/AppShell.test.tsx
npm --prefix DispatchPlatform run test:run
npm --prefix DispatchPlatform run build
git add DispatchPlatform/src
git commit -m "feat: match approved TestWise Overview frame"
~~~

---

## Task 3: Match the Approved Tasks Frame Without Regressing Creation

**Figma target:** Tasks node `10:2`.

**Files:**

- Create: `DispatchPlatform/src/styles/routes/tasks.css`
- Modify: `DispatchPlatform/src/pages/Tasks.tsx`
- Modify: `DispatchPlatform/src/pages/Tasks.test.tsx`
- Modify: `DispatchPlatform/src/AppShell.tsx`
- Modify: `DispatchPlatform/src/AppShell.test.tsx`
- Modify: `DispatchPlatform/src/i18n.ts`
- Modify: `DispatchPlatform/src/styles.css`

- [ ] Rewrite Tasks tests against the permanent one-page composition. Retain feature and explicit-script request tests; add level-mode coverage.

Verify these payloads:

~~~ts
{ product: selectedSut.product, scene: selectedSut.scene, feature: 'Save API' }
{ product: selectedSut.product, scene: selectedSut.scene, level: 'L1' }
{
  product: selectedSut.product,
  scene: selectedSut.scene,
  feature: 'Save API',
  script_name: ['save_api_test']
}
~~~

Also assert title/subtitle/创建任务; 配置新任务; the Object/Trigger/Scope row; selected Object; a 更换对象 affordance that focuses the desktop Object selector; the same affordance opens the drawer and focuses its Object selector below 1180px; Feature/Level/Scripts segmented choice; Feature and execution-profile fields; 脚本快照 with its local search field; Launch summary; 执行护栏; Object propagation; successful navigation to `/observation`; and absence of queue, tabs, wizard pages, modal, and back/next controls.

- [ ] Confirm the red state.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/pages/Tasks.test.tsx src/AppShell.test.tsx
~~~

- [ ] Remove `activeTask`, `sessionTasks`, and `onTaskSelected` from Tasks props and AppShell route wiring. Preserve language, selected Object, runtime config, and `onTaskCreated`; add `onRequestObjectChange` for the approved 更换对象 affordance.

- [ ] Preserve current query keys, target-scoped `getFeatures`/`getScripts`, fallback behavior, payload union, `createTask` mutation, error extraction, and success navigation. Remove only queue/tab/wizard state.

- [ ] Use an accessible segmented control with visible labels 按 Feature, 按 Level, 选择脚本. The top 创建任务 focuses the first configuration control; Launch summary's 启动执行 submits the existing mutation. Execution profile and estimate never enter `TaskCreateRequest`.

- [ ] Let AppShell own a monotonic Object-focus request token. Pass it to ConsoleHeader as `objectFocusRequest` and pass a request callback to Tasks. On desktop, ConsoleHeader focuses its Object selector. Below 1180px, it opens the drawer and focuses the drawer Object selector after render. Cover both paths by mocking `matchMedia`. Filter the already fetched script snapshot locally from the approved search field; do not make a search request.

- [ ] Keep the approved script snapshot height. In explicit-script mode, use keyboard-selectable rows backed by visually hidden checkboxes; add no visible checkbox column.

- [ ] Derive guardrail truth conservatively. Object availability comes from target status; script availability comes from the query. Credential validity and ~6 min appear as approved mock-only values. In live mode show Not verified and — when no backend evidence exists.

- [ ] Add/import `tasks.css` and match the 8/4 grid, card/table heights, segmented control, fields, compact right rail, and responsive source order.

- [ ] Run targeted/full verification and commit.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/pages/Tasks.test.tsx src/AppShell.test.tsx
npm --prefix DispatchPlatform run test:run
npm --prefix DispatchPlatform run build
git add DispatchPlatform/src
git commit -m "feat: match approved TestWise Tasks frame"
~~~

---

## Task 4: Match the Approved Observe Frame and Preserve Live Safety

**Figma target:** Observe node `10:6`.

**Files:**

- Create: `DispatchPlatform/src/components/LogExportAction.tsx`
- Create: `DispatchPlatform/src/components/LogExportAction.test.tsx`
- Create: `DispatchPlatform/src/styles/routes/observe.css`
- Modify: `DispatchPlatform/src/pages/Observation.tsx`
- Modify: `DispatchPlatform/src/pages/Observation.test.tsx`
- Modify: `DispatchPlatform/src/components/LiveLogConsole.tsx`
- Modify: `DispatchPlatform/src/components/LiveLogConsole.test.tsx`
- Modify: `DispatchPlatform/src/data/mockData.ts`
- Modify: `DispatchPlatform/src/i18n.ts`
- Modify: `DispatchPlatform/src/AppShell.test.tsx`
- Modify: `DispatchPlatform/src/styles.css`
- Delete: `DispatchPlatform/src/components/LogExportPanel.tsx`
- Delete: `DispatchPlatform/src/components/LogExportPanel.test.tsx`

- [ ] Update Observe tests first. Assert title/subtitle/status/title-row export; four metrics in status/progress/elapsed/Object order; one five-stage path with truthful 状态每 5 秒刷新一次 copy; one dark Execution events surface; one 任务控制 card; 5000ms active polling; terminal stop; cancellation/refetch/acknowledgement; status propagation; terminal export URL; disabled active export; and absence of visible filters, pause, clear, or connection toolbar.

- [ ] Update LiveLog tests to retain real snapshot rendering, 2000ms polling, terminal final refresh, incremental-snapshot rejection, auto-scroll, unavailable/no-fake-log states, and live-region count. Add cases proving a successful real snapshot takes precedence over mock entries, mock entries appear only after request failure when explicitly supplied, and no mock entry can render when the prop is absent. Remove tests for deleted filter/pause/clear controls.

- [ ] Confirm the intended red state.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/pages/Observation.test.tsx src/components/LiveLogConsole.test.tsx src/components/LogExportAction.test.tsx
~~~

- [ ] Replace the standalone export panel with `LogExportAction` in the title row. Preserve `canExportLogs`, backend URL, disabled prevention, download semantics, and `aria-disabled`.

- [ ] Recompose Observation without changing its query, mutation, fallback, normalization, 5000ms interval, cancellation, or status callback. Map backend state into five visual stages; unknown future stages remain neutral.

- [ ] Delete only LiveLog's paused/filter/clear UI state. Keep query key, `getTaskLogs`, 2000ms interval, terminal refetch, incremental validation, error handling, real entries, empty state, auto-scroll, and line-count live region.

- [ ] Export the approved sample events from `mockData.ts` as valid `TaskLogEntry[]`. Add an optional `mockEntries?: readonly TaskLogEntry[]` prop to `LiveLogConsole`; Observation passes it only when `runtimeConfig.enableMockFallback` is true. Use it only after a log request failure, render the exact Figma disclosure `LIVE STATUS · NOT LIVE LOGS`, and always prefer a successful real snapshot. Live mode passes no mock entries and can render only fetched logs or the truthful unavailable state.

- [ ] Add/import `observe.css` and match the four metrics, full-width path, 8/4 lower grid, near-black monospaced event surface, metadata card, danger-outline cancel action, and responsive order.

- [ ] Run targeted/full verification and commit.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/pages/Observation.test.tsx src/components/LiveLogConsole.test.tsx src/components/LogExportAction.test.tsx
npm --prefix DispatchPlatform run test:run
npm --prefix DispatchPlatform run build
git add DispatchPlatform/src
git commit -m "feat: match approved TestWise Observe frame"
~~~

---

## Task 5: Build Results From Existing Task State

**Figma target:** Results node `10:4`.

**Files:**

- Create: `DispatchPlatform/src/pages/Results.test.tsx`
- Create: `DispatchPlatform/src/styles/routes/results.css`
- Modify: `DispatchPlatform/src/pages/Results.tsx`
- Modify: `DispatchPlatform/src/AppShell.tsx`
- Modify: `DispatchPlatform/src/AppShell.test.tsx`
- Modify: `DispatchPlatform/src/i18n.ts`
- Modify: `DispatchPlatform/src/styles.css`

- [ ] Add failing tests for mock and live modes. Mock mode asserts disabled 筛选/导出报告/查看用例, metrics 42/93.6%/17/05:48, one accessible seven-day SVG trend, four failure rows, and the approved three-row 最近报告 table with its local search field. Live mode passes explicit session tasks and asserts every row/summary derives only from those tasks and `activeTask`, makes zero report requests, and invents no missing category. The recent-report search filters in-memory rows only.

- [ ] Confirm the red state.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/pages/Results.test.tsx
~~~

- [ ] Reuse `PresentationOnlyButton` for 筛选, 导出报告, and 查看用例. None performs a state change, fetch, mutation, overlay, route change, or message.

- [ ] Pass `sessionTasks` from AppShell to Results. Build a local view model from existing task IDs, statuses/results, timing, and selected Object. De-duplicate by task ID with the latest active task taking precedence. Use — or zero when live data is absent. Use exact approved frame values only in mock fallback.

- [ ] Draw the trend as an accessible inline SVG with no dependency, tooltip, animation, or extra legend.

- [ ] Add/import `results.css` and match the four metrics, 7/5 chart grid, full-width table, trend fill/stroke, failure bars, and responsive collapse.

- [ ] Run targeted/full verification and commit.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/pages/Results.test.tsx src/AppShell.test.tsx
npm --prefix DispatchPlatform run test:run
npm --prefix DispatchPlatform run build
git add DispatchPlatform/src
git commit -m "feat: build approved TestWise Results frame"
~~~

---

## Task 6: Build Scripts From Existing Script Sources

**Figma target:** Scripts node `10:5`.

**Files:**

- Create: `DispatchPlatform/src/pages/Scripts.test.tsx`
- Create: `DispatchPlatform/src/styles/routes/scripts.css`
- Modify: `DispatchPlatform/src/pages/Scripts.tsx`
- Modify: `DispatchPlatform/src/data/mockData.ts`
- Modify: `DispatchPlatform/src/i18n.ts`
- Modify: `DispatchPlatform/src/styles.css`

- [ ] Add failing tests for title/subtitle/disabled 导入脚本; exactly four mock summaries with values 286/84/126/76; only approved search/Object/Level/Feature controls; five approved mock rows with Last result values Passed/Passed/Failed/Passed/Flaky; full table columns Script/Feature/Level/Last result/Owner/Updated; selected-target `getScripts` request; target-scoped fallback; local search/Level/Feature filtering; no import request/dialog/message/route; and — for live Last result because the existing script/task contracts contain no script-result join.

- [ ] Confirm the red state.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/pages/Scripts.test.tsx
~~~

- [ ] Implement one TanStack query with existing `getScripts`, API-base resolution, selected product/scene, and fallback. Do not change `Script` or add an upload endpoint.

- [ ] Extend `mockScripts` to exactly five valid API-shaped fallback rows for the frame. Keep Last result out of the backend `Script` type: define a page-local typed presentation map keyed by mock script ID with Passed, Failed, or Flaky. Derive live summaries from fetched rows and render — for live Last result; approved totals and status mapping are mock-only.

- [ ] Filter fetched rows locally. Keep the Object filter read-only and bound to the shell selection.

- [ ] Add/import `scripts.css` and match the four equal cards, compact filter row, fixed table density, contained horizontal scroll, status pills, and responsive behavior.

- [ ] Run targeted/full verification and commit.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/pages/Scripts.test.tsx
npm --prefix DispatchPlatform run test:run
npm --prefix DispatchPlatform run build
git add DispatchPlatform/src
git commit -m "feat: build approved TestWise Scripts frame"
~~~

---

## Task 7: Build the Local Knowledge Frame

**Figma target:** Knowledge node `10:8`.

**Files:**

- Create: `DispatchPlatform/src/pages/Knowledge.test.tsx`
- Create: `DispatchPlatform/src/styles/routes/knowledge.css`
- Modify: `DispatchPlatform/src/pages/Knowledge.tsx`
- Modify: `DispatchPlatform/src/i18n.ts`
- Modify: `DispatchPlatform/src/styles.css`
- Delete: `DispatchPlatform/src/pages/ShellPage.tsx`

- [ ] Add failing tests for exactly: title/subtitle/disabled 新建条目; one 今天要查找什么? search surface; exactly three collection cards 对象手册/测试策略/失败模式; an 8-column 最近更新 with three rows and disabled 查看全部; and a 4-column 知识缺口 with three rows and three disabled 补充 affordances. Assert no request, editor, modal, route, extra collection, pagination, or footer.

- [ ] Confirm the red state.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/pages/Knowledge.test.tsx
~~~

- [ ] Implement the approved bilingual local copy. The search field filters local strings only; it never calls a backend or displays invented remote results.

- [ ] Delete `ShellPage.tsx` and confirm no imports remain.

~~~bash
rg "ShellPage" DispatchPlatform/src
~~~

Expected: no matches.

- [ ] Add/import `knowledge.css`. Use the approved pale gradient only on the search surface; match the 3-card row, 8/4 lower grid, list dividers, and responsive order.

- [ ] Run targeted/full verification and commit.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/pages/Knowledge.test.tsx
npm --prefix DispatchPlatform run test:run
npm --prefix DispatchPlatform run build
git add DispatchPlatform/src
git commit -m "feat: build approved TestWise Knowledge frame"
~~~

---

## Task 8: Build Settings Without Persistence

**Figma target:** Settings node `10:7`.

**Files:**

- Create: `DispatchPlatform/src/pages/SettingsPage.test.tsx`
- Create: `DispatchPlatform/src/styles/routes/settings.css`
- Modify: `DispatchPlatform/src/pages/SettingsPage.tsx`
- Modify: `DispatchPlatform/src/AppShell.tsx`
- Modify: `DispatchPlatform/src/AppShell.test.tsx`
- Modify: `DispatchPlatform/src/i18n.ts`
- Modify: `DispatchPlatform/src/styles.css`

- [ ] Add failing tests for title/subtitle/disabled 保存更改; exactly Object 连接/运行环境/控制台偏好/报告与日志; selected Object values; read-only deployment/API values; shared Object/language callbacks; local-only reduced-motion/report-format/retention/connection-check controls; no save fetch/storage/message/navigation; and clipboard copy of the API base URL with no toast.

- [ ] Confirm the red state.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/pages/SettingsPage.test.tsx src/AppShell.test.tsx
~~~

- [ ] Pass existing Object and language setters from AppShell to Settings. Keep shared state ownership in AppShell and add no persistence.

- [ ] Implement exactly four cards. Runtime values remain read-only. Local controls affect the current render only. A reduced-motion document class must clean up and continue respecting `prefers-reduced-motion`.

- [ ] Keep Save inert. Implement only the visible clipboard action; add no feedback UI.

- [ ] Add/import `settings.css` and match the exact 2×2 grid, compact dividers, pills, switches, fields, and responsive single-column order.

- [ ] Run targeted/full verification and commit.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/pages/SettingsPage.test.tsx src/AppShell.test.tsx
npm --prefix DispatchPlatform run test:run
npm --prefix DispatchPlatform run build
git add DispatchPlatform/src
git commit -m "feat: build approved TestWise Settings frame"
~~~

---

## Task 9: Verify Every Navigation Destination and Frame

**Files:**

- Modify: `DispatchPlatform/src/AppShell.test.tsx`
- Modify route/component tests only when verification exposes a real gap.

- [ ] Add one AppShell click-through test that clicks every direct link in sequence.

~~~ts
const destinations = [
  ['Overview', '测试看板'],
  ['Tasks', '任务调度'],
  ['Observe', '执行观测'],
  ['Results', '结果与报告'],
  ['Scripts', '脚本资产'],
  ['Knowledge', '知识库'],
  ['Settings', '系统设置']
] as const;
~~~

After each click assert the destination heading, exactly one active `aria-current="page"` link, and six inactive links.

- [ ] On every destination assert absence of visible TestWise, Test Agent Console, 测试指挥控制台, TESTWISE CONTROL PLANE, Health, bell, grouped trigger, menu, menuitem, and route-specific extra blocks.

- [ ] Run clean automated verification.

~~~bash
npm --prefix DispatchPlatform run test:run
npm --prefix DispatchPlatform run build
VITE_BASE_PATH=/testwise/ npm --prefix DispatchPlatform run build
git status --short
~~~

Expected: tests/builds pass; only intentional source/docs changes exist; `dist` and `node_modules` are not staged.

- [ ] Start the production-subpath preview in a managed long-running terminal session and retain its session ID.

~~~bash
VITE_BASE_PATH=/testwise/ npm --prefix DispatchPlatform run preview -- --host 127.0.0.1 --port 4173
~~~

Expected URL: `http://127.0.0.1:4173/testwise/`.

- [ ] Use the browser control skill to click all seven header links. At each route verify URL, active state, one level-one heading, Object, EN, TW, keyboard focus, and no console warning/error. If the connector remains unavailable, use the passing click-through test as interaction evidence and headless Chrome for captures; record that limitation accurately.

- [ ] Capture all routes at 1440×1100 under `/private/tmp`:

~~~text
testwise-r2-actual-overview.png
testwise-r2-actual-tasks.png
testwise-r2-actual-observe.png
testwise-r2-actual-results.png
testwise-r2-actual-scripts.png
testwise-r2-actual-knowledge.png
testwise-r2-actual-settings.png
~~~

Compare each directly with its approved Figma node. Inspect header geometry, title placement, block count/order, grid spans, card dimensions, typography, colors, borders, shadows, table density, and removed elements. Record each actual capture's SHA-256 in the revision evidence. Correct every mismatch and repeat targeted tests/build/capture; never alter the reference.

- [ ] Inspect 1179px, 768px, and 390px. Verify drawer substitution, source-order stacking, 44px targets, table-contained overflow, no page horizontal scroll, focus visibility, and reduced motion.

- [ ] Run the `ui-ux-pro-max` audit. Fix only evidence-backed contrast, semantics, focus, target-size, overflow, responsive-order, reduced-motion, or status-color violations without adding UI.

- [ ] Stop the managed preview session with Ctrl-C and confirm port 4173 is no longer serving before continuing.

- [ ] Commit cross-route tests and verified corrections.

~~~bash
git add DispatchPlatform/src
git commit -m "test: verify all TestWise Console routes"
~~~

---

## Task 10: Verify Live Behavior and Record the Revision

**Files:**

- Create: `DispatchPlatform/docs/revision-records/2026-07-14-testwise-antigravity-console-r2.md`

- [ ] Verify `http://1.92.123.95/testwise/` loads, runtime config resolves, and existing feature/script/status/log URLs retain their contracts. Make no backend-code change.

- [ ] Exercise one documented live task lifecycle: create a known scoped script task, observe status, cancel immediately, and verify final status. Do not finish while the created task remains queued/running. Record only task ID and sanitized status evidence.

- [ ] Re-run focused non-regression tests.

~~~bash
npm --prefix DispatchPlatform run test:run -- src/api/client.test.ts src/pages/Tasks.test.tsx src/pages/Observation.test.tsx src/components/LiveLogConsole.test.tsx src/components/LogExportAction.test.tsx
~~~

- [ ] Write the revision record with exactly these sections:

1. approved Figma frame/node matrix;
2. shell and seven-route implementation;
3. preserved API/auth/polling/base-path behavior;
4. presentation-only controls;
5. automated test/build evidence;
6. 1440×1100 and responsive visual evidence;
7. seven-link click-through evidence;
8. sanitized live lifecycle evidence;
9. known limitations, including connector limitations;
10. implementation commit list preceding the revision-record commit.

- [ ] Invoke `superpowers:requesting-code-review`. Address evidence-backed in-scope findings and rerun affected verification.

- [ ] Invoke `superpowers:verification-before-completion` and run final clean checks.

~~~bash
npm --prefix DispatchPlatform run test:run
npm --prefix DispatchPlatform run build
VITE_BASE_PATH=/testwise/ npm --prefix DispatchPlatform run build
git diff --check
git status --short
~~~

Expected: all pass; whitespace check is clean; only the revision record or intentional review corrections remain uncommitted.

- [ ] Commit the revision record and final corrections.

~~~bash
git add DispatchPlatform/docs DispatchPlatform/src
git commit -m "docs: record TestWise Antigravity R2 revision"
~~~

---

## Task 11: Integrate and Push the Complete DispatchPlatform Directory

- [ ] Confirm every required file is committed and `DispatchPlatform` remains at repository root.

~~~bash
git status --short
git ls-tree --name-only HEAD DispatchPlatform
git log --oneline develop..HEAD
~~~

Expected: clean worktree; `DispatchPlatform` is present; the intentional R2 commit series is visible.

- [ ] Fetch remote develop. If it advanced, rebase the feature branch onto `origin/develop`, resolve only in-scope conflicts, and repeat Task 10 verification.

~~~bash
git fetch origin develop
git rebase origin/develop
~~~

- [ ] Use `superpowers:finishing-a-development-branch`, then fast-forward local develop because the user explicitly requested delivery to develop.

~~~bash
git checkout develop
git merge --ff-only lalala/testwise-antigravity-console
~~~

- [ ] Push the complete repository.

~~~bash
git push origin develop
~~~

- [ ] Verify remote develop matches local HEAD and the worktree is clean.

~~~bash
git ls-remote origin refs/heads/develop
git rev-parse HEAD
git status --short --branch
~~~

Expected: local HEAD equals remote develop; `DispatchPlatform` remains at repository root; no generated or secret files were published.
