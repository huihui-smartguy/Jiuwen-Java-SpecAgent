# Java/Spring 静态扫描指南

> 本文件指导 stage2 子 Agent 如何**静态扫描一个 Java/Spring 被测服务（SUT）**，
> 采集测试相关事实，产出 `code_analysis.md`（见 `code_analysis_template.md` 格式）。
>
> **定位**：本扫描结果是**派生 `contract.md` 的静态依据**。静态扫描可能与真实线缆形态有偏差，
> 因此 **运行时一律以 stage2.5 probe 校准为准**；冲突时 probe 胜出。
>
> 本指南**协议无关**，适用于任意 Java/Spring REST/RPC SUT。文中标注 `【A2A 示例】` 的段落仅为
> 一个具体协议的举例（`POST /a2a` + JSON-RPC + protobuf-JSON），不代表所有 SUT 都是此形态。

---

## 0. 扫描目标六类事实

| # | 事实类别 | 用途 |
|---|----------|------|
| 1 | **入口端点** | 派生用户可观测入口、HTTP 方法、路径 |
| 2 | **异常映射与错误码** | 派生负向用例的错误码/错误响应硬断言 |
| 3 | **状态/结果枚举** | 派生状态字段等枚举断言（注意序列化全名写法） |
| 4 | **响应序列化/包装形态** | 派生响应形态访问（包装、字段嵌套、oneof） |
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

> 【A2A 示例】单端点 `@PostMapping("/a2a")`，业务 method 在 JSON-RPC body 内（`SendMessage`/`GetTask`/...），
> 而非 URL 路径——这类“单 HTTP 路由 + body 内方法分发”的 RPC 形态，扫描时注意区分“HTTP 路由”与“方法分发”。

---

## 2. 异常映射与错误码

| 注解 / 形态 | 含义 |
|-------------|------|
| `@ControllerAdvice` / `@RestControllerAdvice` | 全局异常处理器类 |
| `@ExceptionHandler(XxxException.class)` | 异常→响应映射 |
| 错误码常量 / 枚举 | 错误响应 code 来源（HTTP 状态码 / 业务码 / 协议码） |

```bash
rg -n "@RestControllerAdvice|@ControllerAdvice|@ExceptionHandler" --type java
rg -n "enum\s+\w*(Error|Code|Reason|Status)\w*" --type java       # 错误码/状态枚举
rg -n "HttpStatus\.\w+|ResponseStatusException" --type java        # Spring 标准错误响应
```

> 错误码映射是负向用例的硬断言来源（spec-required），逐条记录 `code → 触发条件 → message 模式`。
> 【A2A 示例】JSON-RPC 错误码字面量（如 `-32700/-32601/-32001`）：
> `rg -n "(-3260[0-9]|-327[0-9]{2}|-3200[0-9])" --type java`。

---

## 3. 状态 / 结果枚举

```bash
rg -n "enum\s+\w*(State|Status|Result|Phase)\w*" --type java
rg -n "SUCCEEDED|FAILED|RUNNING|PENDING|COMPLETED|CANCELED" --type java   # 按 SUT 调整关键字
```

> **⚠️ 序列化全名**：某些序列化（如 protobuf-JSON）枚举用**全名**形式，而源码常量可能写短名。
> 断言侧必须容错两种写法（通用 `normalize_state()` 处理常见前缀），并在 `contract.md` 记录真实线缆是哪种（probe 校准）。
> 【A2A 示例】proto 生成的 JSON 常见 `TASK_STATE_COMPLETED`（全名）对短名 `COMPLETED`。

---

## 4. 响应序列化 / 包装形态

响应未必是裸结构——常见包装、嵌套、oneof。逐一记录嵌套路径，供断言访问。

| 形态 | 说明 |
|------|------|
| 统一响应包装 | 如 `{code,data,message}` / `result.xxx` 包一层 |
| oneof / 多态 | 同一字段按类型携带不同子结构 |
| id / 回带字段 | 请求 id 的回带类型（可能 int↔str 不一致） |

```bash
rg -n "@JsonProperty|@JsonFormat|@JsonInclude|@JsonTypeInfo" --type java
rg -n "class\s+\w*(Response|Result|Envelope|Wrapper|Dto)" --type java
rg -n "oneof|JsonFormat|toJson|fromJson" --type java       # protobuf-JSON / 自定义序列化
```

> 扫描出包装结构后，**仍须 probe 实测确认**字段实际嵌套与命名。
> 【A2A 示例】成功 result 包在 `result.task`（不是 `result` 自身）；SSE 事件 result 是 oneof
> （`task`/`statusUpdate`/`artifactUpdate`）；JSON-RPC id 回带为 int 而请求侧为 str。

---

## 5. SSE / 流式事件

```bash
rg -n "text/event-stream|produces\s*=|SseEmitter|Flux<|ServerSentEvent" --type java
rg -n "class\s+\w*(Event|Update|Chunk)\b" --type java
```

| 关注点 | 说明 |
|--------|------|
| `produces = MediaType.TEXT_EVENT_STREAM_VALUE` | 标识流式端点 |
| 事件类型类 | 各事件类 → 事件骨架名 |
| 终止标志 | `final` / `last` / `done` 字段 → 末事件判定 |

> ⚠️ 需求文档描述的事件序列可能比真实流更细/更粗。断言只能基于 probe 实测的真实流不变量
> （事件非空 + 每帧可识别 + 末事件终态）。
> 【A2A 示例】需求“三段式（TaskAccepted/ArtifactUpdate/TaskStatusUpdate）”，真实流可能仅 N×TaskStatusUpdate。

---

## 6. 配置项（spec-required vs deployment-config-dependent）

```bash
rg -n "@ConfigurationProperties|@Value\(" --type java
rg -n "class\s+\w*Properties" --type java
rg -n "<关注配置键>" $SUT/src/main/resources/application*.{yml,yaml,properties}
```

| 配置类别 | 处理 |
|----------|------|
| 协议必需（错误码、状态枚举、必填字段） | spec-required → 硬断言 |
| 部署配置相关（取值依赖部署，未配置时可空） | deployment-config-dependent → 观察项，非硬失败 |

> 【A2A 示例】`AgentCard.url` 未配 `public-base-url` 时为空，属部署配置观察项，不作硬断言。

---

## 7. 扫描产出与交接

- 产出：`code_analysis.md`（格式见 `shared/code_analysis_template.md`）+ `.state/s2_code_facts.json`。
- 交接给 stage2.5：作为 `probe_contract.py` 的探活假设输入。
- **最终判据以 `contract.md`（probe 校准产物）为准**；本扫描仅提供“该探什么、预期形态是什么”的静态线索。
