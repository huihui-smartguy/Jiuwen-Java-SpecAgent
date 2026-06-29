# 2012_skill · SuperTest 技能（测试智能体）分析

> 本目录沉淀对开源技能仓库 **SuperTest**（GitCode `linlaughing/SuperTest`）的分析与使用总结。
> SuperTest 与本项目附件《OpenJiuwen SpecAgent 设计说明书》同源同思想——都是 **"测试智能体（Test Agent）"**：
> 让大模型在**受约束、可追溯、带判据**的工作流里高吞吐地生成可执行测试用例，而不是让生成器自己当裁判。

## 一句话简介

SuperTest 是一套**面向 AI 测试生成的 Claude Code 技能套件（Skill Suite）**：以 `SKILL.md` 为说明、
以"抽取参考资产 → 分析需求/代码 → 设计场景与用例 → 生成并自动验证 pytest 代码 → 出报告"为主链路，
核心技能 `req-test-analyzer` 在最新迭代演进为**"编排器 + 隔离子 Agent + 文件即协议"**的多阶段流水线。

> ⚠️ 区分：此 SuperTest 是一套 **Claude Code 技能包**，不是 Node.js 的 HTTP 断言库 `supertest`。

## 文档导航

| 文档 | 内容 |
|------|------|
| [`SuperTest-技能分析与使用说明.md`](./SuperTest-技能分析与使用说明.md) | 主文档：定位、仓库结构与演进、7 个技能逐个拆解、端到端使用流程、流水线详解、质量纪律、安装与调用 |
| [`SuperTest-与-SpecAgent-设计思想对照.md`](./SuperTest-与-SpecAgent-设计思想对照.md) | 与附件 SpecAgent 设计的**逐维度对照表**与关键差异（用户明确要的"和附件一样是测试智能体"的论证） |

## 关键结论（速览）

1. **同为测试智能体**：SpecAgent = 受约束工作流（LLM 只填"设计用例"一步）+ 规格库（Oracle 源）；
   SuperTest = 纯编排器调度 + 隔离子 Agent + 参考资产（`framework_reference.md` / `test_scenarios.json` /
   `issues_report.json` 等充当"知识/判据"）。两者都把 LLM 的不确定性关进**固定阶段 + 强约束**的笼子里。
2. **抗幻觉是第一性**：SuperTest 用"**禁止猜测 API（必须源自参考文件或 Grep 核实）**+ **断言分级 L0(禁)–L3**
   + **自动验证·修复环(≤3 轮)**"来兜底；SpecAgent 用"BR-1 永不自我认证 / BR-3 Oracle 只取规格库 / 过滤链五道闸"。
3. **目的导向一致**：SuperTest 写明"**目的是发现 SDK 缺陷，而不是让用例通过**"，与 SpecAgent"判据源自 Oracle、
   产物永远是候选待人裁"是同一价值取向。
4. **关键差异**：SpecAgent 强约束"永不读被测代码"（黑盒，Oracle 只取规格库）；SuperTest 会**扫描代码**找
   GAP/CD 场景（灰盒）。SpecAgent 锚定 Java/Spring-AI 单一 SUT；SuperTest 是 Python/pytest 通用，并自带
   GitCode 缺陷/场景数据挖掘技能，把历史数据回流成知识资产。

> 调研来源：用户上传的 SuperTest 仓库 zip（含 `skill_迭代1..6` / `skill_xyy` / `skill_其他` / `temp`）。
> 因 gitcode.com 不在本环境出网白名单内，未能直连仓库，全部结论以上传内容为准。
