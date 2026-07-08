# SUT 契约（权威）— a2a fault_demo fixture

> 唯一权威 oracle 来源。下游 stage3b/stage4 的断言判据必须引用本文件的 specId。
> probe_status: reachable    采集时间: 2026-06-22    base_url: http://localhost:8080
>
> 注：本文件为 match_faults.py 的确定性自测 fixture（手工裁剪自 a2a 形态），非真实 probe 产物。

## 1. 响应包装（specId: SPEC-RESP-WRAP）
- 业务对象真实路径：`result.task`

## 2. 请求标识 id 类型（specId: SPEC-ID-TYPE）
- 响应回带类型：string（用 id_eq 容差比较）

## 3. 状态/类型枚举（specId: SPEC-ENUM）
- 前缀：`TASK_STATE_`；归一规则：strip 前缀（normalize_state）

## 4. 流式/SSE 事件（specId: SPEC-SSE）
- oneof：`task` / `statusUpdate` / `artifactUpdate`；末事件须为终态

## 5. 错误码目录（specId: SPEC-ERR-{code}）
| code | 含义 | 触发条件 | 是否回带id |
|------|------|----------|:---:|
| -32700 | Parse error | 非法 JSON | no |
| -32601 | Method not found | 未知方法 | yes |
| -32603 | Internal error | 通用业务失败 | yes |

## 6. 自描述/能力端点字段（specId: SPEC-CARD）
| 字段 | 形态 | 权威性 |
|------|------|--------|
| url | base_url（部署相关） | config-dependent |

## 7. 字段权威性分级表
| specId | 字段/形态 | spec-required | deployment-config-dependent | needs-runtime-verify | 来源 |
|--------|----------|:---:|:---:|:---:|------|
| SPEC-RESP-WRAP | result.task | ✅ | | | 实测样本 |
| SPEC-ID-TYPE | id (string) | ✅ | | | 实测样本 |
| SPEC-ENUM | TASK_STATE_* | ✅ | | | 源码 |
| SPEC-SSE | event.kind / 末态 | ✅ | | | 实测样本 |
| SPEC-ERR-32700 | error.code | ✅ | | | 实测样本 |
| SPEC-ERR-32601 | error.code | ✅ | | | 实测样本 |
| SPEC-ERR-32603 | error.code | ✅ | | | 实测样本 |
| SPEC-CARD-URL | card.url | | ✅(部署配置) | | 实测样本 |
