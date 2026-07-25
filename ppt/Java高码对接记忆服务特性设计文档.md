# 记忆服务 - 特性设计文档

## 1. 概述

### 1.1 背景

Agent 对话是无状态的，无法记住用户的历史偏好和上下文。需要引入长期记忆能力，让 Agent 能够：

- 记住用户的历史偏好（如"用户喜欢拿铁咖啡"）
- 在多轮对话中保持上下文连贯
- 主动检索和使用相关记忆

### 1.2 设计目标

- **多后端支持**：支持 Mem0 Cloud、Mem0 自部署 OSS、Jiuwen Memory Engine 等多种记忆存储后端
- **可扩展架构**：通过 SPI 机制支持新增 provider，无需修改核心代码
- **统一治理**：所有外部调用经过统一的超时/重试/熔断/审计策略
- **向后兼容**：默认配置行为不变，无需修改现有用户配置

### 1.3 设计原则

- **向后兼容**：默认配置行为不变，无需修改现有用户配置
- **开闭原则**：新增 provider 无需修改工厂类
- **治理一致性**：所有外部调用统一经过 `ExternalCallExecutor` 治理策略

---

## 2. 特性设计

### 2.1 长期记忆生命周期

Agent 对话过程中的记忆使用分为三个阶段：

```
用户发起对话
    ↓
┌─────────────────┐
│ Prefetch 阶段    │ ← 自动搜索相关历史记忆
│ search(query)    │
└────────┬────────┘
         ↓
┌─────────────────┐
│ 对话阶段         │ ← 记忆注入 system prompt
│ <memory-context> │
│ {记忆内容}        │
│ </memory-context>│
└────────┬────────┘
         ↓
┌─────────────────┐
│ SyncTurn 阶段    │ ← 自动同步 user/assistant 消息
│ add(messages)    │
└─────────────────┘
```

**Prefetch 阶段**：对话开始前，根据用户消息自动调用 `search` 接口，检索相关历史记忆。

**对话阶段**：将检索到的记忆以 `<memory-context>` 标签注入 system prompt，让 LLM 在生成回复时参考。

**SyncTurn 阶段**：对话结束后，自动将 user/assistant 消息同步到记忆服务，用于后续检索。

### 2.2 记忆工具

Agent 可通过工具主动调用记忆服务：

| 工具 | 功能 | 参数 | 说明 |
|------|------|------|------|
| `memory_search` | 语义搜索相关记忆 | query, top_k | 根据自然语言查询检索最相关的记忆 |
| `memory_add` | 添加新记忆 | content, scope | 主动记录用户偏好或重要信息 |
| `memory_get` | 按 ID 获取单条记忆 | memory_id | 精确获取某条记忆详情 |
| `memory_delete` | 删除单条记忆 | memory_id | 删除指定记忆（部分后端不支持） |

### 2.3 记忆存储后端

系统支持多种记忆存储后端，通过 `provider` 配置切换：

| Provider | 标识 | 说明 |
|----------|------|------|
| Mem0 Cloud | `mem0`（默认） | Mem0 云化版本，对接 `api.mem0.ai` |
| Mem0 OSS | `mem0` | Mem0 开源自部署版本 |
| Jiuwen Memory Engine | `jiuwen` | 九问记忆引擎 |

#### 2.3.1 Mem0 后端

Mem0 存在两种部署形态，API 差异显著：

| 操作 | Mem0 Cloud (`api.mem0.ai`) | Mem0 OSS (自部署) |
|------|---------------------------|-------------------|
| 认证头 | `Authorization: Token <key>` | `X-API-Key: <key>` |
| 添加记忆 | `POST /v3/memories/add/` | `POST /memories` |
| 搜索记忆 | `POST /v3/memories/search/` | `POST /search` |
| 列表记忆 | `POST /v3/memories/` (body 含 filters) | `GET /memories` (无 body，不支持 filters) |
| 获取单条 | `GET /v1/memories/<id>/` | `GET /memories/<id>` |
| 删除单条 | `DELETE /v1/memories/<id>/` | `DELETE /memories/<id>` |

通过两个配置维度适配不同部署形态：

**authHeaderMode（认证模式）**

| 模式 | Header 构造方式 | 适用场景 |
|------|----------------|----------|
| `token`（默认） | `Authorization: Token <key>` | Mem0 Cloud |
| `x_api_key` | `X-API-Key: <key>` | Mem0 OSS 自部署 |
| `bearer` | `Authorization: Bearer <key>` | 通用 Bearer 认证 |

**pathStyle（路径风格）**

| 风格 | 路径格式 | 适用场景 |
|------|----------|----------|
| `v3`（默认） | `/v3/memories/add/` 等带版本前缀 | Mem0 Cloud |
| `open` | `/memories`、`/search` 等无前缀 | Mem0 OSS 自部署 |

#### 2.3.2 Jiuwen Memory Engine 后端

Jiuwen API 与 Mem0 存在显著差异：

| 操作 | Mem0 | Jiuwen | 适配策略 |
|------|------|--------|----------|
| 添加 | `POST /v3/memories/add/` | `POST /add_messages/` | 请求体格式转换 |
| 搜索 | `POST /v3/memories/search/` | `POST /search_memory/` | topK → num 映射 |
| 获取单条 | `GET /v1/memories/<id>/` | 不支持直接按 ID 获取 | 分页遍历 `get_user_mem_by_page/`（pageSize=50, maxPages=10） |
| 删除 | `DELETE /v1/memories/<id>/` | 不支持 | 抛出 `UnsupportedOperationException` |
| 健康检查 | 无 | `GET /health` | 新增健康检查接口 |

**认证方式**：固定使用 `Authorization: Bearer <apiKey>`，无需配置 `authHeaderMode` 和 `pathStyle`。

**记录映射**：`mem_id` → memoryId, `content` → memory, metadata 含 `type` 和 `score`。

### 2.4 SPI 扩展机制

通过 `MemoryStoreProvider` SPI 接口实现可插拔的记忆存储后端：

```
MemoryStoreProvider (SPI 接口)
├── providerName(): String          ← provider 标识
├── create(apiKey, memory): MemoryStore  ← 工厂方法
│
├── Mem0MemoryStoreProvider ("mem0")
│   └── create() → GovernedMem0Api + Mem0MemoryStore
│
└── JiuwenMemoryStoreProvider ("jiuwen")
    └── create() → JiuwenMemoryApi + JiuwenMemoryStore
```

**路由流程**：

```
配置 provider=jiuwen
    ↓
MemoryStoreFactory.create(apiKey, memory)
    ↓
providers.get("jiuwen") → JiuwenMemoryStoreProvider
    ↓
provider.create(apiKey, memory) → JiuwenMemoryStore
```

**扩展新 Provider 步骤**：
1. 实现 `MemoryStore` 接口
2. 实现 `MemoryStoreProvider` 接口
3. 注册为 Spring `@Bean`

无需修改 `MemoryStoreFactory` 或 `MemoryAdaptersAutoConfiguration`。

### 2.5 治理策略

所有外部 HTTP 调用统一经过 `ExternalCallExecutor` 治理策略：

| 策略 | 默认值 | 说明 |
|------|--------|------|
| 超时 | 15000ms | 单次 HTTP 调用最大等待时间 |
| 重试 | 2 次, 退避 500ms | 失败后自动重试 |
| 熔断 | 阈值 5 次, 重置 120s | 连续失败后暂停调用 |
| 审计 | 启用 | 记录所有外部调用的成功/失败 |

治理策略通过配置统一管理，所有 provider 共享相同的治理行为。

---

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────┐
│                 Application Layer                    │
│  MemoryDemoApplication / MemoryProvider (core)       │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│            AutoConfiguration Layer                   │
│  MemoryAdaptersAutoConfiguration                     │
│  ├── @Bean mem0MemoryStoreProvider                   │
│  ├── @Bean jiuwenMemoryStoreProvider                 │
│  ├── @Bean memoryStore → MemoryStoreFactory.create() │
│  └── @Bean runtimeMemoryProvider                     │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              SPI + Factory Layer                     │
│  MemoryStoreProvider (interface)                     │
│  MemoryStoreFactory (注册式路由)                      │
└───────┬──────────────────────────────┬──────────────┘
        │                              │
┌───────▼──────────┐     ┌────────────▼──────────────┐
│   Mem0 Provider   │     │    Jiuwen Provider         │
│   ┌─────────────┐│     │    ┌────────────────────┐  │
│   │Mem0Memory   ││     │    │JiuwenMemoryStore   │  │
│   │  Store      ││     │    │                    │  │
│   └──────┬──────┘│     │    └─────────┬──────────┘  │
│   ┌──────▼──────┐│     │    ┌─────────▼──────────┐  │
│   │GovernedMem0 ││     │    │JiuwenMemoryApi     │  │
│   │  Api        ││     │    │                    │  │
│   └─────────────┘│     │    └────────────────────┘  │
└──────────────────┘     └────────────────────────────┘
        │                              │
┌───────▼──────────────────────────────▼──────────────┐
│          ExternalCallExecutor (治理层)                │
│  超时 / 重试 / 熔断 / 审计                           │
└─────────────────────────────────────────────────────┘
```

### 3.2 配置层次

```
application.yml              ← 选择导入哪个 provider profile
├── application-memory.yml   ← 共享治理配置（超时/重试/熔断/审计）
├── application-mem0.yml     ← Mem0 provider 专属配置
└── application-jiuwen.yml   ← Jiuwen provider 专属配置
```

通过 `spring.config.import` 切换 provider，不修改 Java 代码。

---

## 4. 配置设计

### 4.1 配置示例

**默认对接 Mem0 Cloud（无需额外配置）**：

```yaml
openjiwen.service.middleware.memory:
  provider: mem0
  endpoint: https://api.mem0.ai
  encrypted-api-key: <your-cloud-api-key>
```

**切换到 Mem0 自部署 OSS**：

```yaml
openjiwen.service.middleware.memory:
  provider: mem0
  endpoint: http://your-oss-server:8888
  encrypted-api-key: <your-oss-api-key>
  auth-header-mode: x_api_key
  path-style: open
```

**对接 Jiuwen Memory Engine**：

```yaml
openjiwen.service.middleware.memory:
  provider: jiuwen
  endpoint: http://localhost:8516
  encrypted-api-key: <your-jiuwen-api-key>
```

### 4.2 完整配置结构

```yaml
openjiwen:
  service:
    middleware:
      memory:
        enabled: true                    # 是否启用记忆服务
        provider: mem0                   # provider 标识（mem0 / jiuwen）
        endpoint: https://api.mem0.ai    # API 服务地址
        encrypted-api-key: <key>         # 加密的 API Key
        user-id: demo-user               # 用户标识
        rerank: false                    # 是否启用 rerank（仅 Mem0）
        auth-header-mode: token          # 认证头模式（仅 Mem0）
        path-style: v3                   # API 路径风格（仅 Mem0）
        timeout-ms: 15000                # 调用超时
        retry:
          max: 2                         # 最大重试次数
          backoff-ms: 500                # 重试退避间隔
        circuit-breaker:
          enabled: true                  # 是否启用熔断
          failure-threshold: 5           # 连续失败阈值
          reset-timeout-ms: 120000       # 熔断重置时间
        audit:
          enabled: true                  # 是否启用审计日志
```

---

## 5. 非功能性设计

### 5.1 安全性

- API Key 通过 `encrypted-api-key` 配置，运行时由 `CredentialDecryptor` 解密
- 敏感信息不写入代码仓库（配置文件中仅保留占位符）

### 5.2 可观测性

- 所有外部 HTTP 调用经过 `ExternalCallExecutor`，统一输出 `EXTERNAL_CALL_AUDIT` 审计日志
- 配置容错时输出 WARN 级别日志，便于排查认证/路径问题
- Jiuwen 后端提供 `/health` 健康检查接口

### 5.3 容错性

| 策略 | 默认值 | 说明 |
|------|--------|------|
| 超时 | 15000ms | 单次 HTTP 调用最大等待时间 |
| 重试 | 2 次, 退避 500ms | 失败后自动重试 |
| 熔断 | 阈值 5 次, 重置 120s | 连续失败后暂停调用 |

### 5.4 向后兼容

- Mem0 默认值 `authHeaderMode=token` + `pathStyle=v3`，与原行为一致
- SPI 重构不改变任何外部行为，仅改变内部创建方式
- `MemoryStore` 接口未变，上游 `MemoryProvider` 桥接层不受影响

### 5.5 容错设计

- 非法 `authHeaderMode` 值：回退 `token`，输出 WARN 日志
- 非法 `pathStyle` 值：回退 `v3`，输出 WARN 日志
- `open` 模式下传入 `filters` 参数：忽略并输出 WARN 日志
- Jiuwen `delete()` 操作：抛出 `UnsupportedOperationException`

---

## 6. 验证策略

| 验证项 | 方法 |
|--------|------|
| Mem0 Cloud 默认模式行为不变 | `MemoryAgentEndToEndTest` 回归测试 |
| Mem0 三种认证模式 | 代码审查 + WARN 日志验证 |
| Mem0 两种路径风格 | 代码审查 + 路径构造逻辑验证 |
| SPI 路由正确性 | `MemoryAdaptersAutoConfigurationTest` 单元测试 |
| Jiuwen add/search/get | `JiuwenMemoryAgentEndToEndTest`（Mock Server） |
| Jiuwen delete 抛异常 | 代码审查 |
| Jiuwen 真实服务联通 | `JiuwenMemoryIntegrationTest`（本地验证，不入库） |
| 治理策略生效 | 审计日志验证所有调用记录 |
