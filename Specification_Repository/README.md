# REST API 故障库使用指南

> 本故障库用于 AutoTestFlow 测试智能体，实现故障驱动的测试用例生成和缺陷积累。
> **最新版本：v1.1.0** | **最后更新：2026-01-18**

---

## 一、故障库概述

### 1.1 什么是故障库？

故障库是一个结构化的缺陷模式知识库，包含：

- **通用故障模式**：适用于所有REST/JSON-RPC项目的常见缺陷（51+模式）
- **项目特有故障**：针对特定项目的泛化故障模式（使用参数化配置）
- **历史缺陷记录**：从测试执行结果中自动积累的真实缺陷

### 1.2 核心价值

- ✅ **提升测试覆盖率**：从需求驱动（70-80%）→ 需求+故障驱动（90-95%）
- ✅ **增强缺陷发现能力**：自动注入历史缺陷重现用例 + 业界通用故障模式
- ✅ **降低维护成本**：故障库自动积累 + 版本管理 + 可追溯
- ✅ **标准化测试质量**：全局故障库标准化 + 项目特化适配
- ✅ **灵活可配置**：项目故障库使用参数化设计，适用于不同项目

### 1.3 故障库结构

```
故障库体系（v1.1.0）：
├── 全局故障库（rest_api_common_faults.json）
│   ├── 请求体缺陷（11个） ← 新增F-REQ-011
│   ├── 响应体缺陷（8个）
│   ├── 协议合规缺陷（7个）
│   ├── 状态流程缺陷（6个）
│   ├── SSE流式缺陷（6个）
│   ├── 安全相关缺陷（8个）
│   ├── 性能相关缺陷（4个）
│   └── 历史缺陷记录（动态积累，当前5个）
│
└── 项目级故障库（project_faults.json）
    ├── 项目特有故障（2个，泛化） ← 使用{parameter}占位符
    ├── 历史缺陷（1个） ← 新增F-HIST-006
    ├── 全局故障override（定制化）
    ├── 禁用的故障（项目不适用的）
    ├── 注入规则配置
    └── 配置示例（3个项目配置） ← 新增章节
```

---

## 二、故障库文件结构

### 2.1 全局故障库（rest_api_common_faults.json）

**文件位置**：`.claude/skills/AutoTestFlow/shared/fault_library/rest_api_common_faults.json`

**版本信息**：
- 当前版本：**v1.1.0**
- 最后更新：2026-01-18
- 适用范围：全局（所有REST/JSON-RPC项目）

**核心字段**：

```json
{
  "meta": {
    "version": "1.1.0",           // ← 版本号（新增F-REQ-011）
    "scope": "global",             // 作用域
    "description": "...",          // 描述
    "last_updated": "2026-01-18",  // 最后更新日期
    "maintainer": "..."            // 维护者
  },
  "fault_categories": [            // 故障类别列表
    {
      "category_id": "FC-REQ-001", // 类别ID
      "category_name": "请求体缺陷",
      "faults": [...]               // 具体故障列表（11个）
    }
  ],
  "history_faults": [...]          // 历史缺陷记录（5个）
}
```

**故障字段详解**：

```json
{
  "fault_id": "F-REQ-001",         // 故障ID（唯一）
  "name": "body必选参数缺失",       // 故障名称
  "description": "...",            // 故障描述
  "severity": "高",                // 严重程度（高/中/低）
  "test_strategy": {               // 测试策略（核心）
    "trigger_pattern": "...",      // 触发模式
    "expected_behavior": "...",    // 预期行为
    "assertion_level": "L2",       // 断言层级
    "validation_points": [...]     // 验证点列表
  },
  "applicable_scenarios": [...],   // 适用场景
  "tags": [...]                    // 标签（用于匹配）
}
```

**最新故障示例（v1.1.0新增）**：

```json
{
  "fault_id": "F-REQ-011",
  "name": "引用不存在的关联资源",
  "description": "请求参数中引用的关联资源不存在（如不存在的agentId、userId、sessionId、parentId等）",
  "severity": "高",
  "test_strategy": {
    "trigger_pattern": "在请求参数的关联字段中传入不存在的资源ID（如metadata.agentId='nonexistent-{uuid}'）",
    "expected_behavior": "应返回错误响应或终态FAILED，不执行无效操作",
    "assertion_level": "L2",
    "validation_points": [
      "响应包含error字段或状态字段指示失败",
      "错误码或message指示资源不存在或关联无效",
      "不创建资源或执行无效操作",
      "响应id字段回带"
    ]
  },
  "applicable_scenarios": ["POST", "PUT", "PATCH"],
  "tags": ["关联资源校验", "业务逻辑", "参数校验", "资源不存在"]
}
```

> **说明**：F-REQ-011 是根据实际测试发现的bug新增的故障模式，适用于验证请求参数中引用的关联资源是否存在。

### 2.2 项目级故障库（project_faults.json）

**文件位置**：`{project_root}/fault_library/project_faults.json`

**版本信息**：
- 当前版本：**v1.1.0**
- 最后更新：2026-01-18
- 适用范围：项目级（特定项目配置）

**核心字段**：

```json
{
  "meta": {
    "version": "1.1.0",
    "extends": "rest_api_common_faults.json", // 继承全局库
    "project_name": "{project_name}",         // ← 泛化：使用占位符
    "description": "项目级故障库模板，请替换 {parameter} 占位符为实际值"
  },
  "project_specific_faults": [...],           // 项目特有故障（泛化）
  "history_faults": [...],                    // 历史缺陷（新增F-HIST-006）
  "fault_overrides": [...],                   // 覆盖全局故障
  "disabled_faults": [...],                   // 禁用的故障
  "fault_injection_rules": {...},             // 注入规则
  "contract_alignment_rules": {...},          // 契约校准规则
  "configuration_examples": {...}             // ← 新增：配置示例章节
}
```

**项目特有故障示例（泛化）**：

```json
{
  "fault_id": "F-PROJ-001",
  "name": "服务发现端点缺少endpoint字段",
  "description": "服务发现端点未提供url/endpoint字段，导致无法发现服务地址",
  "severity": "高",
  "related_endpoint": "{discovery_endpoint}", // ← 泛化：使用占位符
  "parameter_config": {                        // ← 新增：参数配置说明
    "discovery_endpoint": "服务发现端点路径（如/.well-known/agent.json）",
    "expected_endpoint_path": "期望的服务端点路径（如/a2a）",
    "endpoint_field": "端点字段名（如url或endpoint）"
  },
  "test_strategy": {
    "trigger_pattern": "访问服务发现端点 {discovery_endpoint}",
    "expected_behavior": "响应应包含 {endpoint_field} 字段，且值包含 {expected_endpoint_path} 路径",
    "assertion_level": "L2",
    "validation_points": [
      "响应包含 {endpoint_field} 字段",
      "字段值包含 {expected_endpoint_path} 路径",
      "字段不为空字符串",
      "字段值可解析为有效URL"
    ]
  },
  "tags": ["服务发现", "endpoint缺失", "历史缺陷"]
}
```

> **说明**：v1.1.0版本将项目特有故障泛化，使用 `{parameter}` 占位符，使其适用于不同项目。请根据 `parameter_config` 说明替换占位符为实际值。

**历史缺陷示例（v1.1.0新增）**：

```json
{
  "fault_id": "F-HIST-006",
  "source": "POST /a2a (SendMessage) 执行发现",
  "description": "请求参数metadata.agentId引用不存在的agent，返回正常响应而非错误",
  "severity": "高",
  "discovered_date": "2026-01-18",
  "test_case_id": "TC-A2A-NEW",
  "related_endpoint": "/a2a (SendMessage method)",
  "test_strategy": {
    "trigger_pattern": "SendMessage请求metadata.agentId传入不存在的值（如'nonexistent-agent-id'）",
    "expected_behavior": "应返回错误响应或终态FAILED，不执行无效操作",
    "assertion_level": "L2",
    "validation_points": [
      "响应包含error字段或status.state=FAILED",
      "错误信息指示agentId不存在或无效",
      "不创建任务或执行发送消息操作",
      "响应id字段回带"
    ]
  },
  "resolution_status": "open",
  "tags": ["历史缺陷", "关联资源校验", "业务逻辑", "参数校验"]
}
```

> **说明**：F-HIST-006 是从实际测试执行中发现的bug，已在故障库中记录，后续会自动生成测试用例验证。

**配置示例章节（v1.1.0新增）**：

```json
{
  "configuration_examples": {
    "example_1_a2a_project": {
      "project_name": "A2A-Java-SpecAgent",
      "discovery_endpoint": "/.well-known/agent.json",
      "expected_endpoint_path": "/a2a",
      "endpoint_field": "url",
      "enum_prefix": "TASK_STATE_",
      "enum_field": "state",
      "method_group": "SendMessage/GetTask/ListTasks",
      "wrapper_field": "result",
      "inner_field": "task",
      "tolerance_function": "normalize_state()"
    },
    "example_2_generic_rest_api": {
      "project_name": "GenericREST-API",
      "discovery_endpoint": "/api/discovery",
      "expected_endpoint_path": "/api/v1",
      "endpoint_field": "service_url",
      "enum_prefix": "",
      "enum_field": "status",
      "method_group": "CreateResource/GetResource/ListResources",
      "wrapper_field": "data",
      "inner_field": "item",
      "tolerance_function": "normalize_enum()"
    },
    "example_3_microservice": {
      "project_name": "Microservice-API",
      "discovery_endpoint": "/service/manifest",
      "expected_endpoint_path": "/rpc",
      "endpoint_field": "endpoint",
      "enum_prefix": "STATUS_",
      "enum_field": "code",
      "method_group": "CallMethod/GetMethod",
      "wrapper_field": "response",
      "inner_field": "payload",
      "tolerance_function": "remove_prefix()"
    }
  }
}
```

> **说明**：新增配置示例章节，提供3个不同项目的配置示例，帮助用户快速配置自己的项目故障库。

---

## 三、如何使用故障库

### 3.1 在 AutoTestFlow 中启用故障库

**方式1：全局启用（推荐）**

在 AutoTestFlow 运行时自动加载故障库：

```bash
# AutoTestFlow 自动读取全局故障库
claude-code skill AutoTestFlow --stage 1 --input requirement.md

# 故障库将自动注入到各阶段：
# - Stage 1: 提升历史缺陷FP优先级（如F-HIST-006 → P0）
# - Stage 3a: 注入故障分支到场景（F-REQ-011 → exception分支）
# - Stage 3b: 生成故障导向的测试用例（断言源自故障策略）
# - Stage 4: 自动积累新发现的缺陷
```

**方式2：项目级启用**

创建项目级故障库文件并配置参数：

```bash
# 创建项目故障库目录
mkdir -p fault_library

# 复制项目故障库模板
# 注意：project_faults.json 已经是泛化模板，包含 {parameter} 占位符

# 配置你的项目参数（替换占位符）
vi fault_library/project_faults.json

# 参考配置示例章节进行配置
```

### 3.2 配置项目故障库参数

**步骤1：选择配置示例**

根据项目类型，选择合适的配置示例：
- `example_1_a2a_project`：适用于A2A协议项目
- `example_2_generic_rest_api`：适用于通用REST API项目
- `example_3_microservice`：适用于微服务项目

**步骤2：替换占位符**

在 `project_faults.json` 中替换 `{parameter}` 占位符为实际值：

```json
// 示例：配置A2A项目
{
  "meta": {
    "project_name": "A2A-Java-SpecAgent"  // 替换 {project_name}
  },
  "project_specific_faults": [
    {
      "related_endpoint": "/.well-known/agent.json",  // 替换 {discovery_endpoint}
      "test_strategy": {
        "trigger_pattern": "访问服务发现端点 /.well-known/agent.json",
        "expected_behavior": "响应应包含 url 字段，且值包含 /a2a 路径",
        "validation_points": [
          "响应包含 url 字段",  // 替换 {endpoint_field}
          "字段值包含 /a2a 路径",  // 替换 {expected_endpoint_path}
          "字段不为空字符串"
        ]
      }
    }
  ]
}
```

**步骤3：验证配置**

检查JSON格式和参数替换是否正确：

```bash
# 验证JSON格式
python -m json.tool fault_library/project_faults.json

# 检查是否还有未替换的占位符
grep "{parameter}" fault_library/project_faults.json
```

### 3.3 故障库注入流程

**Stage 1：需求分析阶段**

故障库提升历史缺陷优先级：

```json
// 输出：.state/s1_index.json
{
  "function_points": [
    {
      "id": "FP-001",
      "priority": "P0",              // ← 历史缺陷提升为P0
      "history_fault_refs": ["F-HIST-006"]  // ← 引用历史缺陷
    }
  ]
}
```

**Stage 3a：场景富化阶段**

故障库注入故障分支：

```json
// 输出：.state/s3a_enriched/FS-001.json
{
  "branches": {
    "exception": [
      {
        "id": "FS-001-E04",
        "fault_ref": "F-REQ-011",    // ← 引用故障库（关联资源校验）
        "trigger": "metadata.agentId传入不存在的值",
        "expected": "返回错误响应或终态FAILED",
        "validation_points": [
          "响应包含error字段或status.state=FAILED",
          "错误信息指示agentId不存在或无效",
          "不创建任务或执行发送消息操作",
          "响应id字段回带"
        ]
      }
    ]
  }
}
```

**Stage 3b：用例设计阶段**

故障库生成测试用例：

```json
// 输出：test_design_batch_001.json
[
  {
    "case_id": "TC-FLT-001",
    "name": "SendMessage-故障验证-关联资源不存在",
    "fault_ref": "F-REQ-011",       // ← 引用故障库
    "validation_points": [...]       // ← 来自故障库策略
  }
]
```

### 3.4 查看故障库应用效果

**查看注入统计**：

```bash
# Stage 3a注入统计
cat .state/s3a_enriched_index.json | grep fault_injection_summary

# Stage 3b故障用例统计
grep -r "fault_ref" test_design_batch_*.json | wc -l
```

**查看历史缺陷积累**：

```bash
# 查看全局故障库历史缺陷
cat .claude/skills/AutoTestFlow/shared/fault_library/rest_api_common_faults.json \
    | jq '.history_faults'

# 查看新发现的缺陷
cat .state/results/new_faults_detected.json
```

---

## 四、如何维护和扩展故障库

### 4.1 添加新的故障模式

**步骤1：编辑故障库文件**

```bash
# 编辑全局故障库（添加通用故障）
vi .claude/skills/AutoTestFlow/shared/fault_library/rest_api_common_faults.json

# 或编辑项目级故障库（添加项目特有故障）
vi fault_library/project_faults.json
```

**步骤2：添加新故障条目**

**全局故障库示例**：

```json
{
  "fault_id": "F-REQ-012",          // ← 新故障ID
  "name": "新故障名称",
  "description": "故障描述",
  "severity": "高",
  "test_strategy": {
    "trigger_pattern": "触发条件",
    "expected_behavior": "预期行为",
    "assertion_level": "L2",
    "validation_points": [
      "验证点1",
      "验证点2"
    ]
  },
  "tags": ["新标签", "自定义标签"]
}
```

**项目故障库示例（泛化）**：

```json
{
  "fault_id": "F-PROJ-003",
  "name": "项目特有故障",
  "description": "故障描述",
  "severity": "中",
  "related_endpoint": "{endpoint_path}",  // ← 使用占位符
  "parameter_config": {                    // ← 添加参数配置说明
    "endpoint_path": "端点路径描述",
    "field_name": "字段名描述"
  },
  "test_strategy": {
    "trigger_pattern": "触发条件 {parameter}",
    "expected_behavior": "预期行为 {parameter}",
    "assertion_level": "L2",
    "validation_points": [
      "验证点1 {parameter}",
      "验证点2"
    ]
  },
  "tags": ["项目特有", "自定义标签"]
}
```

**故障ID命名规范**：
- 全局故障：`F-{类别缩写}-{序号}`（如F-REQ-012）
- 项目故障：`F-PROJ-{序号}`（如F-PROJ-003）
- 历史缺陷：`F-HIST-{序号}`（如F-HIST-007）

### 4.2 自动积累历史缺陷

**Stage 4 自动故障提取**：

测试执行后，系统会自动从失败结果中提取新缺陷：

```bash
# 运行测试
claude-code skill AutoTestFlow --stage 4

# 查看自动积累的新缺陷
cat .state/results/new_faults_detected.json

# 新缺陷会自动写入故障库的history_faults字段
```

**手动触发故障积累脚本**：

```bash
python .claude/skills/AutoTestFlow/scripts/update_fault_library.py \
    --results-dir .state/results \
    --fault-lib .claude/skills/AutoTestFlow/shared/fault_library/rest_api_common_faults.json
```

### 4.3 项目级故障库维护

**添加项目特有故障**：

```json
{
  "project_specific_faults": [
    {
      "fault_id": "F-PROJ-003",     // ← 新项目故障
      "name": "项目特有故障",
      "related_endpoint": "{specific_endpoint}",  // ← 使用占位符
      "parameter_config": {...}      // ← 添加参数配置说明
    }
  ]
}
```

**Override全局故障**：

```json
{
  "fault_overrides": [
    {
      "ref_fault_id": "F-RES-004",  // ← 引用全局故障ID
      "override_reason": "项目有特殊处理逻辑",
      "parameter_config": {...},     // ← 参数配置
      "custom_test_strategy": {...}
    }
  ]
}
```

**禁用不适用的故障**：

```json
{
  "disabled_faults": [
    {
      "ref_fault_id": "F-SEC-003",  // ← 禁用认证授权测试
      "disable_reason": "项目不涉及认证",
      "disabled_date": "2026-01-18"
    }
  ]
}
```

### 4.4 版本管理

**故障库版本规范**：

- 版本号：`major.minor.patch`（如1.1.0）
- 更新规则：
  - `major`：重大结构变更（新增类别、删除类别、完全重构）
  - `minor`：新增故障、修改故障策略、泛化改动（当前v1.1.0）
  - `patch`：修复错误、更新元数据

**更新版本号**：

```json
{
  "meta": {
    "version": "1.2.0",              // ← 从1.1.0升级到1.2.0
    "last_updated": "2026-02-01"     // ← 更新日期
  }
}
```

---

## 五、故障库与 AutoTestFlow 集成

### 5.1 多阶段集成架构

```
Stage 1 (需求分析)
  ├─ Read fault_lib → 提升历史缺陷FP优先级（F-HIST-006 → P0）
  └ Output s1_index.json (含history_fault_refs)

Stage 3a (场景富化)
  ├─ Match faults → 注入exception/boundary/quality分支
  ├─ F-REQ-011 → exception分支（关联资源不存在）
  └ Output enriched_scenes (含fault_ref字段)

Stage 3b (用例设计)
  ├─ Generate fault_test_cases → 断言源自故障策略
  ├─ validation_points → 来自F-REQ-011和F-HIST-006
  └ Output test_design (含validation_points)

Stage 4 (执行验证)
  ├─ Detect new_faults → 自动积累新缺陷
  ├─ Execute test cases → 发现agentId未校验bug
  └ Update fault_lib history_faults → 新增F-HIST-007
```

### 5.2 故障注入触发条件

**匹配规则**：

1. **端点匹配**：`applicable_scenarios` 包含当前端点HTTP方法
2. **标签匹配**：`tags` 与场景类型匹配（如"边界测试"、"参数校验"）
3. **历史缺陷匹配**：`test_case_id` 关联到FP
4. **关联资源匹配**：检测参数中的关联字段（如metadata.agentId）

**注入策略**：

| 故障类别 | 注入位置 | 数量限制 | 示例 |
|---------|---------|---------|------|
| FC-REQ-001 | exception分支 | ≤3个/场景 | F-REQ-001, F-REQ-011 |
| FC-RES-001 | quality分支 | ≤2个/场景 | F-RES-001, F-RES-002 |
| FC-PROTO-001 | exception分支 | ≤3个/场景 | F-PROTO-001, F-PROTO-002 |
| FC-STATE-001 | boundary分支 | ≤2个/场景 | F-STATE-001, F-STATE-002 |
| FC-SSE-001 | quality分支 | ≤2个/场景 | F-SSE-001, F-SSE-002 |
| FC-SEC-001 | 单独security场景 | ≤5个/项目 | F-SEC-001, F-SEC-002 |

### 5.3 契约优先原则

**判据校准逻辑**：

1. 故障库的`expected_behavior`需与`contract.md`校准
2. 如`contract.md`未定义对应字段，故障判据降为L0/L1（观察性断言）
3. 如`contract.md`定义了对应字段，故障断言为L2（值语义断言）
4. 冲突时契约优先，故障降级为观察项

**校准报告生成**：

```bash
# 生成故障契约校准报告
python .claude/skills/AutoTestFlow/scripts/validate_fault_contract.py \
    --fault-lib fault_library/project_faults.json \
    --contract .state/contract.md \
    --output fault_library/fault_contract_alignment.md
```

---

## 六、故障库统计与报告

### 6.1 Stage 5 报告内容

**故障库应用情况报告**：

```markdown
## 8. 故障库应用情况

### 8.1 故障库统计

- 全局故障库版本：v1.1.0
- 项目级故障库版本：v1.1.0
- 总故障模式数：51+（新增F-REQ-011）
- 历史缺陷记录：6个（F-HIST-001~006）
- 项目特有故障：2个（泛化，需配置参数）

### 8.2 故障注入统计

- Stage 1 提升FP优先级：4个历史缺陷 → P0（含F-HIST-006）
- Stage 3a 注入故障分支：28个场景
  - exception分支：48个（F-REQ-* + F-PROTO-* + F-REQ-011）
  - boundary分支：12个（F-STATE-*）
  - quality分支：18个（F-RES-* + F-SSE-*）
- Stage 3b 生成故障用例：78个
  - P0用例：4个（历史缺陷重现）
  - P1用例：45个（通用故障验证）
  - P2用例：29个（其他故障）

### 8.3 新发现缺陷

- Stage 4 执行发现新缺陷：1个（metadata.agentId未校验）
- 已自动积累到历史缺陷：F-HIST-006
- 状态：open（待修复）

### 8.4 配置参数应用

- 项目故障库参数配置完成：✅
- 配置示例参考：example_1_a2a_project
- 参数替换验证：✅ 无未替换占位符
```

---

## 七、最佳实践建议

### 7.1 故障库维护建议

1. **定期更新**：每月审查历史缺陷，更新resolution_status
2. **版本管理**：重大变更时升级版本号，保留旧版本备份
3. **标签标准化**：使用统一标签（如"边界测试"、"异常输入"、"契约验证"、"关联资源校验"）
4. **严重程度分级**：遵循高/中/低标准，不随意标注
5. **参数配置完整性**：确保所有 `{parameter}` 占位符已替换

### 7.2 故障库使用建议

1. **先启用全局库**：新手项目先使用全局故障库，积累经验
2. **参考配置示例**：根据项目类型选择合适的配置示例（configuration_examples）
3. **逐步添加项目故障**：发现项目特有缺陷时，添加到project_faults.json
4. **定期审查禁用故障**：项目演进后，重新启用禁用的故障
5. **契约校准优先**：确保故障判据与contract.md一致

### 7.3 故障库扩展建议

1. **从测试结果提取**：定期运行Stage 4，自动积累新缺陷
2. **从业界最佳实践学习**：参考OWASP API Security Top 10、常见REST API反模式
3. **团队协作维护**：建立故障库维护流程，团队共同贡献
4. **长期积累**：建立历史缺陷归档机制，长期维护
5. **参数化设计**：新增项目故障时，使用 `{parameter}` 占位符，使其通用化

---

## 八、故障库常见问题

### Q1：如何判断故障是否适用于当前项目？

A：检查故障的`applicable_scenarios`和`tags`字段：
- `applicable_scenarios`：包含项目使用的HTTP方法
- `tags`：与项目场景类型匹配
- 如不适用，在`disabled_faults`中禁用

### Q2：如何配置项目故障库的占位符？

A：参考 `configuration_examples` 章节：
- 选择适合项目类型的配置示例
- 根据 `parameter_config` 说明替换占位符
- 使用 `python -m json.tool` 验证JSON格式
- 检查是否还有未替换的占位符

### Q3：历史缺陷何时更新resolution_status？

A：建议流程：
- 发现缺陷时：`resolution_status: "open"`（如F-HIST-006）
- 缺陷修复后：更新为`"fixed"`，记录修复版本
- 验证通过后：更新为`"closed"`，保留为历史记录

### Q4：故障库与代码扫描CD清单如何协同？

A：
- 故障库：提供测试策略和验证点
- CD清单：提供代码缺陷证据
- 协同：CD清单中的缺陷可引用故障库的test_strategy

### Q5：如何处理故障判据与契约冲突？

A：遵循契约优先原则：
- 冲突时契约优先，故障降级为观察项（L0/L1断言）
- 生成校准报告：`fault_contract_alignment.md`
- 标注冲突故障：`fault.status: "contract_mismatch"`

### Q6：v1.1.0版本有什么重大改动？

A：v1.1.0主要改动：
- ✅ 全局故障库新增F-REQ-011（引用不存在的关联资源）
- ✅ 项目故障库泛化设计（使用 `{parameter}` 占位符）
- ✅ 新增 `configuration_examples` 章节（3个项目配置示例）
- ✅ 删除过于特定的故障（移到全局库或删除）
- ✅ 新增历史缺陷F-HIST-006（agentId未校验bug）

---

## 九、故障库版本历史

### v1.1.0 (2026-01-18) - 当前版本

**重大改动**：
- ✅ 全局故障库新增F-REQ-011（引用不存在的关联资源）
- ✅ 项目故障库完全重构，使用泛化设计（{parameter}占位符）
- ✅ 新增 `configuration_examples` 章节（3个项目配置示例）
- ✅ 新增历史缺陷F-HIST-006（metadata.agentId未校验bug）
- ✅ 删除过于特定的故障（F-PROJ-003~006移到全局库）
- ✅ 所有项目故障添加 `parameter_config` 说明字段
- ✅ 更新README.md，详细说明参数配置方法

**新增故障统计**：
- 全局故障库：50+ → **51+** (+1)
- 项目特有故障：6个 → **2个**（泛化）
- 历史缺陷：5个 → **6个** (+1)

**适用场景**：
- 适用于所有REST/JSON-RPC项目
- 项目故障库可配置，适配不同项目类型

### v1.0.0 (2026-01-18) - 初始版本

- ✅ 创建全局REST API故障库（50+故障模式）
- ✅ 创建A2A项目级故障库（6个项目特有故障）
- ✅ 从现有测试结果提取5个历史缺陷
- ✅ 定义故障库JSON Schema
- ✅ 编写集成指南和使用说明

### 计划版本

#### v1.2.0 (计划)

- 🔲 新增DFX维度故障（性能、可靠性、可维护性）
- 🔲 新增API版本兼容性故障
- 🔲 支持故障库国际化（多语言描述）
- 🔲 新增更多项目配置示例

#### v2.0.0 (计划)

- 🔲 重构故障库结构（支持多协议）
- 🔲 新增故障库可视化工具
- 🔲 支持故障库在线编辑和协作
- 🔲 完善参数化配置机制

---

## 十、联系方式

**故障库维护团队**：test_engineering_team

**AutoTestFlow 集成问题**：参考 `AutoTestFlow/shared/rules.md` 和 `SKILL.md`

**故障库贡献**：请提交 Issue 或 Pull Request

**配置问题**：参考 `configuration_examples` 章节或联系团队

---

**最后更新**：2026-01-18
**当前版本**：v1.1.0
**适用范围**：全局 + 项目级（泛化配置）
