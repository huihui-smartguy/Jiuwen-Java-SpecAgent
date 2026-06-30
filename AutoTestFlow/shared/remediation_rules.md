# auto-remediation / fault-analysis 安全纪律（v2.1）

> Stage6 fault analysis + Stage7 应用/复验/evidence issue 必须遵守的红线。本文件与
> `shared/rules.md` §4「执行边界五分类」一脉相承：**契约唯一权威、不自我认证、不洗绿**。

## 1. 分析边界：fault_analysis 可扩展，patch 仅限 contract defect

- Stage6 可为 `sdk_defect`、带 `fault_ref` 的故障导向结果、DFX/安全/前端/Agent/未来 profile 生成
  `.state/fault_analysis/` 诊断证据。
- 只有 `class==sdk_defect` 且违例字段为 **spec-required** 的真实 contract defect 进入 patch/reverify 子集。
- `sut_unsatisfied`（SUT 当前不满足/有意差异）、`harness_defect`（AutoTestFlow 自身脚本，已在 stage4
  有界修复）、`env_issue`（环境）**绝不**触发对业务仓的改动。
- 二次校验：stage6 复核 `contract.md` §7，违例字段须为 **spec-required**；否则降为 needs_human（仅记 issue）。

## 2. 修向契约，绝不洗绿（不自我认证）

- 修复只改 **SUT 业务代码**（`business_code_roots`）使其符合 `contract.md` 的真实形态。
- **禁止**：弱化/删除 AutoTestFlow 生成的黑盒 pytest 断言、修改 `contract.md`、改/删开发仓既有自测断言。
- 回归自测只能**新增**（`selftest_roots`），用于守护修复；不得以改测试制造通过。
- **绿由机器判定**：`apply_and_reverify.py` 重跑**未改动**的失败黑盒用例 + **重建后**的 SUT，转绿才算修复；
  LLM 不得自行宣布"修好了"。`switches.require_evidence_before_issue` 恒为 true（兼容旧
  `require_green_before_pr`，加载即断言，不可关闭）。

## 3. 定位不了就不改（可降级为只记 issue）

- 若无法在源码中定位违例根因，或违例不对应 spec-required → `confidence.needs_human=true`、不产 `patch.diff`。
- 此时仍产出 `issue.md` / `evidence.json` / `fix_solution.md`，满足"提 evidence issue"，但不强行改码。

## 4. 路径白名单（`apply_and_reverify.py` 强制）

- `patch.diff` 受影响路径必须全部在 `business_code_roots` 内；越界 → `applied=rejected_path`，跳过。
- `regression_test.diff` 必须全部在 `selftest_roots` 内（且为新增）。
- 任一缺陷应用/构建/复验失败 → 落 `reverify.json`，issue 中如实呈现实证结果，不抛栈、不影响其它缺陷。

## 5. 门控与最小影响面

- 总开关 `--remediate`（默认 `off`）；`on` 时 stage7 前**强制人工确认门**（`AskUserQuestion`）。
- 配置 `switches.allow_open_issue` 为文件级第二层保险：issue 提交 ⟺ `on`+过门+`allow_open_issue=true`。
- 自动 PR 提交已移除：stage7 不推送 fork、不创建 PR；issue body 必须包含修复方案与实证复验证据。
- `--remediation-max-defects` 限单轮 patch 影响面；逐缺陷 issue，便于评审。
- 不读/打印 token（鉴权用 ambient `gh auth`/`GH_TOKEN`）；克隆出的代码仓与运行轨迹 gitignore，不入库。
