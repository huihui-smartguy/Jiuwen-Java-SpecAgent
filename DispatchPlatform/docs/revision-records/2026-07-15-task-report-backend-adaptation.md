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

Status: atomically deployed and verified.

- Deployed source commit: `0362c0447e8ceb482c84195f9cf7560e32031bcd`
- Release path: `/data1/testwise/releases/20260715-172745-0362c04`
- Previous release / rollback target: `/data1/testwise/releases/20260715-092046-f129efa`
- Main JavaScript SHA-256: `288badeb1559c4231388c742776b89835adc7c12743f62f0927552c6d800b681`
- Installed Nginx include SHA-256: `0302e354c799e80e88b620c55f8f7942d3a1d87bd9c6e0cad8e075480b0ef9b7`
- The prior runtime configuration was preserved byte-for-byte. Nginx validation passed before and after the switch, and both backend listeners remained available.
- Public health, runtime, task versions, Object statistics, report listing, application assets, root SPA, and report-detail SPA refresh all returned `200` from the new release.
- Live 1440×1100 browser captures verified Tasks and Results against the deployed `/testwise/` routes.
- Controlled task verification: `task-a72e7e54`, test batch `release1`, one read-only API-key-list script. The task lifecycle reached a valid terminal `failed` state because the backend runner returned a test-command failure; status, version, progress, and failure counts remained available through the public gateway.
- Temporary report verification: `36835e69-22cb-4ab1-9adc-adeb2e1d0ecc`, title `[TEMP VERIFY] TestWise backend adaptation 2026-07-15 task-a72e7e54`. Create, exact-version list, detail, three conclusion gates, Markdown download, and HTML download succeeded. Its narrowly scoped snapshot contained zero result rows, so non-empty case rendering remains covered by the automated contract fixtures rather than this live artifact.
- Only that temporary report was deleted. Deletion returned `200`; the exact-version list returned zero reports and subsequent detail returned `404`.
- Deployment timestamp (Asia/Shanghai): `2026-07-15 17:37:50 CST`

No credential, token, raw sensitive response, backend filesystem path, or password is recorded in this revision record.
