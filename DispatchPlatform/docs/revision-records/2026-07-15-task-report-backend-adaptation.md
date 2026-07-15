# TestWise Task and Report Backend Adaptation Revision Record

Date: 2026-07-15

Source baseline: `5164ea9` (`origin/develop` at implementation start)

Implementation head before this record: `1d88650`

## Scope and compatibility boundary

This revision connects the existing TestWise console to the complete task contract on port `3000` and the persisted-report contract on port `3001`. It preserves the existing seven-route navigation, approved visual hierarchy, bilingual UI, mock mode, live logs, cancellation, session-task history, Object snapshots, and single browser-facing `apiBaseUrl`.

The server-side report implementation remains an external dependency. No backend source, historical task data, report storage, credential, or private filesystem path is copied into this repository.

## Figma review record

Approved source frames were left unchanged in Figma file `dZShT2fYtwd9cCYCXpYGAA`.

| View | Approved source | Proposed backend-integration variant |
|---|---:|---:|
| Tasks | `40:4` | `63:3` |
| Observe | `40:108` | `63:142` |
| Results | `40:212` | `63:269` |
| Report detail | — | `63:440` |
| Integration ledger | — | `63:611` |

The proposed variants are grouped under section `63:2`, labelled “Proposed – Backend Integration”.

## Implemented contracts

- Task creation supports Feature, Level, explicit Scripts, and Entire Scene modes with backend test-version propagation.
- `/api/versions`, `/api/statistics/summary`, and `/api/tasks/:id/script-status` are typed, Object-scoped, and mock-compatible.
- Status polling remains active only for non-terminal tasks. Case-status polling runs only while its drawer is open and the parent task is active.
- Persisted reports support create, exact-version list filtering, 20-row pagination, detail, Markdown/HTML download, and confirmed deletion.
- Report queries require an exact editable software/build version; generic `Live`, `Current`, and `Latest` values are gated. The value is stored per Object.
- Report result filesystem paths are never rendered. Only public download URLs are exposed and rebased through the configured TestWise subpath.
- Legacy/direct task responses and `{success, task}` envelopes remain normalized, including preservation of source Object and selected test batch when later status responses omit them.

## Gateway and deployment contract

- `/testwise/api/reports` and `/testwise/api/reports/*` route to `127.0.0.1:3001/api/reports...`.
- Every remaining `/testwise/api/*` request routes to `127.0.0.1:3000/api/*`.
- Local Vite integration uses `TESTWISE_REPORT_API_PROXY_TARGET` alongside `TESTWISE_API_PROXY_TARGET`.
- Container deployments use `REPORT_BACKEND_UPSTREAM` alongside `BACKEND_UPSTREAM`.
- The report matcher includes the query-string boundary while excluding lookalikes such as `/reportsfoo`.
- Runtime configuration retains one `apiBaseUrl`; no runtime-schema migration is required.

## Verification before delivery

- Full automated suite: 19 test files and 165/165 tests passed.
- Production subpath build: `VITE_BASE_PATH=/testwise/ npm run build` passed.
- Whitespace validation: `git diff --check` passed.
- Local 1440×1100 browser smoke covered Tasks and Results at `/testwise/`; the empty-session Observation guard redirected to Tasks as designed.
- Local same-origin probes returned `200` for runtime configuration, task versions, report listing through both `/api/reports?...` and `/testwise/api/reports?...`, and a report-detail SPA refresh.
- Boundary probe `/testwise/api/reportsfoo` returned `404` from the task fallback rather than reaching the report service.
- Independent code review found and verified fixes for container URI suffix preservation, scene-wide script discovery, test-batch metadata preservation, and report-list query matching. The final review reported no remaining findings.

## Deployment evidence

Status: pending controlled deployment.

- Deployed source commit: pending
- Release path: pending
- Previous release / rollback target: pending
- Controlled task verification ID: pending
- Temporary report verification ID and deletion result: pending
- Deployment timestamp (Asia/Shanghai): pending

This section will be finalized immediately after the atomic server rollout and acceptance checks.

No credential, token, raw sensitive response, backend filesystem path, or password is recorded in this revision record.
