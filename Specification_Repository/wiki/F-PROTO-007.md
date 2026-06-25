# F-PROTO-007 · Accept头错误

> 溯源：`rest_api_common_faults.json` → `FC-PROTO-001`（协议合规性缺陷）→ `F-PROTO-007`
> 严重程度：中 ｜ 故障建议断言级别：L2（**最终以项目 `contract.md` 权威性封顶**，见下「契约锚点」）
> 标签：HTTP协议、Accept头
> 本文由 `beta/scripts/gen_wiki.py` 从结构化故障库**单向派生**，仅作 advisory；**不作 oracle、不进 `match_faults.py`**。

## 故障模式（通俗描述）

发送错误的Accept头（如不支持的内容类型）

## 怎么触发

发送Accept为application/xml但服务只支持JSON

## 预期行为

应返回406 Not Acceptable或返回支持的格式

验证点：
- HTTP状态码 = 406 或 返回默认格式
- 响应格式可解析

## 契约锚点（候选 specId 种类）

本故障的判据**唯一来自项目 `contract.md`**。`match_faults.py` 会按 contract 权威性把本故障解析为具体 specId，并据权威性封顶断言级别（spec-required→至多 L2；config-dependent→至多 L1；needs-runtime-verify / 契约静默→至多 L0 观察）。候选种类：

- ERR→SPEC-ERR-*
- ID_TYPE→SPEC-ID-TYPE

> ⚠️ 本文**不声明无条件断言级别**；以上仅供 LLM 阶段（stage2.6b）语义绑定参考，最终 specId 与断言级别以 `contract.md` 为准。

## 常见根因方向（通用经验 · advisory）

> 下列为**按类通用经验提示**，非结构化库字段；供 stage6 根因叙事起步，**最终须以实测 trace + 源码定位为准**。
- 协议错误码/版本/方法名未按规范返回（如非法 method 未返回 -32601）
- JSON-RPC 信封字段（jsonrpc/id）处理不完整

## 历史案例

（暂无关联历史缺陷；一旦实测复现，`record_faults.py` 会把 `sdk_defect` 蒸馏回 `history_faults`，再由本脚本重生成时回链此处。）

## 关联故障

同类（FC-PROTO-001 协议合规性缺陷）：
- [F-PROTO-001](./F-PROTO-001.md)
- [F-PROTO-002](./F-PROTO-002.md)
- [F-PROTO-003](./F-PROTO-003.md)
- [F-PROTO-004](./F-PROTO-004.md)
- [F-PROTO-005](./F-PROTO-005.md)
- [F-PROTO-006](./F-PROTO-006.md)

返回：[分类汇总](./category-FC-PROTO.md) ｜ [索引](./index.md)
