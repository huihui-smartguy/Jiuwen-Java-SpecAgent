# F-REQ-011 · 引用不存在的关联资源

> 溯源：`rest_api_common_faults.json` → `FC-REQ-001`（请求体缺陷）→ `F-REQ-011`
> 严重程度：高 ｜ 故障建议断言级别：L2（**最终以项目 `contract.md` 权威性封顶**，见下「契约锚点」）
> 适用场景：POST、PUT、PATCH
> 标签：关联资源校验、业务逻辑、参数校验、资源不存在
> 本文由 `beta/scripts/gen_wiki.py` 从结构化故障库**单向派生**，仅作 advisory；**不作 oracle、不进 `match_faults.py`**。

## 故障模式（通俗描述）

请求参数中引用的关联资源不存在（如不存在的agentId、userId、sessionId、parentId等）

## 怎么触发

在请求参数的关联字段中传入不存在的资源ID（如metadata.agentId='nonexistent-{uuid}'）

## 预期行为

应返回错误响应或终态FAILED，不执行无效操作

验证点：
- 响应包含error字段或状态字段指示失败
- 错误码或message指示资源不存在或关联无效
- 不创建资源或执行无效操作
- 响应id字段回带

## 契约锚点（候选 specId 种类）

本故障的判据**唯一来自项目 `contract.md`**。`match_faults.py` 会按 contract 权威性把本故障解析为具体 specId，并据权威性封顶断言级别（spec-required→至多 L2；config-dependent→至多 L1；needs-runtime-verify / 契约静默→至多 L0 观察）。候选种类：

- RESP_WRAP→SPEC-RESP-WRAP
- ERR→SPEC-ERR-*

> ⚠️ 本文**不声明无条件断言级别**；以上仅供 LLM 阶段（stage2.6b）语义绑定参考，最终 specId 与断言级别以 `contract.md` 为准。

## 常见根因方向（通用经验 · advisory）

> 下列为**按类通用经验提示**，非结构化库字段；供 stage6 根因叙事起步，**最终须以实测 trace + 源码定位为准**。
- 入参校验缺失：业务层未校验必选/类型/边界即直接访问字段（易 NPE 或静默通过）
- 校验注解与业务依赖不一致（如标可选但逻辑必需）
- 字段名/大小写映射不一致（驼峰 vs 下划线）

## 历史案例

结构化库中以下历史缺陷与本故障相关（由 record_faults.py 蒸馏，按 `ref:` 标签关联）：
- [F-HIST-001](./F-HIST-001.md)

## 关联故障

（同类暂无其它故障）

返回：[分类汇总](./category-FC-REQ.md) ｜ [索引](./index.md)
