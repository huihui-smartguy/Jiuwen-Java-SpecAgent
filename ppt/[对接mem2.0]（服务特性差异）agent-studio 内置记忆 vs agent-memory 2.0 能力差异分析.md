# agent-studio 内置记忆 vs agent-memory 2.0 能力差异分析

> 对比对象：agent-studio 平台的 BUILTIN（内置）记忆路径 与 agent-memory 2.0 外部记忆服务
> 用途：客观呈现两者在架构、提取、检索、管理、生命周期等维度的能力差异，供集成选型与演进决策参考

---

## 0. 核心结论

| | BUILTIN | agent-memory 2.0 |
|---|---------|------------------|
| 定位 | 运行态进程内 SDK 记忆模块 | 独立记忆服务（可独立部署/扩缩容/选型） |
| 记忆模型 | 扁平事实（user_profile / semantic / episodic / summary 四类） | 分层记忆单元（6 个 tier + 多层内容层 + 版本链 + 生命周期状态机） |
| 检索 | 单步向量召回 | 5 步流水线（解析→召回→融合→披露→检索） |
| 写入 | 批量 `add_messages` + LLM 一次性抽取 | 单条/批量 `add` + 可选 `infer` 触发 Evolver 同步抽取 |
| 演进 | 无 | Evolver 四模式（抽取 / 关联 / 合并 / 遗忘）+ 定时 sweep |
| 存储 | 固定 OpenSearch + Redis | 7 类 Store 端口可插拔（KV/向量/全文/图/融合/文件/实体） |

---

## 1. 部署架构

| 维度 | BUILTIN（内置） | agent-memory 2.0 |
|------|-----------------|------------------|
| 部署形态 | 进程内 SDK，与 agent-runtime 同进程，`init_ltm(redis_client)` 在 server lifespan 启动 | 独立 HTTP 服务，`ThreadingHTTPServer` 默认 `127.0.0.1:8137`，Docker `--host 0.0.0.0 --port 8137` |
| 进程关系 | 记忆计算与运行态耦合，无法独立扩缩容 | 记忆服务与运行态完全解耦，独立扩缩容 |
| 存储栈 | 固定 OpenSearch（向量+正文）+ Redis（KV/锁/scope config） | 每实例按配置组装 7 类 Store 端口，可选 Redis/Postgres/SQLite（KV）、Milvus/pgvector/memory（向量）、Elasticsearch（全文/实体）等 |
| 模型隔离 | 全局环境变量 `MEMORY_LLM_*` / `MEMORY_EMBEDDING_*` 统一指定，所有记忆库共享 | 实例启动配置决定 LLM/Embedding/Reranker，不同实例可部署不同模型 |
| 健康检查 | 无独立端点（进程内直接调用） | `GET /healthz`（注意是 `/healthz`，非 `/health`） |
| 接入形态 | 仅进程内 | HTTP / CLI / MCP（stdio 或 Streamable HTTP）/ SDK 四种接入 |

**BUILTIN 存储栈证据**：`agent_runtime/memory/adapter/ltm_manager.py:64` `init_ltm` 同时创建 `OpenSearchVectorStore` + `RedisKVStore`，存哪类数据由 `MEMORY_INDEX_TYPE` 决定（`default` 模式正文存 OpenSearch，`simple` 模式正文存 Redis KV）。

**2.0 存储可插拔证据**：`jiuwen_memory/storage/` 下 `kv_impl/`（in_memory/sqlite/redis/postgres/encrypted）、`vector_impl/`（memory/milvus/pgvector）、`fulltext_impl/`（memory/elasticsearch）、`graph_impl/`（memory/nano_graphrag）、`fusion_impl/`、`entity_impl/`。Docker online profile 用 Redis+Milvus+Elasticsearch；Postgres profile 用 Postgres+pgvector+Elasticsearch。

---

## 2. 隔离模型

| 维度 | BUILTIN | agent-memory 2.0 |
|------|---------|------------------|
| 隔离维度 | 2 维：`user_id` + `scope_id`（= `memory_repo_id`） | 5 维 Scope：`org / space / user / agent / session` |
| 隔离实现 | OpenSearch term filter：`{user_id, app_id(=scope_id)}` | Store 层物理隔离：每个 Store 方法首参为 `scope`，检索不跨 scope |
| scope 校验 | `_validate_id`：非空、不含 `/`、长度 ≤ 128 | 内核路由坐标键 `("user","agent","session")`；`space` 全局唯一逻辑隔离 |
| user_id 规范 | 强制 `.lower()` | 无大小写转换 |
| 共享机制 | 无（scope config 按 scope_id 存 Redis） | Space 管理（`create_space` / `grant` / `revoke` 跨 scope 授权共享池） |

**关键差异**：BUILTIN 的"租户"边界是 `memory_repo_id`（一个记忆库 = 一个租户），2.0 的租户边界是 `Scope` 五元组，粒度更细且原生支持跨 scope 授权共享（`grant`/`revoke`）。

---

## 3. 记忆模型

这是两者最根本的差异——记忆"长什么样"。

### 3.1 记忆类型 / Tier

| | BUILTIN | agent-memory 2.0 |
|---|---------|------------------|
| 类型枚举 | `MemoryType`：USER_PROFILE / SEMANTIC_MEMORY / EPISODIC_MEMORY / VARIABLE / SUMMARY / UNKNOWN（6 种） | `MemoryTier`：WORKING / CORE / EPISODIC / SEMANTIC / PROCEDURAL / ARCHIVAL（6 种） |
| 摘要记忆 | ✅ 独立 `SUMMARY` 类型，`search_user_history_summary` 专门检索 | ❌ 无独立 summary tier；`PROCEDURAL` tier 承载过程记忆（goal/steps/result），`ContentLayers` 提供 l0 概要/l1 片段的渐进式披露 |
| 过程记忆 | ❌ 无 | ✅ `PROCEDURAL` tier，`add` 时 `system_metadata.procedural=true` 触发结构化抽取 |
| 分层内容 | 无 | ✅ `ContentLayers`：l0（50-100 字概要）+ l1（200-500 字片段），检索时按 `DisclosureLevel`（L0/L1/L2/ADAPTIVE）渐进披露 |

### 3.2 记忆单元结构

| | BUILTIN | agent-memory 2.0 |
|---|---------|------------------|
| 单元标识 | `memory_id` | `unit_id`（scope 内唯一，每条/每版本一个） |
| 内容字段 | 顶层 `content` | `segments[i].content`（多段）+ 只读属性 `unit.content`（拼接所有段） |
| 版本管理 | 无（update 原地覆盖） | ✅ `supersedes` 版本链 + `as_of` 时间旅行查询；`update` 的 SUPERSEDE 模式生成新 id 并链接旧版本 |
| 生命周期状态 | 无显式状态机 | ✅ `LifecycleState`：ACTIVE / FORGOTTEN / ARCHIVED；`t_valid`/`t_invalid` 时间窗口 |
| 元数据 | `system_metadata` / `user_metadata` | 同，但支持 `FilterClause`（EQ/NE/IN/CONTAINS/range）按元数据过滤 |

---

## 4. 记忆提取（写入）

### 4.1 触发方式

| 维度 | BUILTIN | agent-memory 2.0 |
|------|---------|------------------|
| 触发机制 | 轮次累积：Redis 缓存对话轮次，达到 `extract_max_turns`（默认 5）触发批量抽取 | `add` 时 `system_metadata.infer="true"` 同步触发 Evolver EXTRACT；或外部主动调 `evolve` |
| 执行方 | 运行态进程内 SDK + 全局 LLM | agent-memory 服务端 + 实例配置的 LLM |
| 异步性 | 累积触发，批量处理 | `add` 默认同步；`add_async`/`batch_add_async` 异步 |

### 4.2 角色与会话上下文

| 维度 | BUILTIN | agent-memory 2.0 |
|------|---------|------------------|
| 角色区分 | ✅ `UserMessage` / `AssistantMessage` 类型 | ✅ content 前缀 `[user]` / `[assistant]` + `system_metadata.role`；身份信息来自 `security.auth.actor`（认证注入，不接受请求体传入） |
| 会话上下文 | `session_id = conversation_id` | `scope.session = conversation_id` |

### 4.3 提取策略控制

| 维度 | BUILTIN | agent-memory 2.0 |
|------|---------|------------------|
| 策略类型开关 | ✅ `AgentMemoryConfig`：`enable_user_profile` / `enable_semantic_memory` / `enable_episodic_memory` / `enable_summary_memory` | ✅ tier 由 LLM 决定（限定 episodic/semantic/procedural），`ExtractionTarget` 枚举：fact/event/preference/context/structured_record/artifact |
| 自定义提取 prompt | ✅ 写入 scope config：`user_profile_definition` / `semantic_memory_definition` / `episodic_memory_definition`（每种独立 prompt） | ✅ `PromptRegistry` 按 phase（extract/consolidate/reflect）+ key 加载命名 prompt，动态提取器消费；基线提取器用内置 `_EXTRACT_SYSTEM_PROMPT` |
| 前端策略配置 | ✅ IR `configs.memory.strategies: [{type, prompt}]` + `extract_config: {max_chat_turn, time_window}` | ❌ 无前端策略配置入口（策略由实例配置决定，非 per-request） |
| 合并/冲突消解 | LLM 在 `add_messages` 内一次性处理 | ✅ Evolver CONSOLIDATE 模式 + Abstractor 关联 + Dedup 去重，独立可编排 |

**BUILTIN 提取证据**：`memory_extractor.py:469-476` 按 IR `strategies` 的 type 集合设置 `agent_config.enable_*` 开关；`memory_extractor.py:449-453` 按 type 写入对应的 `*_definition` 自定义 prompt。`LongTermMemory.add_messages` 内部调 `generator.gen_all_memory(...)` 做 LLM 抽取。

**2.0 提取证据**：`engine_impl/in_memory_engine.py:267` 读 `infer` 标志，`:328-355` `infer=true` 时同步执行 `evolver.evolve(units, EvolveMode.EXTRACT)`。`llm_extractor.py` 3 阶段管线（预处理→批量 LLM 抽取→构建 MemoryUnit），LLM 输出 JSON 数组 `{source_id, target, tier, content, tags, confidence, event_date}`。

### 4.4 写入粒度

| 维度 | BUILTIN | agent-memory 2.0 |
|------|---------|------------------|
| 消息处理 | 批量 `add_messages(messages, agent_config, ...)`，保留完整对话结构 | 逐条 `add` 或 `batch_add`；`infer=true` 时原始消息存 `/messages/` KV（不索引），派生记忆存 `/memory/` |
| 写入协议 | 进程内 SDK 调用 | HTTP `POST /v1/add`（或 CLI/MCP/SDK） |
| 分布式锁 | ✅ `DistributedLock(kv_store, f"user/{user_id}")` 加锁 | 无显式分布式锁（由 Store 后端并发控制保证） |

---

## 5. 记忆检索（读取）

### 5.1 检索架构

这是能力差异最大的区域之一。

| 维度 | BUILTIN | agent-memory 2.0 |
|------|---------|------------------|
| 检索流程 | 单步：向量召回 + threshold 过滤 | 5 步流水线：`QueryParser` → `Recaller`（多路召回）→ `Fuser`（融合排序）→ `Discloser`（渐进式披露）→ `Retriever`（终截断） |
| 语义记忆检索 | ✅ `search_user_mem(query, num, user_id, scope_id, threshold=0.3)` | ✅ `search(scope, query, top_k=10, filters, as_of, disclosure, with_trajectory)` |
| 历史摘要检索 | ✅ `search_user_history_summary(query, num, user_id, scope_id)` —— 独立方法，搜 `SUMMARY` 类型 | ❌ 无独立摘要检索端点；`inspect` 读完整单元、`trace` 走版本链、`get(as_of)` 时间旅行 |
| 距离度量 | OpenSearch KNN（cosinesimil/faiss/hnsw） | 向量后端自声明 `score_higher_is_better()`；L2 后端须返回 False 否则召回阶段拒绝装配 |

### 5.2 检索参数

| 参数 | BUILTIN | agent-memory 2.0 |
|------|---------|------------------|
| 记忆条数 | `mem_num`（默认 20） | `top_k`（默认 10） |
| 摘要条数 | `summary_num`（默认 5） | N/A（无摘要检索） |
| 相似度阈值 | ✅ `threshold` per-call 透传 | ❌ 无 per-request 参数；实例级 `min_score` / `min_score_ratio` / `min_results`（回填）配置在 `apply_threshold` 生效 |
| 过滤器 | 按 `MemoryType` 枚举过滤 | `FilterClause`（EQ/NE/IN/NOT_IN/CONTAINS/range）作用于 `system_metadata.*` / `user_metadata.*`；另支持路由值谓词 + scope 收窄谓词自动注入 |
| 时间旅行 | ❌ 无 | ✅ `as_of: datetime` 沿 `supersedes` 版本链查询历史版本 |
| 披露层级 | ❌ 无 | ✅ `disclosure: DisclosureLevel`（L0 概要 / L1 片段 / L2 全文 / ADAPTIVE 自适应） |
| 检索轨迹 | ❌ 无 | ✅ `with_trajectory=True` 返回检索过程 trace |

### 5.3 Prompt 注入格式

| 维度 | BUILTIN | agent-memory 2.0 |
|------|---------|------------------|
| 使用模板 | ✅ `MEMORY_USAGE_PROMPT`（在 agent-runtime 侧定义） | ❌ 无内置使用模板（2.0 是纯记忆服务，prompt 拼装由调用方负责） |
| 记忆内容标签 | `<mem>` + `<history_summary>` 两类标签 | 由调用方自行拼装 |

---

## 6. 记忆项管理（CRUD）

| 操作 | BUILTIN | agent-memory 2.0 |
|------|---------|------------------|
| 列表 | ✅ runtime 内部 API `GET /internal/v1/memory-repos/{id}/users/{uid}/memories`（分页 + MemoryType 过滤） | ✅ `POST /v1/list`（分页 + tier 过滤 + 元数据过滤） |
| 搜索 | ✅ `POST .../memories/search`（`search_user_mem` + threshold） | ✅ `POST /v1/search`（5 步流水线 + 多维过滤） |
| 单条读取 | 通过列表获取 | ✅ `POST /v1/get`（含 `as_of` 版本链遍历） |
| 编辑记忆内容 | ✅ `PUT .../memories/{memory_id}` → `update_mem_by_id`（原地覆盖） | ✅ `POST /v1/update`（`MemoryPatch`：content/tier/tags/metadata/时间窗口；`SUPERSEDE` 新 id+版本链 / `OVERWRITE` 原地） |
| 删除（单条/批量） | ✅ `batch-delete` → `delete_mem_by_id` 逐条 | ✅ `POST /v1/delete`（`DeleteSelector`：unit_ids/scope/tags/before/filters） |
| 删除模式 | 仅物理删除 | ✅ `DeleteMode`：FORGET（默认，非破坏性可恢复）/ ARCHIVE / DOWNWEIGHT / PURGE（硬删除，合规场景） |
| 清空用户记忆 | ✅ `DELETE .../users/{uid}/memories` → `delete_mem_by_user_id` | ✅ `delete` + selector(scope+user) 或 PURGE |
| 清空 scope | ✅ `DELETE /{memory_repo_id}` → `delete_mem_by_scope` + `delete_scope_config` | ✅ `delete` + selector(scope) |
| 审计/追溯 | ❌ 无 | ✅ `POST /v1/audit` / `verify_audit` / `trace`（版本链）/ `inspect`（完整单元含失效版本） |

**纠错说明**：现有文档称"EXTERNAL 无 update API"，实际 `MemoryAPI.update` 完整存在且比 BUILTIN 更强——BUILTIN 的 `update_mem_by_id` 是原地覆盖，2.0 的 `update` 支持 SUPERSEDE（生成新版本，保留历史）与 OVERWRITE 两种模式，并可 patch content/tier/tags/metadata/时间窗口。

---

## 7. 记忆演进与生命周期

这是 2.0 的独有能力，BUILTIN 完全没有。

| 维度 | BUILTIN | agent-memory 2.0 |
|------|---------|------------------|
| 记忆演进 | ❌ 无（写入即定，更新靠手动 edit） | ✅ Evolver 四模式：`EXTRACT`（抽取派生）/ `ASSOCIATE`（关联）/ `CONSOLIDATE`（合并去重）/ `FORGET`（遗忘） |
| Evolver 实现 | N/A | 3 种：`orchestrating`（基线）/ `dynamic`（4 步：extract→consolidate→reflect→persist，支持自定义 prompt）/ `schema_orchestrating`（Source-first schema） |
| 过期清理 | ❌ 无 | ✅ `MemoryEngine.sweep_expired()` → `LifecycleManager.sweep()` 纯计算扫描过期 ACTIVE 单元 + 已被取代的单元，产出 `SweepTransition`，按目标状态（FORGOTTEN/ARCHIVED）分组执行 |
| 生命周期策略 | 无 | ✅ `PolicyManager`：`lifecycle.expired_active.target=forgotten`、`lifecycle.superseded.target=forgotten`（可配） |
| 索引构建 | 写入即索引 | ✅ `IndexBuilder`（forward/fulltext/vector/hybrid/unified/entity 六种实现），`IndexWriteMode`（ALL/FORWARD_ONLY/RETRIEVAL_ONLY）+ `IndexRemoveMode`（SOFT/HARD） |
| 反思 | ❌ 无 | ✅ Evolver REFLECT 阶段（动态 Evolver 第 3 步） |

---

## 8. 安全与凭证

| 维度 | BUILTIN | agent-memory 2.0 |
|------|---------|------------------|
| 认证 | 无（进程内调用） | Bearer api_key / X-Api-Key 头；认证模式 dev/trusted/api_key（当前仅 dev 实现，api_key/trusted 认证器尚未编码） |
| 密钥存储 | N/A | `EncryptedKVStore` 装饰原始 KV，`SecurityProvider` 做 AAD 绑定加密；`CryptoProvider` ABC |
| 密钥下发 | N/A | agent-studio Java manager 写 OBS auth 文件 `memory-auth/{id}.json`，Python runtime 按 instance_id 惰性取 |
| TLS 校验 | N/A | ✅ `ssl_verify=true` 强制校验（缺证书/明文 scheme/连接串 TLS 覆盖 → 装配时失败，不静默降级）；各后端翻译为各自客户端 TLS 参数 |
| 速率限制 | N/A | ✅ 认证中间件含速率限制（Argon2 计算成本高，前置限流） |
| 请求安全上下文 | N/A | `RequestSecurityContext` 显式传递给 MemoryAPI 方法；保留字段（security/identity/actor 等）禁止从 JSON 传入 |

**注意**：2.0 的 `ApiKeyAuthenticator` 和 `TrustedAuthenticator` 在代码中仅有 docstring 引用，类定义不存在——当前生产认证能力尚未完整。dev 模式默认绑定 loopback，非 loopback 需 `JIUWEN_MEMORY_HTTP_ALLOW_DEV_AUTH_NON_LOOPBACK=true`。

---

## 9. 多智能体（Controller）支持

此维度仅对 agent-studio 集成有意义。

| 维度 | BUILTIN | agent-memory 2.0 |
|------|---------|------------------|
| 配置传递 | 只需 `memory_repo_id` | 需完整 `memory_config`（backend_type / instance_id / base_url） |
| Controller 注入 | `memory_repo_id` 注入 req_params | `memory_config` 注入 req_params + runtime_keys 白名单 |
| LLMChain 读取 | `get_global_state("memory_repo_id")` | `get_global_state("memory_config")` |
| 多 agent 隔离 | 无（共享同一 scope_id） | ✅ `Scope.agent` 维度天然隔离不同 agent 的记忆 |

---

## 10. 降级行为

| 维度 | BUILTIN | agent-memory 2.0 |
|------|---------|------------------|
| 服务不可用 | `MEMORY_ENABLED=false` 或 OpenSearch 不可达时 `init_ltm` 返回 False（degraded），跳过记忆，对话不报错 | 实例不可达时跳过 + 日志，对话不报错 |
| 部分失败 | 批量 `add_messages` 整体返回 | 逐条/批量写入，部分失败可标记 |
| OpenSearch 降级 | `init_ltm` 中 ping 失败 → degraded 模式 | N/A（后端由配置决定，各 Store 独立连接） |

---

## 11. HTTP API 对照

### 11.1 agent-memory 2.0 完整 API 面

2.0 的 HTTP 传输是**通用 JSON 传输**：`POST /v1/<MemoryAPI 方法名>`，`is_known_verb` 校验方法名是否属于 `MemoryAPI.__abstractmethods__`（共 36 个公开方法）。不是固定的 `/v1/add` 路由表，而是方法名即路由。

| 类别 | 方法（= 路由） |
|------|---------------|
| 写入 | `add` / `add_async` / `batch_add` / `batch_add_async` / `submit_ingest` / `check_write` |
| 检索 | `search` / `list` / `get` / `update` / `delete` / `evolve` |
| 任务 | `job_status` / `job_cancel` |
| 审计 | `inspect` / `trace` / `audit` / `verify_audit` |
| 管理 | `admin_get` / `admin_set` / `admin_all` |
| 权限 | `grant` / `revoke` |
| Space | `create_space` / `get_space` / `list_spaces` / `update_space` / `archive_space` / `delete_space` / `export_space` / `space_usage` / `get_space_policy` / `set_space_policy` / `list_space_members` / `add_space_member` / `remove_space_member` |

另：`GET /healthz` 健康检查。PUT/DELETE/PATCH 等返回 MethodNotAllowed。

### 11.2 BUILTIN 内部 API 面

BUILTIN 的管理面通过 agent-runtime 的 FastAPI 内部路由（`/internal/v1/memory-repos/`）+ Java Feign 客户端代理，非公开 HTTP API：

| 路由 | 方法 | 功能 |
|------|------|------|
| `/internal/v1/memory-repos/{repo_id}` | DELETE | 清空 scope（`delete_mem_by_scope` + `delete_scope_config`） |
| `.../{repo_id}/users/{uid}/memories` | GET | 列表（分页 + MemoryType 过滤） |
| `.../{repo_id}/users/{uid}/memories` | DELETE | 清空用户记忆 |
| `.../{repo_id}/users/{uid}/memories/batch-delete` | POST | 批量删除 |
| `.../{repo_id}/users/{uid}/memories/search` | POST | 搜索（`search_user_mem` + threshold） |
| `.../{repo_id}/memories/{memory_id}` | PUT | 编辑记忆内容（`update_mem_by_id`） |

---

## 12. 能力差异总表

| 能力 | BUILTIN | agent-memory 2.0 | 说明 |
|------|---------|------------------|------|
| 独立部署/扩缩容 | ❌ | ✅ | 2.0 是独立 HTTP 服务 |
| 多存储后端可插拔 | ❌（固定 OpenSearch+Redis） | ✅（7 类 Store 端口） | 2.0 可选 Milvus/pgvector/Postgres/ES 等 |
| 5 维 Scope 隔离 | ❌（2 维） | ✅ | 2.0 的 org/space/user/agent/session |
| 跨 scope 授权共享 | ❌ | ✅ | 2.0 的 grant/revoke + Space 管理 |
| 记忆版本链/时间旅行 | ❌ | ✅ | 2.0 的 supersedes + as_of |
| 生命周期状态机 | ❌ | ✅ | 2.0 的 ACTIVE/FORGOTTEN/ARCHIVED + sweep |
| 记忆演进（Evolver） | ❌ | ✅ | 2.0 的 EXTRACT/ASSOCIATE/CONSOLIDATE/FORGET |
| 多步检索流水线 | ❌（单步向量召回） | ✅（5 步） | 2.0 的 parse→recall→fuse→disclose→retrieve |
| 渐进式披露 | ❌ | ✅ | 2.0 的 DisclosureLevel L0/L1/L2/ADAPTIVE |
| 元数据过滤（FilterClause） | ❌（仅 MemoryType） | ✅ | 2.0 支持 EQ/IN/CONTAINS/range |
| 检索轨迹 | ❌ | ✅ | 2.0 的 with_trajectory |
| 编辑记忆（update） | ✅（原地覆盖） | ✅（SUPERSEDE+OVERWRITE） | 两者都支持，2.0 模式更丰富 |
| 历史摘要检索 | ✅（独立 SUMMARY 类型） | ❌（无独立端点） | BUILTIN 独有能力 |
| 策略类型开关 | ✅（enable_* 布尔） | ✅（ExtractionTarget 枚举 + tier） | 控制粒度不同 |
| 自定义提取 prompt | ✅（per-scope definition） | ✅（PromptRegistry per-phase+key） | 配置方式不同 |
| 前端策略配置 | ✅ | ❌ | BUILTIN 独有 |
| 过程记忆（PROCEDURAL） | ❌ | ✅ | 2.0 独有 |
| 审计/追溯 | ❌ | ✅ | 2.0 的 audit/trace/inspect |
| 删除模式分级 | ❌（仅物理删除） | ✅（FORGET/ARCHIVE/DOWNWEIGHT/PURGE） | 2.0 合规能力 |
| 认证/加密 | ❌（进程内） | ✅（Bearer+加密 KV，api_key 认证器待实现） | 2.0 安全框架更完整但未全部落地 |
| MCP 接入 | ❌ | ✅ | 2.0 独有 |
| Prompt 注入模板 | ✅（MEMORY_USAGE_PROMPT） | ❌ | BUILTIN 独有（2.0 是纯服务，不负责 prompt 拼装） |



