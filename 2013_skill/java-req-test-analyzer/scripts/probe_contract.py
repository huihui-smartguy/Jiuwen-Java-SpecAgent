#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""probe_contract.py —— 用运行中的被测服务(SUT)校准真实 A2A 契约。

stage2.5「契约校准」的探针脚本：探活 + 采样真实响应/SSE，把"响应包装/字段/
枚举/错误码/SSE 事件形态"等以**真实证据**写入 contract_samples.json，供编排器
据此产出 contract.md。Oracle/断言一律以 contract.md 为准，禁止臆测。

设计原则（对齐上轮 R1–R4 根因）：
  - httpx **惰性导入**：本模块即便未安装 httpx 也能 import / --dry-run。
  - 每个探针独立 try/except：一个失败不影响其它探针。
  - SUT 完全不可达：写 reachable=false + 回退说明，**exit 0**（让 stage 能回退到
    静态源推导，而不是崩溃）。
  - observed 字段从真实响应**启发式**推导：result.task 包装 / id int-vs-str /
    TASK_STATE_ 前缀 / SSE oneof(task/statusUpdate/artifactUpdate) / error.code。

用法：
  python3 probe_contract.py --base-url http://localhost:8080 --output contract_samples.json
  python3 probe_contract.py --dry-run            # 无网络：打印探针计划 + 写骨架样本
"""

import os
import sys
import json
import uuid
import socket
import argparse
import datetime

# httpx 不在模块顶层导入；仅在真正发请求时惰性导入（见 _http_post / _http_get）。

A2A_ENDPOINT = "/a2a"
AGENT_CARD_PATHS = ["/.well-known/agent-card.json", "/.well-known/agent.json"]
MAX_SSE_EVENTS = 5  # SendStreamingMessage 最多读取的 SSE 事件数


# ---------------------------------------------------------------------------
# 惰性 HTTP 助手（httpx 在此处导入）
# ---------------------------------------------------------------------------
def _http_post(url, body, accept, timeout):
    """POST JSON，返回 (status_code, parsed_or_text)。失败抛异常由调用方捕获。"""
    import httpx  # 惰性导入
    headers = {"Content-Type": "application/json", "Accept": accept}
    data = body if isinstance(body, str) else json.dumps(body)
    resp = httpx.post(url, content=data, headers=headers, timeout=timeout)
    return resp.status_code, _parse_body(resp)


def _http_post_stream(url, body, timeout, max_events):
    """POST 流式请求，读取至多 max_events 个 SSE 事件，返回 (status, [events])。"""
    import httpx  # 惰性导入
    headers = {"Content-Type": "application/json", "Accept": "text/event-stream"}
    events = []
    with httpx.stream("POST", url, content=json.dumps(body),
                      headers=headers, timeout=timeout) as resp:
        status = resp.status_code
        buf = []
        for line in resp.iter_lines():
            if line is None:
                continue
            line = line if isinstance(line, str) else line.decode("utf-8", "replace")
            if line.strip() == "":
                ev = _parse_sse_block(buf)
                buf = []
                if ev is not None:
                    events.append(ev)
                    if len(events) >= max_events:
                        break
            else:
                buf.append(line)
    return status, events


def _http_get(url, accept, timeout):
    import httpx  # 惰性导入
    resp = httpx.get(url, headers={"Accept": accept}, timeout=timeout)
    return resp.status_code, _parse_body(resp)


def _parse_body(resp):
    try:
        return resp.json()
    except Exception:
        try:
            return resp.text
        except Exception:
            return None


def _parse_sse_block(lines):
    """把一组 `data: ...` 行拼成 JSON 对象。"""
    payload = []
    for ln in lines:
        if ln.startswith("data:"):
            payload.append(ln[len("data:"):].lstrip())
    if not payload:
        return None
    raw = "".join(payload)
    try:
        return json.loads(raw)
    except Exception:
        return {"_raw": raw}


# ---------------------------------------------------------------------------
# JSON-RPC envelope
# ---------------------------------------------------------------------------
def _envelope(method, params, req_id):
    return {"jsonrpc": "2.0", "method": method, "id": req_id, "params": params}


def _message(text):
    return {"message": {"role": "ROLE_USER",
                        "content": [{"text": text}],
                        "messageId": uuid.uuid4().hex}}


# ---------------------------------------------------------------------------
# observed 启发式推导
# ---------------------------------------------------------------------------
def _observe(name, request_body, response):
    """从真实响应启发式提取 observed 形态特征。"""
    obs = {
        "result_wrapper": None,      # "result.task" / "result.tasks" / "result" / None
        "id_type": None,             # "int" / "str" / None
        "state_enum_prefix": None,   # "TASK_STATE_" / "<bare>" / None
        "sse_event_kinds": None,     # ["task","statusUpdate","artifactUpdate"]
        "error_codes": None,         # [-32700, ...]
    }
    if not isinstance(response, dict):
        return obs

    # id 类型（JSON-RPC 回带 id）—— R2 根因
    if "id" in response:
        rid = response["id"]
        if isinstance(rid, bool):
            obs["id_type"] = "bool"
        elif isinstance(rid, int):
            obs["id_type"] = "int"
        elif isinstance(rid, str):
            obs["id_type"] = "str"

    # error.code —— 错误码采样
    err = response.get("error")
    if isinstance(err, dict) and "code" in err:
        obs["error_codes"] = [err["code"]]

    result = response.get("result")
    if isinstance(result, dict):
        # result.task / result.tasks 包装 —— R1 根因
        if "task" in result:
            obs["result_wrapper"] = "result.task"
            task = result.get("task")
        elif "tasks" in result:
            obs["result_wrapper"] = "result.tasks"
            tasks = result.get("tasks")
            task = tasks[0] if isinstance(tasks, list) and tasks else None
        else:
            obs["result_wrapper"] = "result"
            task = result
        # 枚举前缀（status.state）
        state = None
        if isinstance(task, dict):
            st = task.get("status")
            if isinstance(st, dict):
                state = st.get("state")
            state = state or task.get("state")
        if isinstance(state, str):
            obs["state_enum_prefix"] = "TASK_STATE_" if state.startswith("TASK_STATE_") else "<bare>"

    return obs


def _observe_sse(events):
    """从 SSE 事件序列推导 oneof 事件骨架名 —— R3 根因。"""
    kinds = []
    for ev in events:
        if not isinstance(ev, dict):
            continue
        res = ev.get("result", ev)
        if not isinstance(res, dict):
            continue
        for key in ("task", "statusUpdate", "artifactUpdate"):
            if key in res:
                kinds.append(key)
                break
        else:
            kinds.append(None)
    return kinds or None


# ---------------------------------------------------------------------------
# 探针计划（dry-run 与真实探测共用同一份描述）
# ---------------------------------------------------------------------------
def _probe_plan(base_url):
    return [
        {"name": "agent_card",
         "request": {"method": "GET", "path": AGENT_CARD_PATHS[0]}},
        {"name": "send_message_sync",
         "request": {"method": "POST", "path": A2A_ENDPOINT,
                     "rpc": "SendMessage", "accept": "application/json"}},
        {"name": "parse_error",
         "request": {"method": "POST", "path": A2A_ENDPOINT,
                     "note": "malformed body (非法 JSON) → 期望 parse error"}},
        {"name": "unknown_method",
         "request": {"method": "POST", "path": A2A_ENDPOINT,
                     "rpc": "NoSuchMethod"}},
        {"name": "get_missing_task",
         "request": {"method": "POST", "path": A2A_ENDPOINT,
                     "rpc": "GetTask", "note": "随机不存在 task id"}},
        {"name": "send_streaming_message",
         "request": {"method": "POST", "path": A2A_ENDPOINT,
                     "rpc": "SendStreamingMessage",
                     "accept": "text/event-stream",
                     "note": "读取至多 %d 个 SSE 事件" % MAX_SSE_EVENTS}},
    ]


def _sample(name, request, http_status, response_or_events, observed):
    return {"name": name, "request": request, "http_status": http_status,
            "response_or_events": response_or_events, "observed": observed}


# ---------------------------------------------------------------------------
# 可达性预检
# ---------------------------------------------------------------------------
def _host_port(base_url):
    rest = base_url.split("://", 1)[-1].split("/", 1)[0]
    if ":" in rest:
        host, port = rest.rsplit(":", 1)
        try:
            return host, int(port)
        except ValueError:
            return host, 80
    return rest, 443 if base_url.startswith("https") else 80


def _reachable(base_url, timeout):
    """TCP 预检：不依赖 httpx，避免在 SUT 全不可达时做无谓重试。"""
    try:
        host, port = _host_port(base_url)
        with socket.create_connection((host, port), timeout=min(timeout, 5)):
            return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# 真实探测
# ---------------------------------------------------------------------------
def probe(base_url, timeout):
    samples = []
    notes = []
    a2a_url = base_url.rstrip("/") + A2A_ENDPOINT

    # 1) GET agent-card
    try:
        card_url = base_url.rstrip("/") + AGENT_CARD_PATHS[0]
        status, body = _http_get(card_url, "application/json", timeout)
        samples.append(_sample("agent_card",
                               {"method": "GET", "url": card_url},
                               status, body, _observe("agent_card", None, body)))
        if isinstance(body, dict) and not (body.get("url") or body.get("endpoint")):
            notes.append("AgentCard.url/endpoint 为空 —— 疑部署 public-base-url 未配置"
                         "(deployment-config-dependent，非 spec 缺陷)")
    except Exception as e:
        notes.append("agent_card 探针失败: %r" % e)

    # 2) POST SendMessage (sync)
    try:
        body = _envelope("SendMessage", _message("ping from probe_contract"), 1)
        status, resp = _http_post(a2a_url, body, "application/json", timeout)
        samples.append(_sample("send_message_sync",
                               {"method": "POST", "url": a2a_url, "rpc": "SendMessage"},
                               status, resp, _observe("send_message_sync", body, resp)))
    except Exception as e:
        notes.append("send_message_sync 探针失败: %r" % e)

    # 3) POST malformed body (parse error)
    try:
        status, resp = _http_post(a2a_url, '{"jsonrpc":"2.0","method":', "application/json", timeout)
        samples.append(_sample("parse_error",
                               {"method": "POST", "url": a2a_url, "body": "<malformed JSON>"},
                               status, resp, _observe("parse_error", None, resp)))
    except Exception as e:
        notes.append("parse_error 探针失败: %r" % e)

    # 4) POST unknown method
    try:
        body = _envelope("NoSuchMethod", {}, 42)
        status, resp = _http_post(a2a_url, body, "application/json", timeout)
        samples.append(_sample("unknown_method",
                               {"method": "POST", "url": a2a_url, "rpc": "NoSuchMethod"},
                               status, resp, _observe("unknown_method", body, resp)))
    except Exception as e:
        notes.append("unknown_method 探针失败: %r" % e)

    # 5) POST GetTask of a random missing id
    try:
        missing = "missing-" + uuid.uuid4().hex
        body = _envelope("GetTask", {"id": missing}, 7)
        status, resp = _http_post(a2a_url, body, "application/json", timeout)
        samples.append(_sample("get_missing_task",
                               {"method": "POST", "url": a2a_url, "rpc": "GetTask",
                                "params": {"id": missing}},
                               status, resp, _observe("get_missing_task", body, resp)))
    except Exception as e:
        notes.append("get_missing_task 探针失败: %r" % e)

    # 6) POST SendStreamingMessage (SSE)
    try:
        body = _envelope("SendStreamingMessage", _message("stream from probe_contract"), 11)
        status, events = _http_post_stream(a2a_url, body, timeout, MAX_SSE_EVENTS)
        obs = {"sse_event_kinds": _observe_sse(events)}
        samples.append(_sample("send_streaming_message",
                               {"method": "POST", "url": a2a_url,
                                "rpc": "SendStreamingMessage", "accept": "text/event-stream"},
                               status, events, obs))
    except Exception as e:
        notes.append("send_streaming_message 探针失败: %r" % e)

    return samples, notes


# ---------------------------------------------------------------------------
# dry-run 骨架
# ---------------------------------------------------------------------------
def build_dry_run(base_url):
    plan = _probe_plan(base_url)
    samples = [_sample(p["name"], p["request"], None, None,
                       {"result_wrapper": None, "id_type": None,
                        "state_enum_prefix": None, "sse_event_kinds": None,
                        "error_codes": None}) for p in plan]
    return {
        "status": "dry_run",
        "base_url": base_url,
        "probed_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "reachable": None,
        "samples": samples,
        "notes": ["dry_run：未发起任何网络请求；以上为探针计划骨架。"
                  "正式校准请去掉 --dry-run 并确保 SUT 在 %s 就绪。" % base_url],
    }


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def main(argv=None):
    parser = argparse.ArgumentParser(
        description="校准真实 A2A 契约（stage2.5 契约校准探针）")
    parser.add_argument("--base-url",
                        default=os.environ.get("A2A_BASE_URL", "http://localhost:8080"),
                        help="被测服务基址（默认 env A2A_BASE_URL 或 http://localhost:8080）")
    parser.add_argument("--output", default="contract_samples.json",
                        help="输出 JSON 路径（默认 contract_samples.json）")
    parser.add_argument("--dry-run", action="store_true",
                        help="不发网络请求，仅打印探针计划并写骨架样本(status=dry_run)")
    parser.add_argument("--timeout", type=float, default=10.0,
                        help="单请求超时秒数（默认 10）")
    args = parser.parse_args(argv)

    base_url = args.base_url.rstrip("/")

    # ---- dry-run：无网络、无 httpx ----
    if args.dry_run:
        result = build_dry_run(base_url)
        print("[probe_contract] DRY-RUN —— 探针计划：")
        for p in _probe_plan(base_url):
            req = p["request"]
            print("  - %-24s %s %s%s" % (
                p["name"], req.get("method", ""),
                base_url, req.get("path", "")))
        _write(args.output, result)
        print("[probe_contract] 已写骨架样本 → %s (status=dry_run)" % args.output)
        return 0

    # ---- 真实探测 ----
    if not _reachable(base_url, args.timeout):
        result = {
            "status": "unreachable",
            "base_url": base_url,
            "probed_at": datetime.datetime.now().isoformat(timespec="seconds"),
            "reachable": False,
            "samples": [],
            "notes": ["SUT unreachable — calibration must fall back to static "
                      "source derivation"],
        }
        _write(args.output, result)
        print("[probe_contract] SUT 不可达 %s —— 写 reachable=false，"
              "stage2.5 应回退到静态源推导(读 SUT 源/SDK)。" % base_url)
        return 0  # 关键：不可达也 exit 0，让 stage 能回退而非崩溃

    samples, notes = probe(base_url, args.timeout)
    result = {
        "status": "probed",
        "base_url": base_url,
        "probed_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "reachable": True,
        "samples": samples,
        "notes": notes,
    }
    _write(args.output, result)
    print("[probe_contract] 已采样 %d 个探针 → %s" % (len(samples), args.output))
    return 0


def _write(path, obj):
    d = os.path.dirname(os.path.abspath(path))
    if d and not os.path.isdir(d):
        os.makedirs(d, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    sys.exit(main())
