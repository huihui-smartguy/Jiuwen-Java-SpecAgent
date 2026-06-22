# [spec-violation] SPEC-ID-TYPE: 响应 id 以数字回带而非字符串

## 摘要
请求 `id="1"`（字符串），响应回带 `id=1`（数字），违反 id 类型契约。

## (a) 规格库 / 契约依据（根据规格库哪些知识）
- 契约 `contract.md` §2/§7：`SPEC-ID-TYPE`（字段 `id`）权威性 = **spec-required**（响应回带类型 string）。
- 故障库历史缺陷 `F-HIST-001`「响应id字段类型不一致（int vs string）」：
  - validation_point：「响应 id 字段类型 === 'string' 且 == 请求 id」

## (b) 实测结果（哪些实测结果）
- 用例 `TC_042`（class=`sdk_defect`），trace `.state/trace/TC_042.jsonl`：
  - 请求：`id="1"`（JSON 字符串）。
  - 响应：`id=1`（JSON 数字，HTTP 200）。
- 期望 `响应 id 以字符串类型回带（== 请求 id '1'）` vs 实际 `数字 1（int）`。

## 结论（推断该 bug 的正确性）
该字段为 **spec-required**，且命中历史缺陷 `F-HIST-001`（曾以 `TC-A2A-001` 暴露），
判定为**真实业务缺陷**。定位 `src/main/java/com/example/a2a/JsonRpcResponse.java#<init>`
（id 未归一为字符串）。修复见关联 PR（含回归自测 `JsonRpcResponseIdTypeIT`）。
