# 阶段6 子Agent：单个可修复 contract defect 的深度分析 + 修复产出

> 本模板由编排器对 `Remediation/plan.json` 中**每个 patchable contract defect** 各启动一个子 Agent
>（`run_in_background=True`）。通用/未来故障模式使用 `templates/stage6_fault_analyze.md`。
> 只读分析 + 产出文件，**不做任何外发副作用**（issue 提交由 stage7 在强制门后执行；PR 自动提交已移除）。
> 红线见 `shared/remediation_rules.md`：契约唯一权威、修 SUT 使其符合契约、**绝不弱化测试洗绿**。

## 输入（编排器替换；均为指针，禁止回灌大文件）

- 缺陷：`case_id={case_id}` `spec_id={spec_id}` `field={field}`
- 期望/实际：`expected={expected}` `actual={actual}`
- 证据：`trace_file={trace_file}` `oracle_refs={oracle_refs}` `fault_ref={fault_ref}` `fault_oracle_summary={fault_oracle_summary}`
- 路径：`output_dir={output_dir}` `clone_path={clone_path}` `contract_path={contract_path}`
- 代码根：`business_code_roots={business_code_roots}` `selftest_roots={selftest_roots}`

## 你要自行读取的文件（按需，命名读取，勿全量回灌）

1. `{contract_path}` —— 违例 `spec_id` 所在行 + §7「字段权威性分级表」。**只有 spec-required 违例才修**。
2. `{output_dir}/TestRun/results/{case_id}.json` —— `sdk_defect{spec_id,field,expected,actual}`；若有 `fault_oracle_summary`，同时读取 required oracle 的失败/不可观察明细。
3. `{output_dir}/{trace_file}` —— 真实请求/响应/SSE 帧；摘录**触发请求** + **证明 actual 的响应帧**。
4. `{output_dir}/KnowledgeBase/fault_matches.json` —— 若 `fault_ref` 命中：取其 `fault_id/name/severity`、
   `oracle_refs[].validation_point`、`expected_behavior_raw`（**规格库知识**半边证据）。
5. `{output_dir}/FeatureAnalysis/s2_code_facts.json` —— `entry_catalog[].source_file/class/method` 定位业务码。
6. `{clone_path}` 下的**真实源码** —— 用 Grep/Read 跟踪 `source_file` 与调用链，定位根因。

## 步骤

1. **判真伪**：核对 `{contract_path}` §7，确认 `spec_id` 权威性=spec-required。若为
   deployment-config-dependent / needs-runtime-verify → 非可修缺陷：写 `confidence.json`
   置 `needs_human=true, localizable=false`，写 `root_cause.md`/`issue.md`（仍可记 issue），**不产 patch**。
2. **定位**：依据 s2_code_facts + 源码定位违例的业务代码位置（类/方法/文件）。定位不到 →
   同上置 `needs_human=true` 且不产 patch（允许后续 issue，不强行改码）。
3. **业务修复 `patch.diff`**：对 `{clone_path}` 生成 unified diff（`git diff` 形态，`a/`、`b/` 前缀），
   **仅触及 `business_code_roots`**。修复方向：让 SUT 行为符合 `{contract_path}` 的 spec-required 形态。
4. **回归自测 `regression_test.diff`**：在 `selftest_roots` **新增**一个开发仓自测（修前红/修后绿），
   断言引用契约/`validation_point`。**禁止**修改/删除既有测试断言来制造通过。
5. **issue.md（强制两段证据）**：
   - (a) **规格库/契约知识**：引 `{contract_path}` 的 `spec_id`(spec-required) + 字段；若有 `fault_ref` 引
     `fault_id/name` + `validation_point` + `expected_behavior_raw`。
   - (b) **实测结果**：引 `{case_id}` + trace 的触发请求与违例响应帧 + `expected` vs `actual`；若是 fault oracle 触发的 `sdk_defect`，明确写出失败的 oracle id/check/kind。
   - 结论：为何是**真实** spec-required 违例（非 sut_unsatisfied/config-dependent），及代码定位。
6. **evidence.json**：结构化记录 contract 引用、fault_ref、trace 摘录、源码定位、patch/selftest 摘要。
7. **fix_solution.md**：修复方案说明，含代码改动点、为什么符合 contract、复验方式。
8. **issue.md（issue-only）**：正文不得引用“关联 PR”；必须包含修复方案与待 stage7 回填的实证复验位置。
9. **confidence.json**：
   `{target_id,case_id,spec_id,fault_id,analysis_type,domain,evidence_level,recommended_action,publishable,patchable,localizable,confidence(high|medium|low),files_touched[],adds,dels,needs_human,issue_title,reason}`。

## 输出与返回

- 写入目录：`{output_dir}/Remediation/defects/{case_id}/`
  （`root_cause.md`、`evidence.json`、`fix_solution.md`、`patch.diff`(可选)、`regression_test.diff`(可选)、`issue.md`、`confidence.json`）。
- **仅返回一行摘要**（禁止回灌 diff/JSON 全文）：
  `[stage6:{case_id}] localizable=<bool> confidence=<lvl> files=<n> needs_human=<bool>`

## 红线（必须遵守）

- 契约 `{contract_path}` 是**唯一 Oracle**；只修 SUT 业务码/新增自测使其符合契约。
- **禁止**改/删 AutoTestFlow 生成的 pytest、`{contract_path}`、既有自测断言来"洗绿"。
- 找不到 specId 或定位不到 → 保留观察、产 issue、**不产 patch**（`needs_human=true`）。
- `patch.diff` 越出 `business_code_roots`、`regression_test.diff` 越出 `selftest_roots` →
  会被 `apply_and_reverify.py` 路径白名单拒绝，故务必遵守。
