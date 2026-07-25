# 记忆服务 - 开发设计文档

## 1. 代码结构

### 1.1 包结构

```
com.openjiuwen.service.adapters.agentcore
├── autoconfigure
│   └── MemoryAdaptersAutoConfiguration.java    ← Bean 注册
├── memory
│   ├── MemoryStore.java                        ← SPI 接口（common 模块）
│   ├── MemoryStoreProvider.java                ← SPI 工厂接口
│   ├── MemoryStoreFactory.java                 ← 注册式路由工厂
│   ├── mem0
│   │   ├── GovernedMem0Api.java                ← Mem0 HTTP 客户端
│   │   ├── Mem0MemoryStore.java                ← Mem0 MemoryStore 实现
│   │   └── Mem0MemoryStoreProvider.java        ← Mem0 SPI Provider
│   └── jiuwen
│       ├── JiuwenMemoryApi.java                ← 九问 HTTP 客户端
│       ├── JiuwenMemoryStore.java              ← 九问 MemoryStore 实现
│       └── JiuwenMemoryStoreProvider.java      ← 九问 SPI Provider

com.openjiuwen.service.adapters.common
└── middleware
    └── MiddlewareProperties.java               ← Memory 配置属性
```

### 1.2 文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `MemoryStore.java` | 新增 | 定义通用记忆操作接口 |
| `MemoryStoreFactory.java` | 新增 | 注册式路由工厂 |
| `GovernedMem0Api.java` | 新增 | Mem0 HTTP 客户端 |
| `Mem0MemoryStore.java` | 新增 | Mem0 MemoryStore 实现 |
| `MemoryAdaptersAutoConfiguration.java` | 新增 | Bean 注册 |
| `MiddlewareProperties.java` | 修改 | 新增 Memory 配置内部类 |
| `MemoryStoreProvider.java` | 新增 | SPI 工厂接口 |
| `Mem0MemoryStoreProvider.java` | 新增 | Mem0 SPI 实现 |
| `JiuwenMemoryApi.java` | 新增 | 九问 HTTP 客户端 |
| `JiuwenMemoryStore.java` | 新增 | 九问 MemoryStore 实现 |
| `JiuwenMemoryStoreProvider.java` | 新增 | 九问 SPI 实现 |
| `application-mem0.yml` | 新增 | Mem0 配置 |
| `application-jiuwen.yml` | 新增 | 九问配置 |
| `MemoryAgentEndToEndTest.java` | 新增 | Mem0 E2E 测试 |
| `JiuwenMemoryAgentEndToEndTest.java` | 新增 | Jiuwen E2E 测试 |

---

## 2. 类设计

### 2.1 MemoryStore（通用记忆操作接口）

```java
public interface MemoryStore {
    /** 获取 provider 标识（如 "mem0"、"jiuwen"） */
    String getProvider();

    /** 检查记忆服务是否可用 */
    boolean isAvailable();

    /** 添加记忆 */
    MemoryWriteResult add(MemoryAddRequest request);

    /** 语义搜索记忆 */
    List<MemoryRecord> search(MemorySearchRequest request);

    /** 按 ID 获取单条记忆 */
    Optional<MemoryRecord> get(MemoryGetRequest request);

    /** 删除单条记忆 */
    void delete(MemoryDeleteRequest request);
}
```

### 2.2 MiddlewareProperties.Memory（配置内部类）

```java
public static class Memory implements ExternalCallPolicy {
    private boolean enabled = false;           // 是否启用记忆服务
    private String provider = "mem0";          // provider 标识
    private String endpoint;                   // API 服务地址
    private String encryptedApiKey;            // 加密的 API Key
    private String userId = "demo-user";       // 用户标识
    private boolean rerank = false;            // 是否启用 rerank
    private String authHeaderMode = "token";   // 认证头模式
    private String pathStyle = "v3";           // API 路径风格
    private long timeoutMs = 15000;            // 调用超时
    private RetryConfig retry = new RetryConfig();
    private CircuitBreakerConfig circuitBreaker = new CircuitBreakerConfig();
    private AuditConfig audit = new AuditConfig();
}
```

### 2.3 MemoryStoreProvider（SPI 接口）

```java
public interface MemoryStoreProvider {
    /** provider 标识，对应配置中的 provider 字段（如 "mem0"、"jiuwen"） */
    String providerName();

    /** 根据 apiKey 和配置创建 MemoryStore 实例 */
    MemoryStore create(String apiKey, MiddlewareProperties.Memory memory);
}
```

**扩展指引**（Javadoc）：
1. 在子包中实现 `MemoryStore`
2. 实现 `MemoryStoreProvider` 做配置注入
3. 在 AutoConfiguration 中注册为 `@Bean`

### 2.4 MemoryStoreFactory（注册式路由）

```java
public final class MemoryStoreFactory {
    private final Map<String, MemoryStoreProvider> providers;

    public MemoryStoreFactory(List<MemoryStoreProvider> providerList) {
        this.providers = providerList.stream()
            .collect(Collectors.toMap(
                p -> p.providerName().toLowerCase(Locale.ROOT),
                Function.identity()));
    }

    public MemoryStore create(String apiKey, MiddlewareProperties.Memory memory) {
        String provider = memory.getProvider().toLowerCase(Locale.ROOT);
        MemoryStoreProvider storeProvider = providers.get(provider);
        if (storeProvider == null) {
            throw new IllegalStateException(
                "Unsupported memory provider: " + provider
                + ". Available: " + providers.keySet());
        }
        return storeProvider.create(apiKey, memory);
    }
}
```

### 2.5 GovernedMem0Api

```java
public class GovernedMem0Api {
    // 认证模式常量
    private static final String AUTH_MODE_TOKEN = "token";
    private static final String AUTH_MODE_X_API_KEY = "x_api_key";
    private static final String AUTH_MODE_BEARER = "bearer";

    // 路径风格常量
    private static final String PATH_STYLE_V3 = "v3";
    private static final String PATH_STYLE_OPEN = "open";

    // 配置字段
    private final String authHeaderMode;
    private final String pathStyle;
    private final String apiKey;

    // 构造函数
    public GovernedMem0Api(String endpoint, MiddlewareProperties.Memory memory,
                           String authHeaderMode, String apiKey, String pathStyle) {
        // ...
    }
}
```

### 2.6 JiuwenMemoryApi

```java
public class JiuwenMemoryApi {
    private static final String DEFAULT_BASE_URL = "http://localhost:8516";

    // API 方法
    public Map<String, Object> addMessages(String baseUrl, String apiKey,
                                           List<Map<String, String>> messages,
                                           String userId, String scopeId);

    public List<Map<String, Object>> searchMemory(String baseUrl, String apiKey,
                                                   String query, int num,
                                                   String userId, String scopeId);

    public Map<String, Object> getUserMemByPage(String baseUrl, String apiKey,
                                                 String userId, String scopeId,
                                                 int pageSize, int pageIdx);

    public boolean isHealthy(String baseUrl);
}
```

### 2.7 JiuwenMemoryStore

```java
public class JiuwenMemoryStore implements MemoryStore {

    @Override
    public String getProvider() { return "jiuwen"; }

    @Override
    public boolean isAvailable() { return apiKey != null && !apiKey.isBlank(); }

    @Override
    public MemoryWriteResult add(MemoryAddRequest request) {
        // 调用 api.addMessages()
        // 返回 MemoryWriteResult(List.of(), response) — Jiuwen 不返回创建记录
    }

    @Override
    public List<MemoryRecord> search(MemorySearchRequest request) {
        // 调用 api.searchMemory(query, num, userId, scopeId)
        // 映射: mem_id → memoryId, content → memory
    }

    @Override
    public Optional<MemoryRecord> get(MemoryGetRequest request) {
        // 分页遍历: pageSize=50, maxPages=10
        // 逐页比对 mem_id
    }

    @Override
    public void delete(MemoryDeleteRequest request) {
        throw new UnsupportedOperationException(
            "Jiuwen Memory Engine does not support delete by memory_id");
    }
}
```

---

## 3. API 接口规格

### 3.1 Mem0 API 端点对照

| 操作 | v3 (Cloud) | open (OSS) | HTTP 方法 | 请求体 | 认证头 |
|------|------------|------------|-----------|--------|--------|
| add | `POST /v3/memories/add/` | `POST /memories` | POST | `{messages, user_id, filters}` | token / x_api_key |
| search | `POST /v3/memories/search/` | `POST /search` | POST | `{query, top_k, user_id, filters}` | token / x_api_key |
| list | `POST /v3/memories/` | `GET /memories` | POST/GET | body(仅 v3) | token / x_api_key |
| get | `GET /v1/memories/<id>/` | `GET /memories/<id>` | GET | 无 | token / x_api_key |
| delete | `DELETE /v1/memories/<id>/` | `DELETE /memories/<id>` | DELETE | 无 | token / x_api_key |

### 3.2 Jiuwen API 端点

| 操作 | 端点 | HTTP 方法 | 请求体 | 认证头 |
|------|------|-----------|--------|--------|
| add | `POST /add_messages/` | POST | `{messages, user_id, scope_id}` | Bearer |
| search | `POST /search_memory/` | POST | `{query, num, user_id, scope_id}` | Bearer |
| get by page | `POST /get_user_mem_by_page/` | POST | `{user_id, scope_id, page_size, page_idx}` | Bearer |
| health | `GET /health` | GET | 无 | Bearer |

### 3.3 Jiuwen 响应格式

**add 响应**：
```json
{
    "status": "success",
    "message": "Messages added successfully"
}
```

**search 响应**：
```json
{
    "results": [
        {
            "mem_id": "mem-1",
            "content": "用户喜欢拿铁咖啡",
            "type": "preference",
            "score": 0.95
        }
    ]
}
```

**get by page 响应**：
```json
{
    "records": [
        {
            "mem_id": "mem-1",
            "content": "用户喜欢拿铁咖啡",
            "type": "preference"
        }
    ],
    "total": 1,
    "page_size": 50,
    "page_idx": 0
}
```

---

## 4. 配置设计

### 4.1 配置属性

| 属性 | 类型 | 默认值 | 适用 Provider | 说明 |
|------|------|--------|--------------|------|
| `provider` | String | `mem0` | 通用 | provider 标识 |
| `endpoint` | String | - | 通用 | API 服务地址 |
| `encrypted-api-key` | String | - | 通用 | 加密的 API Key |
| `user-id` | String | `demo-user` | 通用 | 用户标识 |
| `rerank` | boolean | `false` | Mem0 | 是否启用 rerank |
| `auth-header-mode` | String | `token` | Mem0 | 认证头模式 |
| `path-style` | String | `v3` | Mem0 | API 路径风格 |
| `enabled` | boolean | `false` | 通用 | 是否启用记忆服务 |
| `timeout-ms` | long | `15000` | 通用 | 调用超时 |
| `retry.max` | int | `2` | 通用 | 最大重试次数 |
| `retry.backoff-ms` | long | `500` | 通用 | 重试退避间隔 |
| `circuit-breaker.enabled` | boolean | `true` | 通用 | 是否启用熔断 |

### 4.2 配置文件示例

**application-memory.yml（共享治理）**：
```yaml
openjiwen:
  service:
    middleware:
      memory:
        enabled: true
        request-scoped-session: true
        timeout-ms: 15000
        retry:
          max: 2
          backoff-ms: 500
        circuit-breaker:
          enabled: true
          failure-threshold: 5
          reset-timeout-ms: 120000
        audit:
          enabled: true
```

**application-mem0.yml**：
```yaml
openjiwen:
  service:
    middleware:
      memory:
        provider: mem0
        endpoint: ${MEM0_ENDPOINT:https://api.mem0.ai}
        encrypted-api-key: ${MEM0_API_KEY:}
        user-id: ${MEM0_USER_ID:demo-user}
        rerank: false
        # --- 自部署 Mem0 OSS 配置示例 ---
        # auth-header-mode: x_api_key
        # path-style: open
```

**application-jiuwen.yml**：
```yaml
openjiwen:
  service:
    middleware:
      memory:
        provider: jiuwen
        endpoint: ${JIUWEN_ENDPOINT:http://localhost:8516}
        encrypted-api-key: ${JIUWEN_API_KEY:}
        user-id: ${JIUWEN_USER_ID:demo-user}
        rerank: false
```

---

## 5. AutoConfiguration 设计

### 5.1 Bean 注册

```java
@AutoConfiguration
@EnableConfigurationProperties(MiddlewareProperties.class)
public class MemoryAdaptersAutoConfiguration {

    // 1. 注册 SPI Providers
    @Bean
    @ConditionalOnMissingBean(Mem0MemoryStoreProvider.class)
    public MemoryStoreProvider mem0MemoryStoreProvider() {
        return new Mem0MemoryStoreProvider();
    }

    @Bean
    @ConditionalOnMissingBean(JiuwenMemoryStoreProvider.class)
    public MemoryStoreProvider jiuwenMemoryStoreProvider() {
        return new JiuwenMemoryStoreProvider();
    }

    // 2. 创建 MemoryStore（需要 memory.enabled=true）
    @Bean
    @ConditionalOnProperty(prefix = "...memory", name = "enabled", havingValue = "true")
    public MemoryStore memoryStore(
            List<MemoryStoreProvider> providers,     // Spring 自动收集所有实现
            MiddlewareProperties middlewareProperties,
            CredentialDecryptor credentialDecryptor) {
        // 解密 apiKey → 校验非空 → 工厂路由
        return new MemoryStoreFactory(providers).create(apiKey, memory);
    }

    // 3. 桥接到 core MemoryProvider
    @Bean
    @ConditionalOnMissingBean(MemoryProvider.class)
    public MemoryProvider runtimeMemoryProvider(
            ObjectProvider<MemoryStore> memoryStoreProvider,
            MiddlewareProperties middlewareProperties) {
        MemoryStore store = memoryStoreProvider.getIfAvailable();
        if (store == null) { return null; }
        return new MemoryStoreMemoryProvider(store, memory);
    }
}
```

### 5.2 条件装配

| Bean | 条件 | 说明 |
|------|------|------|
| `mem0MemoryStoreProvider` | `@ConditionalOnMissingBean` | 允许外部覆盖 |
| `jiuwenMemoryStoreProvider` | `@ConditionalOnMissingBean` | 允许外部覆盖 |
| `memoryStore` | `memory.enabled=true` | 显式启用才创建 |
| `runtimeMemoryProvider` | `@ConditionalOnMissingBean(MemoryProvider.class)` | 不覆盖自定义实现 |

---

## 6. 错误处理

### 6.1 HTTP 层

```java
// 统一模式：statusCode 不在 [200, 300) 范围时抛异常
if (statusCode < 200 || statusCode >= 300) {
    throw new IllegalStateException(
        "memory " + operation + " failed: status=" + statusCode + ", body=" + body);
}
```

### 6.2 治理层

所有 HTTP 调用包裹在 `ExternalCallExecutor.execute()` 中：

| 异常类型 | 触发条件 | 异常类 |
|----------|----------|--------|
| 超时 | 响应时间 > timeoutMs | `MemoryTimeoutException` |
| 重试耗尽 | 重试次数 > max | `MemoryRetryInterruptedException` |
| 熔断 | 连续失败 > threshold | `MemoryCircuitOpenException` |
| 出站失败 | 其他调用失败 | `MemoryOutboundCallFailedException` |

### 6.3 Provider 层

| 场景 | 处理方式 |
|------|----------|
| apiKey 为空 | `ensureAvailable()` 抛 `IllegalStateException` |
| provider 未注册 | `MemoryStoreFactory` 抛 `IllegalStateException` + 列出可用 provider |
| Jiuwen delete | 抛 `UnsupportedOperationException` |
| Jiuwen get 找不到记录 | 分页遍历 (maxPages=10) 后返回 `Optional.empty()` |
| health check 失败 | 捕获 `ExternalSvcAdapterException` 返回 `false` |

---

## 7. 测试设计

### 7.1 测试矩阵

| 测试类 | 类型 | Provider | 环境 |
|--------|------|----------|------|
| `MemoryAgentEndToEndTest` | E2E Mock | Mem0 | 本地 MockServer |
| `JiuwenMemoryAgentEndToEndTest` | E2E Mock | Jiuwen | 本地 MockServer |
| `MemoryAdaptersAutoConfigurationTest` | 单元测试 | 通用 | Spring Context |
| `JiuwenMemoryIntegrationTest` | 集成测试 | Jiuwen | 真实服务（本地保留） |

### 7.2 Mock Server 设计

**Mem0 MockServer**：
- 模拟 `/v3/memories/search/`、`/v3/memories/add/`、`/v1/memories/<id>/` 路径
- 支持 CRUD 完整生命周期

**Jiuwen MockServer**：
- 模拟 `/search_memory/`、`/add_messages/`、`/get_user_mem_by_page/` 路径
- 支持 seed 数据预置
- 验证请求体格式（query、user_id、scope_id）

### 7.3 测试覆盖

| 验证项 | Mem0 E2E | Jiuwen E2E |
|--------|----------|------------|
| provider 标识 | ✅ | ✅ |
| prefetch search | ✅ | ✅ |
| syncTurn add | ✅ | ✅ |
| memory_search tool | ✅ | ✅ |
| memory_get tool | ✅ | ✅ |
| memory_add tool | ✅ | ✅ |
| memory_delete tool | ✅ | ❌（不支持） |
| session checkpoint | ✅ | ✅ |
| 治理审计日志 | ✅ | ✅ |

---

## 8. 扩展指南

### 8.1 新增 Provider 步骤

**第一步：实现 MemoryStore**

```java
package com.openjiuwen.service.adapters.agentcore.memory.newprovider;

public class NewProviderMemoryStore implements MemoryStore {
    @Override
    public String getProvider() { return "newprovider"; }

    @Override
    public boolean isAvailable() { return apiKey != null && !apiKey.isBlank(); }

    // ... 实现 add/search/get/delete
}
```

**第二步：实现 MemoryStoreProvider**

```java
public class NewProviderMemoryStoreProvider implements MemoryStoreProvider {
    @Override
    public String providerName() { return "newprovider"; }

    @Override
    public MemoryStore create(String apiKey, MiddlewareProperties.Memory memory) {
        return new NewProviderMemoryStore(apiKey, memory);
    }
}
```

**第三步：注册 Bean**

```java
@Bean
@ConditionalOnMissingBean(NewProviderMemoryStoreProvider.class)
public MemoryStoreProvider newProviderMemoryStoreProvider() {
    return new NewProviderMemoryStoreProvider();
}
```

**第四步：添加配置文件**

```yaml
# application-newprovider.yml
openjiwen:
  service:
    middleware:
      memory:
        provider: newprovider
        endpoint: ${NEW_ENDPOINT:http://localhost:8080}
        encrypted-api-key: ${NEW_API_KEY:}
```

**第五步：切换 provider**

```yaml
# application.yml
spring:
  config:
    import:
      - optional:classpath:application-newprovider.yml
```
