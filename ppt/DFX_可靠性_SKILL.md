---
name: design-for-reliability
description: "面向软件系统工程的可靠性设计深度评审标准(Design for Reliability),聚焦代码层弹性,基于 Netflix Hystrix/Resilience4j 弹性模式理论、AWS Well-Architected Reliability Pillar、微服务弹性模式(Timeout/Retry/Circuit Breaker/Bulkhead/Backpressure/Degrade/Idempotency)、十二要素应用 等业界规范,覆盖超时/重试/熔断/幂等/异常/资源/事务/限流/状态/异步/线程安全/消息队列/缓存/优雅关闭/日志/数据校验/舱壁隔离/背压/资源泄漏/降级策略 20 个子维度,共 58 条扫描规则;按 Must/Should/May 三级输出架构评审清单,每条含量化规则/反模式/验证方法;另含 24 条行为可验证规则的测试模板矩阵(对命中规则自动生成 pytest/jest/go test 脚本并运行,复现的才保留为真问题、未复现的作为误报剔除),输出 MD 评审报告(含 file:line/代码片段/验证状态/风险评分/修复优先级/CI 门禁配置)。触发场景:用户提「可靠性设计」「DFR」「系统可靠性」「弹性设计」「容错设计」「reliability code scan」「扫描可靠性代码」「超时/重试/熔断/幂等代码检查」「舱壁隔离」「背压」「降级策略」「资源泄漏」「resilience」「高可用」等关键词,或在架构设计/方案评审/上线准入/代码评审阶段需要拉出代码层可靠性设计基线时。"
---

# Design for Reliability (DFR) — 软件可靠性设计深度评审标准

## 何时使用本 Skill

当用户在以下场景需要可靠性深度评审时激活:

- **代码扫描模式**: 用户要求"扫描代码""审查可靠性代码""检查超时/重试/熔断/幂等代码"→ 扫描代码仓,输出 MD 评审报告(含具体问题/代码位置 file:line/严重级别 P0-P2/风险评分/修复优先级/推荐修改方案),报告写入 `可靠性扫描报告_{项目名}_{日期}.md`
- **架构评审模式**: 架构设计 / 方案评审 / 上线准入中需要拉出可靠性设计基线 → 输出 20 子维度 × Must/Should/May 三级分级检查清单,每条含量化规则/反模式/验证方法
- 故障复盘后发现"弹性不足导致级联失败/数据丢失/雪崩"
- 系统改造(微服务拆分 / 上云 / 引入新依赖)时重新评估可靠性
- 用户单独询问可靠性某个子维度(如重试策略、熔断阈值、舱壁隔离、降级设计)
- 用户给出技术栈/架构形态时,先做适配再输出清单

## 输出契约

- **代码扫描模式**: 扫描代码仓 → 输出 MD 评审报告,每条发现含(文件:行号 / 代码片段 / 问题描述 / 严重级别 P0-P2 / 风险评分 1-25 / 修复优先级 Quick Win|Deep Refactor|Schedule / 验证状态 / 推荐修改方案),报告含执行摘要、风险矩阵、CI 门禁配置,写入 `可靠性扫描报告_{项目名}_{日期}.md`
- **架构评审模式**: 输出 20 子维度 × Must/Should/May 三级分级检查清单,每条含量化规则/反模式/验证方法
- 关键缺失项用 ⚠️ 标记
- 末尾给出 Must 项达成率与评审结论(准入阈值:Must 100% + Should ≥ 70%)
- 如用户给出架构形态,先输出适配建议再展开清单

---

## 核心量化规则速查表 (Quick Reference)

> 以下为业界验证过的可靠性量化基线,评审时直接引用,项目可在此基础上收紧但不得放宽。

### 超时分级基线 (Timeout Tiers)

| 调用类型 | 连接超时 | 读超时 | 写超时 | 备注 |
|----------|----------|--------|--------|------|
| 进程内/内存操作 | — | 50ms | — | 同步调用不超 50ms |
| 内部 RPC (同 IDC) | 200ms | 1s | 1s | gRPC/Thrift |
| 外部第三方 API | 1s | 3s | 3s | 含跨域 |
| DB 查询 | 200ms | 500ms | 1s | 单查询;事务另计 |
| DB 事务 | — | 5s | 5s | 整事务上限 |
| 跨域/跨国 RPC | 1s | 5s | 5s | |
| SSE/WebSocket 流 | 1s | 300s 上限 | — | read 不可 None |
| 消息队列消费 | — | 30s | — | 单条消息处理 |

### 重试预算基线 (Retry Budget)

| 维度 | 基线值 | 反模式 |
|------|--------|--------|
| 最大重试次数 | 3 次 | > 5 次或无限重试 |
| 重试总耗时上限 | 单次 timeout × 4 | 无上限 |
| 退避策略 | 指数退避 + Jitter(≥20%) | 固定间隔 / 无 Jitter |
| 重试异常范围 | 网络错误/超时/5xx/资源不足 | 4xx/业务异常/ValidationError |
| 重试预算比 | ≤ 总请求的 20% | 无预算控制 |
| 跨层重试 | 仅最底层重试 | 多层叠加(放大效应) |

### 熔断阈值基线 (Circuit Breaker)

| 状态 | 触发条件 | 持续时间 | 备注 |
|------|----------|----------|------|
| Closed → Open | 失败率 > 50%(滑动窗口 10 请求) | 立即 | 或连续失败 5 次 |
| Open → Half-Open | reset_timeout | 30-60s | |
| Half-Open → Closed | 探测请求成功 | 1 次成功 | |
| Half-Open → Open | 探测请求失败 | 立即 | |
| 熔断异常处理 | 返回降级响应 | — | 不得直接抛异常给上层 |

### 弹性模式矩阵 (Resilience Patterns)

| 模式 | 解决问题 | 关键参数 | 反模式 |
|------|----------|----------|--------|
| 超时 (Timeout) | 挂死拖垮 | 分级 timeout | 全局单一 timeout |
| 重试 (Retry) | 瞬态故障 | 次数+退避+Jitter | 无限重试/重试 4xx |
| 熔断 (Circuit Breaker) | 级联失败 | 失败率+reset | open 抛异常不降级 |
| 舱壁隔离 (Bulkhead) | 资源争抢 | 并发上限+独立池 | 共享池无隔离 |
| 限流 (Rate Limit) | 过载 | 阈值+队列+Reject | fail-open 静默 |
| 背压 (Backpressure) | 生产者压垮消费者 | 有界队列+拒绝策略 | 无界队列 |
| 降级 (Degrade) | 依赖失效 | fallback+标记 | 核心链路无降级 |
| 幂等 (Idempotency) | 重复副作用 | 幂等键+TTL | 无 TTL 的幂等键 |

### 并发与限流基线 (Concurrency & Rate Limit)

| 维度 | 基线 | 备注 |
|------|------|------|
| 限流阈值 | 压测 QPS × 0.8 | 留 20% 余量 |
| 队列深度 | 池大小 × 2 | 超过即 Reject |
| 并发上限 | 压测并发 × 0.7 | |
| 429 Retry-After | 必须返回 | 含退避建议秒数 |
| 限流失败策略 | fail-closed(拒绝) | 禁止 fail-open 静默放行 |

### 幂等与降级基线

| 维度 | 基线 |
|------|------|
| 幂等键 TTL | ≥ 业务最长重试窗口 × 2(默认 24h) |
| 幂等检查 | 必须在事务内 |
| 降级响应时间 | ≤ 200ms(核心链路) |
| 降级标记 | 响应头 `X-Degraded: true` |
| 降级触发 | 熔断 open / 超时 / 限流 reject |

---

## 评审方式

由大模型逐文件阅读源码,基于规则矩阵中的「识别特征」与「排除条件」直接判断是否存在可靠性问题,不依赖正则匹配或 AST 解析等固定工具流程。每条命中记录 `file:line` + 代码片段 + 问题描述 + 修复建议 + 风险评分。

### 排除条件(以下场景降级为 P2 或跳过)
- `tests/` / `test_*.py` / `*_test.py` / `conftest.py`
- `scripts/` / `tools/` / `cli/` / `examples/`
- `migrations/` / `alembic/versions/`
- `docs/` / `fixtures/` / `__init__.py`

---

## 扫描规则矩阵 (20 类 58 条)

### A. 超时 (TMO)

#### SCAN-TMO-01: 跨进程调用无超时 [P0]
**识别特征**:
- Python: `requests\.(get|post|put|delete|patch|head|options)\(` 无 `timeout=`(同表达式或多行参数内)
- Python: `httpx\.(get|post|put|delete|patch)\(` 无 `timeout`
- Python: `httpx\.(Async)?Client\(` 无 `timeout=`
- Python: `aiohttp\.ClientSession\(` 无 `timeout=`
- Python: `grpc\.(insecure_channel|secure_channel)\(` 后续调用无 `timeout=` / `deadline=`
- Python: `redis\.(Redis|StrictRedis)\(` 无 `socket_timeout=`
- Java: `RestTemplate\.` / `WebClient\.` / `HttpClient\.newBuilder()` 无 timeout
- Java: `@FeignClient` 无 `connectTimeout` / `readTimeout`
- Go: `http\.Client\{\}` 无 `Timeout` 字段;`net/http` 请求无 `context.WithTimeout`
- Go: `grpc\.Dial\(` 无 `grpc.WithTimeout`
- Node.js: `axios\.(get|post|put)\(` 无 `timeout` 且实例无 `defaults.timeout`
- Node.js: `fetch\(` 无 `AbortSignal.timeout()` / `AbortController`


**排除条件**:
- Client/Session 实例初始化时已设全局 timeout → 非问题
- SSE/WebSocket 长连接(read timeout 可放宽但须有上限)
- 测试/CLI 脚本

**修复**:
```python
client = httpx.AsyncClient(timeout=httpx.Timeout(connect=1.0, read=5.0, write=5.0, pool=2.0))
response = await client.get(url, timeout=5.0)
```
```go
client := &http.Client{Timeout: 5 * time.Second}
```
```java
RestTemplate restTemplate = new RestTemplateBuilder()
    .setConnectTimeout(Duration.ofSeconds(1))
    .setReadTimeout(Duration.ofSeconds(5))
    .build();
```

#### SCAN-TMO-02: read=None 无限读等 [P0]
**识别特征**: `Timeout\(.*read=None` / `read_timeout=None` / `socket_timeout=None`

**排除条件**: SSE 流式响应(read 超时需设大值如 300s,但不可 None)

**修复**: `read=30.0`(SSE 流可放宽到 300s 但须有上限)

#### SCAN-TMO-03: 超时硬编码在函数默认参数 [P2]
**识别特征**: `def .*timeout\s*=\s*\d+` / `def .*timeout\s*:\s*(int|float)\s*=\s*\d+`

**排除条件**: 超时值来自 `settings.XXX` / `os.environ` / `config.xxx` 的不报

**修复**: `timeout: float = settings.http_timeout`

#### SCAN-TMO-04: 超时级联放大(多层重试叠加) [P1]
**识别特征**: 同一调用链上多层均含 `@retry` 装饰器或重试循环


**修复**: 仅在最底层重试,上层 fail-fast;或总预算 = 单次 timeout × 4 封顶。

### B. 重试 (RTY)

#### SCAN-RTY-01: 无 Jitter 的指数退避 [P0]
**识别特征**:
- `sleep\(2\s*\*\*\s*\w+\)` / `sleep\(\w+\s*\*\*\s*\w+\)`
- `sleep\(delay\s*\*\s*2` / `sleep\(wait\s*\*\s*2`
- `time\.sleep\(.*\*\*` 无同函数内 `random\.` 调用
- `@retry` 装饰器无 `wait=wait_exponential_jitter` / `wait=wait_random_exponential`

**排除条件**:
- 使用 `tenacity` / `backoff` 库且配置了 jitter → 非问题
- 单次重试(非循环)无需 jitter

**修复**:
```python
delay = random.uniform(0, min(cap, base * 2 ** attempt))
time.sleep(delay)
```

#### SCAN-RTY-02: 无限重试(while True 无退出条件) [P0]
**识别特征**: `while True:` 后跟 `try` + `continue`/`retry` 无 `break`/`return`/`raise`


**排除条件**:
- `while True` + 内部有 `if attempts >= max: break` → 非问题
- 事件循环(`while True: msg = await queue.get()`)非重试场景

**修复**: 添加 `if attempt >= max_attempts: raise MaxRetriesExceeded()`

#### SCAN-RTY-03: 固定间隔重试 [P1]
**识别特征**: `sleep\(\d+\)` 在重试循环内(`while`/`for attempt in range` 块内)

**排除条件**: 测试代码中的 sleep;非重试场景的 sleep(定时轮询/心跳)

**修复**: 指数退避 + Jitter(见 SCAN-RTY-01)

#### SCAN-RTY-04: 重试不区分异常类型 [P1]
**识别特征**:
- `except Exception` 后跟 `retry`/`continue`/`attempt += 1`
- `@retry` 装饰器无 `retry=retry_if_exception_type(...)` 限定

**修复**:
```python
RETRIABLE = (ConnectError, ReadTimeout, ConnectionResetError)
except RETRIABLE:
    retry()
except Exception:
    raise
```

### C. 熔断 (CB)

#### SCAN-CB-01: 外部依赖调用无熔断器 [P0]
**识别特征**:
- 步骤 1: 搜索熔断器依赖 `circuitbreaker` / `pybreaker` / `CircuitBreaker` / `@circuit` / `@breaker`
- 步骤 2: 搜索 `httpx`/`requests`/`aiohttp`/`grpc` 调用未包裹熔断装饰器
- Java: `@CircuitBreaker` / `HystrixCommand` / `Resilience4j`
- Go: `hystrix-go` / `gobreaker` / `sony/gobreaker`
- Node.js: `opossum` / `cockatiel`

**排除条件**:
- Service Mesh(Istio/Linkerd/Envoy)在基础设施层提供熔断 → 非问题
- 内部同部署单元调用(如 sidecar)无需熔断
- 调用已封装在统一 HTTP client 中间件内且中间件含熔断 → 非问题

**修复**:
```python
import pybreaker
breaker = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=60)

@breaker
def call_external_api():
    return httpx.get(url, timeout=5.0)
```

#### SCAN-CB-02: 熔断 open 时抛异常而非降级 [P1]
**识别特征**: `CircuitBreakerError` / `BreakerOpenError` / `breaker.open` 异常未 catch fallback

**排除条件**: 熔断异常被上层统一异常处理中间件捕获并降级 → 非问题

**修复**: catch 熔断异常 → 返回降级响应(缓存/默认值)

### D. 幂等 (IDM)

#### SCAN-IDM-01: 创建/支付/状态变更操作无幂等键 [P0]
**识别特征**:
- `POST` 路由处理函数签名无 `idempotency_key`/`request_id`/`X-Request-Id`/`X-Idempotency-Key`
- `create_`/`pay_`/`update_status`/`transfer`/`charge` 函数无幂等参数
- Java: `@PostMapping` 方法无 `@RequestHeader("X-Idempotency-Key")`
- Go: POST 路由无 `r.Header.Get("Idempotency-Key")`

**排除条件**:
- PUT 更新(天然幂等)无需幂等键
- Webhook handler 内有基于 event_id 去重逻辑 → 非问题
- 内部 API 且上游已保证不重复 → 降级为 P2

**修复**: 接受幂等键 + DB 唯一约束 / Redis SET NX

#### SCAN-IDM-02: 幂等检查不在事务内 [P1]
**识别特征**: `select ... where idempotency_key` 后跟 `session.add` 不在 `async with session.begin()` 内

**修复**: 整个查+写包在事务内

#### SCAN-IDM-03: 幂等键无 TTL 或过期窗口不足 [P1]
**识别特征**: `idempotency_key` 持久化但无 `expires_at` 字段 / Redis 幂等键 `ex=` 小于 3600

**排除条件**: 幂等键有 `expires_at` 字段且 ≥ 86400(24h) → 非问题

**修复**: `await redis.set(idem_key, ..., ex=86400)` 或 DB 加 `expires_at` 字段并定期清理

### E. 异常处理 (EXC)

#### SCAN-EXC-01: 裸 except / catch-all [P0]
**识别特征**:
- Python: `except:` / `except Exception:` / `except BaseException:`
- Java: `catch (Exception` / `catch (Throwable`
- Go: `recover()` 无具体 error 类型判断
- Node.js: `catch (e)` 后无 `instanceof` / `e.code` / `e.name` 判断

**排除条件(降级为 P2)**:
- 顶层入口: `main()` / ASGI middleware / WSGI middleware 的兜底 except
- 测试代码
- 清理函数: `finally` 前的兜底 `except Exception` 且紧跟 `raise`
- 进程守护: 事件循环顶层的 `except Exception: logger.error(...)`

**修复**: 捕获具体异常类型

#### SCAN-EXC-02: 吞异常(except 块无日志无处理) [P0]
**识别特征**: `except.*:` 后跟 `pass` / `continue` / `return` 无 `logger`/`log`/`print`/`raise`/`warn`


**排除条件**:
- `__del__` / `__exit__` / `atexit` 中的 except pass
- `Optional` 语义: `try: x = dict[key] except KeyError: x = None`
- 测试代码中的 `with suppress(Exception):`

**修复**: 补 ERROR/WARN 日志 + 上下文

#### SCAN-EXC-03: CancelledError 与 Exception 合并捕获 [P0]
**识别特征**:
- `except\s*\(\s*asyncio\.CancelledError\s*,\s*Exception`
- `except (CancelledError, Exception)`

**排除条件**: 捕获后 `raise` / re-raise → 非问题

**修复**: 单独捕获 `CancelledError` 并 re-raise

#### SCAN-EXC-04: finally 块 return [P1]
**识别特征**: `finally:` 块内含 `return `


**修复**: finally 仅做清理,移除 return

### F. 资源管理 (RES)

#### SCAN-RES-01: 连接池无显式配置 [P0]
**识别特征**:
- Python: `create_async_engine\(` / `create_engine\(` 无 `pool_size`/`pool_pre_ping`/`pool_recycle`
- Python: `aiomysql\.create_pool\(` 无 `minsize`/`maxsize`/`pool_recycle`
- Python: `redis\.(asyncio\.)?Redis\(` 无 `max_connections`/`socket_timeout`
- Java: `HikariConfig` / `HikariDataSource` 无 `maximumPoolSize`/`connectionTimeout`
- Go: `sql\.Open\(` 后无 `db.SetMaxOpenConns`/`db.SetMaxIdleConns`/`db.SetConnMaxLifetime`
- Node.js: `new Pool(` (pg) 无 `max`/`idleTimeoutMillis`


**排除条件**: 工厂函数/配置模块中集中配置 → 非问题

**修复**:
```python
engine = create_async_engine(
    url, pool_size=20, max_overflow=20,
    pool_recycle=3600, pool_pre_ping=True,
)
```

#### SCAN-RES-02: 无界线程池 [P1]
**识别特征**: `ThreadPoolExecutor\(\)` 无 `max_workers`

**排除条件**: `ThreadPoolExecutor(max_workers=os.cpu_count())` → 非问题

**修复**: 显式 `max_workers=10`

#### SCAN-RES-03: 分布式锁无 TTL [P0]
**识别特征**:
- `redis.*\.set\(.*nx=True` 无 `ex=`/`px=` 参数
- `setnx\(` 后无同函数内 `expire\(` 调用
- 自研锁: `acquire_lock` / `try_lock` 函数无 timeout/TTL 参数

**排除条件**: 锁封装库(如 `redis-lock` / `pottery`)内部管理 TTL → 非问题

**修复**: `await redis.set(key, owner, nx=True, ex=30)`

#### SCAN-RES-04: 锁释放无 owner 校验 [P1]
**识别特征**: `redis.*\.delete\(.*lock` / `release_lock` 无 Lua 原子校验

**排除条件**: 使用 `redis-lock` / `pottery.Redlock` 等库内部处理 → 非问题

**修复**: Lua 脚本原子比对 owner

#### SCAN-RES-05: 异步任务不保留引用 [P1]
**说明**: 此规则与 SCAN-ASYNC-01 重叠,扫描时合并为一条,报告中仅记录一次

#### SCAN-RES-06: 裸 open() 无 context manager [P1]
**识别特征**: `=\s*open\(` 而非 `with open(`

**排除条件**:
- `pathlib.Path.read_text()` / `Path.write_text()` → 非问题
- `open()` 后立即在 try/finally 中 close → 降级为 P2
- 测试 fixtures / 一次性脚本

**修复**: 用 `with open(...) as f:`

### G. 事务一致性 (TXN)

#### SCAN-TXN-01: 多表写操作不在事务内 [P0]
**识别特征**:
- 连续 `session.add` / `session.execute(insert)` 无 `async with session.begin():` 包裹
- 多个 `await session.commit()` 在同一函数中(表示逐条提交,非原子)
- Java: 多个 `repository.save(` 无 `@Transactional` 注解
- Go: 多个 `db.Exec(` 无 `tx, _ := db.Begin()` + `tx.Commit()`

**排除条件**: 独立的只读查询 + 单次写操作 → 非问题

**修复**: 包在事务内

#### SCAN-TXN-02: DB Schema 迁移直接删列 [P1]
**识别特征**: 迁移脚本 `drop_column` / `op.drop_column`

**排除条件**: 有对应的 Expand 阶段迁移(add_column → 双写 → 迁移 → drop_column)→ 非问题

**修复**: Expand-Contract 模式

### H. 限流降级 (RL)

#### SCAN-RL-01: 限流 fail-open 静默放行 [P1]
**识别特征**:
- 限流函数/middleware 内 `return True` (放行)无 `logger.warning`
- `RateLimiter` / `rate_limit` 函数 `except` 块内直接 `return True` 无日志

**排除条件**: fail-open 时有 WARN 日志 → 非问题

**修复**: fail-open 时打 WARN 日志

#### SCAN-RL-02: 429 响应无 Retry-After [P2]
**识别特征**:
- `status_code=429` / `Response(status=429)` / `HTTPException(status_code=429)` 无 `Retry-After` 头
- Java: `ResponseEntity.status(429)` 无 `.header("Retry-After", ...)`
- Go: `w.WriteHeader(429)` 无 `w.Header().Set("Retry-After", ...)`

**排除条件**: 中间件/gateway 统一添加 Retry-After → 非问题

**修复**: 添加 `Retry-After` 头

#### SCAN-RL-03: 健康端点固定返回 healthy [P0]
**识别特征**:
- `@app\.(get|route).*(/health|/ready|/healthz|/readiness)` 函数体直接 `return {"status": "healthy"}` / `return "ok"` 无依赖检查
- Java: `@GetMapping("/health")` 无 `HealthIndicator` 实现
- Go: `http.HandleFunc("/health"` 直接 `w.Write([]byte("ok"))`

**排除条件**:
- `/health` 或 `/liveness` 端点(仅需检查进程存活)→ 降级为 P2
- `/ready` 或 `/readiness` 端点含 Redis/DB ping 检查 → 非问题

**修复**: `/ready` 检查 Redis/DB ping,不健康返回 503

### I. 状态管理 (STATE)

#### SCAN-STATE-01: 进程内状态存业务数据 [P0]
**识别特征**:
- `collections\.Counter\(\)` / `collections\.defaultdict\(` 模块级变量
- `^\w+\s*:\s*dict\s*=\s*\{\}` / `^\w+\s*=\s*\{\}` 模块级变量存业务指标/状态
- Java: `static Map<>` / `static List<>` 被请求线程读写
- Go: `var` 包级可变变量被 handler 读写

**排除条件**:
- 模块级常量(`UPPER_CASE = {...}`)→ 非问题
- CLI 工具 / 单 worker 应用 → 降级为 P2
- `PROMETHEUS_METRICS` / 指标收集器 → 非问题

**修复**: 改用 Redis / Prometheus

#### SCAN-STATE-02: 本地文件存业务数据 [P1]
**识别特征**:
- `open\(.*/uploads/` / `open\(.*/data/.*['w']` 写业务文件
- `Path\(.*/uploads/.*\.write_`
- Java: `new File("uploads/` / `new FileOutputStream("data/`
- Go: `os.Create("uploads/` / `os.OpenFile("data/`

**排除条件**:
- 临时文件(`/tmp/` 用于中间处理)→ 非问题
- 日志文件(由 logging 框架管理)→ 非问题
- 配置/模板文件读取(只读)→ 非问题

**修复**: 改用对象存储(S3/OSS/MinIO)

### J. 异步可靠性 (ASYNC)

#### SCAN-ASYNC-01: asyncio.create_task 未保留引用 [P0]
**识别特征**: `asyncio\.create_task\(` 且未赋值给变量/集合(行内无 `=` 或 `add(`)

**修复**:
```python
task = asyncio.create_task(coro)
self._tasks.add(task)
task.add_done_callback(self._tasks.discard)
```

#### SCAN-ASYNC-02: asyncio.gather 无 return_exceptions [P0]
**识别特征**: `asyncio\.gather\(` 无 `return_exceptions` 参数


**修复**: `await asyncio.gather(*tasks, return_exceptions=True)`

#### SCAN-ASYNC-03: 协程对象未 await [P0]
**识别特征**: async 函数内调用协程但未加 `await` 前缀

**修复**: 加 `await` 前缀

#### SCAN-ASYNC-04: asyncio.sleep 用作超时控制 [P1]
**识别特征**: `asyncio\.sleep\(` 后跟 `cancel()` 或 `task.cancel`

**修复**: `await asyncio.wait_for(coro, timeout=seconds)`

### K. 线程安全 (THR)

#### SCAN-THR-01: 模块级可变对象被多线程访问无锁 [P0]
**识别特征**: 模块级 `^\w+\s*=\s*\{\}` / `^\w+\s*=\s*\[\]` / `^\w+\s*=\s*set\(\)` 且在函数内被读写,函数外无 `threading.Lock` 定义

**修复**:
```python
_lock = threading.Lock()
_cache = {}
def get_or_compute(key):
    with _lock:
        if key not in _cache:
            _cache[key] = expensive_compute(key)
        return _cache[key]
```

#### SCAN-THR-02: 非线程安全容器在多线程中使用 [P1]
**识别特征**: `collections\.defaultdict\(` / `collections\.Counter\(` 在 `ThreadPoolExecutor` / `threading.Thread` 上下文中使用

**修复**: 加锁保护,或改用 `queue.Queue`

### L. 消息队列可靠性 (MQ)

#### SCAN-MQ-01: auto_ack=True / auto_commit=True [P0]
**识别特征**: `auto_ack\s*=\s*True` / `enable_auto_commit\s*=\s*True`

**修复**: `auto_ack=False`,业务完成后显式 `basic_ack` / `commit()`

#### SCAN-MQ-02: 无死信队列(DLQ)配置 [P1]
**识别特征**: 队列声明 `queue_declare` 无 `x-dead-letter-exchange` 配置

**修复**: 配置 DLQ + 保留 ≥ 7 天 + 接入告警

#### SCAN-MQ-03: 生产者无发送确认 [P0]
**识别特征**: `basic_publish\(` 无 `mandatory=True` 或 `confirm_delivery`;Kafka `KafkaProducer(` 无 `acks='all'`

**修复**: 启用 publisher confirms / acks='all' + retries

### M. 缓存可靠性 (CACHE)

#### SCAN-CACHE-01: 缓存穿透无防护 [P0]
**识别特征**: `redis\.(get|hget)\(` 后跟 DB 查询,但 `None` 结果路径无 `redis.set` 缓存空值

**修复**:
```python
if result is None:
    await redis.set(key, "NULL", ex=30)  # 空值缓存 30s
    return None
```

#### SCAN-CACHE-02: 缓存 TTL 全部相同(雪崩风险) [P1]
**识别特征**: 多个 `redis\.set\(.*ex=\d+\)` 且 `ex` 值全相同

**修复**: `expire = base_ttl + random.randint(0, int(base_ttl * 0.2))`

#### SCAN-CACHE-03: 缓存与 DB 双写不一致 [P1]
**识别特征**: DB 写操作后无 `redis.delete` / `redis.set` 更新缓存

**修复**: 写操作后删缓存(Cache-Aside)或同步更新(Write-Through)

### N. 优雅关闭 (GRACE)

#### SCAN-GRACE-01: 无 SIGTERM 信号处理 [P0]
**识别特征**: 无 `signal.signal(signal.SIGTERM` / `signal.SIGINT`;FastAPI 无 `lifespan` / `on_event("shutdown")`

**修复**:
```python
@asynccontextmanager
async def lifespan(app):
    yield
    await app.state.http_client.aclose()
    await app.state.db_engine.dispose()
```

#### SCAN-GRACE-02: 连接池未在 shutdown 中关闭 [P1]
**识别特征**: `create_async_engine` / `httpx.AsyncClient` 存在但无对应的 `.dispose()` / `.aclose()` 在 shutdown handler 中

**修复**: shutdown handler 中 `await engine.dispose()` / `await client.aclose()`

### O. 日志可靠性 (LOG)

#### SCAN-LOG-01: 敏感信息入日志 [P0]
**识别特征**: `logger\.\w+\(.*(?:password|secret|token|api_key|credential|ssn|card_number|身份证|银行卡)` 在 f-string 或 format 中

**修复**: 脱敏或替换为 `***`

#### SCAN-LOG-02: 关键操作无 audit log [P1]
**识别特征**: 支付/转账/权限变更路由函数内无 `audit` / `log_action` / `record_event` 调用

**修复**: 加结构化 audit log(who/what/when/result)

#### SCAN-LOG-03: except 块内无日志(吞异常) [P0]
**说明**: 此规则与 SCAN-EXC-02 重叠,扫描时合并为一条,报告中仅记录一次

### P. 数据校验 (VAL)

#### SCAN-VAL-01: 输入校验缺失或不在入口层 [P0]
**识别特征**:
- FastAPI: `@app.post\(` 处理函数参数无 `model: BaseModel` / `Depends()` 校验
- Spring Boot: `@PostMapping` 方法参数无 `@Valid` / `@Validated` 注解
- Go Gin: `c.ShouldBindJSON(&req)` 后无 `if err != nil` 错误处理
- Express: `app.post(` 路由无 `express-validator` / `joi` / `zod` 中间件

**排除条件**:
- 内部 API(非面向用户)可降级为 P1
- 静态文件/健康检查端点无需校验

**修复**:
```python
from pydantic import BaseModel
class CreateOrderRequest(BaseModel):
    user_id: int
    amount: float = Field(gt=0)

@app.post("/orders")
async def create_order(request: CreateOrderRequest):
    ...
```

#### SCAN-VAL-02: 数据完整性约束仅在应用层 [P1]
**识别特征**:
- Python: SQLAlchemy `Column()` 无 `nullable=False` / `unique=True`
- Java: JPA `@Column` 无 `nullable=false` / `unique=true`

**排除条件**:
- 可选字段(`nullable=True` 是设计意图)→ 非问题
- 历史遗留表(添加约束需数据清洗)→ 标注"待整改"

**修复**: DB 层添加 `NOT NULL` / `UNIQUE` / `CHECK` 约束

### Q. 舱壁隔离 (BULKHEAD)

#### SCAN-BH-01: 外部依赖调用无并发限制 [P0]
**识别特征**:
- 外部依赖调用函数无 `asyncio.Semaphore` / `ThreadPoolExecutor` / `concurrency limit`
- Python: 调用 `httpx`/`aiohttp`/`grpc` 的函数内无 `async with sem:` 包裹
- Java: 外部调用无 `@Bulkhead` / `Semaphore` / `RateLimiter` 注解
- Go: 外部调用无 `sem := make(chan struct{}, N)` 限流
- Node.js: 外部调用无 `p-limit` / `semaphore` 包裹

**排除条件**:
- 调用已封装在统一 HTTP client 中间件内且中间件含并发限制 → 非问题
- 内部调用且上游有全局限流 → 降级为 P2

**修复**:
```python
_external_sem = asyncio.Semaphore(10)

async def call_external(url):
    async with _external_sem:
        return await httpx.get(url, timeout=5.0)
```

#### SCAN-BH-02: 线程池/连接池未按依赖隔离 [P1]
**识别特征**:
- 多个外部依赖共享同一 `ThreadPoolExecutor` / 连接池,无按依赖分区
- Java: 多个 `@FeignClient` 共享同一 `RestTemplate` / `WebClient` 无独立连接池

**排除条件**:
- 依赖数量 ≤ 2 且 QPS 低 → 降级为 P2
- Service Mesh 提供侧car 隔离 → 非问题

**修复**: 每个关键依赖独立线程池/连接池(命名隔离)

### R. 背压控制 (BACKPRESSURE)

#### SCAN-BP-01: 生产者无速率限制(无界队列) [P0]
**识别特征**:
- `queue.Queue()` / `asyncio.Queue()` 无 `maxsize` 参数
- `collections.deque` 无 `maxlen` 用作生产-消费缓冲
- Kafka producer 无 `max.in.flight.requests.per.connection` 限制


**排除条件**:
- 有界队列 + 拒绝策略(丢弃/阻塞/回压)→ 非问题
- 批处理任务(生产者速率可控)→ 降级为 P2

**修复**:
```python
queue = asyncio.Queue(maxsize=1000)
# 满时 put 会 await 阻塞,自然背压
```

#### SCAN-BP-02: 流式处理无水位控制 [P1]
**识别特征**:
- 流式消费者(`async for msg in` / Kafka consumer)无并发上限
- 响应式流(Reactor/RxJS)无 `onBackpressureBuffer` / `onBackpressureDrop`

**修复**: 限制并发 + 缓冲区上限 + 满时 drop/dropoldest

### S. 资源泄漏 (LEAK)

#### SCAN-LEAK-01: 文件/Socket/DB 游标未关闭 [P0]
**识别特征**:
- `open(` 返回值未在 `with` 内且无 `close()` 调用(补 RES-06 之外的句柄)
- `socket.socket(` 未在 `with` 内
- DB `cursor` 未在 `with` / `finally` 内关闭
- Python: `subprocess.Popen(` 未在 `with` 内且无 `wait()`/`terminate()`


**排除条件**: 已在 `with` 内 → 非问题

**修复**: 用 `with` 上下文管理器

#### SCAN-LEAK-02: 缓存/集合无界增长(无 eviction) [P1]
**识别特征**:
- 模块级 `dict` / `set` / `list` 作缓存,无 `maxlen` / LRU / TTL
- `functools.lru_cache` 无 `maxsize` 参数
- 自实现缓存类无 `__len__` 上限检查或清理逻辑

**修复**:
```python
from functools import lru_cache

@lru_cache(maxsize=1024)
def expensive_compute(key):
    ...
```

#### SCAN-LEAK-03: 订阅/监听器未注销 [P1]
**识别特征**:
- `addEventListener` / `signal.connect` / `app.on_event` 注册但无对应 `removeEventListener` / `disconnect` / `off_event`
- Python: `pydispatch` / `blinker` 的 `.connect(` 无对应 `.disconnect(`


**排除条件**: 进程生命周期内单例订阅 → 降级为 P2

**修复**: 在 `__del__` / shutdown handler 中注销

### T. 降级策略 (DEGRADE)

#### SCAN-DG-01: 核心链路依赖无降级路径 [P0]
**识别特征**:
- 核心 API(支付/下单/登录)路由函数内调用外部依赖,但无 `try/except` fallback 或 `@fallback` 装饰器
- Java: 核心服务无 `@FallbackMethod` / `@Retry(fallbackMethod=...)`
- 熔断器(`@breaker`)无配套降级函数

**排除条件**:
- 非核心功能(推荐/评论/统计)→ 降级为 P2
- 依赖有读副本/本地兜底缓存 → 非问题

**修复**:
```python
@breaker
def get_user_profile(uid):
    return httpx.get(f"{API}/users/{uid}", timeout=2.0).json()

def get_user_profile_fallback(uid, *args):
    logger.warning(f"User profile degraded, uid={uid}")
    return {"uid": uid, "name": "unknown", "degraded": True}
```

#### SCAN-DG-02: 降级返回无标记 [P2]
**识别特征**: 降级函数返回响应但未设置 `X-Degraded` / `X-Fallback` 响应头

**修复**: 响应头加 `X-Degraded: true` + 降级原因

---

## 验证测试生成规则矩阵 (Verification Test Matrix)

> 对 Step 3 命中的疑似问题,若属下列 **24 条行为可验证规则**之一,**必须**生成验证测试并运行,不得仅凭主观判定。其余静态规则(命名/配置/硬编码/资源池参数/事务边界/限流响应/状态存储/MQ DLQ/缓存雪崩/日志脱敏/数据校验等)由大模型阅读判定。

### 判定三态

| 验证结果 | 含义 | 处置 |
|----------|------|------|
| ✅ 已复现 | 测试失败(断言失败,即被测代码确实表现出问题行为) | 保留为真问题,测试脚本留存作回归用例 |
| ❌ 误报 | 测试通过(断言通过,即被测代码实际无问题) | 从报告剔除,删除测试脚本 |
| ⚠️ 未能验证 | 缺依赖/导入失败/超时/需真实外部服务 | 降级为主观判定保留,报告中标注 ⚠️ |

> **关键约定(全部模板统一)**: 断言一律描述**正确行为**(无 bug 时的预期)。**测试失败 = 真问题 ✅**;**测试通过 = 误报 ❌**。这样修复后测试自然变绿,可直接留存为回归用例。

### 可验证规则清单与测试模板

#### V-TMO-01: 跨进程调用无超时
- **触发场景**: 启动慢 mock server(响应延迟 > 10s),调用被测函数,断言其在阈值内返回
- **断言**: 被测函数在 30s 内返回(若挂死 = 无超时 = 真问题)
- **判定**: 超时未返回 → ✅;在阈值内返回 → ❌
- **模板**(Python):
  ```python
  # AUTO-GENERATED by design-for-reliability scan, {日期}
  import pytest
  from unittest.mock import patch
  import httpx
  from {module} import {func}

  @pytest.mark.timeout(30)
  def test_{func}_no_timeout():
      def slow_handler(request):
          import time; time.sleep(60)
          return httpx.Response(200, json={})
      with httpx.MockTransport(slow_handler) as transport:
          client = httpx.Client(transport=transport)
          with patch("{module}.httpx.Client", return_value=client):
              result = {func}("http://test/endpoint")
              assert result is not None
  ```
- **其他语言**: Java 用 MockWebServer;Go 用 httptest.Server + sleep;Node 用 nock

#### V-TMO-02: read=None 无限读等
- **触发场景**: mock 流式响应永不结束,断言被测函数挂死
- **判定**: 超过 30s 未返回 → ✅;正常返回 → ❌
- **模板**: 同 V-TMO-01,mock 返回一个永不关闭的流

#### V-RTY-01: 无 Jitter 的指数退避
- **触发场景**: mock sleep 收集实际睡眠序列,**连续运行两次**重试流程,断言两次序列完全一致(确定性 = 无 jitter)
- **断言**: 两次 sleep 序列逐元素相等 → 无 jitter(真问题);存在差异 → 有 jitter(误报)
- **判定**: 两次序列完全一致 → ✅;两次序列存在差异 → ❌
- **模板**:
  ```python
  @pytest.mark.timeout(30)
  def test_{func}_no_jitter():
      real_sleep = time.sleep
      def capture_once():
          seq = []
          def mock_sleep(d): seq.append(round(d, 6)); real_sleep(0)
          with patch("time.sleep", mock_sleep), \
               patch("{module}.{dep}", side_effect=ConnectionError):
              try: {func}()
              except ConnectionError: pass
          return seq
      seq1 = capture_once()
      seq2 = capture_once()
      assert seq1 != seq2, f"两次重试 sleep 序列完全一致 {seq1},无 jitter"

#### V-RTY-02: 无限重试
- **触发场景**: 注入持续失败的依赖,断言被测函数在合理 max 次数内返回或 raise
- **判定**: 超过 100 次调用仍未退出 → ✅;在 max 内退出 → ❌
- **模板**:
  ```python
  @pytest.mark.timeout(30)
  def test_{func}_infinite_retry():
      call_count = {"n": 0}
      def always_fail(*a, **kw):
          call_count["n"] += 1
          raise ConnectionError("down")
      with patch("{module}.{dep}", always_fail):
          with pytest.raises(Exception):
              {func}()
      assert call_count["n"] <= 20, f"重试 {call_count['n']} 次,疑似无限重试"
  ```

#### V-RTY-04: 重试不区分异常类型
- **触发场景**: 注入非可重试异常(如 ValueError),断言是否仍被重试
- **判定**: 被重试 ≥ 2 次 → ✅;只调 1 次 → ❌
- **模板**:
  ```python
  def test_{func}_retries_non_retriable():
      call_count = {"n": 0}
      def fail_value_error(*a, **kw):
          call_count["n"] += 1
          raise ValueError("not retriable")
      with patch("{module}.{dep}", fail_value_error):
          try:
              {func}()
          except ValueError:
              pass
      assert call_count["n"] == 1, f"非可重试异常被重试 {call_count['n']} 次"
  ```

#### V-CB-01: 外部依赖调用无熔断器
- **触发场景**: 让依赖连续失败 N 次(N 远大于常见熔断阈值 5),断言下游被调次数是否被熔断截断
- **判定**: 下游被调次数 == N(无熔断截断)→ ✅;被调次数 < N(已被熔断跳过)→ ❌
- **模板**:
  ```python
  @pytest.mark.timeout(30)
  def test_{func}_no_circuit_breaker():
      N = 11  # 远超常见熔断阈值 5
      call_count = {"n": 0}
      def always_fail(*a, **kw):
          call_count["n"] += 1
          raise ConnectionError("down")
      with patch("{module}.{dep}", always_fail):
          for _ in range(N):
              try:
                  {func}()
              except ConnectionError:
                  pass
      # 有熔断器时,前 5 次失败后 open,后续调用被跳过 → call_count <= 5
      # 无熔断器时,N 次全部打到下游 → call_count == N
      assert call_count["n"] < N, f"失败 {call_count['n']} 次全部打到下游,无熔断"

#### V-IDM-01: 创建/支付操作无幂等键
- **触发场景**: 同幂等键连续调用 2 次,断言第二次是否返回首条记录(幂等)
- **判定**: 产生 2 条不同记录 → ✅(无幂等);第 2 次返回首条 → ❌
- **模板**:
  ```python
  @pytest.mark.timeout(30)
  def test_{func}_not_idempotent():
      result1 = {func}({args}, idempotency_key="key-123")
      result2 = {func}({args}, idempotency_key="key-123")
      # 幂等正确行为: 同键返回同一条记录
      assert result1.id == result2.id, f"同幂等键产生两条记录 {result1.id} != {result2.id}"

#### V-EXC-02: 吞异常(except 块无日志无处理)
- **触发场景**: 注入异常,捕获日志输出,断言是否有 ERROR/WARN 记录
- **判定**: 无 ERROR/WARN 日志 → ✅(吞异常);有日志 → ❌
- **模板**:
  ```python
  @pytest.mark.timeout(30)
  def test_{func}_swallows_exception():
      import logging
      records = []
      handler = logging.Handler()
      handler.emit = lambda r: records.append(r)
      root = logging.getLogger()
      root.addHandler(handler)
      try:
          with patch("{module}.{dep}", side_effect=RuntimeError("boom")):
              try:
                  {func}()
              except RuntimeError:
                  pass
          # 正确行为: 异常应被记录(ERROR/WARN)
          assert records, f"异常被吞,无任何 ERROR/WARN 日志"
      finally:
          root.removeHandler(handler)

#### V-RES-01: 连接池无显式配置
- **触发场景**: 并发发起 N(N > 默认池大小)个慢查询,断言是否因连接耗尽阻塞/超时
- **判定**: 总耗时 >> 单查询耗时 × (N / 池大小) → ✅(无配置或配置过小);符合预期 → ❌
- **模板**:
  ```python
  @pytest.mark.timeout(30)
  @pytest.mark.asyncio
  async def test_{func}_pool_unconfigured():
      import asyncio, time
      async def slow_query():
          await asyncio.sleep(0.2)  # mock 单查询耗时
          return await {func}()  # 被测函数使用引擎(若为同步则去掉 await)
      start = time.time()
      await asyncio.gather(*[slow_query() for _ in range(50)])
      elapsed = time.time() - start
      # 有合理池配置(池 20): 50 并发 ≈ 3 批 × 0.2s ≈ 0.6s
      # 无配置默认池 5: 10 批 × 0.2s ≈ 2.0s+
      assert elapsed < 1.5, f"耗时 {elapsed:.2f}s,疑似连接池过小或未配置"

#### V-RES-03: 分布式锁无 TTL
- **触发场景**: 获取锁后立即检查 key 的 TTL,断言是否被代码设置了过期时间
- **判定**: TTL == -1(永不过期)→ ✅(无 TTL);TTL > 0 → ❌
- **模板**:
  ```python
  @pytest.mark.timeout(30)
  def test_{func}_lock_no_ttl():
      import fakeredis
      r = fakeredis.FakeRedis()
      with patch("{module}.redis", r):
          acquired = {func}.acquire_lock("key", owner="A")
          assert acquired
          # r.ttl 返回: -1=无 TTL, -2=key 不存在, >0=剩余秒数
          assert r.ttl("key") > 0, "锁无 TTL,永不过期"
  ```

#### V-RES-04: 锁释放无 owner 校验
- **触发场景**: A 获取锁 → 锁过期 → B 获取锁 → A 调用 release 误释放 B 的锁
- **判定**: B 的锁被 A 释放 → ✅(无 owner 校验);A 释放失败 → ❌
- **模板**:
  ```python
  @pytest.mark.timeout(30)
  def test_{func}_lock_no_owner_check():
      import fakeredis
      r = fakeredis.FakeRedis()
      with patch("{module}.redis", r):
          # A 获取锁
          r.set("lock:k", "owner-A", ex=30)
          # 模拟 A 的锁过期(fakeredis 直接 delete,不等待真实时间)
          r.delete("lock:k")
          # B 获取新锁
          r.set("lock:k", "owner-B", ex=30)
          # A 尝试释放(无 owner 校验会误删 B 的锁)
          {func}.release_lock("lock:k", owner="owner-A")
          # 正确行为: A 释放应失败,B 的锁仍存在
          assert r.exists("lock:k") == 1, "B 的锁被 A 误释放,无 owner 校验"
  ```

#### V-ASYNC-01: asyncio.create_task 未保留引用
- **触发场景**: 调用被测函数(内部 create_task 但不保留引用),触发 gc,断言是否产生 "Task was destroyed but it is pending" 日志
- **判定**: 产生 destroyed 日志 → ✅(未保留引用);无该日志 → ❌
- **模板**:
  ```python
  @pytest.mark.asyncio
  async def test_{func}_task_gc(caplog):
      import gc, asyncio, logging
      with caplog.at_level(logging.ERROR, logger="asyncio"):
          {func}()  # 内部 create_task 但不保留引用(若为协程改 await {func}())
          gc.collect()
          await asyncio.sleep(0.01)
      # 正确行为: 调用方应保留任务引用,不应出现 destroyed 日志
      assert not any("destroyed" in r.message.lower() for r in caplog.records), \
          "任务未保留引用,被 GC 销毁"
  ```

#### V-ASYNC-02: asyncio.gather 无 return_exceptions
- **触发场景**: 一个子任务抛异常,断言其他子任务是否仍能完成
- **判定**: 其他任务被取消(未完成)→ ✅(无 return_exceptions);其他任务正常完成 → ❌
- **模板**:
  ```python
  @pytest.mark.asyncio
  async def test_{func}_gather_no_return_exceptions():
      completed = {"n": 0}
      async def good():
          completed["n"] += 1
          return 1
      async def bad():
          raise RuntimeError("fail")
      # 正确行为: 有 return_exceptions 时,gather 不抛异常,所有子任务都完成
      try:
          await {func}([bad, good, good])
      except RuntimeError:
          pass
      # 有 return_exceptions → completed["n"] == 2;无 → 其他任务被取消 → completed["n"] < 2
      assert completed["n"] == 2, f"其他任务被取消({completed['n']}/2 完成),无 return_exceptions"
  ```

#### V-ASYNC-03: 协程对象未 await
- **触发场景**: 调用后用 warnings.catch_warnings 捕获 "never awaited"
- **判定**: 有 RuntimeWarning "coroutine was never awaited" → ✅;无 → ❌
- **模板**:
  ```python
  def test_{func}_coroutine_not_awaited():
      import warnings
      with warnings.catch_warnings(record=True) as w:
          warnings.simplefilter("always")
          {func}()
          import gc; gc.collect()
      assert any("never awaited" in str(x.message) for x in w), "协程已 await"
  ```

#### V-THR-01: 模块级可变对象被多线程访问无锁
- **触发场景**: N 线程并发自增计数器 1000 次,断言最终值丢失
- **判定**: 最终值 != N×1000 → ✅;等于 → ❌(可能已有锁或 GIL 保护下偶尔安全,需多次运行)
- **模板**:
  ```python
  def test_{func}_race_condition():
      import threading
      from {module} import {counter_obj}
      N, I = 50, 1000
      def inc():
          for _ in range(I): {counter_obj}["n"] = {counter_obj}.get("n", 0) + 1
      ts = [threading.Thread(target=inc) for _ in range(N)]
      [t.start() for t in ts]; [t.join() for t in ts]
      expected = N * I
      assert {counter_obj}.get("n", 0) == expected, f"值丢失: 期望 {expected}, 实际 {counter_obj.get('n')}"
  ```

#### V-MQ-01: auto_ack=True
- **触发场景**: 消费中抛异常,断言消息未重新投递(丢失)
- **判定**: 消息丢失未重投 → ✅;消息重投 → ❌
- **模板**: 用 fakeredis + 模拟 RabbitMQ/Kafka 消费,注入异常后检查队列残留

#### V-CACHE-01: 缓存穿透无防护
- **触发场景**: 查不存在的 key 3 次,断言 DB/mock 被调 3 次
- **判定**: DB 被调 3 次 → ✅;只调 1 次(有空值缓存)→ ❌
- **模板**:
  ```python
  def test_{func}_cache_penetration():
      db_calls = {"n": 0}
      def fake_db_get(key):
          db_calls["n"] += 1
          return None
      with patch("{module}.{db_func}", fake_db_get):
          for _ in range(3):
              {func}("non-existent-key")
      assert db_calls["n"] == 1, f"DB 被调 {db_calls['n']} 次,无空值缓存防护"
  ```

#### V-CACHE-03: 缓存与 DB 双写不一致
- **触发场景**: 写 DB 后立即读缓存,断言缓存是否已同步新值
- **判定**: 缓存返回旧值/未更新 → ✅(双写不一致);缓存返回新值 → ❌
- **模板**:
  ```python
  @pytest.mark.asyncio
  async def test_{func}_cache_db_inconsistency():
      import fakeredis
      r = fakeredis.FakeRedis()
      with patch("{module}.redis", r):
          # 预置旧缓存值
          await r.set("k", b"old-val")
          # 写 DB,期望代码同步更新缓存
          await {func}.update_db("k", "new-val")
          cached = await r.get("k")
          # 正确行为: 缓存应已同步为新值
          assert cached == b"new-val", f"缓存仍为旧值 {cached},双写不一致"
  ```

#### V-RL-01: 限流 fail-open 静默放行
- **触发场景**: 注入限流器异常(Redis 不可用),断言请求是否被拒绝或有告警日志
- **判定**: 放行且无 WARN 日志 → ✅(静默 fail-open);拒绝或有日志 → ❌
- **模板**:
  ```python
  @pytest.mark.timeout(30)
  def test_{func}_rate_limiter_fail_open_silent():
      import logging
      records = []
      handler = logging.Handler()
      handler.emit = lambda r: records.append(r)
      root = logging.getLogger()
      root.addHandler(handler)
      try:
          with patch("{module}.redis", side_effect=ConnectionError):
              # 正确行为: 限流器异常时应拒绝请求或放行但记录 WARN
              allowed = {func}.rate_limit("user-1")
              assert (not allowed) or records, "限流器异常时静默 fail-open,无告警日志"
      finally:
          root.removeHandler(handler)

#### V-TXN-01: 多表写不在事务内
- **触发场景**: 注入中间失败(写第二张表时抛异常),断言第一张表数据已写入(非原子)
- **判定**: 第一张表有数据 → ✅(非事务);两张表都无 → ❌
- **模板**:
  ```python
  @pytest.mark.asyncio
  async def test_{func}_multi_table_not_transactional():
      with patch("{module}.{table2_save}", side_effect=RuntimeError("fail")):
          try:
              await {func}({...})
          except RuntimeError: pass
      # 检查 table1 是否有残留数据
      count = await {module}.count_table1()
      assert count == 0, f"table1 残留 {count} 条,非事务"
  ```

#### V-GRACE-01: 无 SIGTERM 信号处理
- **触发场景**: 发 SIGTERM,断言无清理日志/连接未关闭
- **判定**: 无清理 → ✅;有清理 → ❌
- **模板**: 启动子进程,发 SIGTERM,检查 shutdown handler 是否执行

#### V-BH-01: 外部依赖无并发限制
- **触发场景**: 并发发起 N(N > 应有限流)个请求,断言下游被调 N 次而非限流值
- **判定**: 下游被调 N 次 → ✅(无舱壁);下游被调 ≤ 限流值 → ❌
- **模板**:
  ```python
  @pytest.mark.asyncio
  async def test_{func}_no_bulkhead():
      call_count = {"n": 0}
      async def mock_dep(*a, **kw):
          call_count["n"] += 1
          await asyncio.sleep(0.1)
          return {}
      with patch("{module}.{dep}", mock_dep):
          await asyncio.gather(*[{func}() for _ in range(50)])
      assert call_count["n"] <= 10, f"无并发限制,下游被调 {call_count['n']} 次"
  ```

#### V-LEAK-01: 文件/Socket 未关闭
- **触发场景**: 包装 open,追踪返回的文件句柄,调用后断言所有句柄已 close
- **判定**: 存在未 close 的句柄 → ✅(泄漏);全部已 close → ❌
- **模板**:
  ```python
  @pytest.mark.timeout(30)
  def test_{func}_file_handle_leak():
      import gc
      from unittest.mock import patch, MagicMock
      real_open = open
      opened = []
      def tracking_open(*a, **kw):
          fh = real_open(*a, **kw)
          opened.append(fh)
          return fh
      with patch("builtins.open", tracking_open):
          {func}("/tmp/test-dfr-leak")
      gc.collect()
      leaked = [h for h in opened if not h.closed]
      # 正确行为: 所有句柄应已 close
      assert not leaked, f"{len(leaked)} 个文件句柄未 close,泄漏"

#### V-DG-01: 核心链路无降级路径
- **触发场景**: mock 依赖失败,断言是否返回降级响应(fallback)而非直接抛异常
- **判定**: 抛异常无 fallback → ✅(无降级);返回降级响应 → ❌
- **模板**:
  ```python
  @pytest.mark.asyncio
  async def test_{func}_no_degradation():
      with patch("{module}.{dep}", side_effect=ConnectionError):
          # 正确行为: 核心链路依赖失败时应返回降级响应,而非抛异常
          result = await {func}({...})
          assert result is not None, "依赖失败直接抛异常,无降级路径"
          headers = {k.lower() for k in getattr(result, "headers", {})}
          assert "x-degraded" in headers or getattr(result, "degraded", False), "无降级标记"

### 测试生成约束

1. **自包含**: 测试自带 mock server/fixture,不依赖真实 DB/MQ/外部服务
2. **不改源码**: 只 import 与调用被测代码,禁止 patch 源码逻辑
3. **超时保护**: 每条测试加 `@pytest.mark.timeout(30)`(或对应语言等价物),防止无限重试规则挂死测试
4. **自动标注**: 文件头 `# AUTO-GENERATED by design-for-reliability scan, {日期}`,便于识别清理
5. **清理策略**: 真问题测试留存作回归用例;误报测试删除,避免 tests/ 膨胀
6. **加速**: 用 mock 替代真实 sleep/网络,`time.sleep` patch 为 0,确保测试 < 5s 跑完

---

## 报告模板

扫描完成后,按以下模板输出 MD 报告:

```markdown
# 代码可靠性扫描报告 — [项目名]

**扫描时间**: YYYY-MM-DD HH:mm
**项目语言**: [Python / Java / Go / Node.js]
**框架**: [FastAPI / Spring Boot / Gin / Express]
**扫描范围**: [全量 / 增量]
**扫描规则**: 20 类 58 条
**验证测试**: 已对 24 条行为可验证规则生成测试并运行

## 执行摘要

- **整体风险评分**: XX/100(高/中/低)
- **Top 5 风险**(按风险评分排序):
  1. [P0-001] SCAN-XXX-01 @ file:line — 风险评分 25
  2. ...
- **整体判定**: ❌ 不通过(阻断上线)/ ⚠️ 有条件通过 / ✅ 通过

## 统计

| 严重级别 | 初筛数 | ❌ 误报剔除 | ✅ 确认真问题 | ⚠️ 未能验证 | 说明 |
|----------|--------|------------|--------------|-------------|------|
| P0 | X | X | X | X | 阻断上线:级联失败/数据丢失/死锁风险 |
| P1 | X | X | X | X | 影响弹性:限期 1 周整改 |
| P2 | X | X | X | X | 最佳实践:排期改进 |
| **合计** | **X** | **X** | **X** | **X** | 验证通过率 = 确认真问题 / (确认真问题 + 误报剔除) |

## 风险评分矩阵

> 风险评分 = 概率(L/M/H=1/2/3) × 影响(L/M/H=1/2/3),范围 1-9,折算 25 分制 = score × 25/9

| 问题 ID | 规则 | 概率 | 影响 | 风险评分 | 优先级 |
|---------|------|------|------|----------|--------|
| P0-001 | SCAN-TMO-01 | H(3) | H(3) | 25 | Quick Win |
| P0-002 | SCAN-EXC-02 | H(3) | M(2) | 17 | Quick Win |
| ... | ... | ... | ... | ... | ... |

## 修复优先级分组

### Quick Win(≤ 1 人日 + 高影响,立即修复)
- [P0-001] SCAN-TMO-01 @ src/api/client.py:45 — 加 timeout 参数,0.5 人日
- ...

### 深度重构(> 3 人日,排期推进)
- [P0-00X] SCAN-BH-01 @ src/service/payment.py:120 — 引入舱壁隔离,5 人日
- ...

### 排期改进(P2,迭代消化)
- ...

## P0 问题(必须修复)

### [P0-001] SCAN-TMO-01: 跨进程调用无超时
**文件**: `src/api/client.py:45`
**规则**: SCAN-TMO-01
**验证状态**: ✅ 已复现
**验证测试**: `tests/reliability/verify_TMO-01_api_client_45.py`
**风险评分**: 25(概率 H × 影响 H)
**优先级**: Quick Win

**问题代码**:
```python
response = httpx.get(url)  # 无 timeout
```

**问题描述**: HTTP 调用无超时配置,下游服务卡死时拖垮整个应用。

**验证证据**: 测试启动慢 mock server(60s 响应),被测函数挂死至 pytest-timeout 杀掉,复现无超时行为。

**修复建议**:
```python
response = httpx.get(url, timeout=httpx.Timeout(connect=1.0, read=5.0))
```

---

### [P0-002] SCAN-EXC-02: 吞异常
**文件**: `src/service/order.py:88`
**规则**: SCAN-EXC-02
**验证状态**: ✅ 已复现
**验证测试**: `tests/reliability/verify_EXC-02_order_88.py`
**风险评分**: 17(概率 H × 影响 M)
**优先级**: Quick Win

**问题代码**:
```python
try:
    await process_order(order)
except Exception:
    pass  # 异常被吞掉
```

**问题描述**: 异常被捕获但未记录日志,排障无线索。

**验证证据**: 注入 RuntimeError 后日志记录数为 0,确认异常被吞。

**修复建议**:
```python
except Exception as e:
    logger.error(f"Order processing failed: {e}", exc_info=True, extra={"order_id": order.id})
    raise
```

(其余 P0 按此格式展开;每条含「验证状态」「验证测试」「风险评分」「优先级」字段)

### 误报已剔除(不纳入问题清单,仅供审计)

| 规则 | 文件 | 剔除原因 |
|------|------|----------|
| SCAN-TMO-01 | src/api/client.py:120 | 测试通过: httpx.Client 实例初始化时已配全局 timeout |
| SCAN-EXC-02 | src/util/helper.py:55 | 测试通过: except 块内含 logger.warning |

## P1 问题(强烈建议修复)

(按 P0 格式展开)

## P2 问题(建议改进)

(按 P0 格式展开)

## 已沉淀回归测试

以下测试脚本已复现问题并留存于 `tests/reliability/`,修复后可作为回归用例长期守护,防止回退:

| 测试文件 | 对应规则 | 对应问题 |
|----------|----------|----------|
| `tests/reliability/verify_TMO-01_api_client_45.py` | SCAN-TMO-01 | P0-001 |
| `tests/reliability/verify_EXC-02_order_88.py` | SCAN-EXC-02 | P0-002 |
| ... | ... | ... |

> 建议接入 CI: `pytest tests/reliability/ -xvs` 作为可靠性回归门禁。

## CI 门禁配置(可直接使用)

### GitHub Actions
```yaml
# .github/workflows/reliability-gate.yml
name: Reliability Gate
on: [pull_request]
jobs:
  reliability:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install pytest pytest-timeout pytest-asyncio
      - run: pytest tests/reliability/ -xvs --timeout=30
```

### GitLab CI
```yaml
reliability-gate:
  script:
    - pip install pytest pytest-timeout pytest-asyncio
    - pytest tests/reliability/ -xvs --timeout=30
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

## 结论

**P0 问题数**: X(必须修复后方可上线)
**P1 问题数**: X(限期 1 周内修复)
**P2 问题数**: X(排期改进)
**整体风险评分**: XX/100

**判定**: [✅ 通过(可上线) / ⚠️ 有条件通过(修复 P0 后准入) / ❌ 不通过(阻断上线)]
```

---

## 架构评审清单(架构评审模式)

> 用户在架构设计/方案评审阶段触发时,按以下 20 子维度 × Must/Should/May 三级输出清单。准入阈值: Must 100% + Should ≥ 70%。

### 评审清单结构(示例)

| 子维度 | Must(必须) | Should(推荐) | May(可选) |
|--------|-----------|--------------|-----------|
| A. 超时 | 所有跨进程调用配置分级 timeout | timeout 走配置中心可热更新 | 慢查询自动熔断 |
| B. 重试 | 重试有上限 + Jitter | 重试区分异常类型 | 重试预算比 < 20% |
| C. 熔断 | 外部依赖有熔断器 | 熔断 open 时降级 | half-open 探测可配置 |
| ... | ... | ... | ... |
| Q. 舱壁 | 关键依赖独立池 | 按依赖隔离连接池 | 动态调整池大小 |
| T. 降级 | 核心链路有降级路径 | 降级响应加标记 | 降级自动恢复 |

(完整清单按实际项目架构形态展开,先适配再输出)

---

## 执行流程

```
Step 1: 识别项目语言/框架/结构
  → Glob 扫描 *.py / *.java / *.go / *.ts / *.js
  → 读取 pyproject.toml / pom.xml / go.mod / package.json 确认框架与依赖库
  → 确定适用的扫描规则集(httpx/requests/asyncio/SQLAlchemy/redis 等)
  → 识别排除目录(venv/ node_modules/ vendor/ .git/ __pycache__/)

Step 2: 确定扫描范围
  → 全量扫描: 扫描所有代码文件
  → 增量扫描: `git diff --name-only HEAD~1` 获取变更文件,仅扫描变更文件

Step 3: 逐类执行扫描(按 A→T 顺序)
  → 逐文件阅读源码,按规则「识别特征」直接判断是否存在问题
  → 应用排除条件(测试/CLI/脚本/migrations/docs)
  → 检查去重(SCAN-RES-05↔ASYNC-01, SCAN-EXC-02↔LOG-03)
  → 记录: 文件路径 / 行号 / 代码片段 / 违反规则 ID / 严重级别

Step 3.5: 验证测试生成与运行(仅对 24 条行为可验证规则)
  → 筛选 Step 3 命中中属"验证测试生成规则矩阵"清单的规则
  → 对每条疑似问题填充测试模板参数(被测模块/函数/依赖路径/mock 目标/断言阈值)
  → 写入 tests/reliability/verify_{规则ID}_{模块名}_{行号}.py
  → Bash 运行: pytest -xvs tests/reliability/verify_*.py(加 --timeout=30 防挂死)
  → 判定三态:
      测试失败(断言通过,问题复现)→ ✅ 已复现,保留为真问题,脚本留存作回归
      测试通过(问题未复现)       → ❌ 误报,从报告剔除,删除脚本
      无法运行(缺依赖/导入失败/超时)→ ⚠️ 未能验证,降级为主观判定保留
  → 记录每条发现的「验证状态」与「验证测试路径」字段

Step 4: 风险评分与优先级分组
  → 对每条确认问题打分: 概率(L/M/H) × 影响(L/M/H) = 风险评分 1-9(折算 25 分制)
  → 按优先级分组: Quick Win(≤1 人日 + 高影响) / 深度重构(>3 人日) / 排期改进(P2)

Step 5: 生成评审报告
  → 按"报告模板"输出
  → 每条含: 位置 / 代码片段 / 问题描述 / 风险评分 / 优先级 / 验证状态 / 推荐修改方案
  → 写入文件: 可靠性扫描报告_{项目名}_{日期}.md
```

---

## 扫描执行原则

1. **聚焦代码层**: 仅扫描代码可修复的可靠性规则,所有规则均可通过代码变更落地
2. **大模型直接判定**: 逐文件阅读源码,基于规则的「识别特征」与「排除条件」综合判断,不依赖正则匹配或 AST 解析等固定工具流程
3. **应用排除条件**: 测试/CLI/脚本/migrations/docs 目录下的命中降级为 P2 或跳过
4. **去重**: SCAN-RES-05↔ASYNC-01、SCAN-EXC-02↔LOG-03 等重叠规则仅记录一次
5. **记录精确位置**: 每条发现记录 `文件路径:行号`,附代码片段
6. **给出可执行修复**: 每条发现含可直接复制的修改后代码
7. **按严重级别排序**: P0 → P1 → P2,同类内按文件路径排序
8. **测试验证优先于主观判定**: 凡属 24 条行为可验证规则的命中,必须生成测试并运行,不得仅凭阅读判定。测试无法运行时才降级为主观判定并标注 ⚠️。误报必须由测试通过剔除,不得仅凭主观剔除。
9. **风险评分强制**: 每条确认问题必须给出风险评分(概率 × 影响)与修复优先级,未打分的发现不得纳入报告。

## 触发关键词

- **代码扫描**: 「扫描代码」「扫描可靠性代码」「可靠性代码评审」「检查超时代码」「检查重试代码」「检查熔断代码」「检查幂等代码」「reliability code scan」「代码层可靠性」「检查异步代码」「检查线程安全」「检查消息队列」「检查缓存可靠性」「检查优雅关闭」「检查日志规范」「检查舱壁隔离」「检查背压」「检查资源泄漏」「检查降级策略」
- **可靠性通用**: 「可靠性设计」「DFR」「系统可靠性」「弹性设计」「容错设计」「resilience」「高可用」「舱壁」「bulkhead」「背压」「backpressure」「降级」「degrade」
- **架构评审**: 「可靠性架构评审」「上线准入」「弹性架构基线」「可靠性 Must Should May」
