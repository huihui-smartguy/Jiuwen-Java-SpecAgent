#!/usr/bin/env python3
"""
match_faults.py - 阶段2.6：TestKnowledgeBase 知识/故障匹配

在 stage2.5 产出 contract.md 之后、stage3a/3b 之前运行。把 TestKnowledgeBase
注册表或 Fault/*.json 包中的知识条目匹配到 s1 场景，并用 contract.md 的「字段权威性分级表」对每条故障的
断言级别做契约优先封顶（spec-required→至多L2；config-dependent/契约静默/未知→降L0/L1）。
产出 KnowledgeBase/knowledge_matches.json，并保留 KnowledgeBase/fault_matches.json 兼容下游 stage3b/stage5。

纯确定性脚本（无 LLM、无网络），可单测、可复现。缺库/关闭/无 contract.md 时优雅退出，
不产出任何文件，流水线与未接入故障库时字节级一致。

用法：
    python match_faults.py --output-dir <dir> [--knowledge-root TestKnowledgeBase]
                           [--knowledge-domain rest_api|web|agent|dfx]
                           [--fault-lib <explicit-legacy-path>] [--fault-overlay <path>]
                           [--faults auto|on|off] [--max-exception 3] [--max-quality 2]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from knowledge_base import (
    default_knowledge_root,
    load_faults as load_knowledge_faults,
    parse_domain_filter,
)
import output_layout as layout


# ---------------- 通用 IO（与其它脚本保持一致） ----------------

def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, data, indent=2):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)


def read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# ---------------- contract.md 解析（权威性分级表 + specId 目录） ----------------

# 断言级别按权威性封顶：spec-required→L2；config-dependent→L1；needs-runtime-verify/未知→L0
_LEVEL_RANK = {"L0": 0, "L1": 1, "L2": 2, "L3": 3}
_AUTHORITY_CAP = {
    "spec-required": "L2",
    "deployment-config-dependent": "L1",
    "config-dependent": "L1",
    "needs-runtime-verify": "L0",
    "unknown": "L0",
}


def _cap_level(level: str, authority: str) -> str:
    cap = _AUTHORITY_CAP.get(authority, "L0")
    want = level if level in _LEVEL_RANK else "L1"
    return want if _LEVEL_RANK[want] <= _LEVEL_RANK[cap] else cap


def parse_contract(contract_path: str) -> dict:
    """解析 contract.md：返回 {specid: authority} 映射、错误码 specId 列表、是否含 SSE。

    宽松解析（容忍格式漂移）：
      - 从 §7 字段权威性分级表的每一行确定 specId 的权威性（看哪一列有 ✅/✓/yes）。
      - 从各节标题 "（specId: SPEC-XXX）" 收集 specId。
      - 从错误码目录行 "| -32601 | ... |" 生成 SPEC-ERR-32601。
    未在权威性表中出现的 specId 一律按 needs-runtime-verify 处理（保守降级，契约安全）。
    """
    text = read_text(contract_path)
    authority = {}        # specId -> authority
    present = set()       # 出现过的 specId（含表 + 标题 + 错误码）

    # 1) 节标题里的 specId（如 "## 4. 流式/SSE 事件（specId: SPEC-SSE）"）
    for m in re.finditer(r"specId\s*[:：]\s*(SPEC-[A-Z0-9\-]+)", text):
        present.add(m.group(1).rstrip("-"))

    # 2) 错误码目录：行内出现 -32xxx → SPEC-ERR-32xxx
    for m in re.finditer(r"\|\s*(-?3\d{4})\s*\|", text):
        code = m.group(1)
        present.add(f"SPEC-ERR-{code.lstrip('-')}")

    # 3) §7 权威性分级表：解析 markdown 表格行
    #    列：| specId | 字段/形态 | spec-required | deployment-config-dependent | needs-runtime-verify | 来源 |
    def _checked(cell: str) -> bool:
        return bool(re.search(r"[✅✔√xX]|yes|YES|是", cell.strip()))

    for line in text.splitlines():
        if "SPEC-" not in line or line.count("|") < 4:
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        spec_cell = next((c for c in cells if c.startswith("SPEC-")), None)
        if not spec_cell:
            continue
        # 取首个 SPEC- token 作为 specId
        sm = re.search(r"SPEC-[A-Z0-9\-]+", spec_cell)
        if not sm:
            continue
        specid = sm.group(0).rstrip("-")
        present.add(specid)
        idx = cells.index(spec_cell)
        # 权威性三列紧随 字段列 之后：spec_cell, 字段, [spec-required, config-dependent, needs-runtime-verify], 来源
        tri = cells[idx + 2: idx + 5]
        if len(tri) >= 3:
            if _checked(tri[0]):
                authority[specid] = "spec-required"
            elif _checked(tri[1]):
                authority[specid] = "deployment-config-dependent"
            elif _checked(tri[2]):
                authority[specid] = "needs-runtime-verify"

    error_specids = sorted(s for s in present if s.startswith("SPEC-ERR-"))
    has_sse = "SPEC-SSE" in present
    return {
        "authority": authority,
        "present": present,
        "error_specids": error_specids,
        "has_sse": has_sse,
    }


def authority_of(contract: dict, specid: str) -> str:
    """specId 的权威性；未在权威性表中出现 → needs-runtime-verify（保守）。"""
    if specid in contract["authority"]:
        return contract["authority"][specid]
    if specid.startswith("SPEC-ERR-") and specid in contract["present"]:
        # 错误码契约通常为协议必需
        return "spec-required"
    return "needs-runtime-verify"


# ---------------- 故障库加载 + 项目级 overlay 合并 ----------------

def _norm_cat(category_id: str) -> str:
    """category_id 形如 'FC-REQ-001' → 归一为 'FC-REQ'（供分支/specId 映射判定）。"""
    parts = category_id.split("-")
    return "-".join(parts[:2]) if len(parts) >= 2 else category_id


def _substitute(obj, params: dict):
    """把 {placeholder} 占位符替换为 parameter_config 中的具体值（递归）。"""
    if isinstance(obj, str):
        def repl(m):
            key = m.group(1)
            return str(params.get(key, m.group(0)))
        return re.sub(r"\{([a-zA-Z0-9_]+)\}", repl, obj)
    if isinstance(obj, list):
        return [_substitute(x, params) for x in obj]
    if isinstance(obj, dict):
        return {k: _substitute(v, params) for k, v in obj.items()}
    return obj


def load_faults(
    fault_lib_path,
    overlay_path,
    knowledge_root,
    domains,
):
    """Load TestKnowledgeBase packages through the generalized adapter."""
    return load_knowledge_faults(fault_lib_path, overlay_path, knowledge_root, domains)


# ---------------- 场景加载 + 关联字段/流式判定 ----------------

_REF_FIELD_RE = re.compile(
    r"(agentId|userId|sessionId|parentId|contextId|taskId|resourceId|tenantId"
    r"|[a-zA-Z]+Id|[a-zA-Z]+_id)$"
)
_STREAM_KW = ("sse", "stream", "streaming", "流式", "流", "订阅", "subscribe", "推送")
_READONLY_KW = ("查询", "get", "list", "获取", "读取", "发现", "card")
_REST_KW = ("api", "http", "json-rpc", "rpc", "request", "response", "接口", "请求", "响应")
_AGENT_KW = ("agent", "a2a", "llm", "prompt", "tool", "task", "message", "智能体", "工具", "对话")
_WEB_KW = (
    "web", "frontend", "front_tool", "front-tool", "browser", "page", "form", "input", "click",
    "页面", "前端", "表单", "输入框",
)


def _looks_streaming(text: str) -> bool:
    t = (text or "").lower()
    return any(k in t for k in _STREAM_KW)


def _is_reference_field(name: str) -> bool:
    if not name:
        return False
    if name.lower() == "id":
        return False  # 裸 id 不作为"关联资源"字段
    return bool(_REF_FIELD_RE.search(name))


def _domains_from_text(text: str) -> set:
    text = (text or "").lower()
    domains = set()
    if any(k in text for k in _REST_KW):
        domains.add("rest_api")
    if any(k in text for k in _AGENT_KW):
        domains.add("agent")
    if any(k in text for k in _WEB_KW):
        domains.add("web")
    return domains


def _manifest_candidates(output_dir: str) -> list[str]:
    out = os.path.abspath(output_dir)
    candidates = [
        os.path.join(out, "RunMetadata", "sut_manifest.normalized.json"),
        os.path.join(os.path.dirname(os.path.dirname(out)), "RunMetadata", "sut_manifest.normalized.json"),
    ]
    parts = out.split(os.sep)
    if "targets" in parts:
        idx = len(parts) - 1 - parts[::-1].index("targets")
        root = os.sep.join(parts[:idx]) or os.sep
        candidates.append(os.path.join(root, "RunMetadata", "sut_manifest.normalized.json"))
    seen = []
    for path in candidates:
        if path not in seen:
            seen.append(path)
    return seen


def _load_target_metadata(output_dir: str) -> dict:
    for manifest_path in _manifest_candidates(output_dir):
        if not os.path.exists(manifest_path):
            continue
        try:
            manifest = load_json(manifest_path)
        except Exception:
            continue
        targets = manifest.get("targets", [])
        output_abs = os.path.abspath(output_dir)
        for target in targets:
            if os.path.abspath(str(target.get("target_output_dir", ""))) == output_abs:
                return target
        if "targets" in output_abs.split(os.sep):
            target_id = os.path.basename(output_abs)
            for target in targets:
                if target.get("id") == target_id:
                    return target
    return {}


def _infer_scene_domains(haystack: str, code_facts: dict, target_meta: dict | None = None) -> list:
    text = (haystack or "").lower()
    domains = _domains_from_text(text)
    target_meta = target_meta or {}
    target_text = " ".join([
        str(target_meta.get("id", "")),
        str(target_meta.get("name", "")),
        str(target_meta.get("role", "")),
        str(target_meta.get("knowledge_domain", "")),
        str((target_meta.get("source") or {}).get("path", "")),
        str((code_facts.get("meta") or {}).get("primary_profile", "")),
        str((code_facts.get("meta") or {}).get("language", "")),
        json.dumps(code_facts.get("frameworks", []), ensure_ascii=False),
    ]).lower()
    domains.update(_domains_from_text(target_text))
    knowledge_domain = str(target_meta.get("knowledge_domain", "")).strip()
    if knowledge_domain in _DOMAIN_VALUES:
        domains.add(knowledge_domain)
    if code_facts.get("entry_catalog"):
        domains.add("rest_api")
    if not domains and code_facts.get("meta"):
        domains.add("rest_api")
    return sorted(domains or {"rest_api"})


def build_scenes(output_dir: str, code_facts: dict) -> list:
    """从 s1_index + s1_scenarios 构建场景列表，附 is_streaming / is_write / reference_fields。"""
    idx_path = layout.existing_target_artifact(output_dir, "s1_index")
    scenes = []
    if not os.path.exists(idx_path):
        return scenes

    s1 = load_json(idx_path)
    target_meta = _load_target_metadata(output_dir)

    # 端点级关联字段（来自 code_facts.entry_catalog 的参数名）
    endpoint_ref_fields = []
    for e in code_facts.get("entry_catalog", []):
        for p in e.get("params", []):
            nm = p.get("name", "")
            # 支持 "metadata.agentId" 取末段判断
            leaf = nm.split(".")[-1]
            if _is_reference_field(leaf):
                endpoint_ref_fields.append(nm)
    endpoint_ref_fields = sorted(set(endpoint_ref_fields))

    for s in s1.get("scenario_index", []):
        sid = s.get("id")
        scene = {
            "id": sid,
            "name": s.get("name", ""),
            "type": s.get("type", "flow"),
            "priority": s.get("priority", "P2"),
            "fp_refs": s.get("fp_refs", []),
            "is_streaming": False,
            "is_write": True,
            "reference_fields": list(endpoint_ref_fields),
        }
        # 读取单场景文件补充判定
        scene_file = s.get("file", f"FeatureAnalysis/s1_scenarios/{sid}.json")
        fpath = scene_file if os.path.isabs(scene_file) else os.path.join(output_dir, scene_file)
        if not os.path.exists(fpath):
            fpath = os.path.join(output_dir, ".state", s.get("file", f"s1_scenarios/{sid}.json"))
        blob = ""
        if os.path.exists(fpath):
            try:
                sc = load_json(fpath)
                blob = json.dumps(sc, ensure_ascii=False)
                # 场景级关联字段（data_scope）
                for st in sc.get("steps", []):
                    ds = st.get("data_scope", "")
                    for tok in re.split(r"[\s,，、/]+", ds):
                        leaf = tok.split(".")[-1]
                        if _is_reference_field(leaf):
                            scene["reference_fields"].append(tok)
            except Exception:
                blob = ""
        scene["reference_fields"] = sorted(set(scene["reference_fields"]))
        hay = scene["name"] + " " + blob
        scene["is_streaming"] = _looks_streaming(hay)
        scene["domains"] = _infer_scene_domains(hay, code_facts, target_meta)
        scene["text"] = hay
        # 纯查询场景（只读）：名字含查询/get/list 且不含写语义关键字
        nm = scene["name"].lower()
        if any(k in nm for k in _READONLY_KW) and not _looks_streaming(nm):
            scene["is_write"] = False
        scenes.append(scene)
    return scenes


# ---------------- 故障 → 候选 specId 映射（表驱动启发式） ----------------

def candidate_spec_kinds(fault: dict) -> list:
    """根据 TestKnowledgeBase metadata/category/tags 给出候选 specId 种类（有序、去重）。
    种类：RESP_WRAP / ID_TYPE / ENUM / SSE / ERR / CARD。
    """
    cat = fault.get("_category", "")
    tags = set(fault.get("tags", []))
    tags_lower = {t.lower() for t in tags}
    kinds = []

    def add(k):
        if k not in kinds:
            kinds.append(k)

    for k in fault.get("_contract_kinds", []):
        add(k)

    if cat == "FC-SSE" or "SSE" in tags:
        add("SSE")
    if "stream" in tags_lower or "streaming" in tags_lower or "流式" in tags:
        add("SSE")
    if "枚举一致性" in tags or "枚举" in tags or "enum" in tags_lower:
        add("ENUM")
    if "类型一致性" in tags or "id" in tags_lower:
        add("ID_TYPE")
    if cat == "FC-PROTO" or "协议合规" in tags or "JSON-RPC" in tags:
        add("ERR")
        add("ID_TYPE")
    if cat in ("FC-STATE", "FC-BUSINESS") or "状态机" in tags or "资源不存在" in tags or "关联资源校验" in tags:
        add("RESP_WRAP")
        add("ERR")
    if cat in ("FC-REQ", "FC-WEB", "FC-AGENT", "FC-DFX"):
        add("RESP_WRAP")
    if cat == "FC-REQ":
        add("ERR")
        add("RESP_WRAP")
    if cat == "FC-RES":
        add("RESP_WRAP")
    if "发现机制" in tags or "A2A特有" in tags or "card" in {t.lower() for t in tags}:
        add("CARD")
    # 兜底锚点：保证有 RESP_WRAP / ID_TYPE 可挂
    add("RESP_WRAP")
    add("ID_TYPE")
    return kinds


def resolve_specids(kinds: list, contract: dict, fault: dict) -> list:
    """把 specId 种类解析为 contract 中真实存在的 specId（去重、保序）。

    ERR 种类只解析为*单个*错误码 specId（error.code 不能同时断言多个值）：
    优先 fault 文本里显式提到的 -32xxx；否则用通用 SPEC-ERR-32603；再否则取首个错误码。
    """
    out = []

    def push(sid):
        if sid and sid not in out:
            out.append(sid)

    ftext = json.dumps(fault.get("test_strategy", {}), ensure_ascii=False)
    em = re.search(r"-(3\d{4})", ftext)
    explicit_err = f"SPEC-ERR-{em.group(1)}" if (em and f"SPEC-ERR-{em.group(1)}" in contract["present"]) else None

    for k in kinds:
        if k == "SSE":
            push("SPEC-SSE")
        elif k == "ID_TYPE":
            push("SPEC-ID-TYPE")
        elif k == "RESP_WRAP":
            push("SPEC-RESP-WRAP")
        elif k == "ENUM":
            push("SPEC-ENUM")
        elif k == "CARD":
            # 卡片类 specId 可能是 SPEC-CARD 或 SPEC-CARD-URL
            for s in sorted(contract["present"]):
                if s.startswith("SPEC-CARD"):
                    push(s)
            push("SPEC-CARD")
        elif k == "ERR":
            if explicit_err:
                push(explicit_err)
            elif "SPEC-ERR-32603" in contract["present"]:
                push("SPEC-ERR-32603")
            elif contract["error_specids"]:
                push(contract["error_specids"][0])
            else:
                push("SPEC-ERR")  # 占位（多半会降级）
    return out


# ---------------- 单条故障 → oracle_refs（契约优先封顶） ----------------

def build_oracle_refs(fault: dict, contract: dict):
    """返回 (oracle_refs, reconciliation)。

    reconciliation: aligned（全部命中 spec-required 且未降级）/ downgraded（存在降级）。
    保证：若 contract 中 SPEC-RESP-WRAP 或 SPEC-ID-TYPE 为 spec-required，则至少挂 1 条 L2 锚点。
    """
    strat = fault.get("test_strategy", {})
    want_level = strat.get("assertion_level", "L2")
    vpoints = strat.get("validation_points", []) or []
    kinds = candidate_spec_kinds(fault)
    specids = resolve_specids(kinds, contract, fault)

    oracle_refs = []
    downgraded = False
    field_for = {
        "SPEC-RESP-WRAP": "result.<obj>.status.state",
        "SPEC-ID-TYPE": "id",
        "SPEC-ENUM": "result.<obj>.status.state",
        "SPEC-SSE": "event.kind / last_event.status.state",
    }
    for i, sid in enumerate(specids):
        auth = authority_of(contract, sid)
        lvl = _cap_level(want_level, auth)
        if _LEVEL_RANK[lvl] < _LEVEL_RANK.get(want_level, 2):
            downgraded = True
        field = field_for.get(sid)
        if field is None:
            field = "error.code" if sid.startswith("SPEC-ERR") else "<field>"
        oracle_refs.append({
            "spec_id": sid,
            "field": field,
            "assert_level": lvl,
            "authority": auth,
            "validation_point": vpoints[i] if i < len(vpoints) else (vpoints[0] if vpoints else ""),
        })

    # 锚点保证：确保 ≥1 条 spec-required 的 L2
    has_l2_anchor = any(
        o["assert_level"] == "L2" and o["authority"] == "spec-required" for o in oracle_refs
    )
    if not has_l2_anchor:
        for anchor in ("SPEC-RESP-WRAP", "SPEC-ID-TYPE"):
            if authority_of(contract, anchor) == "spec-required" and anchor in contract["present"]:
                if not any(o["spec_id"] == anchor for o in oracle_refs):
                    oracle_refs.append({
                        "spec_id": anchor,
                        "field": field_for.get(anchor, "<field>"),
                        "assert_level": "L2",
                        "authority": "spec-required",
                        "validation_point": "锚点：保证用例含 spec-required L2 断言",
                    })
                else:
                    for o in oracle_refs:
                        if o["spec_id"] == anchor:
                            o["assert_level"] = "L2"
                            o["authority"] = "spec-required"
                has_l2_anchor = True
                break

    reconciliation = "downgraded" if (downgraded or not has_l2_anchor) else "aligned"
    return oracle_refs, reconciliation


def _strategy_text(fault: dict) -> str:
    strat = fault.get("test_strategy") or {}
    return " ".join([
        str(strat.get("trigger_pattern", "")),
        str(strat.get("expected_behavior", "")),
        " ".join(str(v) for v in strat.get("validation_points", []) or []),
        " ".join(str(t) for t in fault.get("tags", []) or []),
        str(fault.get("name", "")),
        str(fault.get("description", "")),
    ])


def _expected_http_status(text: str):
    for pat in (r"HTTP状态码\s*[=:：]?\s*(\d{3})", r"返回\s*(\d{3})", r"\b(400|401|403|404|408|409|413|429|500|502|503|504)\b"):
        m = re.search(pat, text or "")
        if m:
            return int(m.group(1))
    return None


def _expected_error_code(oracle_refs: list, text: str):
    for o in oracle_refs:
        sid = o.get("spec_id", "")
        if sid.startswith("SPEC-ERR-"):
            code = sid.replace("SPEC-ERR-", "")
            if code.isdigit():
                return -int(code)
    m = re.search(r"error\.code[^\-\d]*(-?\d+)", text or "", flags=re.IGNORECASE)
    return int(m.group(1)) if m else None


def _fault_authority(oracle_refs: list) -> str:
    if any(o.get("authority") == "spec-required" and o.get("assert_level") == "L2" for o in oracle_refs):
        return "spec-required"
    return "fault-required"


def build_fault_oracles(fault: dict, oracle_refs: list, contract: dict) -> list:
    """Normalize fault-library expectations into machine-checkable trace oracles.

    Every fault-driven case must include at least one required process/negative oracle
    so a successful final response cannot mask intermediate defects.
    """
    text = _strategy_text(fault)
    lower = text.lower()
    tags = {str(t).lower() for t in fault.get("tags", []) or []}
    authority = _fault_authority(oracle_refs)
    expected_status = _expected_http_status(text)
    expected_error = _expected_error_code(oracle_refs, text)
    has_expected_error = expected_status is not None or expected_error is not None
    cat = fault.get("_category", "")

    oracles = []

    def add(kind, check, expected=None, source="", required=True, spec_id=None, field=None):
        item = {
            "id": f"{fault.get('fault_id', 'FAULT')}:{check}:{len(oracles) + 1}",
            "kind": kind,
            "check": check,
            "required": bool(required),
            "authority": authority,
            "assert_level": "L2" if authority in {"spec-required", "fault-required"} else "L1",
            "source": source or "TestKnowledgeBase",
            "on_unobservable": "requires_human_review" if required else "record_observation",
        }
        if expected is not None:
            item["expected"] = expected
        if spec_id:
            item["spec_id"] = spec_id
        if field:
            item["field"] = field
        oracles.append(item)

    if expected_status is not None or expected_error is not None:
        add("outcome", "error_code_matches", {
            "http_status": expected_status,
            "error_code": expected_error,
        }, "test_strategy.expected_behavior / validation_points")

    expected_5xx = expected_status is not None and expected_status >= 500
    if not expected_5xx:
        add("negative", "no_unexpected_5xx", {"max_status": 499}, "fault default negative oracle")

    if not has_expected_error:
        add("negative", "no_unexpected_error_frame", {"forbidden_field": "error"}, "fault default negative oracle")

    if any(o.get("spec_id") == "SPEC-ID-TYPE" for o in oracle_refs) or "回带" in text or "correlation" in lower:
        add("process", "correlation_id_preserved", {"field": "id"}, "SPEC-ID-TYPE / validation_points",
            spec_id="SPEC-ID-TYPE", field="id")

    is_sse = (
        "sse" in lower or "stream" in lower or "流式" in text or "中断" in text
        or "SSE" in {str(t) for t in fault.get("tags", []) or []}
        or any(o.get("spec_id") == "SPEC-SSE" for o in oracle_refs)
        or contract.get("has_sse") and cat == "FC-SSE"
    )
    if is_sse:
        add("process", "sse_terminal_state", {"terminal_states": ["COMPLETED", "FAILED", "CANCELED", "CANCELLED", "ERROR", "DONE", "SUCCESS"]},
            "SSE/stream fault oracle", spec_id="SPEC-SSE", field="last_event.status.state")
        add("negative", "no_duplicate_terminal_event", {"terminal_states": ["COMPLETED", "FAILED", "CANCELED", "CANCELLED", "ERROR", "DONE", "SUCCESS"]},
            "SSE/stream fault oracle", spec_id="SPEC-SSE", field="events")

    if any(k in text for k in ("不创建", "不执行操作", "不重复处理", "不产生副作用", "状态不变", "重复提交", "幂等")):
        add("negative", "resource_not_created", {"requires_followup_observation": True}, "validation_points")
        add("negative", "state_not_mutated", {"requires_followup_observation": True}, "validation_points")

    if any(k in text for k in ("重试", "超时", "降级", "熔断", "退避")) or tags & {"超时", "降级", "重试", "熔断"}:
        add("process", "retry_or_timeout_observed", {"signals": ["retry", "timeout", "fallback", "degraded", "cache"]}, "validation_points")

    # Hard guarantee: every fault case has at least one required process/negative oracle.
    if not any(o["required"] and o["kind"] in {"process", "negative"} for o in oracles):
        add("process", "trace_observed", {"min_records": 2}, "mandatory fallback process oracle")

    return oracles


def enrich_hint(fault: dict, oracle_refs: list, reconciliation: str):
    """计算 LLM 增强提示（阶段2.6b 用）。返回 {needs_bind, unbound_points, hints} 或 None。

    置位条件（脚本难以确定性处理、值得 LLM 复核）：
      - 存在未被任何 oracle_ref 绑定的 validation_point（specId 映射不足）；
      - reconciliation==downgraded（契约静默/降级，LLM 可复核是否另有合适 specId 或确属观察）；
      - 残留 {placeholder}（overlay 未被 parameter_config 替换）。
    """
    vpoints = (fault.get("test_strategy") or {}).get("validation_points") or []
    covered = {o.get("validation_point", "") for o in oracle_refs if o.get("validation_point")}
    unbound = [vp for vp in vpoints if vp and vp not in covered]
    blob = json.dumps({"t": fault.get("test_strategy"), "o": oracle_refs, "tr": fault.get("trigger", "")},
                      ensure_ascii=False)
    residual = bool(re.search(r"\{[a-zA-Z0-9_]+\}", blob))
    if not (unbound or reconciliation == "downgraded" or residual):
        return None
    hints = []
    if unbound:
        hints.append("bind_validation_points")
    if reconciliation == "downgraded":
        hints.append("recheck_downgrade_or_conflict")
    if residual:
        hints.append("substitute_placeholder")
    return {"needs_bind": True, "unbound_points": unbound, "hints": hints}


# ---------------- 故障 → 适用场景 + 分支类别/优先级 ----------------

_BRANCH_BY_CAT = {
    "FC-REQ": "exception",
    "FC-RES": "quality",
    "FC-PROTO": "exception",
    "FC-STATE": "boundary",
    "FC-BUSINESS": "boundary",
    "FC-SSE": "quality",
    "FC-SEC": "quality",
    "FC-PERF": "quality",
    "FC-WEB": "quality",
    "FC-AGENT": "quality",
    "FC-DFX": "quality",
}


def branch_class_of(fault: dict) -> str:
    if fault.get("_is_history"):
        tags = set(fault.get("tags", []))
        if "SSE" in tags:
            return "quality"
        if "协议合规" in tags or "JSON-RPC" in tags:
            return "exception"
        return "quality"
    if fault.get("_branch_class"):
        return fault["_branch_class"]
    return _BRANCH_BY_CAT.get(fault.get("_category", ""), "quality")


def priority_of(fault: dict) -> str:
    if fault.get("_is_history"):
        return "P0"  # 历史缺陷强制 P0（README/03 设计）
    sev = fault.get("severity", "中")
    return {"高": "P1", "中": "P2", "低": "P2"}.get(sev, "P2")


_DOMAIN_VALUES = {"rest_api", "web", "agent", "dfx"}


def _new_domain_stat():
    return {
        "considered": 0,
        "matched": 0,
        "filtered": 0,
        "truncated": 0,
        "considered_by_branch": defaultdict(int),
        "matched_by_branch": defaultdict(int),
        "filtered_by_branch": defaultdict(int),
        "truncated_by_branch": defaultdict(int),
    }


def _bump_domain_stat(stats: dict, domain: str, field: str, branch: str | None = None, amount: int = 1):
    domain = domain or "rest_api"
    item = stats.setdefault(domain, _new_domain_stat())
    item[field] += amount
    if branch:
        item[f"{field}_by_branch"][branch] += amount


def _reset_matched_domain_stats(stats: dict):
    for item in stats.values():
        item["matched"] = 0
        item["matched_by_branch"].clear()


def _serialize_domain_breakdown(stats: dict) -> dict:
    out = {}
    for domain, item in sorted(stats.items()):
        out[domain] = {
            "considered": item["considered"],
            "matched": item["matched"],
            "filtered": item["filtered"],
            "truncated": item["truncated"],
            "considered_by_branch": dict(sorted(item["considered_by_branch"].items())),
            "matched_by_branch": dict(sorted(item["matched_by_branch"].items())),
            "filtered_by_branch": dict(sorted(item["filtered_by_branch"].items())),
            "truncated_by_branch": dict(sorted(item["truncated_by_branch"].items())),
        }
    return out


def _as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _keyword_hit(keywords, text):
    lower = (text or "").lower()
    for kw in keywords or []:
        if str(kw).lower() in lower:
            return str(kw)
    return None


def _domain_applies(fault, scene):
    scene_domains = set(scene.get("domains", []))
    fault_domain = fault.get("_domain", "rest_api")
    signals = fault.get("_scenario_signals", {}) or {}
    include_domains = set(signals.get("include_domains") or [])
    applicable_domains = {v for v in _as_list(fault.get("applicable_scenarios")) if v in _DOMAIN_VALUES}
    reasons = []

    allowed = applicable_domains or include_domains
    if fault_domain == "dfx" or signals.get("cross_cutting"):
        allowed = allowed or {"rest_api", "web", "agent"}
        ok = bool(scene_domains & allowed)
    elif allowed:
        ok = fault_domain in scene_domains or bool(scene_domains & allowed)
    else:
        ok = fault_domain in scene_domains

    if ok:
        reasons.append(f"domain:{fault_domain}")
    return ok, reasons


def scene_applies(fault: dict, scene: dict) -> tuple:
    """判断 非历史 fault 是否适用于 scene；返回 (applies, reasons)。历史缺陷在主流程单独指派。"""
    cat = fault.get("_category", "")
    tags = set(fault.get("tags", []))
    tags_lower = {t.lower() for t in tags}
    match_rule = fault.get("_match_rule", {}) or {}
    reasons = []

    domain_ok, domain_reasons = _domain_applies(fault, scene)
    if not domain_ok:
        return False, reasons
    reasons.extend(domain_reasons)

    if cat in ("FC-SEC", "FC-PERF") and fault.get("_domain") == "rest_api" and not fault.get("_category_rule"):
        return False, reasons

    scene_text = scene.get("text", "") + " " + scene.get("name", "")
    required_keywords = match_rule.get("keywords", [])
    if required_keywords:
        hit = _keyword_hit(required_keywords, scene_text)
        if not hit:
            return False, reasons
        reasons.append(f"keyword:{hit}")

    is_sse_fault = (
        (cat == "FC-SSE")
        or ("SSE" in tags)
        or ("stream" in tags_lower)
        or ("streaming" in tags_lower)
        or match_rule.get("requires_streaming")
    )
    is_ref_fault = ("关联资源校验" in tags) or ("资源不存在" in tags) or (fault.get("fault_id") == "F-REQ-011")

    if is_sse_fault:
        if scene["is_streaming"]:
            reasons.append("streaming_scene")
            return True, reasons
        return False, reasons

    if match_rule.get("requires_reference") or is_ref_fault:
        if scene["reference_fields"]:
            reasons.append(f"reference_field:{scene['reference_fields'][0]}")
            return True, reasons
        if scene["is_write"] and (match_rule.get("requires_write_or_reference") or is_ref_fault):
            reasons.append("write_scene")
            return True, reasons
        return False, reasons

    if match_rule.get("requires_write") or cat == "FC-REQ":
        if scene["is_write"]:
            reasons.append("write_scene")
            return True, reasons
        return False, reasons

    if match_rule.get("requires_write_or_reference"):
        if scene["is_write"]:
            reasons.append("write_scene")
            return True, reasons
        if scene["reference_fields"]:
            reasons.append(f"reference_field:{scene['reference_fields'][0]}")
            return True, reasons
        return False, reasons

    if cat in ("FC-PROTO", "FC-RES", "FC-STATE", "FC-BUSINESS", "FC-WEB", "FC-AGENT", "FC-DFX"):
        reasons.append(f"category:{cat}")
        return True, reasons

    reasons.append("package_default")
    return True, reasons


def _target_endpoint(scene: dict, code_facts: dict, fault: dict) -> dict:
    entry = ""
    ec = code_facts.get("entry_catalog", [])
    if ec:
        e = ec[0]
        entry = f"{e.get('class','')}.{e.get('method','')}".strip(".")
    verbs = [
        v for v in fault.get("applicable_scenarios", [])
        if isinstance(v, str) and v.upper() in {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
    ]
    return {
        "http_method": verbs[0].upper() if verbs else "POST",
        "rpc_method": scene.get("name", ""),
        "path": code_facts.get("meta", {}).get("base_path", ""),
        "entry": entry,
    }


# ---------------- 主流程 ----------------

def match(
    output_dir: str,
    fault_lib,
    overlay,
    max_exception: int,
    max_quality: int,
    knowledge_root=None,
    domains=None,
) -> dict:
    contract_path = layout.existing_target_artifact(output_dir, "contract")

    if not os.path.exists(contract_path):
        print(f"[match_faults] 跳过：未找到 {contract_path}（纯需求模式或 stage2.5 未产出）")
        return {}
    if fault_lib and not os.path.exists(fault_lib):
        print(f"[match_faults] 跳过：未找到故障库 {fault_lib}")
        return {}
    if not fault_lib:
        knowledge_root = knowledge_root or default_knowledge_root()
        if not os.path.exists(knowledge_root):
            print(f"[match_faults] 跳过：未找到知识库 {knowledge_root}")
            return {}

    contract = parse_contract(contract_path)
    faults, lib_meta, overlay_meta = load_faults(fault_lib, overlay, knowledge_root, domains)
    if not faults:
        print("[match_faults] 跳过：未加载到可匹配的 TestKnowledgeBase 条目")
        return {}

    code_facts_path = layout.existing_target_artifact(output_dir, "s2_code_facts")
    code_facts = load_json(code_facts_path) if os.path.exists(code_facts_path) else {}
    scenes = build_scenes(output_dir, code_facts)

    considered = len(faults)
    non_history = [f for f in faults if not f.get("_is_history")]
    history = [f for f in faults if f.get("_is_history")]
    matches = []
    stats = defaultdict(int)
    domain_breakdown = {}
    sev_rank = {"高": 0, "中": 1, "低": 2}
    for fault in faults:
        _bump_domain_stat(
            domain_breakdown,
            fault.get("_domain", "rest_api"),
            "considered",
            branch_class_of(fault),
        )

    def _make_match(fault, scene, reasons):
        oracle_refs, recon = build_oracle_refs(fault, contract)
        fault_oracles = build_fault_oracles(fault, oracle_refs, contract)
        rs = list(reasons)
        rs.append(f"tag:{(fault.get('tags') or ['-'])[0]}")
        m = {
            "fault_id": fault.get("fault_id"),
            "knowledge_id": fault.get("fault_id"),
            "name": fault.get("name", fault.get("description", "")),
            "severity": fault.get("severity", "中"),
            "domain": fault.get("_domain", "rest_api"),
            "knowledge_package": fault.get("_package_id"),
            "category_id": fault.get("_category_id"),
            "match_reason": rs,
            "target_endpoints": [_target_endpoint(scene, code_facts, fault)],
            "target_scenes": [scene["id"]],
            "target_fps": scene.get("fp_refs", []),
            "branch_class": branch_class_of(fault),
            "priority": priority_of(fault),
            "trigger": fault.get("test_strategy", {}).get("trigger_pattern", ""),
            "expected_behavior_raw": fault.get("test_strategy", {}).get("expected_behavior", ""),
            "oracle_refs": oracle_refs,
            "fault_oracles": fault_oracles,
            "reconciliation": recon,
            "source": "history" if fault.get("_is_history") else
                      ("project" if fault.get("_category") == "PROJECT" else "global"),
        }
        hint = enrich_hint(fault, oracle_refs, recon)
        if hint:
            m["enrich"] = hint  # 阶段2.6b（可选 LLM 增强）据此精化绑定/占位/冲突
        return m

    def _relevance(m):
        joined = " ".join(m["match_reason"])
        # 关联字段命中、流式场景的 SSE 故障：最相关，优先保留不被配额截断
        return 2 if ("reference_field" in joined or "streaming_scene" in joined) else 1

    # 1) 非历史故障：逐场景匹配，按知识域+分支类别配额（关联字段匹配优先保留）
    cap = {"exception": max_exception, "quality": max_quality, "boundary": max_exception}
    for scene in scenes:
        buckets = defaultdict(list)
        for fault in non_history:
            domain = fault.get("_domain", "rest_api")
            bclass = branch_class_of(fault)
            applies, reasons = scene_applies(fault, scene)
            if not applies:
                _bump_domain_stat(domain_breakdown, domain, "filtered", bclass)
                continue
            buckets[(domain, bclass)].append(_make_match(fault, scene, reasons))
        for (domain, bclass), items in buckets.items():
            items.sort(key=lambda m: (-_relevance(m), sev_rank.get(m["severity"], 1), m["fault_id"]))
            limit = cap.get(bclass, max_quality)
            truncated = max(0, len(items) - limit)
            stats["truncated"] += truncated
            if truncated:
                _bump_domain_stat(domain_breakdown, domain, "truncated", bclass, truncated)
            matches.extend(items[:limit])

    # 2) 历史缺陷：每条指派到一个最相关场景（避免跨场景泛滥），强制 P0
    write_scenes = [s for s in scenes if s["is_write"]]
    stream_scenes = [s for s in scenes if s["is_streaming"]]
    for fault in history:
        tags = set(fault.get("tags", []))
        if "SSE" in tags and stream_scenes:
            target = stream_scenes[0]
        elif write_scenes:
            target = write_scenes[0]
        elif scenes:
            target = scenes[0]
        else:
            continue
        matches.append(_make_match(fault, target, [f"history:{fault.get('test_case_id','')}"]))

    seen = set()
    deduped = []
    for m in matches:
        key = (m["fault_id"], tuple(m["target_scenes"]))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(m)
    matches = deduped

    # 统计：matched/downgraded 基于去重后的最终结果，避免跨 bucket 重复计数。
    _reset_matched_domain_stats(domain_breakdown)
    stats["downgraded"] = 0
    for m in matches:
        _bump_domain_stat(domain_breakdown, m.get("domain", "rest_api"), "matched", m.get("branch_class"))
        if m["reconciliation"] == "downgraded":
            stats["downgraded"] += 1

    plan = {
        "meta": {
            "knowledge_base_version": lib_meta.get("version"),
            "fault_lib_version": lib_meta.get("version"),
            "knowledge_source": lib_meta.get("source"),
            "knowledge_root": lib_meta.get("knowledge_root"),
            "knowledge_packages": lib_meta.get("packages", []),
            "overlay_version": (overlay_meta or {}).get("version"),
            "contract_path": layout.relpath(layout.target_artifact(output_dir, "contract"), output_dir),
            "generated_by": "match_faults.py",
            "contract_probe_status": "reachable" if contract["authority"] else "unreachable",
            "stats": {
                "faults_considered": considered,
                "scenes": len(scenes),
                "matched": len(matches),
                "downgraded": stats["downgraded"],
                "truncated": stats["truncated"],
                "enrichment_needed": sum(1 for m in matches if m.get("enrich", {}).get("needs_bind")),
                "domain_breakdown": _serialize_domain_breakdown(domain_breakdown),
            },
        },
        "knowledge_matches": matches,
        "fault_matches": matches,
    }
    return plan


def write_alignment_report(output_dir: str, plan: dict):
    """可选副产物：故障-契约对齐报告（替代 README 设想的 validate_fault_contract.py 输出）。"""
    lines = ["# 故障-契约对齐报告（match_faults.py 自动产出）", ""]
    lines.append(f"- 故障库版本：{plan['meta'].get('fault_lib_version')}")
    lines.append(f"- 匹配故障数：{plan['meta']['stats']['matched']}（降级 {plan['meta']['stats']['downgraded']}）")
    lines.append("")
    lines.append("| fault_id | 场景 | 分支 | 优先级 | 调和 | oracle(spec_id:level:authority) |")
    lines.append("|---|---|---|---|---|---|")
    for m in plan["fault_matches"]:
        oref = "; ".join(f"{o['spec_id']}:{o['assert_level']}:{o['authority']}" for o in m["oracle_refs"])
        lines.append(
            f"| {m['fault_id']} | {','.join(m['target_scenes'])} | {m['branch_class']} "
            f"| {m['priority']} | {m['reconciliation']} | {oref} |"
        )
    path = layout.target_artifact(output_dir, "fault_contract_alignment", create_parent=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main():
    parser = argparse.ArgumentParser(description="阶段2.6 TestKnowledgeBase 知识/故障匹配（contract 优先调和）")
    parser.add_argument("--output-dir", required=True, help="输出目录（含 Contract/ 与 FeatureAnalysis/）")
    parser.add_argument("--knowledge-root", default=None, help="TestKnowledgeBase 根目录（默认自动探测仓内 TestKnowledgeBase）")
    parser.add_argument("--knowledge-domain", default=None,
                        help="知识域过滤：rest_api/web/agent/dfx，或逗号分隔 package_id；省略则加载全部")
    parser.add_argument("--fault-lib", default=None,
                        help="显式故障库路径（兼容旧 demo；默认不再自动回退 Specification_Repository）")
    parser.add_argument("--fault-overlay", default=None, help="项目级 overlay 路径（可选）")
    parser.add_argument("--faults", default="auto", choices=["auto", "on", "off"],
                        help="启用模式：auto=探测到库即启用 / on / off")
    parser.add_argument("--max-exception", type=int, default=3, help="每场景 exception/boundary 配额")
    parser.add_argument("--max-quality", type=int, default=2, help="每场景 quality 配额")
    parser.add_argument("--no-alignment", action="store_true", help="不产出对齐报告")
    args = parser.parse_args()

    if args.faults == "off":
        print("[match_faults] --faults=off：跳过，不产出 fault_matches.json")
        return 0

    fault_lib = args.fault_lib
    knowledge_root = args.knowledge_root or default_knowledge_root()
    if fault_lib and not os.path.exists(fault_lib):
        if args.faults == "on":
            print(f"[match_faults] 错误：--faults=on 但未找到显式故障库 {fault_lib}", file=sys.stderr)
            return 1
        print(f"[match_faults] auto：未发现显式故障库 {fault_lib}，跳过")
        return 0
    if not fault_lib and not os.path.exists(knowledge_root):
        if args.faults == "on":
            print(f"[match_faults] 错误：--faults=on 但未找到知识库 {knowledge_root}", file=sys.stderr)
            return 1
        print("[match_faults] auto：未发现 TestKnowledgeBase，跳过（与未接入时一致）")
        return 0

    domains = parse_domain_filter(args.knowledge_domain)
    plan = match(args.output_dir, fault_lib, args.fault_overlay,
                 args.max_exception, args.max_quality,
                 knowledge_root=knowledge_root, domains=domains)
    if not plan:
        return 0

    out_path = layout.target_artifact(args.output_dir, "fault_matches", create_parent=True)
    knowledge_out_path = layout.target_artifact(args.output_dir, "knowledge_matches", create_parent=True)
    save_json(out_path, plan)
    save_json(knowledge_out_path, plan)
    if not args.no_alignment:
        write_alignment_report(args.output_dir, plan)

    s = plan["meta"]["stats"]
    print(f"Faults considered: {s['faults_considered']} | scenes: {s['scenes']} | "
          f"matched: {s['matched']} | downgraded: {s['downgraded']} | truncated: {s['truncated']}")
    print(f"Output: {out_path}")
    print(f"Knowledge output: {knowledge_out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
