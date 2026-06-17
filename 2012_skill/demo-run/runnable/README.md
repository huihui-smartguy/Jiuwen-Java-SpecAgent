# 黑盒 A2A 测试套件（server-runnable）

针对 `spring-ai-ascend/agent-runtime` 的 **黑盒 HTTP + JSON-RPC** A2A 协议
（`POST /a2a` + `GET /.well-known/agent-card.json`）的 12 条 pytest 用例。
全部通过 httpx 黑盒客户端观测，**不导入任何 Java 内部类**。

## 目录内容

| 文件 | 说明 |
|------|------|
| `a2a_client.py` | 黑盒 A2A 客户端 + 判据常量（verbatim 复用） |
| `conftest.py` | pytest fixtures（`base_url` / `a2a_client`）+ 注册 `a2a`、`sse` 标记 |
| `test_tc_a2a_001.py` … `test_tc_a2a_012.py` | 12 条用例（TC-A2A-001 ~ 012） |
| `requirements.txt` | `httpx>=0.27`、`pytest>=7` |
| `run.sh` | 一键运行脚本（探测 base url → 装依赖 → 跑测试 → 出报告） |

## 用例覆盖

| 文件 | CaseID | 行为 |
|------|--------|------|
| 001 | TC-A2A-001 | SendMessage 同步 → COMPLETED 完整 Task |
| 002 | TC-A2A-002 | SendStreamingMessage SSE 序列至终态 COMPLETED（`sse`） |
| 003 | TC-A2A-003 | GetTask 与原任务一致 |
| 004 | TC-A2A-004 | Agent Card 发现 name/capabilities/skills/endpoint |
| 005 | TC-A2A-005 | 非法 JSON → parse error -32700 |
| 006 | TC-A2A-006 | 未知 method → method-not-found -32601 |
| 007 | TC-A2A-007 | CancelTask 执行中 → CANCELED |
| 008 | TC-A2A-008 | 终态再取消 → 标准 error（负向） |
| 009 | TC-A2A-009 | SubscribeToTask 断线重连续收至终态（`sse`） |
| 010 | TC-A2A-010 | ListTasks 含目标 task |
| 011 | TC-A2A-011 | 发现即调用（Card endpoint → SendMessage） |
| 012 | TC-A2A-012 | GetTask 不存在 taskId → 标准 error（边界） |

---

## 服务器端运行步骤（在 1.92.123.95 上）

### 1. 把 `runnable/` 拷贝到服务器

二选一：

```bash
# 方式 A：git（若仓库已 push 到可访问的远端）
git clone <your-repo-url> && cd <repo>/2012_skill/demo-run/runnable

# 方式 B：scp（从本地推送整个目录到服务器）
scp -r ./runnable <user>@1.92.123.95:~/a2a-runnable
# 然后在服务器上:
#   ssh <user>@1.92.123.95
#   cd ~/a2a-runnable
```

> 安全提示：使用 SSH 密钥登录，**不要**在命令行或脚本里写明文口令。

### 2. 确认 agent-runtime 已在某端口运行

```bash
# 默认 8080；按实际部署端口替换
curl -s http://localhost:8080/.well-known/agent-card.json | head -c 400
```

- 返回 AgentCard JSON（含 `name`/`capabilities`/`skills`）即表示服务就绪。
- 若端口不是 8080，记下实际端口（脚本会探测 `8080 8081 8888 9090 18080`）。

### 3. 运行测试

```bash
bash run.sh
```

`run.sh` 会：
1. 若已 `export A2A_BASE_URL` 则直接使用；否则探测候选端口取首个返回
   `agent-card.json` HTTP 200 的 base url 并打印。
2. 优先创建 `.venv` 并 `pip install -r requirements.txt`；若无外网/ pip 失败，
   自动回退到系统已安装的 `httpx`/`pytest`。
3. 运行 `pytest -v`（输出 tee 到 `results.txt`），并生成 `results.junit.xml`。
   **测试失败不会中断脚本**（用于暴露真实服务的 shape 不一致）。
4. 末尾打印 passed/failed/errored 计数与 `results.txt` 路径。

如端口非候选列表，或探测失败，手动指定后再跑：

```bash
export A2A_BASE_URL=http://localhost:<port>
bash run.sh
```

### 4. 回收结果

把 `results.txt`（必要时附 `results.junit.xml`）内容贴回，以便分析失败/字段
形状不一致（例如 SSE 事件的 kind 字段位置、ListTasks 返回结构等）。

---

## 备注：容差设计

部分断言对真实服务可能的字段形状做了**有限容差**（仍保留 ≥1 个 L2 值/语义断言）：

- **SSE 事件 kind**（002/007/009）：跨 `kind`/`type`/`eventType` 读取，并按载荷
  形状（含 `artifact` / `status` / `task`）推断 `TaskAccepted`/`ArtifactUpdate`/
  `TaskStatusUpdate`，以兼容不同字段位置。
- **state 前缀**（003/007/009/010/011）：用 `normalize_state()` 容忍
  `COMPLETED` 与 `TASK_STATE_COMPLETED` 两种写法。
- **ListTasks 结果**（010）：兼容 `result` 为 `list` 或 `{"tasks":[...]}`。
- **Agent Card 端点**（004/011）：兼容 `url` 或 `endpoint` 字段。

这些容差只放宽“字段位置/写法”，不放宽核心判据（错误码、终态、id 回带）。
失败信息均写明“期望 vs 实际”，便于一次真实运行就定位 shape 差异。
