# 修复方案 — TC_042

## 代码修复
- 在 `JsonRpcResponse` 构造响应时保留请求 `id` 的字符串形态。
- 禁止把字符串请求 id 强制转换为数字，确保响应 id 与请求 id 类型和值一致。

## 契约对齐
- 对齐 `SPEC-ID-TYPE` 的 spec-required 约束：响应 id 应按请求 id 原样字符串回带。
- 对齐历史故障 `F-HIST-001`：响应 id 字段类型不一致会破坏调用方幂等追踪。

## 复验方案
- 重跑黑盒用例 `TC_042`，期望从 `sdk_defect` 转为 `passed`。
- 新增开发仓回归自测 `JsonRpcResponseIdTypeIT`，守护字符串 id 不被数值化。
