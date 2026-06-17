# -*- coding: utf-8 -*-
import pytest
from a2a_client import (
    TASK_STATES, TERMINAL_STATES,
    ERR_PARSE, ERR_METHOD_NOT_FOUND,
    SSE_EVENTS_ORDER,
)

# Traceability:
#   scene      : E2E_A2A_001
#   requirement: requirement.md §2 核心场景(同步) / §4 Task 状态流转 COMPLETED / §6 P0 门禁=是
#   java_class : A2aJsonRpcController.handleBlocking(SendMessageRequest) + A2aResultRouter.route(COMPLETED)


@pytest.mark.a2a
def test_tc_a2a_msg_sync_001(a2a_client):
    """
    @CaseID: TC-A2A-001
    @Description: SendMessage 同步阻塞调用应返回完整 JSON Task，终态为 COMPLETED。
    @Step: 1. 构造 SendMessage 请求(message 含一条 text part)，id="1"
           2. POST /a2a (Accept: application/json) 阻塞获取响应
           3. 解析 JSON-RPC response 的 result(Task)
    @Result: result.status.state == "COMPLETED" 且 ∈ TERMINAL_STATES；响应 id 回带 == "1"；artifacts 为 list
    """
    # Arrange / Act
    resp = a2a_client.send_message("你好", context_id="ctx-sync-001", message_id="msg-sync-001", req_id="1")

    # Assert —— 过程维 (process dim)：JSON-RPC id 必须回带原 request id
    assert resp.get("id") == "1", f"期望 id 回带 '1'，实际 {resp.get('id')!r}"

    # 结构存在性 (L1)
    assert "result" in resp, f"期望成功响应含 result，实际 keys={list(resp)}"
    task = resp["result"]
    state = task["status"]["state"]

    # Assert —— 内容维 (content dim, L2)：终态值语义判定
    assert state in TASK_STATES, f"状态 {state!r} 不在已知状态机 {TASK_STATES}"
    assert state in TERMINAL_STATES, f"同步调用应到终态，实际 {state!r}"
    assert state == "COMPLETED", f"期望 COMPLETED，实际 {state!r}"

    # 结构语义 (L2)：artifacts 为列表
    assert isinstance(task.get("artifacts"), list), \
        f"期望 artifacts 为 list，实际 {type(task.get('artifacts')).__name__}"
