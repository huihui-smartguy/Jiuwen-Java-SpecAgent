---
name: java-req-test-analyzer
description: 需求驱动的 Java/Spring 端到端测试生成器。从需求侧出发生成端到端场景，先用运行中的被测服务校准真实契约，再据真实形态生成可执行黑盒测试。触发词："/java-req-test-analyzer", "Java需求测试分析", "Java需求侧测试", "Java端到端测试生成"
---

# 需求驱动的 Java/Spring 端到端测试生成器

从需求侧出发，对 **Java/Spring** 被测系统(SUT)生成端到端测试。区别于通用版：在生成断言前**先用运行中的 SUT 校准真实契约**，并把"环境/断言/被测缺陷"三类失败严格分流，使 Oracle 权威、判定可信。

> **栈说明**：被测是 Java/Spring；执行代码按用户选定走 **Python pytest + httpx 黑盒**，打 SUT 的对外端点（如 A2A 的 `POST /a2a`）。这是已验证的跨栈方案——黑盒只依赖 HTTP/SSE 协议形态，不触碰 Java 内部组件。
> **anchor 非硬编码**：下文以 agent-runtime / A2A 作为示例锚点说明形态（result.task 包装、TASK_STATE_* 枚举、SSE oneof），但 skill 适用于任意对外暴露 HTTP/SSE 契约的 Java/Spring SUT；真实契约一律以 **stage2.5 产出的 `contract.md`** 为准。

## 双模式

| 模式 | 触发条件 | 流程 | 输出 |
|------|----------|------|------|
| **标准模式** | 提供 `code_path` / `--pr` / `--commit` 之一 | 0(可选)→1→2→**2.5**→3a→3b→4a→4b→5 | 真实契约校准 + 可执行黑盒测试 + 报告 |
| **纯需求模式** | 以上均未提供 | 1→2R→3aR→3b（终止） | 测试设计文档 |

> 标准模式在阶段2之后**强制插入阶段2.5「契约校准」**，这是本 skill 相对通用版（迭代6）的核心升级。纯需求模式无代码亦无运行服务，流程不变。
> 纯需求模式详细说明已内嵌于 `templates/stage2R_req_summary.md` 和 `templates/stage3aR_framework.md`。

## 核心流程

```
标准模式：
  ┌─阶段1(S1-Agent)───┐
  │ 需求侧场景分析     │
  │ → s1_index.json   │
  │ → s1_scenarios/*  │
 并│                   │
 行│                   │
  │                   │ → 编排器cp → 阶段2.5 → ┌─阶段3a-gap─┐ → 阶段3b（小文件）→ Python merge → 阶段4 → 阶段5
  └─阶段2(S2-Agent)───┘   契约校准      │ GAP场景生成 │
  │ Java代码事实扫描   │  (probe_contract │ └────────────┘
  └───────────────────┘   + contract.md)        ↕ 并行
                                          ┌─阶段3a-fw──┐
                                          │ 框架场景补充 │
                                          │ → s3a_framework.json │
                                          └──────────────┘

  阶段2.5 契约校准（关键门）：
    probe_contract.py --base-url {sut} → contract_samples.json
      ├─ SUT 可达 → 采样真实响应/SSE + 结合 stage2 Java 源事实 → contract.md（权威 Oracle）
      └─ SUT 不可达 → 退化：静态推导(读 SUT 源/SDK) + 标 needs-runtime-verify

纯需求模式：
  阶段1(S1-Agent) → 阶段2R(S2R-Agent) → 阶段3aR(S3aR-Agent) → 阶段3b(终止)
```

## 相对迭代6的四大升级（本 skill 的核心纪律）

| # | 升级 | 解决的上轮根因 |
|---|------|----------------|
| 1 | **阶段2.5 契约校准**：先探活/采样真实响应+SSE，产出 `contract.md`，断言一律以它为准，禁止臆测 | R1–R4：手写参考形态错(result.task 包装/id 类型/SSE oneof/AgentCard.url 语义)→12 条用例继承同一批错误假设全错(garbage-in-garbage-out) |
| 2 | **SUT 就绪门**：stage4 前用 probe 确认 SUT 就绪；不就绪整批标 `env_issue`，不误判用例 | missing-trace/无服务时只得 env_issue，却被当成用例失败 |
| 3 | **错误三分类**：失败分 `env_issue` / `assertion_failure` / `sdk_defect`，不靠改断言"洗绿" | 上轮缺少分流，形态假设错被误归为 SUT 缺陷或被强行改断言掩盖 |
| 4 | **交互轨迹一等公民**：pytest 复用 `reference/a2a_client.py` 内置记录器，逐帧打印+JSONL 落盘，stage5 报告含轨迹区 | 失败无可读证据，无法定位是测试侧还是 SUT 侧 |

## 场景设计原则

**一条用户操作链路 = 一个场景。** 同一链路的配置差异/异常分支不拆独立场景。

| 场景类型 | 来源 | 说明 |
|----------|------|------|
| **flow（流程驱动）** | 主流程 | 每条用户操作链路1个场景，含变体和异常子项 |
| **framework（框架组合）** | 框架场景×FP | 框架场景作为执行环境嵌入用户链路 |
| **quality（质量保障）** | RK/CD/GAP → branches.quality | 作为quality分支附着到已有链路，注入触发条件 |

> **断言来源约束（升级1）**：任何 flow/framework/quality 场景的预期结果(Oracle)在 stage3b/stage4 落为断言时，**必须能在 `contract.md` 找到对应的真实形态证据**（响应包装/字段路径/枚举/错误码/SSE 事件形态）。`contract.md` 未覆盖的断言点须标 `needs-runtime-verify`，不得凭需求文档措辞臆造响应结构。

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `requirement_doc` | 需求文档路径 | **必填** |
| `code_path` | Java/Spring 代码目录 | **可选**（与 --pr/--commit 三选一，均未提供则纯需求模式） |
| `--sut-base-url` | **运行中的被测服务基址**，供 stage2.5 校准与 stage4 执行 | `http://localhost:8080` |
| `--output-dir` | 输出目录 | `analysis_output/` |
| `--case-batch-size` | 并行Agent数量（阶段4b） | 5 |
| `--p0-count` | P0用例数量（阶段4a） | 3 |
| `--max-fix-attempts` | 最大修复轮数（阶段4b） | 3 |
| `--start-stage` | 从指定阶段开始 | 自动检测 |
| `--pr` | PR编号，逗号分隔 | 可选（与 code_path/commit 三选一） |
| `--commit` | Commit ID，逗号分隔 | 可选（与 code_path/pr 三选一） |
| `--base` | 基准分支 | 仓库默认分支 |

**注意**：
- `--sut-base-url` 若不可达，阶段2.5 自动退化为静态源推导（读 SUT 源/SDK）并标 `needs-runtime-verify`；阶段4 的 SUT 就绪门会因此整批标 `env_issue`。
- 模块角色、入口目录、代码缺陷从阶段2的 `s2_code_facts.json` + `stage_summary.json` 获取。
- 代码独有能力(code_only)由阶段3a-gap Agent 从 `s2_code_facts.json` 提取并生成 GAP 场景。
- 框架可复用资产与黑盒脚手架由 `reference/`（`a2a_client.py` + `conftest.py` + `framework_reference.md`）提供，skill 不重新生成。

## 模块角色分流

| 角色 | 场景类型 | 说明 |
|------|----------|------|
| 独立功能 | flow + framework + quality | 流程场景 + 框架组合 + 质量场景 |
| 支持性组件 | framework + quality | 框架场景组合 + 质量场景 |

## 强制覆盖规则

| 来源类型 | 覆盖规则 |
|----------|----------|
| RK_xxx | **强制全覆盖** |
| CD_xxx（高严重度） | **强制全覆盖** |
| GAP_xxx（P0/P1） | **强制全覆盖** |
| FP_xxx | flow+framework场景全覆盖 |
| 主流程 | 每个主流程有对应场景 |
| 相关框架场景 | 每个相关框架场景有对应场景 |
| 不可验证项 | 标注skip_reason，不生成无意义用例 |
| **契约偏差项** | contract.md 与需求文档形态不一致处（如三段式 SSE vs 实际 N×StatusUpdate）→ 以 contract.md 为准生成断言，并在 stage5 记为"需求-实现形态差异"观察 |

## E2E测试层级约束

**所有E2E测试必须通过用户可见的入口驱动，禁止绕过用户层直接调用内部组件。**

| 规则 | 说明 |
|------|------|
| FP提取聚焦用户入口 | 功能点描述用户可观测行为，入口记录用户触发方式，不提取 processor/handler 等内部组件 |
| 用例步骤用用户操作语言 | 禁止出现内部组件名（processor/handler/offloader/builder），步骤从用户视角描述 |
| 代码生成禁止内部API | 禁止直接实例化 Java 内部组件、调用私有方法、手写内部类 Stub |
| 黑盒执行入口 | 仅经 SUT 对外协议端点（如 `POST /a2a` + `GET /.well-known/agent-card.json`），复用 `reference/a2a_client.py` 暴露的方法，不绕过 |
| 测试入口 | 对外 HTTP/SSE API / 公开配置 / Agent Card 等可被外部客户端观测的入口 |

---

## 阶段间人工确认

**标记为"人工确认：✅"的阶段完成后，必须使用 `AskUserQuestion` 工具询问用户是否继续。标记为"❌"的阶段自动进入下一阶段。**

```python
AskUserQuestion(questions=[{
    "question": "阶段 X 已完成，是否继续执行阶段 X+1？",
    "header": "阶段确认",
    "options": [
        {"label": "继续", "description": "进入阶段 X+1"},
        {"label": "跳过后续", "description": "不再执行后续阶段，保留当前输出"},
        {"label": "重新执行", "description": "重新执行当前阶段（--start-stage=X）"}
    ],
    "multiSelect": false
}])
```

确认点：**3b merge 后**（提示检查 test_design.json）、**4a P0 后**（确认 P0 金标准质量）、**4b 后**（确认批量结果）。

---

## 编排器原则

**本skill采用纯编排器模式：主Agent（编排器）只做调度，不读业务文件内容。**

| 原则 | 说明 |
|------|------|
| 零知识调度 | 编排器只检查文件存在性、读几KB的 progress.json，不读业务文件 |
| 全Agent隔离 | 每个阶段由独立子Agent执行，编排器只收到一行摘要 |
| 后台化高量 | 阶段4a/4b的case级Agent用 `run_in_background=True`，编排器不累积返回 |
| 文件即协议 | 所有数据通过文件传递，Agent间无上下文依赖；contract.md 是 stage2.5→stage3b/4 的协议载体 |
| 阶段验证后更新 | 验证产出文件存在后，编排器 Write progress.json 更新阶段状态（子Agent不写） |

### 通用子Agent启动模式

对每个阶段，编排器执行：读取模板 → 替换参数 → spawn Agent → 验证输出 → 进入下一阶段。

```
1. Read templates/stage*_*.md → 替换参数得到 prompt
2. Agent(prompt=填充后prompt, description="阶段X", [run_in_background=True])
3. 验证输出文件存在（不读内容）
4. 如需人工确认 → AskUserQuestion
```

---

## 阶段映射表

| 阶段 | 模板 | 脚本/共享 | 输出 | 后台 | 确认 |
|------|------|-----------|------|------|------|
| 1 需求侧分析 | `templates/stage1_req_analyze.md` | `shared/scenario_schema.md` | `.state/s1_index.json` + `.state/s1_scenarios/*` | ✅ | ❌ |
| 2 Java代码扫描 | `templates/stage2_code_scan.md` | `shared/code_analysis_template.md` + `shared/java_scan_guide.md` | `.state/s2_code_facts.json` + `.state/stage_summary.json` | ✅ | ❌ |
| 2.5 契约校准 | `templates/stage2_5_contract_calibrate.md` | `scripts/probe_contract.py` | `contract.md` + `.state/contract_samples.json` | — | ❌ |
| 2R 需求摘要（纯需求） | `templates/stage2R_req_summary.md` | — | `.state/stage_summary.json` | — | ❌ |
| 3a-gap GAP场景 | `templates/stage3a_gap.md` | — | `.state/s3a_enriched/FS-GAP-*.json` | ✅ | ❌ |
| 3a-fw 框架场景 | `templates/stage3a_framework.md` | `reference/framework_reference.md` | `.state/s3a_framework.json` | ✅ | ❌ |
| 3aR 框架场景（纯需求） | `templates/stage3aR_framework.md` | — | `e2e_scenes.json` + `e2e_scenes.md` | — | ❌ |
| 3b 用例设计 | `templates/stage3b_batch_design.md` | `scripts/merge_test_design.py` + `shared/rules.md` | `test_design.json` + `scene_tc_mapping.json` | ✅ | ✅ |
| 3a 合并 | — | `scripts/merge_enriched.py` | `.state/s3a_enriched_index.json` | — | ❌ |
| 4a P0验证 | `templates/stage4a_p0_verify.md` | `scripts/select_p0.py` + `reference/a2a_client.py` + `reference/conftest.py` | `test_{id}.py` + `.state/results/{id}.json` | ✅ | ✅ |
| 4b 批量生成 | `templates/stage4b_batch_gen.md` | `scripts/aggregate_results.py` + `reference/` | `test_{id}.py` + `case_results.json` | ✅ | ✅ |
| 5 报告 | `templates/stage5_report.md` | — | `report.md` | ✅ | ❌ |

> 共享文件：`shared/scenario_schema.md`（场景JSON schema）、`shared/code_analysis_template.md`（阶段2输出格式）、`shared/rules.md`（断言层级/截断优先级规则）、`shared/java_scan_guide.md`（Java/Spring 扫描指引：Controller/端点/SDK 序列化形态）。
> 脚手架：`reference/a2a_client.py`（黑盒客户端 + 判据常量 + 交互轨迹记录器）、`reference/conftest.py`（pytest fixtures + 轨迹日志）、`reference/framework_reference.md`（黑盒可复用资产）。

---

## 执行流程

### 阶段1+2：并行启动（标准模式）

> 人工确认：❌ | 模式：标准

```
步骤1: 并行启动（run_in_background=True）
  → Agent-S1（需求侧场景分析）
    模板: templates/stage1_req_analyze.md
    参数: {skill_dir} {output_dir} {requirement_doc} {work_dir}
    输出: .state/s1_index.json + .state/s1_scenarios/FS-*.json + requirement_analysis.md（摘要）
    子Agent内部读取 shared/scenario_schema.md

  → Agent-S2（Java代码事实扫描）
    模板: templates/stage2_code_scan.md
    参数: {skill_dir} {output_dir} {code_path}
    输出: .state/s2_code_facts.json + .state/stage_summary.json（简化版）
    子Agent内部读取 shared/java_scan_guide.md（识别对外端点/Controller/SDK 序列化形态）
    ⚠️ 不读取需求侧任何文件，不生成场景

  → 等待全部完成，验证文件存在

步骤2: 自动进入阶段2.5（契约校准）
```

### 阶段2.5：契约校准（标准模式，升级1 核心门）

> 人工确认：❌ | 条件：标准模式
> **核心原则**：Oracle/断言一律以 `contract.md` 为准，禁止臆测真实响应形态。

```
步骤1: 编排器前景执行 probe（不启动重 Agent，<30s）
  → 执行: python {skill_dir}/scripts/probe_contract.py \
            --base-url {sut-base-url} \
            --output {output_dir}/.state/contract_samples.json
  → probe 探针（best-effort，单失败不中断其它）：
      GET /.well-known/agent-card.json
      POST /a2a SendMessage(sync, Accept json)
      POST /a2a 非法 body（parse error）
      POST /a2a unknown method
      POST /a2a GetTask 随机不存在 id
      POST /a2a SendStreamingMessage（读至多 N 个 SSE，Accept text/event-stream）
  → 输出 contract_samples.json：{base_url, reachable, samples[{name,request,http_status,
     response_or_events,observed}], notes}
  → observed 启发式：result.task 包装 / id int-vs-str / TASK_STATE_ 前缀 /
     SSE oneof(task/statusUpdate/artifactUpdate) / error.code

步骤2: 子Agent 产出 contract.md（templates/stage2_5_contract_calibrate.md）
  → 输入: .state/contract_samples.json + .state/s2_code_facts.json（Java 源事实）
  → 产出 contract.md：真实响应包装/字段/枚举/错误码/SSE 事件形态
  → 每一条契约项标注 spec-required（规约必须）vs deployment-config-dependent（部署配置相关，
     如 AgentCard.url 为空因 public-base-url 未配置）
  → 验证: contract.md 存在且含响应包装与错误码两节

步骤3: 可达性分支
  → reachable=true  → contract.md 以真实采样为权威
  → reachable=false → contract_samples.json 写 reachable:false（probe 已 exit 0，不崩溃）
                      → 子Agent 退化：静态推导(读 SUT 源/SDK 序列化) + 全条目标 needs-runtime-verify
                      → 编排器记录：stage4 SUT 就绪门将命中 → 整批 env_issue

自动进入阶段3a
```

### 阶段1 / 2R / 3aR：纯需求模式（子Agent执行）

> 人工确认：❌ | 条件：纯需求模式

- 阶段1：`templates/stage1_req_analyze.md`，输出 `.state/s1_index.json` + `.state/s1_scenarios/`，完成后自动进入 2R。
- 阶段2R：`templates/stage2R_req_summary.md`，从 `.state/s1_index.json` 提取统计，输出 `.state/stage_summary.json`（`mode=requirement_only` + `module_role=独立功能` + `cd_list=[]`），自动进入 3aR。
- 阶段3aR：`templates/stage3aR_framework.md`，S1场景直接复用 + 框架场景补充，输出 `e2e_scenes.json` + `e2e_scenes.md`，进入阶段3b（终止）。
- **纯需求模式不执行阶段2.5**：无运行服务可校准，断言点统一标 `needs-runtime-verify`。

### 阶段3a：GAP场景 + 框架补充（标准模式）

> 人工确认：❌ | 条件：标准模式
> **设计原则**：S1场景直接复用，仅补充代码独有能力(GAP)和框架场景。

```
步骤1: 编排器内联（不启动Agent）
  → Bash mkdir -p .state/s3a_enriched/ && cp .state/s1_scenarios/*.json .state/s3a_enriched/

步骤2: 2-Agent并行启动（run_in_background=True）
  → Agent-S3a-gap（GAP场景生成）
    模板: templates/stage3a_gap.md
    输入: .state/s1_index.json + .state/s2_code_facts.json
    输出: .state/s3a_enriched/FS-GAP-*.json
  → Agent-S3a-fw（框架场景补充）
    模板: templates/stage3a_framework.md
    输入: .state/s1_index.json + reference/framework_reference.md + .state/stage_summary.json
    输出: .state/s3a_framework.json
    ⚠️ 不读取 s2_code_facts.json
  → 等待全部完成，验证文件存在

步骤3: Python合并脚本（前景，<1秒）
  → 执行: python scripts/merge_enriched.py
  → 输出: .state/s3a_enriched_index.json

自动进入阶段3b
```

### 阶段3b：测试用例设计（小文件模式，N-Agent + Python merge）

> 人工确认：✅（3b完成后强制确认，提示用户检查并修改 `test_design.json`）

```
步骤1: 编排器读取索引（零知识调度）
  → Read .state/s3a_enriched_index.json 获取 scenario_index（只读id列表）
  → Read .state/s3a_framework.json 获取 framework_scenarios 数量
  → 计算批次分配：flow场景 + framework场景按 batch_size 分批

步骤2: 并行启动Batch Agent（run_in_background=True）
  → Agent-S3b-batch-N（按场景ID分配，每批≤batch_size）
    模板: templates/stage3b_batch_design.md
    参数: {skill_dir} {output_dir} {scene_ids} {next_seq}
    输入: 按需Read单场景文件 + contract.md（断言点须落在 contract.md 真实形态上）
    输出: test_design_batch_N.json
    ⚠️ 禁止读取大JSON文件，只Read索引、单场景文件、contract.md

步骤3: Python merge脚本（前景执行）
  → 执行: python scripts/merge_test_design.py
  → 输出: test_design.json + scene_tc_mapping.json + e2e_scenes.json（可选）
  → 验证: 三个文件均存在
```

> **小文件模式**：每个Batch Agent只Read索引(~5KB) + 按需单场景文件(~15KB) + contract.md，避免读取大JSON。
> **纯需求模式终止点**：阶段3b完成后终止，输出终止提示：

```
## 纯需求模式完成

已生成测试设计文档：
├── requirement_analysis.md     # 需求分析
├── .state/stage_summary.json   # 需求侧摘要（简化版）
├── e2e_scenes.md               # 端到端场景
├── e2e_scenes.json             # 结构化场景数据
├── test_design.json            # 测试用例设计（断言点标 needs-runtime-verify）
└── scene_tc_mapping.json       # 场景-用例映射

后续阶段（契约校准、代码生成、验证、报告）需要代码 + 运行中的 SUT。
如需继续生成测试代码，请提供 code_path 与 --sut-base-url 后重新执行。
```

### 阶段4：端到端黑盒测试代码生成与验证（多-Agent编排）

> 人工确认：✅（4a完成后确认P0，4b完成后确认）
> **核心原则**：4a先行P0验证产出金标准 → 4b参考P0批量生成 → 生成 Python pytest + httpx 黑盒，复用 `reference/` 脚手架，打 SUT 对外端点（如 `/a2a`）。

```
步骤0: SUT 就绪门（升级2，编排器前景执行）
  → 执行: python {skill_dir}/scripts/probe_contract.py --base-url {sut-base-url} \
            --output {output_dir}/.state/sut_ready.json --timeout 5
  → 读取 sut_ready.json 的 reachable 字段（探 health/agent-card）
  → if reachable == false:
      → 整批用例标 env_issue（保留已生成代码，不执行、不误判用例）
      → 写 case_results.json（全部 env_issue + note: SUT 未就绪）
      → AskUserQuestion: "SUT 在 {sut-base-url} 不可达。① 启动 SUT 后重跑阶段4 ② 仅生成代码不执行（全标 env_issue）"
      → 选②则跳到阶段5
  → reachable == true → 进入步骤1

步骤1: Python脚本（前景，<1s）
  → 执行: python {skill_dir}/scripts/select_p0.py --output-dir {output_dir} --p0-count {p0_count}
  → 输入: test_design.json + .state/stage_summary.json + contract.md
  → 输出: .state/p0_selection.json + .state/validate_test.py
  → 验证: 两个文件均存在

步骤2: 4a P0深度验证（max 2并发，run_in_background=True）
  → 读取 p0_selection.json 的 p0_cases 数组
  → 对每个P0用例：
    模板: templates/stage4a_p0_verify.md
    参数: {case_id} {case_name} {steps} {expected} {output_dir} {work_dir}
          {validate_script} {sut_base_url} {contract_path}
    生成: Python pytest，import reference/a2a_client.py 的 A2aClient + 判据助手
          （task_of / id_eq / event_kind 等，断言形态以 contract.md 为准）
    执行: 设 A2A_BASE_URL={sut-base-url} + A2A_TRACE_DIR={output_dir}/trace/ 跑 pytest
    输出: test_{case_id}.py + .state/results/{case_id}.json + trace/{case_id}.jsonl

步骤3: P0质量抽检（编排器轻量执行）
  → 对每个P0用例读取 .state/results/{case_id}.json（只读 status/error_class/trace_file/assert_level）
  → 抽检项：断言点有 contract.md 依据 | 轨迹文件存在(trace/{id}.jsonl) | 断言≥L2
  → 失败按错误三分类(升级3)判定，不靠改断言洗绿
  → 人工确认P0用例质量

步骤4: 4b 批量生成（滑动窗口 max batch_size 并发，run_in_background=True）
  → 读取 p0_selection.json 的 remaining_cases 数组
  → 对每个剩余用例：
    模板: templates/stage4b_batch_gen.md
    参数: {case_id} {case_name} {steps} {expected} {output_dir} {work_dir}
          {validate_script} {reference_case_file} {sut_base_url} {contract_path}
  → 滑动窗口：完成1个立即补1个，并发池始终满载
  → 编排器只维护 running 字典（不累积agent输出内容）

步骤5: Python脚本（前景，<1s）
  → 执行: python {skill_dir}/scripts/aggregate_results.py --output-dir {output_dir}
  → 输入: .state/results/*.json
  → 输出: case_results.json（每条含 error_class ∈ {pass, env_issue, assertion_failure, sdk_defect}）
  → 验证: case_results.json 存在
```

> **错误三分类（升级3，stage4 验证强制）**：
> | 分类 | 判据 | 处置 |
> |------|------|------|
> | `env_issue` | 连接拒绝/超时/SUT 未就绪/agent-card 取不到 | 保留代码，不判用例好坏；提示先启动 SUT |
> | `assertion_failure` | 连得通但判据不符 → 可能真缺陷，也可能断言需对照 contract.md 校准 | 先核 contract.md：形态对而值不符=候选缺陷；形态本身错=回 stage2.5 校准，**不得直接改断言洗绿** |
> | `sdk_defect` | 被测端异常(5xx/栈/契约违反)且 contract.md 确认形态应正确 | 记为确认 SUT 缺陷，进 stage5 缺陷清单 |

> **Prompt大小限制（4a/4b强制）**：传递给子Agent的内容 <5KB。禁止传 test_design.json 全文 / requirement_analysis.md / s2_code_facts.json 全文；只传 case_id + name + steps + expected + 参考路径 + contract_path + sut_base_url + output_dir + work_dir。
> **交互轨迹一等公民（升级4）**：生成的 pytest 通过 `reference/conftest.py` 的 autouse fixture 调 `a2a_client.set_current_case()`，并在环境变量 `A2A_TRACE_DIR` 下逐用例落 `trace/{case}.jsonl`（请求/响应/SSE 逐帧），pytest 以 `-s -rA --log-cli-level=INFO` 把 `>>>` / `<<<` / `[SSE]` 行写进日志。stage5 报告含轨迹区。

### 阶段5：测试报告生成（子Agent执行）

> 人工确认：❌（最终输出）

- 模板：`templates/stage5_report.md`
- 参数：`{skill_dir}` `{output_dir}`
- 输入：`case_results.json` + `contract.md` + `trace/*.jsonl`
- 验证：`report.md` 存在
- 报告须含：执行总结 | 错误三分类分布 | 确认 SUT 缺陷清单（仅 sdk_defect）| 需求-实现形态差异（contract 偏差观察）| **交互轨迹区**（关键用例的 `>>>`/`<<<`/`[SSE]` 摘录 + trace 文件指引）

---

## 输出文件（标准模式）

```
{output_dir}/
├── requirement_analysis.md       # 阶段1（摘要）
├── code_analysis.md              # 阶段2（摘要）
├── contract.md                   # 阶段2.5（真实契约，权威 Oracle）★
├── test_design.json              # 阶段3b（Python merge）
├── scene_tc_mapping.json         # 阶段3b
├── case_results.json             # 阶段4（含 error_class 三分类）
├── test_{case_id}.py             # 阶段4（Python pytest + httpx 黑盒）
├── report.md                     # 阶段5（含轨迹区）
├── trace/                        # 阶段4（交互轨迹）★
│   ├── {case_id}.jsonl
│   └── session.log
└── .state/
    ├── progress.json
    ├── s1_index.json
    ├── s1_scenarios/             # FS-*.json
    ├── s2_code_facts.json
    ├── contract_samples.json     # 阶段2.5（probe 真实采样）★
    ├── sut_ready.json            # 阶段4（SUT 就绪门探针结果）★
    ├── s3a_enriched_index.json
    ├── s3a_enriched/             # FS-*.json + FS-GAP-*.json
    ├── s3a_framework.json
    ├── stage_summary.json
    ├── p0_selection.json
    ├── validate_test.py
    └── results/                  # {case_id}.json
```

---

## 文件结构

```
java-req-test-analyzer/
├── SKILL.md                              # 主入口（编排器调度表）
├── scripts/
│   ├── probe_contract.py                 # 阶段2.5 契约校准探针（探活+采样真实响应/SSE）★
│   ├── merge_enriched.py                 # 阶段3a 场景合并
│   ├── merge_test_design.py              # 阶段3b 用例合并
│   ├── select_p0.py                      # 阶段4-prep P0筛选+门禁脚本生成
│   └── aggregate_results.py              # 阶段4-agg 结果聚合（三分类）
├── shared/
│   ├── scenario_schema.md                # 场景JSON schema
│   ├── code_analysis_template.md         # 代码分析输出格式（阶段2）
│   ├── rules.md                          # 断言层级/截断优先级规则
│   └── java_scan_guide.md                # Java/Spring 扫描指引
├── reference/
│   ├── a2a_client.py                     # 黑盒客户端 + 判据助手 + 交互轨迹记录器
│   ├── conftest.py                       # pytest fixtures + 轨迹日志
│   └── framework_reference.md            # 黑盒可复用资产
└── templates/
    ├── stage1_req_analyze.md
    ├── stage2_code_scan.md
    ├── stage2_5_contract_calibrate.md    # 阶段2.5 契约校准 子Agent Prompt ★
    ├── stage2R_req_summary.md
    ├── stage3a_gap.md
    ├── stage3a_framework.md
    ├── stage3aR_framework.md
    ├── stage3b_batch_design.md
    ├── stage4a_p0_verify.md
    ├── stage4b_batch_gen.md
    └── stage5_report.md
```

---

## 关键检查项（各阶段详细验证已内嵌于对应子Agent模板中）

- 阶段1：禁止查看代码 | FP三原则（单入口/单行为/可验证）| cross分支≤5 | FP清单 + flow_scenarios含steps和6类分支
- 阶段2：s2_code_facts.json 含对外端点/Controller/SDK序列化形态 + stage_summary.json含module_role | 入口仅编录对外API | 无内部组件
- 阶段2.5：contract_samples.json 由 probe 真实采样（reachable 标记）| contract.md 含响应包装/字段/枚举/错误码/SSE形态 | 每项标 spec-required vs deployment-config-dependent | 不可达则全标 needs-runtime-verify（probe exit 0 不崩溃）
- 阶段2R：stage_summary.json 含 `mode: "requirement_only"` + `module_role: "独立功能"` + `cd_list: []`
- 阶段3a：2-Agent并行（gap∥fw）| S1场景直接复制 | GAP从code_only生成 | 框架场景强制覆盖
- 阶段3aR：S1场景直接复用 | 仅框架场景补充 | 无去重/GAP
- 阶段3b：小文件模式（禁止读取大JSON）| 断言点须落在 contract.md 真实形态上，未覆盖标 needs-runtime-verify | 截断优先级规则 | 步骤无技术术语 | 预期结果≥2维度
- 阶段4a：SUT 就绪门通过 | 复用 reference/a2a_client.py 判据助手（task_of/id_eq/event_kind）| 断言形态以 contract.md 为准 | 轨迹文件 trace/{id}.jsonl 生成 | 断言≥L2
- 阶段4b：参考P0范例 | 三分类落地(env_issue/assertion_failure/sdk_defect) | 不改断言洗绿 | 门禁验证通过 | 轨迹落盘
- 阶段5：report.md 含三分类分布 + 确认SUT缺陷清单(仅sdk_defect) + 需求-实现形态差异 + 交互轨迹区
