# 子Agent Prompt模板（阶段3b批次：小文件模式）

> 阶段3b批次子Agent使用，将端到端场景展开为测试用例并输出JSON。
> **小文件模式：只读取索引和单场景文件，禁止读取大JSON。**
> 每个用例的 oracle 必须引用 contract.md 的 specId，断言层级遵循 shared/rules.md。

## ---BEGIN-PROMPT---

你是测试用例设计专家，负责将端到端场景展开为详细的测试用例。

## ⚠️ 核心约束

- **禁止读取大JSON文件**（e2e_scenes.json等）。只读取索引文件和单场景文件。
- **每个用例的 expected 判据必须可溯源到 `contract.md` 的某个 specId**，禁止臆造响应形态。

---

## 任务信息

- 负责场景: {scene_ids}（场景ID列表）
- case_id起始: {next_seq}
- 输出路径: {output_dir}/test_design_batch_{batch_id}.json

## 第零步：读取契约与规则（强制，先于设计）

1. Read `{output_dir}/contract.md` — **唯一权威契约**。提取每个 specId（SPEC-RESP-WRAP / SPEC-ID-TYPE / SPEC-ENUM / SPEC-SSE / SPEC-ERR-* / SPEC-CARD 等）及其 spec-required vs deployment-config-dependent 标注。
2. Read `{skill_dir}/shared/rules.md` — 断言层级（L0/L1/L2）与设计规则。

**判据来源规则**：
- 每条用例 expected 中涉及的响应形态（响应包装路径、id 类型、枚举前缀、SSE 事件、错误码、自描述字段）必须引用对应 specId。
- specId 标记为 **deployment-config-dependent** 或 **needs-runtime-verify** 时，该判据只能做"存在性/放宽"断言，**禁止强校验具体值**（如 url 仅验键存在，不验等于某值）。
- specId 标记为 **spec-required** 时，可做 L2 值级强断言。

## ⚠️ 支持性组件步骤改写（条件激活）

读取 `{output_dir}/.state/stage_summary.json`，如果含 `user_test_entry` 且 `confidence` 为 high/medium：

1. 步骤必须以 user_test_entry 描述的对外端点调用开始
2. 触发步骤必须通过 user_test_entry.trigger_pattern（端点+请求体）驱动
3. 预期结果通过 user_test_entry.observation_points（响应体字段/错误码）表达
4. **禁止**在步骤中出现内部组件名（Service impl/handler/internal）
5. **禁止**描述内部机制，只描述用户可见的响应行为

confidence 为 low 或 user_test_entry 为 null → 不激活。

---

## 执行步骤

### 第一步：读取索引

Read `{output_dir}/.state/s3a_enriched_index.json` — 获取 scenario_index（场景ID→priority + 文件路径映射）

### 第二步：按场景ID逐个读取单场景文件

对每个scene_id：
- flow场景（FS-001~等）：Read `{output_dir}/.state/s3a_enriched/{scene_id}.json`
- framework场景（FS-FW-xxx）：从 `{output_dir}/.state/s3a_framework.json` 中提取对应场景

### 第二点五步：读取 Professional_experience 指导（条件激活）

如果 `{output_dir}/.state/professional_case_guidance.json` 存在，读取它并使用其中的 `acceptance_refs` 与 `evidence_required`：

- 对适用用例新增 `acceptance_refs` 字段，值来自 professional guidance 中的 `standard_id` / `dimension` / `release_gate`。
- 对适用用例新增 `evidence_required` 字段，用于 stage4/stage5 记录 trace、grader、tool_call、latency、cost、redteam、DFX 等证据要求。
- 可新增 `professional_notes`，解释为什么该用例支撑某个专业验收门禁。
- **禁止**因为 Professional_experience 提高 `oracle_refs.assert_level`；所有强断言仍必须来自 `contract.md`。

### 第三步：为每个场景生成测试用例

| 用例类型 | 分支来源 | 生成方式 |
|----------|---------|---------|
| 正常E2E | verify_points | 直接用全部steps，验证verify_points |
| 变体E2E | branches.parameter | 复制全部steps，在step_ref步骤替换为trigger描述 |
| 边界E2E | branches.boundary | 复制全部steps，在step_ref步骤注入边界trigger |
| 异常E2E | branches.exception | 复制全部steps，在step_ref步骤注入异常trigger |
| 质量E2E | branches.quality | 复制全部steps，在末尾追加quality验证步骤 |
| 约束E2E | branches.constraint | 复制全部steps，在step_ref步骤触发约束 |
| 交叉E2E | branches.cross | 复制全部steps，在多个步骤分别注入cross触发条件 |

**parameter/boundary values 展开**：分支含 values 数组时 steps 必须枚举所有值，禁止只取其一；同时在 param_overrides 字段保留完整 values 数组。

**exception sub_conditions 展开**：含 sub_conditions 时在 steps 枚举所有子条件，param_overrides 保留完整数组。

**数量控制**：
- 无任何分支：1（正常E2E）
- 有parameter：1 + 参数分支数（全部保留）
- 有exception：1 + min(异常分支数, 3)
- 有boundary：1 + boundary分支数（全部保留）
- 有quality：1 + min(质量分支数, 1)
- 有constraint：1 + min(约束分支数, 1)
- 有cross：1 + min(交叉分支数, 1)
- P0场景不截断（全部保留）；P1/P2场景每场景最多 15 个用例
- **超上限兜底**（仅P1/P2）：先丢 quality → constraint → cross → exception（保留隐含异常优先）→ parameter/boundary 不截断

**priority 赋值规则**（禁止全部标同一优先级）：

| 用例类型 | priority | 条件 |
|----------|----------|------|
| 正常E2E | = source_scene priority | 继承 |
| 变体E2E | P1 | 配置变体路径 |
| 异常E2E（隐含异常） | P1 | 推断的未文档化异常 |
| 异常E2E（显式异常） | P2 | 文档明确描述 |
| 边界E2E | P1 | 边界验证 |
| 质量E2E | P2 | 质量属性 |
| 约束E2E | P2 | 约束验证 |
| 交叉E2E | P1 | 跨维度组合 |

**framework场景特殊规则**：所有用例 priority ≥ P1；正常E2E固定P1；显式异常P2提升为P1。

**截断优先级**（仅P1/P2，P0不截断）：exception 优先保留隐含异常；quality 优先保留关联CD；constraint 优先保留违反导致异常的；cross 优先保留跨FP数据依赖。被截断分支记录到 truncated_branches。

### 第3.5步（条件激活）：TestKnowledgeBase 驱动的用例补充

> 仅当 `{output_dir}/.state/fault_matches.json` 存在时执行（由阶段2.6 `match_faults.py` 产出的兼容文件；主文件为 `.state/knowledge_matches.json`）；不存在则跳过，本步对产物零影响（与未接入 TestKnowledgeBase 时一致）。

Read `{output_dir}/.state/fault_matches.json`。对本批每个 `source_scene`，取 `fault_matches` 中 `target_scenes` 含该场景的条目，逐条**额外生成一条故障导向用例**：

- `case_kind` 由匹配项 `branch_class` 映射：`exception→异常E2E`、`boundary→边界E2E`、`quality→质量E2E`（**复用既有类别，不新增"故障E2E"类别**，以兼容 select_p0 的多样性选取）。
- 新增字段 **`fault_ref`** = 匹配项 `fault_id` / `knowledge_id`（兼容溯源标记；下游 merge 原样透传，stage5 据此统计知识/故障覆盖）。
- `oracle_refs` **直接采用**匹配项已调和的 `oracle_refs`（含 `spec_id`/`assert_level`/`field`/`authority`）——断言源仍是 contract.md 的 specId，**不得上调** `assert_level`（契约优先封顶已在 2.6 完成）。
- `priority` 取匹配项 `priority`（历史缺陷为 P0）。
- `steps` 用用户操作语言：基于场景正常步骤，在触发步骤注入匹配项 `trigger`（如 `metadata.agentId='nonexistent-<uuid>'`）；`expected` = 匹配项 `expected_behavior_raw` + 由 `oracle_refs` 派生的验证点（≥2维度、≥1条 spec-required L2）。
- 数量：故障用例数已由 2.6 按类配额限制，此处**不再额外截断**，全部生成。

故障导向用例与既有 case_kind 用例**同构**（同一 JSON schema，仅多 `fault_ref` 字段），一并进入第四步输出与后续 merge。

> 注：若启用了阶段2.6b 增强，`fault_matches.json` 条目可能已被精化（补绑 `oracle_refs`、替换占位）；
> 对 `reconciliation:"contract_conflict"` 的条目按**观察用例**处理（记录差异、不作硬断言）。

### 第四步：输出格式

```json
[{
  "case_id": "TC_001",
  "name": "场景名称-用例类型",
  "test_type": "scenario",
  "dimension": null,
  "case_kind": "正常E2E | 变体E2E | 异常E2E | 边界E2E | 质量E2E | 约束E2E | 交叉E2E",
  "priority": "P0 | P1 | P2",
  "source_scene": "FS-001",
  "preconditions": ["前置条件1", "前置条件2"],
  "steps": "1. 步骤1描述\n2. 步骤2描述\n...",
  "expected": "【输出】验证点1 | 【过程】验证点2",
  "oracle_refs": [
    {"spec_id": "SPEC-RESP-WRAP", "assert_level": "L2", "field": "result.<obj>.status.state", "authority": "spec-required"},
    {"spec_id": "SPEC-CARD-URL", "assert_level": "L0", "field": "card.url", "authority": "config-dependent"}
  ],
  "acceptance_refs": [
    {"standard_id": "PE-SW-CONTRACT-COVERAGE", "dimension": "software_testing", "release_gate": "must_for_release"}
  ],
  "evidence_required": ["trace_files", "case_results.json"],
  "professional_notes": ["Professional_experience is advisory; oracle strength remains contract-first."],
  "param_overrides": [
    {"param": "state", "values": ["COMPLETED","FAILED"], "step_ref": 3}
  ],
  "truncated_branches": [
    {"id": "FS-001-E03", "reason": "exception超过min上限"}
  ]
}]
```

- **`test_type`（必填，测试维度）**：默认 `"scenario"`（场景维度，已实现，进入 stage4 执行）；`"dfx"` 为**规划占位**（Design for X：可靠性/性能/安全等非功能维度，仅登记、不生成可执行代码、由编排器跳过 stage4）。继承自来源场景的 test_type，场景未标注时默认 `scenario`。详见 shared/scenario_schema.md。
- `dimension`：可选，仅当 `test_type="dfx"` 时填写（reliability / performance / security / …），scenario 时为 null。
- **`case_kind`（必填）**：用例的 E2E 类别（正常/变体/异常/边界/质量/约束/交叉），用于设计覆盖统计与 P0 多样性选取。
- **`oracle_refs`（必填）**：用例每个判据对应的 contract.md specId + 断言层级 + 字段路径 + 权威性（spec-required / config-dependent / needs-runtime-verify）。**每条用例的 oracle 必须引用 contract.md 的某个 specId**。供 stage4 直接据此从 contract.md 取断言、决定强校验还是放宽。
- `acceptance_refs`：可选，来自 `.state/professional_case_guidance.json`，用于说明该用例支撑的 Professional_experience 验收标准；不得作为强断言来源。
- `evidence_required`：可选，来自 Professional_experience，用于提示 stage4/stage5 应保留哪些证据。
- `professional_notes`：可选，记录专业验收解释或人工复核建议。
- `param_overrides`：可选，仅变体/边界/异常E2E填写。
- `truncated_branches`：可选。
- **`fault_ref`（可选）**：故障导向用例专用，值为 TestKnowledgeBase `fault_id` / `knowledge_id`（如 `F-REQ-011`），来自第3.5步；普通用例不含此字段。下游 `merge_test_design.py` 原样透传，stage5 据此统计知识/故障覆盖。
- steps 和 expected 必须是**纯文本字符串**。
- expected ≥ 2验证维度，且必须包含 ≥1个 L2 断言（层级定义见 shared/rules.md）。

**断言层级要求**（详见 shared/rules.md）：

| 层级 | 示例 | 单独合格 |
|------|------|----------|
| L0 类型/存在 | "返回非空"、"含 result 字段" | ❌ |
| L1 结构/数量 | "事件数>0"、"含 artifacts 数组" | ❌ |
| L2 值/语义 | "末态=COMPLETED"、"错误码=-32601"、"id 回带等于请求 id" | ✅ |

每个 expected 必须含 ≥1个 L2 断言。**例外**：当涉及字段 specId 为 config-dependent/needs-runtime-verify 时，该字段判据降为 L0/L1（仅验存在），但用例整体仍须有 ≥1个落在 spec-required 字段上的 L2 断言。
- 禁止步骤中使用代码术语（Service/handler/builder 等内部类名）。

### 第五步：写入输出

Write `{output_dir}/test_design_batch_{batch_id}.json`

### 第六步：人工评判（强制，不可跳过）　人工确认：✅

> **理由**：本 skill 无规格库（spec DB），测试设计的取舍/优先级/oracle 选取正确性需**人工补位评判**。设计错则下游生成的代码批量同错——因此在进入 stage4 代码生成前**强制**让人确认或修正测试设计。

1. 先向用户**简要呈现**本批设计结论：用例清单（case_id / name / case_kind / priority / test_type）、各 case_kind 数量分布、oracle 溯源情况（每条用例引用的 contract specId）、被截断分支（truncated_branches）、以及任何 `test_type=dfx` 的规划占位项。
2. 调用 **AskUserQuestion**，请用户审阅并**修正**测试设计。建议提问维度（按实际取舍）：
   - 用例覆盖是否充分（有无漏覆盖的关键分支、是否过度展开）？
   - 优先级（P0/P1/P2）与截断取舍是否合理？
   - 每条用例的 oracle_refs（contract specId 选取与权威性分级）是否正确？
   - dfx 规划占位项是否需要调整或补充？
3. 处理用户反馈：
   - 用户**确认无误** → 标记"人工确认：✅"，进入 stage4。
   - 用户**提出修正** → 按反馈回改 `test_design_batch_{batch_id}.json` 中对应用例，必要时重跑相关自检，再次确认。
4. **门禁**：未获得用户确认（AskUserQuestion 未完成）**禁止**宣告设计完成、禁止进入 stage4 代码生成。

### 第七步：返回摘要

```
## S3b-batch完成摘要

| 项目 | 结果 |
|------|------|
| 处理场景 | X 个 |
| 生成用例 | X 个 |
| 用例类别(case_kind) | 正常 X / 变体 X / 异常 X / 边界 X / 质量 X / 约束 X / 交叉 X |
| 测试维度(test_type) | scenario X / dfx 占位 X |
| oracle溯源 | 全部用例 oracle_refs 已指向 contract.md specId |
| 人工评判 | ✅ 已由用户审阅/修正并确认（AskUserQuestion） |
```

## ---END-PROMPT---
