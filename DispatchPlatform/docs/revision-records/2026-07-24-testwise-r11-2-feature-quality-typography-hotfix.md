# TestWise R11.2 — Feature Quality Assessment typography hotfix

Release date: 2026-07-24

Status: implementation prepared; publication, GitCode mirror, deployment, and
production acceptance pending

This record covers the approved R11.2 Feature Quality Assessment typography
hotfix. It contains no credential, password, token, private key, raw sensitive
response, or private backend path. Pending publication and production values
are explicitly marked and must be replaced only with observed evidence.

## Revision identity

| Component | Revision |
| --- | --- |
| Frontend baseline | `26c77a5b0bacfe6eac090730740df52ece2d1c51` |
| Frontend R11.2 implementation | `[PENDING_FRONTEND_COMMIT]` |
| Frontend production-evidence record | `[PENDING_FRONTEND_EVIDENCE_COMMIT]` |
| GitCode branch baseline | `b850e333ca865e2227ae81b497a9f460c76c4387` |
| GitCode R11.2 frontend mirror | `[PENDING_GITCODE_MIRROR_COMMIT]` |
| GitCode joint release evidence | `[PENDING_GITCODE_EVIDENCE_COMMIT]` |
| Backend implementation, unchanged | `1a45c4556dfb57c50c6d00223286d8c24dcb8cbe` |

- Frontend source:
  `huihui-smartguy/Jiuwen-Java-SpecAgent@develop/DispatchPlatform`
- Backend and GitCode mirror repository:
  `SETools/TestingAgent@feature/autotestflow/iteration`
- GitCode frontend mirror: `Board/DispatchPlatform`
- GitCode joint records: `Board/backend/testrun/ChangeLogs`
- Requirements basis: the approved R11.2 Feature Quality Assessment
  typography correction on 2026-07-24
- Quality data-contract baseline: the released R11 backend-owned 615/715
  quality snapshots

## Root cause

The Feature Quality Assessment table declared `13px / 20px` typography on its
table element. However, the global primitive stylesheet also contains an
element-level `th` rule:

- `font-size: 9px`;
- `letter-spacing: 0.065em`;
- `text-transform: uppercase`.

Because every column header and feature row header is a `th`, that direct
global rule overrode the inherited table size. The visible header and
row-header text therefore remained at `9px`, even though the table declaration
itself reported `13px / 20px`. Body cells did not share a single explicit
Overview typography contract, so the matrix was visually inconsistent.

This is a CSS cascade defect. It is not caused by backend data, quality
metrics, localization, table markup, or API normalization.

## Delivered hotfix

The route-scoped Overview stylesheet now applies the shared Overview body
tokens directly to the table and every header and data cell:

- `font-size: var(--type-body-size)`, currently `14px`;
- `line-height: var(--type-body-line)`, currently `22px`.

It also resets table-header presentation within this matrix:

- `letter-spacing: normal`;
- `text-transform: none`.

The route-specific selectors intentionally outrank the global primitive
element rule without changing that shared rule for unrelated tables.

The following remain unchanged:

- Feature Quality Assessment title size and line height;
- feature-count size and line height;
- table markup, row and column structure, accessible header relationships,
  sticky header, and sticky first column;
- internal horizontal scrolling;
- the seven feature rows and all backend-owned values;
- L0 and Basic L1 version switching;
- quality, catalog, task, report, ETag, and SSE contracts;
- canonical product, version, feature, and task values.

No React markup, data mapping, localization copy, API client, runtime
configuration, Nginx configuration, or backend source is changed.

## Frontend-only boundary

R11.2 is a frontend-only CSS and regression-test hotfix. The backend remains
at `1a45c4556dfb57c50c6d00223286d8c24dcb8cbe`.

This release requires:

- no backend source publication;
- no quality snapshot or database change;
- no task or report data mutation;
- no task-service restart on port `3000`;
- no report-service restart on port `3001`;
- no Nginx route change or reload.

## Changed files

### Frontend implementation and tests

- `DispatchPlatform/src/styles/routes/overview.css`
- `DispatchPlatform/src/pages/Dashboard.test.tsx`

### Revision record

- `DispatchPlatform/docs/revision-records/2026-07-24-testwise-r11-2-feature-quality-typography-hotfix.md`

### Backend

No backend file is changed.

## Verification status before publication

The prepared working tree has completed the following gates. Automated tests
and the production build must be repeated from the exact committed
implementation before publication evidence is finalized.

| Check | Prepared-state result |
| --- | --- |
| Focused Dashboard suite | Passed: 12/12 tests |
| Full frontend unit/integration suite | Passed: 29 test files, 284/284 tests |
| TypeScript and Vite `/testwise/` production build | Passed: 1,673 modules |
| Frontend `git diff --check` | Prepared working tree passed; committed-tree rerun pending |
| Chinese and English browser acceptance | Passed for the Basic Overview matrix |
| Computed matrix typography | Column headers, feature row headers, and data cells all rendered at `14px / 22px` |
| Matrix structure | Preserved: 8 rendered rows including the header and 7 columns |
| Responsive geometry | No page-level overflow at widths 1440, 980, or 390 |
| Internal matrix scrolling | Preserved; English matrix content width measured `1006px` |
| Browser console | No warnings or errors |
| Exact source-to-GitCode mirror comparison | `[PENDING_FINAL_MIRROR_CHECK]` |
| Public production route and browser smoke | `[PENDING_PRODUCTION_ACCEPTANCE]` |
| Task and report process continuity | `[PENDING_PID_CONTINUITY]` |

The regression test statically verifies that:

- the matrix and its `th` and `td` cells use the shared Overview body-size and
  body-line tokens;
- matrix headers reset global letter spacing and uppercase transformation;
- existing responsive sticky-matrix behavior remains encoded.

## Publication and production evidence

Status: `[PENDING_RELEASE_STATUS]`

| Item | Evidence |
| --- | --- |
| Frontend implementation commit | `[PENDING_FRONTEND_COMMIT]` |
| Frontend evidence commit | `[PENDING_FRONTEND_EVIDENCE_COMMIT]` |
| GitCode frontend mirror commit | `[PENDING_GITCODE_MIRROR_COMMIT]` |
| GitCode evidence commit | `[PENDING_GITCODE_EVIDENCE_COMMIT]` |
| Frontend release path | `[PENDING_FRONTEND_RELEASE_PATH]` |
| Previous frontend rollback target | `[PENDING_FRONTEND_ROLLBACK_TARGET]` |
| Frontend artifact SHA-256 | `[PENDING_FRONTEND_ARTIFACT_SHA256]` |
| Frontend index SHA-256 | `[PENDING_INDEX_SHA256]` |
| Frontend JavaScript asset and SHA-256 | `[PENDING_JS_EVIDENCE]` |
| Frontend CSS asset and SHA-256 | `[PENDING_CSS_EVIDENCE]` |
| Preserved runtime configuration SHA-256 | `[PENDING_RUNTIME_CONFIG_SHA256]` |
| Task-service PID continuity | `[PENDING_TASK_SERVICE_PID_EVIDENCE]` |
| Report-service PID continuity | `[PENDING_REPORT_SERVICE_PID_EVIDENCE]` |
| Nginx validation and continuity | `[PENDING_NGINX_EVIDENCE]` |
| Deployment timestamp | `[PENDING_DEPLOYMENT_TIMESTAMP]` |
| Public route smoke | `[PENDING_PUBLIC_API_SMOKE]` |
| Public browser evidence | `[PENDING_PRODUCTION_BROWSER_EVIDENCE]` |

## Deployment and rollback

The frontend must be rebuilt from the exact implementation commit with
`VITE_BASE_PATH=/testwise/`, staged in a new immutable directory beneath
`/data1/testwise/releases`, and activated through an atomic switch of
`/data1/testwise/current`.

Deployment must:

1. capture and validate the current release as the rollback target;
2. preserve the live `config/runtime.json` byte-for-byte;
3. verify the archive, index, JavaScript, CSS, and staged runtime hashes;
4. keep the task and report service PIDs unchanged;
5. validate Nginx without reloading it;
6. verify the shell, exact fingerprinted assets, runtime JSON, health,
   catalog, quality versions and snapshots, safe task list, and report list;
7. verify Chinese and English computed matrix typography and responsive
   geometry in the public browser;
8. atomically restore the captured previous symlink target if any post-switch
   assertion fails.

No Nginx reload or backend restart is part of R11.2. If acceptance fails,
atomically repoint `/data1/testwise/current` to the captured previous
immutable release. Do not overwrite or remove backend data or prior frontend
releases.
