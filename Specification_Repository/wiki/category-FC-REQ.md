# 分类汇总 · FC-REQ（请求体缺陷）

> 由 `beta/scripts/gen_wiki.py` 从结构化故障库单向派生。本类共 11 条故障。
> 仅 advisory；断言级别一律以项目 `contract.md` 权威性封顶。

| fault_id | 名称 | 严重度 | 建议断言级别 | 候选 specId 种类 |
|---|---|---|---|---|
| [F-REQ-001](./F-REQ-001.md) | body必选参数缺失 | 高 | L2 | ERR、RESP_WRAP |
| [F-REQ-002](./F-REQ-002.md) | body参数类型错误 | 高 | L2 | ERR、RESP_WRAP |
| [F-REQ-003](./F-REQ-003.md) | body参数边界值超限 | 中 | L2 | ERR、RESP_WRAP |
| [F-REQ-004](./F-REQ-004.md) | body参数格式错误 | 中 | L2 | ERR、RESP_WRAP |
| [F-REQ-005](./F-REQ-005.md) | 可选参数配置后未生效 | 中 | L2 | ERR、RESP_WRAP |
| [F-REQ-006](./F-REQ-006.md) | 空字符串作为非空字段值 | 高 | L2 | ERR、RESP_WRAP |
| [F-REQ-007](./F-REQ-007.md) | null值注入 | 高 | L2 | ERR、RESP_WRAP |
| [F-REQ-008](./F-REQ-008.md) | 超长字符串注入 | 中 | L2 | ERR、RESP_WRAP |
| [F-REQ-009](./F-REQ-009.md) | 特殊字符注入 | 中 | L2 | ERR、RESP_WRAP |
| [F-REQ-010](./F-REQ-010.md) | 数组字段空数组注入 | 中 | L2 | ERR、RESP_WRAP |
| [F-REQ-011](./F-REQ-011.md) | 引用不存在的关联资源 | 高 | L2 | RESP_WRAP、ERR |

返回：[索引](./index.md)
