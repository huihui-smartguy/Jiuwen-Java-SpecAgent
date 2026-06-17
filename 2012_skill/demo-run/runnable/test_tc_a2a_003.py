# -*- coding: utf-8 -*-
import pytest
from a2a_client import (
    TASK_STATES, TERMINAL_STATES,
    ERR_PARSE, ERR_METHOD_NOT_FOUND,
    SSE_EVENTS_ORDER,
    normalize_state, id_eq, task_of,
)

# Traceability:
#   scene      : E2E_A2A_001
#   requirement: requirement.md §2 查询异步任务 / §6 P0 门禁=是
#   java_class : A2aJsonRpcController.handleBlocking(GetTaskRequest)


@pytest.mark.a2a
def test_tc_a2a_003(a2a_client):
    """
    @CaseID: TC-A2A-003
    @Description: GetTask 查询同步生成的任务，返回 Task 的 id 与状态须与原任务一致。
    @Step: 1. SendMessage 获取 result.id 作为 taskId
           2. GetTask(taskId)
           3. 比对返回 Task 的 id 与 status.state
    @Result: GetTask result.id == 原 taskId；status.state ∈ TERMINAL_STATES 且与原终态一致
    """
    # Arrange —— 先同步生成一个任务
    send_resp = a2a_client.send_message(
        "你好", context_id="ctx-get-003", message_id="msg-get-003", req_id="1")
    send_task = task_of(send_resp["result"])
    assert isinstance(send_task, dict), f"期望 SendMessage result 含 Task，实际 {send_resp.get('result')!r}"
    task_id = send_task["id"]
    assert task_id, f"期望 Task 含非空 id，实际 task keys={list(send_task)}"
    orig_state = normalize_state(send_task["status"]["state"])

    # Act —— 查询该任务
    get_resp = a2a_client.get_task(task_id, req_id="3")

    # Assert —— 过程维 (process dim)：id 回带 + Task.id 回显（int/str 容差）
    assert id_eq(get_resp.get("id"), "3"), f"期望 JSON-RPC id 回带 '3'，实际 {get_resp.get('id')!r}"
    assert "result" in get_resp, f"期望 GetTask 成功返回 result，实际 keys={list(get_resp)}"
    got_task = task_of(get_resp["result"])
    assert isinstance(got_task, dict), f"期望 GetTask result 含 Task（result.task），实际 {get_resp['result']!r}"
    got_id = got_task.get("id")
    assert got_id == task_id, f"期望 GetTask result.task.id == 原 taskId {task_id!r}，实际 {got_id!r}"

    # Assert —— 内容维 (content dim, L2)：状态落入终态且与原终态一致
    got_state = normalize_state(got_task["status"]["state"])
    assert got_state in TASK_STATES, f"状态 {got_state!r} 不在已知状态机 {TASK_STATES}"
    assert got_state in TERMINAL_STATES, f"期望 GetTask 状态为终态，实际 {got_state!r}"
    assert got_state == orig_state, \
        f"期望 GetTask 状态与原终态一致 {orig_state!r}，实际 {got_state!r}"
