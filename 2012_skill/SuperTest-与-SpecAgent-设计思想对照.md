# SuperTest 技能 与 SpecAgent 设计的"测试智能体"思想对照

> 目的：论证用户的判断——SuperTest（GitCode `linlaughing/SuperTest`）与附件《OpenJiuwen SpecAgent
> 用例生成智能体与规格库 1.0 设计说明书》**同属"测试智能体"思想**：拒绝让生成器自我认证，把 LLM 关进
> 受约束、可追溯、带判据的工作流里高吞吐产出可信用例。
>
> 左列出处：附件设计说明书（§1.3 BR 红线 / §2.2 受约束工作流 / §3.2 规格库三层 / §3.3 六步流水线 / 附录）。
> 右列出处：SuperTest 仓库真实文件（迭代6 `req-test-analyzer/skill.md`、迭代1 `batch-gen-tests` 及 `shared/rules.md`、
> `skill_其他` 抽取助手、`skill_xyy/ai_reference` 资产）。

---

## 1. 逐维度对照

| 维度 | 附件 SpecAgent（用例生成智能体 + 规格库） | SuperTest 技能套件 | 是否同构 |
|------|-------------------------------------------|--------------------|:---:|
| **核心思想** | 人 – 智能体&规格库 – 测试对象 三层；快轴生成 / 慢轴验证 | 编排器 + 隔离子 Agent + 参考资产；生成链路 / 验证修复链路 | ✅ 同 |
| **大脑形态** | 受约束工作流，LLM 只填"设计用例"一步，其余确定性编排 | 迭代6 纯编排器：编排器零知识调度，业务交隔离子 Agent，合并交 Python 脚本 | ✅ 同（手段不同，理念一致） |
| **主流水线** | 六步：意图识别→读规格库→构造提示词→LLM 设计→解析→过滤链 | `req-test-analyzer` 标准模式 8 阶段：需求分析→代码扫描→3a(GAP/框架)→3b 设计→4a P0 验证→4b 批量→5 报告 | ✅ 同 |
| **判据/知识来源** | 规格库三层：检索层(找得到)+判定层(对得上,Oracle)+治理层(信得过) | `ai_reference/`：`framework_reference.md`/`test_common_template.md`/`e2e_framework_scenes.md`/`test_scenarios.json`/`issues_report.json` | ✅ 类比（见下"差异"） |
| **抗幻觉纪律** | BR-1 永不自我认证；BR-3 Oracle 只取规格库；不脑补、`design_only` 不判绿 | 禁止猜测 API（必须源自参考文件/Grep 核实）；缺陷导向"非为绿而绿"；不可验证项标 `skip_reason` | ✅ 同 |
| **质量闸** | 过滤链五道闸：可复现/有 Oracle/可追溯/非重复/置信度 | 断言分级 L0(禁)–L3，≥L1、正例≥L2、多维≥2；自动验证 + 修复环(≤3 轮)；阶段4a P0 人工检视点 | ✅ 同 |
| **隔离 / 契约** | "大脑与躯干只传两份 JSON"：`TestPlan` → `TestCase[]` | 文件即协议：阶段间只经 `.state/*.json`/`*.md`；子 Agent 全隔离、1 用例 1 Agent | ✅ 同 |
| **Mock 策略** | Mock 声明（WireMock / dummy-key / fake-handler），真骨架假叶子 | MockLLM(:8088) / Mock HTTP(:8000) / Mock MCP（SSE+STDIO） | ✅ 同 |
| **确定性 / 可复现** | 除 LLM 一步外全确定性；同输入同输出 | 阶段固定 + 合并/筛选/聚合交 Python 脚本（merge/select_p0/aggregate） | ✅ 同 |
| **可恢复 / 状态** | 现状标签贯穿；增量三回流保鲜 | `.state/progress.json` 检查点 + 产物反推 + 智能续跑 | ✅ 类比 |
| **覆盖红线** | 28 条 P0 锚点全覆盖；判据类型目录对齐 | RK/CD(高严重度)/GAP(P0/P1) 强制全覆盖；FP flow+framework 全覆盖 | ✅ 同 |
| **目标** | 派生与人写版同构、可对账、带可信判据的用例；产物永远是候选待人裁 | "发现 SDK 缺陷而非让用例通过"；测试设计可人工评审后回灌 | ✅ 同 |
| **DFX / 质量维度** | 七维 DFX；负向/边界/并发/安全/可观测用例类型 | 迭代1 四策略：interface / performance / reliability / security | ✅ 类比 |
| **数据回流** | 运行回流层：误报库 / 缺陷判据 / badcase 经人裁决下沉 | `gitcode-defect-stats`/`gitcode-test-scenarios` 把历史缺陷/用例挖成 `issues_report.json`/`test_scenarios.json` | ✅ 类比 |

---

## 2. 一句话同构总结

> **两者都把"测试用例生成"重构成"受约束工作流 + 独立判据"的工程**：LLM 负责窄域的"设计/生成"，
> 客观判据（SpecAgent 的规格库 Oracle / SuperTest 的参考资产 + 分级断言 + 执行验证）负责"判真假"，
> 编排层（SpecAgent 的六步固定编排 / SuperTest 的编排器+脚本）负责"保确定、保可追溯、保可复现"。
> 这正是附件 P1 强调的破局思想——**拒绝让同一个生成器当自己的裁判**。

---

## 3. 关键差异（诚实标注，避免误读为完全等同）

1. **黑盒 vs 灰盒（最大差异）**：SpecAgent 有硬红线 **BR-3"Oracle 只取规格库、永不读被测代码"**，
   判据来自契约快照/状态机矩阵等独立资产；SuperTest **会主动扫描代码**（阶段2 code_scan）找 GAP/CD 场景，
   并以 `framework_reference.md` 等"从代码/测试仓抽取"的资产为权威。即 SpecAgent 更偏黑盒独立裁判，
   SuperTest 偏灰盒（资产部分源自被测/测试代码）。

2. **判据的"权威性"来源不同**：SpecAgent 的 Oracle 是人焊死的红线 + 经审核的契约（判定权威性）；
   SuperTest 的"判据"是抽取/统计得到的参考资产 + 可执行断言（更偏工程经验与可执行性），并未强调
   "判据必须独立于被测实现"。

3. **技术栈与锚定对象**：SpecAgent 锚定 **Java / Spring AI / spring-ai-ascend v0.1.0** 单一 SUT，
   黑盒经 `/a2a`；SuperTest 面向 **Python / pytest**，通用于任意框架（仓库样例锚定 openJiuwen Agent SDK）。

4. **LLM 用量**：SpecAgent 把 LLM 收敛到"只填一步"；SuperTest 是**多子 Agent 协作**（需求分析、代码扫描、
   场景、设计、生成、报告各有 LLM 子 Agent），靠隔离 + 文件协议 + 脚本合并来控住不确定性，而非压到一步。

5. **形态**：SpecAgent 是一份**架构设计说明书 + demo/platform 双形态工程**（规格库 + 六步流水线的完整设计）；
   SuperTest 是**已落地、可直接安装使用的 Claude Code 技能套件**，更偏即用工具，但缺少 SpecAgent 那种
   显式的"规格库/治理层/现状标签"抽象。

---

## 4. 可互相借鉴的点

- **SpecAgent 可借鉴 SuperTest**：① 断言分级 L0–L3 作为过滤链"有效断言"的量化口径；② 编排器+隔离子 Agent +
  文件即协议，作为"受约束工作流"的一种高并发实现；③ `gitcode-defect-stats`/`test-scenarios` 的数据挖掘，
  直接充实规格库的"运行回流层/测试自有资产"。
- **SuperTest 可借鉴 SpecAgent**：① BR-3 式"判据独立于被测实现"的纪律，提升 Oracle 权威性；② 现状标签
  （`shipped/design_only/spec_gap`）与"`design_only` 不判绿"，让灰盒/未实现项不产生假性结论；③ 规格库治理层
  （版本 + 出处行号 + 现状标签）让参考资产可回滚、可审计。

> 出处口径同前：左列引自附件设计说明书，右列引自上传的 SuperTest 仓库真实文件；gitcode.com 不在本环境
> 出网白名单内，未能直连线上仓库二次核对。
