# -*- coding: utf-8 -*-
# [A2A 示例特化] 本文件是通用黑盒模式（reference/http_client.py）针对 A2A/JSON-RPC 协议的特化示例。
"""黑盒 A2A 客户端 + 判据常量。

严格对齐 framework_reference.md：仅暴露其列出的 A2aClient 方法与常量。
httpx 在方法内部惰性导入，使本模块即便未安装 httpx 也能被 import。
"""

import os
import json
import time
import logging
import datetime
import contextvars
from typing import Iterator, Optional, Union

# ---------------------------------------------------------------------------
# 0a. 代理豁免 —— 黑盒测试框架直连 SUT， 不经过系统/企业 HTTP 代理。
#     在任何 httpx 导入前执行，确保 httpx 不会将请求错误路由到不可达的代理。
# ---------------------------------------------------------------------------
os.environ.setdefault("no_proxy", "")
if os.environ.get("no_proxy") != "*":
    os.environ["no_proxy"] = os.environ.get("no_proxy", "") + ",*"
os.environ["NO_PROXY"] = os.environ["no_proxy"]

# ---------------------------------------------------------------------------
# 0. 交互轨迹记录器（recorder）——把 test-agent ↔ runtime 的请求/响应/SSE 落盘+打印
#    纯 Python，无 httpx 依赖；任何异常都吞掉，绝不影响被测流程。
# ---------------------------------------------------------------------------
LOG = logging.getLogger("a2a")

# 当前用例名（conftest 在每个用例开始时 set_current_case 注入）。
_current_case = contextvars.ContextVar("a2a_case", default="session")

# 需要脱敏的请求头（大小写不敏感子串匹配）。
_REDACT_HEADER_HINTS = ("authorization", "token", "cookie", "secret", "api-key", "apikey")


def set_current_case(name: str) -> None:
    """设置当前用例名（用于 trace 文件名 / 日志 case 字段）。"""
    try:
        _current_case.set(name or "session")
    except Exception:
        pass


def _trace_path() -> Optional[str]:
    """若设置 A2A_TRACE_DIR 则返回 {dir}/{case}.jsonl（并确保目录存在），否则 None。"""
    d = os.environ.get("A2A_TRACE_DIR")
    if not d:
        return None
    try:
        os.makedirs(d, exist_ok=True)
        return os.path.join(d, "%s.jsonl" % _current_case.get())
    except Exception:
        return None


def _safe_dumps(obj) -> str:
    """把任意对象转成可读 JSON 字符串；失败回退 repr，绝不抛异常。"""
    try:
        return json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=False)
    except Exception:
        try:
            return repr(obj)
        except Exception:
            return "<unprintable>"


def _compact_dumps(obj) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    except Exception:
        try:
            return repr(obj)
        except Exception:
            return "<unprintable>"


def _redact_headers(headers) -> dict:
    """脱敏 Authorization/token 类请求头。"""
    out = {}
    try:
        for k, v in dict(headers or {}).items():
            kl = str(k).lower()
            if any(h in kl for h in _REDACT_HEADER_HINTS):
                out[k] = "***REDACTED***"
            else:
                out[k] = v
    except Exception:
        return {}
    return out


def _emit(record: dict) -> None:
    """补充 ts/case，打印人类可读行（调用方已 LOG），并把结构化记录追加进 trace。"""
    try:
        record.setdefault("ts", datetime.datetime.now().isoformat(timespec="seconds"))
        record.setdefault("case", _current_case.get())
    except Exception:
        pass
    path = _trace_path()
    if path:
        try:
            with open(path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(record, ensure_ascii=False) + "\n")
        except Exception:
            pass


def record_request(method, url, headers, body) -> None:
    """记录 client→runtime 的一次请求。"""
    try:
        red = _redact_headers(headers)
        if isinstance(body, str):
            body_str = body
            body_rec = body
        else:
            body_str = _safe_dumps(body)
            body_rec = body
        LOG.info(">>> [client→runtime] %s %s", method, url)
        LOG.info("    headers=%s", _compact_dumps(red))
        LOG.info("    body=\n%s", body_str)
        _emit({"kind": "request", "method": method, "url": url,
               "headers": red, "body": body_rec})
    except Exception:
        pass


def record_response(method, status_code, body) -> None:
    """记录 runtime→client 的一次响应。"""
    try:
        LOG.info("<<< [runtime→client] HTTP %s (%s)", status_code, method)
        LOG.info("    body=\n%s", _safe_dumps(body))
        _emit({"kind": "response", "method": method,
               "status_code": status_code, "body": body})
    except Exception:
        pass


def record_sse_event(idx, t0, ev) -> None:
    """记录一条实时到达的 SSE 事件。"""
    try:
        try:
            elapsed_ms = int((time.time() - t0) * 1000)
        except Exception:
            elapsed_ms = -1
        kind = None
        state = None
        try:
            kind = event_kind(ev)
            state = event_state(ev)
        except Exception:
            pass
        LOG.info("<<< [SSE] #%s (+%sms) kind=%s state=%s",
                 idx, elapsed_ms, kind, state)
        LOG.info("    event=%s", _compact_dumps(ev))
        _emit({"kind": "sse_event", "idx": idx, "elapsed_ms": elapsed_ms,
               "event_kind": kind, "event_state": state, "event": ev})
    except Exception:
        pass

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


# ---------------------------------------------------------------------------
# 真实线缆形态适配 helpers（org.a2aproject.sdk, protobuf-JSON）
#   - JSON-RPC id 类型容差：SUT 把 id 回带成 int，请求侧用 str。
#   - Task 嵌套在 result.task（不是 result 本身）。
#   - SSE 事件 result 是 oneof：task / statusUpdate / artifactUpdate。
# ---------------------------------------------------------------------------
def id_eq(actual, expected) -> bool:
    """JSON-RPC id 类型容差比较（int 回带 vs str 请求）。"""
    return str(actual) == str(expected)


def task_of(result):
    """从 JSON-RPC result 中提取 Task：优先 result.task，回退 result 自身。"""
    if isinstance(result, dict) and isinstance(result.get("task"), dict):
        return result["task"]
    if isinstance(result, dict) and ("status" in result or "id" in result):
        return result
    return None


def event_payload(ev):
    """读取 SSE 事件的 JSON-RPC result 载荷（容差 data/result 嵌套）。"""
    if isinstance(ev, dict):
        data = ev.get("data")
        if isinstance(data, dict):
            return data.get("result", data)
        return data
    return None


def event_kind(ev):
    """依据 result oneof 形状映射事件骨架名：TaskAccepted/TaskStatusUpdate/ArtifactUpdate。"""
    p = event_payload(ev)
    if not isinstance(p, dict):
        return None
    if "task" in p:
        return "TaskAccepted"
    if "statusUpdate" in p:
        return "TaskStatusUpdate"
    if "artifactUpdate" in p:
        return "ArtifactUpdate"
    return None


def event_task_id(ev):
    """容差读取事件 taskId：task.id / statusUpdate.taskId / artifactUpdate.taskId。"""
    p = event_payload(ev)
    if not isinstance(p, dict):
        return None
    task = p.get("task")
    if isinstance(task, dict) and task.get("id"):
        return task["id"]
    for key in ("statusUpdate", "artifactUpdate"):
        sub = p.get(key)
        if isinstance(sub, dict):
            if sub.get("taskId"):
                return sub["taskId"]
            nested = sub.get("task")
            if isinstance(nested, dict) and nested.get("id"):
                return nested["id"]
    return None


def event_state(ev):
    """容差读取事件 status.state（规约 TASK_STATE_ 前缀）：statusUpdate 优先，回退 task。"""
    p = event_payload(ev)
    if not isinstance(p, dict):
        return None
    su = p.get("statusUpdate")
    if isinstance(su, dict) and isinstance(su.get("status"), dict):
        return normalize_state(su["status"].get("state"))
    task = p.get("task")
    if isinstance(task, dict) and isinstance(task.get("status"), dict):
        return normalize_state(task["status"].get("state"))
    return None


def event_is_final(ev) -> bool:
    """best-effort 读取流终止标志：statusUpdate.final 或 .last。"""
    p = event_payload(ev)
    if not isinstance(p, dict):
        return False
    su = p.get("statusUpdate")
    if isinstance(su, dict):
        return bool(su.get("final") or su.get("last"))
    return False


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
        url = self.base_url + A2A_ENDPOINT
        method = body.get("method") if isinstance(body, dict) else None
        method = method or "POST"
        headers = {"Content-Type": "application/json", "Accept": accept}
        record_request(method, url, headers, body)
        with httpx.Client(timeout=self.timeout, proxy=None) as client:
            resp = client.post(url, content=json.dumps(body), headers=headers)
            try:
                parsed = resp.json()
            except Exception:
                parsed = getattr(resp, "text", "<no-text>")
            record_response(method, resp.status_code, parsed)
            return resp

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
        url = self.base_url + A2A_ENDPOINT
        method = body.get("method") if isinstance(body, dict) else None
        method = method or "POST"
        headers = {"Content-Type": "application/json", "Accept": "text/event-stream"}
        record_request(method, url, headers, body)
        t0 = time.time()
        idx = 0
        with httpx.Client(timeout=self.timeout, proxy=None) as client:
            with client.stream(
                "POST", url,
                content=json.dumps(body), headers=headers,
            ) as resp:
                for event in self._parse_sse_lines(resp.iter_lines()):
                    idx += 1
                    record_sse_event(idx, t0, event)  # 实时记录后即透传
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
        url = self.base_url + AGENT_CARD_PATHS[0]
        headers = {"Accept": "application/json"}
        record_request("GET", url, headers, None)
        with httpx.Client(timeout=self.timeout, proxy=None) as client:
            resp = client.get(url)
            try:
                parsed = resp.json()
            except Exception:
                parsed = getattr(resp, "text", "<no-text>")
            record_response("GET", resp.status_code, parsed)
            return parsed

    def raw_post(self, body: Union[str, dict], *, accept="application/json"):
        """发任意（含非法）请求体，用于协议合规负向用例。返回 httpx.Response。"""
        import httpx  # lazy import
        url = self.base_url + A2A_ENDPOINT
        content = body if isinstance(body, str) else json.dumps(body)
        method = body.get("method") if isinstance(body, dict) else "POST"
        method = method or "POST"
        headers = {"Content-Type": "application/json", "Accept": accept}
        record_request(method, url, headers, body)  # body 可能是非法字符串，原样记录
        with httpx.Client(timeout=self.timeout, proxy=None) as client:
            resp = client.post(url, content=content, headers=headers)
            try:
                parsed = resp.json()
            except Exception:
                parsed = getattr(resp, "text", "<no-text>")
            record_response(method, resp.status_code, parsed)
            return resp
