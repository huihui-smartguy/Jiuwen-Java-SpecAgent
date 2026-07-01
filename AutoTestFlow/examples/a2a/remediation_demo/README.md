# a2a remediation_demo —— auto-remediation 的确定性自测 fixture

本目录是 `remediation_plan.py` / `apply_and_reverify.py` / `submit_remediation.py` 的**可复现自测样例**，
**无需真实 SUT / 真实代码仓 / gh 鉴权**：用手工裁剪的 a2a 形态 `contract.md` + 2 条 `sdk_defect`
结果 + 内置 `fake_repo/`（两处契约违例的 seeded bug），端到端演示
"fault analysis → 应用补丁 → 本地重建复验 → evidence issue 提交（dry-run）"。

## 目录内容（输入 fixture）

```
contract.md                                  # 权威性分级表（SPEC-RESP-WRAP / SPEC-ID-TYPE 为 spec-required）
case_results.json                            # 2 条 sdk_defect（TC_041 / TC_042）
remediation.config.json                      # 修复配置：upstream=fake_repo, reverify.simulate=true, allow_open_issue=false
fake_repo/                                    # 内置极小 Maven 仓（plain dir，运行时物化为 git 基线）
├── src/main/java/com/example/a2a/
│   ├── TaskService.java                      #   seeded bug(TC_041)：不存在 agentId 仍 COMPLETED
│   ├── JsonRpcResponse.java                  #   seeded bug(TC_042)：id 以 int 回带
│   └── A2aJsonRpcController.java / TaskResult / AgentRegistry
└── src/test/java/com/example/a2a/SmokeTest.java
.state/results/TC_041.json / TC_042.json     # sdk_defect{spec_id,field,expected,actual} + fault_ref
.state/trace/TC_041.jsonl / TC_042.jsonl     # 证明 actual 的请求/响应帧
.state/s2_code_facts.json                    # entry_catalog → source_file（定位业务码）
.state/fault_matches.json                    # F-REQ-011 / F-HIST-001 的 oracle_refs（规格库知识）
.state/fault_analysis/analysis_plan.json     # stage6 通用分析计划（运行 remediation_plan.py 后生成）
.state/remediation/defects/<case>/           # 模拟 stage6 patchable 子 Agent 产出（golden 输入）：
                                             #   patch.diff(业务) / regression_test.diff(自测) / issue.md / root_cause.md / evidence.json / fix_solution.md / confidence.json
```

## 复现命令（在仓库根）

```bash
# 1) 深析前处理：结果 + 故障匹配 → fault_analysis plan + patchable remediation worklist
python AutoTestFlow/scripts/remediation_plan.py --output-dir AutoTestFlow/examples/a2a/remediation_demo

#   （真实流程：编排器据 analysis_plan.json 对每个目标启动 stage6 子 Agent；
#     本 fixture 已附 golden defects/，直接进入下一步）

# 2) 汇总 → manifest（强制确认门读取的门面小文件）
python AutoTestFlow/scripts/remediation_plan.py --output-dir AutoTestFlow/examples/a2a/remediation_demo --finalize

# 3) 应用补丁 + 本地重建 + 复验（绿门）：物化 fake_repo → git apply → no-op 构建 → 模拟转绿
python AutoTestFlow/scripts/apply_and_reverify.py --output-dir AutoTestFlow/examples/a2a/remediation_demo

# 4) evidence issue 提交（dry-run）：零 gh 调用
python AutoTestFlow/scripts/submit_remediation.py --output-dir AutoTestFlow/examples/a2a/remediation_demo --remediate dry-run
```

## 预期产物（已附 golden）

- `.state/fault_analysis/analysis_plan.json` —— stage6 通用分析计划（含 patchable_contract_defect 目标）。
- `.state/remediation/plan.json` —— 2 条 patchable contract defect worklist（TC_041 SPEC-RESP-WRAP / TC_042 SPEC-ID-TYPE）。
- `.state/remediation/manifest.json` —— 门面摘要：2 defects，localizable 2，needs_human 0。
- `.state/remediation/reverify.json` —— `repo_method=materialized`、两条 `patch.diff` 真实 `git apply` 成功、
  `remediated=[TC_041,TC_042]`、`still_red=[]`、`branch=autotestflow/fix/TC_041-TC_042`。
- `.state/remediation/submitted.json` —— `mode=dry-run`，issue 跳过（**零 gh 调用**）。
- `.state/remediation/repo/`、`.state/remediation/trace/` —— 运行期物化的代码仓与轨迹（**已 gitignore，不入库**）。

> golden 文件随仓库提交，便于 review 与回归对比；重跑上述命令应得到一致结果（无时间戳，可复现）。

## 安全/边界自测（可手动验证）

- **第二层保险**：`--remediate on --gate-confirmed` 但配置 `switches.allow_open_issue=false` → 仍**零 gh 调用**，
  `submitted.json` 记 issue 跳过。
- **实证前提红线**：把 `switches.require_evidence_before_issue` 改成 `false` → 配置加载即被拒绝（ConfigError）。
- **显式关闭回归**：真实流程中传入 `--remediate=off` → 不进入 stage6/7，不产 `.state/remediation/`。

> **真实 live 路径**（`reverify.simulate=false`：真克隆 + `mvn/gradle` 构建 + SUT 重启 + pytest 重跑 +
> `gh issue` 提交 evidence issue）仅在用户用真实仓 + 构建工具链 + `gh` 鉴权运行 `--remediate=on` 且过门时走通；
> 本 fixture 用 `simulate=true` + no-op 命令离线验证编排与产物形态。
