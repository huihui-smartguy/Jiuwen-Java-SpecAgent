#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Prepare a language/profile-aware plan for AutoTestFlow stage2 code scanning.

The script is intentionally deterministic and lightweight. It does not attempt
to parse every language. It collects source-tree signals, selects the best scan
profile, and writes a small plan consumed by the stage2 LLM agent.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import output_layout as layout


SCHEMA_VERSION = "1.0"
MAX_FILES = 5000
MAX_TEXT_BYTES = 200_000
SKIP_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".idea",
    ".vscode",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    "node_modules",
    "test",
    "tests",
    "target",
    "build",
    "dist",
    ".gradle",
    ".venv",
    "venv",
    ".tox",
}


def load_profiles(profiles_path: Path | None = None) -> dict[str, Any]:
    if profiles_path is None:
        profiles_path = Path(__file__).resolve().parents[1] / "shared" / "code_scan_profiles.json"
    with profiles_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def iter_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            path = Path(dirpath) / name
            files.append(path)
            if len(files) >= MAX_FILES:
                return files
    return files


def rel(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def read_sample(path: Path) -> str:
    try:
        data = path.read_bytes()[:MAX_TEXT_BYTES]
        return data.decode("utf-8", errors="ignore")
    except OSError:
        return ""


def first_match_evidence(path: Path, root: Path, pattern: str, signal: str) -> dict[str, Any] | None:
    text = read_sample(path)
    if not text:
        return None
    regex = re.compile(pattern, re.MULTILINE)
    for idx, line in enumerate(text.splitlines(), 1):
        if regex.search(line):
            snippet = line.strip()
            return {
                "file": rel(path, root),
                "line": idx,
                "signal": signal,
                "snippet": snippet[:180],
            }
    return None


def file_evidence(path: Path, root: Path, signal: str) -> dict[str, Any]:
    return {
        "file": rel(path, root),
        "line": 1,
        "signal": signal,
        "snippet": path.name,
    }


def detect_java_spring(files: list[Path], root: Path, profile: dict[str, Any]) -> dict[str, Any]:
    java_files = [p for p in files if p.suffix == ".java"]
    build_files = [p for p in files if p.name in {"pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle"}]
    signals = [
        ("@RestController|@Controller|@RequestMapping|@(Get|Post|Put|Delete|Patch)Mapping", "spring_endpoint"),
        ("@ControllerAdvice|@RestControllerAdvice|@ExceptionHandler", "spring_exception_mapping"),
        ("@JsonProperty|@JsonFormat|@JsonInclude|JsonFormat|oneof", "java_serialization"),
        ("SseEmitter|ServerSentEvent|TEXT_EVENT_STREAM|text/event-stream|Flux<", "java_streaming"),
        ("@ConfigurationProperties|@Value\\(", "java_configuration"),
    ]
    evidence: list[dict[str, Any]] = []
    frameworks: set[str] = set()
    for p in build_files[:3]:
        evidence.append(file_evidence(p, root, "java_build_file"))
    for pattern, signal in signals:
        for path in java_files:
            ev = first_match_evidence(path, root, pattern, signal)
            if ev:
                evidence.append(ev)
                if signal.startswith("spring_"):
                    frameworks.add("spring")
                break
    score = 0.0
    if java_files:
        score += 0.25
    if build_files:
        score += 0.15
    if any(ev["signal"] == "spring_endpoint" for ev in evidence):
        score += 0.45
    if any(ev["signal"] == "spring_exception_mapping" for ev in evidence):
        score += 0.10
    if any(ev["signal"] == "java_streaming" for ev in evidence):
        score += 0.05
    return make_candidate(profile, score, sorted(frameworks), evidence)


def detect_python_web(files: list[Path], root: Path, profile: dict[str, Any]) -> dict[str, Any]:
    py_files = [p for p in files if p.suffix == ".py"]
    package_files = [
        p for p in files
        if p.name in {"requirements.txt", "pyproject.toml", "Pipfile", "setup.py", "poetry.lock"}
    ]
    signals = [
        ("FastAPI\\(|APIRouter\\(|@\\w+\\.(get|post|put|delete|patch)\\(", "fastapi_route", "fastapi"),
        ("Flask\\(|Blueprint\\(|@\\w+\\.route\\(", "flask_route", "flask"),
        ("urlpatterns\\s*=|django\\.urls|APIView|ViewSet|@api_view", "django_route", "django"),
        ("raise\\s+HTTPException|abort\\(|ValidationError", "python_error_mapping", None),
        ("BaseModel|pydantic|dataclass|marshmallow|Serializer", "python_serialization", None),
        ("StreamingResponse|EventSourceResponse|text/event-stream|yield\\s+", "python_streaming", None),
    ]
    evidence: list[dict[str, Any]] = []
    frameworks: set[str] = set()
    for p in package_files[:3]:
        evidence.append(file_evidence(p, root, "python_package_file"))
    for pattern, signal, framework in signals:
        for path in py_files:
            ev = first_match_evidence(path, root, pattern, signal)
            if ev:
                evidence.append(ev)
                if framework:
                    frameworks.add(framework)
                break
    score = 0.0
    if py_files:
        score += 0.25
    if package_files:
        score += 0.10
    route_signals = {"fastapi_route", "flask_route", "django_route"}
    route_count = len({ev["signal"] for ev in evidence if ev["signal"] in route_signals})
    score += min(0.50, route_count * 0.25)
    if any(ev["signal"] == "python_serialization" for ev in evidence):
        score += 0.10
    if any(ev["signal"] == "python_streaming" for ev in evidence):
        score += 0.05
    return make_candidate(profile, score, sorted(frameworks), evidence)


def detect_cpp_service(files: list[Path], root: Path, profile: dict[str, Any]) -> dict[str, Any]:
    cpp_exts = {".cc", ".cpp", ".cxx", ".h", ".hpp", ".hh", ".proto"}
    cpp_files = [p for p in files if p.suffix in cpp_exts]
    build_files = [p for p in files if p.name in {"CMakeLists.txt", "Makefile", "BUILD", "WORKSPACE"}]
    signals = [
        ("grpc::|ServerBuilder|ServiceImpl|AddListeningPort", "cpp_grpc_service", "grpc"),
        ("\\.proto\\b|service\\s+\\w+\\s*\\{", "cpp_proto_service", "protobuf"),
        ("Boost\\.Beast|cpp-httplib|httplib::|Pistache|Restbed|Crow::|oatpp", "cpp_http_service", "http"),
        ("StatusCode|Status\\(|throw\\s+std::|std::exception|grpc::Status", "cpp_error_mapping", None),
        ("Json::|nlohmann::json|rapidjson|protobuf|SerializeToString", "cpp_serialization", None),
        ("ServerWriter|ServerReader|Write\\(|AsyncService|CompletionQueue", "cpp_streaming", None),
    ]
    evidence: list[dict[str, Any]] = []
    frameworks: set[str] = set()
    for p in build_files[:3]:
        evidence.append(file_evidence(p, root, "cpp_build_file"))
    for pattern, signal, framework in signals:
        for path in cpp_files:
            ev = first_match_evidence(path, root, pattern, signal)
            if ev:
                evidence.append(ev)
                if framework:
                    frameworks.add(framework)
                break
    score = 0.0
    if cpp_files:
        score += 0.25
    if build_files:
        score += 0.15
    if any(ev["signal"] in {"cpp_grpc_service", "cpp_proto_service", "cpp_http_service"} for ev in evidence):
        score += 0.45
    if any(ev["signal"] == "cpp_serialization" for ev in evidence):
        score += 0.10
    if any(ev["signal"] == "cpp_streaming" for ev in evidence):
        score += 0.05
    return make_candidate(profile, score, sorted(frameworks), evidence)


def make_candidate(profile: dict[str, Any], score: float, frameworks: list[str], evidence: list[dict[str, Any]]) -> dict[str, Any]:
    confidence = round(max(0.0, min(score, 0.99)), 2)
    return {
        "profile_id": profile["profile_id"],
        "language": profile["language"],
        "frameworks": frameworks,
        "confidence": confidence,
        "reason": profile["description"],
        "evidence": evidence[:12],
    }


def source_summary(files: list[Path], root: Path) -> dict[str, Any]:
    by_ext: dict[str, int] = {}
    for path in files:
        ext = path.suffix.lower() or "<none>"
        by_ext[ext] = by_ext.get(ext, 0) + 1
    top_exts = sorted(by_ext.items(), key=lambda item: (-item[1], item[0]))[:12]
    sample_files = [rel(p, root) for p in files[:20]]
    return {
        "file_count": len(files),
        "top_extensions": [{"extension": ext, "count": count} for ext, count in top_exts],
        "sample_files": sample_files,
    }


def generic_candidate(files: list[Path], root: Path, profile: dict[str, Any]) -> dict[str, Any]:
    evidence = [file_evidence(p, root, "source_file") for p in files[:8]]
    score = 0.35 if files else 0.1
    candidate = make_candidate(profile, score, [], evidence)
    candidate["reason"] = "No first-class adapter reached confidence threshold; use generic source-tree scan."
    return candidate


def build_plan(code_path: str | Path, output_dir: str | Path, profiles_path: str | Path | None = None) -> dict[str, Any]:
    root = Path(code_path).resolve()
    out = Path(output_dir).resolve()
    if not root.exists() or not root.is_dir():
        raise SystemExit(f"code_path is not a directory: {root}")

    profiles_doc = load_profiles(Path(profiles_path).resolve() if profiles_path else None)
    profiles = {p["profile_id"]: p for p in profiles_doc["profiles"]}
    files = iter_files(root)

    candidates = [
        detect_java_spring(files, root, profiles["java.spring"]),
        detect_python_web(files, root, profiles["python.web_api"]),
        detect_cpp_service(files, root, profiles["cpp.service_rpc"]),
    ]
    candidates.sort(key=lambda item: (-item["confidence"], item["profile_id"]))
    generic = generic_candidate(files, root, profiles["generic.source_tree"])
    primary = candidates[0] if candidates and candidates[0]["confidence"] >= 0.55 else generic
    if primary["profile_id"] != generic["profile_id"]:
        detected_profiles = [primary] + [c for c in candidates if c["profile_id"] != primary["profile_id"] and c["confidence"] > 0]
        detected_profiles.append(generic)
    else:
        detected_profiles = [generic] + [c for c in candidates if c["confidence"] > 0]

    primary_profile_doc = profiles[primary["profile_id"]]
    plan = {
        "meta": {
            "schema_version": SCHEMA_VERSION,
            "generated_by": "prepare_code_scan.py",
            "code_path": str(root),
            "output_dir": str(out),
            "profile_catalog": "AutoTestFlow/shared/code_scan_profiles.json",
        },
        "primary_profile": primary["profile_id"],
        "language": primary["language"],
        "frameworks": primary.get("frameworks", []),
        "confidence": primary["confidence"],
        "detected_profiles": detected_profiles,
        "source_summary": source_summary(files, root),
        "scan_hints": {
            "profile_id": primary_profile_doc["profile_id"],
            "entrypoint_kinds": primary_profile_doc.get("entrypoint_kinds", []),
            "default_transports": primary_profile_doc.get("default_transports", []),
            "probe_categories": primary_profile_doc["probe_categories"],
            "read_budget": profiles_doc.get("read_budget", {}),
            "fallback_policy": profiles_doc.get("fallback_policy", {}),
        },
    }
    return plan


def write_plan(plan: dict[str, Any], output_dir: str | Path) -> Path:
    path = Path(layout.target_artifact(str(Path(output_dir).resolve()), "code_scan_plan", create_parent=True))
    with path.open("w", encoding="utf-8") as f:
        json.dump(plan, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare AutoTestFlow stage2 code scan profile plan.")
    parser.add_argument("--code-path", required=True, help="SUT source directory to inspect.")
    parser.add_argument("--output-dir", required=True, help="AutoTestFlow output directory.")
    parser.add_argument("--profiles", help="Optional path to code_scan_profiles.json.")
    parser.add_argument("--print", action="store_true", help="Print the generated plan after writing it.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    plan = build_plan(args.code_path, args.output_dir, args.profiles)
    path = write_plan(plan, args.output_dir)
    print(f"[prepare_code_scan] wrote {path}")
    print(
        "[prepare_code_scan] primary_profile=%s language=%s confidence=%.2f"
        % (plan["primary_profile"], plan["language"], plan["confidence"])
    )
    if args.print:
        print(json.dumps(plan, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
