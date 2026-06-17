# -*- coding: utf-8 -*-
import uuid
import pytest
from a2a_client import (
    TASK_STATES, TERMINAL_STATES,
    ERR_PARSE, ERR_METHOD_NOT_FOUND,
    SSE_EVENTS_ORDER,
)

# Traceability:
#   scene      : E2E_A2A_001
#   requirement: requirement.md §3 GetTask: taskId 必须存在，不存在返回错误
#   java_class : A2aJsonRpcController.handle -> catch A2AError -> errorResponse(id)


@pytest.mark.a2a
def test_tc_a2a_012(a2a_client):
    """
    @CaseID: TC-A2A-012
    @Description: GetTask 查询不存在的 taskId 应返回标准 JSON-RPC error 并回带 id（边界）。
    @Step: 1. GetTask("nonexistent-<random>")，id="7"
           2. 解析响应
           3. 校验返回为 JSON-RPC error 且回带 id
    @Result: 响应含 error（非成功 result），error.code 为整数，回带 id == "7"
    """
    # Arrange —— 构造几乎不可能命中的随机 taskId
    missing_id = "nonexistent-" + uuid.uuid4().hex

    # Act
    resp = a2a_client.get_task(missing_id, req_id="7")

    # Assert —— 内容维 (content dim, L2)：返回标准错误，error.code 为整数
    assert "error" in resp, \
        f"期望查询不存在 taskId 返回 error，实际 keys={list(resp)}"
    code = resp["error"].get("code")
    assert isinstance(code, int), f"期望 error.code 为整数错误码，实际 {code!r}"

    # 协议合规 (L2)：不存在的 task 不得返回成功 result
    assert "result" not in resp, "查询不存在 taskId 不应返回成功 result"

    # Assert —— 过程维 (process dim)：error 回带原 request id
    assert resp.get("id") == "7", f"期望 error 回带原 id '7'，实际 {resp.get('id')!r}"
