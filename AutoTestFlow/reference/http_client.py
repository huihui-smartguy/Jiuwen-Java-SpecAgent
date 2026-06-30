# -*- coding: utf-8 -*-
"""通用黑盒 HTTP 客户端 + 交互轨迹记录器（generic, 协议无关）。

本模块是 stage4 生成的 pytest 用例所复用的**通用黑盒脚手架**：
  - `HttpClient`：只依赖 HTTP/SSE 形态，不触碰被测系统(SUT)内部组件，
    提供 get / post_json / stream / raw_post 四个原语；
  - 交互轨迹记录器（recorder）：把 test-agent ↔ SUT 的请求/响应/SSE 逐帧
    打印 + 落盘（优先 AUTOTESTFLOW_TRACE_DIR，兼容 A2A_TRACE_DIR）。

设计纪律（沿用已验证的 A2A 客户端）：
  - httpx **惰性导入**：本模块即便未安装 httpx 也能被 import（供 --dry-run / 静态校验）。
  - recorder 纯 Python、无 httpx 依赖；任何异常都吞掉，**绝不影响被测流程**。
  - 请求头脱敏（Authorization/token 类）。

> ⚠️ 本文件**不含任何协议特化**（如 A2A 的 send_message/get_task、JSON-RPC 常量、
>   task_of/event_kind/event_state）。具体协议形态以 stage2.5 的 `contract.md` 为准；
>   A2A 的具体特化见 `examples/a2a/a2a_client.py`（扩展本通用模式）。
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
# 0. 交互轨迹记录器（recorder）——把 test-agent ↔ SUT 的请求/响应/SSE 落盘+打印
#    纯 Python，无 httpx 依赖；任何异常都吞掉，绝不影响被测流程。
# ---------------------------------------------------------------------------
LOG = logging.getLogger("autotestflow")

# 当前用例名（conftest 在每个用例开始时 set_current_case 注入）。
_current_case = contextvars.ContextVar("autotestflow_case", default="session")

# 需要脱敏的请求头（大小写不敏感子串匹配）。
_REDACT_HEADER_HINTS = ("authorization", "token", "cookie", "secret", "api-key", "apikey")


def set_current_case(name: str) -> None:
    """设置当前用例名（用于 trace 文件名 / 日志 case 字段）。"""
    try:
        _current_case.set(name or "session")
    except Exception:
        pass


def trace_dir_from_env() -> Optional[str]:
    """Return the configured trace directory, preferring the generic env var."""
    return os.environ.get("AUTOTESTFLOW_TRACE_DIR") or os.environ.get("A2A_TRACE_DIR")


def _trace_path() -> Optional[str]:
    """若设置 trace dir 则返回 {dir}/{case}.jsonl（并确保目录存在），否则 None。"""
    d = trace_dir_from_env()
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
    """补充 ts/case，把结构化记录追加进 trace（人类可读行由调用方 LOG）。"""
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
    """记录 client→SUT 的一次请求。"""
    try:
        red = _redact_headers(headers)
        if isinstance(body, str):
            body_str = body
            body_rec = body
        else:
            body_str = _safe_dumps(body)
            body_rec = body
        LOG.info(">>> [client→sut] %s %s", method, url)
        LOG.info("    headers=%s", _compact_dumps(red))
        LOG.info("    body=\n%s", body_str)
        _emit({"kind": "request", "method": method, "url": url,
               "headers": red, "body": body_rec})
    except Exception:
        pass


def record_response(method, status_code, body) -> None:
    """记录 SUT→client 的一次响应。"""
    try:
        LOG.info("<<< [sut→client] HTTP %s (%s)", status_code, method)
        LOG.info("    body=\n%s", _safe_dumps(body))
        _emit({"kind": "response", "method": method,
               "status_code": status_code, "body": body})
    except Exception:
        pass


def record_sse_event(idx, t0, ev) -> None:
    """记录一条实时到达的 SSE 事件（协议无关：不解读事件语义）。"""
    try:
        try:
            elapsed_ms = int((time.time() - t0) * 1000)
        except Exception:
            elapsed_ms = -1
        name = None
        try:
            if isinstance(ev, dict):
                name = ev.get("event")
        except Exception:
            pass
        LOG.info("<<< [SSE] #%s (+%sms) event=%s", idx, elapsed_ms, name)
        LOG.info("    data=%s", _compact_dumps(ev))
        _emit({"kind": "sse_event", "idx": idx, "elapsed_ms": elapsed_ms,
               "event": ev})
    except Exception:
        pass


# ---------------------------------------------------------------------------
# 1. 通用 helpers（协议无关，断言侧可复用）
# ---------------------------------------------------------------------------
DEFAULT_BASE_URL = "http://localhost:8080"


def base_url_from_env() -> str:
    """读取环境变量 BASE_URL，默认 http://localhost:8080。"""
    return os.environ.get("BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def id_eq(a, b) -> bool:
    """类型容差的 id 比较（例如 SUT 把请求 id 回带成 int、请求侧用 str）。"""
    return str(a) == str(b)


def normalize_state(state: Optional[str]) -> Optional[str]:
    """容错带前缀的状态枚举写法（如 protobuf-JSON 的 TASK_STATE_* 全名）。"""
    if state is None:
        return None
    return state[len("TASK_STATE_"):] if state.startswith("TASK_STATE_") else state


def parse_sse_lines(lines) -> Iterator[dict]:
    """将 SSE 文本行解析为 {'event':..., 'data': {<json or text>}} 事件 dict。

    通用解析器：只按 SSE 协议拆分 event/data 字段，不解读载荷语义。
    """
    event_name = None
    data_buf = []
    for raw in lines:
        line = raw if isinstance(raw, str) else raw.decode("utf-8", "replace")
        line = line.rstrip("\n")
        if line == "":
            if data_buf:
                payload = "\n".join(data_buf)
                try:
                    data = json.loads(payload)
                except (ValueError, json.JSONDecodeError):
                    data = payload
                yield {"event": event_name or "message", "data": data}
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
        yield {"event": event_name or "message", "data": data}


# ---------------------------------------------------------------------------
# 2. 通用黑盒 HTTP 客户端（httpx 在每个方法内惰性导入）
# ---------------------------------------------------------------------------
class HttpClient:
    """通用黑盒 HTTP 客户端。

    只依赖 HTTP/SSE 协议形态：get / post_json / stream / raw_post 四个原语，
    每次交互都经 recorder 记录。httpx 在每个方法内惰性导入。
    协议特化（请求体构造、响应字段访问）请在子类或独立模块实现，
    具体形态以 stage2.5 的 contract.md 为准。
    """

    def __init__(self, base_url: Optional[str] = None, timeout: float = 35.0):
        self.base_url = (base_url or base_url_from_env()).rstrip("/")
        self.timeout = timeout

    def _url(self, path: str) -> str:
        if not path:
            return self.base_url
        return self.base_url + (path if path.startswith("/") else "/" + path)

    def get(self, path: str, *, accept="application/json"):
        """GET 一个路径（如 discovery/health/agent-card）。返回 httpx.Response。"""
        import httpx  # lazy import
        url = self._url(path)
        headers = {"Accept": accept}
        record_request("GET", url, headers, None)
        with httpx.Client(timeout=self.timeout, proxy=None) as client:
            resp = client.get(url, headers=headers)
            record_response("GET", resp.status_code, _parse_response(resp))
            return resp

    def post_json(self, path: str, body, *, accept="application/json"):
        """POST 一个 JSON 请求体。返回 httpx.Response。"""
        import httpx  # lazy import
        url = self._url(path)
        headers = {"Content-Type": "application/json", "Accept": accept}
        record_request("POST", url, headers, body)
        with httpx.Client(timeout=self.timeout, proxy=None) as client:
            resp = client.post(url, content=json.dumps(body), headers=headers)
            record_response("POST", resp.status_code, _parse_response(resp))
            return resp

    def stream(self, path: str, body, *, accept="text/event-stream") -> Iterator[dict]:
        """POST 流式请求，逐事件 yield 解析后的 SSE 事件 dict（实时记录每条事件）。"""
        import httpx  # lazy import
        url = self._url(path)
        headers = {"Content-Type": "application/json", "Accept": accept}
        record_request("POST", url, headers, body)
        t0 = time.time()
        idx = 0
        with httpx.Client(timeout=self.timeout, proxy=None) as client:
            with client.stream("POST", url,
                               content=json.dumps(body), headers=headers) as resp:
                for event in parse_sse_lines(resp.iter_lines()):
                    idx += 1
                    record_sse_event(idx, t0, event)  # 实时记录后即透传
                    yield event

    def raw_post(self, path: str, body: Union[str, dict], *, accept="application/json"):
        """发任意（含非法）请求体，用于协议合规负向用例。返回 httpx.Response。"""
        import httpx  # lazy import
        url = self._url(path)
        content = body if isinstance(body, str) else json.dumps(body)
        headers = {"Content-Type": "application/json", "Accept": accept}
        record_request("POST", url, headers, body)  # body 可能是非法字符串，原样记录
        with httpx.Client(timeout=self.timeout, proxy=None) as client:
            resp = client.post(url, content=content, headers=headers)
            record_response("POST", resp.status_code, _parse_response(resp))
            return resp


def _parse_response(resp):
    """尽力把 httpx.Response 解析为 JSON，失败回退 text。"""
    try:
        return resp.json()
    except Exception:
        return getattr(resp, "text", "<no-text>")
