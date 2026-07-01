# 阶段6 子Agent：通用故障分析目标（fault_analysis）

> 本模板处理 `.state/fault_analysis/analysis_plan.json` 中的单个 target。它是可扩展的诊断模板：
> Web / REST / Agent / DFX 只是初始 profile，后续新增故障模式应通过
> `shared/fault_analysis_profiles.json` 扩展，而不是改写本模板的分支结构。
> 本阶段**只读 + 产文件**，不执行 push / PR / issue 等外发动作。

## 输入（编排器替换；均为指针，禁止回灌大文件）

- 目标：`target_id={target_id}` `case_id={case_id}` `analysis_type={analysis_type}` `domain={domain}`
- 证据：`fault_id={fault_id}` `evidence_level={evidence_level}` `trace_file={trace_file}` `oracle_refs={oracle_refs}` `fault_oracle_summary={fault_oracle_summary}`
- 判据：`spec_id={spec_id}` `contract_authority={contract_authority}` `contract_path={contract_path}`
- 处置：`recommended_action={recommended_action}` `publishable={publishable}` `patchable={patchable}`
- 路径：`output_dir={output_dir}` `analysis_output_dir={analysis_output_dir}` `clone_path={clone_path}`
- 代码根：`business_code_roots={business_code_roots}` `selftest_roots={selftest_roots}`

## 自行读取的文件

1. `{output_dir}/.state/fault_analysis/analysis_plan.json`：读取当前 `target_id` 的完整 target。
2. `{contract_path}`：仅用于确认 specId 权威性；`contract.md` 是唯一 oracle。
3. `{output_dir}/.state/results/{case_id}.json`：若 `case_id` 存在，读取实际执行分类与 expected/actual；若有 `fault_oracle_summary`，读取 required oracle 的失败/不可观察明细。
4. `{output_dir}/{trace_file}`：若存在，摘录触发请求与证明实际结果的响应/事件帧。
5. `{output_dir}/.state/fault_matches.json`：若 `fault_id` 命中，读取故障库 validation point 与 expected behavior。
6. `{output_dir}/.state/s2_code_facts.json` 与 `{clone_path}`：仅当需要定位源码或生成 patch 时读取。
7. `wiki/{fault_id}.md`：若 beta wiki 开启且文件存在，只作 advisory 叙事素材，不作判据。

## 输出文件

写入 `{analysis_output_dir}/`：

- `evidence.json`：结构化证据，至少含 `{target_id,case_id,analysis_type,domain,fault_id,evidence_level,contract_refs,trace_refs,source_refs,decision}`。
- `root_cause.md`：根因或诊断结论；若证据不足，明确缺口。
- `fix_solution.md`：推荐修复方案。可包含代码级建议、配置/运维建议、监控建议或复测建议。
- `issue.md`：可提交 issue 的正文草稿，必须含规格/故障知识、实测证据、修复方案。
- `confidence.json`：`{target_id,case_id,spec_id,fault_id,analysis_type,domain,evidence_level,recommended_action,publishable,patchable,localizable,confidence,files_touched,adds,dels,needs_human,issue_title,reason}`。
- 仅当 `patchable=true` 且 `contract_authority=spec-required` 且源码可安全定位时，额外输出：
  - `patch.diff`：只触及 `business_code_roots`
  - `regression_test.diff`：只在 `selftest_roots` 新增自测

## 分析纪律

1. **判据边界**：故障库、wiki、经验描述均为 advisory；是否缺陷成立只看 `contract.md` + 实测 trace。
2. **可扩展域**：不要假设 domain 只有 Web/REST/Agent/DFX；对未知 domain 使用通用证据链和修复方案结构。
3. **patch 红线**：非 `patchable=true`、非 spec-required、无法定位、或越出白名单时，不产 patch，只产 issue/evidence。
4. **issue 证据**：issue.md 必须写清“为什么这是问题”与“建议怎么修”；若 fault oracle 阻断了 pass，必须列出 oracle id/check/kind 与 trace 证据，但不得声称已经提交 PR。
5. **置信度**：high 需要 contract/trace/source 三者闭环；medium 可缺源码定位；low 表示需要人工补证。

## 返回

仅返回一行摘要：

`[stage6-analysis:{target_id}] domain=<domain> action=<recommended_action> patchable=<bool> publishable=<bool> confidence=<lvl>`
