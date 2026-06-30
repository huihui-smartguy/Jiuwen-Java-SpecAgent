# 修复配置文件 schema（remediation.config.json，v2.1）

> 声明**被测对象(SUT)与其代码仓**，供 stage6 fault analysis 与 stage7 本地复验 / evidence issue 使用。
> 解析顺序：`--remediation-config <path>` → `<output_dir>/remediation.config.json`
> → `<work_dir>/.autotestflow/remediation.config.json`。缺失即等同 `--remediate=off`（跳过 stage6/7）。
> 模板见 `examples/remediation.config.example.json`。

## 字段

| 段 | 字段 | 必填 | 说明 |
|----|------|:---:|------|
| `sut` | `base_url` | ✅ | 被测服务基址（应与 stage4 的 `--sut-base-url` 一致；复验重启后据此探活+重跑） |
| `sut` | `readiness_probe` | | `{method,path,expect_status_lt}` 就绪探针 |
| `repo` | `upstream_url` | ✅ | 上游代码仓；stage7 issue 在此仓提交。本地路径亦可（离线/自测） |
| `repo` | `ref` | ✅ | SUT 构建所用的 tag/branch/sha（如 `v0.1.0`），复验基线 |
| `repo` | `clone_path` | ✅ | 克隆/物化目录（相对 output_dir；**gitignore**，不入库） |
| `repo` | `local_branch_prefix` | | 本地复验分支前缀，默认 `autotestflow/fix`；仅用于本地 git apply/commit，不推送 |
| `repo` | `business_code_roots` | | 业务码根（补丁白名单），默认 `["src/main"]` |
| `repo` | `selftest_roots` | | 自测根（回归补丁白名单），默认 `["src/test"]` |
| `repo` | `default_branch` | | 上游默认分支，默认 `main` |
| `build` | `tool` | | `maven`/`gradle` |
| `build` | `build_cmd` | | 构建命令（业务码）；非零退出 → 只记录复验证据，不提交修复成功结论 |
| `build` | `selftest_cmd` | | 运行新增回归自测的命令 |
| `build` | `workdir` | | 相对 clone_path 的构建工作目录，默认 `.` |
| `run` | `restart_cmd` | | （重）启动重建后的 SUT |
| `run` | `stop_cmd` | | 幂等停止（重启前先停） |
| `run` | `restart_in_background` | | 默认 true |
| `run` | `readiness_timeout_sec` | | 就绪轮询超时，默认 60 |
| `issue` | `labels` | | issue 标签 |
| `switches` | `allow_open_issue` | | 文件级第二层保险，默认 false；issue 提交 ⟺ `--remediate=on` + 人工门 + true |
| `switches` | `require_evidence_before_issue` | ✅ | 必须为 true（加载时断言；杜绝绕过实证前提） |
| `switches` | `require_green_before_pr` | | v2.0 兼容别名；本轮仍接受并映射到 `require_evidence_before_issue` |
| `switches` | `allow_push` / `allow_open_pr` | | v2.0 遗留字段；v2.1 忽略，不会推送或创建 PR |
| `reverify` | `simulate` | | true=离线/fixture：跳过重启/pytest，用 `simulated_after`（默认 false=真实 live） |
| `reverify` | `simulated_after` | | `{case_id: "passed"|...}`（仅 simulate 模式） |

## 已废弃字段

- `repo.fork_url`、`repo.fork_remote_name`
- `pr.*`
- `switches.allow_push`、`switches.allow_open_pr`

这些字段在 v2.1 不再驱动任何动作；自动 PR 提交已移除。Stage7 只会在门控通过后提交 evidence issue。

## 安全约定

- 配置**不含任何 token 字段**；GitHub 鉴权一律走 ambient `gh auth`/`GH_TOKEN`。
- `require_evidence_before_issue=false` 会被 `reference/remediation_config.py` 直接拒绝加载。
- `clone_path`/复验轨迹由 `.gitignore` 排除（`**/.state/remediation/repo/`、`**/.state/remediation/trace/`）。
