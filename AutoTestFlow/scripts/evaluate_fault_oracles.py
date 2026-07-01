#!/usr/bin/env python3
"""
evaluate_fault_oracles.py - Stage4 trace/process oracle evaluator.

Fault-library cases are executable defect probes. A successful final pytest
assertion is not enough for a fault_ref case to pass: required process and
negative oracles must also be satisfied by the black-box trace.

The evaluator is intentionally deterministic and black-box. It reads:
  - test_design.json for the case contract and fault_oracles
  - .state/results/{case_id}.json for the current Stage4 result
  - .state/trace/*.jsonl for observable requests, responses, and SSE frames

It never submits issues, mutates the SUT, or inspects implementation internals.
"""

import argparse
import json
import os
import re
import sys
from glob import glob
from typing import Any, Optional, Set, Tuple


PASS_STATUSES = {"passed", "pass"}
FAULT_AUTHORITIES = {"spec-required", "fault-required"}
CONFIG_AUTHORITIES = {
    "deployment-config-dependent",
    "config-dependent",
    "needs-runtime-verify",
}
TERMINAL_STATES = {"COMPLETED", "FAILED", "CANCELED", "CANCELLED", "ERROR", "DONE", "SUCCESS"}


def load_json(path: str, default=None):
    if not path or not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def save_json(path: str, data, indent=2):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=indent)


def normalize_status(value: Any) -> str:
    return str(value or "").strip().lower()


def sanitize_case_id(case_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_]+", "_", str(case_id)).strip("_").lower()


def relpath(path: str, root: str) -> str:
    try:
        return os.path.relpath(path, root)
    except Exception:
        return path


def load_case(output_dir: str, case_id: str) -> dict:
    design = load_json(os.path.join(output_dir, "test_design.json"), default=[])
    cases = []
    if isinstance(design, list):
        cases = design
    elif isinstance(design, dict):
        for key in ("cases", "test_cases"):
            if isinstance(design.get(key), list):
                cases = design[key]
                break
    for case in cases:
        if str(case.get("case_id")) == str(case_id):
            return case
    return {}


def trace_candidates(output_dir: str, case_id: str, result: dict) -> list:
    trace_dir = os.path.join(output_dir, ".state", "trace")
    candidates = []

    trace_file = result.get("trace_file") if isinstance(result, dict) else None
    if trace_file:
        candidates.append(trace_file if os.path.isabs(trace_file) else os.path.join(output_dir, trace_file))

    safe = sanitize_case_id(case_id)
    names = [
        f"{case_id}.jsonl",
        f"{str(case_id).lower()}.jsonl",
        f"{safe}.jsonl",
        f"test_{safe}.jsonl",
    ]
    candidates.extend(os.path.join(trace_dir, name) for name in names)
    candidates.extend(sorted(glob(os.path.join(trace_dir, f"*{safe}*.jsonl"))))
    candidates.extend(sorted(glob(os.path.join(trace_dir, f"*{str(case_id).lower()}*.jsonl"))))

    seen = set()
    out = []
    for path in candidates:
        ap = os.path.abspath(path)
        if ap in seen:
            continue
        seen.add(ap)
        out.append(path)
    return out


def find_trace_path(output_dir: str, case_id: str, result: dict) -> Optional[str]:
    for path in trace_candidates(output_dir, case_id, result):
        if os.path.exists(path):
            return path
    return None


def load_trace(path: Optional[str]) -> list:
    if not path or not os.path.exists(path):
        return []
    records = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                records.append({"kind": "raw", "raw": line})
    return records


def as_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    except Exception:
        return str(value)


def iter_dicts(value: Any):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from iter_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_dicts(child)


def extract_key_values(value: Any, key: str) -> list:
    out = []
    for obj in iter_dicts(value):
        if key in obj:
            out.append(obj[key])
    return out


def non_empty_error(value: Any) -> Optional[Any]:
    for obj in iter_dicts(value):
        if "error" in obj and obj["error"] not in (None, "", {}, []):
            return obj["error"]
    return None


def response_records(records: list) -> list:
    return [r for r in records if r.get("kind") == "response"]


def request_records(records: list) -> list:
    return [r for r in records if r.get("kind") == "request"]


def sse_records(records: list) -> list:
    return [r for r in records if r.get("kind") == "sse_event"]


def terminal_states_from_payload(value: Any, expected: Set[str]) -> list:
    states = []
    for obj in iter_dicts(value):
        for key in ("state", "status", "terminal_state"):
            val = obj.get(key)
            if isinstance(val, dict):
                states.extend(terminal_states_from_payload(val, expected))
            elif isinstance(val, str):
                norm = val.upper()
                if norm.startswith("TASK_STATE_"):
                    norm = norm[len("TASK_STATE_"):]
                if norm in expected:
                    states.append(norm)
    if isinstance(value, str):
        upper = value.upper()
        for state in expected:
            if state in upper:
                states.append(state)
    return states


def expected_terminal_states(oracle: dict) -> Set[str]:
    expected = oracle.get("expected") or {}
    values = expected.get("terminal_states") or expected.get("states") or []
    return {str(v).upper() for v in values} or set(TERMINAL_STATES)


def result_item(oracle: dict, status: str, detail: str, observed=None) -> dict:
    item = {
        "id": oracle.get("id"),
        "kind": oracle.get("kind", "unknown"),
        "check": oracle.get("check", "unknown"),
        "status": status,
        "required": bool(oracle.get("required", True)),
        "authority": oracle.get("authority", "unknown"),
        "assert_level": oracle.get("assert_level"),
        "detail": detail,
    }
    for key in ("spec_id", "field", "expected", "source", "on_unobservable"):
        if key in oracle:
            item[key] = oracle[key]
    if observed is not None:
        item["observed"] = observed
    return item


def explicit_evidence(records: list, oracle: dict) -> Optional[dict]:
    """Allow future generated tests to append explicit black-box evidence."""
    oid = oracle.get("id")
    check = oracle.get("check")
    for rec in records:
        evidence = rec.get("fault_oracle_evidence") or rec.get("oracle_evidence")
        if not evidence:
            continue
        items = evidence if isinstance(evidence, list) else [evidence]
        for item in items:
            if oid and item.get("id") != oid:
                continue
            if check and item.get("check") not in (None, check):
                continue
            status = normalize_status(item.get("status"))
            if status in {"passed", "failed", "unobservable"}:
                return item
    return None


def eval_trace_observed(oracle: dict, records: list) -> dict:
    expected = oracle.get("expected") or {}
    min_records = int(expected.get("min_records", 1))
    count = len([r for r in records if r.get("kind") in {"request", "response", "sse_event"}])
    if count >= min_records:
        return result_item(oracle, "passed", f"observed {count} trace records", {"records": count})
    return result_item(oracle, "unobservable", f"expected at least {min_records} trace records, observed {count}",
                       {"records": count})


def eval_no_unexpected_5xx(oracle: dict, records: list) -> dict:
    failures = []
    for rec in response_records(records):
        status = rec.get("status_code")
        if isinstance(status, int) and status >= 500:
            failures.append({"status_code": status, "method": rec.get("method")})
    if failures:
        return result_item(oracle, "failed", "observed unexpected 5xx response", failures)
    if response_records(records):
        return result_item(oracle, "passed", "no response status >= 500 observed")
    return result_item(oracle, "unobservable", "no response records available")


def eval_no_unexpected_error_frame(oracle: dict, records: list) -> dict:
    failures = []
    for rec in response_records(records):
        err = non_empty_error(rec.get("body"))
        if err is not None:
            failures.append({"kind": "response", "error": err})
    for rec in sse_records(records):
        event = rec.get("event") or {}
        event_name = str(event.get("event", "")).lower() if isinstance(event, dict) else ""
        err = non_empty_error(event)
        if event_name == "error" or err is not None:
            failures.append({"kind": "sse_event", "event": event})
    if failures:
        return result_item(oracle, "failed", "observed unexpected error frame", failures)
    if response_records(records) or sse_records(records):
        return result_item(oracle, "passed", "no unexpected error frame observed")
    return result_item(oracle, "unobservable", "no response or SSE records available")


def eval_error_code_matches(oracle: dict, records: list) -> dict:
    expected = oracle.get("expected") or {}
    expected_status = expected.get("http_status")
    expected_code = expected.get("error_code")
    observed_statuses = [r.get("status_code") for r in response_records(records) if r.get("status_code") is not None]
    observed_codes = []
    for rec in response_records(records):
        observed_codes.extend(extract_key_values(rec.get("body"), "code"))
    for rec in sse_records(records):
        observed_codes.extend(extract_key_values(rec.get("event"), "code"))

    checks = []
    if expected_status is not None:
        checks.append(("http_status", int(expected_status), [int(s) for s in observed_statuses if isinstance(s, int)]))
    if expected_code is not None:
        checks.append(("error_code", int(expected_code), [int(c) for c in observed_codes if isinstance(c, int)]))

    if not checks:
        return result_item(oracle, "unobservable", "no expected http_status or error_code supplied")

    failed = []
    unobservable = []
    for name, want, observed in checks:
        if not observed:
            unobservable.append(name)
        elif want not in observed:
            failed.append({"field": name, "expected": want, "observed": observed})
    if failed:
        return result_item(oracle, "failed", "observed error/status does not match expected", failed)
    if unobservable:
        return result_item(oracle, "unobservable", "missing observable " + ",".join(unobservable),
                           {"statuses": observed_statuses, "codes": observed_codes})
    return result_item(oracle, "passed", "expected status/error code observed",
                       {"statuses": observed_statuses, "codes": observed_codes})


def eval_correlation_id_preserved(oracle: dict, records: list) -> dict:
    req_ids = []
    for rec in request_records(records):
        req_ids.extend(extract_key_values(rec.get("body"), "id"))
    resp_ids = []
    for rec in response_records(records):
        resp_ids.extend(extract_key_values(rec.get("body"), "id"))
    req_ids = [x for x in req_ids if x not in (None, "")]
    resp_ids = [x for x in resp_ids if x not in (None, "")]
    if not req_ids or not resp_ids:
        return result_item(oracle, "unobservable", "request or response id was not observable",
                           {"request_ids": req_ids, "response_ids": resp_ids})
    allowed = {str(x) for x in req_ids}
    mismatches = [x for x in resp_ids if str(x) not in allowed]
    if mismatches:
        return result_item(oracle, "failed", "response id did not preserve request id",
                           {"request_ids": req_ids, "response_ids": resp_ids, "mismatches": mismatches})
    return result_item(oracle, "passed", "response ids preserve request ids",
                       {"request_ids": req_ids, "response_ids": resp_ids})


def eval_sse_terminal_state(oracle: dict, records: list) -> dict:
    events = sse_records(records)
    expected = expected_terminal_states(oracle)
    observed = []
    for rec in events:
        observed.extend(terminal_states_from_payload(rec.get("event"), expected))
    if observed:
        return result_item(oracle, "passed", "observed terminal SSE state", {"terminal_states": observed})
    if events:
        return result_item(oracle, "failed", "SSE stream ended without a terminal state",
                           {"events": len(events)})
    return result_item(oracle, "unobservable", "no SSE events recorded")


def eval_no_duplicate_terminal_event(oracle: dict, records: list) -> dict:
    events = sse_records(records)
    expected = expected_terminal_states(oracle)
    terminal = []
    for rec in events:
        states = terminal_states_from_payload(rec.get("event"), expected)
        if states:
            terminal.append({"idx": rec.get("idx"), "states": states})
    if len(terminal) > 1:
        return result_item(oracle, "failed", "observed duplicate terminal SSE events", terminal)
    if events:
        return result_item(oracle, "passed", "no duplicate terminal SSE event observed",
                           {"terminal_events": terminal})
    return result_item(oracle, "unobservable", "no SSE events recorded")


def eval_followup_state(oracle: dict, records: list) -> dict:
    evidence = explicit_evidence(records, oracle)
    if evidence:
        return result_item(oracle, normalize_status(evidence.get("status")), evidence.get("detail", "explicit evidence"),
                           evidence)
    return result_item(oracle, "unobservable",
                       "resource/state mutation is not machine-checkable without explicit follow-up observation")


def eval_retry_or_timeout_observed(oracle: dict, records: list) -> dict:
    req_counts = {}
    for rec in request_records(records):
        key = (rec.get("method"), rec.get("url"))
        req_counts[key] = req_counts.get(key, 0) + 1
    repeated = [list(k) + [v] for k, v in req_counts.items() if v > 1 and any(k)]
    text = "\n".join(as_text(r) for r in records).lower()
    signals = (oracle.get("expected") or {}).get("signals") or ["retry", "timeout", "fallback", "degraded", "cache"]
    hits = [s for s in signals if str(s).lower() in text]
    if repeated or hits:
        return result_item(oracle, "passed", "observed retry/timeout/fallback signal",
                           {"repeated_requests": repeated, "signals": hits})
    if records:
        return result_item(oracle, "unobservable", "no retry/timeout/fallback signal was observable")
    return result_item(oracle, "unobservable", "no trace records available")


EVALUATORS = {
    "trace_observed": eval_trace_observed,
    "no_unexpected_5xx": eval_no_unexpected_5xx,
    "no_unexpected_error_frame": eval_no_unexpected_error_frame,
    "error_code_matches": eval_error_code_matches,
    "correlation_id_preserved": eval_correlation_id_preserved,
    "sse_terminal_state": eval_sse_terminal_state,
    "no_duplicate_terminal_event": eval_no_duplicate_terminal_event,
    "resource_not_created": eval_followup_state,
    "state_not_mutated": eval_followup_state,
    "retry_or_timeout_observed": eval_retry_or_timeout_observed,
}


def evaluate_oracle(oracle: dict, records: list) -> dict:
    evidence = explicit_evidence(records, oracle)
    if evidence:
        return result_item(oracle, normalize_status(evidence.get("status")), evidence.get("detail", "explicit evidence"),
                           evidence)
    check = oracle.get("check")
    evaluator = EVALUATORS.get(check)
    if not evaluator:
        return result_item(oracle, "unobservable", f"unsupported fault oracle check: {check}")
    return evaluator(oracle, records)


def classify(results: list) -> str:
    required = [r for r in results if r.get("required")]
    failed = [r for r in required if r.get("status") == "failed"]
    unobservable = [r for r in required if r.get("status") == "unobservable"]

    if failed:
        if any(r.get("authority") in FAULT_AUTHORITIES for r in failed):
            return "sdk_defect"
        return "sut_unsatisfied"
    if unobservable:
        if all(r.get("authority") in CONFIG_AUTHORITIES for r in unobservable):
            return "sut_unsatisfied"
        return "requires_human_review"
    return "passed"


def summarize(results: list, classification: str, trace_file: Optional[str], fault_ref: Optional[str]) -> dict:
    counts = {
        "passed": 0,
        "failed": 0,
        "unobservable": 0,
        "not_applicable": 0,
        "by_kind": {},
    }
    for item in results:
        status = item.get("status", "unknown")
        kind = item.get("kind", "unknown")
        counts[status] = counts.get(status, 0) + 1
        counts["by_kind"].setdefault(kind, {"passed": 0, "failed": 0, "unobservable": 0, "not_applicable": 0})
        counts["by_kind"][kind][status] = counts["by_kind"][kind].get(status, 0) + 1
    blocking = [
        {
            "id": r.get("id"),
            "kind": r.get("kind"),
            "check": r.get("check"),
            "status": r.get("status"),
            "detail": r.get("detail"),
        }
        for r in results
        if r.get("required") and r.get("status") in {"failed", "unobservable"}
    ]
    return {
        "fault_ref": fault_ref,
        "overall_status": classification,
        "classification": classification,
        "trace_file": trace_file,
        "counts": counts,
        "blocking_oracles": blocking,
    }


def missing_oracle_result(fault_ref: str) -> list:
    return [{
        "id": f"{fault_ref}:fault_oracles_present:1",
        "kind": "process",
        "check": "fault_oracles_present",
        "status": "unobservable",
        "required": True,
        "authority": "fault-required",
        "assert_level": "L2",
        "detail": "fault_ref case is missing required fault_oracles",
    }]


def evaluate(output_dir: str, case_id: str, result_path: Optional[str] = None) -> Tuple[list, dict]:
    result_path = result_path or os.path.join(output_dir, ".state", "results", f"{case_id}.json")
    result = load_json(result_path, default={}) or {}
    case = load_case(output_dir, case_id)

    fault_ref = case.get("fault_ref") or result.get("fault_ref")
    if not fault_ref:
        summary = {
            "fault_ref": None,
            "overall_status": "not_applicable",
            "classification": "not_applicable",
            "trace_file": None,
            "counts": {"not_applicable": 1, "by_kind": {}},
            "blocking_oracles": [],
        }
        return [], summary

    fault_oracles = case.get("fault_oracles") or result.get("fault_oracles") or []
    trace_path = find_trace_path(output_dir, case_id, result)
    records = load_trace(trace_path)
    trace_file = relpath(trace_path, output_dir) if trace_path else None

    if not fault_oracles:
        results = missing_oracle_result(fault_ref)
    else:
        results = [evaluate_oracle(oracle, records) for oracle in fault_oracles]
    classification = classify(results)
    summary = summarize(results, classification, trace_file, fault_ref)
    return results, summary


def first_blocking_result(results: list) -> dict:
    for status in ("failed", "unobservable"):
        for item in results:
            if item.get("required") and item.get("status") == status:
                return item
    return {}


def write_back(output_dir: str, case_id: str, result_path: Optional[str], results: list, summary: dict) -> dict:
    result_path = result_path or os.path.join(output_dir, ".state", "results", f"{case_id}.json")
    result = load_json(result_path, default={}) or {"case_id": case_id}
    result.setdefault("case_id", case_id)
    if summary.get("fault_ref"):
        result.setdefault("fault_ref", summary["fault_ref"])
    old_status = normalize_status(result.get("status"))
    if "pytest_status" not in result and old_status:
        result["pytest_status"] = old_status
    result["fault_oracle_results"] = results
    result["fault_oracle_summary"] = summary
    if summary.get("trace_file"):
        result["trace_file"] = summary["trace_file"]

    classification = summary.get("classification")
    if classification not in {"passed", "not_applicable"} and (not old_status or old_status in PASS_STATUSES):
        result["status"] = classification
        result["class"] = classification
        blocking = first_blocking_result(results)
        if classification == "sdk_defect":
            defect = result.get("sdk_defect") if isinstance(result.get("sdk_defect"), dict) else {}
            evidence = {
                "fault_oracle_id": blocking.get("id"),
                "check": blocking.get("check"),
                "kind": blocking.get("kind"),
                "detail": blocking.get("detail"),
                "observed": blocking.get("observed"),
            }
            defect.setdefault("spec_id", blocking.get("spec_id"))
            defect.setdefault("field", blocking.get("field"))
            defect.setdefault("expected", blocking.get("expected"))
            defect.setdefault("actual", blocking.get("detail"))
            defect["evidence_type"] = "fault_oracle_trace"
            defect.setdefault("fault_oracle_evidence", []).append(evidence)
            result["sdk_defect"] = defect
        elif classification == "sut_unsatisfied":
            result.setdefault("skip_reason", first_blocking_result(results).get("detail"))
        elif classification == "requires_human_review":
            result.setdefault("review_reason", first_blocking_result(results).get("detail"))
    elif classification == "passed" and (not old_status or old_status in PASS_STATUSES):
        result["status"] = "passed"
        result["class"] = None

    save_json(result_path, result)
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description="Evaluate fault_ref trace oracles for one Stage4 result")
    parser.add_argument("--output-dir", required=True, help="AutoTestFlow output directory")
    parser.add_argument("--case-id", required=True, help="Case ID")
    parser.add_argument("--result-path", default=None, help="Optional result JSON path")
    parser.add_argument("--write", action="store_true", help="Update the result JSON in place")
    args = parser.parse_args(argv)

    results, summary = evaluate(args.output_dir, args.case_id, args.result_path)
    if args.write:
        write_back(args.output_dir, args.case_id, args.result_path, results, summary)
    print(
        f"{args.case_id}|fault_oracles|{summary.get('classification')}|"
        f"failed={summary.get('counts', {}).get('failed', 0)}|"
        f"unobservable={summary.get('counts', {}).get('unobservable', 0)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
