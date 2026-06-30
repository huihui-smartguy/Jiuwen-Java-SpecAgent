# 代码分析输出模板（通用版）

> 本模板定义 stage2 对源码型 SUT 静态扫描后的标准输出格式。
> 扫描方法见 `shared/code_scan_guide.md`；profile 细节见 `shared/code_scan_profiles.json`。
> 所填事实是派生 `contract.md` 的静态依据，运行时以 stage2.5 probe 校准为准。
> 这是一份填空模板：把 `{占位}` 替换为真实值，无内容的表保留表头并标注“无”。

---

## 模板内容

```markdown
# 代码分析报告

**代码路径**: {code_path}
**模块**: {module}
**分析日期**: {date}
**扫描文件数**: {N}
**Profile**: {primary_profile} ({language}, confidence={confidence})
**框架/协议线索**: {frameworks / transports}

---

## 一、扫描范围

- 代码路径: {code_path}
- 扫描模式: 静态源码事实扫描（profile adapter + grep/read 证据）
- 主语言/框架: {language} / {frameworks}
- 对外协议/传输: {HTTP / RPC / gRPC / SSE / WebSocket / needs-runtime-verify}
- code_scan_plan: `{output_dir}/.state/code_scan_plan.json`

---

## 二、入口目录

| 入口载体 | 框架/传输 | 入口签名 | 公开方法 | 入参 | 源文件:行 | 证据 |
|----------|-----------|----------|----------|------|-----------|------|
| {class/module/service} | {framework / transport} | {POST /path 或 Service.Method} | {handler()} | {body/query/message} | {file}:{line} | {route/proto/annotation/config} |
| ... | | | | | | |

> RPC/body 分发说明（如适用）：单传输入口下的业务 method 字段、proto service method、或消息类型分发表。

---

## 三、异常/错误映射与错误码

| 错误码/状态 | 来源符号 | 触发条件 | message 模式 | 映射位置 | 规约地位 | 源文件:行 |
|-------------|----------|----------|--------------|----------|----------|-----------|
| {code/status} | {ERR_XXX / Status} | {trigger} | {pattern} | {handler/advice/status branch} | spec-required / needs-runtime-verify | {file}:{line} |
| ... | | | | | | |

---

## 四、状态 / 类型 / 结果枚举

| 类型/枚举 | 取值（源码） | 线缆候选形态 | 终态? | 源文件:行 |
|-----------|--------------|----------------|:---:|-----------|
| {EnumClass/Type} | {COMPLETED} | {short/full/prefix/needs-runtime-verify} | 是 | {file}:{line} |
| ... | | | | |

> 线缆实际写法以 stage2.5 probe 为准；断言侧应使用 contract.md 指定的归一规则。

---

## 五、响应序列化形态

| 场景 | 静态推断形态 | 容差访问/比较 | 证据 | 待 probe 确认 |
|------|--------------|----------------|------|----------------|
| 成功响应 | {统一包装 / 裸结构 / RPC response} | {访问路径} | {file}:{line} | {否 / needs-runtime-verify} |
| id / 回带字段 | {int/string/opaque} | `id_eq` 或 contract 指定策略 | {file}:{line} | {} |
| 流式/多态事件 | {SSE / gRPC stream / WebSocket / oneof} | {事件访问规则} | {file}:{line} | {} |
| 错误响应 | {error.code/status/message path} | — | {file}:{line} | {} |

---

## 六、流式 / 长连接形态

| 项 | 静态发现 | 待 probe 确认 |
|----|----------|----------------|
| 流式入口标识 | {text/event-stream / StreamingResponse / grpc ServerWriter / websocket} | {真实帧序列} |
| 事件/消息类型 | {Event/Chunk/StatusUpdate/message type} | {真实类型集合} |
| 终止标志 | {final / last / done / grpc status} | {末事件判定} |
| 真实流不变量候选 | {事件非空 + 每帧可识别 + 末态终态} | 以实测为准 |

---

## 七、模块角色（module_role）

| 判定 | 依据 |
|------|------|
| {独立功能 / 支持性组件} | {用户可观测入口 / host 追溯结果 / 文档或路由注册} |

- 独立功能：有用户入口，产 flow + framework + quality 场景。
- 支持性组件：无独立用户入口，仅经 host 入口测试，禁止直接调用内部 API。

---

## 八、配置项（spec-required vs deployment-config-dependent）

| 配置项 | 来源 | 影响字段/行为 | 类别 | 断言强度 |
|--------|------|----------------|------|----------|
| {config-key} | {file/env/settings} | {影响字段/入口/依赖} | deployment-config-dependent | 观察项（非硬失败） |
| ... | | | | |

---

## 九、代码缺陷扫描（CD）

| 问题ID | 问题类型 | 问题位置 | 问题描述 | 严重程度 |
|--------|----------|----------|----------|----------|
| CD_001 | {空值未处理/异常未映射/状态错配/资源泄漏/潜在缺陷} | {file}:{line} | {描述} | 高/中/低 |
| ... | | | | |

> 仅记录可经黑盒入口触达的缺陷线索；不可达内部问题降级或剔除。

---

## 十、代码独有能力（code_only）

| 能力入口 | 描述 | 相关入口/方法 | 独立场景判定依据 | 场景类型 |
|----------|------|----------------|------------------|----------|
| {entry} | {用户操作场景描述} | {related_methods} | {evidence} | independent / sub_operation |
| ... | | | | |

---

## 十一、统计汇总

| 类别 | 数量 |
|------|------|
| 入口/端点 | {N} |
| 错误映射 | {N} |
| 约束条目 | {N} |
| 序列化事实 | {N}（needs-runtime-verify {x}） |
| 代码缺陷 CD | {N}（高 {x} / 中 {x} / 低 {x}） |
| code_only 能力 | {N} |
| 框架场景候选 | {N} |
```

---

## 问题类型定义（CD）

| 问题类型 | 说明 | 常见识别方式 |
|----------|------|--------------|
| 空值未处理 | 可能返回 null/None/nullptr 后未检查 | 链式访问、指针/optional 未判空、缺少 guard |
| 异常/错误未映射 | 用户触发错误没有稳定响应映射 | 抛异常但无 handler/status；返回内部错误 |
| 状态/序列化错配 | 源码模型与线缆候选形态不一致 | wrapper/enum/id/oneof/JSON/protobuf 不一致 |
| 资源/并发风险 | 连接、文件、锁、任务生命周期未收敛 | 未关闭、未 await、锁/线程/流终止缺口 |
| 潜在缺陷 | 边界、配置、依赖失败处理不清 | 逻辑分析 + 黑盒可达入口 |

## 严重程度定义

| 等级 | 定义 | 示例 |
|------|------|------|
| **高** | 可能导致服务崩溃、协议违例、数据丢失、安全边界失效 | 5xx、错误码缺失、状态机违规 |
| **中** | 可能导致功能异常或测试判据不稳定 | 边界处理不当、序列化错配、配置依赖误判 |
| **低** | 代码质量或低危兼容性问题 | 冗余、命名、低危兼容细节 |
