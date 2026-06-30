# Stage2 通用代码扫描指南

> 本文件指导 stage2 子 Agent 如何扫描不同技术栈的被测系统（SUT），采集测试相关源码事实。
> stage2 的目标不是证明运行时行为，而是生成 `code_analysis.md`、`.state/s2_code_facts.json`
> 与 `.state/framework_scenes.json`，为 stage2.5 的真实契约校准和 stage3a 的场景补充提供静态线索。
>
> **最终判据仍以 `contract.md` 为准**：源码扫描结果是探测假设和证据索引；运行时形态与源码推断冲突时，stage2.5 probe 胜出。

---

## 0. Adapter Layer

stage2 先读取 `.state/code_scan_plan.json`。如果该文件不存在，先运行：

```bash
python3 {skill_dir}/scripts/prepare_code_scan.py --code-path {code_path} --output-dir {output_dir}
```

`code_scan_plan.json` 由确定性脚本生成，包含：

| 字段 | 含义 |
|------|------|
| `primary_profile` | 选中的扫描 profile，如 `java.spring`、`python.web_api`、`cpp.service_rpc`、`generic.source_tree` |
| `language` / `frameworks` | 识别出的主语言与框架线索 |
| `confidence` | profile 置信度；低置信度必须更保守，无法确定的形态标 `needs-runtime-verify` |
| `detected_profiles[].evidence` | profile 选择依据，写入 stage2 证据链 |
| `scan_hints.probe_categories` | P0/P1/P2 可用的结构、入口、异常、序列化、约束、流式、配置、依赖探测模式 |

profile 定义位于 `shared/code_scan_profiles.json`。新增语言时优先扩展 profile，不改变下游 fact schema。

---

## 1. 稳定事实模型

无论 SUT 是 Java、Python、C++ 或未知栈，stage2 都必须输出同一组事实：

| 事实类别 | 下游用途 |
|----------|----------|
| `entry_catalog` | 黑盒可达入口、传输协议、参数形态、源码证据 |
| `exception_catalog` | 用户可感知异常、错误码、触发条件、可达入口 |
| `constraint_catalog` | 参数、类型、状态和参数交互约束 |
| `serialization_facts` | 响应包装、id 类型、枚举/状态命名、流式事件、错误响应形态 |
| `code_defects` | 可经黑盒入口触达的缺陷线索 |
| `code_only_capabilities` | 需求未必描述、但源码暴露的用户操作主题 |
| `framework_scenes` | 从源码结构派生的框架/协作/深链场景 |

允许新增可选字段，但不得删除既有字段。推荐可选字段：

```json
{
  "meta": {
    "primary_profile": "python.web_api",
    "language": "python",
    "frameworks": ["fastapi"],
    "profile_confidence": 0.9,
    "scan_plan": ".state/code_scan_plan.json"
  },
  "entry_catalog": [
    {
      "class": "app",
      "method": "create_item",
      "signature": "POST /items",
      "transport": "http",
      "framework": "fastapi",
      "evidence": "app.py:12"
    }
  ]
}
```

---

## 2. 分层读取策略

### P0 - 结构与入口发现

先按 `code_scan_plan.scan_hints.probe_categories.structure` 和 `entrypoints` 探测文件布局、构建文件、服务启动点、路由/接口声明。只读取命中入口和模型的关键文件，不全量读仓库。

### P1 - 入口、模型、错误映射

并行读取 P0 命中的入口文件、错误处理文件、序列化/模型文件。必须提取：

- 用户可触达入口：HTTP route、RPC service、CLI/server bootstrap、网关注册、公开协议文档入口。
- 请求参数：body/query/path/header/message 字段、required/default/enum/range。
- 响应形态：包装层、业务对象路径、错误响应路径、id 回带、状态/枚举命名。
- 用户可感知错误：HTTP 状态码、业务错误码、异常 handler、返回 Status/Result 的分支。

### P2 - 内部实现线索

内部实现默认用搜索补充，不逐文件全读。仅在需要证明 `reachable_from`、约束触发条件、序列化形态或缺陷位置时读取小范围上下文。

---

## 3. Profile 扫描要点

### `java.spring`

使用 `shared/java_scan_guide.md` 作为 Java/Spring profile 附录。重点信号：

- 入口：`@RestController` / `@Controller` / `@*Mapping`
- 错误：`@ControllerAdvice` / `@ExceptionHandler` / `ResponseStatusException`
- 序列化：Jackson、protobuf-JSON、response wrapper、enum/oneof
- 依赖链：Controller -> Service -> Component/Repository

### `python.web_api`

重点信号：

- FastAPI：`FastAPI()`、`APIRouter()`、`@app.get/post`、`Depends()`、`HTTPException`
- Flask：`Flask()`、`Blueprint()`、`@app.route`、`errorhandler`、`jsonify`
- Django/DRF：`urlpatterns`、`APIView`、`ViewSet`、serializer、settings
- 序列化与约束：Pydantic `BaseModel`/`Field`、dataclass、Marshmallow/DRF serializer
- 流式：`StreamingResponse`、`EventSourceResponse`、generator/yield、websocket

### `cpp.service_rpc`

重点信号：

- gRPC/protobuf：`.proto service`、`grpc::ServerBuilder`、`ServiceImpl`、`grpc::Status`
- HTTP C++ 库：Boost.Beast、cpp-httplib、Pistache、Restbed、Crow、oatpp
- 序列化：protobuf、nlohmann::json、rapidjson、JsonCpp
- 约束与缺陷：`StatusCode`、`throw std::...`、`CHECK/assert`、Validate/IsValid
- 依赖链：server main -> service impl -> client/repository/component

### `generic.source_tree`

未知或低置信度时使用。目标是保底产出可交接事实，而不是强行猜测：

- 从 README、OpenAPI/proto/schema/config 中找公开入口。
- 从 `route`、`endpoint`、`server`、`handler`、`service` 等关键词抽取候选入口。
- 所有无法证明传输协议、响应形态、运行时可达性的条目标 `needs-runtime-verify`。

---

## 4. 模块角色与入口追溯

`module_role` 仍分为：

| 角色 | 判定 |
|------|------|
| 独立功能 | 有用户可触达入口、网关注册、公开协议/接口文档、或可运行服务启动点 |
| 支持性组件 | 无独立入口，只被其他模块调用 |

支持性组件必须反向追溯 host 入口。追溯依据随 profile 改变：

- Java：注入、构造器、Spring Bean、import。
- Python：router include、dependency injection、import、app factory。
- C++：server registration、service impl 绑定、构造/成员依赖、include。
- Generic：配置/文档/引用链。

追溯不到 host 时，`host_class` 填 `null`，`forbidden_direct_apis` 仍必须列出内部 API，防止后续用例绕过黑盒入口。

---

## 5. 框架场景派生

stage2 应从源码结构派生三类框架场景，写入 `.state/framework_scenes.json`：

| 场景型 | 规则 |
|--------|------|
| 单模块入口 | 一个公开入口直接触发一个功能模块 |
| 跨模块协作 | 入口模块调用至少一个支持性模块 |
| 深度调用链 | 调用链深度 >= 2，如 route -> service -> client/repository |

`category` 使用稳定枚举：核心引擎、数据存储、通信、编排、插件、配置、工具。无法确认入口时 `entry_hint` 标 `needs-runtime-verify`。

---

## 6. 自检清单

| 检查项 | 要求 |
|--------|------|
| profile | `s2_code_facts.meta.primary_profile` 与 `.state/code_scan_plan.json.primary_profile` 一致 |
| 入口 | 用户可触达入口进入 `entry_catalog`，内部 helper/private API 不作为入口 |
| 异常 | `exception_catalog` 只保留用户可感知错误，尽量填 `reachable_from` 与 `error_code` |
| 约束 | 参数、类型、枚举、参数交互约束进入 `constraint_catalog` |
| 序列化 | `serialization_facts` 对响应包装、id、枚举、错误、流式形态给出 evidence 或 `needs-runtime-verify` |
| code_only | 每条为用户操作主题，不是单个内部方法 |
| framework | `framework_scenes` 至少覆盖相关入口/协作/深链；不确定处标 `needs-runtime-verify` |
| contract safety | 不把源码推断当强 oracle；stage2.5 仍负责校准真实 `contract.md` |
