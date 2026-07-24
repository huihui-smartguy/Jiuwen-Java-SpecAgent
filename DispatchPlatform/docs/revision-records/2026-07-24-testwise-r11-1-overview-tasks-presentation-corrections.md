# TestWise R11.1 — Overview and Tasks presentation corrections

Release date: 2026-07-24

Status: released and production-accepted at 2026-07-24T16:36:31+08:00

This record covers the approved post-R11 presentation corrections for the
Overview and Tasks workflows. It also records the compatibility boundary for
the adjacent Results and report-generation version selectors. No credential,
password, token, private key, raw sensitive response, or private backend path
is recorded here.

## Revision identity

| Component | Revision |
| --- | --- |
| Frontend baseline | `27308c44a12abf28d97e96b81597c15b09b66c5e` |
| Frontend R11.1 implementation | `fe1fe8f74460f158608c195770b3b9ac59d940d5` |
| Frontend production-evidence record | This record's docs-only finalization commit; see `develop` branch history |
| Backend implementation, unchanged | `1a45c4556dfb57c50c6d00223286d8c24dcb8cbe` |
| GitCode branch baseline | `c7cf6847bb724e91ae06692b5d4d60fd1ebc74d9` |
| GitCode R11.1 frontend mirror | `a9f8d93435368085a4b63ba9f5143f3ae1ea4e19` |
| GitCode joint release evidence | The joint records' docs-only finalization commit; see `feature/autotestflow/iteration` branch history |

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

## Verification and production acceptance

The automated release gates were rerun from the exact committed source tree.
Production API and browser checks were then completed against the deployed
artifact.

| Check | Final result |
| --- | --- |
| Focused Dashboard, Tasks, Results, and version-label tests | Covered by the passing committed-tree suite |
| Full frontend unit/integration suite | Passed: 29 test files, 284/284 tests |
| TypeScript and Vite `/testwise/` production build | Passed: 1,673 modules |
| Frontend `git diff --check` | Passed before release and during final record preparation |
| Exact source-to-GitCode mirror comparison | Passed; final `rsync --dry-run --delete` produced no output |
| Chinese and English browser acceptance | Passed locally and in production for Overview and Tasks |
| Desktop and mobile geometry acceptance | Local 1440 × 1100, 980 × 1100, and 390 × 844 passed; production 1440 and 390 passed |
| Public quality, catalog, task-list, and report smoke | Passed through the production Nginx route |
| Backend and report process continuity | Task PID `1336012` and report PID `3267699` remained unchanged |

Final automated checks proved:

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

Status: released, mirrored, deployed, and production-accepted

| Item | Evidence |
| --- | --- |
| Frontend implementation commit | `fe1fe8f74460f158608c195770b3b9ac59d940d5` |
| Frontend evidence commit | This record's docs-only finalization commit; see `develop` branch history |
| GitCode frontend mirror commit | `a9f8d93435368085a4b63ba9f5143f3ae1ea4e19` |
| GitCode evidence commit | The joint records' docs-only finalization commit; see `feature/autotestflow/iteration` branch history |
| Frontend release path | `/data1/testwise/releases/20260724-163405-fe1fe8f` |
| Previous frontend rollback target | `/data1/testwise/releases/20260724-153246-45b260f` |
| Frontend artifact SHA-256 | `f088556160c5936239c55204bcdcdab2e6c87e1b4778f9d2b5f76aa8688cf9ff` |
| Frontend index SHA-256 | `0fdb5ef08eaf421a390378ddd7da95a65be6cccec17425a3ecfdcc0146a47c37` |
| Frontend JavaScript asset and SHA-256 | `assets/index-DNNybAqc.js`; `26f4b0405efa5fdf97294f3c5d375f8da8deb0c7a352b0343462d531381e56db` |
| Frontend CSS asset and SHA-256 | `assets/index-Da-RxUZB.css`; `95db49fe6f60dae8413c8bc2653158303e7c940daed8abd4a420d2439567e99d` |
| Preserved runtime configuration SHA-256 | `216a056145da45da17ec2e74b0ad64cf3fe8f8a02d741a8f5ab81b1262901203` |
| Task-service PID continuity | PID `1336012` unchanged; no restart |
| Report-service PID continuity | PID `3267699` unchanged; no restart |
| Nginx validation | `nginx -t` passed; no reload was required |
| Deployment timestamp | `2026-07-24T16:36:31+08:00` |
| Public route smoke | Shell, fingerprinted assets, runtime JSON, health, catalog, quality versions, 715/615 snapshots, safe task list, and reports passed |
| Public browser evidence | Chinese and English Overview and Tasks passed with no console warning or error |

Production browser acceptance confirmed:

- at desktop width `1440`, there was no page-level overflow, the Basic card
  measured `300px`, and the Feature Quality Assessment heading rendered at
  `16px / 24px`;
- switching to 615 displayed the approved score and counts:
  `81.4 / 3107 / 2654 / 453`;
- at mobile width `390`, there was no page-level overflow;
- duplicated execution-version labels were absent, and the localized
  `Default` / `默认` suffix appeared exactly once.

## Deployment and rollback

The frontend was built with `VITE_BASE_PATH=/testwise/`, staged in the new
immutable release directory, and activated through an atomic switch of
`/data1/testwise/current`. The live `config/runtime.json` was preserved
byte-for-byte, archive and staged hashes were verified, and the task and
report services remained on their existing PIDs.

Nginx configuration validation passed. Because this frontend-only release
changed no routing, Nginx was not reloaded and neither backend service was
restarted.

If rollback is required, atomically repoint `/data1/testwise/current` to
`/data1/testwise/releases/20260724-153246-45b260f`, then repeat the shell,
asset, runtime, health, catalog, quality, task-list, report, and browser
checks. Do not overwrite or remove backend data or prior immutable frontend
releases.
