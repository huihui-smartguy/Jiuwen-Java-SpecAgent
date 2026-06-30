# SUT Manifest Schema (`autotestflow.sut-manifest.v1`)

AutoTestFlow standard mode now receives SUT topology through a Markdown file
with YAML front matter. The Markdown body is for human notes; only the front
matter is parsed by `scripts/sut_manifest.py`.

```markdown
---
schema_version: autotestflow.sut-manifest.v1
suite:
  id: checkout-suite
  output_dir: analysis_output
  defaults:
    knowledge_domain: rest_api
targets:
  - id: catalog
    name: Catalog API
    role: primary
    source:
      path: services/catalog
    runtime:
      mode: predeployed
      base_url: http://localhost:8081
      readiness_probe:
        method: GET
        path: /health
        expect_status_lt: 500
    probes:
      - name: health
        method: GET
        path: /health
  - id: checkout
    name: Checkout API
    role: primary
    depends_on: [catalog]
    source:
      path: services/checkout
    runtime:
      mode: managed
      base_url: http://localhost:8082
      readiness_probe:
        method: GET
        path: /actuator/health
        expect_status_lt: 500
      commands:
        build: "mvn -q -DskipTests package"
        start: "java -jar target/checkout.jar --server.port=8082"
        stop: "pkill -f checkout.jar || true"
---

# Notes
Human-readable deployment and review notes can live here.
```

## Required Fields

| Field | Required | Description |
|---|:---:|---|
| `schema_version` | Yes | Must be `autotestflow.sut-manifest.v1`. |
| `suite.id` | Yes | Stable suite identifier for reports. |
| `suite.output_dir` | No | Root output directory. Defaults to `analysis_output/`. |
| `suite.defaults` | No | Defaults such as `knowledge_domain` inherited by targets. |
| `targets[].id` | Yes | Stable target id. Allowed characters: letters, digits, `_`, `.`, `-`. |
| `targets[].name` | No | Human-readable target name. Defaults to `id`. |
| `targets[].role` | No | Target role, such as `primary`, `dependency`, or `supporting`. |
| `targets[].source.path` | Yes | Source tree path. Relative paths resolve from the manifest file directory. |
| `targets[].runtime.mode` | Yes | `predeployed` or `managed`. |
| `targets[].runtime.base_url` | Yes | Base URL used by contract probing and pytest execution. |
| `targets[].runtime.readiness_probe` | Yes | `{method, path, expect_status_lt}` readiness request. |

## Optional Fields

| Field | Description |
|---|---|
| `targets[].depends_on` | Target ids that should be prepared before this target. Dependency metadata controls startup/readiness ordering and report grouping; it does not create cross-target assertions. |
| `targets[].runtime.commands` | Optional `build`, `start`, and `stop` shell commands for managed targets. Commands are never run unless orchestration has explicit human confirmation and passes `--allow-commands`. |
| `targets[].probes` | Target-specific contract probes. If omitted, `probe_contract.py` uses the existing A2A example probes as a legacy fallback. |
| `targets[].knowledge_domain` | Overrides suite-level knowledge domain for this target. |
| `targets[].remediation.config_path` | Target-local remediation config. If omitted, AutoTestFlow may look for `targets/<target_id>/remediation.config.json`. |

## Normalized Artifact Layout

`scripts/sut_manifest.py --sut-manifest <path> --write` produces:

```text
<output_dir>/
├── .state/sut_manifest.normalized.json
├── report.md
└── targets/
    └── <target_id>/
        ├── contract.md
        ├── test_design.json
        ├── case_results.json
        ├── report.md
        └── .state/
            ├── contract_samples.json
            ├── sut_ready.json
            ├── results/
            └── trace/
```

Each target keeps its own `contract.md`; contracts must not be merged across
targets. Strong executable assertions remain contract-first and must cite the
target-local contract.
