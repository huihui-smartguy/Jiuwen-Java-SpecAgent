#!/usr/bin/env python3
"""
record_faults.py - 阶段5 子步：故障闭环自积累（仅 sdk_defect）

读取 .state/results/*.json，仅把 class==sdk_defect（contract 背书的真实违例）蒸馏为
history_faults 条目，去重后写入"项目级 overlay"（默认，不污染全局精选库）。
默认 dry-run（只打印 + 写 .state/new_faults_detected.json）；--write 才落库。

安全收敛（对比 README 设想的 update_fault_library.py）：
  - 绝不收 sut_unsatisfied / harness_defect / env_issue（避免把非缺陷沉淀成"历史缺陷"）。
  - 去重：用例已带 fault_ref 且该故障已在库（已知故障复现）→ 跳过；同一 (spec_id, field) 本轮只记一次；
    已存在相同 spec_id 的历史条目 → 跳过。
  - 默认写 overlay；--target global 才写全局库。

用法：
    python record_faults.py --output-dir <dir> [--write] [--target overlay|global]
                            [--fault-lib <path>] [--overlay-path <path>]
"""

import argparse
import datetime
import json
import os
import re
import sys
from glob import glob


def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, data, indent=2):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)


def _norm_field(field: str) -> str:
    if not field:
        return ""
    f = re.sub(r"\[\d+\]", "[]", field)        # 去数组下标
    f = re.sub(r"<[^>]*>", "<obj>", f)         # 归一占位
    return f.strip()


def _default_fault_lib() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.abspath(os.path.join(here, "..", ".."))
    for cand in (
        os.path.join(repo_root, "TestKnowledgeBase", "Fault", "rest_api_faults.json"),
        os.path.join(repo_root, "Specification_Repository", "rest_api_common_faults.json"),
    ):
        if os.path.exists(cand):
            return cand
    return ""


def _default_overlay() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.abspath(os.path.join(here, "..", ".."))
    return os.path.join(repo_root, "TestKnowledgeBase", "Fault", "project_faults.json")


def _existing_signatures(lib: dict, overlay: dict | None):
    """收集已知 fault_id、test_case_id、(spec_id) 用于去重。"""
    known_ids = set()
    known_tcids = set()
    known_specs = set()

    def scan(container):
        for f in container.get("history_faults", []):
            known_ids.add(f.get("fault_id"))
            if f.get("test_case_id"):
                known_tcids.add(f.get("test_case_id"))
            if f.get("spec_id"):
                known_specs.add((f.get("spec_id"), _norm_field(f.get("field", ""))))
        for cat in container.get("fault_categories", []):
            for f in cat.get("faults", []):
                known_ids.add(f.get("fault_id"))
        for f in container.get("project_specific_faults", []):
            known_ids.add(f.get("fault_id"))

    scan(lib)
    if overlay:
        scan(overlay)
    return known_ids, known_tcids, known_specs


def _next_hist_seq(known_ids: set) -> int:
    mx = 0
    for fid in known_ids:
        m = re.match(r"F-HIST-(\d+)$", fid or "")
        if m:
            mx = max(mx, int(m.group(1)))
    return mx + 1


def collect_sdk_defects(output_dir: str):
    """读取 .state/results/*.json，返回 class==sdk_defect 的 (case_id, result) 列表。"""
    results_dir = os.path.join(output_dir, ".state", "results")
    out = []
    for fp in sorted(glob(os.path.join(results_dir, "*.json"))):
        r = load_json(fp)
        case_id = r.get("case_id") or os.path.basename(fp).replace(".json", "")
        cls = r.get("class") or r.get("status")
        if cls == "sdk_defect":
            out.append((case_id, r))
    return out


def distill(case_id: str, r: dict, case_ctx: dict, seq: int) -> dict:
    sd = r.get("sdk_defect") or r.get("sdk_bug") or {}
    spec_id = sd.get("spec_id", "")
    expected = sd.get("expected", "")
    actual = sd.get("actual", "")
    field = sd.get("field", "")
    fault_ref = r.get("fault_ref") or case_ctx.get("fault_ref")

    desc = f"{spec_id} 契约违例：期望 {expected}；实际 {actual}".strip("：; ")
    tags = ["历史缺陷", "契约验证"]
    if fault_ref:
        tags.append(f"ref:{fault_ref}")

    return {
        "fault_id": f"F-HIST-{seq:03d}",
        "source": f"{case_id} 执行 sdk_defect",
        "description": desc or f"{case_id} 契约违例",
        "severity": case_ctx.get("severity", "高"),
        "discovered_date": datetime.date.today().isoformat(),
        "test_case_id": case_id,
        "spec_id": spec_id,                 # 附加字段：便于后续跨轮去重
        "field": field,
        "fault_ref": fault_ref,
        "test_strategy": {
            "trigger_pattern": case_ctx.get("trigger") or (f"复现 {case_id} 的请求"),
            "expected_behavior": expected or "符合 contract.md 规定形态",
            "assertion_level": "L2",
            "validation_points": [
                f"{field or '目标字段'} 应满足：{expected}" if expected else "符合契约形态",
            ],
        },
        "resolution_status": "open",
        "tags": tags,
    }


def main():
    parser = argparse.ArgumentParser(description="阶段5 子步：sdk_defect 闭环自积累")
    parser.add_argument("--output-dir", required=True, help="输出目录（含 .state/results/）")
    parser.add_argument("--fault-lib", default=None, help="全局故障库（去重 + 取下一个 F-HIST 序号）")
    parser.add_argument("--overlay-path", default=None, help="项目级 overlay 路径（默认 TestKnowledgeBase/Fault/project_faults.json）")
    parser.add_argument("--target", default="overlay", choices=["overlay", "global"],
                        help="写入目标（默认 overlay，不污染全局精选库）")
    parser.add_argument("--write", action="store_true", help="实际写入（缺省为 dry-run）")
    args = parser.parse_args()

    fault_lib = args.fault_lib or _default_fault_lib()
    overlay_path = args.overlay_path or _default_overlay()
    lib = load_json(fault_lib) if fault_lib and os.path.exists(fault_lib) else {}
    overlay = load_json(overlay_path) if os.path.exists(overlay_path) else None

    known_ids, known_tcids, known_specs = _existing_signatures(lib, overlay)
    seq = _next_hist_seq(known_ids)

    # 用例上下文（fault_ref / 名称 / trigger）
    case_ctx_map = {}
    td_path = os.path.join(args.output_dir, "test_design.json")
    if os.path.exists(td_path):
        try:
            td = load_json(td_path)
            for c in (td if isinstance(td, list) else td.get("cases", [])):
                cid = c.get("case_id") or c.get("id")
                if cid:
                    case_ctx_map[cid] = {
                        "fault_ref": c.get("fault_ref"),
                        "trigger": (c.get("steps") or "").split("\n")[0] if isinstance(c.get("steps"), str) else None,
                    }
        except Exception:
            pass

    defects = collect_sdk_defects(args.output_dir)
    new_entries = []
    skipped = []
    seen_sig = set()

    for case_id, r in defects:
        ctx = case_ctx_map.get(case_id, {})
        fault_ref = r.get("fault_ref") or ctx.get("fault_ref")
        sd = r.get("sdk_defect") or {}
        sig = (sd.get("spec_id", ""), _norm_field(sd.get("field", "")))

        if fault_ref and fault_ref in known_ids:
            skipped.append((case_id, f"已知故障复现 fault_ref={fault_ref}"))
            continue
        if case_id in known_tcids:
            skipped.append((case_id, "test_case_id 已在库"))
            continue
        if sig in known_specs or sig in seen_sig:
            skipped.append((case_id, f"重复签名 {sig}"))
            continue
        seen_sig.add(sig)
        entry = distill(case_id, r, ctx, seq)
        seq += 1
        new_entries.append(entry)

    # dry-run 产物
    detected_path = os.path.join(args.output_dir, ".state", "new_faults_detected.json")
    save_json(detected_path, {
        "generated_by": "record_faults.py",
        "mode": "write" if args.write else "dry-run",
        "target": args.target,
        "new_faults": new_entries,
        "skipped": [{"case_id": c, "reason": why} for c, why in skipped],
    })

    print(f"sdk_defect cases: {len(defects)} | new: {len(new_entries)} | skipped: {len(skipped)}")
    for e in new_entries:
        print(f"  + {e['fault_id']} <= {e['test_case_id']} ({e['spec_id'] or 'no-spec'})")
    for c, why in skipped:
        print(f"  - skip {c}: {why}")
    print(f"Output: {detected_path}")

    if not args.write:
        print("[record_faults] dry-run（未落库）。加 --write 实际写入。")
        return 0
    if not new_entries:
        print("[record_faults] 无新增，未改动库文件。")
        return 0

    if args.target == "global":
        target_path, doc = fault_lib, lib
    else:
        target_path = overlay_path
        doc = overlay or {
            "meta": {"version": "0.1.0", "scope": "project",
                     "description": "项目级故障库（自积累 + 覆盖/禁用，自动创建）"},
            "extends": "TestKnowledgeBase/Fault/rest_api_faults.json",
            "history_faults": [],
        }
    doc.setdefault("history_faults", [])
    doc["history_faults"].extend(new_entries)
    save_json(target_path, doc)
    print(f"[record_faults] 已写入 {len(new_entries)} 条 → {target_path}（target={args.target}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
