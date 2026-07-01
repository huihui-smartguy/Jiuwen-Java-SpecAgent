# 根因分析 — TC_041 (SPEC-RESP-WRAP / F-REQ-011)

- 入口：`A2aJsonRpcController.handle` → `TaskService.handle(agentId, text)`。
- 缺陷：`TaskService.handle` 未校验 `agentId` 是否存在，对任意 agentId 一律 `new TaskResult("COMPLETED")`。
- 契约：`SPEC-RESP-WRAP`（spec-required）要求不存在的关联资源终态为 `FAILED`（对齐故障库 `F-REQ-011`）。
- 修复：注入 `registry.exists(agentId)` 校验，不存在 → `TaskResult("FAILED")`。
- 文件：`src/main/java/com/example/a2a/TaskService.java#handle`。
