# -*- coding: utf-8 -*-
import pytest
from a2a_client import (
    TASK_STATES, TERMINAL_STATES,
    ERR_PARSE, ERR_METHOD_NOT_FOUND,
    SSE_EVENTS_ORDER,
    normalize_state,
)

# Traceability:
#   scene      : E2E_A2A_004
#   requirement: requirement.md §3 CancelTask: Task 已完成返回错误 / §4 状态只允许向前流转
#   java_class : A2aJsonRpcController.handle -> catch A2AError -> errorResponse(id)


def _task_id(resp):
    assert isinstance(resp, dict), f"期望响应为 dict，实际 {type(resp).__name__}"
    result = resp.get("result")
    assert isinstance(result, dict), f"期望含 result(Task)，实际 keys={list(resp)}"
    tid = result.get("id")
    assert tid, f"期望 Task 含非空 id，实际 result keys={list(result)}"
    return tid


@pytest.mark.a2a
def test_tc_a2a_008(a2a_client):
    """
    @CaseID: TC-A2A-008
    @Description: 对已到终态(COMPLETED)的任务再次 CancelTask 应返回标准 JSON-RPC error（负向）。
    @Step: 1. SendMessage 得到终态 task 的 id
           2. CancelTask(该终态 taskId)
           3. 校验返回为 JSON-RPC error
    @Result: 响应含 error 且 error.code 为整数；回带原 id；不会把终态翻回 CANCELED（无成功 result）
    """
    # Arrange —— 先同步生成一个终态任务
    send_resp = a2a_client.send_message(
        "你好", context_id="ctx-recancel-008", message_id="msg-recancel-008", req_id="8")
    task_id = _task_id(send_resp)
    orig_state = normalize_state(send_resp["result"]["status"]["state"])
    assert orig_state in TERMINAL_STATES, \
        f"前置：期望 SendMessage 已到终态，实际 {orig_state!r}"

    # Act —— 对终态任务再取消
    resp = a2a_client.cancel_task(task_id, req_id="8")

    # Assert —— 内容维 (content dim, L2)：返回标准错误，error.code 为整数
    assert "error" in resp, \
        f"期望对终态任务再取消返回 error，实际 keys={list(resp)}"
    code = resp["error"].get("code")
    assert isinstance(code, int), f"期望 error.code 为整数错误码，实际 {code!r}"

    # 协议合规 (L2)：不得返回成功 result（终态不应被翻回 CANCELED）
    assert "result" not in resp, "终态任务再取消不应返回成功 result（状态不可回退）"

    # Assert —— 过程维 (process dim)：error 回带原 request id
    assert resp.get("id") == "8", f"期望 error 回带原 id '8'，实际 {resp.get('id')!r}"
