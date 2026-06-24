# 07 · LLM Wiki 作为故障库/规格知识源的可行性分析

> 本文回应"知识库/故障库能否以 **LLM Wiki** 形式供 AutoTestFlow 使用"。承接 `05` §b（可插拔文件 vs MCP）、`06` §五（MCP 作源延后），把 **LLM Wiki** 作为第三形态做全谱系优劣分析，并落一个明确推荐与演进路线。
> **范围**：仅分析；不改 AutoTestFlow 代码、不跑 SUT。主线不变：仍以"**结构化文件为确定性核心**"。
> 一句话先行：**LLM Wiki 可以采用，但只作"由结构化库派生的 NL 建议层"供 LLM 阶段消费，不替代确定性 matcher 的结构化输入、不作 oracle。**

---

## 一、问题与"LLM Wiki"谱系

当前 `Specification_Repository/rest_api_common_faults.json` 是**纯结构化 JSON**（meta + 7 类故障 + history_faults，无自然语言散文），经本地可插拔文件接入。"LLM Wiki"指把这部分知识改以**自然语言（NL）文章**承载、由 **LLM 语义消费（甚至 LLM 生成/维护）**的知识库。它不是单一方案，而是一个谱系：

| 形态 | 形态说明 | 消费方式 | 典型实现 |
|---|---|---|---|
| **A · 仓内 NL 文章** | 故障/规格知识写成仓内 markdown 文章（per-fault / per-category），可由 LLM 从结构化库生成并维护 | 子 Agent 直接 Read / 按 `fault_id` 取 / 轻量关键字检索 | `Specification_Repository/wiki/*.md`（committed） |
| **B · 自建 RAG** | 把 NL 文章切块、向量索引，语义 top-k 检索 | stage 子 Agent 语义查询（embedding + retriever） | 向量库（FAISS/pgvector…）+ 检索服务 |
| **C · 外部 DeepWiki 式托管** | 自动从代码仓/知识源生成、经 API/MCP 问答的托管 wiki | 子 Agent 经 Tool/MCP 提问，服务端答 | Devin DeepWiki 类、或自建文档问答服务 |

三态共性：**知识以 NL 表达、面向 LLM 语义推理、可由 LLM 生成与增量维护**。差异在"在哪托管、是否需检索基建、是否离线、确定性强弱"——这正是下文对比的轴。

---

## 二、两类消费者决定一切（核心论点）

能不能用 LLM Wiki，取决于**谁来消费**。AutoTestFlow 的故障库有**两类性质截然不同**的消费者：

| 消费者 | 阶段 | 读取/依赖 | 所需知识形态 | 能否吃 LLM Wiki |
|---|---|---|---|---|
| `match_faults.py` | 2.6（纯脚本） | 结构化字段：`fault_id / _category / tags / applicable_scenarios / test_strategy{assertion_level,validation_points}`；四类触发匹配 + 按 `contract.md` 权威性**封顶**断言级别 | **稳定结构化 schema** | **否**：语义/概率/NL 会破坏确定性与可复现 |
| `record_faults.py` | 5（纯脚本） | `(spec_id, field)` + `fault_id` + `test_case_id` **精确去重** | **稳定结构化 schema** | **否**：NL 歧义会导致历史缺陷重复/漏去重 |
| stage2.6b 增强子 Agent | 2.6b（可选 LLM） | 自由文本 `validation_point` / `expected_behavior` / `trigger_pattern` 作语义线索，绑定 specId、检出 contract_conflict | NL/语义（advisory） | **是**：NL 叙事让语义绑定更准 |
| stage6 深析子 Agent + issue | 6（v2.0，LLM） | `fault_id/name`、`validation_point`、`expected_behavior_raw` 作根因/叙事素材；issue 的"规格库知识"半边证据 | NL/语义（advisory） | **是**：repro/根因/历史关联叙事直接增益 |

**结论引子**：LLM Wiki 天然适配**第二类（LLM 消费者）**，**不适配第一类（确定性消费者）**。因此它**不能替换结构化库作为 matcher 的源**——只能作为**与结构化库并存、供 LLM 阶段消费的 NL 建议层**。这一条决定了后文所有取舍。

---

## 三、LLM Wiki 与 AutoTestFlow 内核的张力

把 LLM Wiki 套到流水线内核（`DESIGN.md` / `shared/rules.md` / `SKILL.md`）上，逐条对照：

| 内核不变量 | 出处 | 与 LLM Wiki 的张力 |
|---|---|---|
| **确定性 / 可复现**（同输入同输出、可单测） | `select_p0.py`/`match_faults.py` 纯脚本范式 | 语义检索（top-k 受 embedding/索引影响）+ LLM 生成内容**非确定**；同问不同答，难单测/回归 |
| **文件即协议 / 零知识调度** | `SKILL.md` 编排器原则 | 仓内 NL 文章=契合（又一被读文件）；RAG/外部=偏离（子 Agent 需持 Tool、处理调用/错误） |
| **`contract.md` 唯一 Oracle / 生成器不得自我认证** | `DESIGN.md` §2 | wiki 若断言"应如此"，等于引入**第二判据源**与**自我认证**风险；wiki 内容可能**幻觉**出并不被契约背书的"期望" |
| **不得删弱断言洗绿（5 分类红线）** | `shared/rules.md` §4 | wiki 不能成为"放宽断言"的借口；断言级别仍须按 `contract.md` 权威性封顶 |
| **可审计 / 版本快照** | `fault_matches.json.meta` 快照库版本 | NL 文章/检索结果若不快照则不可审计；LLM 重生成会**漂移** |
| **离线可用 / 数据不出域** | 纯本地文件 | 外部 DeepWiki / 远端 RAG 需在线，且把契约/端点**发往外部**，引入鉴权与数据外发面（同 `05` §b MCP 安全顾虑） |

**归纳**：LLM Wiki 与内核的冲突点全部集中在"**当它被当作判据(oracle)或确定性匹配输入**"时。只要把它限定为 **advisory（建议/上下文）层**——判据仍由 `contract.md` 封顶、matcher 仍吃结构化库、外部源在起点物化快照——这些张力即被化解。**wiki 只能当建议层，不能当判据层或确定性匹配输入。**

---

## 四、完整优劣对比（file / MCP / LLM Wiki）

在 `05` §b.4 七维基础上扩展，并补充 4 个与 LLM Wiki 强相关的维度：

| 维度 | 可插拔文件（确定性核心） | MCP 外接服务 | LLM Wiki（NL 建议层） |
|---|---|---|---|
| 确定性 / 可复现 | **强** | 弱（依赖服务端状态） | **更弱**：语义检索 + LLM 生成均非确定；需固定检索键 + 起点物化才可复现 |
| 可审计 / 版本快照 | **强**（meta 快照库版本） | 需额外版本化 | 需快照 + **溯源链**（文章→`fault_id`→contract specId）方可审计 |
| 离线可用 | **是** | 否 | A 仓内文章=是；B RAG / C 外部=否 |
| 零知识 · 文件即协议 | **契合** | 偏离 | A=契合（又一被读文件）；B/C=偏离（需 Tool/检索） |
| 集中化 · 跨项目共享 | 弱（submodule/复制/overlay） | **强** | **强**（B/C 态）；A 态弱 |
| 富查询 / 排序 | 无（静态配额） | **有**（结构化富查询/ML 排序） | **语义最强**：NL 问答最贴近 LLM 推理；但非确定 |
| 运维成本 / 安全 | **低**（无服务，数据不出域） | 高（托管 + 数据外发） | 中–高：A 低；B 需索引/嵌入；C 同 MCP 的托管 + 数据外发面 |
| **NL 表达力（供 LLM 推理）** | 弱（结构化字段，无叙事/示例/repro） | 中（结构化 + 少量字段） | **强**（叙事 + 示例 + repro + 历史关联，最利 LLM 根因/issue） |
| **作者 / 维护友好** | 中（改 JSON） | 中（改服务端 + 同步客户端） | **高**：写 NL 文章门槛低；LLM 可把 `history_faults` 自动摘要成文章（自维护） |
| **幻觉 / 可信风险** | **低**（纯数据） | 低–中 | **高**：LLM 生成内容可能失真；须溯源 + contract 封顶 + 不作 oracle |
| **适配消费者** | 确定性 matcher（唯一可靠输入） | matcher（物化后） | **仅 LLM 阶段**（2.6b/6/issue），**不喂 matcher** |

**LLM Wiki 三态（A/B/C）子对比**：

| 子维 | A 仓内 NL 文章 | B 自建 RAG | C 外部 DeepWiki 式 |
|---|---|---|---|
| 离线/确定性 | **强**（committed，可按 fault_id 确定性取） | 弱（检索非确定，可固定 query+快照缓解） | 弱（在线、非确定） |
| 运维/基建 | **无**（纯文件） | 中（向量库 + 嵌入 + 检索服务） | 高（托管服务/订阅） |
| 表达力/语义检索 | 中（靠目录/关键字/按 fault_id） | **强**（语义 top-k） | **强**（NL 问答） |
| 集中化/共享 | 弱 | 中–强 | **强** |
| 数据外发面 | **无** | 视部署（自托管可不出域） | 高（契约/端点发往外部） |

> 一句话：**file 占确定性/离线/可审计；MCP 占集中化/服务化；LLM Wiki 占 NL 表达力/作者友好/语义检索**。三者各擅其长、互不替代。

---

## 五、LLM Wiki 在哪里真香（价值场景）

LLM Wiki 的增量价值**全部落在 LLM 阶段**，且与 v2.0 自动修复强协同：

1. **stage2.6b 语义绑定更准**：自由文本 `validation_point`（如"响应 id 字段回带"）配上 NL 解释（为何重要：幂等/可追溯/契约一致），LLM 更准地绑定到 `SPEC-ID-TYPE` 等 specId、更稳地检出 `contract_conflict`。
2. **stage6 深析 + issue 叙事（最大增益）**：每个故障模式的 **repro 步骤 / 常见根因 / 关联历史缺陷 / 修复范式** 以 NL 文章供 stage6 读取，直接强化 v2.0 issue 的 **(a) 规格库知识** 半边证据（`templates/stage6_defect_analyze.md` 要求的两段证据之一），让"根据规格库哪些知识推断 bug 成立"更可信、可追溯。
3. **跨项目知识共享**（B/C 态）：与 MCP 的集中化优势同源——一处沉淀、多 SUT 复用故障经验。
4. **作者 / 维护友好 + LLM 自维护**：NL 文章比编辑 JSON 门槛低；可让 LLM 把 `record_faults.py` 沉淀的 `history_faults` **自动摘要成 wiki 文章**（含背景/复现/修复），降低知识维护成本。

---

## 六、风险与护栏

| 风险 | 护栏 |
|---|---|
| **幻觉**（wiki 编出不被契约背书的"期望"） | 每篇文章**强制溯源**到 `fault_id` + contract specId；LLM 阶段断言仍按 `contract.md` 权威性**封顶**；**wiki 不进 matcher、不作 oracle** |
| **漂移**（NL 文章与结构化库不一致） | **单一真相**：结构化 JSON 为 source of truth，wiki 由其**单向派生**（或反之，但必须单向编译，不双写） |
| **不可复现**（语义检索/外部源） | 外部/RAG 态套 `05` §b.5「**起点一次性物化版本化快照**到本地文件」，下游全程文件化 |
| **成本 / 延迟**（检索 + 大上下文） | 优先 A 态 in-repo 文章、按 `fault_id` 确定性取用，避免每阶段全量语义检索；必要时 prompt 缓存 |
| **数据外发 / 安全**（C/远端 B 把契约/端点发出域） | 优先 A（仓内、不出域）；若用外部，限定字段、走鉴权，纳入与 MCP 同级的数据外发评估 |
| **自我认证**（wiki 变第二判据源） | 判据唯一来源仍是 `contract.md`（`DESIGN.md` §2）；wiki 仅提供"该测什么/为何是 bug"的**上下文**，不提供"通过与否"的判定 |

---

## 七、推荐架构与演进路线

**架构定位（单一真相 + 派生建议层）**：

```
结构化故障库 rest_api_common_faults.json   ← 单一真相（source of truth）
   │  （matcher / record 的唯一可靠输入，不变；确定/可复现/可审计）
   ├──► match_faults.py / record_faults.py        [确定性消费者：吃结构化]
   │
   └──(单向派生 / LLM 摘要)──► LLM Wiki（NL 建议层，advisory）
          │  溯源回 fault_id + contract specId
          └──► stage2.6b / stage6 / issue          [LLM 消费者：吃 NL]
                 （判据仍由 contract.md 封顶；wiki 不作 oracle）
```

**演进路线（按需推进，越往后越重）**：

- **Phase A（推荐先做，低风险）**：**仓内派生 NL 文章**。由结构化库生成 per-fault / per-category 的 `Specification_Repository/wiki/*.md`（含 trigger/repro/根因/关联历史/contract 锚点），committed、可复现；stage2.6b/stage6 按 `fault_id` 确定性读取相关文章。**无新基建、不出域、契合文件即协议**，且直接增益 v2.0 issue 叙事。
- **Phase B（按需）**：若需规模化语义检索 → **自建 RAG** 索引这些文章；查询在流水线**起点物化快照**到本地（同 `05` §b.5），保确定/可复现。优先自托管以不出域。
- **Phase C（集中化）**：若需跨团队共享 → **外部 DeepWiki/MCP** 作"源/注册中心"，仍在起点物化快照、下游文件化。此时 LLM Wiki 与 MCP **叠加**（DeepWiki 经 MCP 暴露）。

**与三形态的关系**：`file=确定性核心、MCP=集中化源、LLM Wiki=NL 建议层`，**三者非互斥、可叠加**——典型终态是"结构化文件喂 matcher + 派生 NL wiki 喂 LLM 阶段 +（可选）经 MCP 集中化分发，起点物化快照"。

**明确结论（是否可采用）**：**可以采用**，但须满足四条边界——① 仅作 **advisory NL 层**供 LLM 阶段；② **单一真相在结构化库**、wiki 单向派生；③ **不作 oracle**（判据仍 `contract.md` 封顶）、**不替代 matcher 的结构化输入**；④ 外部/检索态**必物化快照**。落地**推荐 Phase A 起步**（仓内派生文章），与 v2.0 stage6/issue 即时协同，零基建、零数据外发。

---

## 八、一句话结论

LLM Wiki 可作"**由结构化库派生、供 LLM 阶段推理的 NL 建议知识层**"被 AutoTestFlow 采用，显著增强 stage2.6b 语义绑定与 stage6/issue 的"规格库知识"叙事；但**不可替代确定性 matcher 的结构化输入、不可作 oracle**；落地先走**仓内派生文章（Phase A）**，集中化/语义检索按需演进并一律**起点物化快照**——与 `file 确定性核心 + MCP 集中化源` 三位一体、互不替代。
