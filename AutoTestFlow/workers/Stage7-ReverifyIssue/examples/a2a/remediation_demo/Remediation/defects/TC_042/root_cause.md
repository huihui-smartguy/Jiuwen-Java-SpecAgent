# 根因分析 — TC_042 (SPEC-ID-TYPE / F-HIST-001)

- 入口：`A2aJsonRpcController.handle` 以 `int id` 调用 `new JsonRpcResponse(id, result)`。
- 缺陷：`JsonRpcResponse` 构造器原样保存 `id`（int），响应序列化为数字。
- 契约：`SPEC-ID-TYPE`（spec-required）要求响应 `id` 以字符串回带且等于请求 id（对齐历史缺陷 `F-HIST-001`）。
- 修复：构造器内将 `id` 归一为字符串（`String.valueOf`）。
- 文件：`src/main/java/com/example/a2a/JsonRpcResponse.java#<init>`。
