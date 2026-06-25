# Beta · LLM Wiki 纪律（wiki_rules）

> 本文件是 Beta v1.0（故障库接入 LLM Wiki，Phase A）的**安全纪律**，呼应 `DESIGN.md` §2/§7、
> `shared/rules.md` §4 与 `FaultsAnalysis/07-LLM_Wiki与故障库知识源分析.md` §六护栏。
> `beta/scripts/check_wiki.py` 把以下纪律**逐条变成可执行断言**，离线机械校验。

## 一、五条铁律

1. **单一真相（Source of Truth）**
   结构化故障库 `Specification_Repository/rest_api_common_faults.json`（[+ overlay]）是**唯一真相**。
   `wiki/*.md` 仅由它派生，**不是**独立知识源。

2. **单向派生（One-way Derivation）**
   `gen_wiki.py` **只读 JSON、只写 wiki/*.md**，**绝不反写 JSON**；禁止手工编辑 wiki 文章（手改会在
   `check_wiki.py` C3「不漂移」校验中被发现）。要改知识 → 改 JSON → 重生成 wiki。

3. **仅 advisory，永不作 oracle**
   wiki 只为 LLM 阶段（stage2.6b / stage6）提供**语义上下文/叙事素材**。
   判据（通过与否、违例是否成立、断言级别）**唯一来自 `contract.md`**。
   wiki 与 contract 冲突时**一律以 contract 为准**。

4. **不替代 matcher 的结构化输入**
   确定性脚本 `match_faults.py` / `record_faults.py` **永不读 wiki**，只吃结构化 JSON。
   wiki 不进任何确定性匹配/去重路径（保确定性、可复现、可单测）。

5. **强制溯源 + 不越权断言**
   每篇文章头部**必须**回链 `fault_id`（+ category）；文章**不得声明无条件断言级别**，
   只能写"故障建议断言级别 + 以 contract 权威性封顶"。断言级别上限：
   spec-required→L2、deployment-config-dependent→L1、needs-runtime-verify/契约静默→L0。

## 二、对应校验项（check_wiki.py）

| 纪律 | 校验项 | 失败含义 |
|---|---|---|
| 单一真相 / 单向派生 | **C3 不漂移**：重渲染逐字节比对 | wiki 被手改或生成器漂移 |
| 仅 advisory / 不越权 | **C4 不越权**：免责声明齐备、无判据化措辞 | wiki 被当判据/越权断言 |
| 不替代 matcher | **C5 非 matcher 输入**：matcher 脚本不含 `wiki` 引用 | 确定性路径被污染 |
| 强制溯源 | **C2 溯源** + **C1 覆盖** | 文章无法回链结构化库 |

## 三、优雅降级

- `--beta-wiki off`（默认）：不生成、不读取、不校验 wiki；编排器用稳定模板 → 流水线与 v2.x **字节级一致**。
- wiki 缺失（某 `fault_id` 无文章、或 `fault_ref` 为空）：beta 模板中的 wiki 步骤**跳过**，
  缺陷/增强处理逻辑与稳定模板**完全一致**。

## 四、红线一句话

> **wiki 是"由结构化库单向派生、供 LLM 阶段参考的通俗叙事层"——可启发，不可裁决；可丰富 issue，不可替代 contract。**
