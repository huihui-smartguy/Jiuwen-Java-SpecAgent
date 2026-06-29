# test_common_template.md（黑盒 A2A pytest 用例格式模板）

> ⚠️ 演示适配说明：原生模板由 `extract-test-template` 从现有 Python 用例抽取。此处为黑盒 `/a2a` 测试人工编写，
> 统一用例风格：httpx 黑盒客户端 + pytest + 分级断言（≥1 个 L2）。

## 1. 文件头与导入

```python
# -*- coding: utf-8 -*-
import pytest
from a2a_client import (
    TASK_STATES, TERMINAL_STATES,
    ERR_PARSE, ERR_METHOD_NOT_FOUND,
    SSE_EVENTS_ORDER,
)
```

## 2. 用例函数签名与 docstring（必须含 @CaseID/@Description/@Step/@Result）

```python
@pytest.mark.a2a
def test_tc_xxx(a2a_client):
    """
    @CaseID: TC-XXX
    @Description: 一句话说明被验证的 A2A 行为
    @Step: 1. ... 2. ... 3. ...
    @Result: 期望的可观测判据（状态/错误码/事件序列）
    """
    # Arrange
    ...
    # Act
    resp = a2a_client.send_message("你好", context_id="ctx-001")
    # Assert（见 §3）
    ...
```

## 3. 断言约定（分级，至少 1 个 L2；正向用例 ≥ L2；≥2 个维度）

- **L0（禁止单独使用）**：`assert resp is not None` / `assert "result" in resp`
- **L1**：`assert resp["id"] == "1"`（结构/计数/存在 + 关键标识）
- **L2（必须 ≥1）**：对**值/语义**断言，例如
  ```python
  task = resp["result"]
  assert task["status"]["state"] in TERMINAL_STATES          # 值落在判据集合
  assert task["status"]["state"] == "COMPLETED"               # 精确值
  assert isinstance(task.get("artifacts"), list)             # 结构
  ```
- **多维**：内容维（task.status.state / error.code）+ 过程维（SSE 事件顺序 / id 回带）各 ≥1。

## 4. 流式断言范式

```python
events = list(a2a_client.send_streaming_message("你好", context_id="ctx-002"))
kinds = [e["data"]["result"]["kind"] for e in events]        # 或等价字段
assert kinds[0] == "TaskAccepted"                            # 首事件
assert "ArtifactUpdate" in kinds                             # 含增量
assert kinds[-1] == "TaskStatusUpdate"                       # 终事件
assert events[-1]["data"]["result"]["status"]["state"] == "COMPLETED"   # L2 终态
```

## 5. 负向（协议合规）范式

```python
r = a2a_client.raw_post('{"jsonrpc":"2.0", BROKEN', accept="application/json")  # 非法 JSON
body = r.json()
assert body["error"]["code"] == ERR_PARSE                    # -32700
assert body.get("id") is not None                            # 错误也回带 id
# 且不应创建 task：后续 ListTasks 不应新增（可选二次校验）
```

## 6. 命名与标记

- 文件名：`test_{case_id_lower}.py`（如 `test_tc_a2a_msg_001.py`）
- 标记：`@pytest.mark.a2a`；流式可加 `@pytest.mark.sse`
- 一个用例一个函数；断言失败信息要可读（写明期望 vs 实际判据）。
