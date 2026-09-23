# Studio-2.0 对接 agent-memory 0.2.0 外部记忆库服务 · 特性设计方案

> **模式:** 共存可切换(内置 / 外部双后端,built-in 零侵入)

---

## 一、背景与目标

### 1.1 现状瓶颈

Studio-2.0 现有记忆能力以内置模块形式耦合在智能体运行态:进程内 LTM(`LongTermMemory` SDK)+ OpenSearch 向量库 + Redis KV,LLM/Embedding 由全局 `settings.memory`(`MEMORY_*` 环境变量)统一指定,记忆数据写入共享 OpenSearch 索引,仅靠 `scope_id`(= `memory_repo_id`)做逻辑隔离。存在三个瓶颈:

1. **模型无法按业务隔离** —— 全局统一模型配置,不同业务无法使用不同 LLM/Embedding;
2. **无 DB / 存储实例级物理隔离** —— 共享索引 + 逻辑 scope,数据混存;``
3. **记忆计算与运行态争抢资源** —— 抽取/检索与推理同进程,无法独立扩缩容。

### 1.2 agent-memory 2.0 能力

社区 **agent-memory 2.0** 提供统一 HTTP API,按 **Scope 对象**(org / space / user / agent / session)做多维隔离,原生 `http.server` 部署,每个实例一套 DB + 向量库 = 物理隔离,LLM/Embedding 由实例启动配置决定(每实例即一套模型配置,物理隔离即模型隔离)。

### 1.3 目标

以"外部服务"方式对接 agent-memory 2.0,实现:

- **记忆能力与运行态解耦** —— 记忆抽取/检索由独立部署的外部实例承担;
- **按业务模型隔离与数据物理隔离** —— 不同实例承载不同业务,物理隔离即模型隔离;
- **管理面(manager)与数据面(runtime)严格分离** —— manager 不在数据通路上,运行态从 IR 读取记忆库元数据直连对应实例,运行期不回调 manager;
- **对 built-in 记忆零侵入** —— 入口处分支派发,BUILTIN 分支 = 现有代码不改,external 是纯加法;

---

## 二、核心设计决策

### 决策 1 · 共存可切换

保留内置记忆为可选后端,记忆库维度选择内置 / 外部。存量默认内置,新建 / 迁移走外部,适配存量工作流。同一工作空间可并存两类记忆库,切换某记忆库的 backend_type 后通路正确切换。

### 决策 2 · 实例绑定 = 记忆库级,用户自定义

用户按需新建记忆库并选择绑定的外部实例(或内置);工作流、多智能体绑定到对应记忆库即可(该绑定 Studio 已支持:`t_agent.memory_config.memory_repo_id` 与工作流 DSL `configs.memory.memory_repo_id`,不改)。

### 决策 3 · 管理面 / 数据面分离

- **manager(Java)只做管理面:** IR 构建、实例 / 记忆库 CRUD、凭证下发到 OBS、健康检查、记忆项 list / search / delete。**不在数据通路上。**
- **runtime(Python)是数据面:** 从 IR 的 `configs.memory` 读取记忆库元数据,直连对应 agent-memory 2.0 实例做抽取 / 检索。**运行期 runtime 不回调 manager**;manager 宕机不影响已运行的工作流 / 智能体(仅影响新运行的 IR 构建与管理 UI)。

### 决策 4 · built-in 零侵入(分支派发)

不引入共享 `MemoryBackend` 协议、不包装 built-in、不经工厂改道 built-in。运行态在记忆入口按 `memory_backend_type` 分支:EXTERNAL 走新增 `ExternalMemoryClient`;BUILTIN 走现有 `get_ltm()` 代码原样不动。external 是纯加法(新文件 + `if` 分支)。

### 决策 5 · 模型隔离由实例部署承担

2.0 的模型(LLM / Embedding)由实例启动配置决定,Studio 不做 per-scope 模型热加载。"模型隔离" = 不同实例部署不同模型配置即可实现(物理隔离即模型隔离)。

### 派生决策(实现细节)

- **IR 注入(管理面 → 数据面的唯一交接):** IR 由 manager 构建,在 `MemoryConfigIR` 注入非敏感元数据:`memory_backend_type / scope_id / instance_id / instance_base_url`。**api_key 不入 IR** —— IR 会持久化 OBS、缓存 Redis、DEBUG 全文打印,明文有泄密风险。三处 IR 注入点(Workflow / Agent / 多智能体)统一调 `IrAdapterService.injectExternalMemoryConfig()`。
- **api_key 解析(对齐 model-auth,非 manager 回调):** IR 放 `instance_id` 引用,api_key 由 manager 写 OBS auth 文件 `memory-auth/{instance_id}.json`;runtime 的 `InstanceCredentialResolver` 按 `instance_id` 从 OBS 惰性取,仅驻进程内存。OBS 读是共享基础设施,非 manager 服务调用。运行态 SCC 解密能力复用(`common_utils.crypto_tool.decrypt`,plaintext-tolerant)。
- **管理通路(Java 直连 agent-memory 2.0):** 记忆项列表 / 搜索 / 删除、记忆库删除时的数据清理、健康检查由 Java 后端直接调 agent-memory(低频 UI 驱动),不经 runtime。调用走 `OkHttpUtils` + `Authorization: Bearer`,base_url 从实例表取,api_key 经 `EncryptionAdapter` 解密。

---

## 三、概念映射(Studio ↔ agent-memory 2.0)

agent-memory 2.0 的隔离核心是 **Scope 对象**,不再是单一标量 scope_id。Scope 含 5 个字段:org / space / user / agent / session。当前实现把 Studio 的 `memory_repo_id` 与 `user_id` 复合进 `user` 字段,以兼容 dev profile(InMemoryEngine 下 space 必须为空),同时保留 per-repo + per-user 隔离。

| Studio | agent-memory 2.0 | 说明 |
|---|---|---|
| `memory_repo_id`(UUID) | Scope.user 的前缀部分 | 当前实现 `user = "{repo_id}:{user_id}"`,复合值做 per-repo + per-user 隔离;生产 CloudEngine 可改为 `space = repo_id` + `user = user_id` |
| `user_id` | Scope.user 的后缀部分 | 小写化后拼接 |
| `org`(固定 `"studio"`) | Scope.org | 固定值,标识来源系统 |
| `space / agent / session` | 空字符串 | 当前不用;生产可启用 space 做隔离 |
| `memory_service_instance` | 一个 agent-memory 2.0 部署实例 | base_url + api_key + 物理库 / 向量库 + 模型配置(实例级物理隔离) |
| IR 的 `configs.memory` 元数据 | — | runtime 据此按 backend_type 分支派发:backend_type / scope_id / instance_id / base_url |
| 工作流 / 多智能体 → 记忆库(已有) | — | 沿用现有绑定,不改;记忆库决定走内置还是外部实例 |

**关键:** 隔离靠 Scope 对象多维字段。当前实现把 repo_id + user_id 复合进 `user` 字段以兼容 dev profile(space 须空)。Java / Python 两侧 scope 构造必须同构(`buildScope()` ↔ `_build_scope()`),否则 list / delete 会跨域。模型隔离由实例部署决定。

### Scope 构造(Java 与 Python 同构)

```json
{
  "org": "studio",
  "space": "",
  "user": "{memory_repo_id}:{user_id}",
  "agent": "",
  "session": ""
}
```

---

## 四、总体架构:管理面 / 数据面分离 + built-in 零侵入

```
【管理面 · manager(Java)】                                 【数据面 · runtime(Python)】
      构建 IR                                                   加载 IR(async_ir_load,只读)
     注入 MemoryConfigIR(非敏感元数据):                       ↓ 从 configs.memory 读取
    memory_backend_type / scope_id /                         backend_type / scope_id /
    instance_id / instance_base_url                         instance_id / instance_base_url
                                                          ↓ 按 backend_type 分支派发()
                                                        ┌────────────┴────────────┐
 管理操作                                                ▼                         ▼
  · 实例/记忆库 CRUD + 健康检查(GET /healthz)             EXTERNAL                  BUILTIN
  · 凭证下发到 OBS auth(memory-auth/{id}.json)         ExternalMemoryClient      现有 get_ltm()(不动)
  · 记忆项 list/search/delete(POST /v1/list|search|                                    ↓
     delete)                                                             LTM / OpenSearch / Redis
  · deleteMemByScope(POST /v1/delete,scope purge)               

```

### 数据通路(EXTERNAL 分支:ExternalMemoryClient → agent-memory 2.0 接口)

| ExternalMemoryClient 方法(Python) | agent-memory 2.0 端点 | 说明 |
|---|---|---|
| `add(content, space, user, infer=True)` | `POST /v1/add` | 写一条记忆;`system_metadata.infer="true"` 触发服务端 LLM 抽取 |
| `add_messages(messages, user_id, scope_id)` | 循环 `POST /v1/add` | 逐条 add(infer=True),替代批量写入 |
| `search(query, top_k, user_id, scope_id)` | `POST /v1/search` | body 含 `context.scope` + `top_k` + `disclosure="l2"`;返回 `{items:[{unit_id, content, score}]}` |
| `search_memory(...)` / `search_user_history_summary(...)` | `POST /v1/search` | 兼容别名,复用 search |
| `list_memories(user_id, scope_id, offset, limit)` | `POST /v1/list` | 返回 `{items:[{id, segments:[{content}], tier}], count}` |
| `get_user_mem_by_page(...)` | `POST /v1/list` | 兼容别名,offset=(page-1)*size |
| `delete_by_scope(scope_id)` | `POST /v1/delete` | `selector:{scope, mode:"purge"}` |
| `delete_mem_by_id(...)` / `batch_delete_mem(...)` | `POST /v1/delete` | `selector:{unit_ids, scope, mode:"purge"}` |
| `health_check()` | `GET /healthz` | 2.0 健康端点 |



**Java 管理通路:** `MemoryItemManagementService` 与 `MemoryServiceInstanceService` 同样走 2.0 端点:list→`/v1/list`(content 从 `segments[0].content` 取)、search→`/v1/search`(id 用 `unit_id`)、delete→`/v1/delete`(带 unit_ids)。清空用户记忆因 2.0 delete 不支持纯 scope purge,采用 **分页 list 取全量 id → 按 unit_ids purge 循环**(上限 1000 轮防御)。

---

## 五、数据库与配置

### 5.1 新表 `t_memory_service_instance`(外部实例注册)

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | varchar(64) | 主键(UUID) |
| `name` | varchar(128) | 实例名 |
| `base_url` | varchar(512) | agent-memory 2.0 地址(如 `http://mem-svc-a:8000`);非敏感,会进 IR |
| `api_key` | varchar(1024) | `MEMORY_API_KEY`,`EncryptionAdapter` 加密存储;**不入 IR**,由 manager 同步到 OBS auth 文件供 runtime 惰性取 |
| `workspace_id / project_id / domain_id` | varchar(64) | 所属(权限 / 可见性,不承载默认继承) |
| `health_status` | varchar(16) | HEALTHY / UNHEALTHY / UNKNOWN(默认 UNKNOWN) |
| `last_check_at` | TIMESTAMP | 最近健康检查时间 |
| `deploy_meta` | TEXT | 展示用 JSON:vector_store_type / db_type 等 |
| `created_user_* / last_update_user_* / create_time / update_time` | — | 审计字段 |

### 5.2 扩展 `t_memory_repo`

- `memory_backend_type` varchar(16) NOT NULL DEFAULT `BUILTIN`(BUILTIN / EXTERNAL)
- `memory_service_instance_id` varchar(64)(EXTERNAL 时必填,逻辑外键)
- `scope_model_config` TEXT(scope 级模型配置 JSON;当前不推送,保留供未来扩展 / 展示)

迁移:DDL 提供 `CREATE TABLE IF NOT EXISTS` + 三条 `ALTER TABLE ADD COLUMN`(幂等列添加)。MySQL(`ddl.sql`)与 PostgreSQL(`ddl_postgres.sql`)两份同步。`t_workspace` 不新增字段。

---

## 六、运行态(Python,数据面)设计 —— 分支派发,built-in 零侵入

**原则:** 运行态在记忆入口按 IR 的 `configs.memory.memory_backend_type` 分支派发:EXTERNAL 走新增 `ExternalMemoryClient`(httpx 直连 agent-memory 2.0);BUILTIN 走现有 `get_ltm()` 代码原样不动。不引入共享 Backend 协议、不包装 built-in。external 是纯加法。不新增任何 runtime→manager 回调。

| 动作 | 文件 | 说明 |
|---|---|---|
| 新增 external 客户端 | `memory/backend/external_memory_client.py` | httpx async;方法 → 2.0 端点映射见第四节;由 IR 元数据(`instance_base_url`)+ 解析的 api_key 构造;按 instance_id 进程级缓存 |
| 新增 凭证解析 | `memory/backend/instance_credential_resolver.py` | 单例;EXTERNAL 分支按 IR 的 `instance_id` 从 OBS auth 文件 `memory-auth/{id}.json` 惰性取 api_key;env `MEMORY_API_KEY` 作退化;解密用 `common_utils.crypto_tool.decrypt` |
| 新增 共享检索 | `memory/memory_retrieval.py` | `retrieve_memory_prompt(...)` 按 `backend_type` 分支:EXTERNAL → 调 client.search_memory / search_user_history_summary,复用 `MEMORY_USAGE_PROMPT` 模板;BUILTIN → 现有 `get_ltm()` 不动 |
| 改 抽取入口 | `memory/storage/memory_extractor.py` | `_extract_memory()` 按 `backend_type` 分支:EXTERNAL → 逐条 `client.add(content, infer=True)`(2.0 服务端自动抽取);BUILTIN → 现有 `ltm.add_messages` 不动。UserProfileMemoryExtractor 的 Redis 缓冲 / 定时逻辑完全不动 |
| 改 运行器检索 | `runner/workflow_runner.py` | `_retrieve_memory()` 加 `memory_config` 参数,按 `backend_type` 分支:EXTERNAL → `_retrieve_memory_external`;BUILTIN → 现有 `get_ltm()`。`_build_global_state_params` 的 `runtime_keys` 含 `memory_config`,从 IR 读取并写入 global_state |
| 改 多智能体注入 | `runner/controller_runner.py` | 从 `ir_json["configs"]["memory"]` 读 `controller_memory_config`,注入到子工作流 `req_params`(memory_repo_id / memory_config / app_id);jiuwen `WorkflowWrapper._build_global_state_params` 的 `runtime_keys` 含 `memory_config`,经 `commit_user_inputs` 写入 global_state |
| 改 LLM 节点 | `jiuwen/extension/workflow_node/llm_chain.py` | LLMChain 记忆注入钩子 `_inject_retrieved_memory` 从 `session.get_global_state("memory_config")` 读,调 `retrieve_memory_prompt(..., memory_config=...)` |
| 改 启动 | `serve/server.py` lifespan | 初始化凭证解析器并注入 `S3StorageProvider.instance()`(非关键,失败降级);保留 `init_ltm()`(BUILTIN 仍需) |
| 改 运行入口 | `serve/apis/app_run.py` | `build_req_json_from_workflow/agent` 把 `long_term_memory` 的 enable_retrieve / enable_extract 透传到 runtime params(`enableMemoryRetrieve / enableMemoryExtract`) |

**检索路径(workflow 直接运行):** `WorkflowRunner._retrieve_memory` 在非恢复执行时触发,从 `ir_json["configs"]["memory"]` 读 memory_config,按 backend_type 分支;检索结果作为 `memory_message` 注入 inputs,jiuwen LLM 节点经 `_insert_memory_message` 读取。

**检索路径(controller 多智能体):** `controller_runner` 不做预检索,而是把完整 `memory_config` 注入子工作流 `req_params`;子工作流的 LLM 节点经 `_inject_retrieved_memory` 从 global_state 读 memory_config,逐节点调 `retrieve_memory_prompt` 检索。该路径经 `runtime_keys` 包含 `memory_config` 保障 global_state 写入。

**抽取路径(两路共用):** 执行后 `_trigger_memory_extraction` 触发,gated on `enable_memory_extract`;收集对话轮次后调 `UserProfileMemoryExtractor.async_add_chat_turn`,经 Redis 缓冲 + 定时 / 轮次触发 `_extract_memory`,按 backend_type 分支(EXTERNAL 逐条 add infer=True / BUILTIN ltm.add_messages)。

---

## 七、后端(Java,管理面 + IR 注入)设计

| 动作 | 文件 / 模块 | 说明 |
|---|---|---|
| 扩展 IR DTO | `dto/MemoryConfigIR.java` | 加 `memory_backend_type / scope_id / instance_id / instance_base_url`(**不含 api_key**) |
| 改 IR 注入(三处,唯一入口) | `IrAdapterService.injectExternalMemoryConfig()` | 共享方法:从 repo entity 读 backend_type / scope_id;EXTERNAL 时按 `memory_service_instance_id` 查 `t_memory_service_instance` 取 base_url。被 `adaptConfigs`(Workflow)、`adaptAgent`(Agent)、`ControllerManagementService.convertControllerMemoryToIr`(多智能体)三处调用 |
| 新增 实例管理 | `MemoryServiceInstanceService` + `MemoryServiceInstanceManagementApi/Controller` + `MemoryServiceInstanceEntity/Mapper` | 实例 CRUD + 健康检查(`GET /healthz`)+ 凭证下发到 OBS auth(`memory-auth/{id}.json`)+ `deleteMemByScope`(`POST /v1/delete`) |
| 扩展 记忆库 | `MemoryRepoManagementService`、`MemoryRepoEntity`、`MemoryRepoMapper.xml` | create / modify:EXTERNAL 时校验 instance_id 非空并触发 healthCheck(失败仅告警);delete:先查 backend_type,EXTERNAL → `deleteMemByScope`,BUILTIN → 现有 runtime internal API |
| 改 记忆项管理分支 | `MemoryItemManagementService` | 按 backend 分支:BUILTIN 走现有 `AgentRuntimeClient`;EXTERNAL 直连 agent-memory 2.0:`/v1/list`(content 取 `segments[0].content`)、`/v1/search`(id 取 `unit_id`)、`/v1/delete`(带 unit_ids);清空用户用 list→delete 循环 |
| 新增 错误码 | `StudioError` | `MEMORY_SERVICE_INSTANCE_NOT_EXIST(1006)` / `MEMORY_SERVICE_INSTANCE_IN_USE(1007)` / `MEMORY_SERVICE_INSTANCE_UNREACHABLE(1008)` |
| 加解密复用 | 现有 `EncryptionAdapter` | api_key 加密存取,Java 侧解密后调 agent-memory;Python 侧经 OBS auth 取解密值 |

**凭证下发约定:** 实例 create / modify 时 `saveApiKeyToObsAuth()` 把 `{instance_id, api_key}` 写到 OBS `memory-auth/{id}.json`;delete 时清理该对象。失败抛 `OBS_FAILED`。

---

## 八、前端(console)设计

Console 新增"外部记忆服务实例管理"页(作为记忆库管理页的子 Tab)与"记忆库创建类型选择 / 外部连接"表单,覆盖外部实例注册、记忆库外部配置、记忆项管理。工作流 / 多智能体编辑器的"记忆库绑定"选择器已存在,不新增绑定 UI。

| 动作 | 页面 / 组件 | 说明 |
|---|---|---|
| 前端 实例管理页(新) | `memory-service-instance-management` + `memory-service-instance-modal` | 列表(name / base_url / health 勾 / last_check / create_time)+ 行内健康检查 + 新建 / 编辑 / 删除;删除前后端校验引用 |
| 前端 创建类型选择(新) | `select-memory-create-type` | 新建记忆库时先选"内置 / 外部" |
| 前端 外部连接表单(新) | `connect-external-memory-modal` | EXTERNAL 专用创建 / 编辑:名称 / 描述 / 图标 + 实例下拉 + LTM 检索策略 + 抽取频率(conversation_round / time_span) |
| 前端 记忆库详情(扩展) | `memory-lib-detail` | 显示后端类型标签 + 关联实例 |
| 前端 记忆库列表 / 管理(扩展) | `memory-lib-list` / `memory-lib-management` | 展示后端类型标签;管理页新增实例管理子 Tab;接口扩展 `memory_backend_type / memory_service_instance_id` |
| 前端 服务层(新) | `memory-service-instance-api.service.ts` + `memory-service-instance-interfaces.ts` | 实例 CRUD + 健康检查 REST;`MemoryBackendType` 枚举 |
| 前端 i18n | `memory-lib.json`(zh-CN / en-US) | 实例管理文案 |

**前端约定:** 所有外部实例操作经 Java 后端代理(不直连 agent-memory),前端只与 console 后端交互。记忆库编辑(builtin drawer)透传并回填 `memory_backend_type / memory_service_instance_id`,保证 patch 时后端类型 / 实例绑定不丢失。

---

## 九、部署与环境变量

### 9.1 agent-memory 2.0 实例侧(独立部署)

每个 agent-memory 2.0 实例是一套独立部署(物理隔离)。启动时通过 **实例启动配置**(非 Studio 下发)指定 LLM / Embedding 与存储

### 9.2 Studio manager(Java)侧

无新增强制环境变量。所需能力均为现有基础设施:

### 9.3 Studio runtime(Python)侧

| 环境变量 | 必填 | 说明 |
|---|---|---|
| `MEMORY_VERIFY_SSL` | 否 | httpx TLS 校验开关,默认 `false`(内网部署简化);生产 HTTPS 实例应改回校验或配置 CA |

---

## 十、共存策略与灰度

- **共存:** repo 的 `memory_backend_type` 决定通路;存量 repo 默认 `BUILTIN` 不受影响;新建外部 repo 走 agent-memory 2.0。同一工作空间可并存两类 repo。切换某 repo 的 backend_type 后通路正确切换。
- **降级:** EXTERNAL 实例不可达时,对话不报错,记忆操作跳过 + 日志(对齐 server.py lifespan `memory_ok` 降级模式)。

---

## 十一、验证方案

1. **本地起 agent-memory 2.0:** 按其部署文档启动,配 `MEMORY_API_KEY` + LLM / Embedding + DB / 向量库。`curl http://<host>:<port>/healthz` 返回 200。
3. **实例注册(console):** 前端注册实例(name / base_url / api_key)→ 健康检查绿(`GET /healthz`);确认 api_key 已写 OBS auth `memory-auth/{id}.json`(从 MinIO / OBS 读验证含 `instance_id` + `api_key`)。
4. **IR 注入:** 建 EXTERNAL 记忆库绑实例 → 触发一次工作流运行 → 抓取 OBS 上的 IR JSON,确认 `configs.memory` 含 `memory_backend_type=EXTERNAL / scope_id / instance_id / instance_base_url` **且不含 api_key**(大小写不敏感检查)。同时抓一个 BUILTIN 记忆库的 IR,确认不含这四个新字段(零侵入)。
5. **分离验证(关键):** 运行态日志确认 EXTERNAL 分支检索 / 抽取直连 agent-memory 2.0(`POST /v1/search`、`POST /v1/add`),
6. **built-in 零侵入回归(关键):** BUILTIN repo 的 `retrieve_memory_prompt` / `_extract_memory` / `workflow_runner._retrieve_memory` 调用栈与改造前一致 —— 直接 `get_ltm()`抽取 / 检索结果与改造前逐项对比无差异。
7. **端到端抽取 + 检索:** 跑一轮带抽取的对话(达到 conversation_round / time_span 触发)→ `curl -X POST .../v1/search` 确认落库(2.0 list / search 响应结构:items[].segments[0].content / items[].unit_id + content + score)→ 再跑一轮带检索,确认记忆注入 prompt(`retrieve_memory_prompt` 返回非空,含 `<mem>` 标签)。
9. **管理面(console):** 记忆项页列表 / 搜索 / 删除 → 确认代理到 agent-memory 2.0(对比 `POST /v1/list`、`/v1/search`、`/v1/delete`);list 的 content 取 `segments[0].content`,search 的 id 取 `unit_id`。
10. **清空用户记忆:** 触发"清空" → 确认走 list→delete 循环(2.0 delete 不支持纯 scope purge);验证清空后 list 返回空。
11. **共存:** 同工作空间 BUILTIN + EXTERNAL repo 各自抽取 / 检索互不干扰;切换 backend_type 后通路正确切换。
12. **降级:** 外部实例下线 → 对话不报错、记忆跳过 + 日志(`agent-memory ... request failed (degraded)`)。
13. **多智能体(controller)路径:** 建 controller 绑 EXTERNAL 记忆库 → 跑子工作流 → 确认 LLMChain 的记忆注入钩子能取到完整 memory_config 并走 EXTERNAL 检索
14. **删除记忆库数据清理:** 删 EXTERNAL repo → 确认调 `POST /v1/delete`(scope purge);删 BUILTIN repo → 确认走 runtime internal API。
15. **凭证轮转:** 修改实例 api_key → 确认 OBS auth 文件被刷新;runtime 下一次检索拿到新 key(缓存按进程驻留)。

