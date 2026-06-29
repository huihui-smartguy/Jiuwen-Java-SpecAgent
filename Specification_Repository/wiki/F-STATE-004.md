# F-STATE-004 · 状态流转顺序错误

> 溯源：`rest_api_common_faults.json` → `FC-STATE-001`（状态与流程缺陷）→ `F-STATE-004`
> 严重程度：高 ｜ 故障建议断言级别：L2（**最终以项目 `contract.md` 权威性封顶**，见下「契约锚点」）
> 标签：状态机、业务逻辑
> 本文由 `beta/scripts/gen_wiki.py` 从结构化故障库**单向派生**，仅作 advisory；**不作 oracle、不进 `match_faults.py`**。

## 故障模式（通俗描述）

违反状态机流转顺序（如直接跳到终态）

## 怎么触发

尝试执行不允许的状态流转

## 预期行为

返回业务拒绝或状态不变

验证点：
- 状态保持当前状态
- 不执行非法流转
- 返回错误指示非法流转

## 契约锚点（候选 specId 种类）

本故障的判据**唯一来自项目 `contract.md`**。`match_faults.py` 会按 contract 权威性把本故障解析为具体 specId，并据权威性封顶断言级别（spec-required→至多 L2；config-dependent→至多 L1；needs-runtime-verify / 契约静默→至多 L0 观察）。候选种类：

- RESP_WRAP→SPEC-RESP-WRAP
- ERR→SPEC-ERR-*

> ⚠️ 本文**不声明无条件断言级别**；以上仅供 LLM 阶段（stage2.6b）语义绑定参考，最终 specId 与断言级别以 `contract.md` 为准。

## 常见根因方向（通用经验 · advisory）

> 下列为**按类通用经验提示**，非结构化库字段；供 stage6 根因叙事起步，**最终须以实测 trace + 源码定位为准**。
- 状态机非法迁移未拦截（缺前置状态校验）
- 关联资源存在性未校验即推进终态

## 历史案例

（暂无关联历史缺陷；一旦实测复现，`record_faults.py` 会把 `sdk_defect` 蒸馏回 `history_faults`，再由本脚本重生成时回链此处。）

## 关联故障

同类（FC-STATE-001 状态与流程缺陷）：
- [F-STATE-001](./F-STATE-001.md)
- [F-STATE-002](./F-STATE-002.md)
- [F-STATE-003](./F-STATE-003.md)
- [F-STATE-005](./F-STATE-005.md)
- [F-STATE-006](./F-STATE-006.md)

返回：[分类汇总](./category-FC-STATE.md) ｜ [索引](./index.md)
