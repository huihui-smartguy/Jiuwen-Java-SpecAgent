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
- Report listing scans backend pages with the canonical software version and Object (`product` plus `scene`). Because list rows do not repeat Object scope, the client can re-check the software version exactly and perform stable de-duplication; Object filtering remains the documented backend responsibility.
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

- Full automated suite: 20 test files and 186/186 tests passed.
- Production subpath build: `VITE_BASE_PATH=/testwise/ npm run build` passed (1,666 modules).
- Whitespace validation: `git diff --check` passed.
- Live-compatible local preview verified 126 scripts across 14 Object features, exact-version report listing, a persisted report detail refresh, long provenance values, zero-result neutrality, and explicit unbound Task association.
- Responsive browser checks covered desktop, tablet, and narrow mobile widths down to 320px for Results and report detail, including a 390px report-generation modal.
- The production runtime contract was captured before delivery and must be preserved byte-for-byte during deployment. Repository demo runtime data is not a deployment replacement.

## Deployment and rollback

Status: atomically deployed and verified at `2026-07-20T10:31:36+08:00`.

- Deployed source commit: `0ca75ccbf35d542a977998dc59b27d64788a4d9a` on `develop` (`c080d72` contains the main R7 adaptation; `0ca75cc` aligns the raw pytest status contract).
- Release path: `/data1/testwise/releases/20260720-101953-0ca75cc`.
- Previous release / rollback target: `/data1/testwise/releases/20260717-171626-512e498`.
- Release archive SHA-256: `611bad72a7daad80348a6d1b6a80a71a45efacac8dc236bf88ad37466d3c48df`.
- `index.html` SHA-256: `fed20844984aee8de625ff10bbd9ec740682c055273e11cd9080d19bf53ff0e2`.
- JavaScript SHA-256: `c3aad2a8fd33b6ead52e408f75f5a77e96fd6fe446381afeb0939aace3d52b6d`.
- CSS SHA-256: `2ccfe392d31fd05fa708d6b4fe20c5f26af010bc65ac4dd0016d099d343916eb`.
- Installed runtime SHA-256 before and after the switch: `216a056145da45da17ec2e74b0ad64cf3fe8f8a02d741a8f5ab81b1262901203`. The previous runtime was preserved byte-for-byte; repository demo runtime data was not installed.
- Nginx validation passed before staging and after the atomic symlink switch. No Nginx configuration or reload was required, and backend listeners on ports `3000` and `3001` remained available.
- `/testwise/`, the six direct child routes, runtime JSON, R7 JavaScript and CSS assets, health, task versions, and report listing all returned HTTP `200` through the public Nginx gateway with the expected content types.
- Live browser verification loaded the R7 bundle and repeated the `1440 × 1100` / `390 × 844` typography and geometry audit. The deployed Scripts route showed 126 scripts across 14 Features; Results showed the four existing `release1` reports; the known persisted report detail rendered at 390px without overflow, undersized text, clipping, or `undefined` values.
- Controlled execution verification: `task-a1d036cb`, version `release1`, one read-only API-key-list script. The task reached the valid terminal `failed` state because the backend runner returned test-command code 4. Version, progress, final counts, lowercase display status, nullable raw `actual_status`, and the uppercase `PASSED|FAILED|SKIPPED|ERROR` distribution remained available through the public gateway.
- Temporary report verification: `49e4d033-be52-4dac-a4ed-486d0972f6ef`, title `[TEMP VERIFY] TestWise R7 2026-07-20 task-a1d036cb`. Exact Object-plus-version listing, detail, Markdown, and HTML downloads returned `200`. Its narrow time window contained zero execution rows while the backend verdict was passed; the deployed UI correctly rendered the neutral `无匹配执行数据` state, a dash success rate, and no inferred Task link.
- Only that temporary report was deleted. Deletion returned `200`, the exact Object-plus-version list returned to four reports, and the deleted detail returned `404`.

No credential, token, raw sensitive response, password, or private backend filesystem path is recorded in this revision record.
