# [spec-violation] SPEC-RESP-WRAP: 不存在的 agentId 返回 COMPLETED 而非 FAILED

## 摘要
`SendMessage` 携带不存在的 `metadata.agentId` 时，任务终态返回 `COMPLETED`，契约要求 `FAILED`。

## (a) 规格库 / 契约依据（根据规格库哪些知识）
- 契约 `contract.md` §1/§7：`SPEC-RESP-WRAP`（字段 `result.task.status.state`）权威性 = **spec-required**。
- 故障库 `F-REQ-011`「引用不存在的关联资源」（severity=高）：
  - expected_behavior：「应返回错误响应或终态 FAILED，不执行无效操作」
  - validation_point：「不存在的关联资源应终态 FAILED」

## (b) 实测结果（哪些实测结果）
- 用例 `TC_041`（class=`sdk_defect`），trace `.state/trace/TC_041.jsonl`：
  - 请求：`POST /a2a` SendMessage，`metadata.agentId="nonexistent-7f3a"`，`id="1"`。
  - 响应：`result.task.status.state = "COMPLETED"`（HTTP 200）。
- 期望 `终态 FAILED（不存在的 agentId 不应成功）` vs 实际 `COMPLETED`。

## 结论（推断该 bug 的正确性）
该字段为 **spec-required** 且 `contract.md` 形态明确，违例非"部署配置/有意实现差异"，
判定为**真实业务缺陷**。定位 `src/main/java/com/example/a2a/TaskService.java#handle`
（未校验 agentId 存在性）。修复方案见 `fix_solution.md`，实证复验由 stage7 写入 issue body。
