#!/usr/bin/env python3
"""
gen_wiki.py - Beta 预研（v1.0）：故障库 → LLM Wiki 仓内 NL 文章（Phase A，单向派生）

依据 FaultsAnalysis/07-LLM_Wiki与故障库知识源分析.md §九 Phase A：把结构化故障库
（TestKnowledgeBase/Fault/rest_api_faults.json [+ 项目级 overlay]）**单向编译**为
仓内 Markdown 文章——每个 fault_id 一篇，外加每类一篇汇总 + 一篇索引。供 stage2.6b / stage6
的 LLM 子 Agent 按 `fault_id` 确定性取用（文件名即 ID，提取准确率≈100%）。

铁律（详见 beta/shared/wiki_rules.md，呼应 DESIGN §2/§7 与 07 §六护栏）：
  - 单一真相：结构化 JSON 是 source of truth；本脚本**只读 JSON、只写 wiki/*.md**，绝不反写 JSON。
  - 仅 advisory：文章**不声明无条件断言级别**；断言级别一律以项目 contract.md 权威性封顶。
  - 强制溯源：每篇文章头部标注 fault_id（+ category）回链结构化库。
  - 非 oracle、非 matcher 输入：文章只供 LLM 阶段做语义参考，绝不喂给 match_faults.py。
  - 纯确定性（无 LLM、无网络），**幂等**：同输入 → 同字节输出（可 golden 复验）。

缺库 / `--beta-wiki off` 时优雅退出、不写任何文件（与未启用 Beta 时一致）。

用法：
    python gen_wiki.py [--fault-lib <path>] [--fault-overlay <path>]
                       [--wiki-dir <path>] [--beta-wiki on|off]
    # --fault-lib   默认自动探测 TestKnowledgeBase/Fault/rest_api_faults.json
    # --wiki-dir    默认 <fault-lib 所在目录>/wiki
    # --beta-wiki   off 时直接退出（供编排器统一门控）；默认 on（脚本被显式调用即生成）
"""

import argparse
import json
import os
import re
import sys


# ---------------- 通用 IO（与 scripts/match_faults.py 保持一致） ----------------

def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_text(path: str, text: str):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


# ---------------- 故障库加载 + overlay 合并（镜像 match_faults.load_faults） ----------------
# 说明：beta 子树自包含，不 import 稳定脚本（避免耦合 / 保持稳定脚本零改动）；
#      下列三函数与 scripts/match_faults.py 的同名实现逐字对齐，行为一致。

def _norm_cat(category_id: str) -> str:
    """category_id 形如 'FC-REQ-001' → 归一为 'FC-REQ'。"""
    parts = category_id.split("-")
    return "-".join(parts[:2]) if len(parts) >= 2 else category_id


def _substitute(obj, params: dict):
    """把 {placeholder} 占位符替换为 parameter_config 中的具体值（递归）。"""
    if isinstance(obj, str):
        def repl(m):
            return str(params.get(m.group(1), m.group(0)))
        return re.sub(r"\{([a-zA-Z0-9_]+)\}", repl, obj)
    if isinstance(obj, list):
        return [_substitute(x, params) for x in obj]
    if isinstance(obj, dict):
        return {k: _substitute(v, params) for k, v in obj.items()}
    return obj


def load_faults(fault_lib_path: str, overlay_path):
    """加载全局故障库（展平 fault_categories + history_faults），套用 overlay。

    返回 (faults, lib_meta, overlay_meta)：faults 每条含 _category / _is_history /
    _category_name（原 category_name，便于文章呈现）。
    """
    lib = load_json(fault_lib_path)
    lib_meta = dict(lib.get("meta", {}))
    faults = []

    for cat in lib.get("fault_categories", []):
        cid = cat.get("category_id", "")
        cname = cat.get("category_name", "")
        for f in cat.get("faults", []):
            f = dict(f)
            f["_category"] = _norm_cat(cid)
            f["_category_id"] = cid
            f["_category_name"] = cname
            f["_is_history"] = False
            faults.append(f)

    for h in lib.get("history_faults", []):
        h = dict(h)
        h["_category"] = "HISTORY"
        h["_category_id"] = "HISTORY"
        h["_category_name"] = "历史缺陷"
        h["_is_history"] = True
        faults.append(h)

    overlay_meta = None
    if overlay_path and os.path.exists(overlay_path):
        ov = load_json(overlay_path)
        overlay_meta = dict(ov.get("meta", {}))
        params = ov.get("parameter_config", {}) or {}

        disabled = {d.get("ref_fault_id") for d in ov.get("disabled_faults", [])}
        if disabled:
            faults = [f for f in faults if f.get("fault_id") not in disabled]

        overrides = {o.get("ref_fault_id"): o for o in ov.get("fault_overrides", [])}
        for f in faults:
            ov_entry = overrides.get(f.get("fault_id"))
            if ov_entry and ov_entry.get("custom_test_strategy"):
                f["test_strategy"] = _substitute(ov_entry["custom_test_strategy"], params)
                f["_overridden"] = True

        for pf in ov.get("project_specific_faults", []):
            pf = _substitute(dict(pf), params)
            pf["_category"] = "PROJECT"
            pf["_category_id"] = "PROJECT"
            pf["_category_name"] = "项目特有故障"
            pf["_is_history"] = False
            faults.append(pf)

    return faults, lib_meta, overlay_meta


# ---------------- 候选契约 specId 种类（镜像 match_faults.candidate_spec_kinds） ----------------
# 仅供文章 advisory 呈现；最终 specId 解析与断言封顶由 match_faults.py 按 contract.md 完成。

_KIND_TO_SPECID = {
    "RESP_WRAP": "SPEC-RESP-WRAP",
    "ID_TYPE": "SPEC-ID-TYPE",
    "ENUM": "SPEC-ENUM",
    "SSE": "SPEC-SSE",
    "ERR": "SPEC-ERR-*",
    "CARD": "SPEC-CARD",
}


def candidate_spec_kinds(fault: dict) -> list:
    """根据 category/tags 给出候选 specId 种类（有序、去重）。镜像 match_faults。"""
    cat = fault.get("_category", "")
    tags = set(fault.get("tags", []))
    kinds = []

    def add(k):
        if k not in kinds:
            kinds.append(k)

    low = {t.lower() for t in tags}
    if cat == "FC-SSE" or "SSE" in tags:
        add("SSE")
    if "枚举一致性" in tags or "枚举" in tags or "enum" in low:
        add("ENUM")
    if "类型一致性" in tags or "id" in low:
        add("ID_TYPE")
    if cat == "FC-PROTO" or "协议合规" in tags or "JSON-RPC" in tags:
        add("ERR")
        add("ID_TYPE")
    if cat in ("FC-STATE",) or "状态机" in tags or "资源不存在" in tags or "关联资源校验" in tags:
        add("RESP_WRAP")
        add("ERR")
    if cat == "FC-REQ":
        add("ERR")
        add("RESP_WRAP")
    if cat == "FC-RES":
        add("RESP_WRAP")
    return kinds


# ---------------- 通用根因方向（按类，advisory，非结构化库字段） ----------------
# 明确标注为"通用经验提示"，非来自 JSON 字段；供 stage6 根因叙事起步，最终以实测+源码定位为准。

_ROOT_CAUSE_HINTS = {
    "FC-REQ": [
        "入参校验缺失：业务层未校验必选/类型/边界即直接访问字段（易 NPE 或静默通过）",
        "校验注解与业务依赖不一致（如标可选但逻辑必需）",
        "字段名/大小写映射不一致（驼峰 vs 下划线）",
    ],
    "FC-RES": [
        "响应未按契约包裹/字段缺失（如缺 result 包裹或状态字段）",
        "序列化遗漏字段或类型错配",
    ],
    "FC-PROTO": [
        "协议错误码/版本/方法名未按规范返回（如非法 method 未返回 -32601）",
        "JSON-RPC 信封字段（jsonrpc/id）处理不完整",
    ],
    "FC-STATE": [
        "状态机非法迁移未拦截（缺前置状态校验）",
        "关联资源存在性未校验即推进终态",
    ],
    "FC-SSE": [
        "流式终态后未关闭连接 / 未追加终止事件",
        "异常未在 SSE 末尾以 error 帧透出",
        "事件类型/边界处理不全",
    ],
    "FC-SEC": [
        "鉴权/越权/输入消毒缺失（advisory，DFX 轨道）",
    ],
    "FC-PERF": [
        "超时/并发/资源耗尽下的退化未处理（advisory，DFX 轨道）",
    ],
    "HISTORY": [
        "见本条历史缺陷的 source / 关联用例；属已实测复现的真实违例方向",
    ],
    "PROJECT": [
        "项目特有约束，见 overlay 定义与 contract.md",
    ],
}


def _join(items, sep="、"):
    return sep.join(str(x) for x in (items or [])) or "（无）"


def _fault_filename(fault_id: str) -> str:
    return f"{fault_id}.md"


# ---------------- 文章渲染 ----------------

def render_fault_article(fault: dict, siblings: list, history_refs: list) -> str:
    """渲染单个 fault 的 wiki 文章（确定性、仅依赖 JSON 字段 + 派生 advisory）。"""
    fid = fault.get("fault_id", "")
    name = fault.get("name") or fault.get("description", "")[:24] or fid
    cat_id = fault.get("_category_id", "")
    cat_name = fault.get("_category_name", "")
    sev = fault.get("severity", "未知")
    strat = fault.get("test_strategy", {}) or {}
    trig = strat.get("trigger_pattern", "（未提供）")
    exp = strat.get("expected_behavior", "（未提供）")
    level = strat.get("assertion_level", "L1")
    vpoints = strat.get("validation_points", []) or []
    scenes = fault.get("applicable_scenarios", []) or []
    tags = fault.get("tags", []) or []
    is_hist = fault.get("_is_history", False)

    kinds = candidate_spec_kinds(fault)
    kind_disp = [f"{k}→{_KIND_TO_SPECID.get(k, k)}" for k in kinds]

    lines = []
    lines.append(f"# {fid} · {name}")
    lines.append("")
    lines.append(f"> 溯源：`fault_library.json` → `{cat_id}`（{cat_name}）→ `{fid}`")
    lines.append(f"> 严重程度：{sev} ｜ 故障建议断言级别：{level}"
                 f"（**最终以项目 `contract.md` 权威性封顶**，见下「契约锚点」）")
    if scenes:
        lines.append(f"> 适用场景：{_join(scenes)}")
    if tags:
        lines.append(f"> 标签：{_join(tags)}")
    lines.append("> 本文由 `beta/scripts/gen_wiki.py` 从结构化故障库**单向派生**，仅作 advisory；"
                 "**不作 oracle、不进 `match_faults.py`**。")
    lines.append("")

    lines.append("## 故障模式（通俗描述）")
    lines.append("")
    lines.append(fault.get("description", "（未提供）"))
    lines.append("")

    lines.append("## 怎么触发")
    lines.append("")
    lines.append(trig)
    lines.append("")

    lines.append("## 预期行为")
    lines.append("")
    lines.append(exp)
    if vpoints:
        lines.append("")
        lines.append("验证点：")
        for vp in vpoints:
            lines.append(f"- {vp}")
    lines.append("")

    lines.append("## 契约锚点（候选 specId 种类）")
    lines.append("")
    lines.append("本故障的判据**唯一来自项目 `contract.md`**。`match_faults.py` 会按 contract 权威性把本故障"
                 "解析为具体 specId，并据权威性封顶断言级别（spec-required→至多 L2；config-dependent→至多 L1；"
                 "needs-runtime-verify / 契约静默→至多 L0 观察）。候选种类：")
    lines.append("")
    if kind_disp:
        for kd in kind_disp:
            lines.append(f"- {kd}")
    else:
        lines.append("- （本故障无结构化候选 specId 种类；多为 DFX/观察轨道）")
    lines.append("")
    lines.append("> ⚠️ 本文**不声明无条件断言级别**；以上仅供 LLM 阶段（stage2.6b）语义绑定参考，"
                 "最终 specId 与断言级别以 `contract.md` 为准。")
    lines.append("")

    lines.append("## 常见根因方向（通用经验 · advisory）")
    lines.append("")
    lines.append("> 下列为**按类通用经验提示**，非结构化库字段；供 stage6 根因叙事起步，"
                 "**最终须以实测 trace + 源码定位为准**。")
    for h in _ROOT_CAUSE_HINTS.get(fault.get("_category", ""), ["（暂无通用提示）"]):
        lines.append(f"- {h}")
    lines.append("")

    lines.append("## 历史案例")
    lines.append("")
    if is_hist:
        lines.append(f"- 来源：{fault.get('source', '（未提供）')}")
        lines.append(f"- 发现日期：{fault.get('discovered_date', '（未提供）')}")
        lines.append(f"- 关联用例：{fault.get('test_case_id', '（未提供）')}")
        lines.append(f"- 处置状态：{fault.get('resolution_status', '（未提供）')}")
    elif history_refs:
        lines.append("结构化库中以下历史缺陷与本故障相关（由 record_faults.py 蒸馏，按 `ref:` 标签关联）：")
        for hid in history_refs:
            lines.append(f"- [{hid}](./{_fault_filename(hid)})")
    else:
        lines.append("（暂无关联历史缺陷；一旦实测复现，`record_faults.py` 会把 `sdk_defect` 蒸馏回 `history_faults`，"
                     "再由本脚本重生成时回链此处。）")
    lines.append("")

    lines.append("## 关联故障")
    lines.append("")
    sib = [s for s in siblings if s != fid]
    if sib:
        lines.append(f"同类（{cat_id} {cat_name}）：")
        for sid in sib:
            lines.append(f"- [{sid}](./{_fault_filename(sid)})")
    else:
        lines.append("（同类暂无其它故障）")
    lines.append("")
    lines.append(f"返回：[分类汇总](./category-{fault.get('_category', 'HISTORY')}.md) ｜ [索引](./index.md)")
    lines.append("")
    return "\n".join(lines)


def render_category_article(cat_key: str, cat_label: str, faults: list) -> str:
    lines = []
    lines.append(f"# 分类汇总 · {cat_key}（{cat_label}）")
    lines.append("")
    lines.append(f"> 由 `beta/scripts/gen_wiki.py` 从结构化故障库单向派生。本类共 {len(faults)} 条故障。")
    lines.append("> 仅 advisory；断言级别一律以项目 `contract.md` 权威性封顶。")
    lines.append("")
    lines.append("| fault_id | 名称 | 严重度 | 建议断言级别 | 候选 specId 种类 |")
    lines.append("|---|---|---|---|---|")
    for f in faults:
        fid = f.get("fault_id", "")
        name = f.get("name") or f.get("description", "")[:20]
        sev = f.get("severity", "")
        level = (f.get("test_strategy", {}) or {}).get("assertion_level", "")
        kinds = "、".join(candidate_spec_kinds(f)) or "—"
        lines.append(f"| [{fid}](./{_fault_filename(fid)}) | {name} | {sev} | {level} | {kinds} |")
    lines.append("")
    lines.append("返回：[索引](./index.md)")
    lines.append("")
    return "\n".join(lines)


def render_index(cat_groups: list, lib_meta: dict, overlay_meta) -> str:
    total = sum(len(fs) for _, _, fs in cat_groups)
    lines = []
    lines.append("# LLM Wiki 索引 · 故障库派生 NL 文章（Beta 预研 v1.0）")
    lines.append("")
    lines.append("> 本目录由 `AutoTestFlow/beta/scripts/gen_wiki.py` 从 "
                 "`TestKnowledgeBase/Fault/rest_api_faults.json` [+ overlay] **单向派生**。")
    lines.append("> **单一真相是结构化 JSON**；本目录仅作 advisory NL 层，供 stage2.6b / stage6 的 LLM 子 Agent "
                 "按 `fault_id` 确定性取用。**不作 oracle、不进 `match_faults.py`**。")
    lines.append("> 重生成：`python AutoTestFlow/beta/scripts/gen_wiki.py`；校验：`python AutoTestFlow/beta/scripts/check_wiki.py`。")
    lines.append("")
    lines.append(f"- 源库版本：`{lib_meta.get('version', '?')}`（scope=`{lib_meta.get('scope', '?')}`）")
    if overlay_meta:
        lines.append(f"- overlay 版本：`{overlay_meta.get('version', '?')}`")
    lines.append(f"- 文章总数：{total} 篇故障文章 + {len(cat_groups)} 篇分类汇总 + 本索引")
    lines.append("")
    for cat_key, cat_label, fs in cat_groups:
        lines.append(f"## {cat_key} · {cat_label}（{len(fs)} 条） — [汇总](./category-{cat_key}.md)")
        lines.append("")
        for f in fs:
            fid = f.get("fault_id", "")
            name = f.get("name") or f.get("description", "")[:20]
            lines.append(f"- [{fid} · {name}](./{_fault_filename(fid)})")
        lines.append("")
    return "\n".join(lines)


# ---------------- 库探测 ----------------

def auto_detect_lib(explicit: str) -> str:
    if explicit:
        return explicit
    here = os.path.dirname(os.path.abspath(__file__))
    # beta/scripts/ → 仓根 = 上三级
    repo_root = os.path.abspath(os.path.join(here, "..", "..", ".."))
    for cand in (
        os.path.join(repo_root, "TestKnowledgeBase", "Fault", "rest_api_faults.json"),
        os.path.join(repo_root, "Specification_Repository", "rest_api_common_faults.json"),
    ):
        if os.path.exists(cand):
            return cand
    return ""


def _collect_history_refs(faults: list) -> dict:
    """fault_id → [关联历史 fault_id]，依据历史条目 tags 中的 'ref:F-XXX' 或 fault_ref 字段。"""
    refs = {}
    for h in faults:
        if not h.get("_is_history"):
            continue
        hid = h.get("fault_id", "")
        targets = set()
        if h.get("fault_ref"):
            targets.add(h["fault_ref"])
        for t in h.get("tags", []) or []:
            m = re.match(r"ref:(\S+)", str(t))
            if m:
                targets.add(m.group(1))
        for tgt in targets:
            refs.setdefault(tgt, []).append(hid)
    return refs


# ---------------- 主流程 ----------------

def main():
    parser = argparse.ArgumentParser(description="Beta 预研：故障库 → LLM Wiki 仓内 NL 文章（Phase A，单向派生）")
    parser.add_argument("--fault-lib", default="", help="故障库 JSON 路径（默认自动探测 TestKnowledgeBase/Fault/，Specification_Repository 仅遗留兼容）")
    parser.add_argument("--fault-overlay", default="", help="项目级 overlay 路径（可选）")
    parser.add_argument("--wiki-dir", default="", help="wiki 输出目录（默认 <fault-lib 所在目录>/wiki）")
    parser.add_argument("--beta-wiki", choices=["on", "off"], default="on",
                        help="Beta 总门控：off 时直接退出、不写文件（供编排器统一门控）")
    args = parser.parse_args()

    if args.beta_wiki == "off":
        print("[gen_wiki] --beta-wiki=off，跳过生成（与未启用 Beta 一致）")
        return 0

    fault_lib = auto_detect_lib(args.fault_lib)
    if not fault_lib or not os.path.exists(fault_lib):
        print("[gen_wiki] 未找到故障库，优雅退出（不写文件）")
        return 0

    overlay = args.fault_overlay or None
    wiki_dir = args.wiki_dir or os.path.join(os.path.dirname(os.path.abspath(fault_lib)), "wiki")

    faults, lib_meta, overlay_meta = load_faults(fault_lib, overlay)
    if not faults:
        print("[gen_wiki] 故障库为空，优雅退出（不写文件）")
        return 0

    history_refs = _collect_history_refs(faults)

    # 按 _category 分组（保持 load_faults 的出现顺序 → 确定性）
    cat_order = []
    cat_map = {}
    for f in faults:
        ck = f.get("_category", "HISTORY")
        if ck not in cat_map:
            cat_map[ck] = {"label": f.get("_category_name", ck), "items": []}
            cat_order.append(ck)
        cat_map[ck]["items"].append(f)

    written = 0
    # 1) 每个 fault 一篇
    for ck in cat_order:
        sib_ids = [x.get("fault_id", "") for x in cat_map[ck]["items"]]
        for f in cat_map[ck]["items"]:
            fid = f.get("fault_id", "")
            if not fid:
                continue
            art = render_fault_article(f, sib_ids, history_refs.get(fid, []))
            write_text(os.path.join(wiki_dir, _fault_filename(fid)), art)
            written += 1

    # 2) 每类一篇汇总
    cat_groups = []
    for ck in cat_order:
        label = cat_map[ck]["label"]
        items = cat_map[ck]["items"]
        cat_groups.append((ck, label, items))
        write_text(os.path.join(wiki_dir, f"category-{ck}.md"),
                   render_category_article(ck, label, items))

    # 3) 索引
    write_text(os.path.join(wiki_dir, "index.md"),
               render_index(cat_groups, lib_meta, overlay_meta))

    print(f"[gen_wiki] 生成完成：{written} 篇故障文章 + {len(cat_groups)} 篇分类汇总 + 1 篇索引 → {wiki_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
