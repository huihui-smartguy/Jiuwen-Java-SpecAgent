#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
remediation_config.py - 自动修复(auto-remediation, v2.1)配置加载/校验（三脚本共用）

声明被测对象(SUT)与其代码仓的「修复配置文件」的读取、必填校验、缺省展开。被
`scripts/remediation_plan.py` / `apply_and_reverify.py` / `submit_remediation.py` 复用，
集中 IO 助手与路径解析，避免在各脚本重复。纯标准库、无网络。

安全红线：加载时**强制断言** `switches.require_evidence_before_issue is True`（兼容旧
`require_green_before_pr` 别名），杜绝把"实证前提"配置掉而绕过"生成器不得自我认证"。
配置**不含任何 token 字段**（鉴权用 gh 环境）。
"""

import argparse
import json
import os
import sys

CONFIG_BASENAME = "remediation.config.json"


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data, indent=2):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)


class ConfigError(ValueError):
    """配置缺失/非法（含 evidence guard 红线）。"""


def resolve_config_path(output_dir=None, work_dir=None, explicit=None):
    """解析顺序：explicit → <output_dir>/remediation.config.json
    → <work_dir>/.autotestflow/remediation.config.json。找不到返回 None。"""
    cands = []
    if explicit:
        cands.append(explicit)
    if output_dir:
        cands.append(os.path.join(output_dir, CONFIG_BASENAME))
    if work_dir:
        cands.append(os.path.join(work_dir, ".autotestflow", CONFIG_BASENAME))
    for c in cands:
        if c and os.path.exists(c):
            return c
    return None


_REQUIRED = [("sut", "base_url"), ("repo", "upstream_url"), ("repo", "ref"),
             ("repo", "clone_path")]


def load_config(path):
    """读取 + 必填校验 + 红线校验 + 缺省展开。非法抛 ConfigError。"""
    cfg = load_json(path)
    for sec, key in _REQUIRED:
        if not isinstance(cfg.get(sec), dict) or not cfg[sec].get(key):
            raise ConfigError("配置缺少必填项 %s.%s（%s）" % (sec, key, path))
    sw = cfg.setdefault("switches", {})
    if "require_evidence_before_issue" not in sw and "require_green_before_pr" in sw:
        sw["require_evidence_before_issue"] = sw["require_green_before_pr"]
    if sw.get("require_evidence_before_issue") is not True:
        raise ConfigError("switches.require_evidence_before_issue 必须为 true（实证前提不可关闭）")
    return expand_defaults(cfg)


def expand_defaults(cfg):
    """填充安全默认值（缺失即取保守值）。"""
    repo = cfg.setdefault("repo", {})
    repo.setdefault("local_branch_prefix", "autotestflow/fix")
    repo.setdefault("business_code_roots", ["src/main"])
    repo.setdefault("selftest_roots", ["src/test"])
    repo.setdefault("default_branch", "main")
    build = cfg.setdefault("build", {})
    build.setdefault("tool", "maven")
    build.setdefault("workdir", ".")
    run = cfg.setdefault("run", {})
    run.setdefault("restart_in_background", True)
    run.setdefault("readiness_timeout_sec", 60)
    # Deprecated PR fields are tolerated for one iteration but are not used.
    cfg.setdefault("pr", {})
    cfg.setdefault("issue", {}).setdefault("labels", ["bug", "auto-remediation"])
    sw = cfg.setdefault("switches", {})
    sw.setdefault("allow_push", False)       # deprecated, ignored
    sw.setdefault("allow_open_pr", False)    # deprecated, ignored
    sw.setdefault("allow_open_issue", False)
    sw.setdefault("require_evidence_before_issue", True)
    rev = cfg.setdefault("reverify", {})
    rev.setdefault("simulate", False)        # true=离线/fixture（跳过重启/pytest，用 simulated_after）
    rev.setdefault("simulated_after", {})
    return cfg


def upstream_slug(upstream_url):
    """取 <owner>/<repo>（供 gh --repo）。"""
    parts = (upstream_url or "").rstrip("/").replace(".git", "").split("/")
    return "/".join(parts[-2:]) if len(parts) >= 2 else (upstream_url or "")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Validate an AutoTestFlow remediation.config.json file")
    parser.add_argument("--check", metavar="PATH", help="Path to remediation.config.json")
    parser.add_argument("--print-expanded", action="store_true",
                        help="Print the config after safe defaults are expanded")
    args = parser.parse_args(argv)
    if not args.check:
        parser.error("Provide --check <path>")
    try:
        cfg = load_config(args.check)
    except (OSError, json.JSONDecodeError, ConfigError) as exc:
        print("[remediation_config] ERROR: %s" % exc, file=sys.stderr)
        return 2
    if args.print_expanded:
        print(json.dumps(cfg, ensure_ascii=False, indent=2))
    else:
        print("[remediation_config] OK: %s" % args.check)
    return 0


if __name__ == "__main__":
    sys.exit(main())
