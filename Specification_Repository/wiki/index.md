# LLM Wiki 索引 · 故障库派生 NL 文章（Beta 预研 v1.0）

> 本目录由 `AutoTestFlow/beta/scripts/gen_wiki.py` 从 `Specification_Repository/rest_api_common_faults.json` [+ overlay] **单向派生**。
> **单一真相是结构化 JSON**；本目录仅作 advisory NL 层，供 stage2.6b / stage6 的 LLM 子 Agent 按 `fault_id` 确定性取用。**不作 oracle、不进 `match_faults.py`**。
> 重生成：`python AutoTestFlow/beta/scripts/gen_wiki.py`；校验：`python AutoTestFlow/beta/scripts/check_wiki.py`。

- 源库版本：`1.1.0`（scope=`global`）
- 文章总数：55 篇故障文章 + 8 篇分类汇总 + 本索引

## FC-REQ · 请求体缺陷（11 条） — [汇总](./category-FC-REQ.md)

- [F-REQ-001 · body必选参数缺失](./F-REQ-001.md)
- [F-REQ-002 · body参数类型错误](./F-REQ-002.md)
- [F-REQ-003 · body参数边界值超限](./F-REQ-003.md)
- [F-REQ-004 · body参数格式错误](./F-REQ-004.md)
- [F-REQ-005 · 可选参数配置后未生效](./F-REQ-005.md)
- [F-REQ-006 · 空字符串作为非空字段值](./F-REQ-006.md)
- [F-REQ-007 · null值注入](./F-REQ-007.md)
- [F-REQ-008 · 超长字符串注入](./F-REQ-008.md)
- [F-REQ-009 · 特殊字符注入](./F-REQ-009.md)
- [F-REQ-010 · 数组字段空数组注入](./F-REQ-010.md)
- [F-REQ-011 · 引用不存在的关联资源](./F-REQ-011.md)

## FC-RES · 响应体缺陷（8 条） — [汇总](./category-FC-RES.md)

- [F-RES-001 · 响应id字段类型不一致](./F-RES-001.md)
- [F-RES-002 · 响应结构嵌套错误](./F-RES-002.md)
- [F-RES-003 · 响应缺少必选字段](./F-RES-003.md)
- [F-RES-004 · 枚举值格式不一致](./F-RES-004.md)
- [F-RES-005 · 响应字段类型错误](./F-RES-005.md)
- [F-RES-006 · 响应时间戳格式不一致](./F-RES-006.md)
- [F-RES-007 · 响应字段值超出范围](./F-RES-007.md)
- [F-RES-008 · 响应null字段处理不一致](./F-RES-008.md)

## FC-PROTO · 协议合规性缺陷（7 条） — [汇总](./category-FC-PROTO.md)

- [F-PROTO-001 · JSON-RPC错误响应缺少id字段](./F-PROTO-001.md)
- [F-PROTO-002 · JSON-RPC非法请求体](./F-PROTO-002.md)
- [F-PROTO-003 · JSON-RPC方法不存在](./F-PROTO-003.md)
- [F-PROTO-004 · HTTP方法错误](./F-PROTO-004.md)
- [F-PROTO-005 · JSON-RPC缺少jsonrpc字段](./F-PROTO-005.md)
- [F-PROTO-006 · Content-Type错误](./F-PROTO-006.md)
- [F-PROTO-007 · Accept头错误](./F-PROTO-007.md)

## FC-STATE · 状态与流程缺陷（6 条） — [汇总](./category-FC-STATE.md)

- [F-STATE-001 · 终态资源再操作](./F-STATE-001.md)
- [F-STATE-002 · 不存在的资源ID](./F-STATE-002.md)
- [F-STATE-003 · 并发操作冲突](./F-STATE-003.md)
- [F-STATE-004 · 状态流转顺序错误](./F-STATE-004.md)
- [F-STATE-005 · 资源过期访问](./F-STATE-005.md)
- [F-STATE-006 · 幂等性违反](./F-STATE-006.md)

## FC-SSE · SSE流式响应缺陷（6 条） — [汇总](./category-FC-SSE.md)

- [F-SSE-001 · SSE事件类型无法识别](./F-SSE-001.md)
- [F-SSE-002 · SSE流未到达终态](./F-SSE-002.md)
- [F-SSE-003 · SSE事件字段缺失](./F-SSE-003.md)
- [F-SSE-004 · SSE事件顺序错误](./F-SSE-004.md)
- [F-SSE-005 · SSE连接异常中断](./F-SSE-005.md)
- [F-SSE-006 · SSE事件重复](./F-SSE-006.md)

## FC-SEC · 安全相关缺陷（8 条） — [汇总](./category-FC-SEC.md)

- [F-SEC-001 · SQL注入风险](./F-SEC-001.md)
- [F-SEC-002 · XSS攻击风险](./F-SEC-002.md)
- [F-SEC-003 · 未授权访问](./F-SEC-003.md)
- [F-SEC-004 · 敏感信息泄露](./F-SEC-004.md)
- [F-SEC-005 · 路径遍历攻击](./F-SEC-005.md)
- [F-SEC-006 · 命令注入](./F-SEC-006.md)
- [F-SEC-007 · 速率限制缺失](./F-SEC-007.md)
- [F-SEC-008 · CORS配置错误](./F-SEC-008.md)

## FC-PERF · 性能相关缺陷（4 条） — [汇总](./category-FC-PERF.md)

- [F-PERF-001 · 响应超时](./F-PERF-001.md)
- [F-PERF-002 · 大响应体](./F-PERF-002.md)
- [F-PERF-003 · 内存泄漏](./F-PERF-003.md)
- [F-PERF-004 · 资源未释放](./F-PERF-004.md)

## HISTORY · 历史缺陷（5 条） — [汇总](./category-HISTORY.md)

- [F-HIST-001 · 响应id字段类型不一致（int vs s](./F-HIST-001.md)
- [F-HIST-002 · 响应结构嵌套错误（result.task](./F-HIST-002.md)
- [F-HIST-003 · JSON-RPC错误响应缺少id字段](./F-HIST-003.md)
- [F-HIST-004 · SSE事件kind字段无法识别](./F-HIST-004.md)
- [F-HIST-005 · Agent Card endpoint字](./F-HIST-005.md)
