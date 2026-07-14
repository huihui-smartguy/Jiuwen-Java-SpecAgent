# TestWise Antigravity Console R2 Revision Record

Date: 2026-07-14

Approved source: [TestWise Antigravity Console Demo](https://www.figma.com/design/dZShT2fYtwd9cCYCXpYGAA/TestWise-Antigravity-Console-Demo?node-id=10-3)

Repository baseline: `b5906f4e4500d147636dcfab56bb6ac4774b5ea0`

## 1. Approved Figma Frame and Node Matrix

The seven 1440 × 1100 Figma frames below were the visual authority. No additional route, navigation item, card, label, action, dialog, notification, or decorative section was added.

| Route | Navigation | Page title | Figma node | Reference SHA-256 |
| --- | --- | --- | --- | --- |
| `/` | Overview | `测试看板` | `10:3` | `9cccc5ba8c41df0addfab3bae9439f620c23663f3512e27cf355f70eb27ffc50` |
| `/tasks` | Tasks | `任务调度` | `10:2` | `28e98411d1818eaaf4df9753e153aafba2f0744805b63e03224c8da4aa9de858` |
| `/observation` | Observe | `执行观测` | `10:6` | `a05043b6d24e6af6dc1906c75628e5d00f15e2a746f7b868d841c4d04c08f1c2` |
| `/results` | Results | `结果与报告` | `10:4` | `2c2e524f42f1e121d66319cd406c1c905fae8decd45680f9166e7b343d250a9f` |
| `/scripts` | Scripts | `脚本资产` | `10:5` | `5ad908fdea84d57da8b5fc86d0e7fa72639f28fb91eab2d5f06ae58d10753335` |
| `/knowledge` | Knowledge | `知识库` | `10:8` | `9c1f92f212d7f4122501f51239fb1f102cad5a8a30f8d9332a425a2f2b9d9ae6` |
| `/settings` | Settings | `系统设置` | `10:7` | `dc2074940711f5b4c184a438f03048b2c50f53b464eb298746dcb52ff25b42d7` |

## 2. Shell and Seven-Route Implementation

- The 64px shared shell now contains the TestWise-owned inline `FairySparkLogo`, the single wordmark `Console`, and exactly seven direct links in the approved order: Overview, Tasks, Observe, Results, Scripts, Knowledge, Settings.
- The right side contains only Object, the compact language control, and the circular `TW` account trigger. The former TestWise/gourd treatment, `Test Agent Console`, `测试指挥控制台`, `TESTWISE CONTROL PLANE`, Health, notification bell, and grouped navigation were removed from the approved views.
- At widths below 1180px, the same seven destinations and required Object/language/account controls move into the existing accessible drawer; no responsive-only information was introduced.
- Overview implements the title row, current-run strip, 4/8 quality layout, three metrics, execution path, recent activity, and attention card.
- Tasks implements the permanent 8/4 configuration layout, Object/Trigger/Scope sequence, local script snapshot, launch summary, and guardrails while retaining feature/level/explicit-script creation.
- Observe implements four metrics, the five-stage path, real/fallback-safe execution events, task control, cancellation, polling, and terminal export.
- Results derives live summaries from in-session tasks and uses approved values only in mock fallback; Scripts uses the selected Object's existing script source; Knowledge remains local-only; Settings has exactly the approved four cards without persistence.
- Semantic landmarks, one level-one heading per route, visible focus, pathname-change focus restoration, reduced-motion handling, and text-plus-color status treatment are retained.

## 3. Preserved API, Authentication, Polling, and Base-Path Behavior

- No backend code or contract file changed. Compared with the approved baseline, `src/api/client.ts`, `src/auth`, runtime/base-path/proxy configuration, `vite.config.ts`, and deployment files are unchanged.
- Existing contracts remain `GET /features`, `GET /scripts`, `POST /tasks`, `GET /tasks/{task_id}`, `DELETE /tasks/{task_id}`, `GET /tasks/{task_id}/logs`, and the returned terminal download URL. Request unions, live-response normalization, cancellation acknowledgement, and download rebasing are unchanged.
- A read-only public probe on 2026-07-14 returned HTTP 200 for the shell (`text/html`, root mount present) and runtime configuration (`application/json`). The runtime shape contained `apiBaseUrl`, `defaultLanguage`, `deploymentMode`, `enableMockFallback`, and `sutTargets`; resolved values were `/testwise/api`, `zh`, `process`, `false`, and one healthy live Object.
- The same probe returned HTTP 200 with `success=true` for feature discovery (15 entries), script discovery (5 entries for the documented scoped feature), terminal task status (`cancelled`), and the log snapshot (`success=true`, `total=11`, 11 entries with timestamp/level/message fields).
- Task status continues to poll every 5000ms while active. Live log snapshots continue to poll every 2000ms while active, reject malformed/incremental snapshots, perform the terminal refresh, and stop polling in terminal state.
- `/testwise/` basename normalization, `/testwise/config/runtime.json` loading, same-origin `/testwise/api` proxying, direct route refresh, and returned download URL rebasing remain covered. Both root and `/testwise/` production builds are part of the gate.
- Account/session behavior remains behind `TW`, including configured profile, sign-in, registration, sign-out, outside-click, and Escape behavior. The current public runtime intentionally omits optional auth URLs; the frontend auth contract was not removed or changed.

## 4. Presentation-Only Controls

The approved controls without a baseline backend contract are focusable, expose `aria-disabled="true"`, and perform no mutation, persistence, request, route change, overlay, or fabricated success message:

- Overview: `查看全部`, `查看交互说明`.
- Results: `筛选`, `导出报告`, each `查看用例`.
- Scripts: `导入脚本`.
- Knowledge: `新建条目`, `查看全部`, each contextual `补充`.
- Settings: `保存更改`.

Tasks `更换对象` is not presentation-only: it focuses the existing shell Object selector, opening and focusing the drawer selector at responsive widths. Tasks script search, Results recent-report search, Scripts search/Level/Feature filters, and Knowledge search filter only already-rendered local data. Settings' visible preference/report/retention controls affect only the current render; runtime values remain read-only.

## 5. Automated Test and Build Evidence

| Gate | Result |
| --- | --- |
| Focused API/Tasks/Observe/LiveLog/LogExport non-regression | PASS — 5 files, 51/51 tests |
| Full Vitest suite | PASS — 16 files, 130/130 tests |
| Standard production build | PASS — 1661 modules transformed |
| `VITE_BASE_PATH=/testwise/` production build | PASS — 1661 modules transformed |
| `git diff --check` | PASS |

Focused coverage includes API URL construction and normalization, all three Tasks payload modes, selected-Object discovery, 5000ms status polling, cancellation acknowledgement and terminal refetch, 2000ms real-log polling, terminal log refresh, malformed/incremental snapshot rejection, truthful mock fallback disclosure, and terminal-only log export.

## 6. 1440 × 1100 and Responsive Visual Evidence

Every route was captured at exactly 1440 × 1100 after the shared header correction and compared directly with its approved node. Block count/order, route title position, 12-column spans, card anchors, borders, radii, shadows, typography scale, table density, active link treatment, Object control, and removed elements received a final `FIXED/PASS` verdict. Runtime-bound Object/task/status/timing values were evaluated as dynamic data, not hardcoded to the sample frame.

| Route | Actual capture SHA-256 | Verdict |
| --- | --- | --- |
| Overview | `cf86c7dd958753856ead04961cabe6bd13fe2c2ed48dd57df5fa4228d5b53ba2` | FIXED/PASS |
| Tasks | `41d925439f6f4fb58b827ed8f43b3cbe63fb8aa181681029f3bdba666fd9c758` | FIXED/PASS |
| Observe | `408da26f2d2e8b706d7be2ccc3673726fa8a7036627975b960eade0fa9d93a70` | FIXED/PASS |
| Results | `69d1366de519e2e7ccca5b8476753f1744a5d64e244ee70cba801d69bc61d82e` | FIXED/PASS |
| Scripts | `5797e2a881d3391b404075440b8ce4459700d96771e185f77e26a1b528f439a5` | FIXED/PASS |
| Knowledge | `8286da0b205276c4835ed5c63c554de5e264c5f9fe30f23cd1a714f5bd4f0aaf` | FIXED/PASS |
| Settings | `2c5fa54d54720ddb7e10f6b1105ceee83da4aa2f951eaf09c32e9216d0db466f` | FIXED/PASS |

Responsive evidence covered all seven routes at 1179, 768, and 390 CSS pixels (21 combinations). The strict device-metric audit reported the exact viewport/client widths, no document/body horizontal overflow, the correct level-one heading, visible drawer substitution, and no undersized visible focusable controls, including focusable `aria-disabled` controls. The 390px open-drawer audit confirmed `aria-modal=true`, seven links, one active link, inert main content, 44px minimum link targets, focus trapping/restoration, Escape closing, and no document overflow. Route content retained its approved source order while grids collapsed, and tables kept horizontal overflow inside their own surface.

## 7. Seven-Link Click-Through Evidence

One real-router AppShell test clicks, in order, Overview → Tasks → Observe → Results → Scripts → Knowledge → Settings. At every destination it verifies the exact pathname and level-one heading, exactly one direct link with `aria-current="page"`, exactly six inactive direct links, and focus handoff to the new main region.

The same pass checks every route for the absence of the removed TestWise titles, control-plane copy, Health, Bell icon, grouped triggers, menus, and route-specific unapproved wizard, queue, previous log toolbar, dialog, alert, upload, editor, form, footer, and pagination surfaces. Keyboard/drawer behavior is covered separately by the AppShell tests.

## 8. Sanitized Live Lifecycle Evidence

Exactly one known read-only, one-script task was created through the public TestWise gateway and cancelled immediately. No backend code was changed.

- Task ID: `task-e5889632`.
- Create: HTTP 200; status `pending`; total scripts `1`.
- Cancellation request: HTTP 200; previous status `running`; cancellation signal accepted.
- Immediate status observation: HTTP 200; status `running`; `cancel_requested=true`.
- Follow-up read-only status observation: HTTP 200; terminal status `cancelled`; `cancel_requested=true`; completion timestamp present.
- Final safety state: the created task is neither queued nor running.

Only the sanitized task identifier, HTTP results, state transitions, and final safety state are recorded here. Raw commands, log content, log locations, credentials, and response bodies were not retained in this record.

## 9. Known Limitations, Including Connector Limitations

- The in-app browser connector was attempted once after its skill was loaded, but runtime setup failed before browser/tab selection with `Cannot redefine property: process`. It was not retried. No connector success or browser-console warning/error claim is made.
- Interaction evidence therefore comes from the real-router click-through/focus suite; visual evidence comes from fixed-device-metric headless Chrome captures. Capture PNGs and the responsive evidence JSON are temporary QA artifacts under `/private/tmp` and are intentionally not committed.
- Live Object, task, status, timing, and fetched values can differ from static Figma sample copy. The implementation preserves those runtime values while keeping the approved geometry and information hierarchy.
- Presentation-only controls remain intentionally inert until a real backend contract exists. This revision does not invent persistence, upload, report export, knowledge authoring, settings save, or notification behavior.
- The verification lifecycle proves create/status/cancel/log-snapshot compatibility and terminal cleanup; it does not claim a successful full test execution or terminal report-download exercise for this revision.

## 10. Implementation Commits Before This Revision Record

This is the complete 18-commit range `b5906f4..211bf8b`, ordered from the approved baseline through the implementation head. The pending revision-record commit is intentionally excluded.

1. `9553dcd` — `docs: specify approved TestWise Antigravity R2`
2. `36a3b90` — `docs: plan TestWise Antigravity R2 implementation`
3. `90db79f` — `feat: implement approved TestWise Console shell`
4. `934d3fd` — `fix: address Console shell review findings`
5. `62d1957` — `feat: match approved TestWise Overview frame`
6. `a325f99` — `fix: prevent mock Overview data in live mode`
7. `d72824b` — `feat: match approved TestWise Tasks frame`
8. `aed3415` — `feat: match approved TestWise Observe frame`
9. `5d42493` — `fix: align and contain Observe frame`
10. `5cd61b9` — `feat: build approved TestWise Results frame`
11. `87561ff` — `fix: keep incomplete Results timestamps truthful`
12. `bc70af1` — `feat: build approved TestWise Scripts frame`
13. `30865f9` — `fix: keep Scripts query states truthful`
14. `4d82848` — `feat: build approved TestWise Knowledge frame`
15. `6573bb5` — `fix: contextualize Knowledge gap actions`
16. `6376fea` — `feat: build approved TestWise Settings frame`
17. `1448eb7` — `test: verify all TestWise Console routes`
18. `211bf8b` — `fix: size responsive presentation controls`
