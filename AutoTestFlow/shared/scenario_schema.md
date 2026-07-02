# 统一场景 JSON Schema

S1和S3a采用**拆分文件模式**：索引文件 + 逐场景文件。S2产出独立的 code_facts schema（见下方）。

## 文件组织

```
.state/
├── s1_index.json                    # S1轻量索引
├── s1_scenarios/                    # S1逐场景文件
│   ├── FS-001.json
│   ├── FS-002.json
│   └── ...
├── s3a_enriched_index.json          # S3a-code轻量索引
├── s3a_enriched/                    # S3a-code逐场景文件
│   ├── FS-001.json
│   └── ...
├── s3a_framework.json               # S3a-fw输出（单文件，通常较小）
├── s1_scenario_examples.md          # S1 JSON 的 LLM/人工可读投影（非权威源）
└── s3a_scenario_landscape.md        # S3a JSON 的 LLM/人工可读投影（非权威源）
```

`TestCases/test_examples.md` 是 `TestCases/test_design.json` 的确定性 Markdown 投影。所有 Markdown companion 均由 `scripts/render_design_markdown.py` 从 JSON 渲染，保留 JSON provenance、`test_suggestion_refs`、`oracle_refs`、`fault_ref`、`fault_oracles`、`acceptance_refs` 等追踪字段；JSON 仍是唯一机器协议与权威数据源。

## s1_index.json 结构（S1输出）

```json
{
  "meta": {
    "source": "requirement",
    "doc_path": ""
  },
  "function_points": [
    {
      "id": "FP-NNN",
      "name": "功能名称",
      "entry": "用户入口",
      "priority": "P0 | P1 | P2",
      "constraints": ["约束1"],
      "source_ids": ["FN_001"]
    }
  ],
  "test_suggestions": [
    {
      "id": "TS-NNN",
      "trigger": "触发条件/输入/场景线索",
      "focus": "测试关注点",
      "expected": "期望结果/门禁标准",
      "priority": "P0 | P1 | P2",
      "method": "E2E | exception | boundary | DFX | manual | null",
      "gate": "发布/验收门禁或 null",
      "source": "文档章节/表格标题/行号线索",
      "status": "mapped | not_applicable",
      "not_applicable_reason": ""
    }
  ],
  "scenario_index": [
    {
      "id": "FS-NNN",
      "name": "场景名称",
      "type": "flow",
      "priority": "P0 | P1 | P2",
      "fp_refs": ["FP-NNN"],
      "test_suggestion_refs": ["TS-NNN"],
      "file": "s1_scenarios/FS-NNN.json"
    }
  ]
}
```

## 单场景文件结构（s1_scenarios/FS-NNN.json 和 s3a_enriched/FS-NNN.json 共用）

```json
{
  "id": "FS-NNN",
  "name": "场景名称",
  "type": "flow | framework | quality",
  "test_type": "scenario | dfx",
  "priority": "P0 | P1 | P2",
  "source": "requirement | code",
  "test_suggestion_refs": ["TS-NNN"],
  "verify_points": ["验证点1"],
  "steps": [
    {
      "seq": 1,
      "action": "用户操作描述",
      "fp_ref": "FP-NNN",
      "data_scope": "数据实体/字段",
      "check": "成功判定"
    }
  ],
  "branches": {
    "parameter": [],
    "boundary": [],
    "exception": [],
    "quality": [],
    "constraint": [],
    "cross": []
  }
}
```

## s3a_enriched_index.json 结构（S3a-code输出）

在 s1_index 基础上增加富化元数据：

```json
{
  "meta": {
    "source": "requirement",
    "doc_path": "",
    "module_role": "独立功能 | 支持性组件"
  },
  "function_points": [
    {
      "id": "FP-NNN",
      "name": "功能名称",
      "entry": "用户入口",
      "priority": "P0 | P1 | P2",
      "constraints": ["约束1"],
      "source_ids": ["FN_001"],
      "code_entry": "真实代码入口（enriched时补充）",
      "gap_status": "matched | not_found | null"
    }
  ],
  "scenario_index": [
    {
      "id": "FS-NNN",
      "name": "场景名称",
      "type": "flow",
      "priority": "P0 | P1 | P2",
      "fp_refs": ["FP-NNN"],
      "file": "s3a_enriched/FS-NNN.json",
      "enriched_stats": {
        "+parameter": 0,
        "+boundary": 0,
        "+exception": 0,
        "+constraint": 0,
        "+quality": 0
      }
    }
  ],
  "fp_mapping": [
    {
      "fp_id": "FP-NNN",
      "status": "matched | not_found | code_only",
      "code_entry": ""
    }
  ],
  "gap_summary": {
    "not_implemented": ["FP-NNN"],
    "code_only": ["entry_name"]
  }
}
```

## e2e_scenes.json 结构（merge脚本输出，合并后单文件）

```json
{
  "meta": {
    "source": "requirement | code",
    "doc_path": "",
    "module_role": "独立功能 | 支持性组件"
  },
  "function_points": [ ... ],
  "flow_scenarios": [ ... ]
}
```

flow_scenarios 中每个元素与单场景文件结构相同，额外字段：
- framework_scene: 原始框架场景ID（仅 type=framework）
- linked_scene: 关联的flow场景ID（仅 type=framework/quality）
- skip_reason: 不可验证项标注（仅quality类型）

## 字段说明

### scenario_index（索引文件特有）

| 字段 | 必填 | 说明 |
|------|------|------|
| id | 是 | 场景编号 FS-NNN |
| name | 是 | 场景名称 |
| type | 是 | flow / framework / quality |
| priority | 是 | P0/P1/P2 |
| fp_refs | 是 | 涉及的FP ID列表 |
| test_suggestion_refs | 否 | 该场景整体覆盖的显式测试建议ID列表（TS-NNN） |
| file | 是 | 对应的场景文件相对路径 |

### test_suggestions

| 字段 | 必填 | 说明 |
|------|------|------|
| id | 是 | 显式测试建议编号 TS-NNN |
| trigger | 是 | 文档给出的触发条件、输入或场景线索；无明确触发时写关注对象 |
| focus | 是 | 测试关注点 |
| expected | 是 | 期望结果、验收门禁或应观察的现象 |
| priority | 是 | P0/P1/P2；无显式优先级时按风险推断 |
| method | 否 | 建议测试方法，如 E2E/exception/boundary/DFX/manual |
| gate | 否 | 发布/验收门禁；无则为 null |
| source | 是 | 文档章节、表格标题、行号线索或原文摘要 |
| status | 是 | mapped / not_applicable |
| not_applicable_reason | 否 | status=not_applicable 时必填 |

每条 `status=mapped` 的建议必须被至少一个场景、分支或用例的 `test_suggestion_refs` 引用；确实不可测或不适用时使用 `not_applicable`，并保留理由。

### function_points

| 字段 | 必填 | 说明 |
|------|------|------|
| id | 是 | 统一编号 FP-NNN |
| name | 是 | 用户可观测行为描述 |
| entry | 是 | 用户入口（类名.方法名 / 配置项） |
| priority | 是 | P0/P1/P2 |
| constraints | 是 | 约束条件列表，无则为空数组 |
| source_ids | 是 | 原始编号（["FN_001"] 或 ["CF_001"]） |
| code_entry | 否 | 真实代码入口（仅 s3a_enriched_index） |
| gap_status | 否 | matched/not_found（仅 s3a_enriched_index） |

### 单场景文件字段

| 字段 | 必填 | 说明 |
|------|------|------|
| id | 是 | 编号 FS-NNN |
| type | 是 | flow=流程 / framework=框架 / quality=质量 |
| test_type | 是 | 测试维度。`scenario`=场景维度（flow/framework/quality，本 skill 已实现并落地执行）；`dfx`=DFX 维度（可靠性/性能/安全等非功能，当前为**规划占位**，仅登记不生成可执行用例）。默认 `scenario` |
| test_suggestion_refs | 否 | 该场景覆盖的显式测试建议ID列表 |
| verify_points | 是 | 主流程验证点列表 |
| steps | 是 | 至少1个步骤 |
| branches | 是 | 6类分支，无分支填空数组 |

### test_type / dimension（测试维度，通用）

> 与 `type`（flow/framework/quality，场景的内部分类）正交。`test_type` 标记该场景/用例属于哪个**测试维度**，便于按维度统计设计覆盖与执行结果。

| 取值 | 含义 | 状态 |
|------|------|------|
| `scenario` | 场景维度：基于需求/代码事实展开的功能流程、框架组合、质量属性场景 | 已实现（生成 + 执行） |
| `dfx` | DFX 维度：Design for X（可靠性 / 性能 / 安全 / 可维护性等非功能要求） | 规划占位（仅登记，不生成可执行用例；待后续版本实现） |

- 默认值为 `scenario`。未显式标注 `dfx` 的场景/用例一律按 `scenario` 处理。
- `dfx` 占位条目应记录其维度（如 `dimension: reliability|performance|security`）与触发线索，供报告 DFX 维度占位说明引用，**不参与 stage4 执行**。
| exploration_log | 否 | 追问发现记录（仅S1输出） |
| truncated_cross | 否 | 被截断的cross分支（仅id+description，超出5个上限时记录） |
| framework_scene | 否 | 原始框架场景ID（仅 type=framework） |
| linked_scene | 否 | 关联的flow场景ID（仅 type=framework/quality） |
| skip_reason | 否 | 不可验证项标注（仅quality类型） |

### exploration_log

| 字段 | 说明 |
|------|------|
| 追问轮次 | 执行的追问轮次数 |
| 新发现数 | 追问发现的新场景总数 |
| 终止原因 | 连续2轮无新发现 / 达到最大5轮 |

### steps

| 字段 | 说明 |
|------|------|
| action | 用户操作语言，禁止内部组件名 |
| fp_ref | 引用的FP id |
| data_scope | 该步骤处理的数据实体 |
| check | 该步骤的成功判定 |

### branches

每类分支的通用字段：

| 字段 | 说明 |
|------|------|
| id | FS-NNN-{类型缩写}{序号} |
| step_ref | 偏离的步骤序号（quality无此字段） |
| trigger | 触发/注入条件（boundary合并分支用values时不填，exception合并分支用sub_conditions时不填） |
| expected | 预期结果（同上，合并分支不填） |
| test_suggestion_refs | 覆盖的显式测试建议ID列表（TS-NNN），无则为空数组或省略 |

类型特有字段：

| 类型 | 缩写 | 额外字段 | 说明 |
|------|------|---------|------|
| parameter | A | param, values | 参数名和取值列表 |
| boundary | B | param(可选), values(可选) | 同参数多边界值合并时使用：values=[{trigger,expected}]，与 trigger/expected 互斥 |
| exception | E | sub_conditions(可选) | 同步骤同类失败合并时使用：sub_conditions=[{trigger,expected}]，与 trigger/expected 互斥 |
| quality | Q | risk_ref | 关联RK/CD/GAP的ID |
| constraint | C | constraint | 约束规则描述 |
| cross | X | cross_refs, fp_refs | 引用的分支ID列表和涉及的FP |

**boundary values 合并格式**（同 step_ref + 同参数时使用）：
```json
{
  "id": "FS-001-B01",
  "description": "summary_target边界值",
  "step_ref": 1,
  "param": "summary_target",
  "values": [
    {"trigger": "summary_target=10(最小值)", "expected": "摘要按最小值生效"},
    {"trigger": "summary_target=2000(最大值)", "expected": "摘要按最大值生效"}
  ]
}
```

**exception sub_conditions 合并格式**（同 step_ref + 同类失败时使用）：
```json
{
  "id": "FS-001-E01",
  "description": "db_config无效",
  "step_ref": 1,
  "sub_conditions": [
    {"trigger": "db_config为None", "expected": "抛出配置校验异常"},
    {"trigger": "db_config连接信息错误", "expected": "抛出连接异常"}
  ]
}
```

> 注：有 values/sub_conditions 时，顶层 trigger/expected 不再填写。无合并的分支仍使用原 trigger/expected 格式。

### fp_mapping（仅 s3a_enriched_index）

| 字段 | 说明 |
|------|------|
| fp_id | FP编号 |
| status | matched / not_found / code_only |
| code_entry | 匹配到的代码入口（not_found时为空） |

### enriched_stats（仅 s3a_enriched_index 的 scenario_index）

| 字段 | 说明 |
|------|------|
| +exception | 新增异常分支数（从exception_catalog补充） |
| +quality | 新增质量分支数（从code_defects补充） |

> 注：parameter/boundary/constraint由阶段1覆盖，阶段3a不再富化。

## 编号规则

| 对象 | 编号格式 |
|------|---------|
| 功能点 | FP-001, FP-002... |
| 场景 | FS-001, FS-002... |
| 参数分支 | FS-001-A01, A02... |
| 边界分支 | FS-001-B01, B02... |
| 异常分支 | FS-001-E01, E02... |
| 质量分支 | FS-001-Q01, Q02... |
| 约束分支 | FS-001-C01, C02... |
| 组合分支 | FS-001-X01, X02... |

---

## s2_code_facts.json 结构（阶段2输出）

```json
{
  "meta": {
    "source": "code",
    "module_role": "...",
    "code_path": "...",
    "primary_profile": "java.spring | python.web_api | cpp.service_rpc | generic.source_tree",
    "language": "java | python | cpp | unknown",
    "frameworks": ["..."],
    "profile_confidence": 0.0,
    "scan_plan": ".state/code_scan_plan.json"
  },
  "entry_catalog": [...],
  "exception_catalog": [...],
  "constraint_catalog": [...],
  "serialization_facts": [...],
  "code_defects": [...],
  "code_only_capabilities": [...]
}
```

`primary_profile` 等 profile 字段为可选扩展；旧产物不含这些字段时下游脚本必须继续兼容。

### entry_catalog

| 字段 | 说明 |
|------|------|
| class | 公开类名 |
| method | 方法名 |
| signature | 完整方法签名 |
| params | [{name, type, required, default}] |
| source_file | 源文件路径 |
| transport | 可选：HTTP/RPC/gRPC/SSE/WebSocket/needs-runtime-verify |
| framework | 可选：Spring/FastAPI/Flask/Django/gRPC/其他 |
| evidence | 可选：源码证据 file:line |

### exception_catalog

| 字段 | 说明 |
|------|------|
| exception_type | 异常类型 |
| message_pattern | 错误信息模式 |
| trigger_condition | 触发条件 |
| enclosing_method | 所在方法（class.method） |
| location | 文件:行号 |
| reachable_from | 可达的入口方法列表（class.method），用户可通过这些入口触发该异常 |
| error_code | 可选：对外错误码、HTTP status 或 RPC status |

### serialization_facts

| 字段 | 说明 |
|------|------|
| fact_type | response_wrapper / id_type / enum_naming / streaming_event / error_shape / self_description |
| target | 关联入口、响应类型或字段 |
| shape | 静态推断的线缆形态 |
| evidence | 源码证据 file:line，无法确定时填 needs-runtime-verify |
| authority_hint | spec-required / deployment-config-dependent / needs-runtime-verify |

### constraint_catalog

| 字段 | 说明 |
|------|------|
| constraint_type | param_validation / type_check / param_interaction |
| target | 目标方法（class.method） |
| rule | 约束规则 |
| trigger | 触发条件 |
| location | 文件:行号 |

### code_defects

| 字段 | 说明 |
|------|------|
| id | CD-NNN |
| desc | 缺陷描述 |
| severity | 高/中/低 |
| location | 文件:行号 |

### code_only_capabilities

| 字段 | 说明 |
|------|------|
| entry | 场景主入口方法 |
| related_methods | 同一操作主题下的全部相关方法 |
| description | 用户操作场景描述 |
| evidence | 独立场景判定依据 |
| scenario_type | independent=独立用户场景 / sub_operation=应归入已有场景 |

---

## framework_scenes.json 结构（阶段2派生产物）

阶段2 在静态扫描源码结构后**自动派生**框架 E2E 场景，写入 `.state/framework_scenes.json`。
本文件是 **stage3a-fw 子Agent 消费的内部产物**，替代了迭代6 由外部 helper skill 预生成的 `e2e_framework_scenes.md`——不再需要外部文件，也不需要手工预生成步骤。
派生方法学见 `shared/code_scan_guide.md`；Java/Spring 细节见 `shared/java_scan_guide.md` profile 附录。

```json
{
  "meta": {
    "source": "code",
    "derived_by": "stage2",
    "source_profile": "java.spring | python.web_api | cpp.service_rpc | generic.source_tree",
    "note": "从源码结构静态派生；运行时仍以 stage2.5 contract.md 校准为准"
  },
  "framework_scenes": [
    {
      "id": "E2E-FW-NNN",
      "category": "核心引擎 | 数据存储 | 通信 | 编排 | 插件 | 配置 | 工具",
      "modules": ["模块/包/类名列表"],
      "call_chain": ["controller → service → component（跨模块调用链）"],
      "entry_hint": "用户可观测入口提示（对外端点/协议 method）",
      "related_fp_hint": "可能关联的需求功能点线索（供 stage3a-fw 匹配 FP）"
    }
  ]
}
```

### framework_scenes 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| id | 是 | 框架场景编号 E2E-FW-NNN |
| category | 是 | 模块分类：核心引擎 / 数据存储 / 通信 / 编排 / 插件 / 配置 / 工具 |
| modules | 是 | 涉及的模块/包/类名列表 |
| call_chain | 是 | 跨模块调用链（controller→service→component），单模块入口可只含1环 |
| entry_hint | 是 | 用户可观测入口提示（对外端点/协议 method），无则填 null |
| related_fp_hint | 否 | 可能关联的需求功能点线索，供 stage3a-fw 匹配 FP |

> 派生原则：**静态派生**线索，**运行时仍以 stage2.5 contract 校准为准**。代码无法确定的入口/形态标 `needs-runtime-verify`。

---

## 测试用例 test_type 字段（阶段3b 产出）

阶段3b 将场景展开为测试用例，每个用例必须携带 `test_type` 维度字段（取值同上）：

| 字段 | 必填 | 说明 |
|------|------|------|
| test_type | 是 | 默认 `"scenario"`；`"dfx"` 为规划占位（仅登记，不生成可执行代码、不进入 stage4） |
| dimension | 否 | 仅当 test_type=`dfx` 时填写：`reliability` / `performance` / `security` / … |
| oracle_refs | 是 | 每条判据必须引用 `contract.md` 的某个 specId（见 stage3b 模板） |

> `test_type` 继承自来源场景；场景未标注时默认 `scenario`。`dfx` 用例由编排器跳过 stage4 执行。
