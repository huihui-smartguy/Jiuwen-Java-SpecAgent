# -*- coding: utf-8 -*-
"""黑盒 A2A 客户端 + 判据常量。

严格对齐 framework_reference.md：仅暴露其列出的 A2aClient 方法与常量。
httpx 在方法内部惰性导入，使本模块即便未安装 httpx 也能被 import。
"""

import os
import json
from typing import Iterator, Optional, Union

# ---------------------------------------------------------------------------
# 3. 关键判据常量（来自需求文档，勿臆造）
# ---------------------------------------------------------------------------
# Task 状态机
TASK_STATES = ["SUBMITTED", "WORKING", "COMPLETED", "FAILED", "CANCELED", "INPUT_REQUIRED"]
TERMINAL_STATES = {"COMPLETED", "FAILED", "CANCELED"}

# JSON-RPC 标准错误码
ERR_PARSE = -32700              # 非法 JSON 请求体
ERR_INVALID_REQUEST = -32600
ERR_METHOD_NOT_FOUND = -32601   # 未知 method
ERR_INTERNAL = -32603

# SSE 事件类型（流式）顺序骨架
SSE_EVENTS_ORDER = ["TaskAccepted", "ArtifactUpdate", "TaskStatusUpdate"]

# 端点
A2A_ENDPOINT = "/a2a"
AGENT_CARD_PATHS = ["/.well-known/agent-card.json", "/.well-known/agent.json"]

DEFAULT_BASE_URL = "http://localhost:8080"


def base_url_from_env() -> str:
    """读取 A2A_BASE_URL，默认 http://localhost:8080。"""
    return os.environ.get("A2A_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def normalize_state(state: Optional[str]) -> Optional[str]:
    """容错 ListTasks 返回的 TASK_STATE_* 前缀写法。"""
    if state is None:
        return None
    return state[len("TASK_STATE_"):] if state.startswith("TASK_STATE_") else state


class A2aClient:
    """基于 httpx 的黑盒 A2A 客户端。httpx 在每个方法内惰性导入。"""

    def __init__(self, base_url: Optional[str] = None, timeout: float = 35.0):
        self.base_url = (base_url or base_url_from_env()).rstrip("/")
        self.timeout = timeout

    # -- 内部工具 ----------------------------------------------------------
    @staticmethod
    def _message(text, context_id, message_id):
        return {
            "role": "ROLE_USER",
            "messageId": message_id or "msg-001",
            "contextId": context_id or "ctx-default",
            "parts": [{"text": text}],
        }

    def _envelope(self, method, params, req_id):
        return {"jsonrpc": "2.0", "method": method, "id": req_id, "params": params}

    def _post_json(self, body, accept="application/json"):
        import httpx  # lazy import
        with httpx.Client(timeout=self.timeout) as client:
            return client.post(
                self.base_url + A2A_ENDPOINT,
                content=json.dumps(body),
                headers={"Content-Type": "application/json", "Accept": accept},
            )

    @staticmethod
    def _parse_sse_lines(lines) -> Iterator[dict]:
        """将 SSE 文本行解析为 {'event':..., 'data': {<json>}} 事件 dict。"""
        event_name = None
        data_buf = []
        for raw in lines:
            line = raw.rstrip("\n")
            if line == "":
                if data_buf:
                    payload = "\n".join(data_buf)
                    try:
                        data = json.loads(payload)
                    except (ValueError, json.JSONDecodeError):
                        data = payload
                    yield {"event": event_name or "jsonrpc", "data": data}
                event_name, data_buf = None, []
                continue
            if line.startswith(":"):
                continue
            if line.startswith("event:"):
                event_name = line[len("event:"):].strip()
            elif line.startswith("data:"):
                data_buf.append(line[len("data:"):].lstrip())
        if data_buf:
            payload = "\n".join(data_buf)
            try:
                data = json.loads(payload)
            except (ValueError, json.JSONDecodeError):
                data = payload
            yield {"event": event_name or "jsonrpc", "data": data}

    def _stream(self, body) -> Iterator[dict]:
        import httpx  # lazy import
        with httpx.Client(timeout=self.timeout) as client:
            with client.stream(
                "POST",
                self.base_url + A2A_ENDPOINT,
                content=json.dumps(body),
                headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
            ) as resp:
                for event in self._parse_sse_lines(resp.iter_lines()):
                    yield event

    # -- 公开方法（仅这些，对齐 framework_reference.md §1） ---------------
    def send_message(self, text, *, context_id=None, message_id=None, req_id="1") -> dict:
        body = self._envelope("SendMessage",
                              {"message": self._message(text, context_id, message_id)}, req_id)
        return self._post_json(body, accept="application/json").json()

    def send_streaming_message(self, text, *, context_id=None, message_id=None, req_id="1") -> Iterator[dict]:
        body = self._envelope("SendStreamingMessage",
                              {"message": self._message(text, context_id, message_id)}, req_id)
        return self._stream(body)

    def get_task(self, task_id, *, req_id="1") -> dict:
        return self._post_json(self._envelope("GetTask", {"id": task_id}, req_id)).json()

    def cancel_task(self, task_id, *, req_id="1") -> dict:
        return self._post_json(self._envelope("CancelTask", {"id": task_id}, req_id)).json()

    def subscribe_to_task(self, task_id, *, req_id="1") -> Iterator[dict]:
        return self._stream(self._envelope("SubscribeToTask", {"id": task_id}, req_id))

    def list_tasks(self, *, req_id="1") -> dict:
        return self._post_json(self._envelope("ListTasks", {}, req_id)).json()

    def get_agent_card(self) -> dict:
        import httpx  # lazy import
        with httpx.Client(timeout=self.timeout) as client:
            return client.get(self.base_url + AGENT_CARD_PATHS[0]).json()

    def raw_post(self, body: Union[str, dict], *, accept="application/json"):
        """发任意（含非法）请求体，用于协议合规负向用例。返回 httpx.Response。"""
        import httpx  # lazy import
        content = body if isinstance(body, str) else json.dumps(body)
        with httpx.Client(timeout=self.timeout) as client:
            return client.post(
                self.base_url + A2A_ENDPOINT,
                content=content,
                headers={"Content-Type": "application/json", "Accept": accept},
            )
