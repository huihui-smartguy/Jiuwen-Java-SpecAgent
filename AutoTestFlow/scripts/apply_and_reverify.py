#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_and_reverify.py - stage7 应用补丁 + 本地重建 + 复验（确定性绿门，无 LLM）

读取 stage6 产出的 .state/remediation/defects/<case>/{patch.diff,regression_test.diff}，
对配置声明的代码仓在 <ref> 基线上：建分支 → git apply（路径白名单）→ 构建 → 重启 SUT →
重跑失败的黑盒用例（须转绿）+ 回归自测 → 产 .state/remediation/reverify.json。

绿/红由本脚本**确定性判定**（重跑未改动的 stage4 用例 + 重建后的 SUT），LLM 不参与——
这是"生成器不得自我认证"红线的执行点。所有失败落 reverify.json、丢弃该缺陷、不抛栈。

每次运行**重新准备**代码仓（clean slate）以保证幂等/可复现。

reverify.simulate=true（离线/fixture）：跳过 重启/就绪/pytest，按 reverify.simulated_after
映射模拟复验结果——用于无真实 SUT 时验证编排与产物形态。真实 live 路径（clone+构建+SUT
重启+pytest）需用户的可达 SUT + 构建工具链。

用法：
    python apply_and_reverify.py --output-dir <dir> [--remediation-config <path>] [--work-dir <dir>]
"""

import argparse
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "reference"))
from remediation_config import (  # noqa: E402
    load_json, save_json, load_config, resolve_config_path, ConfigError,
)


def _run(cmd, cwd=None, timeout=900, env=None):
    """运行命令，返回 (rc, 输出尾部)。不抛栈。"""
    try:
        p = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True,
                           text=True, timeout=timeout)
        return p.returncode, ((p.stdout or "") + (p.stderr or ""))[-2000:]
    except FileNotFoundError as e:
        return 127, "command not found: %r" % e
    except subprocess.TimeoutExpired:
        return 124, "timeout"
    except Exception as e:  # pragma: no cover - defensive
        return 1, repr(e)


def _git(args, cwd, **kw):
    return _run(["git"] + args, cwd=cwd, **kw)


def _abs_under(base, p):
    return p if os.path.isabs(p) else os.path.abspath(os.path.join(base, p))


def _resolve_upstream(output_dir, upstream):
    """本地路径源（非 http/git@）相对 output_dir 解析；URL 原样返回。"""
    if upstream.startswith(("http://", "https://", "git@", "ssh://", "git://")):
        return upstream
    return _abs_under(output_dir, upstream)


def prepare_repo(cfg, output_dir, clone_abs, rec):
    """幂等准备代码仓到 <ref> 基线（每次 clean slate）。返回 method 或 None（失败）。"""
    upstream = _resolve_upstream(output_dir, cfg["repo"]["upstream_url"])
    ref = cfg["repo"]["ref"]
    if os.path.exists(clone_abs):
        _run(["rm", "-rf", clone_abs])
    os.makedirs(os.path.dirname(clone_abs) or ".", exist_ok=True)

    # 1) clone（远程 URL 或 本地 git 仓）
    rc, out = _git(["clone", "--quiet", upstream, clone_abs], cwd=None)
    if rc == 0:
        _git(["checkout", "--quiet", ref], cwd=clone_abs)
        rec["repo_method"] = "clone"
        return "clone"
    # 2) 本地非 git 目录 → 物化为 git 基线（离线可用）
    if os.path.isdir(upstream):
        _run(["cp", "-r", upstream, clone_abs])
        _run(["rm", "-rf", os.path.join(clone_abs, ".git")])
        _git(["init", "--quiet"], cwd=clone_abs)
        _git(["config", "user.email", "autotestflow@local"], cwd=clone_abs)
        _git(["config", "user.name", "autotestflow"], cwd=clone_abs)
        _git(["add", "-A"], cwd=clone_abs)
        _git(["commit", "--quiet", "-m", "baseline (materialized from local source)"], cwd=clone_abs)
        _git(["tag", ref], cwd=clone_abs)
        rec["repo_method"] = "materialized"
        return "materialized"
    rec["repo_method"] = "failed"
    rec["clone_error"] = out[-500:]
    return None


def _touched_paths(diff_text):
    """从 unified diff 抽取受影响仓内路径（去 a/ b/ 前缀，忽略 /dev/null）。"""
    paths = set()
    for line in diff_text.splitlines():
        if line.startswith(("--- ", "+++ ")):
            p = line[4:].strip().split("\t")[0]
            if p == "/dev/null":
                continue
            if p[:2] in ("a/", "b/"):
                p = p[2:]
            paths.add(p)
    return sorted(paths)


def _under_roots(paths, roots):
    norm = [r.rstrip("/") + "/" for r in roots]
    for p in paths:
        if not any(p == r.rstrip("/") or p.startswith(r) for r in norm):
            return False, p
    return True, None


def _count_changes(diff_text):
    adds = sum(1 for l in diff_text.splitlines()
               if l.startswith("+") and not l.startswith("+++"))
    dels = sum(1 for l in diff_text.splitlines()
               if l.startswith("-") and not l.startswith("---"))
    return adds, dels


def apply_defect(clone_abs, defect_dir, cfg, drec):
    """对单个缺陷应用 patch.diff(+regression_test.diff)。回写 drec.applied。"""
    business = cfg["repo"]["business_code_roots"]
    selftest = cfg["repo"]["selftest_roots"]
    # 绝对路径：git 以 cwd=clone_abs 运行，patch 路径须不依赖 git 的 cwd
    patch = os.path.abspath(os.path.join(defect_dir, "patch.diff"))
    rtest = os.path.abspath(os.path.join(defect_dir, "regression_test.diff"))

    if not os.path.exists(patch):
        drec["applied"] = "no_patch"      # 不可定位/needs_human：仍可在 submit 阶段开 issue
        return False

    pdiff = open(patch, encoding="utf-8").read()
    # 路径白名单：业务补丁仅 business_code_roots；禁碰 contract.md / 测试脚手架
    ptouched = _touched_paths(pdiff)
    ok, bad = _under_roots(ptouched, business)
    if not ok:
        drec["applied"] = "rejected_path"
        drec["reject_path"] = bad
        return False

    rc, out = _git(["apply", "--check", patch], cwd=clone_abs)
    if rc != 0:
        drec["applied"] = "apply_failed"
        drec["apply_error"] = out[-300:]
        return False
    _git(["apply", patch], cwd=clone_abs)

    # 回归自测补丁（仅 selftest_roots，新增）
    if os.path.exists(rtest):
        rdiff = open(rtest, encoding="utf-8").read()
        rok, rbad = _under_roots(_touched_paths(rdiff), selftest)
        rc2, _ = _git(["apply", "--check", rtest], cwd=clone_abs)
        if rok and rc2 == 0:
            _git(["apply", rtest], cwd=clone_abs)
            drec["regression"] = "applied"
        else:
            drec["regression"] = "skipped(%s)" % (rbad or "apply_check_failed")
    else:
        drec["regression"] = "none"

    _git(["add", "-A"], cwd=clone_abs)
    _git(["commit", "--quiet", "-m",
          "fix(%s): %s" % (drec["case_id"], drec.get("spec_id", ""))], cwd=clone_abs)
    drec["applied"] = "applied"
    return True


def reverify_live(cfg, output_dir, clone_abs, applied_cases, rec):
    """真实复验：重启 SUT + 重跑失败用例 + 回归自测。填 rec。"""
    run = cfg.get("run", {})
    build = cfg.get("build", {})
    workdir = _abs_under(clone_abs, build.get("workdir", "."))

    # 构建
    bc = build.get("build_cmd")
    if bc:
        rc, out = _run(["bash", "-lc", bc], cwd=workdir)
        rec["build"] = "ok" if rc == 0 else "failed"
        if rc != 0:
            rec["build_error"] = out[-400:]
            return  # 构建不过 → 无绿，停在提交前
    else:
        rec["build"] = "skipped"

    # 重启 SUT
    if run.get("stop_cmd"):
        _run(["bash", "-lc", run["stop_cmd"]], cwd=workdir)
    if run.get("restart_cmd"):
        if run.get("restart_in_background", True):
            try:
                subprocess.Popen(["bash", "-lc", run["restart_cmd"]], cwd=workdir,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception as e:  # pragma: no cover
                rec["restart_error"] = repr(e)
        else:
            _run(["bash", "-lc", run["restart_cmd"]], cwd=workdir)

    rec["sut_ready"] = "ready" if _wait_ready(cfg) else "not_ready"
    if rec["sut_ready"] != "ready":
        rec["build"] = rec.get("build", "ok")
        return

    # 重跑失败用例（复用 stage4 已生成的 test_<case>.py，指向重建后的 SUT）
    base_url = cfg["sut"]["base_url"]
    trace_dir = os.path.join(output_dir, ".state", "remediation", "trace")
    env = dict(os.environ, BASE_URL=base_url, A2A_TRACE_DIR=trace_dir)
    for case in applied_cases:
        tfile = os.path.join(output_dir, "test_%s.py" % case.lower())
        if not os.path.exists(tfile):
            rec["defects"][case]["after"] = "no_test_file"
            continue
        rc, _ = _run([sys.executable, "-m", "pytest", tfile, "-q"], cwd=output_dir, env=env)
        rec["defects"][case]["after"] = "passed" if rc == 0 else "still_red"

    # 回归自测
    sc = build.get("selftest_cmd")
    if sc:
        rc, _ = _run(["bash", "-lc", sc], cwd=workdir)
        rec["selftest"] = "passed" if rc == 0 else "failed"
    else:
        rec["selftest"] = "skipped"


def _wait_ready(cfg):
    """就绪门：TCP 预检 + HTTP 探针（httpx 惰性导入；不可用则 TCP 通过即可）。"""
    import socket
    import time
    sut = cfg["sut"]
    base_url = sut["base_url"]
    probe = sut.get("readiness_probe", {}) or {}
    timeout = cfg.get("run", {}).get("readiness_timeout_sec", 60)
    rest = base_url.split("://", 1)[-1].split("/", 1)[0]
    host, port = (rest.rsplit(":", 1) + ["80"])[:2] if ":" in rest else (rest, "443" if base_url.startswith("https") else "80")
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, int(port)), timeout=3):
                pass
        except Exception:
            time.sleep(2)
            continue
        try:
            import httpx
            url = base_url.rstrip("/") + probe.get("path", "/")
            r = httpx.request(probe.get("method", "GET"), url, timeout=5)
            if r.status_code < probe.get("expect_status_lt", 500):
                return True
        except Exception:
            return True  # TCP 通而 httpx 不可用/探针异常：保守视为就绪
        time.sleep(2)
    return False


def main():
    parser = argparse.ArgumentParser(description="stage7 应用补丁 + 本地重建 + 复验（绿门）")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--remediation-config", default=None)
    parser.add_argument("--work-dir", default=None)
    args = parser.parse_args()

    rem_dir = os.path.join(args.output_dir, ".state", "remediation")
    cfg_path = resolve_config_path(args.output_dir, args.work_dir, args.remediation_config)
    rec = {"generated_by": "apply_and_reverify.py", "require_green": True,
           "defects": {}, "remediated": [], "still_red": []}

    if not cfg_path:
        rec["status"] = "skipped"
        rec["reason"] = "no remediation config resolved"
        save_json(os.path.join(rem_dir, "reverify.json"), rec)
        print("[apply_and_reverify] 无配置，跳过。")
        return 0
    try:
        cfg = load_config(cfg_path)
    except ConfigError as e:
        rec["status"] = "config_error"
        rec["reason"] = str(e)
        save_json(os.path.join(rem_dir, "reverify.json"), rec)
        print("[apply_and_reverify] 配置非法：%s" % e)
        return 0

    plan_fp = os.path.join(rem_dir, "plan.json")
    plan = load_json(plan_fp) if os.path.exists(plan_fp) else {"defects": []}
    case_ids = [d["case_id"] for d in plan.get("defects", [])]
    spec_of = {d["case_id"]: d.get("spec_id", "") for d in plan.get("defects", [])}

    # 本地验证分支名（确定性，源自计划选中的 case；不再用于 PR head）
    prefix = cfg["repo"].get("local_branch_prefix") or cfg.get("pr", {}).get("branch_prefix", "autotestflow/fix")
    branch = ("%s/%s" % (prefix, case_ids[0])) if len(case_ids) == 1 \
        else "%s/%s" % (prefix, "-".join(sorted(case_ids)) or "remediation")
    rec["ref"] = cfg["repo"]["ref"]
    rec["branch"] = branch

    clone_abs = _abs_under(args.output_dir, cfg["repo"]["clone_path"])
    method = prepare_repo(cfg, args.output_dir, clone_abs, rec)
    if method is None:
        rec["status"] = "clone_failed"
        save_json(os.path.join(rem_dir, "reverify.json"), rec)
        print("[apply_and_reverify] 代码仓准备失败（clone/物化）。")
        return 0

    _git(["checkout", "-B", branch], cwd=clone_abs)

    # before 基线（来自已落盘的红结果）
    applied_cases = []
    for case in case_ids:
        res_fp = os.path.join(args.output_dir, ".state", "results", "%s.json" % case)
        before = load_json(res_fp).get("class", "sdk_defect") if os.path.exists(res_fp) else "sdk_defect"
        drec = {"case_id": case, "spec_id": spec_of.get(case, ""), "before": before}
        defect_dir = os.path.join(rem_dir, "defects", case)
        if apply_defect(clone_abs, defect_dir, cfg, drec):
            # 记录补丁规模
            pdiff = open(os.path.join(defect_dir, "patch.diff"), encoding="utf-8").read()
            drec["adds"], drec["dels"] = _count_changes(pdiff)
            applied_cases.append(case)
        rec["defects"][case] = drec

    # 复验：simulate（离线）或 live（真实）
    if cfg["reverify"].get("simulate"):
        rec["mode"] = "simulate"
        rec["build"] = "noop"
        rec["sut_ready"] = "simulated"
        sim = cfg["reverify"].get("simulated_after", {})
        for case in applied_cases:
            rec["defects"][case]["after"] = sim.get(case, "passed")
        rec["selftest"] = "simulated-pass"
    else:
        rec["mode"] = "live"
        reverify_live(cfg, args.output_dir, clone_abs, applied_cases, rec)

    # 绿门：黑盒转绿 ∧ 回归通过（simulate 视回归为 pass）
    selftest_ok = rec.get("selftest") in ("passed", "skipped", "simulated-pass")
    for case in case_ids:
        after = rec["defects"][case].get("after")
        if case in applied_cases and after == "passed" and selftest_ok:
            rec["remediated"].append(case)
        else:
            rec["still_red"].append(case)
    rec["status"] = "done"

    save_json(os.path.join(rem_dir, "reverify.json"), rec)
    print("[apply_and_reverify] method=%s build=%s ready=%s | remediated=%s still_red=%s"
          % (rec.get("repo_method"), rec.get("build"), rec.get("sut_ready"),
             rec["remediated"], rec["still_red"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
