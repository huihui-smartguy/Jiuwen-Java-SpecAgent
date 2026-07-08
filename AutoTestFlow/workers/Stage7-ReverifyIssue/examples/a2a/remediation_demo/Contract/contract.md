# SUT 契约（权威）— a2a remediation_demo fixture

> 唯一权威 oracle 来源。auto-remediation 判定"是否真实缺陷 / 修向何处"的依据。
> probe_status: reachable    base_url: http://localhost:18080
>
> 注：本文件为 auto-remediation 的确定性自测 fixture（手工裁剪自 a2a 形态），非真实 probe 产物。

## 1. 响应包装（specId: SPEC-RESP-WRAP）
- 业务对象真实路径：`result.task`；终态 `result.task.status.state`

## 2. 请求标识 id 类型（specId: SPEC-ID-TYPE）
- 响应回带类型：string（请求 id 原样字符串回带）

## 5. 错误码目录（specId: SPEC-ERR-{code}）
| code | 含义 | 触发条件 | 是否回带id |
|------|------|----------|:---:|
| -32603 | Internal error | 通用业务失败 | yes |

## 7. 字段权威性分级表
| specId | 字段/形态 | spec-required | deployment-config-dependent | needs-runtime-verify | 来源 |
|--------|----------|:---:|:---:|:---:|------|
| SPEC-RESP-WRAP | result.task.status.state | ✅ | | | 实测样本 |
| SPEC-ID-TYPE | id (string) | ✅ | | | 实测样本 |
| SPEC-ERR-32603 | error.code | ✅ | | | 实测样本 |
