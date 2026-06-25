# wiki_demo · 纸面 trace：LLM Wiki 如何应用于 stage2.6b 与 stage6

> 本文是**纸面推演**（不运行真实 LLM），逐步演示 `--beta-wiki on` 时 wiki 文章如何为两个 LLM 阶段提供
> advisory 上下文，并**始终被 `contract.md` 封顶、不作 oracle**——即 `07` §五价值场景的可执行印证。
> 输入：`faults.sample.json`（含 F-REQ-011）+ `contract.md` + `fault_matches.slice.json` + `golden/wiki/F-REQ-011.md`。
> 「逻辑正确」的判定标准：每一步的输入/输出/封顶规则可被人工逐条核对，且不违反任何红线。

---

## 场景 A：stage2.6b —— 借 wiki 把 unbound 验证点绑定到契约 specId

### 输入
- `fault_matches.slice.json` 的 F-REQ-011 条目含：
  - 已绑定 oracle：`SPEC-RESP-WRAP`、`SPEC-ERR-32603`
  - `enrich.needs_bind=true`，`unbound_points=["响应id字段回带"]`（脚本无法确定性对到 specId 的模糊点）
- `contract.md` §2/§7：`SPEC-ID-TYPE`（字段 `id`，类型 string）= **spec-required**
- `golden/wiki/F-REQ-011.md`：「预期行为 → 验证点」列出 `响应id字段回带`；
  「契约锚点」说明候选种类 + **"不声明无条件断言级别，以 contract 为准"**

### LLM 子 Agent（beta 模板 `stage2_6_fault_match.beta.md`）推理链
1. 读 `enrich.unbound_points` → 待绑定点 `"响应id字段回带"`。
2. 【wiki 上下文】读 `wiki/F-REQ-011.md`，理解该点语义：**响应的 `id` 须回带请求 `id`**（关乎幂等/可追溯）。
   —— wiki 在此**仅提供语义线索**，不提供判据。
3. 到 `contract.md` specId 目录**实际查证**：语义最贴近的是 `SPEC-ID-TYPE`（`id` 回带，string）。**命中**。
4. 计算断言级别：`min(故障 assertion_level=L2, SPEC-ID-TYPE 权威性上限)`。
   `contract.md §7` 中 `SPEC-ID-TYPE = spec-required → 上限 L2` ⇒ `assert_level = L2`。
   —— **封顶来自 contract，而非 wiki**。

### 输出（对 F-REQ-011 条目的增量改写）
```jsonc
"oracle_refs": [
  { "spec_id": "SPEC-RESP-WRAP", "field": "result.<obj>.status.state", "assert_level": "L2", "authority": "spec-required", "validation_point": "响应包含error字段或状态字段指示失败" },
  { "spec_id": "SPEC-ERR-32603", "field": "error.code", "assert_level": "L2", "authority": "spec-required", "validation_point": "错误码或message指示资源不存在或关联无效" },
  // ↓ 本步新增（wiki 辅助语义，contract 命中并封顶）
  { "spec_id": "SPEC-ID-TYPE", "field": "id", "assert_level": "L2", "authority": "spec-required", "validation_point": "响应id字段回带" }
],
"enrich": { "resolved": true, "still_unbound": [] },
"wiki_ref": "F-REQ-011"        // 仅可追溯标注，不影响断言
```
`meta.enrichment`：`{ "enriched": 1, "newly_bound": 1, "contract_conflict": 0, "still_unbound": 0, "wiki_assisted": 1 }`

### 红线核对（人工可验）
- ✅ 断言级别 = L2 **仅因** `SPEC-ID-TYPE` 在 contract 是 spec-required；wiki 未抬高级别。
- ✅ 若 contract **无** `SPEC-ID-TYPE`：第 3 步查证不命中 → 该点写入 `still_unbound`（观察），**不**因 wiki 臆造 specId。
- ✅ wiki 缺失（无 `wiki/F-REQ-011.md`）→ 跳过第 2 步，回退稳定模板逻辑，结果可能 `still_unbound`，但**绝不出错绑定**。

---

## 场景 B：stage6 —— 借 wiki 丰富 issue 的「规格库知识」半边证据

### 输入（设某次执行产生 sdk_defect）
- `results/TC_041.json`：`sdk_defect{ spec_id:"SPEC-RESP-WRAP", field:"result.task.status.state", expected:"FAILED", actual:"COMPLETED" }`
  （对不存在的 `metadata.agentId` 仍返回 COMPLETED）
- `fault_ref = F-REQ-011`；`contract.md §7`：`SPEC-RESP-WRAP = spec-required`
- `golden/wiki/F-REQ-011.md`：通俗描述 + 「常见根因方向」（入参校验缺失…）+ 「历史案例」链 `F-HIST-001`

### LLM 子 Agent（beta 模板 `stage6_defect_analyze.beta.md`）推理链
1. **判真伪**：`contract.md` 确认 `SPEC-RESP-WRAP = spec-required` → 可修缺陷。**（判据来自 contract）**
2. **定位**：s2_code_facts + 源码定位到 `TaskService.handle`；
   【wiki 上下文】`wiki/F-REQ-011.md`「常见根因方向：入参校验缺失」**指引**优先排查 `agentId` 校验缺失——
   但根因最终由**真实源码 + trace** 坐实（wiki 只缩小搜索范围）。
3. **issue.md (a) 规格库知识半边**：
   - 引 `contract.md` `SPEC-RESP-WRAP`(spec-required) + 字段（**判据锚点**）
   - 引 `fault_ref=F-REQ-011`：`name`/`validation_point`/`expected_behavior_raw`
   - 【wiki 增强】引 `wiki/F-REQ-011.md` 通俗描述与「历史案例 F-HIST-001」**增强可读性/可追溯性**，并注明出处 `wiki/F-REQ-011.md`
4. **issue.md (b) 实测结果半边**：trace 触发请求（agentId=nonexistent）+ 违例响应帧（state=COMPLETED）+ expected vs actual。

### 产物（issue.md 片段示意）
```markdown
## (a) 规格库 / 契约依据
- 契约 contract.md §1/§7：SPEC-RESP-WRAP（result.task.status.state）= spec-required ← 判据锚点
- 故障库 F-REQ-011「引用不存在的关联资源」：expected「应返回错误响应或终态 FAILED」
- 背景（wiki/F-REQ-011.md，由结构化库派生，advisory）：不存在关联资源应判失败；
  关联历史缺陷 F-HIST-001（类型一致性）佐证此端点历史脆弱点

## (b) 实测结果
- TC_041 trace：POST /a2a，metadata.agentId="nonexistent-7f3a" → result.task.status.state="COMPLETED"
- 期望 FAILED vs 实际 COMPLETED
```

### 红线核对（人工可验）
- ✅ "是否真实违例" 由 `contract.md SPEC-RESP-WRAP=spec-required` 判定，**不是** wiki。
- ✅ wiki 引用**标注出处**且仅在 (a) 半边作背景叙事；**未**替代 contract 锚点、**未**放宽断言。
- ✅ 根因以真实源码 + trace 坐实；wiki 只作方向指引。
- ✅ 若 `fault_ref` 为空或 `wiki/F-REQ-011.md` 缺失 → 跳过 wiki 引用，issue 仍由 contract + trace 两段证据成立（同稳定模板）。

---

## 结论

- **stage2.6b**：wiki 提供"验证点语义"线索 → 绑定更准；断言级别**仍由 contract 封顶**。
- **stage6**：wiki 提供"通俗描述/根因方向/历史关联" → issue 规格库半边更可信、可追溯；**判据仍是 contract**。
- 两阶段在 wiki 缺失时**字节级回退**到稳定模板逻辑。
- 上述链路的**确定性底座**（wiki 生成、溯源、不漂移、不越权、非 matcher）已由 `check_wiki.py` 全绿机械验证；
  本文演示的是 LLM 阶段的**预期推理逻辑**（真实 LLM 执行需用户在真实环境运行，见 README「诚实说明」）。
