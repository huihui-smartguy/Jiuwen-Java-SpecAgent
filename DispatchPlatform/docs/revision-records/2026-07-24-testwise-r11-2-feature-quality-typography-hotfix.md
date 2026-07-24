# TestWise R11.2 — Feature Quality Assessment typography hotfix

Release date: 2026-07-24

Status: released and production-accepted at 2026-07-24T17:07:18+08:00

This record covers the approved R11.2 Feature Quality Assessment typography
hotfix. It contains no credential, password, token, private key, raw sensitive
response, or private backend path. Every release value below is based on
observed repository, build, server, API, or browser evidence.

## Revision identity

| Component | Revision |
| --- | --- |
| Frontend baseline | `26c77a5b0bacfe6eac090730740df52ece2d1c51` |
| Frontend R11.2 implementation | `5558dc37370be12ca6a25eb836c85cfd2fd2f5a0` |
| Frontend production-evidence record | This record's docs-only finalization commit; see `develop` branch history |
| GitCode branch baseline | `b850e333ca865e2227ae81b497a9f460c76c4387` |
| GitCode R11.2 frontend mirror | `044c7f9712751d576cd0164bed0c996f023fe033` |
| GitCode joint release evidence | The joint records' docs-only finalization commit; see `feature/autotestflow/iteration` branch history |
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

## Verification and production acceptance

The automated gates were run against the exact committed implementation.
Production route and browser checks were then completed against the deployed
artifact.

| Check | Final result |
| --- | --- |
| Focused Dashboard suite | Passed: 12/12 tests |
| Full frontend unit/integration suite | Passed: 29 test files, 284/284 tests |
| TypeScript and Vite `/testwise/` production build | Passed: 1,673 modules |
| Frontend `git diff --check` | Passed before release and during final record preparation |
| Exact source-to-GitCode mirror comparison | Passed |
| Chinese and English browser acceptance | Passed locally and in production for the Basic Overview matrix |
| Computed matrix typography | Column headers, feature row headers, and data cells rendered at `14px / 22px`, with normal letter spacing and no text transform |
| Matrix structure | Preserved: 8 rendered rows including the header and 7 columns |
| Responsive geometry | Local widths 1440, 980, and 390 passed; production widths 1440 and 390 had no page-level overflow |
| Internal matrix scrolling | Preserved; production content widths measured `980px` in Chinese and `1007px` in English |
| Public route smoke | Shell, health, exact assets, runtime, catalog, quality versions, 715/615 snapshots, tasks, and reports passed |
| Task and report process continuity | Task PID `1336012` and report PID `3267699` remained unchanged |
| Browser console | No TestWise application or API warning or error |

The regression test statically verifies that:

- the matrix and its `th` and `td` cells use the shared Overview body-size and
  body-line tokens;
- matrix headers reset global letter spacing and uppercase transformation;
- existing responsive sticky-matrix behavior remains encoded.

## Publication and production evidence

Status: released, mirrored, deployed, and production-accepted

| Item | Evidence |
| --- | --- |
| Frontend implementation commit | `5558dc37370be12ca6a25eb836c85cfd2fd2f5a0` |
| Frontend evidence commit | This record's docs-only finalization commit; see `develop` branch history |
| GitCode frontend mirror commit | `044c7f9712751d576cd0164bed0c996f023fe033` |
| GitCode evidence commit | The joint records' docs-only finalization commit; see `feature/autotestflow/iteration` branch history |
| Frontend release path | `/data1/testwise/releases/20260724-170332-5558dc3` |
| Previous frontend rollback target | `/data1/testwise/releases/20260724-163405-fe1fe8f` |
| Frontend artifact SHA-256 | `64693c5cf81ef3f5fc1aae10dd6f44219b1892b687f444e374e18e30766acba4` |
| Frontend index SHA-256 | `3a3d1d7e538e2ba2558fffb72b8f8c12ff47b77760286ffb338dedd30211fa5c` |
| Frontend JavaScript asset and SHA-256 | `assets/index-L8I-aiDf.js`; `26f4b0405efa5fdf97294f3c5d375f8da8deb0c7a352b0343462d531381e56db` |
| Frontend CSS asset and SHA-256 | `assets/index-C8ZAzdH8.css`; `22458f34b4af5939e47181fef7a7cc1d0b1f701b4b209c670b3499437a36a7f9` |
| Preserved runtime configuration SHA-256 | `216a056145da45da17ec2e74b0ad64cf3fe8f8a02d741a8f5ab81b1262901203` |
| Task-service PID continuity | PID `1336012` before and after; no restart |
| Report-service PID continuity | PID `3267699` before and after; no restart |
| Nginx validation and continuity | `nginx -t` passed before and after; no reload |
| Deployment timestamp | `2026-07-24T17:07:18+08:00` |
| Public route smoke | Shell, health, exact assets, runtime JSON, catalog, quality versions, 715 snapshot, 615 snapshot, task list, and reports passed |
| Public browser evidence | Chinese and English at 1440 and 390 passed with exact R11.2 assets and no page-level overflow |

Production browser acceptance confirmed:

- table column headers, feature row headers, and data cells rendered at
  `14px / 22px`, with normal letter spacing and no text transform;
- the matrix retained 8 rendered rows including the header and 7 columns;
- internal horizontal scrolling remained available, with content widths of
  `980px` in Chinese and `1007px` in English;
- Chinese and English desktop and mobile pages loaded the exact R11.2
  fingerprinted assets.

Chromium made one automatic request to the bare-host `/favicon.ico`, outside
the `/testwise/` application path, and that unrelated host route returned
HTTP `502`. No TestWise application route, asset, API request, interaction, or
console check failed.

## Deployment and rollback

The frontend was rebuilt from
`5558dc37370be12ca6a25eb836c85cfd2fd2f5a0` with
`VITE_BASE_PATH=/testwise/`, staged in the new immutable release directory,
and activated through an atomic switch of `/data1/testwise/current`.

The live `config/runtime.json` was preserved byte-for-byte. Archive, index,
JavaScript, CSS, and staged runtime hashes were verified. Nginx validation
passed before and after the switch without a reload, and the task and report
services remained on their existing PIDs.

If rollback is required, atomically repoint `/data1/testwise/current` to
`/data1/testwise/releases/20260724-163405-fe1fe8f`, then repeat the shell,
asset, runtime, health, catalog, quality, task-list, report, typography,
responsive, and browser-console checks. Do not overwrite or remove backend
data or prior immutable frontend releases.
