# TestWise R11.1 — Overview and Tasks presentation corrections

Release date: 2026-07-24

Status: implementation prepared; publication, deployment, and production
acceptance pending

This record covers the approved post-R11 presentation corrections for the
Overview and Tasks workflows. It also records the compatibility boundary for
the adjacent Results and report-generation version selectors. No credential,
password, token, private key, raw sensitive response, or private backend path
is recorded here.

## Revision identity

| Component | Revision |
| --- | --- |
| Frontend baseline | `27308c44a12abf28d97e96b81597c15b09b66c5e` |
| Frontend R11.1 implementation | `[PENDING_FRONTEND_COMMIT]` |
| Frontend production-evidence record | `[PENDING_FRONTEND_EVIDENCE_COMMIT]` |
| Backend implementation, unchanged | `1a45c4556dfb57c50c6d00223286d8c24dcb8cbe` |
| GitCode branch baseline | `c7cf6847bb724e91ae06692b5d4d60fd1ebc74d9` |
| GitCode R11.1 frontend mirror | `[PENDING_GITCODE_MIRROR_COMMIT]` |
| GitCode joint release evidence | `[PENDING_GITCODE_EVIDENCE_COMMIT]` |

- Frontend source:
  `huihui-smartguy/Jiuwen-Java-SpecAgent@develop/DispatchPlatform`
- Backend and GitCode mirror source:
  `SETools/TestingAgent@feature/autotestflow/iteration`
- GitCode frontend mirror: `Board/DispatchPlatform`
- GitCode joint records: `Board/backend/testrun/ChangeLogs`
- Approved requirements: the four post-R11 Overview and Tasks defect
  corrections approved by the user on 2026-07-24
- Approved visual reference: workspace `picture/quality.png`
- R11 data-contract baseline:
  `TestWise_new_feature.md` version 1.1 and the approved R11 quality design

## Scope and compatibility boundary

R11.1 is a frontend-only corrective release. It changes presentation,
typography, and version-label formatting without changing the R11 quality
snapshot contract or its data.

The following remain unchanged:

- `GET /api/quality/overview/versions`;
- `GET /api/quality/overview`;
- `GET /api/quality/overview/events`;
- catalog, task, report, ETag, and SSE contracts;
- the exact approved 615 and 715 quality counts, ratios, scores, feature rows,
  provenance state, and freshness state returned by the backend;
- canonical `version.code` values used by selectors, task creation, report
  filtering, and report generation;
- production runtime configuration and Nginx routing;
- the task service on port `3000` and report service on port `3001`.

No backend source change, backend deployment, backend restart, database
migration, snapshot edit, or Nginx change is required for this revision.

## Delivered corrections

### 1. L0 healthy-state presentation

- The L0 QUALITY card no longer repeats the selected version.
- Normal `authoritative` and `modeled` provenance badges are no longer shown
  inside L0.
- The page-level version selector remains the single visible version control,
  and changing it still replaces L0 and Basic L1 as one atomic snapshot.
- Exceptional `partial` and `stale` states remain visible in L0 and retain
  status semantics; the correction does not hide degraded data.

### 2. Basic L1 quality presentation

- Normal `authoritative` and `modeled` badges are removed from the right side
  of the Basic L1 heading.
- Exceptional `partial` and `stale` warnings remain visible.
- DFX, Scenario-Based, and Performance keep their explicit frontend-simulation
  disclosure.
- The visible `weighted-quality-v1` score-formula footer is removed from the
  dimension-quality card. Backend validation and the displayed score are
  unchanged.
- Dimension-quality typography and spacing are rebalanced against the feature
  matrix. The desktop card now reserves at least `300px`, uses a `20px`
  matrix gap and `24px` internal padding, and vertically balances the score
  block after removing the footer. The compact score uses a `28px / 34px`
  value, a `14px / 22px` caption, a `14px / 22px` eyebrow, and clearer
  supporting text.

### 3. Feature Quality Assessment proportions

- The Feature Quality Assessment heading is increased to `16px / 24px`.
- Its feature count is increased to `13px / 20px` and remains on one line at
  normal widths.
- Matrix text is increased to `13px / 20px`.
- At `440px` and below, the heading and feature count stack so longer
  localized text does not collide.
- Existing internal horizontal scrolling, sticky header, sticky first column,
  seven feature rows, six measures, and backend values remain unchanged.

### 4. Execution-version labels

A shared formatter now normalizes only outer whitespace and formats backend
versions without modifying their canonical values:

- when `name` and `code` are exactly equal, the code is shown once;
- when they differ, the label remains `name · code`;
- the localized Default suffix is appended once when applicable;
- comparison remains case-sensitive so genuinely distinct backend labels are
  not collapsed;
- a blank name falls back to the code without a dangling delimiter.

The formatter is used by Tasks and by the adjacent Results filter and
report-generation selector, preventing the same duplicated
`715… · 715…` presentation from reappearing elsewhere. Option values and
request payloads remain the canonical backend code.

## Accessibility, responsive, and localization invariants

- Chinese and English must contain no unintended cross-locale labels.
- The page-level version selector and execution-version selectors retain their
  accessible names, keyboard behavior, and canonical option values.
- Partial and stale warnings retain `role="status"` semantics.
- At desktop width, the larger type must not cause page-level horizontal
  overflow or obscure feature values.
- At narrow widths, the Basic cards may stack while the feature matrix keeps
  internal scrolling and its sticky first column.
- The production acceptance matrix must include at least `1440 × 1100` and
  `390 × 844`.

## Changed files

### Frontend implementation and tests

- `DispatchPlatform/src/components/ReportGenerationModal.tsx`
- `DispatchPlatform/src/i18n.ts`
- `DispatchPlatform/src/pages/Dashboard.test.tsx`
- `DispatchPlatform/src/pages/Dashboard.tsx`
- `DispatchPlatform/src/pages/Results.test.tsx`
- `DispatchPlatform/src/pages/Results.tsx`
- `DispatchPlatform/src/pages/Tasks.test.tsx`
- `DispatchPlatform/src/pages/Tasks.tsx`
- `DispatchPlatform/src/styles/routes/overview.css`
- `DispatchPlatform/src/versionLabels.test.ts`
- `DispatchPlatform/src/versionLabels.ts`

### Revision record

- `DispatchPlatform/docs/revision-records/2026-07-24-testwise-r11-1-overview-tasks-presentation-corrections.md`

### Backend

No backend file is changed.

## Verification status before publication

All final evidence must be rerun from the exact committed source tree. The
prepared working tree passed 284 tests and the `/testwise/` production build;
these results will be repeated from the committed source before publication.

| Check | Prepared-state result |
| --- | --- |
| Focused Dashboard, Tasks, Results, and version-label tests | Covered by the prepared full-suite run; committed-tree rerun pending |
| Full frontend unit/integration suite | Prepared tree passed: 29 files, 284 tests; committed-tree rerun pending |
| TypeScript and Vite `/testwise/` production build | Prepared tree passed: 1,673 modules; committed-tree rerun pending |
| Frontend `git diff --check` | Prepared working tree passed; committed-tree rerun pending |
| Chinese and English browser acceptance | Prepared preview passed for Overview and Tasks; production rerun pending |
| Desktop and mobile geometry acceptance | Prepared preview passed at 1440 × 1100, 980 × 1100, and 390 × 844; production rerun pending |
| Public quality, catalog, task-list, and report smoke | `[PENDING_PUBLIC_API_SMOKE]` |
| Backend and report process continuity | `[PENDING_PID_CONTINUITY]` |

Final automated checks must prove:

- healthy 715 and 615 snapshots contain no L0 version badge and no normal
  L0/Basic-L1 provenance badge;
- partial and stale warnings remain visible in both relevant quality regions;
- simulated provenance remains visible for non-Basic dimensions;
- score-formula copy is absent while quality values remain unchanged;
- the approved heading, matrix, score, and responsive typography rules are
  present;
- equal version names and codes render once in Tasks, Results, and report
  generation;
- distinct names and codes remain distinct;
- Tasks sends the selected canonical version code in its request payload.

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
| Deployment timestamp | `[PENDING_DEPLOYMENT_TIMESTAMP]` |
| Public browser evidence | `[PENDING_PRODUCTION_BROWSER_EVIDENCE]` |

## Deployment and rollback

The frontend must be built with `VITE_BASE_PATH=/testwise/`, staged in a new
immutable directory beneath `/data1/testwise/releases`, and activated through
an atomic switch of `/data1/testwise/current`.

Deployment must:

1. capture and validate the current release as the rollback target;
2. preserve the live `config/runtime.json` byte-for-byte;
3. verify the archive and staged runtime hashes before switching;
4. keep the task and report service PIDs unchanged;
5. verify the shell, exact fingerprinted assets, runtime JSON, health,
   catalog, quality versions and snapshots, safe task list, and report list;
6. automatically restore the captured previous symlink target if any
   post-switch assertion fails.

No Nginx reload or backend restart is part of R11.1. If acceptance fails,
atomically repoint `/data1/testwise/current` to the captured previous release.
Do not overwrite or remove either backend data or prior immutable frontend
releases.
