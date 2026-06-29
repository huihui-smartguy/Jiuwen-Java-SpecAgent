# F-SEC-007 · 速率限制缺失

> 溯源：`rest_api_common_faults.json` → `FC-SEC-001`（安全相关缺陷）→ `F-SEC-007`
> 严重程度：中 ｜ 故障建议断言级别：L2（**最终以项目 `contract.md` 权威性封顶**，见下「契约锚点」）
> 标签：安全、速率限制、可靠性
> 本文由 `beta/scripts/gen_wiki.py` 从结构化故障库**单向派生**，仅作 advisory；**不作 oracle、不进 `match_faults.py`**。

## 故障模式（通俗描述）

缺少API调用速率限制，可能导致滥用

## 怎么触发

短时间内发送大量请求

## 预期行为

应返回429 Too Many Requests或限制访问

验证点：
- 返回429状态码或延迟响应
- 不导致服务崩溃
- 限制生效

## 契约锚点（候选 specId 种类）

本故障的判据**唯一来自项目 `contract.md`**。`match_faults.py` 会按 contract 权威性把本故障解析为具体 specId，并据权威性封顶断言级别（spec-required→至多 L2；config-dependent→至多 L1；needs-runtime-verify / 契约静默→至多 L0 观察）。候选种类：

- （本故障无结构化候选 specId 种类；多为 DFX/观察轨道）

> ⚠️ 本文**不声明无条件断言级别**；以上仅供 LLM 阶段（stage2.6b）语义绑定参考，最终 specId 与断言级别以 `contract.md` 为准。

## 常见根因方向（通用经验 · advisory）

> 下列为**按类通用经验提示**，非结构化库字段；供 stage6 根因叙事起步，**最终须以实测 trace + 源码定位为准**。
- 鉴权/越权/输入消毒缺失（advisory，DFX 轨道）

## 历史案例

（暂无关联历史缺陷；一旦实测复现，`record_faults.py` 会把 `sdk_defect` 蒸馏回 `history_faults`，再由本脚本重生成时回链此处。）

## 关联故障

同类（FC-SEC-001 安全相关缺陷）：
- [F-SEC-001](./F-SEC-001.md)
- [F-SEC-002](./F-SEC-002.md)
- [F-SEC-003](./F-SEC-003.md)
- [F-SEC-004](./F-SEC-004.md)
- [F-SEC-005](./F-SEC-005.md)
- [F-SEC-006](./F-SEC-006.md)
- [F-SEC-008](./F-SEC-008.md)

返回：[分类汇总](./category-FC-SEC.md) ｜ [索引](./index.md)
