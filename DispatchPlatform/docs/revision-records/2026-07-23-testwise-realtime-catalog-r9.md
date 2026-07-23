# TestWise R9 — Real-time test catalog

Date: 2026-07-23

Status: released

Approved design: https://www.figma.com/design/ozCEV6RMKbxUql4tiZ6xY0

## Release identity

- Frontend baseline: `2207f7feb069907563ae72779666609ba098294b`
- Frontend implementation: `256538431e7446cd7046f839018a1bf69387a184`
- Frontend production fix and final source: `1a982aca10f9de7585ec9701d87ff9e7db22eff4`
- Backend baseline: `78cde8dca384d917764a996921e492e772cdbfea`
- Backend implementation: `6cef6e3f1c8a94bf2884e073c95e3449807ce6c8`
- GitHub branch: `huihui-smartguy/Jiuwen-Java-SpecAgent@develop`
- GitCode branch: `SETools/TestingAgent@feature/autotestflow/iteration`

## What changed

TestWise now consumes one revisioned, authoritative backend snapshot for the
complete product, scene, Feature, and script hierarchy. The frontend loads the
snapshot with ETag support, listens for Server-Sent Events, and falls back to a
five-second poll when the event stream is unavailable. Focus and reconnect also
trigger validation, while the most recent valid snapshot remains visible during
a transient failure.

The live Object picker, Scripts, Tasks, Settings, Observe, Results, report
surfaces, and execution context now share the same catalog. Stable full-path
script IDs and a catalog revision are sent with task requests. A stale revision
is rejected before task or version side effects. Legacy execution-history IDs
remain readable and are migrated to the canonical identity.

Backend-native values remain unchanged on the wire. Display labels are mapped
only in the UI:

| Backend value | TestWise label |
| --- | --- |
| `高码java` | High-Code Java |
| `高码python` | High-Code Python |
| `合一版本` | Unified Version |
| `API` / `WEB` / `DFx` / `场景用例` | API / WEB / DFX / scene |

## Interfaces

- `GET /api/catalog` — full deterministic snapshot, weak ETag, `304` support
- `GET /api/catalog/events` — SSE revision notifications and heartbeats
- Existing script mutation APIs — serialized with catalog publication
- `POST /api/tasks` — accepts and revalidates `catalog_revision`

The Nginx deployment includes an exact, unbuffered SSE location before the
generic `/testwise/api/` proxy.

## Verification

- Frontend: 26 test files, 258/258 tests passed
- Frontend production build: passed
- Backend Python 3.12: 56/56 tests passed
- Backend Python 3.8: dependency resolution and 56/56 tests passed
- Python 3.8 syntax compilation: passed
- `git diff --check`: passed in both repositories

Production acceptance on `http://1.92.123.95/testwise/`:

- Catalog: 3 products, 12 Objects, 19 Features, 255 scripts
- Final catalog revision:
  `10cff79d357bc85e2773f7560499ad4dc7c2670a8ea87ff7bfda7f73125df363`
- Unified Version API: 126 scripts and 14 Features
- Public ETag revalidation returned `304`
- Public SSE returned `text/event-stream` and `X-Accel-Buffering: no`
- In an already-open browser, an inert upload changed 255→256 total and
  126→127 for Unified Version API without reload
- Deletion changed both counts back and removed all probe file/config residue
- A stale task revision returned `409 CATALOG_CHANGED`; the task-store SHA-256
  remained `d01216f821c12a5189f06ba51732cf6038435b0d57578724aa98c080e11e824b`
- The cached-catalog Tasks navigation path shows 5 scripts for API密钥管理 and
  enables launch after the R9 production fix

## Deployment evidence

- Backend release:
  `/data1/testrun/releases/20260723-182653-6cef6e3/source`
- Backend pre-release backup:
  `/data1/testrun/backups/20260723-182653-pre-r9-6cef6e3`
- Backend runtime artifact SHA-256:
  `d285a1516c32d8da316852749e7c4195b11564bc3edf705c644919ff853e7d5c`
- Backend PID after release: `279131`
- Frontend release:
  `/data1/testwise/releases/20260723-183409-1a982ac`
- Frontend artifact SHA-256:
  `8d29605f1dc88d7c8cf4505d0a56ac7b029d0ad23e5bc85809557c7f2fd4c019`
- Preserved runtime configuration SHA-256:
  `216a056145da45da17ec2e74b0ad64cf3fe8f8a02d741a8f5ab81b1262901203`
- Installed Nginx include SHA-256:
  `93372a7d9692227c66d7b7d22633f72dd0a469f8c7d3f9f055fbba4b0e26b4fc`
- Report service PID `3267699` on port 3001 was not restarted
- Active tasks before and after deployment: 0

## Rollback

1. Confirm there are no active tasks.
2. Gracefully terminate the port-3000 process.
3. Restore the backend files from
   `/data1/testrun/backups/20260723-182653-pre-r9-6cef6e3/backend`.
4. Restart the backend with the documented direct/nohup command.
5. Atomically repoint `/data1/testwise/current` to
   `/data1/testwise/releases/20260720-173815-126f6f7`.
6. Restore the backed-up Nginx include, run `nginx -t`, and reload Nginx.

Mutable `config`, `testcase`, task, database, log, and report data are not part
of the source replacement. No credentials or secrets are recorded here.
