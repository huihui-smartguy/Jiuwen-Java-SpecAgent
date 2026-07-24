# TestWise R10 — product, version, and test-type scope

Release date: 2026-07-24

Status: released and accepted in production

This record covers the approved TestWise R10 frontend changes, the GitCode
frontend mirror, the production backend runtime correction, and the final
browser acceptance. It contains no credentials or secrets.

## Revision identity

| Component | Revision |
| --- | --- |
| Frontend baseline | `054e3b27c41c64db085d164780120c6173968a3f` |
| Frontend implementation | `2b5b417dbd6e56fc0258eb25004427cd3ac2f652` |
| Frontend shell-cache correction | `03b22dc56b61f1aaed74483b5b3ddfd6dbc6e094` |
| Frontend responsive Overview correction | `48e58341114086ea9163637a6514459390bfd2de` |
| Backend real-time catalog implementation | `6cef6e3f1c8a94bf2884e073c95e3449807ce6c8` |
| GitCode branch baseline used for R10 | `979730f6dd4b7958bd0d492c58635c9b66c693e8` |
| Initial GitCode R10 frontend mirror | `f7fcdf94eb88596ac33013f3ea13dbe9a1419000` |

- Frontend source: `huihui-smartguy/Jiuwen-Java-SpecAgent@develop`
- GitCode source/mirror:
  `SETools/TestingAgent@feature/autotestflow/iteration`
- GitCode frontend directory: `Board/DispatchPlatform`
- GitCode joint records:
  `Board/backend/testrun/ChangeLogs`
- Approved Figma:
  https://www.figma.com/design/UowHkMKXpYQaURdOzH6jZH

## Delivered behavior

1. The global selector now contains products only:
   High-Code Java, High-Code Python, and Unified Version. Scene/test-type rows
   are no longer exposed in the global picker.
2. Overview L0 and L1 fixtures switch together with the selected product.
3. L1 adds an accessible product-version selector next to the quality-dimension
   selector. Version memory is retained independently for each product.
4. Tasks adds a page-local Select Test Type control before Refresh Catalog.
5. Scripts adds the same page-local control, with state independent from Tasks.
6. Test-type choices are filtered to the selected product and retain backend
   native product/scene values in API queries and task payloads.
7. API, WEB, DFX, and scene are ordered consistently. Chinese renders the
   scene label as `场景化`; English renders it as `Scene`.
8. Chinese and English shell, Overview, Tasks, and Scripts labels are
   locale-consistent. Backend-owned Feature names, script paths, product names,
   and version identifiers remain unchanged.
9. The selected running-task identity remains bound to the immutable task
   source after a later product change.
10. Catalog removal, fallback, re-addition, and Object-ID migration preserve
    valid per-page selections without reviving a stale removed selection.

## Quality data fixtures

The simulated Overview data is keyed by product and version:

| Product | Versions |
| --- | --- |
| High-Code Java | `v2.4.1`, `v2.3.0` |
| High-Code Python | `v1.8.0`, `v1.7.2` |
| Unified Version | `v3.0.0`, `v2.9.0` |

The data source remains explicitly marked as frontend demo data. Product and
version changes update L0 totals, pass rate, issue count, every L1 dimension,
performance baselines, and conclusions as one coherent snapshot.

## Backend decision and runtime correction

No new backend source change was required for R10. The committed R9 backend
already provides:

- `GET /api/catalog` with weak ETag support;
- `GET /api/catalog/events` over SSE;
- safe filtered `GET /api/tasks`;
- the full product/scene/Feature/script snapshot;
- task catalog-revision validation and stable script IDs.

Production preflight found runtime drift: port 3000 was running an older source
tree that did not expose `GET /api/catalog` or safe task listing. The committed
R9 source was restored from
`/data1/testrun/releases/20260723-182653-6cef6e3/source` into the live backend
working directory while preserving configuration, testcases, task history,
logs, repositories, databases, and reports.

The documented startup form is valid after `sudo su`, because `python`
resolves to `/usr/local/bin/python`:

```bash
cd /data1/testrun/testrun
nohup python main.py --web --host 0.0.0.0 --port 3000 > app.log 2>&1 &
```

The release used the equivalent explicit interpreter
`/usr/local/bin/python3.11` and wrote to the existing `logs/app.log`.

Eight abandoned nonterminal records from 2026-07-16 were reconciled to failed
on startup. No current execution process was active at cutover.

## Frontend shell-cache correction

The first production browser check received a cached R9 `index.html`, even
though the R10 fingerprinted assets were deployed. Root cause: the SPA entry
point had no cache-control header.

Exact Nginx locations for `/testwise/` and `/testwise/index.html` now return:

```text
Cache-Control: no-cache, no-store, must-revalidate
```

Fingerprint-named CSS and JavaScript assets remain cacheable. A deployment
regression test covers both the process-mode include and the container Nginx
configuration.

## Responsive visual correction

Production screenshot review found that the L0 divider changed from vertical
to horizontal below 980 px but retained the desktop `min-height: 162px`. This
rendered as a large gray block. The responsive rule now explicitly sets both
height and minimum height to 1 px, with a static CSS regression assertion.

## Verification

| Check | Result |
| --- | --- |
| Frontend unit/integration suite | 28 files, 275/275 passed |
| TypeScript + Vite production build | Passed, 1,672 modules |
| Whitespace validation | `git diff --check` passed |
| Exact GitCode mirror comparison | No differences |
| Catalog ETag revalidation | HTTP `304` |
| Catalog SSE | `catalog.changed` event with current revision |
| Safe active-task list | HTTP `200`, 0 active tasks |
| Report list | HTTP `200` |
| Nginx configuration | `nginx -t` passed |
| Browser Chinese/English acceptance | Passed |

Final frontend assets:

- `assets/index-DvE1LM_2.css`
- `assets/index-BXhAqmqf.js`

## Production deployment evidence

Deployment host: `1.92.123.95`

| Item | Evidence |
| --- | --- |
| Frontend release | `/data1/testwise/releases/20260724-120448-48e5834` |
| Previous R10 frontend release | `/data1/testwise/releases/20260724-113956-2b5b417` |
| Pre-R10 frontend release | `/data1/testwise/releases/20260723-183409-1a982ac` |
| Frontend artifact SHA-256 | `bd7b3bf5a9f19477cbf7986a9846df34e1ab8346004ce47978efc067661bffdd` |
| Runtime config SHA-256 | `216a056145da45da17ec2e74b0ad64cf3fe8f8a02d741a8f5ab81b1262901203` |
| Nginx include SHA-256 | `510f548dbd2bcabf2a95c8b5efb3ffbc5fb79377848f448e96c276118413574d` |
| Nginx backup | `/data1/testwise/backups/20260724-114549-pre-r10-cache-policy/testwise-locations.conf` |
| Backend drift backup | `/data1/testrun/backups/20260724-113532-pre-r10-runtime-drift` |
| Backend `main.py` SHA-256 | `2c0defe404269a70d5fa5d18ab4151aec1e0267f3f02d8f6b250a17c9ed2c06e` |
| Backend PID after correction | `1130841` |
| Report service | PID `3267699`, port 3001, not restarted |

Final catalog:

- Revision:
  `9ffcef510238a65456347394025ac06e1f90b6b576a47563d95e780ab1b57856`
- Totals: 3 products, 12 Objects, 24 Features, 445 scripts
- Product script counts:
  High-Code Java 226, High-Code Python 62, Unified Version 157

## Browser acceptance

- The product picker showed exactly three products and no scenarios.
- Selecting High-Code Java changed L0 and L1 together.
- High-Code Java `v2.4.1` showed L0 67.91 / 134 executions and L1
  91 / 134 passed.
- Switching to `v2.3.0` changed L0 to 60.94 / 128 executions and L1
  to 78 / 128 passed.
- Unified Version Tasks displayed API 126, WEB 31, DFX 0, and scene 0.
- Switching Tasks to WEB produced 31 matching live scripts.
- Scripts retained independent API state, then switched to WEB and displayed
  31 rows and updated summary cards.
- Chinese showed 产品、测试类型、特性、等级、脚本、场景 and other page
  taxonomy without English leakage; English switched the corresponding labels
  back to Product, Test type, Feature, Level, Script, and Scene.
- Responsive screenshot acceptance confirmed a 1 px L0 separator with visible
  metrics and adjacent L1 quality-dimension/version controls.

## Rollback

1. Confirm that no task is active.
2. For an immediate R10.1 rollback, atomically repoint
   `/data1/testwise/current` to
   `/data1/testwise/releases/20260724-113956-2b5b417`. For a complete R10
   rollback, use `/data1/testwise/releases/20260723-183409-1a982ac`.
3. Restore
   `/data1/testwise/backups/20260724-114549-pre-r10-cache-policy/testwise-locations.conf`
   to `/etc/nginx/testwise-locations.conf`.
4. Run `nginx -t` and `nginx -s reload`.
5. If the backend runtime correction must also be reverted, restore only the
   backed-up backend source files from
   `/data1/testrun/backups/20260724-113532-pre-r10-runtime-drift/backend`,
   leaving mutable data untouched, and restart with the documented command.
6. Recheck the catalog, safe task list, reports, SSE, and both listening ports.
