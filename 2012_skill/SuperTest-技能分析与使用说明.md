# SuperTest 技能套件 · 分析与使用说明

> 对象：开源技能仓库 **SuperTest**（GitCode `linlaughing/SuperTest`）。
> 视角：把它当作一个"测试智能体"工程来拆解——它"是什么、怎么用、靠什么保证不胡编"。
> 资料口径：以用户上传的仓库 zip 为准（含完整迭代历史 `skill_迭代1..6`、产品化版 `skill_xyy`、
> 抽取助手 `skill_其他`、精简变体 `temp/`）。下文引用的技能名、触发词、阶段名、脚本名、资产名均来自真实文件。

---

## 1. 概述与定位

### 1.1 它是什么

SuperTest 是一套**面向 AI 测试生成的 Claude Code 技能套件（Skill Suite）**。每个技能是一个目录，内含
`SKILL.md`/`skill.md`（说明 + 工作流）、可选 `scripts/`（可执行脚本）、`templates/`（子 Agent 提示词/模板）、
`shared/`（跨阶段规则与状态机）、以及 `ai_reference/`（参考资产）。Claude/Cursor 读取 `SKILL.md` 后，按其中
**强制有序的工作流**驱动整个测试设计与生成过程。

它要解决的痛点：测试用例"写起来机械、重复、还容易写成'只要能跑通'的假用例"。SuperTest 把这部分机械工作
交给智能体批量完成，让人聚焦需求分析、缺陷分析与流程优化。

> ⚠️ 命名澄清：此 SuperTest **不是** Node.js 生态里那个做 HTTP 断言的 `supertest` 库，而是一套
> "AI 测试生成技能包"。两者只是重名。

### 1.2 一句话价值

> 输入"需求文档（+可选代码/PR/Commit）+ 框架端到端场景"，输出"端到端测试设计（`test_design.json`）
> 以及**经过自动执行验证、可通过的** `pytest` 测试代码 + 测试报告"，并在过程中以参考资产为权威、以分级断言
> 与修复环兜底，确保用例**真能抓缺陷**而非"为绿而绿"。

---

## 2. 设计思想：一个"测试智能体"

SuperTest 的内核与附件《SpecAgent 设计说明书》高度同构（详见对照文档），可概括为四点：

1. **受约束的多阶段流水线，而非自治 Agent**：阶段固定、顺序固定、确定性合并由 Python 脚本完成，
   LLM 只在"分析/设计/生成"这些窄域发挥，整体可复现、可审计、可断点续跑。
2. **编排器 + 隔离子 Agent（迭代6 成型）**：主 Agent 只做调度（"零知识调度"，不读业务文件内容、
   只看文件是否存在和几 KB 的 `progress.json`），每个阶段由独立子 Agent 执行，**文件即协议**
   （阶段间只通过 `.state/*.json`、`*.md` 传递），子 Agent 之间无上下文耦合。
3. **参考资产即"知识/判据"**：`framework_reference.md`（复用资产 API 唯一真相源）、`test_common_template.md`
   （用例格式模板）、`e2e_framework_scenes.md`（框架全局 E2E 场景）、`test_scenarios.json`（历史用例库）、
   `issues_report.json`（历史缺陷分布）——这些是智能体生成时必须对齐的客观依据。
4. **抗幻觉纪律内建**：禁止猜测 API、断言分级 L0–L3、1 用例 1 Agent、自动验证 + 修复环、缺陷导向。

> 对应附件"快轴/慢轴"：抽取资产 + 需求/代码分析 + 用例设计 + 代码生成 = 快轴（高吞吐生成）；
> 自动执行验证 + 修复环 + P0 人工检视点 + 报告对账 = 慢轴（验证与把关）。

---

## 3. 仓库结构与演进

### 3.1 顶层结构

```
SuperTest-main/
├── skill_迭代1 .. skill_迭代6     # 作者的演进历史（迭代6 最新最成熟）
├── skill_xyy/                     # 产品化版：核心技能 + 两个 GitCode 数据挖掘技能 + ai_reference 样例
│   ├── req-test-analyzer/         #   核心：需求驱动 E2E 用例生成器
│   ├── e2e-framework-analyzer/    #   框架 E2E 场景分析
│   ├── gitcode-defect-stats/      #   GitCode 历史缺陷统计（含 scripts/*.py）
│   ├── gitcode-test-scenarios/    #   GitCode 测试场景抽取（含 scripts/*.py）
│   └── ai_reference/              #   样例资产：framework_reference / test_*_template / *_scenes / *.json
├── skill_其他/                    # 抽取助手（生成"依赖文件"）
│   ├── extract-framework-aw/      #   抽取复用资产 → framework_reference.md
│   ├── extract-framework-e2e/     #   探测框架结构 → e2e_framework_scenes.md
│   └── extract-test-template/     #   抽取用例格式 → test_common_template.md
└── temp/                          # 精简变体（迭代2"精简版不生成自动化代码"）
```

### 3.2 演进叙事（迭代1 → 迭代6）

| 迭代 | 主题 | 关键变化 |
|------|------|----------|
| **迭代1** | 双技能地基 | `batch-gen-tests`（代码/commit-diff 驱动，5–6 阶段）+ 框架抽取；引入四类测试策略（接口/性能/可靠性/安全） |
| **迭代2** | 需求优先 | 支持"不传代码、只传需求 + 框架场景"；支持按 `--pr`/`--commit` 分析；正式化三类依赖文件 |
| **迭代3** | 状态化编排 | 引入 `.state/` 与 `progress.json` 检查点、阶段产物检测与断点续跑、测试设计人工评审点 |
| **迭代4** | 收敛 | 在迭代3 基础上微调，结构基本稳定 |
| **迭代5** | 最佳实践强化 | 强调需求文档为主源、示例代码质量影响、阶段4a 的 P0 人工检视点 |
| **迭代6** | 纯编排器 + 子 Agent | 从"单体提示串行"升级为"编排器零知识调度 + 子 Agent 全隔离 + 文件即协议 + 滑动窗口并发 + 双模式" |

> 迭代6 `skill.md` 原话：**"本 skill 采用纯编排器模式：主 Agent（编排器）只做调度，不读业务文件内容…
> 文件即协议：所有数据通过文件传递，Agent 间无上下文依赖。"**

---

## 4. 核心技能清单（逐个拆解）

### 4.1 `req-test-analyzer`（核心编排器 · 最常用）

- **frontmatter**：`name: req-test-analyzer`；
  `description: 需求驱动端到端测试生成器。从需求侧出发生成端到端场景（flow/framework/quality）…`
- **触发词**：`/req-test-analyzer`、"需求测试分析"、"需求侧测试"、"端到端场景生成"
- **输入（参数）**：
  - `requirement_doc`（**必填**，需求文档路径）
  - `code_path` / `--pr` / `--commit`（三选一，**均不提供则进入纯需求模式**）
  - `--framework-scenes`（**必填**，框架端到端场景文件，由用户提供，skill 不生成）
  - `--output-dir`（默认 `analysis_output/`）、`--case-batch-size`（阶段4b 并行数，默认 5）、
    `--p0-count`（阶段4a P0 数，默认 3）、`--max-fix-attempts`（默认 3）、`--start-stage`（自动检测）、
    `--repo-url`/`--base`（PR/Commit 模式用）
- **双模式**：
  | 模式 | 触发 | 流程 | 产物 |
  |------|------|------|------|
  | 标准模式 | 提供 code_path/`--pr`/`--commit` 之一 | `0(可选)→1→2→3a→3b→4a→4b→5` | 完整测试代码 + 报告 |
  | 纯需求模式 | 以上均未提供 | `1→2R→3aR→3b（终止）` | 测试设计文档（不生成代码） |
- **三类场景**：`flow`（用户操作链路）/ `framework`（框架场景×功能点）/ `quality`（RK/CD/GAP 注入到链路的质量分支）。
- **强制覆盖红线**：`RK_xxx` / `CD_xxx(高严重度)` / `GAP_xxx(P0/P1)` 全覆盖；`FP_xxx` flow+framework 全覆盖；
  不可验证项标 `skip_reason`，不生成无意义用例。
- **E2E 层级约束**：所有用例必须从**用户可见入口**（Agent/Runner/Session/Workflow/公开 API）驱动，
  **禁止绕过用户层直接调用内部组件**（processor/handler/私有 `_方法`）。

### 4.2 `batch-gen-tests`（代码 / commit-diff 驱动 · 迭代1）

- **frontmatter**：`name: batch-gen-tests`；触发词 `/batch-gen-tests`、`/e2e-test-generator`、
  "端到端测试生成"、"批量生成测试用例"、"commit测试生成"。
- **两种模式**：① 从代码路径自动生成 E2E 场景→设计→用例；② 从 commit 分析 diff，对变更文件生成测试。
- **六阶段（commit 模式）**：`stage0_commit_diff`（diff 分析）→ `stage1_scenes`（E2E 场景）→
  `stage2_design`（测试设计）→ `stage3_parse`（解析为 case_list）→ `stage4_generate_and_verify`
  （单用例生成 + pytest 验证 + 修复≤3 轮）→ `stage5_report`（报告）。
- **四类测试策略**（`guides/strategies/`，可作为 SpecAgent 的 DFX 维度参考）：
  | 策略 | 场景前缀 | 关注点 |
  |------|----------|--------|
  | 接口 interface | `ITF-{module}-{seq}` | 参数/边界/异常/返回类型/默认值 |
  | 性能 performance | `PRF-{module}-{seq}` | 响应时间/吞吐/并发/资源占用 |
  | 可靠性 reliability | `RLB-{module}-{seq}` | 故障注入/超时/降级/恢复 |
  | 安全 security | `SEC-{module}-{seq}` | 越权/注入/鉴权绕过/敏感数据泄露 |

### 4.3 抽取助手（`skill_其他/`，生成"依赖文件"，同项目可复用）

| 技能 | 触发词 | 作用 | 产物 |
|------|--------|------|------|
| `extract-framework-e2e`（亦即 `e2e-framework-analyzer`） | `/extract-framework-e2e`、"框架场景分析" | 探测框架模块/类/依赖，启发式分类，识别 E2E 场景 | `e2e_framework_scenes.md`（**必选**） |
| `extract-framework-aw` | `/extract-utils`、"抽取工具资产" | 扫描公共模块/fixtures/基类/mock/工具函数，编录可复用资产（≤400 行） | `framework_reference.md`（生成代码时必选） |
| `extract-test-template` | `/extract-test-template`、"提取测试模板" | 分析现有用例的文件头/导入/装饰器/docstring/断言模式，统一为格式模板 | `test_common_template.md`（生成代码时必选） |

> `extract-framework-aw` 自带上下文控制策略：用 Grep + `head_limit` 取代整文件 Read、大项目用子 Agent 隔离、
> 流式拼装；产出"1 行调用链"压缩示例，避免参考文档膨胀。

### 4.4 GitCode 数据挖掘技能（`skill_xyy/`，把历史数据回流成知识资产）

| 技能 | 触发场景 | 脚本 | 产物 |
|------|----------|------|------|
| `gitcode-defect-stats` | 给 GitCode 仓库地址，要"缺陷统计/issue 导出/bug 分析" | `fetch_issues.py` / `fetch_pr_diffs.py` / `parse_issues.py` | `issues_report.json`（缺陷类型/根因/模块/类/方法/功能点分布） |
| `gitcode-test-scenarios` | 给 GitCode 仓库地址，要"提取测试场景/统计用例/分析覆盖" | `fetch_test_files.py` / `parse_test_scenarios.py` / `analyze_feature_points.py`(LLM) | `test_scenarios.json`（用例ID/系统/模块/类/方法/功能点/场景） |

- 抽取策略：**PR diff 优先、文本兜底**；排除 `tests/`、`docs/` 目录的改动；遵守 API 限频（50/min）、支持断点续跑；
  功能点由 LLM 批量（每批 10 条）从代码逻辑 + docstring 提炼为 10–30 字中文描述。
- 样例规模（仓库内自带）：`test_scenarios.json` 约 **2410** 条历史场景；`issues_report.json` 约 **686** 条缺陷，
  其中功能类缺陷 95.5%、"功能未实现"占 62.8%、根因"需求层面"占 45.5%——这正是用来**指导用例优先级**的客观分布。

---

## 5. 端到端使用流程（推荐链路）

> 引自迭代6 `README.md` 的两步法，命令为真实示例。

### Step 1 · 生成依赖文件（同一项目可复用，放在执行目录的 `ai_reference/`）

```text
ai_reference/
├── e2e_framework_scenes.md   # 必选 —— /extract-framework-e2e /path（开发仓根目录）
├── framework_reference.md    # 生成自动化代码必选 —— /extract-framework-aw /path（测试仓根目录）
├── test_common_template.md   # 生成自动化代码必选 —— /extract-test-template /path（测试仓示例代码目录）
└── test_req_template.md      # 非必选 —— 直接放写好的 smoke 示例代码，提升生成质量
```
> 开源场景可直接用仓库 `ai_reference_开源直接用/` 里的现成内容；自有业务场景才需用上述 skill 生成。

### Step 2 · 用 `req-test-analyzer` 生成测试设计与代码

```bash
# 用法1：传代码目录 + 需求 + 框架场景
/req-test-analyzer ai_reference/README.md openjiuwen/core/session/interaction \
  --framework-scenes ai_reference/e2e_framework_scenes.md

# 用法2：不传代码，只传需求 + 框架场景（纯需求模式，只到测试设计）
/req-test-analyzer ai_reference/README.md --framework-scenes ai_reference/e2e_framework_scenes.md

# 用法3：按 PR/Commit 分析（多个用逗号分隔）
/req-test-analyzer ai_reference/README.md --pr 123,124,125 \
  --repo-url https://gitcode.com/openJiuwen/agent-core --base develop \
  --framework-scenes ai_reference/e2e_framework_scenes.md
```

### 产物目录

```text
{output_dir}/
├── requirement_analysis.md       # 阶段1 需求分析摘要
├── code_analysis.md              # 阶段2 代码分析摘要
├── test_design.json              # 阶段3b（Python merge 出的总测试设计）
├── test_design_batch_*.json      # 阶段3b 各批次设计
├── test_{case_id}.py             # 阶段4 生成的用例代码
├── report.md                     # 阶段5 报告
└── .state/
    ├── progress.json             # 检查点（断点续跑依据）
    ├── skeleton/                 # 阶段1 示例代码
    ├── s1_scenarios/FS-*.json    # 阶段1 需求侧场景（设计来源1）
    ├── s3a_enriched/FS-*.json    # 阶段3a S1复制 + GAP 场景（设计来源2）
    ├── s3a_framework.json        # 阶段3a-fw 框架场景（设计来源3）
    └── results/{case_id}.json    # 阶段4 每用例结果
```

### 使用 tips（来自作者 README，实战要点）

1. 需求文档是测试设计**主要来源**，最好含完整端到端链路、对外接口定义、约束与参数说明。
2. 有测试框架时，直接在框架目录下打开 claude 并备好执行环境——阶段4 会"生成→尝试修复 3 次→留下能通过的用例"。
3. 提供示例代码（`test_req_template.md`）或用 `extract-framework-aw` 提取框架信息，都能显著提升用例质量。
4. 测试设计生成后可**人工评审**，简化后给出最终 `test_design.json`，再 `--start-stage 4` 重跑代码生成。
5. **阶段4a 先生成 level0（P0）用例并设人工检视点**，务必与模型多轮沟通保证 P0 正确——它直接影响 4b 批量质量。

---

## 6. `req-test-analyzer` 流水线详解（迭代6）

### 6.1 标准模式阶段表

| 阶段 | 子 Agent / 脚本 | 职责 | 关键产物 | 人工确认 |
|------|------------------|------|----------|:---:|
| 0（可选） | — | 从 PR/Commit 取代码 | — | ❌ |
| 1 | `stage1_req_analyze` | 需求侧场景分析（功能点/主流程/分支） | `s1_index.json` + `s1_scenarios/*` | ❌ |
| 2 | `stage2_code_scan` | 代码事实扫描（入口/模块角色/可达异常/CD 缺陷） | `s2_code_facts.json` + `stage_summary.json` | ❌ |
| 3a-gap | `stage3a_gap` | 从代码独有能力生成 GAP 场景 | `s3a_enriched/FS-GAP-*.json` | ❌ |
| 3a-fw | `stage3a_framework` | 框架场景补充 | `s3a_framework.json` | ❌ |
| 3a-merge | `scripts/merge_enriched.py` | 合并 S1 + GAP（确定性） | `s3a_enriched_index.json` | ❌ |
| 3b | `stage3b_batch_design` | N-Agent 批量用例设计（小文件模式） | `test_design_batch_*.json` | — |
| 3b-merge | `scripts/merge_test_design.py` | 合并批次 → 总设计 | `test_design.json` + `scene_tc_mapping.json` | ✅ |
| 4-prep | `scripts/select_p0.py` | 选 P0 + 生成校验门脚本 | `p0_selection.json` + `validate_test.py` | ❌ |
| 4a | `stage4a_p0_verify` | P0 深度验证（最多 2 并发，金标准） | `test_*.py` + `results/*.json` | ✅ |
| 4b | `stage4b_batch_gen` | 批量生成（滑动窗口，≤`case-batch-size` 并发） | `test_*.py` + `results/*.json` | ❌ |
| 4-agg | `scripts/aggregate_results.py` | 汇总结果（确定性） | `case_results.json` | ❌ |
| 5 | `stage5_report` | 报告（CD 清单 / GAP 差异 / SDK 缺陷 / 执行摘要） | `report.md` | ❌ |

> 纯需求模式：`1 → 2R(req_summary) → 3aR(framework) → 3b` 终止，只产出测试设计、不生成代码。

### 6.2 编排与并发要点

- **零知识调度**：编排器只填模板占位（`{skill_dir}/{output_dir}/{requirement_doc}/{code_path}/{framework_scenes}`）、
  起子 Agent、检查输出文件存在性、更新 `progress.json`；**不读业务文件内容**。
- **并发**：阶段1‖2 并行；阶段3a-gap‖3a-fw 并行；阶段3b 按 `case-batch-size` 切批，每批 1 个 Agent；
  阶段4a 最多 2 并发，阶段4b 滑动窗口维持满载；高量阶段用 `run_in_background=True`，编排器不累积返回。
- **确定性合并交给 Python 脚本**：`merge_enriched.py` / `merge_test_design.py` / `select_p0.py` /
  `aggregate_results.py`——把"合并/筛选/聚合"从 LLM 手里拿走，保证可复现。
- **断点续跑**：状态在 `.state/progress.json`；状态文件丢失时按"阶段产物文件是否存在"反推已完成阶段；
  阶段4 通过 `case_results` 识别未完成用例继续跑。

---

## 7. 跨阶段纪律与质量保障（抗幻觉核心）

来自 `shared/rules.md` 与各 `skill.md` 的硬规则：

- **断言分级（L0–L3）**：
  | 级别 | 含义 | 能否抓缺陷 | 例 |
  |------|------|:---:|----|
  | L0（禁止） | 仅查存在性/非空 | 否 | `assert result is not None` / `assert len(x)>0` |
  | L1（最低） | 查关键字段值 | 弱 | — |
  | L2（合格） | 结构 + 值 + 类型/数量 | 能 | `assert result == {"output":"30","type":"answer"}` |
  | L3（优秀） | L2 + 副作用/状态/日志 | 高 | L2 + `assert "tool_call" in caplog.text` + 前后状态对比 |
  规则：所有断言 ≥ L1；正向用例 ≥ L2；高优先级 ≥ L2；**每个用例 ≥ 2 个不同维度断言**（内容维 + 过程维）。
- **禁止猜测 API**：类名/方法名/构造参数/导入路径/返回结构一律**不得臆造**，必须源自参考文件
  （`framework_reference.md`/`test_common_template.md`）或 Grep 核实；生成代码带可追溯注释。
- **1 用例 1 Agent**：硬约束，即使相关用例也不合并；单用例完整生命周期=读参考→生成→验证→修复(≤3 轮)→记录结果。
- **自动验证 + 修复环**：生成后用 `python -m py_compile` / `pytest` 验证；失败按错误类型分类
  （`api_error`/`assertion_error`/`env_issue`/`sdk_issue`）并有界修复≤3 轮。
- **缺陷导向**：明确"**测试目的是发现 SDK 缺陷，而不是让用例通过**"；env/sdk 问题如实归类，不靠改用例掩盖。
- **Mock 支撑**：参考资产提供 MockLLM(:8088) / Mock HTTP(:8000) / Mock MCP（SSE+STDIO），用于隔离真实依赖。

---

## 8. 安装与调用方法

> SuperTest 即标准 Claude Code Skill，安装方式与官方一致（参见 https://code.claude.com/docs/zh-CN/skills）。

1. **放置技能**：把所需技能目录（含 `SKILL.md`/`skill.md`）放到
   - 个人级：`~/.claude/skills/<skill-name>/`，或
   - 项目级（团队共享）：`<repo>/.claude/skills/<skill-name>/`。
   典型组合：`req-test-analyzer` + `skill_其他` 下三个抽取助手（按需再加 `gitcode-*`）。
2. **准备依赖文件**：在执行目录建 `ai_reference/`，按第 5 节 Step 1 生成/拷贝 `e2e_framework_scenes.md` 等。
3. **重启并校验**：完全重启 Claude Code（`/exit` 或 Ctrl+C 后重开），`/help` 应能看到对应命令/技能。
4. **调用**：输入触发词（如 `/req-test-analyzer …`、`/extract-framework-e2e …`）或自然语言触发场景词。
5. **环境变量**：
   - `gitcode-*` 技能读取 `GITCODE_TOKEN`（访问 GitCode API）；
   - 自动化执行依赖被测框架的模型/服务环境变量（示例：`MODEL_PROVIDER`、`MODEL_MODEL`、`MODEL_API_BASE`、
     `MODEL_API_KEY`、`MODEL_TEMPERATURE/TOP_P/TIMEOUT` 等，配合 MockLLM 使用）。

---

## 9. 适用场景与小结

- **最适合**：对一个 Python SDK/框架（仓库内锚定为 openJiuwen Agent SDK）做"需求/变更驱动"的端到端用例批量生成，
  且希望生成的用例真能执行、能抓缺陷、可断点续跑、可人工评审介入。
- **可迁移的方法论**：受约束多阶段流水线、编排器+隔离子 Agent、参考资产即判据、断言分级、禁猜 API、
  缺陷导向、数据回流（缺陷/场景统计）——这些与本项目 SpecAgent 的设计一一呼应（见对照文档）。

> 诚实标注：本文所有技能名、触发词、阶段名、脚本名均来自上传仓库的真实文件；因 gitcode.com 不在本环境出网
> 白名单内，未能直连线上仓库做二次核对，如线上有更新以线上为准。
