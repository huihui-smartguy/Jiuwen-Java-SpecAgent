# TestWise Backend Compatibility R7

- Date: 2026-07-20
- Source baseline: `890595ace7ef8a16492944b9a2631a62dd842edc` (`origin/develop`)
- Backend source baseline: `baaa91b34b31b94dc29e33e5c0b7c1d91256f3db` (`feature/autotestflow/iteration`, `Board/backend/testrun`)
- Design approval: R7 approved by the user on 2026-07-20
- Figma: [TestWise Antigravity Console R7](https://www.figma.com/design/dZShT2fYtwd9cCYCXpYGAA/TestWise-Antigravity-Console-Demo?node-id=93-2)

## Scope and compatibility boundary

R7 adapts the existing seven-route TestWise frontend to the improved task-execution service on port `3000` and report service on port `3001`. The existing shell, navigation, bilingual mode, task creation modes, observation workflow, report workflow, knowledge route, settings route, and `/testwise/` deployment subpath remain intact.

The task backend remains the sole authority for task lifecycle state. The report backend remains the authority for immutable persisted report snapshots. Because neither backend exposes a stable task-to-report relation, the UI explicitly renders report Task association as unbound rather than fabricating a link.

## Implemented backend contracts

- Script discovery now follows the current backend contract: load Object features, request scripts per feature, then perform stable de-duplication. This restores the complete live script inventory when the backend does not support a scene-wide scripts response.
- Task state polling retains the last valid live snapshot during transient failures. The task endpoint alone decides terminal state; script-status data is treated as partial, volatile detail and is polled only while the case drawer is open and the task is active.
- Cancellation remains pending until the backend reports the actual terminal `cancelled` state.
- One canonical execution version is used end-to-end: task `version` maps to report `software_version`. A same-value legacy `test_version` wire alias is sent only where older report deployments may still accept it; the UI does not expose a second version dimension.
- Report creation uses one non-retried request with a bounded long timeout. A transport timeout is surfaced as an unknown outcome so the user can return to the persisted report list without accidentally creating a duplicate report.
- Report listing scans backend pages for the exact canonical software version and Object (`product` plus `scene`), then performs exact client-side filtering and stable de-duplication to guard against prefix-matching and duplicate-page behavior.
- Zero executed rows are rendered as neutral no-match data, never as a passed run. Report detail distinguishes actual executed scripts from registered scripts in the selected scope and preserves the backend snapshot provenance.
- Filesystem paths and undefined optional fields are not rendered. Only public report download URLs remain user-facing.

## R7 typography and responsive contract

The user required that font arrangement remain spacious rather than compact. R7 therefore applies these route-level minimums without changing the original shell hierarchy:

- visible metadata: at least `12px / 18px`;
- labels and secondary text: normally `13px / 20px`;
- body and table text: normally `14px / 22px`;
- controls retain accessible heights, and long Chinese or English values wrap instead of being clipped;
- fixed text heights were replaced with elastic minimum heights where content can grow;
- the report-generation modal uses the available mobile viewport with sticky header and footer rather than compressing its typography.

Automated browser geometry checks at `1440 × 1100` and `390 × 844` found no visible main-content text below 12px, no compact body line-height below the R7 threshold, no clipped visible text, and no document-level horizontal overflow across Dashboard, Tasks, Scripts, Results, Knowledge, and Settings. Observation's empty-session guard continues to redirect to Tasks by design; its active-task layout is covered by component and responsive contract tests.

## Verification before delivery

- Full automated suite: 20 test files and 185/185 tests passed.
- Production subpath build: `VITE_BASE_PATH=/testwise/ npm run build` passed (1,666 modules).
- Whitespace validation: `git diff --check` passed.
- Live-compatible local preview verified 126 scripts across 14 Object features, exact-version report listing, a persisted report detail refresh, long provenance values, zero-result neutrality, and explicit unbound Task association.
- Responsive browser checks covered desktop, tablet, and narrow mobile widths down to 320px for Results and report detail, including a 390px report-generation modal.
- The production runtime contract was captured before delivery and must be preserved byte-for-byte during deployment. Repository demo runtime data is not a deployment replacement.

## Deployment and rollback

Status: pending source commit and production rollout.

The release will be staged beneath `/data1/testwise/releases`, will preserve the installed `config/runtime.json` byte-for-byte, and will atomically switch `/data1/testwise/current`. The previous symlink target is the rollback release. Nginx configuration is not changed by R7 and must validate before and after the switch.

No credential, token, raw sensitive response, password, or private backend filesystem path is recorded in this revision record.
