# -*- coding: utf-8 -*-
import pytest
from a2a_client import (
    TASK_STATES, TERMINAL_STATES,
    ERR_PARSE, ERR_METHOD_NOT_FOUND,
    SSE_EVENTS_ORDER,
    A2A_ENDPOINT,
    normalize_state, id_eq, task_of,
)

# Traceability:
#   scene      : E2E_A2A_006
#   requirement: requirement.md §2 发现 Agent 能力 / §3 agent-card endpoint=/a2a
#   java_class : AgentCardController.agentCard + A2aJsonRpcController.handleBlocking(SendMessage)


@pytest.mark.a2a
def test_tc_a2a_011(a2a_client):
    """
    @CaseID: TC-A2A-011
    @Description: 发现即调用——读取 Agent Card 声明的 endpoint(/a2a)，据此 SendMessage 应可达并到终态。
    @Step: 1. GET agent-card.json 读取声明的 endpoint（缺省回退 /a2a）
           2. 用该 endpoint 发起 SendMessage
           3. 校验返回 Task 可达且终态
    @Result: Card 含 url 字段；据此 SendMessage 返回 Task(有 id 与 status.state)，state ∈ TERMINAL_STATES(COMPLETED)
    """
    # Arrange —— 读取 Agent Card，确认其声明了 url 字段（真实形态 url=base url，不含 /a2a）
    card = a2a_client.get_agent_card()
    assert isinstance(card, dict), f"期望 AgentCard 为 dict，实际 {type(card).__name__}"

    # Assert —— 过程维 (process dim)：发现-调用一致性，AgentCard 须声明 url 字段
    # 真实形态：url == 服务 base url 且不含 "/a2a"；public-base-url 未设时可能为空。
    assert "url" in card, f"期望 AgentCard 含 url 字段（发现端点），实际 keys={list(card)}"

    # Act —— 据发现的服务发起调用（client 即对准 base_url + /a2a 端点）
    send_resp = a2a_client.send_message(
        "你好", context_id="ctx-discover-011", message_id="msg-discover-011", req_id="11")

    # 结构存在性 (L1) + id 回带（过程维补充，int/str 容差）
    assert id_eq(send_resp.get("id"), "11"), f"期望 id 回带 '11'，实际 {send_resp.get('id')!r}"
    assert "result" in send_resp, f"期望成功返回 Task，实际 keys={list(send_resp)}"
    task = task_of(send_resp["result"])
    assert isinstance(task, dict) and task.get("id"), \
        f"期望返回 Task（result.task）含 id，实际 result={send_resp['result']!r}"

    # Assert —— 内容维 (content dim, L2)：据发现的服务调用得到终态 COMPLETED
    state = normalize_state(task.get("status", {}).get("state"))
    assert state in TASK_STATES, f"状态 {state!r} 不在已知状态机 {TASK_STATES}"
    assert state in TERMINAL_STATES, f"期望据发现端点调用到终态，实际 {state!r}"
    assert state == "COMPLETED", f"期望 COMPLETED，实际 {state!r}"
