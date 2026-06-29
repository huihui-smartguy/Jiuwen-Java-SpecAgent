# 修复配置文件 schema（remediation.config.json，v2.0）

> 声明**被测对象(SUT)与其代码仓**，供 auto-remediation（stage6/7）使用。JSON 格式（与
> `s2_code_facts.json`/`fault_matches.json` 一致）。解析顺序：`--remediation-config <path>` →
> `<output_dir>/remediation.config.json` → `<work_dir>/.autotestflow/remediation.config.json`。
> 缺失即等同 `--remediate=off`（跳过 stage6/7）。模板见 `examples/remediation.config.example.json`。

## 字段

| 段 | 字段 | 必填 | 说明 |
|----|------|:---:|------|
| `sut` | `base_url` | ✅ | 被测服务基址（应与 stage4 的 `--sut-base-url` 一致；复验重启后据此探活+重跑） |
| `sut` | `readiness_probe` | | `{method,path,expect_status_lt}` 就绪探针 |
| `repo` | `upstream_url` | ✅ | 上游代码仓（issue 在此开；PR base 在此）。本地路径亦可（离线/自测） |
| `repo` | `ref` | ✅ | SUT 构建所用的 tag/branch/sha（如 `v0.1.0`），复验基线 |
| `repo` | `fork_url` | ✅ | **你有写权限**的 fork（fix 分支推到此；PR head=fork） |
| `repo` | `fork_remote_name` | | 远程名，默认 `fork` |
| `repo` | `clone_path` | ✅ | 克隆/物化目录（相对 output_dir；**gitignore**，不入库） |
| `repo` | `business_code_roots` | | 业务码根（补丁白名单），默认 `["src/main"]` |
| `repo` | `selftest_roots` | | 自测根（回归补丁白名单），默认 `["src/test"]` |
| `repo` | `default_branch` | | 上游默认分支，默认 `main` |
| `build` | `tool` | | `maven`/`gradle` |
| `build` | `build_cmd` | | 构建命令（业务码）；非零退出 → 停在提交前（无绿不开 PR） |
| `build` | `selftest_cmd` | | 运行新增回归自测的命令（须通过） |
| `build` | `workdir` | | 相对 clone_path 的构建工作目录，默认 `.` |
| `run` | `restart_cmd` | | （重）启动重建后的 SUT |
| `run` | `stop_cmd` | | 幂等停止（重启前先停） |
| `run` | `restart_in_background` | | 默认 true |
| `run` | `readiness_timeout_sec` | | 就绪轮询超时，默认 60 |
| `pr` | `branch_prefix` | | 分支前缀，默认 `autotestflow/fix` |
| `pr` | `target_branch` | | 上游 PR 目标分支，默认同 `default_branch` |
| `pr` | `labels` / `draft` | | PR 标签 / 是否草稿（默认 `draft:true`，安全） |
| `issue` | `labels` | | issue 标签 |
| `switches` | `allow_push` / `allow_open_pr` / `allow_open_issue` | | **文件级第二层保险**（默认全 false）：动作执行 ⟺ `--remediate=on`+过门+对应 allow=true |
| `switches` | `require_green_before_pr` | ✅ | **必须为 true**（加载时断言；杜绝绕过"绿前提"自我认证） |
| `reverify` | `simulate` | | true=离线/fixture：跳过重启/pytest，用 `simulated_after`（默认 false=真实 live） |
| `reverify` | `simulated_after` | | `{case_id: "passed"|...}`（仅 simulate 模式） |

## 安全约定

- 配置**不含任何 token 字段**；GitHub 鉴权一律走 ambient `gh auth`/`GH_TOKEN`。
- `require_green_before_pr=false` 会被 `reference/remediation_config.py` 直接拒绝加载。
- `clone_path`/复验轨迹由 `.gitignore` 排除（`**/.state/remediation/repo/`、`**/.state/remediation/trace/`）。
