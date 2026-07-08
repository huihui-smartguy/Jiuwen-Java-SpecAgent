# AutoTestFlow · Worker-Local Supervisor Pipeline

AutoTestFlow is a Claude Code Skill for requirement-driven test generation. The
public interface remains a single command, while implementation assets now live
under `AutoTestFlow/workers/`.

```bash
/auto-test-flow requirements.md --sut-manifest autotestflow.suts.md --remediation-config remediation.config.json --faults on --fault-enrich on --remediate on
```

## 默认全链路命令（推荐）

首次运行先复制 Worker-local starter，并按本地 SUT 编辑：

```bash
cp AutoTestFlow/workers/Stage0-SutManifest/examples/quickstart/autotestflow.suts.md .
cp AutoTestFlow/workers/Stage0-SutManifest/examples/quickstart/remediation.config.json .
```

可选输入校验：

```bash
python AutoTestFlow/workers/Stage0-SutManifest/scripts/sut_manifest.py --sut-manifest autotestflow.suts.md
python AutoTestFlow/workers/_common/reference/remediation_config.py --check remediation.config.json
```

推荐全链路调用：

```bash
/auto-test-flow requirements.md --sut-manifest autotestflow.suts.md --remediation-config remediation.config.json --faults on --fault-enrich on --remediate on
/auto-test-flow 需求.md --sut-manifest autotestflow.suts.md --remediation-config remediation.config.json --faults on --fault-enrich on --remediate on
```

参考文件：

- `AutoTestFlow/workers/Stage0-SutManifest/examples/quickstart/autotestflow.suts.md`
- `AutoTestFlow/workers/Stage0-SutManifest/examples/quickstart/remediation.config.json`
- `AutoTestFlow/workers/Stage0-SutManifest/shared/sut_manifest_schema.md`
- `AutoTestFlow/workers/Stage6-FaultAnalysis/shared/remediation_config_schema.md`

---

## Quickstart

```bash
cp AutoTestFlow/workers/Stage0-SutManifest/examples/quickstart/autotestflow.suts.md .
cp AutoTestFlow/workers/Stage0-SutManifest/examples/quickstart/remediation.config.json .
```

Edit `requirements.md`, `autotestflow.suts.md`, and `remediation.config.json`,
then run optional validation:

```bash
python AutoTestFlow/workers/Stage0-SutManifest/scripts/sut_manifest.py --sut-manifest autotestflow.suts.md
python AutoTestFlow/workers/_common/reference/remediation_config.py --check remediation.config.json
```

References:

- SUT starter: `workers/Stage0-SutManifest/examples/quickstart/autotestflow.suts.md`
- SUT schema: `workers/Stage0-SutManifest/shared/sut_manifest_schema.md`
- remediation starter: `workers/Stage0-SutManifest/examples/quickstart/remediation.config.json`
- remediation schema/example: `workers/Stage6-FaultAnalysis/shared/remediation_config_schema.md`, `workers/Stage6-FaultAnalysis/examples/remediation.config.example.json`

## Architecture

`SKILL.md` is the compact Supervisor. It parses the command, chooses the mode,
dispatches Workers, validates artifacts, and applies human gates. Detailed stage
procedures and executable assets are owned by Workers:

```text
AutoTestFlow/
├── SKILL.md
├── DESIGN.md
├── workers/
│   ├── _common/
│   │   ├── scripts/
│   │   ├── shared/
│   │   └── reference/
│   ├── Stage0-SutManifest/
│   ├── Stage1-RequirementAnalysis/
│   ├── Stage2-CodeAnalysisContract/
│   ├── Stage26-KnowledgeMatch/
│   ├── Stage3a-ScenarioEnrichment/
│   ├── Stage3b-TestDesign/
│   ├── Stage4-TestGenerationRun/
│   ├── Stage5-Report/
│   ├── Stage6-FaultAnalysis/
│   └── Stage7-ReverifyIssue/
└── tests/
```

Root `templates/`, `scripts/`, `shared/`, `reference/`, `examples/`, and `beta/`
are no longer canonical execution directories. Worker-local paths are the source
of truth.

## Flow

```text
requirements.md + SUT manifest + TestKnowledgeBase + remediation.config.json
  -> Stage0  SUT manifest parse/normalize
  -> Stage1  requirement-side FP/FS/scenario analysis
  -> per target:
       Stage2  code analysis, then contract calibration
       Stage26 TestKnowledgeBase matching, enrichment, advisory gates
       Stage3a scenario enrichment
       Stage3b test design
       Stage4 black-box generation, execution, trace, aggregation
       Stage5 target report and knowledge recording
       Stage6 optional fault analysis and remediation planning
       Stage7 optional apply, rebuild, reverify, gated evidence issue
  -> root report
```

`Stage2-CodeAnalysisContract` intentionally owns original stage2 + stage2.5:
source facts are produced first, then `Contract/contract.md` is generated
immediately afterward. `Contract/contract.md` remains the only strong executable
Oracle.

## Modes

| Mode | Trigger | Output |
|------|---------|--------|
| Standard | `--sut-manifest` or compatible SUT/runtime inputs | target-local contract, executable tests, traces, reports, optional remediation evidence |
| Requirement-only | no runnable/source SUT input | test design artifacts with `needs-runtime-verify` assertions |

## Deprecated compatibility

Legacy single-target inputs such as `--sut-base-url` remain compatibility shims
and normalize into the manifest flow. New documentation and Worker-local assets
use `--sut-manifest` as the primary invocation model.

## Core Rules

- All executable stage assets are under `AutoTestFlow/workers/`.
- Output artifacts and public invocation are unchanged.
- Supervisor does not read large source, test design, trace, or report bodies.
- Stage4 tests use the Worker-local black-box harness under `Stage4-TestGenerationRun/reference/`.
- TestKnowledgeBase remains an external knowledge source; prompt-hardcoded knowledge is not introduced.
- Stage7 external issue submission requires both the human gate and `switches.allow_open_issue=true`.

## Validation

```bash
python3 -m unittest discover AutoTestFlow/tests
```

The test suite includes path and behavior coverage for Worker-local scripts,
manifest normalization, code scan planning, fault matching, design merging,
fault-oracle aggregation, and dry-run remediation.
