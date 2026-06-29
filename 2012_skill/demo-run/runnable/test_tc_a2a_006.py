# -*- coding: utf-8 -*-
import json
import pytest
from a2a_client import (
    TASK_STATES, TERMINAL_STATES,
    ERR_PARSE, ERR_METHOD_NOT_FOUND,
    SSE_EVENTS_ORDER,
    id_eq,
)

# Traceability:
#   scene      : E2E_A2A_005
#   requirement: requirement.md §4 方法分发 method-not-found(-32601) / §6 P0 门禁=是 / 不创建 task
#   java_class : A2aJsonRpcController.handle -> catch MethodNotFoundJsonMappingException -> METHOD_NOT_FOUND


@pytest.mark.a2a
def test_tc_a2a_006(a2a_client):
    """
    @CaseID: TC-A2A-006
    @Description: 合法 JSON 但 method 未知应返回 method-not-found(-32601)，回带 id，且不创建 task。
    @Step: 1. raw_post 合法 JSON 但 method="NoSuchMethod"，id="42"
           2. 解析响应 error
           3. 校验错误码与 id 回带
    @Result: error.code == -32601(ERR_METHOD_NOT_FOUND)；id 回带 == "42"；无成功 result
    """
    # Arrange —— 合法 JSON-RPC 信封，但 method 不存在
    bad_method_req = {
        "jsonrpc": "2.0",
        "method": "NoSuchMethod",
        "id": "42",
        "params": {},
    }

    # Act
    r = a2a_client.raw_post(json.dumps(bad_method_req), accept="application/json")
    body = r.json()

    # Assert —— 内容维 (content dim, L2)：精确错误码语义
    assert "error" in body, f"期望返回 JSON-RPC error，实际 keys={list(body)}"
    assert body["error"]["code"] == ERR_METHOD_NOT_FOUND, \
        f"期望 method-not-found {ERR_METHOD_NOT_FOUND}，实际 {body['error'].get('code')!r}"

    # Assert —— 过程维 (process dim)：id 回带 == 请求 id（int/str 容差）
    assert id_eq(body.get("id"), "42"), f"期望 id 回带 '42'，实际 {body.get('id')!r}"

    # 协议合规 (L2)：未知 method 不得返回成功 result（不创建 task）
    assert "result" not in body, "method-not-found 不应返回成功 result（不应创建 task）"
