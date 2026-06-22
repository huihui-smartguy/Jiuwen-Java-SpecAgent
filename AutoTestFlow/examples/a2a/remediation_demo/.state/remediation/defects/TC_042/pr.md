# [auto-remediation] 修复 SPEC-ID-TYPE：响应 id 归一为字符串

修复 `JsonRpcResponse` 构造器，将回带 `id` 归一为字符串（SPEC-ID-TYPE / F-HIST-001）。

## 复验证据（本地重建后重跑失败用例）
<!-- before/after 由 stage7 apply_and_reverify 回填 -->
- 修复前：TC_042 = sdk_defect（红）
- 修复后：TC_042 = passed（绿）
