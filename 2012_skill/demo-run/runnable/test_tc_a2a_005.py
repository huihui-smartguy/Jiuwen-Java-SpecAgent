# -*- coding: utf-8 -*-
import pytest
from a2a_client import (
    TASK_STATES, TERMINAL_STATES,
    ERR_PARSE, ERR_METHOD_NOT_FOUND,
    SSE_EVENTS_ORDER,
)

# Traceability:
#   scene      : E2E_A2A_005
#   requirement: requirement.md §4 JSON-RPC 解析 parse error(-32700) / 规则"error 携带原 request id" / §6 P0 门禁=是
#   java_class : A2aJsonRpcController.handle -> catch JsonProcessingException|JsonParseException -> A2AErrorCodes.JSON_PARSE


@pytest.mark.a2a
def test_tc_a2a_005(a2a_client):
    """
    @CaseID: TC-A2A-005
    @Description: 非法 JSON 请求体应返回 JSON-RPC parse error(-32700)，错误响应回带 id，且不创建 task。
    @Step: 1. raw_post 一段非法 JSON 体 '{"jsonrpc":"2.0","id":"99", BROKEN'
           2. 解析响应 body 的 error
           3. 校验 error.code 与 id 回带
    @Result: error.code == -32700(ERR_PARSE)；响应回带 id 字段；不返回成功 result
    """
    # Arrange
    broken_body = '{"jsonrpc":"2.0","id":"99", BROKEN'

    # Act
    r = a2a_client.raw_post(broken_body, accept="application/json")
    body = r.json()

    # Assert —— 内容维 (content dim, L2)：精确错误码语义
    assert "error" in body, f"期望返回 JSON-RPC error，实际 keys={list(body)}"
    assert body["error"]["code"] == ERR_PARSE, \
        f"期望 parse error {ERR_PARSE}，实际 {body['error'].get('code')!r}"

    # Assert —— 过程维 (process dim)：协议合规——错误响应也必须回带 id 字段
    assert "id" in body, "JSON-RPC error response 必须携带 id 字段"

    # 协议合规 (L2)：非法体不得被误判为成功 result（不创建 task 的可观测侧面）
    assert "result" not in body, "parse error 不应返回成功 result（不应创建 task）"
