# 以studio 内置记忆能力为基线 vs EXTERNAL 对接路径：功能对等性分析



## 1. 记忆提取（写入）

### 1.1 提取触发与调度

| # | BUILTIN 能力（基线） | EXTERNAL 实现 | 对等性 | 差距说明 |
|---|---------------------|---------------|--------|----------|
| 1 | 轮次累积触发：Redis 缓存对话轮次，达 `extract_max_turns` 触发 `_extract_memory` | ✅ 共享逻辑：`async_add_chat_turn` 在 dispatch 前完成累积，两条路径共用 | ✅ | 调度逻辑在 `_extract_memory` 之前，不区分 backend_type |
| 2 | 延迟提取：未达阈值时调度 `_extract_memory_delay`（`extract_time_windows` 分钟后） | ✅ 共享逻辑：同上 | ✅ | 同上 |
| 3 | 提取频率配置：IR `extract_config.maxChatTurn/timeWindow`（前端 `conversation_round`/`time_span`） | ✅ 共享逻辑：`_convert_memory_extract_config` 在 dispatch 前读取 | ✅ | 频率配置由共享的 `UserProfileMemoryExtractorConfig` 消费，两条路径都生效 |

### 1.2 提取执行

| # | BUILTIN 能力（基线） | EXTERNAL 实现 | 对等性 | 差距说明 |
|---|---------------------|---------------|--------|----------|
| 4 | 批量写入：`ltm.add_messages(messages, agent_config, ...)` 一次性传入完整对话结构 | 逐条 `client.add(content, space, user, infer=True)` | ⚠️ | BUILTIN 保留完整对话结构批量传入 LLM；EXTERNAL 逐条 add + `infer=True` 触发服务端逐条提取。消息角色通过 content 前缀 `[user]`/`[assistant]` 区分，但每条独立提取，丢失跨消息上下文 |
| 5 | 策略类型开关：IR `strategies` → `AgentMemoryConfig.enable_user_profile/enable_semantic_memory/enable_episodic_memory` | ❌ 未使用：EXTERNAL 分支不读取 strategies | ❌ | 前端勾选的策略类型（semantic_memory/user_profile）在 EXTERNAL 路径被忽略。`infer=True` 由服务端全自动决定提取策略，无法按前端配置开关 |
| 6 | 自定义提取 prompt：`MemoryScopeConfig.user_profile_definition/semantic_memory_definition/episodic_memory_definition` | ❌ 未传递：EXTERNAL 分支不写入 scope config | ❌ | 前端配置的自定义 prompt 在 EXTERNAL 路径无消费方。BUILTIN 通过 `_ensure_scope_config` 首次提取时写入 per-scope prompt；EXTERNAL 无此机制 |
| 7 | scope config 首次初始化：`_ensure_scope_config(scope_id, ir_data)` 构建并注册 `MemoryScopeConfig` | ❌ 无：EXTERNAL 不调 `_ensure_scope_config` | ❌ | BUILTIN 在首次提取时用 IR strategies + 默认模型构建 scope config；EXTERNAL 跳过此步，直接 `add(infer=True)` |
| 8 | 角色区分：`UserMessage`/`AssistantMessage` 类型对象 | content 前缀 `[user]`/`[assistant]` + `system_metadata.role` | ✅ | 两种方式均可区分角色 |
| 9 | 会话上下文：`session_id=conversation_id` | `scope.session=conversation_id` | ✅ | 两种方式均传递会话标识 |
| 10 | 分布式锁：`DistributedLock(kv_store, "user/{user_id}")` 防并发写入 | ❌ 无 | ⚠️ | EXTERNAL 无显式锁，并发安全依赖 2.0 服务端。单实例下可接受，多 runtime 实例并发写同一 user 时可能有竞态 |

---

## 2. 记忆检索（读取）

### 2.1 检索能力

| # | BUILTIN 能力（基线） | EXTERNAL 实现 | 对等性 | 差距说明 |
|---|---------------------|---------------|--------|----------|
| 1 | 语义记忆检索：`ltm.search_user_mem(query, num, user_id, scope_id, threshold=0.3)` | `ExternalMemoryClient.search_memory` → `POST /v1/search` | ✅ | 两条路径均支持向量语义检索 |
| 2 | 历史摘要检索：`ltm.search_user_history_summary(query, num, user_id, scope_id)` —— 独立 SUMMARY 类型 | ❌ 无对应：EXTERNAL 仅调 `search_memory`，无摘要检索 | ❌ | BUILTIN 有独立的 SUMMARY 记忆类型和专用检索方法；EXTERNAL 路径完全没有此能力。检索结果中缺少 `<history_summary>` 标签内容 |

### 2.2 检索参数

| # | BUILTIN 能力（基线） | EXTERNAL 实现 | 对等性 | 差距说明 |
|---|---------------------|---------------|--------|----------|
| 3 | 记忆条数 `mem_num`（默认 20） | `top_k`（Java 侧默认 10） | ✅ | 参数名和默认值不同。 |
| 4 | 摘要条数 `summary_num`（默认 5） | N/A | ❌ | EXTERNAL 无摘要检索，`summary_num` 无消费方 |
| 5 | 相似度阈值 `threshold=0.3` per-call 透传 | ❌ 不进入请求体 | ❌ | BUILTIN 的 `search_user_mem` 接受 per-call threshold；EXTERNAL 的 `/v1/search` 无 per-request threshold 参数（2.0 仅实例级 `min_score`/`min_score_ratio` 配置） |

### 2.3 Prompt 注入

| # | BUILTIN 能力（基线） | EXTERNAL 实现 | 对等性 | 差距说明 |
|---|---------------------|---------------|--------|----------|
| 6 | `MEMORY_USAGE_PROMPT` 模板 | ✅ 共享模板 | ✅ | 两条路径共用同一 prompt 模板 |
| 7 | `<mem>` 标签包裹语义记忆 | ✅ EXTERNAL 检索结果同样包裹 `<mem>` | ✅ | |
| 8 | `<history_summary>` 标签包裹历史摘要 | ❌ 无内容 | ❌ | EXTERNAL 无摘要检索，`<history_summary>` 标签为空 |

---

## 3. 记忆项管理（CRUD）—— manager 调用

问题有3处

1. 

`MemoryItemManagementService` 每个方法按 `memoryBackendType` 分支：BUILTIN 走 Feign → runtime 内部 API，EXTERNAL 直连 2.0 HTTP。

| # | 操作 | BUILTIN（Feign → runtime internal） | EXTERNAL（直连 2.0） | 对等性 | 差距说明 |
|---|------|--------------------------------------|---------------------|--------|----------|
| 1 | 列表 | `agentRuntimeClient.listMemories` → `ltm.get_user_mem_by_page`（分页 + MemoryType 过滤） | `POST /v1/list`（scope + offset/limit） | ✅ | 两条路径均支持分页列表 |
| 2 | 搜索 | `agentRuntimeClient.searchMemories`（query + top_k + threshold） | `POST /v1/search`（query + top_k + disclosure:l2） | ⚠️ | BUILTIN 传 `threshold=0.3`；EXTERNAL 不传 threshold。功能等价但精度控制不同 |
| 3 | 批量删除 | `agentRuntimeClient.batchDeleteMemories` → `ltm.delete_mem_by_id` 逐条 | `POST /v1/delete`（unit_ids + mode:"purge"） | ✅ | |
| 4 | 清空用户记忆 | `agentRuntimeClient.clearUserMemories` → `ltm.delete_mem_by_user_id` | 分页 list → purge 循环（page 200, max 1000 轮） | ✅ | EXTERNAL 用循环模拟，功能等价 |
| 5 | **编辑记忆内容** | `agentRuntimeClient.updateMemory` → `ltm.update_mem_by_id`（原地覆盖） | ❌ **无 EXTERNAL 分支** | ❌ | `updateMemoryItems` 方法只有 BUILTIN 分支，未实现 EXTERNAL。**2.0 有 `POST /v1/update` API（支持 SUPERSEDE + OVERWRITE），需在 Java 侧补充 EXTERNAL 分支调用** |
| 6 | 按 MemoryType 过滤 | `memory_type` 参数 → `MemoryType` 枚举过滤 | `memory_types` 参数 → `tier` 过滤 | ❌ | 枚举映射：`user_profile`→`semantic`?/`core`?、`semantic_memory`→`semantic`、`episodic_memory`→`episodic`、`summary`→无对应。映射关系需确认 |

---

## 4. 记忆库管理 —— manager 调用

| # | 操作 | BUILTIN | EXTERNAL | 对等性 | 差距说明 |
|---|------|---------|----------|--------|----------|
| 1 | 创建记忆库 | 后端类型无关（同一代码路径） | 同 | ✅ | `createMemoryRepo` 不区分 backend_type |
| 2 | 编辑记忆库 | 同上 | 同 | ✅ | `modifyMemoryRepo` 同上 |
| 3 | 列表记忆库 | 同上 | 同 | ✅ | `listMemoryRepositories` 同上 |
| 4 | 查看详情 | 同上（含 scopeModelConfig） | 同 | ✅ | `showMemoryRepo` 同上 |
| 5 | 删除记忆库数据 | `agentRuntimeClient.deleteMemoryRepoData(memoryRepoId)` → `ltm.delete_mem_by_scope` + `ltm.delete_scope_config` | `memoryServiceInstanceService.deleteMemByScope(instanceId, scopeId)` → 分页 list→purge 循环 | ⚠️ | BUILTIN 一步删除 scope + 清理 scope_config；EXTERNAL 用循环模拟数据删除，但**不清理 scope_config**（2.0 无 `delete_scope_config` 概念） |
| 6 | 删除时解绑 Agent | ✅ 同一逻辑 | ✅ 同一逻辑 | ✅ | `deleteMemoryRepo` 中 Agent 解绑不区分 backend_type |
| 7 | 删除时解绑 Workflow | ✅ 同一逻辑 | ✅ 同一逻辑 | ✅ | DSL `memory_config` 清理不区分 backend_type |

---

## 5. 策略配置消费

| # | BUILTIN 能力（基线） | EXTERNAL 实现 | 对等性 | 差距说明 |
|---|---------------------|---------------|--------|----------|
| 1 | 前端策略勾选（semantic_memory / user_profile）→ IR `strategies` | ❌ EXTERNAL 分支不读取 strategies | ❌ | 前端配置的勾选状态对 EXTERNAL 记忆库无效——提取策略由服务端 `infer=True` 全自动决定 |
| 2 | 前端自定义 prompt → IR `strategies[].prompt` → `MemoryScopeConfig.*_definition` | ❌ EXTERNAL 分支不传递 prompt | ❌ | 前端编辑的自定义提取 prompt 对 EXTERNAL 记忆库无效 |
| 3 | `scope_model_config` 字段 | ❌ `pushScopeConfig` 空实现 | ❌ | 字段存 DB + show 返回，但既不推送到实例也不进 IR。对 BUILTIN 也已失效（注释说明 2.0 不支持 set_scope_config） |
| 4 | 提取频率 `conversation_round`/`time_span` → IR `extract_config` | ✅ 共享逻辑：`async_add_chat_turn` 在 dispatch 前消费 | ✅ | 频率配置对两条路径均生效 |

---

## 6. 安全与凭证

| # | BUILTIN 能力（基线） | EXTERNAL 实现 | 对等性 | 差距说明 |
|---|---------------------|---------------|--------|----------|
| 1 | 认证 | 无（进程内调用） | Bearer api_key（`Authorization: Bearer {api_key}`） | ✅ | EXTERNAL 额外增加认证，是增量能力 |
| 2 | 凭证存储 | N/A | DB 加密（`encryptionAdapter.encrypt`）+ OBS 文件（`memory-auth/{id}.json`） | ✅ | EXTERNAL 独有的凭证管理链路，功能完整 |
| 3 | 凭证解析 | N/A | runtime `instance_credential_resolver` 惰性从 OBS 取 | ✅ | |
| 4 | 健康检查 | N/A | `POST .../health` → `GET {baseUrl}/healthz` + Bearer | ✅ | |
| 5 | TLS 配置 | N/A | `MEMORY_VERIFY_SSL` 环境变量 | ✅ | |
| 6 | 使用中实例不可删除 | N/A | `countReposByInstanceId` 守卫 | ✅ | |

---

---

## 7. 差距汇总

### ❌ 缺失项（EXTERNAL 路径未覆盖 BUILTIN 能力）

| # | 缺失能力 | 影响层 | 严重度 | 根因 | 修复方向 |
|---|----------|--------|--------|------|----------|
| G1 | **历史摘要检索** | runtime 检索 | 🔴 高 | 2.0 无 SUMMARY tier + 无独立摘要检索端点；EXTERNAL 检索只调 `search_memory` | 2.0 补充摘要 tier 或 studio 侧自行维护摘要索引 |
| G2 | **策略类型开关** | runtime 提取 | 🟡 中 | EXTERNAL 分支不读取 IR `strategies`，`infer=True` 全自动决定 | 2.0 侧支持 per-scope 提取策略配置，或 EXTERNAL 调用时传递策略参数 |
| G3 | **自定义提取 prompt** | runtime 提取 | 🟡 中 | EXTERNAL 分支不传递 prompt，scope config 机制缺失 | 2.0 侧支持 per-scope prompt 配置（当前仅实例级 PromptRegistry），或 studio 通过 2.0 的 `admin_set` 配置 |
| G4 | **scope config 首次初始化** | runtime 提取 | 🟡 中 | EXTERNAL 不调 `_ensure_scope_config` | 与 G2/G3 关联，需 2.0 侧支持 per-scope 配置后补实现 |
| G5 | **编辑记忆内容（manager）** | Java 后端 | 🔴 高 | `updateMemoryItems` 无 EXTERNAL 分支 | **2.0 有 `POST /v1/update` API**，需在 `MemoryItemManagementService.updateMemoryItems` 补充 EXTERNAL 分支调用 `/v1/update` |

### ⚠️ 部分对等项

| # | 能力 | 差异说明 |
|---|------|----------|
| P1 | 批量 vs 逐条写入 | BUILTIN `add_messages` 批量保留完整对话结构；EXTERNAL 逐条 `add` 丢失跨消息上下文 |
| P2 | mem_num → top_k | 参数名和默认值不同（20 vs 10），需确认透传 |
| P3 | MemoryType → tier 映射 | 枚举体系不同，需建立映射关系（user_profile/semantic_memory/episodic_memory/summary → working/core/episodic/semantic/procedural/archival） |
| P4 | 搜索 threshold | BUILTIN per-call 透传 0.3；EXTERNAL 不传 |
| P5 | 删除 scope_config | BUILTIN 删除记忆库时同时清理 `delete_scope_config`；EXTERNAL 无此步（2.0 无 scope_config 概念） |
| P6 | 批量写入部分失败语义 | BUILTIN 整体返回；EXTERNAL 逐条标记 |
| P7 | 分布式锁 | BUILTIN 有锁防并发；EXTERNAL 无锁，依赖服务端 |

### ✅ 已对等项（14 项）

提取触发与调度（轮次累积、延迟触发、提取频率配置）、角色区分、会话上下文、语义检索、MEMORY_USAGE_PROMPT 模板、`<mem>` 标签、记忆库 CRUD（创建/编辑/列表/详情/解绑）、列表记忆项、批量删除、清空用户记忆、凭证管理、健康检查、TLS 配置、降级跳过、使用中实例守卫。

