# SUT Description and Manifest Schema

AutoTestFlow now treats `autotestflow.suts.md` as a natural-language SUT
description by default. Users can describe components, URLs, ports,
environment variables, dependencies, and whether each service is already
available or must be built/started. AutoTestFlow Stage 0 converts that document
into the canonical `autotestflow.sut-manifest.v1` shape, validates it
deterministically with `scripts/sut_manifest.py`, and writes the normalized
manifest consumed by later stages.

Existing Markdown files with YAML front matter remain fully compatible.

## Preferred Natural-Language Format

```markdown
# Test Environment

[Catalog API]
ip: 127.0.0.1
port: 8081
Accessible directly
Environment variables: CATALOG_REGION

[Checkout API]
Source path: services/checkout
URL: http://localhost:8082/actuator/health
Requires creation in conjunction with Catalog API
Build: mvn -q -DskipTests package
Start: java -jar target/checkout.jar --server.port=8082
Stop: pkill -f checkout.jar || true
Environment variables: CHECKOUT_TOKEN=<provided at runtime>
```

Stage 0 writes:

```text
<output_dir>/
└── RunMetadata/
    ├── sut_description.parse.json
    ├── sut_description.review.md
    └── sut_manifest.normalized.json
```

Review is required when AutoTestFlow infers managed build/start commands,
detects low-confidence or missing fields, or cannot resolve dependencies. Direct
already-running targets with a clear base URL can continue automatically. Managed
commands still require the existing runtime `--allow-commands` confirmation.

Secret-like environment variable values are redacted in parse/review artifacts.

## Compact Paired Natural-Language Format

For short multi-SUT descriptions, Stage 0 also supports a paired-list sentence
when the number and order of module names, environment URLs, and optional source
paths match:

```markdown
The modules tested here are catalog_api and checkout_api, with corresponding
test environments at http://127.0.0.1:8081 and http://127.0.0.1:8082, and their
corresponding source code paths at services/catalog and services/checkout,
respectively.
```

This is normalized as two targets:

| target | base_url | source.path |
|---|---|---|
| `catalog_api` | `http://127.0.0.1:8081` | `services/catalog` |
| `checkout_api` | `http://127.0.0.1:8082` | `services/checkout` |

Because the parser infers target ordering and roles from prose, the parse review
records `paired_list_targets_inferred_requires_review` and
`role_inference_requires_review`. Prefer bracketed sections when a target has
commands, dependencies, LLM config, probes, or non-obvious roles.

## Canonical Manifest Shape

The parser validates the canonical shape below. LLM-produced candidate manifests
can be passed through `scripts/sut_manifest.py --candidate-manifest <json>` for
the same deterministic checks.

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
    role: dependency
    source:
      available: false
    runtime:
      mode: predeployed
      base_url: http://localhost:8081
      readiness_probe:
        method: GET
        path: /health
        expect_status_lt: 500
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

# Optional human notes
```

## Required Canonical Fields

| Field | Required | Description |
|---|:---:|---|
| `schema_version` | Yes | Must be `autotestflow.sut-manifest.v1`. |
| `suite.id` | Yes | Stable suite identifier for reports. |
| `suite.output_dir` | No | Root output directory. Defaults to `analysis_output/`. |
| `suite.defaults` | No | Defaults such as `knowledge_domain` inherited by targets. |
| `targets[].id` | Yes | Stable target id. Allowed characters: letters, digits, `_`, `.`, `-`. |
| `targets[].name` | No | Human-readable target name. Defaults to `id`. |
| `targets[].role` | No | Target role, such as `primary`, `dependency`, or `supporting`. |
| `targets[].runtime.mode` | Yes | `predeployed` or `managed`. |
| `targets[].runtime.base_url` | Yes | Base URL used by contract probing and pytest execution. |
| `targets[].runtime.readiness_probe` | Yes | `{method, path, expect_status_lt}` readiness request. |
| `targets[].source.path` | Conditional | Required for managed targets. Direct predeployed targets may set `source.available=false`. |

## Optional Canonical Fields

| Field | Description |
|---|---|
| `targets[].depends_on` | Target ids that should be prepared before this target. Dependency metadata controls startup/readiness ordering and report grouping; it does not create cross-target assertions. |
| `targets[].source.available` | `false` means AutoTestFlow should skip source scan/code-only gap generation for this target and rely on live contract probing when reachable. |
| `targets[].source.remote_url` | Optional fallback repository URL extracted from natural-language descriptions. It is recorded for review and reporting; this iteration does not auto-clone it. |
| `targets[].source.redacted` | `true` when the supplied source path is masked (for example `********`). Redacted paths never make `source.available=true`. |
| `targets[].runtime.commands` | Optional `build`, `start`, and `stop` shell commands for managed targets. Commands are never run unless orchestration has explicit human confirmation and passes `--allow-commands`. |
| `targets[].environment` | Redacted environment variable names, values, and env files inferred from the SUT description. |
| `suite.defaults.environment` | Suite-level redacted config such as `[LLM]` blocks. These values are not target identities. |
| `targets[].probes` | Target-specific contract probes. If omitted, `probe_contract.py` uses the existing A2A example probes as a legacy fallback. |
| `targets[].knowledge_domain` | Overrides suite-level knowledge domain for this target. |
| `targets[].remediation.config_path` | Target-local remediation config. If omitted, AutoTestFlow may look for `targets/<target_id>/remediation.config.json`. |

## Normalized Artifact Layout

`scripts/sut_manifest.py --sut-manifest <path> --write` produces:

```text
<output_dir>/
├── RunMetadata/
│   ├── sut_description.parse.json
│   ├── sut_description.review.md
│   └── sut_manifest.normalized.json
├── FeatureAnalysis/
├── Reports/
│   └── report.md
└── targets/
    └── <target_id>/
        ├── FeatureAnalysis/
        │   ├── code_scan_plan.json
        │   ├── s1_index.json
        │   ├── s1_scenarios/
        │   ├── s2_code_facts.json
        │   ├── stage_summary.json
        │   ├── s3a_enriched/
        │   └── s3a_enriched_index.json
        ├── Contract/
        │   ├── contract.md
        │   ├── contract_samples.json
        │   └── sut_ready.json
        ├── KnowledgeBase/
        │   ├── knowledge_matches.json
        │   ├── fault_matches.json
        │   └── fault_contract_alignment.md
        ├── QualityGates/
        ├── TestCases/
        │   ├── test_design.json
        │   ├── scene_tc_mapping.json
        │   └── e2e_scenes.json
        ├── TestRun/
        │   ├── tests/
        │   ├── results/
        │   ├── trace/
        │   └── case_results.json
        ├── Reports/
        │   └── report.md
        ├── FaultAnalysis/
        └── Remediation/
```

Each target keeps its own `Contract/contract.md`; contracts must not be merged across
targets. Strong executable assertions remain contract-first and must cite the
target-local contract.
