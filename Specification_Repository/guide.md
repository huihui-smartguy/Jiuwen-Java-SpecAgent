# 测试智能体故障库

> 结构化的缺陷模式知识库，支持Web、REST API、Agent、DFX四个维度的故障模式管理。
> **版本：v1.0.0** | **最后更新：2026-06-27**

---

## 目录

- [一、故障库概述](#一故障库概述)
- [二、故障库设计思路](#二故障库设计思路)
- [三、故障库文件结构](#三故障库文件结构)
- [四、故障库维护与扩展](#四故障库维护与扩展)
- [五、常见问题](#五常见问题)

---

## 一、故障库概述

### 1.1 设计理念

故障库的设计核心理念是**将经验驱动的测试转向系统化的知识库管理**：

#### 从需求驱动到故障驱动

传统测试主要基于需求文档进行测试设计，覆盖率通常在70-80%。故障库引入**故障驱动测试**的理念，通过系统化的故障模式知识库，将测试覆盖率提升到90-95%。

**设计思路：**
- 需求驱动：覆盖"应该做什么"（正向测试）
- 故障驱动：覆盖"可能出什么问题"（异常测试）
- 两者结合：实现更全面的测试覆盖

#### 从经验积累到系统化知识库

传统测试经验零散地存在于测试人员头脑、文档和测试用例中，难以复用和传承。故障库将这些经验**结构化、标准化、可复用化**：

**设计思路：**
- 结构化：统一的JSON Schema，易于存储和查询
- 标准化：统一的故障描述、测试策略、验证点
- 可复用：泛化设计，适用于不同项目
- 可追溯：标注故障来源，支持回溯和分析

#### baseline + issue_derived双轨积累机制

故障库采用**双轨设计**，既包含基于测试理论和行业标准的通用故障（baseline），也包含从实际产品Issue中提取的真实缺陷（issue_derived）：

**设计思路：**
- **baseline轨道**：建立基线覆盖，确保测试的全面性和标准化
- **issue_derived轨道**：持续积累真实缺陷，反映线上实际问题
- **双轨并行**：通用性 + 实用性，形成互补优势

### 1.2 核心价值

- ✅ **提升测试覆盖率**：从需求驱动（70-80%）→ 需求+故障驱动（90-95%）
- ✅ **增强缺陷发现能力**：基于真实故障模式和历史缺陷，提高缺陷发现率
- ✅ **降低维护成本**：故障库结构化管理 + 版本控制 + 可追溯性
- ✅ **标准化测试质量**：统一的故障描述和测试策略，确保测试质量一致
- ✅ **灵活可配置**：参数化设计，适用于不同项目和场景
- ✅ **持续积累迭代**：从Issue中不断提取新故障，实现故障库的持续演进

### 1.3 故障库体系结构

```
故障库体系（v1.0.0）：
├── web_frontend_faults.json          ← Web前端功能故障库（29个故障）
│   ├── 输入框边界/异常测试点（9个）
│   ├── 页面流程组合场景（5个）
│   ├── 渲染&长连接异常（11个）
│   └── 前端鉴权异常（4个）
│
├── rest_api_faults.json              ← REST API接口故障库（23个故障）
│   ├── 请求参数异常（7个）
│   ├── HTTP协议异常场景（11个）
│   ├── 业务状态组合故障（5个）
│   └── 响应契约异常（5个）
│
├── agent_scene_faults.json           ← Agent场景故障库（22个故障）
│   ├── Prompt输入边界/异常值（5个）
│   ├── LLM输出语义故障点（5个）
│   ├── 工具调用组合场景（4个）
│   └── Agent流式运行时中断异常（8个）
│
└── dfx_reliability_faults.json       ← DFX可靠性故障库（28个故障）
    ├── 依赖服务失效场景（8个）
    ├── 系统资源耗尽场景（6个）
    ├── 恢复性&降级场景（8个）
    └── 运维可观测DFX测试点（6个）
```

**总计：102个故障模式（baseline）**

---

## 二、故障库设计思路

### 2.1 四层故障库分类体系

故障库采用**四层分类体系**，从输入到输出、从功能到非功能，实现"全覆盖无遗漏"的设计目标。

#### 第一层：Web前端功能故障库（页面交互测试点）

**设计思路：**
- 聚焦用户交互层面的故障模式
- 覆盖输入、流程、渲染、鉴权四大类
- 重点关注用户体验和安全性

**分类结构：**

1. **输入框边界/异常测试点**（9个故障）
   - 设计依据：ISTQB边界值测试 + OWASP输入验证
   - 覆盖范围：空值、超长、最小长度、特殊字符、HTML注入、负数、非法格式、全空格、粘贴超长
   - 设计目标：验证前端输入校验的完整性和健壮性

2. **页面流程组合场景**（5个故障）
   - 设计依据：线上真实生产故障复盘
   - 覆盖范围：表单中途刷新、重复点击提交、后退重新提交、多标签同时操作、会话过期操作
   - 设计目标：验证复杂用户流程下的数据保护和幂等性

3. **渲染&长连接异常**（11个故障）
   - 设计依据：LLM流式对话、SSE长连接行业通用测试实践
   - 覆盖范围：SSE流式分片丢失、WebSocket断开重连、空数据无兜底、超长文本布局错乱、流式输出异常等
   - 设计目标：验证流式输出的容错性和用户体验

4. **前端鉴权异常**（4个故障）
   - 设计依据：OWASP Web Top10 2021 - 认证授权失效
   - 覆盖范围：Token篡改、过期Token操作、本地存储删除后操作、无权限路由直接访问
   - 设计目标：验证前端鉴权机制的健壮性

#### 第二层：REST API接口故障库（契约 + 业务异常）

**设计思路：**
- 聚焦API协议层面的故障模式
- 覆盖请求参数、HTTP协议、业务状态、响应契约四大类
- 重点关注协议合规性和业务健壮性

**分类结构：**

1. **请求参数异常**（7个故障）
   - 设计依据：ISTQB参数校验 + OWASP API Security Top10 2023
   - 覆盖范围：缺失必填、多传参数、类型不匹配、数值上下边界、不存在枚举、空数组、超大分页
   - 设计目标：验证API参数校验的完整性

2. **HTTP协议异常场景**（11个故障）
   - 设计依据：ISTQB协议测试 + LLM流式对话行业实践
   - 覆盖范围：错误请求方法、非法Header、超大Body、缺失Content-Type、流式请求异常等
   - 设计目标：验证HTTP协议合规性和流式处理能力

3. **业务状态组合故障**（5个故障）
   - 设计依据：ISTQB状态机测试 + OWASP API权限失效
   - 覆盖范围：非法状态流转、并发修改同一资源、重复创建、查询不存在资源、跨用户越权访问
   - 设计目标：验证业务逻辑的健壮性和安全性

4. **响应契约异常**（5个故障）
   - 设计依据：ISTQB契约验证 + 线上真实故障复盘
   - 覆盖范围：返回字段缺失、字段类型错乱、空响应、截断JSON、错误堆栈暴露
   - 设计目标：验证API响应的正确性和安全性

#### 第三层：Agent业务专属故障库（语义 + 工具调用异常）

**设计思路：**
- 聚焦AI Agent特有的故障模式
- 覆盖Prompt输入、LLM输出、工具调用、流式运行时四大类
- 重点关注语义理解和工具调用的可靠性

**分类结构：**

1. **Prompt输入边界/异常值**（5个故障）
   - 设计依据：ChaosLLM Agent失效模式 + BIPI Agent生产故障库
   - 覆盖范围：超长对话、特殊符号注入、混淆系统指令、空提问、纯换行空格提问
   - 设计目标：验证Agent对异常输入的处理能力

2. **LLM输出语义故障点**（5个故障）
   - 设计依据：ChaosLLM Agent失效模式
   - 覆盖范围：工具调用格式错误、幻觉参数、循环调用工具、无有效回答、编造虚假知识库内容
   - 设计目标：验证LLM输出的可靠性和准确性

3. **工具调用组合场景**（4个故障）
   - 设计依据：ChaosLLM Agent失效模式 + BIPI Agent生产故障库
   - 覆盖范围：多工具连环失败、调用下线工具、参数超出业务范围、并发批量工具超时
   - 设计目标：验证工具调用的容错性和稳定性

4. **Agent流式运行时中断异常**（8个故障）
   - 设计依据：LLM流式对话、Agent ToolCall架构行业通用测试实践
   - 覆盖范围：LLM流式推理中途中断、用户新消息打断当前流式对话、流式输出取消后工具重复执行等
   - 设计目标：验证Agent流式运行时的容错性和恢复能力

#### 第四层：DFX可靠性故障库（健壮性、恢复性测试点）

**设计思路：**
- 聚焦系统可靠性、可维护性、可观测性
- 覆盖依赖服务、系统资源、恢复降级、运维可观测四大类
- 适用于Web/API/Agent通用场景

**分类结构：**

1. **依赖服务失效场景**（8个故障）
   - 设计依据：CNCF ChaosMesh云原生混沌工程 + LLM流式对话行业实践
   - 覆盖范围：下游API超时、502/503、限流429、返回乱码、完全断连、LLM流式接口中途超时等
   - 设计目标：验证系统对依赖服务失效的容错能力

2. **系统资源耗尽场景**（6个故障）
   - 设计依据：CNCF ChaosMesh云原生混沌工程
   - 覆盖范围：CPU满载、内存OOM、连接池打满、磁盘IO阻塞、并发流式会话耗尽连接、长时流式会话内存累积泄漏
   - 设计目标：验证系统资源管理和限流保护能力

3. **恢复性&降级场景**（8个故障）
   - 设计依据：CNCF ChaosMesh云原生混沌工程 + 线上真实故障复盘
   - 覆盖范围：进程崩溃重启校验会话、熔断开启后恢复、缓存雪崩降级、流式中断后自动重试风暴等
   - 设计目标：验证系统的恢复能力和降级机制

4. **运维可观测DFX测试点**（6个故障）
   - 设计依据：线上真实生产故障复盘 + CNCF可观测性最佳实践
   - 覆盖范围：异常无日志、无traceID、健康探针失败、配置更新不生效、流式中断无异常埋点等
   - 设计目标：验证系统的可观测性和运维友好性

### 2.2 故障来源标准

故障库中的故障模式来源于以下6大权威标准，确保故障模式的权威性和实用性：

#### 1. ISTQB软件测试通用失效模式

**应用场景：** 边界值测试、异常输入、等价类划分、流程异常

**覆盖故障：**
- 输入框边界/异常测试点（Web前端）
- 请求参数异常（REST API）
- 业务状态组合故障（REST API）

**价值：** 基于成熟的测试理论，保证测试的全面性和系统性

#### 2. OWASP Web Top10 2021 / OWASP API Security Top10 2023

**应用场景：** 注入攻击、失效的访问控制、安全配置错误

**覆盖故障：**
- HTML注入攻击（Web前端）
- 前端鉴权异常（Web前端）
- 跨用户越权访问（REST API）
- 错误堆栈暴露（REST API）

**价值：** 基于业界权威安全标准，覆盖高频安全漏洞

#### 3. ChaosLLM Agent失效模式 / BIPI Agent生产故障库

**应用场景：** LLM语义故障、工具调用异常、幻觉参数

**覆盖故障：**
- Prompt输入边界/异常值（Agent）
- LLM输出语义故障点（Agent）
- 工具调用组合场景（Agent）
- Agent流式运行时中断异常（Agent）

**价值：** 基于AI Agent领域的前沿研究和生产实践

#### 4. CNCF ChaosMesh云原生混沌工程故障场景

**应用场景：** 网络故障、资源耗尽、依赖服务失效

**覆盖故障：**
- 依赖服务失效场景（DFX）
- 系统资源耗尽场景（DFX）
- 恢复性&降级场景（DFX）

**价值：** 基于云原生领域的混沌工程最佳实践

#### 5. LLM流式对话、SSE长连接、Agent ToolCall架构行业通用测试实践

**应用场景：** 流式中断、分片丢失、连接断开重连

**覆盖故障：**
- 渲染&长连接异常（Web前端）
- HTTP协议异常场景 - 流式请求相关（REST API）
- Agent流式运行时中断异常（Agent）

**价值：** 基于流式架构的行业通用测试实践

#### 6. 线上真实生产故障复盘沉淀

**应用场景：** 并发冲突、状态机错误、资源泄漏

**覆盖故障：**
- 页面流程组合场景（Web前端）
- 响应契约异常（REST API）
- 恢复性&降级场景（DFX）
- 运维可观测DFX测试点（DFX）

**价值：** 基于真实的线上故障，具有高实用性

### 2.3 baseline vs issue_derived双轨设计

#### 设计理念

故障库采用**baseline + issue_derived双轨设计**，既保证故障模式的泛化性，又确保其实用性。

#### baseline轨道

**定义：** 基于测试理论、行业标准提炼的通用故障模式

**特点：**
- ✅ 泛化适用性强，不绑定特定项目
- ✅ 权威性高，来源于成熟理论和标准
- ✅ 覆盖全面，建立测试基线
- ✅ 稳定性好，不随项目变化

**适用场景：**
- 新项目初始化，建立测试基线
- 通用故障模式，适用于所有项目
- 理论指导，保证测试的系统性

**示例：**
```json
{
  "fault_id": "F-WEB-001",
  "name": "空值输入",
  "source": {
    "type": "baseline",
    "standards": ["ISTQB"],
    "description": "边界值测试 - 空值边界"
  }
}
```

#### issue_derived轨道

**定义：** 从实际产品Issue中提取的真实缺陷模式

**特点：**
- ✅ 真实性强，反映线上实际问题
- ✅ 项目相关性强，针对性好
- ✅ 持续积累，反映最新问题
- ✅ 高价值，避免重复踩坑

**适用场景：**
- 项目特有故障，不通用
- 从Issue中提取的真实缺陷
- 历史缺陷管理，避免复发

**示例：**
```json
{
  "fault_id": "F-PROJ-001",
  "name": "服务发现端点缺少endpoint字段",
  "source": {
    "type": "issue_derived",
    "issue_ref": "PROJ-1234",
    "discovered_date": "2026-06-27",
    "description": "从Issue PROJ-1234提取"
  }
}
```

#### 优势互补

| 维度 | baseline | issue_derived | 互补效果 |
|------|----------|---------------|---------|
| 覆盖范围 | 广覆盖，建立基线 | 聚焦项目特有 | 全覆盖 + 精准覆盖 |
| 实用性 | 理论指导，系统性 | 真实案例，实用性强 | 理论 + 实践 |
| 更新频率 | 稳定，定期更新 | 持续积累，快速迭代 | 稳定 + 活跃 |
| 维护成本 | 低，一次性投入 | 中，持续维护 | 建立基线 + 持续积累 |

### 2.4 故障模式标准化

#### 标准化的好处

故障库采用统一的JSON Schema和字段设计，带来以下好处：

1. **可复用性**
   - 统一格式，易于跨项目复用
   - 标准化描述，减少理解成本

2. **可集成性**
   - 统一Schema，易于集成到测试工具
   - 结构清晰，易于程序化处理

3. **可追溯性**
   - 标注来源，支持回溯和分析
   - 版本管理，支持历史追踪

4. **可维护性**
   - 统一格式，易于维护和更新
   - 清晰结构，易于扩展

#### 字段设计的考虑

**1. fault_id（故障ID）**
- 格式：`F-{类别}-{编号}`（如F-WEB-001）
- 设计目的：唯一标识，便于引用和管理
- 类别前缀：快速识别故障类型

**2. test_strategy（测试策略）**
- 设计目的：提供完整的测试指导
- trigger_pattern：如何触发故障
- expected_behavior：预期正确行为
- validation_points：具体的验证点

**3. source（来源标注）**
- type：baseline或issue_derived
- standards：来源标准（baseline）
- issue_ref：关联Issue（issue_derived）
- 设计目的：保证故障可追溯，便于分析

**4. tags（标签体系）**
- 设计目的：支持分类、检索、匹配
- 多维度标签：类型、场景、严重程度
- 便于故障库的管理和使用

**5. severity（严重程度）**
- 设计目的：优先级管理，资源分配
- 分级：高/中/低
- 设计依据：故障影响范围和危害程度

---

## 三、故障库文件结构

### 3.1 JSON Schema设计

每个故障库文件遵循统一的JSON Schema：

```json
{
  "meta": {
    "version": "1.0.0",                           // 版本号
    "scope": "global",                             // 作用域
    "description": "故障库描述",                     // 描述
    "last_updated": "2026-06-27",                 // 最后更新日期
    "maintainer": "test_engineering_team",        // 维护者
    "source_standards": ["标准列表"],              // 来源标准
    "library_type": "baseline"                     // 库类型：baseline或issue_derived
  },
  "fault_categories": [                            // 故障类别列表
    {
      "category_id": "FC-{类别}-{编号}",           // 类别ID
      "category_name": "类别名称",                   // 类别名称
      "description": "类别描述",                     // 类别描述
      "faults": [                                  // 具体故障列表
        {
          "fault_id": "F-{类别}-{编号}",            // 故障ID（唯一）
          "name": "故障名称",                        // 故障名称
          "description": "故障描述",                  // 故障描述
          "severity": "高/中/低",                    // 严重程度
          "source": {                               // 故障来源
            "type": "baseline/issue_derived",       // 来源类型
            "standards": ["标准1", "标准2"],         // baseline类型：来源标准
            "issue_ref": "PROJ-1234",              // issue_derived类型：关联Issue编号
            "discovered_date": "2026-06-27"         // issue_derived类型：发现日期
          },
          "test_strategy": {                       // 测试策略（核心）
            "trigger_pattern": "触发模式",           // 如何触发故障
            "expected_behavior": "预期行为",         // 预期行为
            "assertion_level": "L2",                // 断言层级
            "validation_points": [...]              // 验证点列表
          },
          "tags": ["标签1", "标签2"],                // 标签（用于匹配）
          "applicable_scenarios": ["web", "api"]   // 适用场景（可选）
        }
      ]
    }
  ],
  "history_faults": []                              // 历史缺陷记录（动态积累）
}
```

### 3.2 核心字段详解

| 字段 | 说明 | 必填 | 设计目的 |
|------|------|------|---------|
| `meta.version` | 版本号 | ✅ | 版本管理，支持历史追踪 |
| `meta.scope` | 作用域 | ✅ | 区分全局库和项目库 |
| `meta.source_standards` | 来源标准 | ✅ | 保证故障的权威性 |
| `meta.library_type` | 库类型 | ✅ | 区分baseline和issue_derived |
| `fault_id` | 故障ID | ✅ | 唯一标识，便于引用 |
| `name` | 故障名称 | ✅ | 简洁描述，易于理解 |
| `description` | 故障描述 | ✅ | 详细说明，便于复现 |
| `severity` | 严重程度 | ✅ | 优先级管理 |
| `source.type` | 来源类型 | ✅ | 区分baseline/issue_derived |
| `source.standards` | 来源标准 | ⚠️ | baseline类型必填 |
| `source.issue_ref` | 关联Issue | ⚠️ | issue_derived类型必填 |
| `test_strategy` | 测试策略 | ✅ | 提供完整测试指导 |
| `tags` | 标签列表 | ✅ | 分类、检索、匹配 |
| `applicable_scenarios` | 适用场景 | ⚠️ | 精准匹配，避免误用 |

### 3.3 故障项结构示例

**Baseline故障示例：**

```json
{
  "fault_id": "F-WEB-001",
  "name": "空值输入",
  "description": "必填输入框输入空值或仅空格",
  "severity": "高",
  "source": {
    "type": "baseline",
    "standards": ["ISTQB"],
    "description": "边界值测试 - 空值边界"
  },
  "test_strategy": {
    "trigger_pattern": "在必填输入框中输入空字符串或仅空格字符",
    "expected_behavior": "应显示校验错误提示，阻止表单提交",
    "assertion_level": "L2",
    "validation_points": [
      "输入框显示必填校验错误提示",
      "提交按钮被禁用或提交时拦截",
      "错误提示文案清晰明确",
      "不发送空值请求到后端"
    ]
  },
  "tags": ["输入校验", "边界测试", "空值处理"]
}
```

**Issue Derive故障示例：**

```json
{
  "fault_id": "F-PROJ-001",
  "name": "服务发现端点缺少endpoint字段",
  "description": "服务发现端点（如Agent Card）未提供url/endpoint字段，导致无法发现服务地址",
  "severity": "高",
  "source": {
    "type": "issue_derived",
    "issue_ref": "PROJ-1234",
    "discovered_date": "2026-06-27",
    "description": "从Issue PROJ-1234提取"
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
  "tags": ["服务发现", "endpoint缺失", "issue_derived"]
}
```

---

## 四、故障库维护与扩展

### 4.1 从Issue提取故障

#### Issue提取流程

当在产品Issue中发现新缺陷时，可以将其提取到故障库：

**步骤1：识别Issue模式**

分析Issue，提取关键信息：
- 问题现象
- 触发条件
- 预期行为
- 实际行为
- 影响范围

**步骤2：标准化故障模式**

将Issue转换为标准故障格式（参考3.3节）：

**关键要素：**
- `fault_id`：使用`F-PROJ-{序号}`格式
- `source.type`：设置为`"issue_derived"`
- `source.issue_ref`：关联Issue编号
- `source.discovered_date`：记录发现日期
- `test_strategy`：提供完整的测试策略

**步骤3：添加到故障库**

将故障添加到对应的故障库文件：
- Web前端故障 → `web_frontend_faults.json`
- REST API故障 → `rest_api_faults.json`
- Agent场景故障 → `agent_scene_faults.json`
- DFX可靠性故障 → `dfx_reliability_faults.json`

#### Issue提取示例

**原始Issue：**

```
Issue: PROJ-1234
标题: 登录页面输入框输入空值后提交成功，未进行校验
描述: 在登录页面的用户名输入框中输入空字符串或仅空格，点击登录按钮后成功提交，但后端返回了错误。应该在前端进行校验并阻止提交。
严重程度: 高
发现日期: 2026-06-27
```

**提取为故障模式：**

```json
{
  "fault_id": "F-PROJ-001",
  "name": "登录输入框空值未校验",
  "description": "登录页面的用户名输入框输入空值或仅空格时，未进行前端校验就提交到后端",
  "severity": "高",
  "source": {
    "type": "issue_derived",
    "issue_ref": "PROJ-1234",
    "discovered_date": "2026-06-27",
    "description": "从Issue PROJ-1234提取 - 登录页面空值未校验"
  },
  "test_strategy": {
    "trigger_pattern": "在登录页面的用户名输入框中输入空字符串或仅空格，点击登录按钮",
    "expected_behavior": "前端应显示校验错误提示，阻止表单提交到后端",
    "assertion_level": "L2",
    "validation_points": [
      "输入框显示必填校验错误提示",
      "提交按钮被禁用或提交时拦截",
      "错误提示文案清晰明确",
      "不发送空值请求到后端"
    ]
  },
  "tags": ["输入校验", "边界测试", "空值处理", "issue_derived"]
}
```

### 4.2 添加新故障模式

**步骤1：确定故障库类型**

根据故障所属维度选择故障库：
- Web前端 → `web_frontend_faults.json`
- REST API → `rest_api_faults.json`
- Agent场景 → `agent_scene_faults.json`
- DFX可靠性 → `dfx_reliability_faults.json`

**步骤2：选择故障类别**

根据故障类型选择合适的类别：
- 参考该故障库的`fault_categories`
- 新故障应添加到最相关的类别中
- 如需新类别，遵循命名规范`FC-{类别}-{编号}`

**步骤3：确定故障ID**

遵循命名规范：
- 全局库：`F-{类别缩写}-{序号}`（如F-WEB-030）
- 项目库：`F-PROJ-{序号}`（如F-PROJ-003）
- 历史缺陷：`F-HIST-{序号}`（如F-HIST-007）

**步骤4：编写故障描述**

- **name**：简洁明了，体现核心问题
- **description**：详细说明故障现象和原因
- **severity**：高/中/低，根据影响范围判断

**步骤5：设计测试策略**

- **trigger_pattern**：清晰的触发条件
- **expected_behavior**：明确的预期行为
- **validation_points**：具体的验证点列表

**步骤6：标注来源**

如果是baseline故障：
- `source.type`: `"baseline"`
- `source.standards`: 列出相关标准
- `source.description`: 说明在标准中的应用

如果是issue_derived故障：
- `source.type`: `"issue_derived"`
- `source.issue_ref`: 关联Issue编号
- `source.discovered_date`: 记录发现日期

**步骤7：添加标签**

使用多维度标签：
- 类型标签：输入校验、边界测试、安全等
- 场景标签：Web、API、Agent等
- 来源标签：baseline、issue_derived

**步骤8：验证JSON格式**

```bash
# 验证JSON格式
python -m json.tool fault_library/web_frontend_faults.json
```

### 4.3 版本管理

#### 版本规范

- 格式：`major.minor.patch`（如1.0.0）
- 更新规则：
  - `major`：重大结构变更（新增类别、删除类别、完全重构）
  - `minor`：新增故障、修改故障策略（当前v1.0.0 → v1.1.0）
  - `patch`：修复错误、更新元数据

#### 更新版本号

```json
{
  "meta": {
    "version": "1.1.0",              // ← 从1.0.0升级
    "last_updated": "2026-06-28"     // ← 更新日期
  }
}
```

#### 版本记录

建议在README或单独的CHANGELOG中记录版本变更：

```markdown
## 版本历史

### v1.1.0 (2026-06-28)
- 新增5个Agent场景故障
- 修改F-REST-003的测试策略
- 修复JSON格式错误

### v1.0.0 (2026-06-27)
- 初始版本
- 102个baseline故障模式
```

### 4.4 历史缺陷管理

#### 历史缺陷定义

历史缺陷是指从测试执行结果中自动积累的真实缺陷，记录在`history_faults`字段中。

#### 历史缺陷结构

```json
{
  "history_faults": [
    {
      "fault_id": "F-HIST-001",
      "source": "测试用例TC-001执行失败",
      "description": "故障描述",
      "severity": "高",
      "discovered_date": "2026-06-27",
      "test_case_id": "TC-001",
      "test_strategy": {...},
      "resolution_status": "open",  // open/fixed/closed
      "tags": ["历史缺陷"]
    }
  ]
}
```

#### resolution_status状态流转

```
open → fixed → closed
  ↓
  (保持open)
```

- **open**：缺陷发现，待修复
- **fixed**：缺陷已修复，待验证
- **closed**：缺陷已验证通过，已关闭

### 4.5 统计与报告

#### 故障库统计命令

```bash
# 统计各故障库故障数量
for file in fault_library/*_faults.json; do
  echo "$file: $(cat "$file" | jq '.fault_categories[].faults | length')"
done

# 统计历史缺陷数量
for file in fault_library/*_faults.json; do
  echo "$file history: $(cat "$file" | jq '.history_faults | length')"
done

# 统计baseline和issue_derived故障数量
for file in fault_library/*_faults.json; do
  echo "$file baseline: $(cat "$file" | jq '[.fault_categories[].faults[] | select(.source.type == "baseline")] | length')"
  echo "$file issue_derived: $(cat "$file" | jq '[.fault_categories[].faults[] | select(.source.type == "issue_derived")] | length')"
done
```

#### 故障库报告内容

建议定期生成故障库报告，包含：

1. **统计信息**
   - 各故障库故障数量
   - baseline vs issue_derived比例
   - 历史缺陷数量和状态

2. **覆盖度分析**
   - 各类别故障覆盖情况
   - 来源标准分布
   - 严重程度分布

3. **趋势分析**
   - 故障库规模增长趋势
   - 新增故障类型分布
   - 历史缺陷修复率

4. **质量评估**
   - 故障描述完整性
   - 测试策略可用性
   - 来源标注准确性

---

## 五、常见问题

### Q1：如何判断故障是否适用于当前项目？

A：检查故障的`applicable_scenarios`和`tags`字段：
- `applicable_scenarios`：包含项目使用的场景（web/rest_api/agent）
- `tags`：与项目场景类型匹配
- 如不适用，在项目故障库的`disabled_faults`中禁用

### Q2：baseline故障和issue_derived故障有什么区别？

A：主要区别：

| 特性 | baseline | issue_derived |
|------|----------|---------------|
| 来源 | 测试理论、行业标准 | 实际产品Issue |
| 适用性 | 泛化通用 | 项目相关 |
| 优先级 | 通用覆盖 | 高价值复现 |
| 维护 | 定期更新 | 持续积累 |

### Q3：如何从Issue批量提取故障？

A：参考[从Issue提取故障](#41从issue提取故障)章节：
1. 导出Issue列表
2. 使用脚本批量转换
3. 人工审查转换结果
4. 添加到对应的故障库

### Q4：故障库如何保证故障的权威性？

A：通过以下方式保证权威性：
- 来源标注：明确标注故障来源（6大标准）
- 多来源交叉：同一故障可能来自多个标准
- 人工审查：Issue衍生故障经过人工审查
- 持续优化：根据线上实际情况持续优化

### Q6：如何管理历史缺陷的状态？

A：使用`resolution_status`字段管理：
- `open`：缺陷发现，待修复
- `fixed`：缺陷已修复，待验证
- `closed`：缺陷已验证通过，已关闭

建议定期审查历史缺陷状态，更新修复进度。

### Q5：故障库的版本如何管理？

A：参考[版本管理](#43版本管理)章节：
- 使用语义化版本号（major.minor.patch）
- 根据变更类型升级版本号
- 记录版本历史和变更内容

### Q6：如何统计故障库的覆盖度？

A：使用[统计与报告](#45统计与报告)章节中的命令：
- 统计各故障库故障数量
- 统计baseline和issue_derived比例
- 定期生成故障库报告
- 分析覆盖度趋势

---

## 附录

### A. 故障库统计信息

| 维度 | 故障数量 | 主要类别 |
|------|---------|---------|
| Web前端 | 29个 | 输入校验、流程组合、渲染异常、鉴权 |
| REST API | 23个 | 参数异常、协议异常、业务状态、响应契约 |
| Agent场景 | 22个 | Prompt输入、LLM输出、工具调用、流式中断 |
| DFX可靠性 | 28个 | 依赖失效、资源耗尽、恢复降级、可观测性 |
| **总计** | **102个** | - |

### B. 故障来源标准分布

| 来源标准 | 故障数量 | 占比 |
|---------|---------|------|
| ISTQB软件测试通用失效模式 | 25个 | 24.5% |
| OWASP Web/API Security Top10 | 15个 | 14.7% |
| ChaosLLM Agent失效模式 | 22个 | 21.6% |
| CNCF ChaosMesh混沌工程 | 22个 | 21.6% |
| LLM流式对话行业实践 | 12个 | 11.8% |
| 线上真实生产故障复盘 | 6个 | 5.9% |

### C. 联系方式

**故障库维护团队**：test_engineering_team

**故障库贡献**：请提交Issue或Pull Request

---

**最后更新**：2026-06-27
**当前版本**：v1.0.0
**适用范围**：Web / REST API / Agent / DFX（baseline + issue_derived）
