# -*- coding: utf-8 -*-
import pytest
from a2a_client import (
    TASK_STATES, TERMINAL_STATES,
    ERR_PARSE, ERR_METHOD_NOT_FOUND,
    SSE_EVENTS_ORDER,
    normalize_state, event_kind, event_state,
)

# Traceability:
#   scene      : E2E_A2A_002
#   requirement: requirement.md §2 流式场景 / §4 SSE 流终端状态关闭 / §6 P0 门禁=是
#   java_class : A2aJsonRpcController.handleStream(takeUntil isStreamTerminating)


@pytest.mark.a2a
@pytest.mark.sse
def test_tc_a2a_002(a2a_client):
    """
    @CaseID: TC-A2A-002
    @Description: SendStreamingMessage 经 SSE 推送事件序列直至终态 COMPLETED。
    @Step: 1. 构造 SendStreamingMessage 请求(Accept: text/event-stream)
           2. POST /a2a 逐事件消费 SSE
           3. 收集事件 kind 序列与末事件 status.state
    @Result: 首事件≈TaskAccepted；序列含 ArtifactUpdate；末事件≈TaskStatusUpdate 且末态 == COMPLETED
    """
    # Arrange / Act —— 收集全部 SSE 事件
    events = list(a2a_client.send_streaming_message(
        "你好", context_id="ctx-stream-002", message_id="msg-stream-002", req_id="1"))

    # 结构存在性 (L1)
    assert events, "期望至少收到一个 SSE 事件，实际为空（流未推送）"
    kinds = [event_kind(e) for e in events]

    # Assert —— 过程维 (process dim)：SSE 事件 kind 顺序对齐骨架（首接受/含增量/末状态）
    assert kinds[0] == "TaskAccepted", \
        f"期望首事件 ≈ TaskAccepted，实际 {kinds[0]!r}（全序列 {kinds}）"
    assert "ArtifactUpdate" in kinds, \
        f"期望事件序列含 ArtifactUpdate，实际 {kinds}"
    assert kinds[-1] == "TaskStatusUpdate", \
        f"期望末事件 ≈ TaskStatusUpdate，实际 {kinds[-1]!r}（全序列 {kinds}）"

    # Assert —— 内容维 (content dim, L2)：末事件终态值语义
    last_state = event_state(events[-1])
    assert last_state in TASK_STATES, \
        f"末事件状态 {last_state!r} 不在已知状态机 {TASK_STATES}"
    assert last_state == "COMPLETED", \
        f"期望流终态 COMPLETED，实际 {last_state!r}"
