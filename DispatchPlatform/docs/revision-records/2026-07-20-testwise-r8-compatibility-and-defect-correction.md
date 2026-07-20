# TestWise R8 Compatibility and Defect Correction

- Date: 2026-07-20
- Frontend source baseline: `6f6597e0b6056a853b0faa4b3c4fa20f710cc816` (`origin/develop`, `DispatchPlatform`)
- Backend source baseline: `baaa91b34b31b94dc29e33e5c0b7c1d91256f3db` (`feature/autotestflow/iteration`, `Board/backend/testrun`)
- Design approval: R8 approved by the user on 2026-07-20
- Figma: [TestWise Antigravity Console R8](https://www.figma.com/design/dZShT2fYtwd9cCYCXpYGAA/TestWise-Antigravity-Console-Demo?node-id=106-2)

## Scope and compatibility boundary

R8 preserves the approved R7 visual direction, seven-route shell, bilingual operation, all four task-launch modes, live observation detail, result and report workflows, knowledge route, and the `/testwise/` deployment subpath. The release corrects the four reported defects without introducing a user-profile service or changing the existing task-create, task-detail, log, script-status, cancellation, or report contracts.

The new task-listing contract exposes active-task summaries only. Task detail, logs, script status, and cancellation remain bound to the exact backend that supplied each row. Local Settings preferences are versioned browser data and do not alter backend configuration.

## R8 implementation

### Overview and Task Scheduling

- Overall and dimension quality visuals use separate chart, score, and external caption regions. The large rings are `124px`; compact rings are `116px`. Scores use normal tracking at `28px` and `27px`, while captions use `13px / 20px` and may wrap outside the arc.
- Quality summaries wrap at intermediate and mobile widths without shrinking body text or creating page-level horizontal overflow.
- The inert header Create Task control and the misleading Execution guardrails card were removed. The real launch action and all four creation modes remain unchanged.
- Launch Summary is fully bilingual and the right rail collapses to one top-aligned card. At intermediate desktop widths, fields stack before native select labels and carets can collide.

### Backend-wide Observation

- The task-execution backend adds `GET /api/tasks` with exact `product` and `scene` filters, comma-separated status filtering, bounded `limit` and `offset`, newest-first ordering, live queue positions, strict query validation, and a safe response-field allowlist.
- Task data and queue state are snapshotted under the existing re-entrant task-manager lock. Queue mutations now use the same lock, so listing remains safe while tasks are enqueued, dequeued, or cancelled.
- On service restart, persisted `queued`, `pending`, or `running` tasks that can no longer have a live worker are reconciled to `failed`; they cannot remain indefinitely visible as active work.
- Observation is always reachable. It polls every unique configured task backend every five seconds, merges rows by backend URL plus task ID, survives partial or total backend failures, and presents a retryable warning without redirecting.
- The active task card supports selection across multiple tasks. Newly launched tasks are selected immediately; direct navigation selects the newest active task. A selected terminal task leaves the active list but retains its completed detail until the user chooses another task or leaves the route.
- Detail, logs, script status, and cancellation use the selected row's originating backend. On narrow screens, task rows become spacious cards and body text remains at least `13px`.

### Settings and report preferences

- `ConsolePreferencesV1` is stored under `testwise.console.preferences.v1` with default Object, language, reduced-motion preference, and preferred `html` or `md` report format.
- Settings uses staged form state and a functional native Save button. It validates and writes the complete versioned preference object before applying it, reports accessible success or error status, retains the draft after storage errors, and disables Save while pristine or saving.
- Invalid, outdated, malformed, or unavailable storage falls back safely. Valid changes synchronize across open tabs, and reduced motion combines the saved preference with the operating-system setting.
- Header language and Object changes remain immediate session overrides. Saving Settings establishes reload defaults and applies them to the current session.
- Unsupported PDF and JSON formats, connection-check controls, and retention controls were removed. HTML and Markdown downloads remain available, with the saved preference presented as the primary action. Deployment mode and API base URLs are explicitly read-only.
- Results and Observation use source-qualified task identities so equal task IDs from different backends remain distinct.

## Verification before publication

- Frontend full suite: 21 test files and 219/219 tests passed.
- Frontend production subpath build: `VITE_BASE_PATH=/testwise/ npm run build` passed.
- Backend task and report suites: 31/31 tests passed; the focused task-listing suite also passed 19/19 when invoked from the repository root.
- Whitespace validation: `git diff --check` passed in both repositories.
- Bilingual browser validation covered Overview, Tasks, Observation, and Settings at `1440 × 1100`, `1180 × 1100`, `982 × 1100`, `768 × 1100`, and `390 × 844`: 40 route/language/viewport states in total.
- Browser geometry found no page-level horizontal overflow. Both ring sizes retained their approved dimensions, scores used normal tracking, captions remained outside the arcs, removed controls remained absent, and Observation rendered no visible task-card text below `13px`.
- Chinese and English screenshots were visually inspected at desktop, intermediate, tablet, and mobile widths. A native-select collision discovered at `1180px` was corrected and re-verified before publication.

## Publication, deployment, and rollback

Status: publication and deployment pending.

This section will be updated with immutable frontend and backend commit IDs, release paths, checksums, rollback targets, and live smoke-test evidence after the backend-first production rollout.

No credential, token, raw sensitive response, password, or private backend filesystem path is recorded in this revision record.
