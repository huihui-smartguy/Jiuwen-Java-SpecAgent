# F-HIST-002 · 响应结构嵌套错误（result.task而非re

> 溯源：`rest_api_common_faults.json` → `HISTORY`（历史缺陷）→ `F-HIST-002`
> 严重程度：高 ｜ 故障建议断言级别：L2（**最终以项目 `contract.md` 权威性封顶**，见下「契约锚点」）
> 标签：历史缺陷、结构一致性、契约验证
> 本文由 `beta/scripts/gen_wiki.py` 从结构化故障库**单向派生**，仅作 advisory；**不作 oracle、不进 `match_faults.py`**。

## 故障模式（通俗描述）

响应结构嵌套错误（result.task而非result）

## 怎么触发

执行GetTask查询

## 预期行为

响应结构应为result.task而非result

验证点：
- 响应包含result.task字段
- task.id不为空

## 契约锚点（候选 specId 种类）

本故障的判据**唯一来自项目 `contract.md`**。`match_faults.py` 会按 contract 权威性把本故障解析为具体 specId，并据权威性封顶断言级别（spec-required→至多 L2；config-dependent→至多 L1；needs-runtime-verify / 契约静默→至多 L0 观察）。候选种类：

- （本故障无结构化候选 specId 种类；多为 DFX/观察轨道）

> ⚠️ 本文**不声明无条件断言级别**；以上仅供 LLM 阶段（stage2.6b）语义绑定参考，最终 specId 与断言级别以 `contract.md` 为准。

## 常见根因方向（通用经验 · advisory）

> 下列为**按类通用经验提示**，非结构化库字段；供 stage6 根因叙事起步，**最终须以实测 trace + 源码定位为准**。
- 见本条历史缺陷的 source / 关联用例；属已实测复现的真实违例方向

## 历史案例

- 来源：TC-A2A-003执行失败
- 发现日期：2026-01-18
- 关联用例：TC-A2A-003
- 处置状态：open

## 关联故障

同类（HISTORY 历史缺陷）：
- [F-HIST-001](./F-HIST-001.md)
- [F-HIST-003](./F-HIST-003.md)
- [F-HIST-004](./F-HIST-004.md)
- [F-HIST-005](./F-HIST-005.md)

返回：[分类汇总](./category-HISTORY.md) ｜ [索引](./index.md)
