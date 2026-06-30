#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Target runtime orchestration for multi-SUT AutoTestFlow runs.

This script intentionally separates readiness checks from command execution.
Readiness is safe by default. Build/start/stop commands are only executed when
the caller supplies --allow-commands; otherwise they are reported as blocked or,
with --dry-run, planned but not executed.
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from sut_manifest import load_normalized, write_normalized  # noqa: E402


class RuntimeError(ValueError):
    """Raised when runtime orchestration cannot proceed safely."""


def _url(base_url, path):
    base = (base_url or "").rstrip("/")
    if not path:
        return base
    return base + (path if str(path).startswith("/") else "/" + str(path))


def _target_by_id(normalized, target_id):
    for target in normalized.get("targets", []):
        if target.get("id") == target_id:
            return target
    raise RuntimeError("Unknown target_id: %s" % target_id)


def readiness_check(target, timeout=5.0):
    runtime = target.get("runtime") or {}
    probe = runtime.get("readiness_probe") or {}
    method = str(probe.get("method") or "GET").upper()
    path = probe.get("path") or "/"
    expect_status_lt = int(probe.get("expect_status_lt") or 500)
    url = _url(runtime.get("base_url"), path)
    request = urllib.request.Request(url, method=method)
    started = time.time()
    try:
        if method not in ("GET", "HEAD"):
            request.data = b""
            request.add_header("Content-Length", "0")
        with urllib.request.urlopen(request, timeout=timeout) as resp:
            status = int(resp.getcode())
        return {
            "target_id": target.get("id"),
            "status": "ready" if status < expect_status_lt else "not_ready",
            "reachable": status < expect_status_lt,
            "http_status": status,
            "url": url,
            "elapsed_ms": int((time.time() - started) * 1000),
        }
    except urllib.error.HTTPError as exc:
        status = int(exc.code)
        return {
            "target_id": target.get("id"),
            "status": "ready" if status < expect_status_lt else "not_ready",
            "reachable": status < expect_status_lt,
            "http_status": status,
            "url": url,
            "elapsed_ms": int((time.time() - started) * 1000),
            "error": str(exc),
        }
    except Exception as exc:
        return {
            "target_id": target.get("id"),
            "status": "not_ready",
            "reachable": False,
            "url": url,
            "elapsed_ms": int((time.time() - started) * 1000),
            "error": repr(exc),
        }


def _run_command(command, cwd=None, background=False, timeout=None):
    if background:
        proc = subprocess.Popen(
            command,
            cwd=cwd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return {"command": command, "background": True, "pid": proc.pid, "returncode": None}
    completed = subprocess.run(
        command,
        cwd=cwd,
        shell=True,
        timeout=timeout,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return {
        "command": command,
        "background": False,
        "returncode": completed.returncode,
        "stdout_tail": (completed.stdout or "")[-4000:],
        "stderr_tail": (completed.stderr or "")[-4000:],
    }


def _command_plan(target, action):
    runtime = target.get("runtime") or {}
    commands = runtime.get("commands") or {}
    if action == "prepare":
        return [name for name in ("build", "start") if commands.get(name)]
    if action == "stop":
        return [name for name in ("stop",) if commands.get(name)]
    return []


def orchestrate_target(target, action="ready", allow_commands=False, dry_run=False, timeout=5.0):
    runtime = target.get("runtime") or {}
    mode = runtime.get("mode")
    commands = runtime.get("commands") or {}
    result = {
        "target_id": target.get("id"),
        "action": action,
        "mode": mode,
        "dry_run": bool(dry_run),
        "commands": [],
        "command_allowed": bool(allow_commands),
    }

    if action not in ("ready", "prepare", "stop"):
        raise RuntimeError("Unsupported action: %s" % action)

    planned = _command_plan(target, action)
    for name in planned:
        result["commands"].append({"name": name, "command": commands.get(name), "planned": True})

    if action in ("prepare", "stop") and planned:
        if dry_run:
            result["status"] = "dry_run"
            if action == "prepare":
                result["readiness"] = readiness_check(target, timeout=timeout)
            return result
        if not allow_commands:
            result["status"] = "command_blocked"
            result["reachable"] = False
            result["error"] = "Managed runtime commands require --allow-commands after human confirmation."
            return result
        cwd = target.get("source", {}).get("abs_path") or None
        executed = []
        for item in result["commands"]:
            name = item["name"]
            background = name == "start" and bool(runtime.get("restart_in_background", True))
            executed_item = _run_command(item["command"], cwd=cwd, background=background)
            executed_item["name"] = name
            executed.append(executed_item)
            if executed_item.get("returncode") not in (None, 0):
                result["status"] = "command_failed"
                result["commands"] = executed
                result["reachable"] = False
                return result
        result["commands"] = executed

    if action in ("ready", "prepare"):
        ready = readiness_check(target, timeout=timeout)
        result["readiness"] = ready
        result["reachable"] = bool(ready.get("reachable"))
        result["status"] = "ready" if result["reachable"] else "env_issue"
    elif action == "stop":
        result.setdefault("status", "stopped" if allow_commands or not planned else "noop")
    return result


def write_runtime_result(target, result, output_path=None):
    output_path = output_path or target.get("ready_path")
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2)
    return output_path


def write_target_env_issue(target, note, case_ids=None):
    case_ids = case_ids or []
    results = []
    for case_id in case_ids:
        results.append({
            "target_id": target.get("id"),
            "case_id": case_id,
            "status": "env_issue",
            "class": "env_issue",
            "skip_reason": note,
        })
    payload = {
        "target_id": target.get("id"),
        "status": "env_issue",
        "summary": note,
        "results": results,
    }
    path = target.get("case_results_path")
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    return path


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run readiness or managed runtime actions for a SUT target")
    parser.add_argument("--manifest-normalized", required=True)
    parser.add_argument("--target-id", required=True)
    parser.add_argument("--action", choices=["ready", "prepare", "stop"], default="ready")
    parser.add_argument("--allow-commands", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--timeout", type=float, default=5.0)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args(argv)

    try:
        normalized = load_normalized(args.manifest_normalized)
        target = _target_by_id(normalized, args.target_id)
        result = orchestrate_target(
            target,
            action=args.action,
            allow_commands=args.allow_commands,
            dry_run=args.dry_run,
            timeout=args.timeout,
        )
        if args.write:
            path = write_runtime_result(target, result)
            print(path)
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result.get("status") not in ("command_failed", "command_blocked") else 2
    except RuntimeError as exc:
        print("[sut_runtime] ERROR: %s" % exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
