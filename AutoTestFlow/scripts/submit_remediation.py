#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
submit_remediation.py - stage7 提交：push fork → gh PR(fork→upstream) + gh issue(upstream)

仅当 `--remediate=on` 且 `--gate-confirmed`（编排器在强制确认门通过后传入）且配置
`switches.allow_*` 为 true 时，才执行对应外发动作；任一不满足 → **零 gh 调用**、写
submitted.json 记录跳过原因。`--issue-only` 对应门内"仅记 issue 不提 PR"。

幂等：创建前用 `gh pr/issue list` 去重，复用既有 URL。不读/打印 token（鉴权用 ambient
`gh auth` / `GH_TOKEN`）。失败优雅（记录、不抛栈）。绿前提：只有 reverify.remediated 的
缺陷可进 PR（require_green_before_pr）。

用法：
    python submit_remediation.py --output-dir <dir> --remediate dry-run|on \
        [--gate-confirmed] [--issue-only] [--remediation-config <path>]
"""

import argparse
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "reference"))
from remediation_config import (  # noqa: E402
    load_json, save_json, load_config, resolve_config_path, ConfigError,
    fork_owner, upstream_slug,
)


def _run(cmd, cwd=None, timeout=120):
    """运行外发命令（git/gh），返回 (rc, out)。不抛栈。"""
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, ((p.stdout or "") + (p.stderr or "")).strip()
    except FileNotFoundError as e:
        return 127, "command not found: %r" % e
    except Exception as e:  # pragma: no cover - defensive
        return 1, repr(e)


def _read(path):
    return open(path, encoding="utf-8").read() if os.path.exists(path) else ""


def main():
    parser = argparse.ArgumentParser(description="stage7 提交 PR/issue（门控、幂等、dry-run 安全）")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--remediation-config", default=None)
    parser.add_argument("--work-dir", default=None)
    parser.add_argument("--remediate", default="dry-run", choices=["off", "dry-run", "on"])
    parser.add_argument("--gate-confirmed", action="store_true",
                        help="编排器在强制确认门得到用户确认后传入")
    parser.add_argument("--issue-only", action="store_true",
                        help="门内选择'仅记 issue 不提 PR'")
    args = parser.parse_args()

    rem_dir = os.path.join(args.output_dir, ".state", "remediation")
    submitted = {"generated_by": "submit_remediation.py", "mode": "dry-run",
                 "pushed_branch": None, "pr": None, "issues": [], "skipped": []}

    def finish(msg):
        save_json(os.path.join(rem_dir, "submitted.json"), submitted)
        print("[submit_remediation] %s" % msg)
        return 0

    cfg_path = resolve_config_path(args.output_dir, args.work_dir, args.remediation_config)
    if not cfg_path:
        submitted["skipped"].append({"action": "all", "reason": "no remediation config"})
        return finish("无配置，跳过。")
    try:
        cfg = load_config(cfg_path)
    except ConfigError as e:
        submitted["skipped"].append({"action": "all", "reason": "config_error: %s" % e})
        return finish("配置非法：%s" % e)

    reverify = load_json(os.path.join(rem_dir, "reverify.json")) if \
        os.path.exists(os.path.join(rem_dir, "reverify.json")) else {}
    manifest = load_json(os.path.join(rem_dir, "manifest.json")) if \
        os.path.exists(os.path.join(rem_dir, "manifest.json")) else {"defects": []}
    remediated = reverify.get("remediated", [])
    branch = reverify.get("branch")

    # ---- 守卫：非 on 或 未过门 → 零 gh 调用 ----
    is_on = (args.remediate == "on") and args.gate_confirmed
    if not is_on:
        submitted["mode"] = "dry-run"
        submitted["skipped"].append({
            "action": "all",
            "reason": "remediate=%s gate_confirmed=%s（非 on 或未过门）" %
                      (args.remediate, args.gate_confirmed)})
        return finish("dry-run：未做任何外发动作（push/PR/issue 全跳过）。")

    sw = cfg["switches"]
    submitted["mode"] = "issue-only" if args.issue_only else "on"
    clone_abs = cfg["repo"]["clone_path"]
    if not os.path.isabs(clone_abs):
        clone_abs = os.path.normpath(os.path.join(args.output_dir, clone_abs))
    slug = upstream_slug(cfg["repo"]["upstream_url"])
    fo = fork_owner(cfg["repo"]["fork_url"])

    # ---- push fork ----
    if args.issue_only or not sw.get("allow_push"):
        submitted["skipped"].append({"action": "push",
            "reason": "issue_only" if args.issue_only else "allow_push=false"})
    elif not remediated:
        submitted["skipped"].append({"action": "push", "reason": "no remediated defects（绿门未过）"})
    else:
        remote = cfg["repo"]["fork_remote_name"]
        _run(["git", "remote", "add", remote, cfg["repo"]["fork_url"]], cwd=clone_abs)
        _run(["git", "remote", "set-url", remote, cfg["repo"]["fork_url"]], cwd=clone_abs)
        rc, out = _run(["git", "push", "-u", remote, branch], cwd=clone_abs)
        if rc == 0:
            submitted["pushed_branch"] = branch
        else:
            submitted["skipped"].append({"action": "push", "reason": "git push 失败", "detail": out[-300:]})

    # ---- gh PR (fork→upstream) ----
    if args.issue_only or not sw.get("allow_open_pr"):
        submitted["skipped"].append({"action": "pr",
            "reason": "issue_only" if args.issue_only else "allow_open_pr=false"})
    elif not remediated or not submitted["pushed_branch"]:
        submitted["skipped"].append({"action": "pr", "reason": "no remediated/pushed（绿门未过）"})
    else:
        head = "%s:%s" % (fo, branch)
        # 幂等：先查是否已存在该 head 的 PR
        rc, out = _run(["gh", "pr", "list", "--repo", slug, "--head", branch,
                        "--json", "url,number", "-q", ".[0].url"])
        if rc == 0 and out.startswith("http"):
            submitted["pr"] = {"url": out, "number": None, "reused": True}
        else:
            pr_body = _read(os.path.join(rem_dir, "defects", remediated[0], "pr.md")) or \
                      "Auto-remediation PR (see issues)."
            body_fp = os.path.join(rem_dir, "_pr_body.md")
            with open(body_fp, "w", encoding="utf-8") as f:
                f.write(pr_body)
            cmd = ["gh", "pr", "create", "--repo", slug, "--head", head,
                   "--base", cfg["pr"]["target_branch"],
                   "--title", "[auto-remediation] fix %d sdk_defect(s)" % len(remediated),
                   "--body-file", body_fp]
            for lb in cfg["pr"].get("labels", []):
                cmd += ["--label", lb]
            if cfg["pr"].get("draft"):
                cmd.append("--draft")
            rc, out = _run(cmd)
            submitted["pr"] = {"url": out if rc == 0 else None, "number": None,
                               "ok": rc == 0, "detail": None if rc == 0 else out[-300:]}

    # ---- gh issue (upstream)，逐缺陷（localizable + needs_human 都开）----
    if not sw.get("allow_open_issue"):
        submitted["skipped"].append({"action": "issue", "reason": "allow_open_issue=false"})
    else:
        for d in manifest.get("defects", []):
            case = d["case_id"]
            issue_fp = os.path.join(rem_dir, "defects", case, "issue.md")
            if not os.path.exists(issue_fp):
                continue
            title = d.get("issue_title") or ("[spec-violation] %s (%s)" % (d.get("spec_id"), case))
            rc, out = _run(["gh", "issue", "list", "--repo", slug, "--search", case,
                            "--json", "url", "-q", ".[0].url"])
            if rc == 0 and out.startswith("http"):
                submitted["issues"].append({"case_id": case, "url": out, "reused": True})
                continue
            cmd = ["gh", "issue", "create", "--repo", slug, "--title", title,
                   "--body-file", issue_fp]
            for lb in cfg["issue"].get("labels", []):
                cmd += ["--label", lb]
            rc, out = _run(cmd)
            submitted["issues"].append({"case_id": case, "url": out if rc == 0 else None,
                                        "ok": rc == 0, "detail": None if rc == 0 else out[-300:]})

    return finish("mode=%s pushed=%s pr=%s issues=%d skipped=%d" % (
        submitted["mode"], submitted["pushed_branch"],
        (submitted["pr"] or {}).get("url"), len(submitted["issues"]),
        len(submitted["skipped"])))


if __name__ == "__main__":
    sys.exit(main())
