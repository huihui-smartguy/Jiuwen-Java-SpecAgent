#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""probe_contract.py —— 用运行中的被测服务(SUT)校准真实契约（generic, 协议无关）。

stage2.5「契约校准」的探针脚本：探活 + 采样真实响应/SSE，把“响应包装/字段/
枚举/错误码/SSE 事件形态”等以**真实证据**写入 contract_samples.json，供编排器
据此产出 contract.md。Oracle/断言一律以 contract.md 为准，禁止臆测。

探针集是**通用 / 配置驱动**的，默认一组协议无关探针：
  1. GET 一个发现/健康路径（discovery / health / card）
  2. POST 一个样例请求（正向）
  3. POST 一个畸形请求体（malformed-body，期望解析/校验错误）
  4. POST 一个流式请求（streaming，读取至多 N 个 SSE 事件）
所有探针经 `--base-url`（或环境变量 BASE_URL）参数化。

> A2A 端点（/a2a + /.well-known/agent-card.json + JSON-RPC envelope）作为一组**有文档说明的
>   默认示例探针集**提供（见下方 A2A_EXAMPLE_PROBES），它**只是一个示例**，并非唯一真相；
>   针对其他 SUT 请按其 contract 替换探针集。

设计原则：
  - httpx **惰性导入**：本模块即便未安装 httpx 也能 import / --dry-run。
  - 每个探针独立 try/except：一个失败不影响其它探针。
  - SUT 完全不可达：写 reachable=false + 回退说明，**exit 0**（让 stage 能回退到
    静态源推导，而不是崩溃）。
  - observed 字段从真实响应**启发式**推导（字段名尽量通用）。

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

# ---------------------------------------------------------------------------
# 0a. 代理豁免 —— 探针直连 SUT， 不经过系统/企业 HTTP 代理。
#     在任何 httpx 导入前执行，确保 httpx 不会将请求错误路由到不可达的代理。
# ---------------------------------------------------------------------------
os.environ.setdefault("no_proxy", "")
if os.environ.get("no_proxy") != "*":
    os.environ["no_proxy"] = os.environ.get("no_proxy", "") + ",*"
os.environ["NO_PROXY"] = os.environ["no_proxy"]


# httpx 不在模块顶层导入；仅在真正发请求时惰性导入（见 _http_post / _http_get）。

MAX_SSE_EVENTS = 5  # 流式探针最多读取的 SSE 事件数


# ===========================================================================
# A2A 示例探针集（DEFAULT EXAMPLE — 仅作示例，非唯一真相）
# ---------------------------------------------------------------------------
# 下面这组常量/构造器是针对 A2A/JSON-RPC 协议的**示例**默认探针集。
# 针对其他 Java/Spring SUT 时，按其 contract 提供等价的 discovery/sample/malformed/
# streaming 探针即可——本脚本的通用探针框架（_default_probe_plan / probe）与具体协议解耦。
# ===========================================================================
A2A_ENDPOINT = "/a2a"
A2A_AGENT_CARD_PATH = "/.well-known/agent-card.json"


def _a2a_envelope(method, params, req_id):
    """【A2A 示例】构造 JSON-RPC envelope。"""
    return {"jsonrpc": "2.0", "method": method, "id": req_id, "params": params}


def _a2a_message(text):
    """【A2A 示例】构造 message params。"""
    return {"message": {"role": "ROLE_USER",
                        "content": [{"text": text}],
                        "messageId": uuid.uuid4().hex}}


def a2a_example_probes():
    """【A2A 示例】返回一组针对 A2A/JSON-RPC 的具体探针描述（供 default 使用）。

    每个探针描述：{name, method, path, accept, body, stream, note}。
    body 为 None 表示 GET / 由探针构造。
    """
    return [
        {"name": "discovery", "method": "GET", "path": A2A_AGENT_CARD_PATH,
         "accept": "application/json", "body": None, "stream": False,
         "note": "【A2A 示例】GET AgentCard 作为发现/探活端点"},
        {"name": "sample_request", "method": "POST", "path": A2A_ENDPOINT,
         "accept": "application/json",
         "body": _a2a_envelope("SendMessage", _a2a_message("ping from probe_contract"), 1),
         "stream": False, "note": "【A2A 示例】正向 SendMessage（sync）"},
        {"name": "malformed_body", "method": "POST", "path": A2A_ENDPOINT,
         "accept": "application/json", "body": '{"jsonrpc":"2.0","method":',
         "stream": False, "note": "畸形请求体（非法 JSON）→ 期望 parse/validation error"},
        {"name": "streaming", "method": "POST", "path": A2A_ENDPOINT,
         "accept": "text/event-stream",
         "body": _a2a_envelope("SendStreamingMessage",
                              _a2a_message("stream from probe_contract"), 11),
         "stream": True, "note": "流式：读取至多 %d 个 SSE 事件" % MAX_SSE_EVENTS},
    ]


# ===========================================================================
# 通用探针计划
# ---------------------------------------------------------------------------
# 默认采用 A2A 示例探针集；这是当前 skill 的工作锚点。若要适配其它 SUT，
# 在此替换为该 SUT 的探针集（保持 discovery/sample/malformed/streaming 四类骨架）。
# ===========================================================================
def _default_probe_plan(base_url):
    """返回默认探针集（当前为 A2A 示例）。每项含发起请求所需的全部信息。"""
    return a2a_example_probes()


# ---------------------------------------------------------------------------
# 惰性 HTTP 助手（httpx 在此处导入）
# ---------------------------------------------------------------------------
def _http_post(url, body, accept, timeout):
    """POST，返回 (status_code, parsed_or_text)。失败抛异常由调用方捕获。"""
    import httpx  # 惰性导入
    headers = {"Content-Type": "application/json", "Accept": accept}
    data = body if isinstance(body, str) else json.dumps(body)
    with httpx.Client(timeout=timeout, proxy=None) as client:
        resp = client.post(url, content=data, headers=headers)
    return resp.status_code, _parse_body(resp)


def _http_post_stream(url, body, accept, timeout, max_events):
    """POST 流式请求，读取至多 max_events 个 SSE 事件，返回 (status, [events])。"""
    import httpx  # 惰性导入
    headers = {"Content-Type": "application/json", "Accept": accept}
    events = []
    with httpx.Client(timeout=timeout, proxy=None) as client:
        with client.stream("POST", url, content=json.dumps(body),
                          headers=headers) as resp:
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
    with httpx.Client(timeout=timeout, proxy=None) as client:
        resp = client.get(url, headers={"Accept": accept})
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
    """把一组 `data: ...` 行拼成 JSON 对象（协议无关）。"""
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
# observed 启发式推导（字段名尽量通用）
# ---------------------------------------------------------------------------
def _observe(response):
    """从真实响应启发式提取 observed 形态特征（通用字段名）。"""
    obs = {
        "response_wrapper": None,    # "result.<sub>" / "result" / "<bare>" / None
        "id_type": None,             # "int" / "str" / "bool" / None
        "state_enum_prefix": None,   # 检出的枚举前缀 / "<bare>" / None
        "error_code": None,          # 检出的错误码
    }
    if not isinstance(response, dict):
        return obs

    # 回带 id 类型（请求 id 在响应中的回带类型）
    if "id" in response:
        rid = response["id"]
        if isinstance(rid, bool):
            obs["id_type"] = "bool"
        elif isinstance(rid, int):
            obs["id_type"] = "int"
        elif isinstance(rid, str):
            obs["id_type"] = "str"

    # 错误码采样：兼容 error.code / code 两种常见位置
    err = response.get("error")
    if isinstance(err, dict) and "code" in err:
        obs["error_code"] = err["code"]
    elif "code" in response and not isinstance(response.get("code"), dict):
        obs["error_code"] = response["code"]

    # 响应包装 + 内层状态枚举前缀
    result = response.get("result")
    inner = None
    if isinstance(result, dict):
        # 检出单层子包装（如 result.task / result.data）
        sub_keys = [k for k, v in result.items() if isinstance(v, (dict, list))]
        if len(sub_keys) == 1:
            obs["response_wrapper"] = "result.%s" % sub_keys[0]
            v = result[sub_keys[0]]
            inner = v[0] if isinstance(v, list) and v else (v if isinstance(v, dict) else None)
        else:
            obs["response_wrapper"] = "result"
            inner = result
    elif "data" in response and isinstance(response["data"], (dict, list)):
        obs["response_wrapper"] = "data"
        d = response["data"]
        inner = d[0] if isinstance(d, list) and d else (d if isinstance(d, dict) else None)

    state = _find_state(inner)
    if isinstance(state, str):
        obs["state_enum_prefix"] = _state_prefix(state)
    return obs


def _find_state(obj):
    """启发式找一个 state/status 字段值（通用）。"""
    if not isinstance(obj, dict):
        return None
    st = obj.get("status")
    if isinstance(st, dict):
        for k in ("state", "status", "phase"):
            if isinstance(st.get(k), str):
                return st[k]
    for k in ("state", "status", "phase"):
        if isinstance(obj.get(k), str):
            return obj[k]
    return None


def _state_prefix(state):
    """检出形如 `XXX_STATE_` / `XXX_STATUS_` 的全名枚举前缀，否则 <bare>。"""
    if "_" in state:
        head = state.split("_")
        if len(head) >= 3 and head[1] in ("STATE", "STATUS", "PHASE"):
            return "_".join(head[:2]) + "_"
    return "<bare>"


def _observe_sse(events):
    """从 SSE 事件序列推导事件骨架键（通用：列出每帧顶层非元信息键）。"""
    kinds = []
    for ev in events:
        if not isinstance(ev, dict):
            kinds.append(None)
            continue
        res = ev.get("result", ev)
        if not isinstance(res, dict):
            kinds.append(None)
            continue
        keys = [k for k in res.keys() if k not in ("jsonrpc", "id")]
        kinds.append(keys[0] if len(keys) == 1 else (keys or None))
    return kinds or None


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
# 真实探测（配置驱动：遍历探针计划）
# ---------------------------------------------------------------------------
def probe(base_url, timeout):
    samples = []
    notes = []
    base = base_url.rstrip("/")

    for p in _default_probe_plan(base):
        name = p["name"]
        method = p.get("method", "POST")
        path = p.get("path", "")
        accept = p.get("accept", "application/json")
        url = base + (path if path.startswith("/") else "/" + path)
        req_meta = {"method": method, "url": url}
        if p.get("note"):
            req_meta["note"] = p["note"]
        try:
            if p.get("stream"):
                status, events = _http_post_stream(url, p.get("body"), accept,
                                                   timeout, MAX_SSE_EVENTS)
                obs = {"sse_event_kinds": _observe_sse(events)}
                samples.append(_sample(name, req_meta, status, events, obs))
            elif method.upper() == "GET":
                status, body = _http_get(url, accept, timeout)
                samples.append(_sample(name, req_meta, status, body, _observe(body)))
                # 通用观察：发现端点返回体里 base/url 类字段为空的部署配置提示
                if isinstance(body, dict) and ("url" in body or "endpoint" in body) \
                        and not (body.get("url") or body.get("endpoint")):
                    notes.append("发现端点的 url/endpoint 为空 —— 疑部署 base-url 未配置"
                                 "（deployment-config-dependent，非 spec 缺陷）")
            else:
                body = p.get("body")
                if isinstance(body, str):
                    req_meta["body"] = "<malformed>"
                status, resp = _http_post(url, body, accept, timeout)
                samples.append(_sample(name, req_meta, status, resp, _observe(resp)))
        except Exception as e:
            notes.append("%s 探针失败: %r" % (name, e))

    return samples, notes


# ---------------------------------------------------------------------------
# dry-run 骨架
# ---------------------------------------------------------------------------
def build_dry_run(base_url):
    plan = _default_probe_plan(base_url)
    samples = [_sample(p["name"],
                       {"method": p.get("method", "POST"), "path": p.get("path", ""),
                        "note": p.get("note", "")},
                       None, None,
                       {"response_wrapper": None, "id_type": None,
                        "state_enum_prefix": None, "error_code": None,
                        "sse_event_kinds": None}) for p in plan]
    return {
        "status": "dry_run",
        "base_url": base_url,
        "probed_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "reachable": None,
        "samples": samples,
        "notes": ["dry_run：未发起任何网络请求；以上为探针计划骨架（当前为 A2A 示例探针集）。"
                  "正式校准请去掉 --dry-run 并确保 SUT 在 %s 就绪。" % base_url],
    }


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def main(argv=None):
    parser = argparse.ArgumentParser(
        description="校准真实契约（stage2.5 契约校准探针，generic）")
    parser.add_argument("--base-url",
                        default=os.environ.get("BASE_URL", "http://localhost:8080"),
                        help="被测服务基址（默认 env BASE_URL 或 http://localhost:8080）")
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
        print("[probe_contract] DRY-RUN —— 探针计划（当前为 A2A 示例探针集）：")
        for p in _default_probe_plan(base_url):
            print("  - %-16s %s %s%s" % (
                p["name"], p.get("method", ""),
                base_url, p.get("path", "")))
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
