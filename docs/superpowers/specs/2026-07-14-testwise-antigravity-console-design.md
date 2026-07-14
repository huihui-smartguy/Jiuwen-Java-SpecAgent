# TestWise Antigravity Console R2 Design Specification

**Status:** Approved by the user; implementation authorized

**Date:** 2026-07-14

**Repository baseline:** `develop` at `b5906f4e4500d147636dcfab56bb6ac4774b5ea0`

**Figma source of truth:** [TestWise Antigravity Console Demo](https://www.figma.com/design/dZShT2fYtwd9cCYCXpYGAA/TestWise-Antigravity-Console-Demo?node-id=10-3)

## 1. Authority and Fidelity Rule

The seven approved Figma frames are the visual source of truth. Implement them without adding visible navigation items, cards, labels, controls, notifications, dialogs, routes, or features that are absent from the approved frames.

When sources disagree, apply this precedence:

1. Approved Figma frame for the route.
2. This specification.
3. `gemini_ui/testwise_ui_optimization_plan.md` and `gemini_ui/antigravity_ui_design_analysis.md`.
4. Existing frontend presentation.

The current frontend remains authoritative for API contracts, task lifecycle, authentication, routing, subpath deployment, and live-log behavior. Visual fidelity must not regress those capabilities.

## 2. Approved Frames

All desktop reference frames are 1440 × 1100 pixels on the Figma page `TestWise • Antigravity R2`.

| Route | Figma node | Visible navigation label | Reference SHA-256 |
| --- | --- | --- | --- |
| `/` | `10:3` | Overview | `9cccc5ba8c41df0addfab3bae9439f620c23663f3512e27cf355f70eb27ffc50` |
| `/tasks` | `10:2` | Tasks | `28e98411d1818eaaf4df9753e153aafba2f0744805b63e03224c8da4aa9de858` |
| `/observation` | `10:6` | Observe | `a05043b6d24e6af6dc1906c75628e5d00f15e2a746f7b868d841c4d04c08f1c2` |
| `/results` | `10:4` | Results | `2c2e524f42f1e121d66319cd406c1c905fae8decd45680f9166e7b343d250a9f` |
| `/scripts` | `10:5` | Scripts | `5ad908fdea84d57da8b5fc86d0e7fa72639f28fb91eab2d5f06ae58d10753335` |
| `/knowledge` | `10:8` | Knowledge | `9c1f92f212d7f4122501f51239fb1f102cad5a8a30f8d9332a425a2f2b9d9ae6` |
| `/settings` | `10:7` | Settings | `dc2074940711f5b4c184a438f03048b2c50f53b464eb298746dcb52ff25b42d7` |

The Figma prototype begins at `10:3`. Each frame contains direct navigation hotspots to the other six routes; active destinations are inert.

## 3. Scope

### In scope

- Replace the current grouped desktop navigation with the approved seven direct links.
- Replace the TestWise/gourd brand treatment with the approved multicolor fairy-spark and `Console` wordmark.
- Replace every visible `SUT` or `environment` selector label in the application shell with `Object` while retaining the existing internal `SutTarget` data contract.
- Remove the header health indicator and every removed brand/subtitle/eyebrow from the approved desktop views.
- Rebuild all seven route layouts to match their approved frame.
- Preserve and restyle existing task creation, polling, cancellation, live-log, export, language, object-selection, account, runtime-config, base-path, and authentication behavior.
- Provide responsive derivatives that contain the same information and actions without changing the approved 1440px desktop composition.
- Update automated tests and add a revision record.

### Out of scope

- Backend changes or new API endpoints.
- New persistence, import, knowledge-authoring, settings-save, reporting, or notification workflows.
- New routes, data models, third-party UI kits, external fonts, or runtime dependencies.
- Extra desktop navigation controls, dropdown groups, health badges, search, notification bells, secondary brand text, or decorative sections.
- Copying Google, Apple, or Gemini brand assets. The fairy-spark is a TestWise-owned inline SVG using the approved color direction.

## 4. Application Shell

### 4.1 Header geometry

- Height: 64px.
- Position: sticky at the viewport top.
- Surface: `rgba(255,255,255,0.86)` with 18px blur and 160% saturation.
- Bottom separator: `rgba(33,34,38,0.065)`.
- Inner width: max 1360px, centered, 26px horizontal padding.
- Structure: brand, centered direct navigation, right-side controls.

### 4.2 Brand

- A 28 × 28px inline SVG fairy-spark with red, amber, green, blue, and violet gradient stops.
- Wordmark: `Console`, 15px, bold, dark text.
- No visible `TestWise`, `Test Agent Console`, `测试指挥控制台`, or subtitle in the header.
- No padded JPG/JPEG logo asset.

### 4.3 Direct navigation

Render exactly these links in this order:

`Overview`, `Tasks`, `Observe`, `Results`, `Scripts`, `Knowledge`, `Settings`.

- Labels remain English in the approved Chinese-state frame.
- Each link is a real route link with `aria-current="page"` on the active item.
- Default: transparent background, dark secondary text.
- Active: `#EDF4FF` background, `#155FD8` text, 9px radius, stronger weight.
- Navigation is distributed across the available center space with the Apple-like rhythm shown in Figma; it must not revert to grouped dropdowns.

### 4.4 Right-side controls

Render exactly:

1. `Object` selector showing the selected target name/version/status.
2. Compact language button (`EN` in the approved Chinese state).
3. Circular `TW` account trigger.

Do not render Health, a notification bell, global search, or another utility.

The Object selector must continue to update the existing selected target and propagate it to Tasks, Observation, API discovery, and task creation. The `TW` trigger retains the existing account menu and authentication behavior without changing the closed header appearance.

### 4.5 Responsive shell

The 1440px desktop header must match Figma exactly. At widths below 1180px, use the existing accessible drawer behavior instead of compressing the direct links. The drawer contains only the same seven destinations and required Object/language/account controls; it must not introduce new information or desktop-visible UI.

## 5. Visual Tokens

### Color

| Token | Value |
| --- | --- |
| Canvas | `#FFFFFF` |
| Surface low | `#F8F9FC` |
| Surface | `#F1F4F9` |
| Surface high | `#E8EDF5` |
| Primary text | `#121317` |
| Secondary text | `#45474D` |
| Muted text | `#737781` |
| Outline | `rgba(33,34,38,0.11)` |
| Soft outline | `rgba(33,34,38,0.065)` |
| Accent | `#3279F9` |
| Accent surface | `#EDF4FF` |
| Success | `#148A55` |
| Success surface | `#EAF8F0` |
| Warning | `#A96800` |
| Warning surface | `#FFF5E3` |
| Danger | `#C73D4D` |
| Danger surface | `#FFF0F2` |

### Typography

- UI stack: `"Noto Sans SC", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Monospace stack: `"IBM Plex Mono", "SFMono-Regular", Consolas, monospace`.
- Page title: 38px, 700 weight, 1.14 line height, `-0.045em` tracking.
- Body: 13–14px with restrained secondary text.
- Labels and table text: 9–12px as shown in the frames.
- Do not load web fonts; use installed/system fallbacks.

### Shape and elevation

- Major cards: 20px radius.
- Buttons and fields: 10–12px radius.
- Pills: full radius.
- Major shadow: `0 1px 2px rgba(23,28,38,0.04), 0 10px 30px rgba(53,65,88,0.055)`.
- Use 4/8px-derived spacing. Do not introduce stronger shadows, glow, gradients, or decorative glass outside the approved header and knowledge-search surface.

### Main layout

- Max content width: 1320px.
- Desktop padding: 48px 44px 80px.
- Primary grid: 12 columns with 18px gutters.
- Title row: minimum 90px, 24px bottom separation.
- Responsive derivatives collapse to 8 and 4 columns without changing content order.

## 6. Route Specifications

Each route contains only the blocks listed below, in the approved order.

### 6.1 Overview (`/`)

1. Page title `测试看板`, approved subtitle, and primary `新建任务` action.
2. Current-run strip with task identity, progress, current command, and `打开观测台` link.
3. Left four-column quality-summary card with score ring and four quality rows.
4. Right eight-column area containing:
   - three metric cards;
   - execution-path card;
   - recent-activity card;
   - warning-toned `需要关注` card.

No control-plane eyebrow or extra summary block is allowed.

### 6.2 Tasks (`/tasks`)

1. Page title `任务调度`, approved subtitle, and `创建任务` action.
2. Eight-column task-configuration card with:
   - three-step Object/Trigger/Scope row;
   - selected Object summary;
   - Feature/Level/Scripts segmented choice;
   - Feature and execution-profile fields.
3. Script-snapshot table directly below the configuration card.
4. Four-column right rail with `Launch summary` and `执行护栏` cards.

Existing feature/script discovery and task creation remain functional. Do not add a wizard page, modal, or additional step.

### 6.3 Observe (`/observation`)

1. Page title `执行观测`, approved subtitle, running badge, and log-export action.
2. Four metric cards: status, command progress, elapsed time, and Object.
3. Full-width five-stage execution path.
4. Eight-column dark execution-events/log surface.
5. Four-column task-control card with task metadata and cancellation action.

Bind the dark surface to the existing real log snapshot flow. Preserve polling, terminal refresh, cancellation, and export behavior. Do not show the previous visible level-filter, pause, clear, connection-toolbar, or other controls because they are absent from the approved frame; do not remove the underlying safe polling and normalization code.

### 6.4 Results (`/results`)

1. Page title `结果与报告`, approved subtitle, filter button, and report-export button.
2. Four metric cards.
3. Seven-column pass-rate trend card.
4. Five-column failure-distribution card.
5. Full-width recent-reports table.

In live mode, derive report rows and summaries only from `sessionTasks` and the active task. In mock fallback mode, use the approved mock values so the default rendered state matches Figma. Do not invent a report API, persisted filters, modal, or export format.

### 6.5 Scripts (`/scripts`)

1. Page title `脚本资产`, approved subtitle, and import affordance.
2. Four equal summary cards.
3. Search/filter toolbar.
4. Full-width script table.

Use existing fetched/mock script sources and target context. Do not implement file import, upload, or persistence without a backend contract.

### 6.6 Knowledge (`/knowledge`)

1. Page title `知识库`, approved subtitle, and new-entry affordance.
2. Gradient knowledge-search surface.
3. Three equal collection cards.
4. Eight-column recent-updates card.
5. Four-column knowledge-gaps card.

Render the approved information architecture using local copy. Do not add an editor, modal, new route, search backend, or persistence.

### 6.7 Settings (`/settings`)

1. Page title `系统设置`, approved subtitle, and save affordance.
2. Two-column grid containing exactly:
   - Object connection;
   - runtime environment;
   - console preferences;
   - reports and logs.

Populate values from existing runtime configuration and local preferences. Do not create settings persistence or backend mutation. Read-only runtime values remain read-only even when styled as approved compact controls.

## 7. Data and Behavior Boundaries

- Keep every existing route path unchanged.
- Keep task API endpoints and request/response normalization unchanged.
- Keep selected-target state and the internal `SutTarget` type; only user-facing terminology becomes Object.
- Do not change the existing polling constants: five seconds for task status and two seconds for active log snapshots, including the existing terminal refresh behavior.
- Keep terminal log export, cancellation acknowledgement, and final status/log refresh.
- Keep authentication and account-menu behavior behind the `TW` trigger.
- Keep `/testwise/` basename handling, runtime config loading, API proxying, download URL rebasing, and deployment files.
- Do not copy the stale workspace-level `DispatchPlatform` over the cloned repository. The clone contains newer auth, live-log, deployment, and test work.
- The following approved controls have no baseline backend contract and are presentation-only in this revision: Overview `查看全部` and `查看交互说明`; Results `筛选`, `导出报告`, and `查看用例`; Scripts `导入脚本`; Knowledge `新建条目`, `查看全部`, and each `补充`; and Settings `保存更改`. Render them in the approved position and appearance with `aria-disabled="true"`; activation performs no mutation, opens no overlay, and displays no fabricated success.
- Tasks `更换对象` focuses the existing shell Object selector. Tasks script search, Results recent-report search, Scripts search/Level/Feature filters, and Knowledge search filter already-rendered local data only; they do not create backend requests or persistence.
- The Observe path label must truthfully state that status refreshes every five seconds even though the static Figma sample says three seconds. Preserve the approved geometry while honoring the real polling contract.
- When mock fallback is enabled and the log request is unavailable, the approved sample event lines may be shown only with the frame's `LIVE STATUS · NOT LIVE LOGS` disclosure. A successful real snapshot always takes precedence, and live mode never receives or renders sample entries.

## 8. Component Boundaries

Implementation should keep units focused without changing the approved appearance:

- `AppShell`: route state, shared Object/language/account state, responsive shell.
- `ConsoleHeader`: approved brand, direct navigation, and three right-side controls.
- `FairySparkLogo`: inline SVG only.
- Shared presentational primitives: page title row, surface card, status pill, metric card, progress bar, table shell.
- Page-specific compositions: Overview, Tasks, Observe, Results, Scripts, Knowledge, Settings.
- Existing data/behavior modules remain responsible for API requests, task normalization, polling, logs, auth, and runtime config.

Do not build a generic component abstraction when it would require visible compromises relative to Figma.

## 9. Accessibility and Interaction

- Semantic `header`, `nav`, `main`, sections, headings, tables, labels, and buttons.
- Visible `:focus-visible` treatment using the accent color.
- Direct navigation must work with keyboard activation and expose `aria-current`.
- Object and language controls must have accessible names independent of visual text.
- Status never relies on color alone.
- Maintain the skip link, focus restoration, mobile focus trap, Escape handling, and reduced-motion support.
- Preserve at least 44px touch targets in responsive layouts where controls are touch-oriented.
- No page-level horizontal overflow; data tables may scroll inside their own surface.
- Animation is limited to approved hover/focus transitions and respects `prefers-reduced-motion`.

## 10. Verification and Acceptance

### Automated

- Update existing AppShell assertions that conflict with the approved R2 design while preserving behavioral and accessibility coverage.
- Add assertions for:
  - `Console` brand and fairy-spark presence;
  - seven direct navigation links in exact order;
  - `Object` terminology;
  - absence of Health, grouped dropdown triggers, notification bell, brand subtitle, and control-plane eyebrow;
  - all seven routes rendering their approved primary blocks;
  - selected Object propagation;
  - language and account behavior;
  - unchanged task creation, polling, live logs, cancellation, and export behavior.
- Run `npm run test:run`.
- Run `npm run build`.
- Run `VITE_BASE_PATH=/testwise/ npm run build`.

### Visual and interactive

- Capture every route at 1440 × 1100 and compare it directly with its corresponding Figma frame.
- Confirm header dimensions, link order, active treatment, Object control, fairy-spark, and absence of removed elements on every route.
- Click every navigation destination from the running app and verify the correct stable route and active state.
- Check `/`, `/tasks`, `/observation`, `/results`, `/scripts`, `/knowledge`, and `/settings` at desktop and responsive breakpoints.
- Verify no visible UI beyond the approved Figma composition.
- Verify the browser console has no warnings or errors.
- Verify the live backend non-regression path without leaving queued or running tasks.

## 11. Delivery

- Add `DispatchPlatform/docs/revision-records/2026-07-14-testwise-antigravity-console-r2.md` with the final implementation and verification evidence.
- Commit source, tests, and revision record intentionally.
- Integrate the completed feature branch into `develop` only after all acceptance checks pass.
- Push the complete repository with `DispatchPlatform` preserved at the repository root.
