#!/usr/bin/env python3
"""
check_wiki.py - Beta 预研（v1.0）：LLM Wiki 护栏校验器（离线确定性）

把 FaultsAnalysis/07 §六的护栏（溯源 / 单一真相不漂移 / 不越权断言 / 非 oracle 非 matcher）
**变成可执行断言**，机械证明"LLM Wiki 接入逻辑正确、未破坏内核红线"——无需真实 SUT/LLM。

校验项：
  C1 覆盖：故障库每个 fault_id 都有 wiki/{fault_id}.md；wiki 下无孤儿 F-*.md（无对应 fault_id）。
  C2 溯源：每篇故障文章头部含「溯源」行，且回链的 fault_id 与文件名一致、category 与库一致。
  C3 不漂移（单一真相）：重新由 JSON 渲染（import gen_wiki）→ 与磁盘文章逐字节比对，证明 wiki 严格单向派生。
  C4 不越权（非 oracle）：每篇故障文章含「不声明无条件断言级别」+「以 contract.md 为准/权威性封顶」免责声明；
        且不得出现"断言级别 = L2（无封顶限定）"之类把 wiki 当判据的措辞。
  C5 非 matcher 输入：稳定确定性脚本 match_faults.py / record_faults.py **不引用 wiki**（grep 反向断言）。

产出 .state/wiki_check.json（{ok, checks[], summary}）。全绿 → 退出 0；任一不过 → 退出 1。
"""

import argparse
import json
import os
import re
import sys

# 让本脚本可 import 同目录的 gen_wiki（用于 C3 不漂移比对）
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import gen_wiki  # noqa: E402


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


def _repo_root() -> str:
    # beta/scripts/ → 仓根 = 上三级
    return os.path.abspath(os.path.join(_HERE, "..", "..", ".."))


# ---------------- 各校验项 ----------------

def check_coverage(faults, wiki_dir):
    """C1 覆盖：fault_id ↔ 文章一一对应（无缺、无孤儿）。"""
    lib_ids = [f.get("fault_id", "") for f in faults if f.get("fault_id")]
    lib_set = set(lib_ids)
    missing = [fid for fid in lib_ids if not os.path.exists(os.path.join(wiki_dir, f"{fid}.md"))]

    # 孤儿：wiki 下 F-*.md（排除 category-*.md / index.md）无对应 fault_id
    orphans = []
    for fn in sorted(os.listdir(wiki_dir)):
        if not fn.endswith(".md"):
            continue
        if fn.startswith("category-") or fn == "index.md":
            continue
        fid = fn[:-3]
        if fid not in lib_set:
            orphans.append(fn)

    ok = not missing and not orphans
    return {
        "id": "C1", "name": "覆盖：fault_id↔文章一一对应", "ok": ok,
        "detail": {"lib_faults": len(lib_ids), "missing": missing, "orphans": orphans},
    }


def check_traceability(faults, wiki_dir):
    """C2 溯源：头部「溯源」行回链 fault_id（=文件名）+ category（=库）。"""
    bad = []
    for f in faults:
        fid = f.get("fault_id", "")
        if not fid:
            continue
        path = os.path.join(wiki_dir, f"{fid}.md")
        if not os.path.exists(path):
            bad.append({"fault_id": fid, "reason": "文章缺失"})
            continue
        text = read_text(path)
        head = text.splitlines()[:8]
        head_txt = "\n".join(head)
        trace_line = next((ln for ln in head if ln.startswith("> 溯源：")), "")
        if not trace_line:
            bad.append({"fault_id": fid, "reason": "缺「溯源」行"})
            continue
        if fid not in trace_line:
            bad.append({"fault_id": fid, "reason": "溯源行未含本 fault_id"})
            continue
        cat_id = f.get("_category_id", "")
        if cat_id and cat_id not in trace_line:
            bad.append({"fault_id": fid, "reason": f"溯源行 category 不符（期望 {cat_id}）"})
            continue
        # H1 标题须含 fault_id
        if not head_txt.lstrip().startswith(f"# {fid} "):
            bad.append({"fault_id": fid, "reason": "H1 标题未以 fault_id 起始"})
    return {
        "id": "C2", "name": "溯源：头部回链 fault_id+category", "ok": not bad,
        "detail": {"violations": bad},
    }


def check_no_drift(fault_lib, overlay, wiki_dir):
    """C3 不漂移：重新由 JSON 渲染，与磁盘逐字节比对（证明严格单向派生）。"""
    faults, lib_meta, overlay_meta = gen_wiki.load_faults(fault_lib, overlay)
    history_refs = gen_wiki._collect_history_refs(faults)

    # 复刻 gen_wiki.main 的分组顺序
    cat_order, cat_map = [], {}
    for f in faults:
        ck = f.get("_category", "HISTORY")
        if ck not in cat_map:
            cat_map[ck] = {"label": f.get("_category_name", ck), "items": []}
            cat_order.append(ck)
        cat_map[ck]["items"].append(f)

    drifted = []

    def cmp(path, expected):
        if not os.path.exists(path):
            drifted.append({"file": os.path.basename(path), "reason": "缺失"})
        elif read_text(path) != expected:
            drifted.append({"file": os.path.basename(path), "reason": "内容与 JSON 派生不一致（漂移）"})

    for ck in cat_order:
        sib_ids = [x.get("fault_id", "") for x in cat_map[ck]["items"]]
        for f in cat_map[ck]["items"]:
            fid = f.get("fault_id", "")
            if not fid:
                continue
            exp = gen_wiki.render_fault_article(f, sib_ids, history_refs.get(fid, []))
            cmp(os.path.join(wiki_dir, f"{fid}.md"), exp)

    cat_groups = []
    for ck in cat_order:
        label = cat_map[ck]["label"]
        items = cat_map[ck]["items"]
        cat_groups.append((ck, label, items))
        cmp(os.path.join(wiki_dir, f"category-{ck}.md"),
            gen_wiki.render_category_article(ck, label, items))

    cmp(os.path.join(wiki_dir, "index.md"),
        gen_wiki.render_index(cat_groups, lib_meta, overlay_meta))

    return {
        "id": "C3", "name": "不漂移：wiki 严格由 JSON 单向派生", "ok": not drifted,
        "detail": {"drifted": drifted},
    }


def check_no_oracle_escalation(faults, wiki_dir):
    """C4 不越权：每篇含免责声明；不得有把 wiki 当判据的越权措辞。"""
    must_have = ["不声明无条件断言级别"]
    must_have_any = ["以 `contract.md` 为准", "权威性封顶", "以项目 `contract.md` 权威性封顶"]
    bad = []
    for f in faults:
        fid = f.get("fault_id", "")
        path = os.path.join(wiki_dir, f"{fid}.md")
        if not fid or not os.path.exists(path):
            continue
        text = read_text(path)
        for kw in must_have:
            if kw not in text:
                bad.append({"fault_id": fid, "reason": f"缺免责声明「{kw}」"})
        if not any(kw in text for kw in must_have_any):
            bad.append({"fault_id": fid, "reason": "缺「以 contract.md 为准/权威性封顶」限定"})
        # 越权措辞：出现"作为(唯一)判据/oracle/通过依据"等
        for bad_kw in ["作为判据", "作为唯一判据", "作为 oracle", "作为通过依据", "据此判定通过"]:
            if bad_kw in text:
                bad.append({"fault_id": fid, "reason": f"出现越权措辞「{bad_kw}」"})
    return {
        "id": "C4", "name": "不越权：advisory 免责声明齐备、无判据化措辞", "ok": not bad,
        "detail": {"violations": bad},
    }


def check_not_matcher_input(repo_root):
    """C5 非 matcher 输入：稳定确定性脚本不引用 wiki。"""
    targets = [
        os.path.join(repo_root, "AutoTestFlow", "scripts", "match_faults.py"),
        os.path.join(repo_root, "AutoTestFlow", "scripts", "record_faults.py"),
    ]
    hits = []
    for t in targets:
        if not os.path.exists(t):
            continue
        text = read_text(t)
        for i, ln in enumerate(text.splitlines(), 1):
            if re.search(r"\bwiki\b", ln, re.IGNORECASE):
                hits.append({"file": os.path.relpath(t, repo_root), "line": i, "text": ln.strip()})
    return {
        "id": "C5", "name": "非 matcher 输入：确定性脚本不引用 wiki", "ok": not hits,
        "detail": {"references": hits},
    }


# ---------------- 主流程 ----------------

def main():
    parser = argparse.ArgumentParser(description="Beta 预研：LLM Wiki 护栏校验器（离线确定性）")
    parser.add_argument("--fault-lib", default="", help="故障库 JSON 路径（默认自动探测）")
    parser.add_argument("--fault-overlay", default="", help="项目级 overlay 路径（可选）")
    parser.add_argument("--wiki-dir", default="", help="wiki 目录（默认 <fault-lib 所在目录>/wiki）")
    parser.add_argument("--output-dir", default="", help="报告输出目录（默认仓根；写 .state/wiki_check.json）")
    args = parser.parse_args()

    fault_lib = gen_wiki.auto_detect_lib(args.fault_lib)
    if not fault_lib or not os.path.exists(fault_lib):
        print("[check_wiki] 未找到故障库，跳过（无可校验对象）")
        return 0

    overlay = args.fault_overlay or None
    wiki_dir = args.wiki_dir or os.path.join(os.path.dirname(os.path.abspath(fault_lib)), "wiki")
    repo_root = _repo_root()
    output_dir = args.output_dir or repo_root

    if not os.path.isdir(wiki_dir):
        report = {"generated_by": "check_wiki.py", "ok": False,
                  "checks": [{"id": "C0", "name": "wiki 目录存在", "ok": False,
                              "detail": {"wiki_dir": wiki_dir}}],
                  "summary": {"passed": 0, "failed": 1}}
        save_json(os.path.join(output_dir, ".state", "wiki_check.json"), report)
        print(f"[check_wiki] 未找到 wiki 目录：{wiki_dir}")
        return 1

    faults, _, _ = gen_wiki.load_faults(fault_lib, overlay)

    checks = [
        check_coverage(faults, wiki_dir),
        check_traceability(faults, wiki_dir),
        check_no_drift(fault_lib, overlay, wiki_dir),
        check_no_oracle_escalation(faults, wiki_dir),
        check_not_matcher_input(repo_root),
    ]
    passed = sum(1 for c in checks if c["ok"])
    failed = len(checks) - passed
    ok = failed == 0

    report = {
        "generated_by": "check_wiki.py",
        "ok": ok,
        "fault_lib_version": load_json(fault_lib).get("meta", {}).get("version"),
        "wiki_dir": os.path.relpath(wiki_dir, repo_root),
        "checks": checks,
        "summary": {"total": len(checks), "passed": passed, "failed": failed,
                    "faults_checked": len([f for f in faults if f.get("fault_id")])},
    }
    out = os.path.join(output_dir, ".state", "wiki_check.json")
    save_json(out, report)

    for c in checks:
        print(f"[check_wiki] {c['id']} {'PASS' if c['ok'] else 'FAIL'} — {c['name']}")
    print(f"[check_wiki] {'全部通过' if ok else '存在不通过项'}：{passed}/{len(checks)} → {out}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
