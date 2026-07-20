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

Status: atomically deployed and verified at `2026-07-20T17:38:15+08:00`.

- Backend publication: `93db66e8259729074513dbbeb37713fb7e943021` on GitCode branch `feature/autotestflow/iteration`.
- Frontend implementation publication: `6329528dc641bf2abb1d6cb5f6563e47c222b89d` on GitHub branch `develop`.
- Frontend typography follow-up: `126f6f75f8018cc76ffc60605e2ebaa37b676362` on GitHub branch `develop`. The dimension selector now places its caption and selected value on separate rows; `Basic Functionality` remains on one line at every approved width.
- Backend release source: `/data1/testrun/releases/20260720-171120-93db66e/source`.
- Backend pre-R8 rollback snapshot: `/data1/testrun/backups/20260720-171120-pre-r8-93db66e`. Code rollback restores only the recorded source files and restarts port `3000`; it does not overwrite newer task state.
- Backend archive SHA-256: `e5f485acd03724b87a76fbd83bfa3759fc1536c2480e97c1890a6d723360cb02`.
- Deployed `main.py` SHA-256: `0097729f278d09d828752db00c5f935678959c627ef248e7ada3776738686f39`.
- Deployed `task_manager.py` SHA-256: `4084b3ccf9f763d71902fdf7cc94104a81400497bdf3eb418fedb909af3d9f0c`.
- Pre-restart task-state SHA-256: `a6e0dd7c859c5bc94f11f0dc7c28179c11f51b727407b3d0da1dd7adbb657054`. The snapshot contained 60 records: 27 failed, 25 completed, seven pending, and one running. The former process had one sleeping thread and no children, so the eight nonterminal records were orphaned; the R8 lazy manager initialization reconciled them to failed. The live file then contained 35 failed and 25 completed records.
- Backend smoke verification: direct and `/testwise/api/` task listing returned `200`; an unknown query returned `400` with `INVALID_QUERY`; an existing task's detail and logs returned `200`; cancellation of that terminal task retained the prior `400` contract; task versions, report service, public shell, and Nginx validation remained healthy.
- Final frontend artifact SHA-256: `e93d6f34fbec29eb282572f138abf7340f31f535686d0f52f2918b94d786d679`.
- Frontend release path: `/data1/testwise/releases/20260720-173815-126f6f7`.
- Immediate frontend rollback target: `/data1/testwise/releases/20260720-171812-6329528`; pre-R8 rollback target: `/data1/testwise/releases/20260720-101953-0ca75cc`.
- Deployed and publicly re-downloaded payload hashes: `index.html` `1fffc0007747e63f07cc34dde0f2d603db31ef10978b2d2046f1f07db5d7853e`; CSS `ad49c2b1d317b3aecabc536a135091bb84c1a04c7da74ee551ff4641ab1740f7`; JavaScript `379fb34208931bb07915a0163fe171f6308e9543e2aa6c0ca5b60b7844f238d5`.
- The installed runtime file remained byte-identical before both frontend switches and after the final switch: SHA-256 `216a056145da45da17ec2e74b0ad64cf3fe8f8a02d741a8f5ab81b1262901203`. Repository demo runtime data was never installed.
- Nginx validation passed before and after both atomic symlink switches; no configuration change or reload was required. The seven direct routes, final assets, runtime JSON, task-list proxy, and report proxy returned `200` through the public gateway.
- Live browser verification on the first R8 frontend switch loaded Chinese and English Overview, Tasks, Observation, Settings, Results, Scripts, and Knowledge without runtime exceptions, failed requests, route redirects, or horizontal overflow. Both rings retained `124px`/`116px` geometry, `28px`/`27px` scores with normal tracking, and captions outside the arcs.
- The final live browser pass repeated these checks against `126f6f7`. The English dimension selector rendered `Basic Functionality` on one line, and its label/value rows remained spacious at all five approved widths.
- Live Settings verification changed the preferred report format to Markdown and enabled reduced motion, saved successfully, applied the root motion class, and retained both values after a full route reload. Unsupported formats and obsolete controls were absent. A persisted report then presented Download Markdown as its primary action while Download HTML remained available; both URLs used the public `/testwise/api/reports/` route.
- Controlled live execution: `task-3731ffc5`, one read-only `test_tc_040_ak006_list_api_keys` script, version `release1`. The Tasks launch selected the new task on Observation; the active row, pinned detail, events, and logs rendered. The backend runner reached `failed` before the cancellation request arrived, so DELETE correctly retained the terminal-task `400` contract. On refresh the row left the active table while its completed detail remained visible.

No credential, token, raw sensitive response, password, task log path, script path, or test-data path is recorded in this revision record.
