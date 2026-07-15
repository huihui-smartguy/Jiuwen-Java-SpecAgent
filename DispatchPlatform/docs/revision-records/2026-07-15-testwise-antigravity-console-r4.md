# TestWise Antigravity Console R4 Revision Record

Date: 2026-07-15  
Branch: `lalala/testwise-antigravity-r4`  
Source baseline: `175b133df15d60e18b601bd6822286222f4dedb4` (`origin/develop` at implementation start)  
Implementation range: `175b133df15d60e18b601bd6822286222f4dedb4..this revision commit`

## Approved design authority

The approved Figma file `TestWise Antigravity Console Demo` (`dZShT2fYtwd9cCYCXpYGAA`) is the presentation source of truth. No content, card, control, badge, icon, or decorative treatment outside the approved frames was intentionally added.

| Route | Approved Figma node | Verified route title |
| --- | --- | --- |
| Overview | `23:2` | `测试看板` |
| Tasks | `40:4` | `任务调度` |
| Observe | `40:108` | `执行观测` |
| Results | `40:212` | `结果与报告` |
| Scripts | `40:316` | `脚本资产` |
| Knowledge | `40:420` | `知识库` |
| Settings | `40:524` | `设置` |

## Implemented scope

- Replaced the Gemini-like mark with the approved code-native gradient ghost while retaining the approved multicolor palette.
- Rebuilt the shared 72px header around a centered seven-item navigation rail, localized navigation labels, a compact `Object` selector, language control, and account control.
- Removed visible Health, Live, version/status metadata, `TESTWISE CONTROL PLANE`, and the legacy console subtitle from the global header.
- Matched the approved 1440px desktop content rail, typography hierarchy, card radii, spacing, surfaces, tables, charts, and control proportions on all seven routes.
- Kept the global selector label `Object` in both Chinese and English modes, as approved.
- Corrected Results report semantics, literal glyphs, failure geometry/colors, table scrolling, bilingual authored content, and live failure totals.
- Corrected Tasks discovery caching so Object identity includes ID, product, scene, and resolved API endpoint.
- Bound each session task to an immutable originating Object snapshot so status polling, logs, cancellation, and Results attribution cannot move to a newly selected endpoint.
- Disambiguated duplicate native Object options by ID only when labels collide, without changing the approved closed selector summary.
- Added responsive containment for Observe and Tasks after the full breakpoint matrix exposed fixed-width descendants.

## Preserved behavior and boundaries

- Direct routing, route focus restoration, drawer focus trap, Escape handling, Object selection, language switching, account interaction, and reduced-motion behavior remain intact.
- Task creation payloads, API discovery, polling, cancellation, logs, export eligibility, live task normalization, result derivation, search/filter behavior, loading/error states, and runtime configuration remain live-data driven.
- Controls present in Figma without a backend contract remain focusable and explicitly `aria-disabled`; they do not navigate, mutate state, or issue requests.
- Mock fallback data is used only when `enableMockFallback` is explicitly true. Production deployment must preserve `enableMockFallback: false`.

## Automated verification

Executed from `DispatchPlatform` after the final responsive corrections:

- `npm test -- --run`: 16 test files, 142 tests passed, 0 failed.
- `npm run build`: TypeScript project build and Vite production build succeeded.
- `VITE_BASE_PATH=/testwise/ npm run build`: subpath production build succeeded.
- Generated `dist/index.html` references `/testwise/assets/index-v-Tc95_B.js` and `/testwise/assets/index-Db8h6cVS.css` in the verified subpath build.
- `git diff --check`: passed with no whitespace errors.

## Browser and interaction QA

Desktop QA used the final local build at 1440×1100.

- Clicked all seven desktop navigation links in order; every destination produced the expected URL and H1, exactly one active navigation item, seven total navigation items, and a shared Object identity.
- Switched to English and verified `Overview / Tasks / Observe / Results / Scripts / Knowledge / Settings`; switched back to Chinese and verified `总览 / 任务 / 观测 / 结果 / 脚本 / 知识 / 设置`.
- Switched the global selector from `高码java 场景` to `合一版本 场景` and back; the selected identity updated while visible Live/Health metadata remained absent.
- Opened the responsive drawer, verified Shift+Tab wrapping stayed inside the dialog, closed it with Escape, confirmed focus returned to the drawer trigger, then selected Tasks and confirmed focus moved to the main region.
- Captured and visually inspected all seven final 1440px route frames against their approved Figma nodes.
- Browser developer logs recorded zero new error-level messages during the complete QA sequence.

## Responsive QA

- All seven routes passed at 1319, 1024, 768, and 390px: 28/28 route-width cases had document width equal to viewport width and the expected H1.
- Results additionally passed the fixed-to-fluid boundary at 1439, 1400, 1341, and 1340px.
- Results report tables scroll internally at narrowed widths; the last action column remains reachable without page-level overflow.
- Observe and Tasks responsive regressions discovered during the first matrix run were fixed and the entire matrix was rerun from the beginning with zero failures.

## Review evidence

- Independent code review found no critical issues. Its responsive containment, live failure truthfulness, bilingual content, and Object cache-key findings were fixed and regression-tested.
- Independent strict Results review against Figma node `40:212` passed after all eight literal findings were resolved, including exact desktop geometry, 464×34 failure rows, approved colors/copy/type, literal glyphs, zero table separators, and internal mobile scrolling.
- Previous task reviews accepted the shared header, Overview, Tasks, Observe, Scripts, Knowledge, and Settings against their approved nodes.

## Known presentation boundary

The approved Figma frames define the 1440px desktop composition. Narrower layouts preserve the same content and interaction hierarchy while stacking or internally scrolling where fixed desktop geometry cannot fit. No mobile-only product feature or unapproved content was introduced.

## Deployment evidence

Status: pending atomic production deployment.

- Deployed source commit: pending
- Release path: pending
- Artifact SHA-256: pending
- Previous release / rollback target: pending
- Production runtime assertions: pending
- Nginx validation: pending
- Seven-route and asset smoke test: pending
- Deployment timestamp (Asia/Shanghai): pending

This section must be updated with sanitized values after deployment. Credentials, tokens, raw sensitive responses, and passwords must never be recorded.
