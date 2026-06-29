# LLM Wiki 索引 · 故障库派生 NL 文章（Beta 预研 v1.0）

> 本目录由 `AutoTestFlow/beta/scripts/gen_wiki.py` 从 `TestKnowledgeBase/Fault/rest_api_faults.json` [+ overlay] **单向派生**。
> **单一真相是结构化 JSON**；本目录仅作 advisory NL 层，供 stage2.6b / stage6 的 LLM 子 Agent 按 `fault_id` 确定性取用。**不作 oracle、不进 `match_faults.py`**。
> 重生成：`python AutoTestFlow/beta/scripts/gen_wiki.py`；校验：`python AutoTestFlow/beta/scripts/check_wiki.py`。

- 源库版本：`1.1.0-demo`（scope=`wiki_demo`）
- 文章总数：3 篇故障文章 + 3 篇分类汇总 + 本索引

## FC-REQ · 请求体缺陷（1 条） — [汇总](./category-FC-REQ.md)

- [F-REQ-011 · 引用不存在的关联资源](./F-REQ-011.md)

## FC-PROTO · 协议合规性缺陷（1 条） — [汇总](./category-FC-PROTO.md)

- [F-PROTO-001 · JSON-RPC错误响应缺少id字段](./F-PROTO-001.md)

## HISTORY · 历史缺陷（1 条） — [汇总](./category-HISTORY.md)

- [F-HIST-001 · 响应id字段类型不一致（int vs s](./F-HIST-001.md)
