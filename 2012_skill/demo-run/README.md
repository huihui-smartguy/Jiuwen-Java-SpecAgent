# demo-run · SuperTest `req-test-analyzer` 现场试跑产物

本目录是用 SuperTest 核心技能 **`req-test-analyzer`**（见上级目录的技能分析文档）对本项目 A2A 特性做的一次
**真实试跑**留档：从需求文档出发，生成测试用例设计，并为 2 个 P0 用例生成黑盒执行代码、做了真实校验。

## 被测与输入

| 项 | 值 |
|----|----|
| 被测 SUT | `spring-ai-ascend` @ tag `v0.1.0`，特性目录 `agent-runtime`（Java/Spring） |
| 观测面 | **黑盒** A2A：`POST /a2a`（JSON-RPC）+ `GET /.well-known/agent-card.json` |
| 需求文档 | 本仓 `develop` 分支的 `a2a-protocol-support-walkthrough.md`（由 `testing_recommendations.md` + 仓内 A2A 设计文档整理而来） |
| 聚焦范围 | A2A 核心消息 + 任务：SendMessage(同步)/SendStreamingMessage(流式)/GetTask/CancelTask/SubscribeToTask(断线重连)/ListTasks + 协议错误码 + Agent Card 发现 |

## 目录说明

```
demo-run/
├── inputs/                         # ⚠️ 为适配而“人工编写”的输入（见下方诚实说明）
│   ├── e2e_framework_scenes.json   #   --framework-scenes：A2A 框架场景组合
│   ├── framework_reference.md      #   stage4 代码生成参考：黑盒 httpx /a2a 客户端 API + 判据常量
│   └── test_common_template.md     #   pytest 用例格式模板（分级断言约定）
└── output/                         # skill 流水线产物
    ├── requirement_analysis.md     #   stage1 需求分析摘要
    ├── code_analysis.md            #   stage2 Java 代码事实（锚到真实类）
    ├── test_design.json            #   ★ 12 条 A2A 测试用例设计（P0×6 / P1×6）
    ├── a2a_client.py               #   stage4 生成：黑盒客户端（httpx 惰性导入）
    ├── conftest.py                 #   stage4 生成：pytest fixtures
    ├── test_tc_a2a_msg_sync_001.py #   ★ 执行代码示例：TC-A2A-001 SendMessage→COMPLETED
    ├── test_tc_a2a_parse_error_001.py # ★ 执行代码示例：TC-A2A-005 parse error -32700
    ├── case_results.json / report.md  # 汇总与报告
    └── .state/                     #   stage_summary + 逐用例结果(env_issue)
```

## 试跑结果

- **设计**：12 条用例，类型 正向7/异常4/边界1，覆盖 6 个框架场景；每条都有**可判定 Oracle**
  （`status.state` / `error.code` / SSE 事件序列 / id 回带 / Agent Card 字段）、≥1 个 L2 断言、
  内容维+过程维 ≥2 维，以及 `场景/需求条目/Java 类` 三元可追溯。
- **执行代码**：2 个 P0 的黑盒 pytest。真实校验：`py_compile` 4/4 通过、`pytest --collect-only` 收集到 2 条。
- **运行**：`pytest` 2 failed，原因 `httpx.ConnectError: Connection refused`（环境无运行中的 agent-runtime）→
  按 skill 纪律归类为 **env_issue**（环境问题，非用例缺陷，不靠改断言“洗绿”）。

## ⚠️ 诚实说明（务必阅读）

1. **执行代码未真正跑绿**：本试跑环境没有运行中的 Java 服务。断言已落在可观测判据上，
   待启动 agent-runtime 后用 `A2A_BASE_URL=http://<host>:<port> pytest` 即可得到真实正/负向判定。
2. **`inputs/` 是人工编写的适配件**：SuperTest 原生面向 **Python/openjiuwen SDK**，其 `extract-framework-*`
   抽取器只认 Python，对 Java 无效。为把流水线用到“Java 黑盒 HTTP”特性上，`framework-scenes` 与
   `framework_reference.md` / `test_common_template.md` 由人工编写。**因此本次是“用 skill 的流水线 + 人工提供黑盒适配资产”，并非 skill 全自动从 Java 抽取。**
3. `code_analysis.md` 中的 Java 锚点（`A2aJsonRpcController` 等错误码 catch 链 / SSE 终态关闭 / id 回带）
   来自对 `agent-runtime@v0.1.0` 源码的真实扫描，非臆造。

## 复现方式（需 Python 环境）

```bash
# 1) 准备：克隆被测仓 v0.1.0；需求文档取自本仓 develop 的 a2a-protocol-support-walkthrough.md
# 2) 安装 req-test-analyzer 等 skill 到 ~/.claude/skills/（见上级 SuperTest 使用说明）
# 3) 执行（标准模式，小规模）：
/req-test-analyzer inputs/requirement.md <clone>/agent-runtime \
    --framework-scenes inputs/e2e_framework_scenes.json \
    --output-dir output --p0-count 2 --case-batch-size 2 --max-fix-attempts 1
# 4) 起服务后真实运行执行代码：
cd output && A2A_BASE_URL=http://localhost:8080 pytest -q
```

> 注：`output/` 下的 `test_*.py` / `conftest.py` 为演示留档，**不属于本仓任何测试套件**，CI 不应收集执行。
