# [auto-remediation] 修复 contract 违例（SPEC-RESP-WRAP / SPEC-ID-TYPE）

本 PR 由 AutoTestFlow auto-remediation 生成，修复 stage4 黑盒测试发现的 `sdk_defect`
（contract 背书的真实违例）。每条变更均附"规格库知识 + 实测结果"推断，详见关联 issue。

## 变更
- `TaskService.handle`：不存在的 `agentId` 终态置 `FAILED`（SPEC-RESP-WRAP / F-REQ-011）。
- `JsonRpcResponse`：`id` 一律以字符串回带（SPEC-ID-TYPE / F-HIST-001）。
- 新增回归自测 `TaskServiceAgentIdIT` / `JsonRpcResponseIdTypeIT`。

## 复验证据（本地重建后重跑失败用例）
<!-- before/after 由 stage7 apply_and_reverify 依据 reverify.json 回填；未转绿不得开 PR -->
- 修复前：TC_041 / TC_042 = sdk_defect（红）
- 修复后：TC_041 / TC_042 = passed（绿）

> 注：本 PR 由门控的 auto-remediation 在人工确认后提交；断言未被弱化，绿由重跑未改动的黑盒用例判定。
