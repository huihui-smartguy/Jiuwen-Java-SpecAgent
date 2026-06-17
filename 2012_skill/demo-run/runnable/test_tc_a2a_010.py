# -*- coding: utf-8 -*-
import pytest
from a2a_client import (
    TASK_STATES, TERMINAL_STATES,
    ERR_PARSE, ERR_METHOD_NOT_FOUND,
    SSE_EVENTS_ORDER,
    normalize_state,
)

# Traceability:
#   scene      : E2E_A2A_001
#   requirement: requirement.md §2 列出任务列表 / §3 ListTasks 返回 Task 数组
#   java_class : A2aJsonRpcController.handleBlocking(ListTasksRequest)


def _task_id(resp):
    assert isinstance(resp, dict), f"期望响应为 dict，实际 {type(resp).__name__}"
    result = resp.get("result")
    assert isinstance(result, dict), f"期望含 result(Task)，实际 keys={list(resp)}"
    tid = result.get("id")
    assert tid, f"期望 Task 含非空 id，实际 result keys={list(result)}"
    return tid


def _task_list(resp):
    """容差读取 ListTasks 结果：result 可能是 list 或 {'tasks':[...]}。"""
    result = resp.get("result")
    if isinstance(result, list):
        return result
    if isinstance(result, dict) and isinstance(result.get("tasks"), list):
        return result["tasks"]
    return None


@pytest.mark.a2a
def test_tc_a2a_010(a2a_client):
    """
    @CaseID: TC-A2A-010
    @Description: ListTasks 应返回任务数组，且包含此前 SendMessage 生成的目标 task。
    @Step: 1. SendMessage 生成 task，记录 taskId
           2. ListTasks()
           3. 在返回数组中查找该 taskId 与其 status.state
    @Result: 结果为数组(或{tasks:[...]})；存在元素 id == taskId；其 status.state(规约后) ∈ TERMINAL_STATES
    """
    # Arrange —— 先生成一个 task
    send_resp = a2a_client.send_message(
        "你好", context_id="ctx-list-010", message_id="msg-list-010", req_id="10")
    task_id = _task_id(send_resp)

    # Act —— 列出任务
    resp = a2a_client.list_tasks(req_id="10")

    # Assert —— 过程维 (process dim)：id 回带 + 结果为数组且含目标 taskId
    assert resp.get("id") == "10", f"期望 ListTasks id 回带 '10'，实际 {resp.get('id')!r}"
    tasks = _task_list(resp)
    assert tasks is not None, \
        f"期望 result 为 list 或 {{'tasks':[...]}}，实际 {type(resp.get('result')).__name__}"
    target = next((t for t in tasks if isinstance(t, dict) and t.get("id") == task_id), None)
    assert target is not None, \
        f"期望任务集合含目标 taskId {task_id!r}，实际 ids={[t.get('id') for t in tasks if isinstance(t, dict)]}"

    # Assert —— 内容维 (content dim, L2)：目标 task 状态规约后落入终态
    state = normalize_state(target.get("status", {}).get("state"))
    assert state in TASK_STATES, f"目标 task 状态 {state!r} 不在已知状态机 {TASK_STATES}"
    assert state in TERMINAL_STATES, f"期望目标 task 为终态，实际 {state!r}"
