# F-SSE-003 · SSE事件字段缺失

> 溯源：`rest_api_common_faults.json` → `FC-SSE-001`（SSE流式响应缺陷）→ `F-SSE-003`
> 严重程度：高 ｜ 故障建议断言级别：L2（**最终以项目 `contract.md` 权威性封顶**，见下「契约锚点」）
> 标签：SSE、字段缺失、契约验证
> 本文由 `beta/scripts/gen_wiki.py` 从结构化故障库**单向派生**，仅作 advisory；**不作 oracle、不进 `match_faults.py`**。

## 故障模式（通俗描述）

SSE事件缺少必选字段（如id, kind, data等）

## 怎么触发

触发SSE流式响应

## 预期行为

所有事件应包含契约定义的必选字段

验证点：
- 每个事件包含id字段
- 包含kind/event字段
- 包含data字段

## 契约锚点（候选 specId 种类）

本故障的判据**唯一来自项目 `contract.md`**。`match_faults.py` 会按 contract 权威性把本故障解析为具体 specId，并据权威性封顶断言级别（spec-required→至多 L2；config-dependent→至多 L1；needs-runtime-verify / 契约静默→至多 L0 观察）。候选种类：

- SSE→SPEC-SSE

> ⚠️ 本文**不声明无条件断言级别**；以上仅供 LLM 阶段（stage2.6b）语义绑定参考，最终 specId 与断言级别以 `contract.md` 为准。

## 常见根因方向（通用经验 · advisory）

> 下列为**按类通用经验提示**，非结构化库字段；供 stage6 根因叙事起步，**最终须以实测 trace + 源码定位为准**。
- 流式终态后未关闭连接 / 未追加终止事件
- 异常未在 SSE 末尾以 error 帧透出
- 事件类型/边界处理不全

## 历史案例

（暂无关联历史缺陷；一旦实测复现，`record_faults.py` 会把 `sdk_defect` 蒸馏回 `history_faults`，再由本脚本重生成时回链此处。）

## 关联故障

同类（FC-SSE-001 SSE流式响应缺陷）：
- [F-SSE-001](./F-SSE-001.md)
- [F-SSE-002](./F-SSE-002.md)
- [F-SSE-004](./F-SSE-004.md)
- [F-SSE-005](./F-SSE-005.md)
- [F-SSE-006](./F-SSE-006.md)

返回：[分类汇总](./category-FC-SSE.md) ｜ [索引](./index.md)
