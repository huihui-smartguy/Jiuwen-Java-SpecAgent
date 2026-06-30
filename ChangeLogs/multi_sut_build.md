# EDPA Java Mock 测试环境使用说明

## 一、环境概述

Mock 测试环境包含三个进程：

| 进程 | 端口 | 说明 |
|------|------|------|
| **EDPA-java** | 8190 | 大 Agent 主控，接收 A2A 请求，编排 LLM + Versatile 子 agent |
| **versatile-mock** | 30001 | Versatile 子 agent 的 Mock 服务，模拟业务工作流响应 |
| **前端测试工具** | 3010 | A2A 协议前端测试界面 |

## 二、代码仓依赖

| 代码仓 | 路径 | 说明 |
|--------|------|------|
| https://github.com/Bensinanren/spring-ai-ascend/tree/edpa_java | `agent-store/edp-agent-java` | EDPA Java 版 |
| 同上 | `agent-store/edp-agent-java/mock` | Versatile Mock |
| https://gitcode.com/Technical-AF/tools | `Streaming-Agent-Testing-Evaluation` | A2A 前端测试工具（需曾南志 00616398 授权） |

## 三、环境准备

### 3.1 下载代码仓

```bash
# EDPA Java 版
git clone https://github.com/Bensinanren/spring-ai-ascend.git -b edpa_java

# 前端测试工具（需权限）
git clone https://gitcode.com/Technical-AF/tools.git
```

### 3.2 配置环境变量

1. 复制 `.env.example` 为 `.env`：

```bash
cd agent-store/edp-agent-java
copy .env.example .env
```

2. 修改 `.env` 文件内容：

```bash
# ── LLM 模型密钥（必填） ──
EDP_AGENT_MODEL_API_KEY=xxxxxxxx
EDP_AGENT_MODEL_NAME=xxxxxx
EDP_AGENT_MODEL_BASE_URL=xxxxxx

# ── 场景路径（必填） ──
# scenarios 目录需单独下载，放置于 agent-store/edp-agent-java 下
EDP_AGENT_SCENARIO_HOME=../scenarios/wealth-demo
```

### 3.3 安装 scenarios 目录

`scenarios/wealth-demo` 包含 EDPA 所需的 Skills 配置，代码仓暂未包含，需单独下载附件放置于：

```
agent-store/edp-agent-java/
├── scenarios/
│   └── wealth-demo/
│       ├── scenario-config.yaml
│       ├── skills/
│       │   ├── product_recommend_skill/
│       │   ├── interact_finance_rec_skill/
│       │   ├── product_select_skill/
│       │   └── fund_planning_skill/
│       └── ScriptsConfig.yaml
```

### 3.4 安装依赖

| 进程 | 依赖 |
|------|------|
| EDPA-java | JDK 21+ |
| versatile-mock | Python 3.11+, `pip install fastapi uvicorn python-dotenv loguru` |
| 前端工具 | Node.js, `npm install` |

## 四、启动流程

### 4.1 启动 EDPA-java（端口 8190）

**第一步：一次性编译**

Windows (PowerShell)：

```powershell
cd "D:\PythonCodeProject\edpa_java\spring-ai-ascend-edpa_java"
.\mvnw.cmd -pl agent-store/edp-agent-java/engine -am -DskipTests install
```

Linux (Bash)：

```bash
cd /path/to/spring-ai-ascend-edpa_java
chmod +x mvnw  # 首次运行需赋予执行权限
./mvnw -pl agent-store/edp-agent-java/engine -am -DskipTests install
```

**第二步：启动进程**

Windows (PowerShell)：

```powershell
cd "D:\PythonCodeProject\edpa_java\spring-ai-ascend-edpa_java\agent-store\edp-agent-java\engine"

# 加载 .env 环境变量
Get-Content "..\.env" | ForEach-Object {
  if ($_ -match '^\s*(#|$)') { return }
  if ($_ -match '^([^=]+)=(.*)$') {
    $name  = $matches[1].Trim()
    $value = $matches[2].Trim().Trim('"')
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

# 启动 Spring Boot
..\..\..\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
```

Linux (Bash) —— 从项目根目录执行，后台运行：

```bash
cd /path/to/spring-ai-ascend-edpa_java

# 加载 .env 环境变量
set -a
source agent-store/edp-agent-java/.env
set +a

# 后台启动 Spring Boot，日志输出到文件
nohup ./mvnw -pl agent-store/edp-agent-java/engine spring-boot:run -Dspring-boot.run.profiles=dev > edpa-engine.log 2>&1 &

# 查看启动日志
tail -f edpa-engine.log
```

启动成功日志：

```
Started EdpaApplication in 3.078 seconds
Tomcat started on port 8190 (http)
```

### 4.2 启动 Versatile Mock（端口 30001）

```powershell
cd "D:\PythonCodeProject\edpa_java\spring-ai-ascend-edpa_java\agent-store\edp-agent-java\mock"
python versatile_main.py
```

启动成功输出：

```
Mock Versatile Workflow (versatile_main.py) 启动中...
服务地址: http://127.0.0.1:30001
已加载意图: wealth_recommend, balance_query, transfer_round1, ...
```

### 4.3 启动前端测试工具（端口 3010）

```powershell
cd Streaming-Agent-Testing-Evaluation
npm install
npm start
```

浏览器打开：http://127.0.0.1:3010

## 五、前端配置

### 5.1 环境配置

1. 打开 http://127.0.0.1:3010
2. 点击 **"环境配置"**
3. 关键设置：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| **Base URL** | `http://127.0.0.1:8190` | 指向 EDPA-java |
| **requestPreset** | `planning_path` | A2A 协议路径模板 |
| **projectId** | 按实际配置 | 项目 ID |
| **agentId** | `edp-agent` | Agent ID |

4. 保存配置

### 5.2 测试对话

在聊天框输入测试语句：

| 测试语句 | 触发 Mock 意图 | 说明 |
|----------|---------------|------|
| `推荐理财产品` | `wealth_recommend` | 返回 Mock 硬编码产品列表 |
| `查余额` | `balance_query` | 返回模拟余额数据 |
| `转账100元` | `transfer_round1` | 模拟转账流程 |

## 六、数据流转示意

```
前端 (3010)
    │  A2A JSON-RPC 请求
    │  {"message": {"parts": [{"text": "推荐理财产品"}]}}
    ▼
EDPA-java (8190)
    │  LLM 编排 → call_versatile 工具
    │  POST http://127.0.0.1:30001/v1/0/agent-manager/workflows/...
    ▼
Versatile Mock (30001)
    │  意图匹配 → wealth_recommend.json
    │  SSE 流式响应
    ▼
EDPA-java
    │  解析 SSE → 格式化响应
    ▼
前端
    │  展示产品列表表格
```

## 七、常见问题

### Q1: 启动报错 "TodolistSteps contains placeholder step"

**原因**：`scenarios/wealth-demo` 目录不存在

**解决**：下载 scenarios 附件，放置于 `agent-store/edp-agent-java/scenarios/`

### Q2: LLM 调用返回 404

**原因**：`EDP_AGENT_MODEL_BASE_URL` 配置错误

**解决**：检查 `.env` 中模型 API 地址是否正确

### Q3: Versatile 调用失败

**原因**：Mock 服务未启动或端口不匹配

**解决**：
- 确认 Mock 进程已启动（端口 30001）
- 检查 `edp-agent.yaml` 中 `versatile.url` 是否为 `http://localhost:30001/...`

### Q4: 前端无法连接 EDPA

**原因**：Base URL 配置错误

**解决**：前端配置中 Base URL 设置为 `http://127.0.0.1:8190`

## 八、端口汇总

| 服务 | 默认端口 | 环境变量覆盖 |
|------|---------|-------------|
| EDPA-java | 8190 | `SERVER_PORT` |
| Versatile Mock | 30001 | `MOCK_SERVER_PORT` |
| 前端工具 | 3010 | npm 配置 |

## 九、停止服务

```powershell
# 查看 Java 进程
Get-Process -Name java

# 停止指定进程（PID 替换为实际值）
Stop-Process -Id <PID>

# 或直接 Ctrl+C 停止各进程
``

---

**文档版本**：v1.0  
**更新日期**：2026-06-27  
**维护人**：郝坤 00559590
