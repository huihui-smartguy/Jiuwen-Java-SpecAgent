# -*- coding: utf-8 -*-
import pytest
from a2a_client import (
    TASK_STATES, TERMINAL_STATES,
    ERR_PARSE, ERR_METHOD_NOT_FOUND,
    SSE_EVENTS_ORDER,
    normalize_state, id_eq, task_of, event_task_id,
)

# Traceability:
#   scene      : E2E_A2A_004
#   requirement: requirement.md §2 取消正在执行的任务 / §4 SSE 流关闭 CANCELED
#   java_class : A2aAgentExecutor.cancel -> emitter.cancel()


@pytest.mark.a2a
def test_tc_a2a_007(a2a_client):
    """
    @CaseID: TC-A2A-007
    @Description: 对执行中(WORKING)的任务调用 CancelTask 应返回 CANCELED 终态。
    @Step: 1. SendStreamingMessage 启动流，从早期事件取 taskId
           2. CancelTask(taskId)
           3. 校验返回 Task 状态
    @Result: CancelTask result.status.state == "CANCELED"（容差 TASK_STATE_ 前缀）；id 回带
    """
    # Arrange —— 启动流式任务，尽早取得 taskId 后即停止消费（模拟执行中）
    task_id = None
    stream = a2a_client.send_streaming_message(
        "请执行一个较长任务", context_id="ctx-cancel-007", message_id="msg-cancel-007", req_id="7")
    for ev in stream:
        task_id = event_task_id(ev)
        if task_id:
            break
    # 待复测稳健：若早期事件未携带 taskId，给出明确失败信息（非静默 None）。
    assert task_id, "期望从早期 SSE 事件获取到 taskId（用于取消执行中任务）；若为 None 请复核 SSE oneof 载荷形态"

    # Act —— 取消执行中的任务
    cancel_resp = a2a_client.cancel_task(task_id, req_id="7")

    # Assert —— 过程维 (process dim)：id 回带（int/str 容差）
    assert id_eq(cancel_resp.get("id"), "7"), \
        f"期望 CancelTask id 回带 '7'，实际 {cancel_resp.get('id')!r}"
    assert "result" in cancel_resp, \
        f"期望 CancelTask 成功返回 result，实际 keys={list(cancel_resp)}"

    # Assert —— 内容维 (content dim, L2)：状态语义 == CANCELED（容差前缀）
    cancel_task_obj = task_of(cancel_resp["result"])
    assert isinstance(cancel_task_obj, dict), \
        f"期望 CancelTask result 含 Task（result.task），实际 {cancel_resp['result']!r}"
    state = normalize_state(cancel_task_obj["status"]["state"])
    assert state in TASK_STATES, f"状态 {state!r} 不在已知状态机 {TASK_STATES}"
    assert state == "CANCELED", f"期望取消后状态 CANCELED，实际 {state!r}"
