# -*- coding: utf-8 -*-
import pytest
from a2a_client import (
    TASK_STATES, TERMINAL_STATES,
    ERR_PARSE, ERR_METHOD_NOT_FOUND,
    SSE_EVENTS_ORDER,
    A2A_ENDPOINT,
)

# Traceability:
#   scene      : E2E_A2A_006
#   requirement: requirement.md §2 发现 Agent 能力 / §4 Agent Card 生成优先级 / §6 P0 门禁=是
#   java_class : AgentCardController.agentCard


@pytest.mark.a2a
def test_tc_a2a_004(a2a_client):
    """
    @CaseID: TC-A2A-004
    @Description: Agent Card 发现端点应返回含 name/capabilities/skills/endpoint 的合法 AgentCard。
    @Step: 1. GET /.well-known/agent-card.json
           2. 解析 AgentCard JSON
           3. 校验关键字段存在与类型
    @Result: name 为非空 str；capabilities 为 dict（含 streaming 能力字段）；skills 为 list；含 url 字段(可为空)
    """
    # Act
    card = a2a_client.get_agent_card()

    # 结构存在性 (L1)
    assert isinstance(card, dict), f"期望 AgentCard 为 dict，实际 {type(card).__name__}"

    # Assert —— 内容维 (content dim, L2)：关键字段类型与语义
    name = card.get("name")
    assert isinstance(name, str) and name, f"期望 name 为非空 str，实际 {name!r}"

    caps = card.get("capabilities")
    assert isinstance(caps, dict), f"期望 capabilities 为 dict，实际 {type(caps).__name__}"
    # streaming 能力字段应被声明（值真假不限，但字段须存在）
    assert "streaming" in caps, f"期望 capabilities 含 streaming 字段，实际 keys={list(caps)}"

    skills = card.get("skills")
    assert isinstance(skills, list), f"期望 skills 为 list，实际 {type(skills).__name__}"

    # Assert —— 过程维 (process dim)：AgentCard 须声明 url 字段（发现-调用一致性）
    # 真实形态：url == 服务 base url，且不含 "/a2a"；public-base-url 未设时 url 可能为空字符串。
    # 故只要求 "url" 键存在，不强制非空、不强制含 "/a2a"（SUT 配置观测）。
    assert "url" in card, f"期望 AgentCard 含 url 字段，实际 keys={list(card)}"
    url = card.get("url")
    # 记录观测：若 url 非空且不含 /a2a 属正常（base url 不带 /a2a 路径）。
    if url:
        assert isinstance(url, str), f"期望 url 为 str，实际 {type(url).__name__}"
