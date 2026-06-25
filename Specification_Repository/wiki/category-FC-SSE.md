# 分类汇总 · FC-SSE（SSE流式响应缺陷）

> 由 `beta/scripts/gen_wiki.py` 从结构化故障库单向派生。本类共 6 条故障。
> 仅 advisory；断言级别一律以项目 `contract.md` 权威性封顶。

| fault_id | 名称 | 严重度 | 建议断言级别 | 候选 specId 种类 |
|---|---|---|---|---|
| [F-SSE-001](./F-SSE-001.md) | SSE事件类型无法识别 | 高 | L2 | SSE |
| [F-SSE-002](./F-SSE-002.md) | SSE流未到达终态 | 高 | L2 | SSE、RESP_WRAP、ERR |
| [F-SSE-003](./F-SSE-003.md) | SSE事件字段缺失 | 高 | L2 | SSE |
| [F-SSE-004](./F-SSE-004.md) | SSE事件顺序错误 | 高 | L2 | SSE |
| [F-SSE-005](./F-SSE-005.md) | SSE连接异常中断 | 高 | L2 | SSE |
| [F-SSE-006](./F-SSE-006.md) | SSE事件重复 | 中 | L2 | SSE |

返回：[索引](./index.md)
