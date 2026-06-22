# 06 · Phase 3 设计与落地（增强 · 保守门降级 · 治理）

> 本轮按用户决定：**人工门保守降级** + **本轮不涉 MCP 作源**；不在真实 SUT 上跑端到端。
> 主线不变：可插拔文件 + 确定性 `match_faults.py` 为核心；本章新增"可选 LLM 增强"与"治理/降级"层。

---

## 一、可选 LLM 增强子 Agent（阶段2.6b）

`match_faults.py`（纯脚本）已确定性完成匹配/配额/契约封顶，但有些**模糊活**脚本难做：自由文本
`validation_point` ↔ specId 的语义绑定、overlay 残留 `{placeholder}` 的上下文替换、`expected_behavior` 与契约的
**语义冲突**判定。Phase 3 用一个**可选** LLM 子 Agent 补这部分。

### 触发与产物
- `match_faults.py` 现为每条"模糊"匹配打 `enrich` 提示：`{needs_bind, unbound_points, hints}`，并在
  `meta.stats.enrichment_needed` 计数。置位条件：存在未被 oracle 绑定的 validation_point / `reconciliation=downgraded`
  / 残留 `{placeholder}`。
- 子 Agent 模板 `AutoTestFlow/templates/stage2_6_fault_match.md`；编排器仅当 `--fault-enrich on` 且
  `enrichment_needed>0` 时启动；默认 `off`（增强需额外 LLM，opt-in）。回写 `.state/fault_matches.json`。

### 三项增强动作
1. **bind_validation_points**：把 `unbound_points` 绑定到语义最贴近的 contract specId；命中则追加 `oracle_ref`，
   未命中保留为观察（写 `enrich.still_unbound`），**不臆造 specId**。
2. **substitute_placeholder**：用 overlay `parameter_config`/contract 实测值替换残留占位；无值→标 `needs-runtime-verify`（L0）。
3. **recheck_downgrade_or_conflict**：语义比对 `expected_behavior_raw` vs 契约 → 冲突置
   `reconciliation:"contract_conflict"` 并降为观察项（契约优先）；否则维持 downgraded/aligned。

### 契约安全（硬红线，与 `shared/rules.md` §2/§4/§6 一致）
- 任何 `assert_level` **≤ 该 specId 权威性上限**（spec-required→L2 / config-dependent→L1 / needs-runtime-verify→L0）；
- 判据只来自 `contract.md`，找不到 specId 的点**保留观察、不洗绿**；
- 冲突时**契约优先**。增强只补绑定，不改确定性骨架。

> a2a fault_demo 实测：`enrichment_needed=5`（F-REQ-011×2、F-RES-001、F-RES-002 有未绑定校验点；F-HIST-005 卡片为 downgraded）。

---

## 二、保守人工门降级（DESIGN "规格库就位后可降级" 的稳健落地）

故障库只提供"**故障判据**"，不覆盖"FP 拆分/断言合理性"判据，故**仅降级故障库能背书的维度**：

| 裁决门 | 故障库覆盖? | `.state/fault_matches.json` 存在时 |
|---|:---:|---|
| stage1 FP 拆分 / 场景边界 / 覆盖范围 | 否 | **仍强制人工**（不降级） |
| stage3b 异常 / 边界 / 质量**覆盖完备性** | 是 | **自动通过 + 展示故障覆盖摘要** |
| stage3b FP 拆分映射 / 断言合理性 | 否 | **仍强制人工** |

落地：`SKILL.md` 人工裁决 §、stage1 gate（标注"保留强制"）、stage3b gate（标注"覆盖完备性维度自动、聚焦 FP/断言"）。
更完善的规格库（业务约束/架构知识）就位后，可继续降级剩余维度——但那超出"故障库"范畴。

---

## 三、治理：overlay → global 晋升

- `record_faults.py` 默认写**项目 overlay**（`project_faults.json`），不污染全局精选库；
- 晋升路径：沉淀(overlay) → 人工评审(通用性 + 契约口径) → **PR 并入全局** + bump `meta.version`(minor)；
- per-SUT 专化：各项目自带 `fault_library/project_faults.json`（模板 `Specification_Repository/project_faults.example.json`），
  `--fault-overlay` 指定；全局库保持精选、跨项目共享。
- 详见 `Specification_Repository/README.md` §四"overlay → global 晋升流程"。

---

## 四、stage1 历史 P0 轻钩子（best-effort）

`templates/stage1_req_analyze.md` 第七步（续）：若传入 `--fault-lib`，按 tag/描述关键字与 FP 入口**启发式**交叉，
命中 FP 升 P0 + 记 `history_fault_refs`，统计入 `s1_index.meta.fault_enrichment`。
**定位**：仅让历史关联在需求阶段尽早可见；**权威的历史 P0 注入仍由阶段2.6 `match_faults.py`** 经 `fault_matches.json` 完成
（`test_case_id` 与当前 FP 无硬映射，故此钩子明确为 best-effort，未命中不影响产物）。

---

## 五、MCP 作源：本轮不实现（按用户决定）

`05` §b 推荐的"file 核心 + MCP 作源（起点物化版本化快照）"混合方案，**本轮不落代码**（环境无 MCP 服务器，
完整客户端不可测且无法回归）。设计保留在 `05` §b；未来若引入，建议以 `match_faults.py --fault-source mcp://…`
在流水线起点**一次性物化快照到本地文件**，下游仍全程文件化、可复现，不破坏零知识/文件即协议。

---

## 六、验证与现状

- 确定性自测（无 SUT）：`match_faults.py` 重跑 → Phase 1 断言全过 + `enrichment_needed≥1`、F-HIST-005 带
  `enrich.needs_bind`；`aggregate_results.py`/`record_faults.py` 回归不受影响。
- 增强子 Agent（`stage2_6_fault_match.md`）、门降级（SKILL.md）、治理（README）为 prompt/文档变更，经 review。
- 仍 **Unverified**（环境缺私钥，签名代理只读，已知不可本地修复）；内容正确性不受影响。

> 一句话：Phase 3 在不破坏确定性核心与契约安全的前提下，补齐了"模糊绑定增强 + 稳健门降级 + 闭环治理"；MCP 作源按决定延后。
