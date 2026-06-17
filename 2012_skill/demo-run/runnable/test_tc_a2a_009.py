# -*- coding: utf-8 -*-
import pytest
from a2a_client import (
    TASK_STATES, TERMINAL_STATES,
    ERR_PARSE, ERR_METHOD_NOT_FOUND,
    SSE_EVENTS_ORDER,
    normalize_state,
)

# Traceability:
#   scene      : E2E_A2A_003
#   requirement: requirement.md §2 断线重连后重新订阅 / §3 SubscribeToTask 恢复订阅
#   java_class : A2aJsonRpcController.handleStream(SubscribeToTaskRequest, terminateOnInterrupt=false)


def _event_result(ev):
    data = ev.get("data") if isinstance(ev, dict) else None
    if isinstance(data, dict):
        return data.get("result", data)
    return None


def _event_task_id(ev):
    res = _event_result(ev)
    if not isinstance(res, dict):
        return None
    for key in ("id", "taskId"):
        if res.get(key):
            return res[key]
    task = res.get("task")
    if isinstance(task, dict) and task.get("id"):
        return task["id"]
    return None


def _event_state(ev):
    res = _event_result(ev)
    if isinstance(res, dict) and isinstance(res.get("status"), dict):
        return normalize_state(res["status"].get("state"))
    return None


@pytest.mark.a2a
@pytest.mark.sse
def test_tc_a2a_009(a2a_client):
    """
    @CaseID: TC-A2A-009
    @Description: 流式中途断线后用 taskId SubscribeToTask 续订，应续收事件直至终态，不丢终态事件。
    @Step: 1. SendStreamingMessage 启动，读取首事件取 taskId 后提前 break（模拟断线）
           2. 用 taskId 调 SubscribeToTask 恢复 SSE
           3. 续收事件直至 TaskStatusUpdate 终态
    @Result: 续订后能继续收到事件，末事件 status.state ∈ TERMINAL_STATES（期望 COMPLETED）
    """
    # Arrange —— 启动流并在取得 taskId 后立即断开
    task_id = None
    stream = a2a_client.send_streaming_message(
        "请执行一个任务以便续订", context_id="ctx-resub-009", message_id="msg-resub-009", req_id="9")
    for ev in stream:
        task_id = _event_task_id(ev)
        if task_id:
            break  # 模拟断线：提前结束消费
    assert task_id, "期望从首批 SSE 事件取得 taskId（用于续订）"

    # Act —— 用 taskId 续订，续收剩余事件
    resumed = list(a2a_client.subscribe_to_task(task_id, req_id="9"))

    # Assert —— 过程维 (process dim)：续订能继续收到事件，且含终事件
    assert resumed, \
        f"期望续订 SubscribeToTask(taskId={task_id!r}) 能续收事件，实际为空"

    # 末事件应可读到 status.state（终事件）
    last_state = _event_state(resumed[-1])

    # Assert —— 内容维 (content dim, L2)：续订末事件落入终态（容差前缀）
    assert last_state is not None, \
        f"期望续订末事件携带 status.state，实际事件 data={resumed[-1].get('data')!r}"
    assert last_state in TASK_STATES, \
        f"末事件状态 {last_state!r} 不在已知状态机 {TASK_STATES}"
    assert last_state in TERMINAL_STATES, \
        f"期望续订末事件到终态(期望 COMPLETED)，实际 {last_state!r}"
