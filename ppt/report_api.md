# 测试报告 API 接口文档

> 模块：`testrun/report/`　　挂载方式：`report.report_api.register_routes(app)`（已在 `main.py` 挂载）
> Base URL：`http://<host>:<port>`（默认 `http://0.0.0.0:3000`）
> 数据格式：请求/响应均为 `application/json`（下载接口除外）
> 版本：v1.0　　日期：2026-07-14

---

## 目录
- [1. 生成报告](#1-生成报告)
- [2. 报告列表](#2-报告列表)
- [3. 报告详情](#3-报告详情)
- [4. 下载报告](#4-下载报告)
- [5. 删除报告](#5-删除报告)
- [6. 趋势查询](#6-趋势查询)
- [7. 数据结构说明](#7-数据结构说明)
- [8. 通用约定](#8-通用约定)

---

## 1. 生成报告

根据「测试批次版本 + 范围 + 时间窗」采集执行结果，生成并持久化一份自包含快照报告。

```
POST /api/reports
Content-Type: application/json
```

### 请求参数（body）

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `software_version` | string | **是** | **被测软件版本/构建号**，由前端传入（如 `AgentPlatform 3.5.2 (build 20260712.1234)`）；同时作为执行记录的筛选条件（对应 `t_script_execution.script_version`） |
| `scope` | object | 是 | 测试范围，见 [scope 结构](#71-scope测试范围) |
| `title` | string | 否 | 报告标题；**缺省时自动按 `[软件版本 ]产品 场景 测试报告` 生成**（如 `AgentPlatform 3.5.2 高码java 场景用例 测试报告`） |
| `time_window` | array | 否 | `[起, 止]` ISO 时间字符串，按用例 `started_at` 过滤；缺省或 `null` 表示不限 |
| `created_by` | string | 否 | 生成人，默认 `system` |

### 请求示例

```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "software_version": "AgentPlatform 3.5.2 (build 20260712.1234)",
    "scope": {
      "product": "高码java",
      "scenes": ["场景用例"],
      "features": [
        {"name": "工作流管理", "feature_version": "v2.3.1"},
        {"name": "MCP服务"}
      ],
      "levels": ["L0", "L1", "L2"]
    },
    "time_window": ["2026-07-14T00:00:00", "2026-07-14T23:59:59"],
    "title": "AgentPlatform 3.5.2 高码java 场景用例测试报告",
    "created_by": "zhangsan"
  }'
```

### 成功响应 `200`

```json
{
  "success": true,
  "report_id": "3f2a8c1e-9b4d-4e7a-8c21-0a1b2c3d4e5f"
}
```

### 失败响应

| 状态码 | 场景 | 响应 |
|---|---|---|
| `400` | 缺少 `scope` | `{"success": false, "message": "缺少必填参数：scope"}` |
| `400` | `scope` 非对象 | `{"success": false, "message": "参数 scope 必须为对象"}` |
| `400` | 缺少 `software_version` | `{"success": false, "message": "缺少必填参数：software_version（被测软件版本）"}` |
| `500` | 生成异常 | `{"success": false, "message": "生成报告失败: <原因>"}` |

> `title` 缺省时，报告标题自动生成规则：`{软件版本 }{产品} {场景1、场景2…} 测试报告`
> （无场景则用"全部场景"，无产品则用"未知产品"）。

---

## 2. 报告列表

分页查询报告（精简信息，**不含** `result_data` 明细大字段）。

```
GET /api/reports
```

### 查询参数（query）

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `software_version` | string | 否 | - | 按被测软件版本前缀模糊筛选（LIKE `xxx%`） |
| `product` | string | 否 | - | 按产品名称筛选（scope JSON 字段） |
| `scene` | string | 否 | - | 按场景名称筛选（scope JSON 字段） |
| `feature` | string | 否 | - | 按特性名称筛选（scope JSON 字段） |
| `from` | string | 否 | - | 创建时间起始（ISO datetime，如 `2026-07-01T00:00:00`） |
| `to` | string | 否 | - | 创建时间截止（ISO datetime，如 `2026-07-15T23:59:59`） |
| `limit` | int | 否 | 50 | 每页条数，范围 `1~200`（超出自动截断） |
| `offset` | int | 否 | 0 | 偏移量 |

### 请求示例

```bash
curl "http://localhost:3000/api/reports?product=%E9%AB%98%E7%A0%81java&scene=%E5%9C%BA%E6%99%AF%E7%94%A8%E4%BE%8B&software_version=AgentPlatform%203.5.2&limit=20&offset=0"
```

### 成功响应 `200`

```json
{
  "success": true,
  "total": 2,
  "reports": [
    {
      "id": "3f2a8c1e-9b4d-4e7a-8c21-0a1b2c3d4e5f",
      "title": "AgentPlatform 3.5.2 高码java 场景用例测试报告",
      "software_version": "AgentPlatform 3.5.2 (build 20260712.1234)",
      "summary": {
        "total": 42, "pass": 38, "failed": 3, "skipped": 1,
        "success_rate": 92.68, "total_duration_seconds": 620
      },
      "conclusion": {"passed": false, "verdict": "不通过", "reason": "未通过门禁：整体成功率≥95%"},
      "created_at": "2026-07-14T10:16:31",
      "created_by": "zhangsan"
    }
  ]
}
```

### 失败响应

| 状态码 | 场景 | 响应 |
|---|---|---|
| `400` | `limit`/`offset` 非整数或 `days` 超出范围 | `{"success": false, "message": "参数 limit / offset / days 不合法"}` |
| `500` | 查询异常 | `{"success": false, "message": "查询报告列表失败: <原因>"}` |

---

## 3. 报告详情

查询单份报告完整内容（含脚本级明细 `result_data`），前端展示主用。

```
GET /api/reports/<report_id>
```

### 路径参数

| 参数 | 类型 | 说明 |
|---|---|---|
| `report_id` | string | 报告 UUID |

### 请求示例

```bash
curl "http://localhost:3000/api/reports/3f2a8c1e-9b4d-4e7a-8c21-0a1b2c3d4e5f"
```

### 成功响应 `200`

```json
{
  "success": true,
  "report": {
    "id": "3f2a8c1e-9b4d-4e7a-8c21-0a1b2c3d4e5f",
    "title": "AgentPlatform 3.5.2 高码java 场景用例测试报告",
    "software_version": "AgentPlatform 3.5.2 (build 20260712.1234)",
    "scope": {
      "product": "高码java",
      "scenes": ["场景用例"],
      "features": [{"name": "工作流管理", "feature_version": "v2.3.1"}, {"name": "MCP服务"}],
      "levels": ["L0", "L1", "L2"],
      "total_scripts": 45
    },
    "environment": {
      "execute_mode": "pytest",
      "env_vars": {"A2A_BASE_URL": "http://1.92.123.95:8190", "A2A_TRACE_DIR": "./trace"},
      "sut": {
        "software_version": "AgentPlatform 3.5.2 (build 20260712.1234)",
        "base_url": "http://1.92.123.95:8190",
        "server_info": "1.92.123.95:8190"
      },
      "test_runner": {
        "os": "Windows-10-10.0.26100-SP0",
        "python_version": "3.10.9",
        "pytest_version": "8.3.3",
        "exec_host": "SZX-DEV-01"
      }
    },
    "summary": {
      "total": 42, "pass": 38, "failed": 3, "skipped": 1, "running": 0,
      "success_rate": 92.68, "total_duration_seconds": 620,
      "by_feature": [
        {"feature": "工作流管理", "total": 12, "pass": 12, "failed": 0, "skipped": 0, "success_rate": 100.0},
        {"feature": "MCP服务", "total": 10, "pass": 7, "failed": 3, "skipped": 0, "success_rate": 70.0}
      ]
    },
    "conclusion": {
      "passed": false,
      "verdict": "不通过",
      "gates": [
        {"name": "L0用例100%通过", "required": "100%", "actual": "100%", "passed": true},
        {"name": "整体成功率≥95%", "required": "95%", "actual": "92.68%", "passed": false},
        {"name": "无高危失败", "required": "无高危", "actual": "存在高危", "passed": false}
      ],
      "reason": "未通过门禁：整体成功率≥95%、无高危失败"
    },
    "risks": [
      {
        "level": "high",
        "category": "服务端错误",
        "title": "服务端错误（3 例失败）",
        "count": 3,
        "evidence": ["test_mcp020_sse_deploy.py: AssertionError: status 500"],
        "recommendation": "被测接口返回 5xx，优先定位服务端缺陷，可能阻塞发布"
      }
    ],
    "result_data": [
      {
        "script_id": "uuid-...",
        "filename": "test_mcp020_sse_deploy.py",
        "level": "L1",
        "scene": "场景用例",
        "feature": "MCP服务",
        "execute_mode": "pytest",
        "status": "failed",
        "pytest_status": "FAILED",
        "duration_seconds": 12,
        "started_at": "2026-07-14T09:00:00",
        "completed_at": "2026-07-14T09:00:12",
        "error_message": "AssertionError: status 500",
        "failure_detail": "httpx.ConnectError: [Errno 111] Connection refused\n...(有界栈)",
        "failure_source": "log_file",
        "log_download_url": "/api/download/高码java_场景用例_MCP服务_20260714/execution_20260714_101631.log",
        "task_id": "task-8b04c0a7"
      }
    ],
    "time_start": "2026-07-14T00:00:00",
    "time_end": "2026-07-14T23:59:59",
    "created_at": "2026-07-14T10:16:31",
    "created_by": "zhangsan"
  }
}
```

### 失败响应

| 状态码 | 场景 | 响应 |
|---|---|---|
| `404` | 报告不存在 | `{"success": false, "message": "报告不存在"}` |
| `500` | 查询异常 | `{"success": false, "message": "查询报告详情失败: <原因>"}` |

---

## 4. 下载报告

下载报告的 Markdown 或 HTML 文件（以附件形式返回）。

```
GET /api/reports/<report_id>/download?format=md|html
```

### 参数

| 参数 | 位置 | 类型 | 默认 | 说明 |
|---|---|---|---|---|
| `report_id` | path | string | - | 报告 UUID |
| `format` | query | string | `html` | `md`=Markdown，`html`=独立 HTML |

### 请求示例

```bash
# 下载 HTML
curl -OJ "http://localhost:3000/api/reports/3f2a8c1e.../download?format=html"

# 下载 Markdown
curl -OJ "http://localhost:3000/api/reports/3f2a8c1e.../download?format=md"
```

### 成功响应 `200`

- `format=md`：`Content-Type: text/markdown; charset=utf-8`，`Content-Disposition: attachment; filename=report_<id>.md`
- `format=html`：`Content-Type: text/html; charset=utf-8`，`Content-Disposition: attachment; filename=report_<id>.html`

响应体为报告文件内容（五段式：测试环境 / 测试内容 / 测试结果 / 测试结论 / 风险与建议）。

### 失败响应

| 状态码 | 场景 |
|---|---|
| `404` | 报告不存在 |
| `500` | 渲染异常 |

> 报告内失败用例的完整日志可通过明细项 `log_download_url` 经 `GET /api/download/<path>` 下载。

---

## 5. 删除报告

```
DELETE /api/reports/<report_id>
```

### 请求示例

```bash
curl -X DELETE "http://localhost:3000/api/reports/3f2a8c1e-9b4d-4e7a-8c21-0a1b2c3d4e5f"
```

### 成功响应 `200`

```json
{"success": true, "message": "报告已删除"}
```

### 失败响应

| 状态码 | 场景 | 响应 |
|---|---|---|
| `404` | 报告不存在 | `{"success": false, "message": "报告不存在"}` |
| `500` | 删除异常 | `{"success": false, "message": "删除报告失败: <原因>"}` |

---

## 6. 趋势查询

查询指定时间窗口内每日通过率趋势，用于前端绘制趋势图。

```
GET /api/reports/trend
```

### 查询参数（query）

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `product` | string | 否 | - | 按产品名称筛选（scope JSON 字段） |
| `scene` | string | 否 | - | 按场景名称筛选（scope JSON 字段） |
| `feature` | string | 否 | - | 按特性名称筛选（scope JSON 字段） |
| `software_version` | string | 否 | - | 按被测软件版本前缀模糊筛选（LIKE `xxx%`） |
| `days` | int | 否 | 7 | 回溯天数，范围 `1~90`（超出自动截断） |
| `aggregation` | string | 否 | `latest` | 聚合策略：`latest`=每日取最新一份报告；`avg`=每日所有报告取均值 |

### 请求示例

```bash
curl "http://localhost:3000/api/reports/trend?product=%E9%AB%98%E7%A0%81java&scene=%E5%9C%BA%E6%99%AF%E7%94%A8%E4%BE%8B&days=14&aggregation=latest"
```

### 成功响应 `200`

```json
{
  "success": true,
  "trend": [
    {
      "date": "2026-07-14",
      "report_count": 2,
      "total_scripts": 38,
      "pass": 35,
      "failed": 2,
      "skipped": 1,
      "success_rate": 92.1,
      "total_duration_seconds": 620
    },
    {
      "date": "2026-07-15",
      "report_count": 1,
      "total_scripts": 40,
      "pass": 38,
      "failed": 1,
      "skipped": 1,
      "success_rate": 95.0,
      "total_duration_seconds": 580
    }
  ]
}
```

> `total_scripts` 为 scope 中登记的脚本总数（来自 `t_script`），区别于 `summary.total`（实际执行数），
> 两者差值揭示未被测试覆盖的脚本。

### 失败响应

| 状态码 | 场景 | 响应 |
|---|---|---|
| `400` | `days` 超出范围或参数类型错误 | `{"success": false, "message": "参数 days 不合法（1~90）"}` |
| `500` | 查询异常 | `{"success": false, "message": "查询趋势数据失败: <原因>"}` |

---

## 7. 数据结构说明

### 7.1 scope（测试范围）

| 字段 | 类型 | 说明 |
|---|---|---|
| `product` | string | 产品名称 |
| `scenes` | string[] | 场景名称列表 |
| `features` | array | 特性列表；元素可为字符串或 `{"name": ..., "feature_version": ...}` 对象；`feature_version` 可选 |
| `levels` | string[] | 用例等级过滤（`L0`~`L4`）；缺省表示不按等级过滤 |
| `total_scripts` | int | scope 内登记的脚本总数（来自 `t_script`），**由后端在生成报告时自动补全**；区别于 `summary.total`（实际执行数），差值揭示未被测试覆盖的脚本 |

> **scope 自动补全**：报告生成时，后端会根据实际执行结果自动补全 `features`（从执行结果中提取，保留前端传入的 `feature_version`）、
> `levels`（从执行结果中提取），以及 `total_scripts`（从 `t_script` 查询 scope 内登记的脚本数）。
> 因此报告中保存的 `scope` 可能包含比请求参数更丰富的字段。

### 7.2 environment（测试环境）

区分**被测环境 `sut`** 与**测试执行环境 `test_runner`**：

| 块 | 字段 | 来源 |
|---|---|---|
| `sut` | `software_version` | 前端传入（权威）；异常为空时回退 env_config，仍无则 `未提供` |
| `sut` | `base_url` / `server_info` | env_config 的 `A2A_BASE_URL`（被测部署地址），`server_info` 为解析出的 host:port |
| `test_runner` | `os`/`python_version`/`pytest_version`/`exec_host` | report 本机自采（report 与 testrun 同机） |
| 顶层 | `env_vars` | env_config 环境变量，**敏感 key（token/secret/key/password 等）已脱敏为 `***`** |

### 7.3 summary（结果汇总）

| 字段 | 说明 |
|---|---|
| `total` | 用例总数 |
| `pass`/`failed`/`skipped`/`running` | 各状态计数 |
| `success_rate` | 成功率 = `pass / (pass + failed) × 100`，**skipped 不进分母** |
| `total_duration_seconds` | 总耗时（秒） |
| `by_feature` | 按特性分组的同结构统计 |

### 7.4 conclusion（测试结论）

| 字段 | 说明 |
|---|---|
| `passed` | 是否通过（所有门禁项通过才为 `true`） |
| `verdict` | `通过` / `不通过` |
| `gates[]` | 门禁明细：`name`/`required`/`actual`/`passed`；无适用用例的门禁 `actual` 为 `N/A（无适用用例）` 且判通过 |
| `reason` | 结论原因 |

> 门禁规则可在 `config/report_config.json` 的 `gates` 配置（等级通过率 / 整体成功率 / 特性通过率 / 无高危）。

### 7.5 risks（风险与建议）

数组，每项：

| 字段 | 说明 |
|---|---|
| `level` | 风险等级 `high`/`medium`/`low`（L0/L1 用例失败自动升级为 `high`） |
| `category` | 失败归类（环境不可达 / 请求超时 / 服务端错误 / 断言失败 / …） |
| `title` | 风险标题（含失败数） |
| `count` | 同类失败数 |
| `evidence[]` | 命中用例证据（最多 5 条） |
| `recommendation` | 处置建议 |

### 7.6 result_data（脚本级明细，仅详情接口返回）

数组，**仅包含 `failed` 和 `skipped` 状态的用例完整明细**（用于问题定位与调试）。
`pass` 用例不在 `result_data` 中出现，通过用例的统计信息仅存在于 `summary` 聚合中。
字段见[报告详情响应示例](#成功响应-200-2)。其中：
- `status`：`failed`/`skipped`（pytest 判 SKIPPED 的用例归为 `skipped`）
- `failure_detail`：失败用例的有界调用栈摘要；`failure_source` 标注来源（`log_file`=日志抽取 / `error_message`=兜底）
- `log_download_url`：完整日志下载路径（`log_file` 字段已移除，仅保留下载 URL）

---

## 8. 通用约定

1. **响应包裹**：所有 JSON 响应含 `success` 布尔字段；失败时含 `message`。
2. **状态码**：`200` 成功；`400` 参数错误；`404` 资源不存在；`500` 服务端异常。
3. **报告快照**：报告生成时冻结失败/跳过明细到 `result_data`（pass 用例仅存于 `summary` 聚合），不受后续执行结果覆盖式更新影响，历史报告可复现。
4. **前置条件**：需先创建报告表（`scripts/create_report_table.sql` 或 `report.models.create_report_table()`），且数据库连接可用（`DATABASE_ENABLED`）。
5. **被测软件版本**：`software_version` 由前端在生成报告时传入并做必填校验，报告据此回答"测的是哪个版本、缺陷属于哪个版本"。
