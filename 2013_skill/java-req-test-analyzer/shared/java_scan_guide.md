# Java/Spring 静态扫描指南

> 本文件指导 stage2 子 Agent 如何**静态扫描一个 Java/Spring 被测服务（SUT）**，
> 采集测试相关事实，产出 `code_analysis.md`（见 `code_analysis_template.md` 格式）。
>
> **定位**：本扫描结果是**派生 `contract.md` 的静态依据**。但静态扫描可能与真实线缆形态有偏差
> （上轮 R1–R4 即源于此），因此 **运行时一律以 stage2.5 probe 校准为准**；冲突时 probe 胜出。
>
> 锚定示例为 A2A / agent-runtime（`POST /a2a` + JSON-RPC），但本指南适用于任意 Java/Spring REST/RPC SUT。

---

## 0. 扫描目标六类事实

| # | 事实类别 | 用途 |
|---|----------|------|
| 1 | **入口端点** | 派生用户可观测入口、HTTP 方法、路径 |
| 2 | **异常映射与错误码** | 派生负向用例的 `error.code` 硬断言 |
| 3 | **状态/结果枚举** | 派生 `status.state` 等枚举断言（注意 protobuf-JSON 全名） |
| 4 | **SDK 序列化/响应包装** | 派生响应形态访问（oneof 包装、字段嵌套） |
| 5 | **SSE / 流式事件类型** | 派生流式用例的事件骨架与终态 |
| 6 | **配置项** | 区分 spec-required 与 deployment-config-dependent 字段 |

---

## 1. 入口端点

扫描 Controller 层注解，编录公开 HTTP 入口。

| 注解 | 含义 |
|------|------|
| `@RestController` / `@Controller` | 入口类 |
| `@RequestMapping` | 类级/方法级路径前缀 |
| `@PostMapping` / `@GetMapping` / `@PutMapping` / `@DeleteMapping` | HTTP 方法 + 路径 |
| `@RequestBody` / `@RequestParam` / `@PathVariable` | 入参形态 |

```bash
rg -n "@RestController|@RequestMapping|@(Post|Get|Put|Delete)Mapping" --type java
rg -n "@(Post|Get)Mapping\([\"']([^\"']+)" -o --type java   # 提取路径字面量
```

> A2A 锚点：单端点 `@PostMapping("/a2a")`，method 字段在 JSON-RPC body 内（`SendMessage`/`GetTask`/...），
> 而非 URL 路径——扫描时注意区分"HTTP 路由"与"RPC 方法分发"。

---

## 2. 异常映射与错误码

| 注解 / 形态 | 含义 |
|-------------|------|
| `@ControllerAdvice` / `@RestControllerAdvice` | 全局异常处理器类 |
| `@ExceptionHandler(XxxException.class)` | 异常→响应映射 |
| 错误码常量 / 枚举 | JSON-RPC error.code 来源（如 `-32700/-32601/-32001`）|

```bash
rg -n "@RestControllerAdvice|@ControllerAdvice|@ExceptionHandler" --type java
rg -n "(-3260[0-9]|-327[0-9]{2}|-3200[0-9])" --type java        # JSON-RPC 错误码字面量
rg -n "enum\s+\w*(Error|Code|Reason)\w*" --type java            # 错误码枚举
rg -n "JSON_PARSE|TASK_NOT_FOUND|Unsupported JSON-RPC" --type java  # 错误 reason/message 常量
```

> 错误码映射是负向用例的硬断言来源（spec-required），逐条记录 `code → 触发条件 → message 模式`。

---

## 3. 状态 / 结果枚举

```bash
rg -n "enum\s+TaskState|TASK_STATE_\w+" --type java
rg -n "SUBMITTED|WORKING|COMPLETED|FAILED|CANCELED|INPUT_REQUIRED" --type java
```

> **⚠️ protobuf-JSON 枚举全名**：proto 生成的 JSON 序列化常用**全名**形式 `TASK_STATE_COMPLETED`，
> 而需求文档/源码常量可能写短名 `COMPLETED`。断言侧必须经 `normalize_state()` 容错两种写法，
> 并在 `contract.md` 记录真实线缆是哪种（probe 校准）。

---

## 4. SDK 序列化 / 响应包装（oneof）

A2A SDK（`org.a2aproject.sdk`）采用 **protobuf-JSON**，响应是 oneof 包装，**不是裸结构**。

| 形态 | 真实嵌套 | 访问器 |
|------|----------|--------|
| 成功 result | `result.task`（不是 `result` 本身） | `task_of(result)` |
| SSE 事件 | `result.task` / `result.statusUpdate` / `result.artifactUpdate` 三选一 | `event_kind/event_state` |
| JSON-RPC id | 回带为 int（请求侧 str） | `id_eq` |

```bash
rg -n "oneof|@JsonProperty|protobuf|JsonFormat|toJson|fromJson" --type java
rg -n "class\s+\w*(Response|Result|Envelope)" --type java
rg -n "statusUpdate|artifactUpdate|TaskStatusUpdateEvent" --type java
```

> 这正是 R1（result.task 包装）/ R3（SSE oneof）/ R2（id 类型）的静态根因。
> 扫描出包装结构后，**仍须 probe 实测确认**字段实际嵌套与命名。

---

## 5. SSE / 流式事件

```bash
rg -n "text/event-stream|produces\s*=|SseEmitter|Flux<|ServerSentEvent" --type java
rg -n "class\s+\w*(TaskStatusUpdateEvent|ArtifactUpdateEvent|TaskAccepted\w*)" --type java
```

| 关注点 | 说明 |
|--------|------|
| `produces = MediaType.TEXT_EVENT_STREAM_VALUE` | 标识流式端点 |
| 事件类型类 | `TaskStatusUpdateEvent` / `ArtifactUpdateEvent` 等 → 事件骨架 |
| 终止标志 | `final` / `last` 字段 → `event_is_final` |

> ⚠️ 上轮教训：需求文档"三段式（TaskAccepted/ArtifactUpdate/TaskStatusUpdate）"比真实流更细。
> 真实流可能仅 N×TaskStatusUpdate。断言只能基于 probe 实测的真实流不变量（事件非空 + 每帧 kind 可识别 + 末事件终态）。

---

## 6. 配置项（spec-required vs deployment-config-dependent）

```bash
rg -n "public-base-url|a2a|agent-runtime" $SUT/src/main/resources/application*.{yml,yaml,properties}
rg -n "@ConfigurationProperties|@Value\(" --type java
rg -n "class\s+\w*Properties" --type java
```

| 配置类别 | 处理 |
|----------|------|
| 协议必需（错误码、状态枚举、必填字段） | spec-required → 硬断言 |
| 部署配置相关（如 `AgentCard.url` 依赖 `public-base-url`） | deployment-config-dependent → 观察项，非硬失败 |

> R4 即此类：`AgentCard.url` 未配 `public-base-url` 时为空，属部署配置观察项，不作硬断言。

---

## 7. 扫描产出与交接

- 产出：`code_analysis.md`（格式见 `shared/code_analysis_template.md`）+ `.state/s2_code_facts.json`。
- 交接给 stage2.5：作为 `probe_contract.py` 的探活假设输入。
- **最终判据以 `contract.md`（probe 校准产物）为准**；本扫描仅提供"该探什么、预期形态是什么"的静态线索。
