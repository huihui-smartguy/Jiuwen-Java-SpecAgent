# 分类汇总 · FC-PROTO（协议合规性缺陷）

> 由 `beta/scripts/gen_wiki.py` 从结构化故障库单向派生。本类共 7 条故障。
> 仅 advisory；断言级别一律以项目 `contract.md` 权威性封顶。

| fault_id | 名称 | 严重度 | 建议断言级别 | 候选 specId 种类 |
|---|---|---|---|---|
| [F-PROTO-001](./F-PROTO-001.md) | JSON-RPC错误响应缺少id字段 | 高 | L2 | ERR、ID_TYPE |
| [F-PROTO-002](./F-PROTO-002.md) | JSON-RPC非法请求体 | 高 | L2 | ERR、ID_TYPE |
| [F-PROTO-003](./F-PROTO-003.md) | JSON-RPC方法不存在 | 高 | L2 | ERR、ID_TYPE |
| [F-PROTO-004](./F-PROTO-004.md) | HTTP方法错误 | 中 | L2 | ERR、ID_TYPE |
| [F-PROTO-005](./F-PROTO-005.md) | JSON-RPC缺少jsonrpc字段 | 中 | L2 | ERR、ID_TYPE |
| [F-PROTO-006](./F-PROTO-006.md) | Content-Type错误 | 中 | L2 | ERR、ID_TYPE |
| [F-PROTO-007](./F-PROTO-007.md) | Accept头错误 | 中 | L2 | ERR、ID_TYPE |

返回：[索引](./index.md)
