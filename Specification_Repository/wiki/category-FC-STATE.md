# 分类汇总 · FC-STATE（状态与流程缺陷）

> 由 `beta/scripts/gen_wiki.py` 从结构化故障库单向派生。本类共 6 条故障。
> 仅 advisory；断言级别一律以项目 `contract.md` 权威性封顶。

| fault_id | 名称 | 严重度 | 建议断言级别 | 候选 specId 种类 |
|---|---|---|---|---|
| [F-STATE-001](./F-STATE-001.md) | 终态资源再操作 | 中 | L2 | RESP_WRAP、ERR |
| [F-STATE-002](./F-STATE-002.md) | 不存在的资源ID | 中 | L2 | RESP_WRAP、ERR |
| [F-STATE-003](./F-STATE-003.md) | 并发操作冲突 | 中 | L2 | RESP_WRAP、ERR |
| [F-STATE-004](./F-STATE-004.md) | 状态流转顺序错误 | 高 | L2 | RESP_WRAP、ERR |
| [F-STATE-005](./F-STATE-005.md) | 资源过期访问 | 中 | L2 | RESP_WRAP、ERR |
| [F-STATE-006](./F-STATE-006.md) | 幂等性违反 | 高 | L2 | RESP_WRAP、ERR |

返回：[索引](./index.md)
