# TestWise R11 — backend-owned L1 quality overview

Release date: 2026-07-24

Status: implementation prepared; publication, deployment, and production
acceptance pending

This record covers the approved Overview change that replaces the Basic
dimension's frontend-only quality presentation with a versioned backend
snapshot. It also records the explicit boundary between backend-owned,
modeled, partial, stale, and still-simulated data. No credential or secret is
recorded here.

## Revision identity

| Component | Revision |
| --- | --- |
| Frontend baseline | `e5c0da37d0cd931ecfa430861456cdded64e7efb` |
| Frontend R11 implementation | `[PENDING_FRONTEND_COMMIT]` |
| Backend baseline | `dca07ee627309881a861780ef1b25b2019c0659a` |
| Backend R11 implementation | `[PENDING_BACKEND_COMMIT]` |
| GitCode frontend mirror | `[PENDING_GITCODE_FRONTEND_MIRROR_COMMIT]` |

- Frontend source:
  `huihui-smartguy/Jiuwen-Java-SpecAgent@develop/DispatchPlatform`
- Backend source:
  `SETools/TestingAgent@feature/autotestflow/iteration/Board/backend/testrun`
- Requirements basis: `TestWise_new_feature.md` v1.1, dated 2026-07-23
- Approved design review: 2026-07-24
- Approved Figma:
  <https://www.figma.com/design/25hY1w3NWX5nIEYYsU7kkE>

## Approved data semantics

R11 uses an atomic, backend-owned snapshot for Overview L0 and the Basic L1
dimension. “Backend-owned” means the browser no longer constructs Basic
quality values from frontend fixtures or joins unrelated responses. It does
not erase provenance:

| State | Meaning |
| --- | --- |
| `authoritative` | Approved 615 quality snapshot supplied by the backend |
| `modeled` | Constructed 715 snapshot, clearly distinguished from observed data |
| `partial` | Valid backend snapshot whose declared coverage is incomplete |
| `stale` | Last valid backend snapshot retained after a refresh failure |
| `simulated` | Legacy frontend fixture used only by DFX, Scenario, or Performance |

The Basic matrix and L0 summary always come from the same response revision.
The UI does not silently substitute frontend mock values when the Basic
quality service is unavailable. Loading, empty, error, partial, and stale
states remain explicit.

The contract keeps the Overview core case counts distinct from the
feature-level issue population. The response therefore exposes
`non_passed_case_count` separately from each feature's
`issues_found_total`. Coverage metadata records the feature issue total and
any unmapped issue count.

## User-visible behavior

1. The product-version selector is global to Overview and appears immediately
   before **New Task** in the page header.
2. The selector exposes the two approved quality versions:
   `715:0.2.0.beta3.post3` and `615:0.2.0.beta3`.
3. Switching version replaces the L0 summary and Basic L1 matrix together; an
   old response cannot be presented as the newly selected version.
4. The Basic dimension retains its dimension-quality summary and replaces the
   former overall-assessment and issue cards with
   **FEATURE QUALITY ASSESSMENT · 特性质量评估**.
5. The feature matrix contains seven feature rows and six measures:
   executed scripts, issues found, critical issues, critical-issue ratio,
   resolved issues, and issue-resolution rate.
6. Feature names and all new labels support Chinese and English. Backend
   product identities, version identifiers, and feature keys remain unchanged
   on the wire.
7. DFX, Scenario, and Performance preserve their R10 structures and values.
   Their frontend-fixture provenance is visible rather than implied to be live.
8. The latest valid snapshot remains visible during a transient refresh
   failure and is marked stale. Empty and terminal error states provide a
   retry action.

## Snapshot scope

### 615 authoritative snapshot

| Core measure | Value |
| --- | ---: |
| Total cases | 3,107 |
| Passed cases | 2,654 |
| Non-passed cases | 453 |
| Quality score | 81.4 |

The backend derives the pass rate and ratio fields from their declared count
inputs and validates the weighted quality-score inputs before serving the
snapshot.

The score inputs use the machine-readable
`population_scope=approved_version_quality_assessment`. They are the approved
version-level assessment inputs for `weighted-quality-v1`; they are not
recomputed from the seven feature issue rows, whose independent population is
declared by `coverage`.

### 715 modeled snapshot

| Core measure | Value |
| --- | ---: |
| Total cases | 3,354 |
| Passed cases | 2,991 |
| Non-passed cases | 363 |
| Quality score | 86.7 |

The 715 response is marked `modeled`, and its coverage source is
`modeled_snapshot`. It must not be presented as authoritative production
measurement.

## Backend contract

| Interface | Purpose |
| --- | --- |
| `GET /api/quality/overview/versions?product=...` | Approved snapshot versions, default version, provenance, revision, and generation time |
| `GET /api/quality/overview?product=...&version=...&dimension=basic_function` | One atomic L0 and Basic L1 snapshot |
| `GET /api/quality/overview/events?product=...` | SSE `quality.ready` and `quality.changed` revision notifications |

Snapshot responses carry `schema_version`, `revision`, `generated_at`, and a
strong ETag. `If-None-Match` revalidation returns `304` without an empty-body
JSON parse. Error responses use the structured `error.code`,
`error.message`, and optional `error.details` envelope.

The backend validates non-negative counts, rates, score weights, the declared
quality score, unique feature keys, exactly seven feature rows, execution
totals, coverage totals, one default version, and ASCII version delimiters.
Unknown product/version/dimension scopes fail closed with
`QUALITY_SNAPSHOT_NOT_FOUND`.

The quality event stream sends heartbeats, supports `Last-Event-ID`, and
publishes a new revision after the backend snapshot source changes. The
frontend invalidates both the version list and active atomic snapshot when a
new event arrives.

## Frontend refresh and deployment behavior

- React Query caches version and snapshot responses independently by API base,
  product, version, and dimension.
- ETag revalidation minimizes unchanged payload transfer.
- SSE is the primary invalidation path.
- When SSE is unavailable, a 30-second foreground poll and window-focus
  revalidation provide bounded fallback freshness.
- Completing a task invalidates matching Overview quality queries.
- The process-mode and container Nginx configurations contain exact,
  unbuffered quality-SSE locations before their generic API proxy locations.
- The public `/testwise/` subpath and the existing port-3001 report routing
  remain unchanged.

## Verification before publication

| Check | Result |
| --- | --- |
| Frontend unit/integration suite | Passed: 274/274 |
| Frontend `/testwise/` production build | Passed: TypeScript + Vite, 1,672 modules |
| Backend focused quality suite | Passed within the complete backend suite |
| Backend regression suite | Passed: 71/71; one pre-existing SQLAlchemy deprecation warning |
| Frontend and backend `git diff --check` | Passed |
| Chinese/English browser acceptance | `[PENDING_BROWSER_ACCEPTANCE_RESULT]` |
| Responsive matrix acceptance | `[PENDING_RESPONSIVE_ACCEPTANCE_RESULT]` |
| Public versions/snapshot/ETag smoke | `[PENDING_PUBLIC_API_SMOKE_RESULT]` |
| Public quality SSE smoke | `[PENDING_PUBLIC_SSE_SMOKE_RESULT]` |
| Exact 615/715 metric verification | `[PENDING_METRIC_ACCEPTANCE_RESULT]` |

Final acceptance must verify:

- the selector is immediately left of **New Task**;
- exactly two approved versions are offered;
- L0 and Basic L1 change atomically when the version changes;
- 615 is labeled authoritative and 715 is labeled modeled;
- the seven-by-six matrix matches the approved snapshot;
- DFX, Scenario, and Performance retain their prior structures and show
  simulated provenance;
- Chinese and English contain no unintended cross-locale labels;
- stale, empty, error, and retry behavior remains usable;
- desktop and mobile views have no page-level horizontal overflow.

## Publication and deployment evidence

Status: `[PENDING_RELEASE_STATUS]`

| Item | Evidence |
| --- | --- |
| Frontend final commit | `[PENDING_FRONTEND_COMMIT]` |
| Backend final commit | `[PENDING_BACKEND_COMMIT]` |
| GitCode frontend mirror commit | `[PENDING_GITCODE_FRONTEND_MIRROR_COMMIT]` |
| Frontend release path | `[PENDING_FRONTEND_RELEASE_PATH]` |
| Previous frontend rollback target | `[PENDING_FRONTEND_ROLLBACK_TARGET]` |
| Frontend artifact SHA-256 | `[PENDING_FRONTEND_ARTIFACT_SHA256]` |
| Preserved runtime config SHA-256 | `[PENDING_RUNTIME_CONFIG_SHA256]` |
| Backend release path | `[PENDING_BACKEND_RELEASE_PATH]` |
| Backend pre-release backup | `[PENDING_BACKEND_BACKUP_PATH]` |
| Backend runtime artifact SHA-256 | `[PENDING_BACKEND_ARTIFACT_SHA256]` |
| Backend PID after deployment | `[PENDING_BACKEND_PID]` |
| Nginx include backup | `[PENDING_NGINX_BACKUP_PATH]` |
| Installed Nginx include SHA-256 | `[PENDING_NGINX_INCLUDE_SHA256]` |
| Nginx validation/reload | `[PENDING_NGINX_RESULT]` |
| Report service continuity | `[PENDING_REPORT_SERVICE_EVIDENCE]` |
| Deployment timestamp | `[PENDING_DEPLOYMENT_TIMESTAMP]` |
| Production browser evidence | `[PENDING_PRODUCTION_BROWSER_EVIDENCE]` |

## Rollback

1. Confirm there is no active task whose state could be affected by a backend
   restart.
2. Atomically repoint `/data1/testwise/current` to
   `[PENDING_FRONTEND_ROLLBACK_TARGET]`.
3. Restore only the R11 backend source/config files from
   `[PENDING_BACKEND_BACKUP_PATH]`; do not overwrite mutable task, database,
   testcase, log, or report data.
4. Restore the Nginx include from `[PENDING_NGINX_BACKUP_PATH]` if the quality
   SSE route must also be reverted.
5. Validate Nginx before reload, restart the task service with the documented
   service procedure, and verify ports 3000 and 3001.
6. Recheck the public shell, Task versions, quality versions, quality snapshot,
   ETag, SSE, catalog, task list, and report list.

No password, token, private key, raw sensitive response, task log path, script
path, or test-data path belongs in this record.
