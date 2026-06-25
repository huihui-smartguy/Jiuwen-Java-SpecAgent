# 分类汇总 · FC-RES（响应体缺陷）

> 由 `beta/scripts/gen_wiki.py` 从结构化故障库单向派生。本类共 8 条故障。
> 仅 advisory；断言级别一律以项目 `contract.md` 权威性封顶。

| fault_id | 名称 | 严重度 | 建议断言级别 | 候选 specId 种类 |
|---|---|---|---|---|
| [F-RES-001](./F-RES-001.md) | 响应id字段类型不一致 | 高 | L2 | ID_TYPE、RESP_WRAP |
| [F-RES-002](./F-RES-002.md) | 响应结构嵌套错误 | 高 | L2 | RESP_WRAP |
| [F-RES-003](./F-RES-003.md) | 响应缺少必选字段 | 高 | L2 | RESP_WRAP |
| [F-RES-004](./F-RES-004.md) | 枚举值格式不一致 | 中 | L2 | ENUM、RESP_WRAP |
| [F-RES-005](./F-RES-005.md) | 响应字段类型错误 | 高 | L2 | ID_TYPE、RESP_WRAP |
| [F-RES-006](./F-RES-006.md) | 响应时间戳格式不一致 | 中 | L2 | RESP_WRAP |
| [F-RES-007](./F-RES-007.md) | 响应字段值超出范围 | 中 | L2 | RESP_WRAP |
| [F-RES-008](./F-RES-008.md) | 响应null字段处理不一致 | 中 | L2 | RESP_WRAP |

返回：[索引](./index.md)
