# 分类汇总 · HISTORY（历史缺陷）

> 由 `beta/scripts/gen_wiki.py` 从结构化故障库单向派生。本类共 5 条故障。
> 仅 advisory；断言级别一律以项目 `contract.md` 权威性封顶。

| fault_id | 名称 | 严重度 | 建议断言级别 | 候选 specId 种类 |
|---|---|---|---|---|
| [F-HIST-001](./F-HIST-001.md) | 响应id字段类型不一致（int vs s | 高 | L2 | ID_TYPE |
| [F-HIST-002](./F-HIST-002.md) | 响应结构嵌套错误（result.task | 高 | L2 | — |
| [F-HIST-003](./F-HIST-003.md) | JSON-RPC错误响应缺少id字段 | 高 | L2 | ERR、ID_TYPE |
| [F-HIST-004](./F-HIST-004.md) | SSE事件kind字段无法识别 | 高 | L2 | SSE |
| [F-HIST-005](./F-HIST-005.md) | Agent Card endpoint字 | 高 | L2 | — |

返回：[索引](./index.md)
