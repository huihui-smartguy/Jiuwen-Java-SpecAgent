# 代码分析输出模板（Java/Spring 版）

> 本模板定义 stage2 对 Java/Spring SUT 静态扫描后的标准输出格式。
> 扫描方法见 `shared/java_scan_guide.md`。**所填事实是派生 `contract.md` 的静态依据，运行时以 probe 校准为准。**
> 这是一份**填空模板**——把 `{占位}` 替换为真实值，无内容的表保留表头并标注"无"。

---

## 模板内容

```markdown
# 代码分析报告（Java/Spring）

**代码路径**: {code_path}
**模块**: {module}
**分析日期**: {date}
**扫描文件数**: {N}
**SDK / 序列化**: {如 org.a2aproject.sdk · protobuf-JSON}

---

## 一、扫描范围

- 代码路径: {code_path}
- 扫描模式: 静态分析（注解/常量/枚举/序列化）
- 框架: Spring Boot {version}
- 对外协议: {如 JSON-RPC over POST /a2a + GET AgentCard}

---

## 二、入口端点表

| 类 | 类级注解 | 方法注解 | HTTP 方法 | 路径 | 公开方法 | 入参 | 源文件:行 |
|----|----------|----------|-----------|------|----------|------|-----------|
| {Controller} | @RestController | @PostMapping | POST | /a2a | {handle()} | @RequestBody {Body} | {file}:{line} |
| ... | | | | | | | |

> RPC 分发说明（如适用）：URL 单端点，业务方法在 body 的 `method` 字段（{SendMessage/GetTask/...}）。

---

## 三、异常映射与错误码表

| 错误码 | 常量/枚举名 | 触发条件 | message 模式 | @ExceptionHandler 所在类 | 规约地位 | 源文件:行 |
|--------|-------------|----------|--------------|--------------------------|----------|-----------|
| {-32700} | {ERR_PARSE} | {非法 JSON 请求体} | {JSON_PARSE} | {GlobalExceptionAdvice} | spec-required | {file}:{line} |
| ... | | | | | | |

---

## 四、状态 / 结果枚举

| 枚举类 | 取值（短名） | protobuf-JSON 全名 | 终态? | 源文件:行 |
|--------|--------------|--------------------|:---:|-----------|
| {TaskState} | {COMPLETED} | {TASK_STATE_COMPLETED} | 是 | {file}:{line} |
| ... | | | | |

> 线缆实际写法（短名 / 全名）以 stage2.5 probe 为准；断言侧经 `normalize_state()` 容错。

---

## 五、响应序列化形态

| 场景 | 静态推断的嵌套形态 | 容差访问器 | 备注（待 probe 确认） |
|------|--------------------|------------|------------------------|
| 成功 result | {result.task（oneof 包装）} | `task_of` | R1 反例：勿裸取 result |
| JSON-RPC id | {回带 int / 原样} | `id_eq` | R2 反例：类型容差 |
| SSE 事件 | {result.{task\|statusUpdate\|artifactUpdate}} | `event_kind/event_state` | R3 反例：oneof |
| 错误响应 | {error.code / error.message + 回带 id} | — | — |

---

## 六、SSE / 流式形态

| 项 | 静态发现 | 待 probe 确认 |
|----|----------|----------------|
| 流式端点标识 | {produces=text/event-stream / SseEmitter / Flux} | — |
| 事件类型类 | {TaskStatusUpdateEvent, ArtifactUpdateEvent} | 真实流是否含全部类型 |
| 终止标志 | {statusUpdate.final / .last} | `event_is_final` |
| 真实流不变量 | {N×TaskStatusUpdate，末态终态} | 以实测为准 |

---

## 七、模块角色（module_role）

| 判定 | 依据 |
|------|------|
| {独立功能 / 支持性组件} | {是否有用户可观测入口；用户层触发方式} |

- 独立功能：有用户入口，产 flow + framework + quality 场景。
- 支持性组件：无独立用户入口，仅产 framework + quality 场景。

---

## 八、配置项（spec-required vs deployment-config-dependent）

| 配置项 | 来源 | 影响字段 | 类别 | 断言强度 |
|--------|------|----------|------|----------|
| {public-base-url} | {application.yml} | {AgentCard.url} | deployment-config-dependent | 观察项（非硬失败） |
| ... | | | | |

---

## 九、代码缺陷扫描（CD）

| 问题ID | 问题类型 | 问题位置 | 问题描述 | 严重程度 |
|--------|----------|----------|----------|----------|
| CD_001 | {空值未处理/异常未捕获/潜在缺陷} | {file}:{line} | {描述} | 高/中/低 |
| ... | | | | |

> 仅记录可经黑盒入口触达的缺陷线索；不可达的内部问题降级或剔除。

---

## 十、代码独有能力（code_only）

| 能力入口 | 描述 | 独立场景判定依据 | 场景类型 |
|----------|------|------------------|----------|
| {entry} | {用户操作场景描述} | {evidence} | independent / sub_operation |
| ... | | | |

---

## 十一、统计汇总

| 类别 | 数量 |
|------|------|
| 入口端点 | {N} |
| 错误码映射 | {N} |
| 状态枚举值 | {N} |
| 代码缺陷 CD | {N}（高 {x} / 中 {x} / 低 {x}） |
| code_only 能力 | {N} |
```

---

## 问题类型定义（CD）

| 问题类型 | 说明 | 识别方式（Java） |
|----------|------|------------------|
| 空值未处理 | 可能返回 null 后未检查 | `.xxx()` 链 + 缺少 null 校验 |
| 异常未捕获 | 抛出但无对应 @ExceptionHandler / try-catch | `throw new` 无映射 |
| 死代码 | 未被路由/调用的公开方法 | 无引用的 public 方法 |
| 潜在缺陷 | 类型/并发/序列化错配 | 逻辑分析 |

## 严重程度定义

| 等级 | 定义 | 示例 |
|------|------|------|
| **高** | 可能导致服务崩溃 / 协议违例 / 数据丢失 | 5xx、错误码缺失、状态机违规 |
| **中** | 可能导致功能异常 | 边界处理不当、序列化错配 |
| **低** | 代码质量问题 | 冗余、命名、低危兼容性细节 |
