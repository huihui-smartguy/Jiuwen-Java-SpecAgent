# F-RES-006 · 响应时间戳格式不一致

> 溯源：`rest_api_common_faults.json` → `FC-RES-001`（响应体缺陷）→ `F-RES-006`
> 严重程度：中 ｜ 故障建议断言级别：L2（**最终以项目 `contract.md` 权威性封顶**，见下「契约锚点」）
> 标签：时间戳、格式一致性、契约验证
> 本文由 `beta/scripts/gen_wiki.py` 从结构化故障库**单向派生**，仅作 advisory；**不作 oracle、不进 `match_faults.py`**。

## 故障模式（通俗描述）

响应中的时间戳格式与契约不符（如ISO8601 vs Unix时间戳）

## 怎么触发

执行返回时间戳的请求

## 预期行为

时间戳格式应符合contract.md定义

验证点：
- 时间戳格式可解析
- 格式与契约一致

## 契约锚点（候选 specId 种类）

本故障的判据**唯一来自项目 `contract.md`**。`match_faults.py` 会按 contract 权威性把本故障解析为具体 specId，并据权威性封顶断言级别（spec-required→至多 L2；config-dependent→至多 L1；needs-runtime-verify / 契约静默→至多 L0 观察）。候选种类：

- RESP_WRAP→SPEC-RESP-WRAP

> ⚠️ 本文**不声明无条件断言级别**；以上仅供 LLM 阶段（stage2.6b）语义绑定参考，最终 specId 与断言级别以 `contract.md` 为准。

## 常见根因方向（通用经验 · advisory）

> 下列为**按类通用经验提示**，非结构化库字段；供 stage6 根因叙事起步，**最终须以实测 trace + 源码定位为准**。
- 响应未按契约包裹/字段缺失（如缺 result 包裹或状态字段）
- 序列化遗漏字段或类型错配

## 历史案例

（暂无关联历史缺陷；一旦实测复现，`record_faults.py` 会把 `sdk_defect` 蒸馏回 `history_faults`，再由本脚本重生成时回链此处。）

## 关联故障

同类（FC-RES-001 响应体缺陷）：
- [F-RES-001](./F-RES-001.md)
- [F-RES-002](./F-RES-002.md)
- [F-RES-003](./F-RES-003.md)
- [F-RES-004](./F-RES-004.md)
- [F-RES-005](./F-RES-005.md)
- [F-RES-007](./F-RES-007.md)
- [F-RES-008](./F-RES-008.md)

返回：[分类汇总](./category-FC-RES.md) ｜ [索引](./index.md)
