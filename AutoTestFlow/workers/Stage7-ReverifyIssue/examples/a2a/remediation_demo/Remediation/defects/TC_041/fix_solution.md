# 修复方案 — TC_041

## 代码修复
- 在 `TaskService.handle` 中增加 `AgentRegistry.exists(agentId)` 校验。
- 当 `metadata.agentId` 不存在时返回 `TaskResult("FAILED")`，避免无效关联资源被误判为成功任务。

## 契约对齐
- 对齐 `SPEC-RESP-WRAP` 的 spec-required 终态字段：`result.task.status.state`。
- 对齐故障库 `F-REQ-011`：不存在的关联资源不得继续执行为成功终态。

## 复验方案
- 重跑黑盒用例 `TC_041`，期望从 `sdk_defect` 转为 `passed`。
- 新增开发仓回归自测 `TaskServiceAgentIdIT`，守护不存在 agentId 返回 `FAILED`。
