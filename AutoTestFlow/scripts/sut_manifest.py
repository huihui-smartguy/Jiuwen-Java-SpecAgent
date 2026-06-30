#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SUT manifest parsing and normalization for AutoTestFlow.

The public manifest format is Markdown with YAML front matter. To keep the
skill self-contained in environments without PyYAML, this module implements a
small YAML subset parser covering mappings, lists, inline lists/maps, booleans,
numbers, nulls, and quoted strings. It intentionally rejects ambiguous shapes
instead of silently guessing.
"""

import argparse
import json
import os
import re
import sys
from copy import deepcopy


SCHEMA_VERSION = "autotestflow.sut-manifest.v1"
DEFAULT_OUTPUT_DIR = "analysis_output"
TARGET_ID_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


class ManifestError(ValueError):
    """Raised when the manifest is missing, malformed, or unsafe."""


def _strip_comment(line):
    in_single = False
    in_double = False
    escaped = False
    for idx, ch in enumerate(line):
        if escaped:
            escaped = False
            continue
        if ch == "\\" and in_double:
            escaped = True
            continue
        if ch == "'" and not in_double:
            in_single = not in_single
            continue
        if ch == '"' and not in_single:
            in_double = not in_double
            continue
        if ch == "#" and not in_single and not in_double:
            before = line[idx - 1] if idx > 0 else " "
            if before.isspace():
                return line[:idx].rstrip()
    return line.rstrip()


def _split_top_level(text, sep=","):
    out = []
    buf = []
    depth = 0
    in_single = False
    in_double = False
    escaped = False
    for ch in text:
        if escaped:
            buf.append(ch)
            escaped = False
            continue
        if ch == "\\" and in_double:
            buf.append(ch)
            escaped = True
            continue
        if ch == "'" and not in_double:
            in_single = not in_single
            buf.append(ch)
            continue
        if ch == '"' and not in_single:
            in_double = not in_double
            buf.append(ch)
            continue
        if not in_single and not in_double:
            if ch in "[{(":
                depth += 1
            elif ch in "]})":
                depth -= 1
            elif ch == sep and depth == 0:
                out.append("".join(buf).strip())
                buf = []
                continue
        buf.append(ch)
    if buf or text.endswith(sep):
        out.append("".join(buf).strip())
    return out


def _split_key_value(text, line_no):
    in_single = False
    in_double = False
    escaped = False
    for idx, ch in enumerate(text):
        if escaped:
            escaped = False
            continue
        if ch == "\\" and in_double:
            escaped = True
            continue
        if ch == "'" and not in_double:
            in_single = not in_single
            continue
        if ch == '"' and not in_single:
            in_double = not in_double
            continue
        if ch == ":" and not in_single and not in_double:
            key = text[:idx].strip()
            value = text[idx + 1:].strip()
            if not key:
                raise ManifestError("YAML line %s has an empty key" % line_no)
            return key, value
    raise ManifestError("YAML line %s is not a key/value pair: %s" % (line_no, text))


def _parse_scalar(text):
    text = text.strip()
    if text == "":
        return ""
    if text in ("null", "Null", "NULL", "~"):
        return None
    if text in ("true", "True", "TRUE"):
        return True
    if text in ("false", "False", "FALSE"):
        return False
    if (text.startswith('"') and text.endswith('"')) or (
        text.startswith("'") and text.endswith("'")
    ):
        return text[1:-1]
    if text.startswith("[") and text.endswith("]"):
        inner = text[1:-1].strip()
        if not inner:
            return []
        return [_parse_scalar(part) for part in _split_top_level(inner)]
    if text.startswith("{") and text.endswith("}"):
        inner = text[1:-1].strip()
        if not inner:
            return {}
        out = {}
        for part in _split_top_level(inner):
            key, value = _split_key_value(part, "?")
            out[key.strip().strip('"').strip("'")] = _parse_scalar(value)
        return out
    if re.match(r"^-?\d+$", text):
        try:
            return int(text)
        except ValueError:
            pass
    if re.match(r"^-?\d+\.\d+$", text):
        try:
            return float(text)
        except ValueError:
            pass
    return text


def _yaml_items(yaml_text):
    items = []
    for line_no, raw in enumerate(yaml_text.splitlines(), 1):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if "\t" in raw[: len(raw) - len(raw.lstrip())]:
            raise ManifestError("YAML line %s uses tabs for indentation" % line_no)
        stripped = _strip_comment(raw)
        if not stripped.strip():
            continue
        indent = len(stripped) - len(stripped.lstrip(" "))
        items.append((indent, stripped.strip(), line_no))
    return items


class _YamlParser:
    def __init__(self, yaml_text):
        self.items = _yaml_items(yaml_text)

    def parse(self):
        if not self.items:
            return {}
        value, idx = self._parse_node(0, self.items[0][0])
        if idx != len(self.items):
            raise ManifestError("Unexpected trailing YAML content at line %s" % self.items[idx][2])
        return value

    def _parse_node(self, idx, indent):
        if idx >= len(self.items):
            return {}, idx
        cur_indent, text, _ = self.items[idx]
        if cur_indent < indent:
            return {}, idx
        if cur_indent != indent:
            raise ManifestError("Unexpected indentation at line %s" % self.items[idx][2])
        if text.startswith("- "):
            return self._parse_list(idx, indent)
        return self._parse_map(idx, indent)

    def _parse_map(self, idx, indent):
        out = {}
        while idx < len(self.items):
            cur_indent, text, line_no = self.items[idx]
            if cur_indent < indent:
                break
            if cur_indent > indent:
                raise ManifestError("Unexpected nested content at line %s" % line_no)
            if text.startswith("- "):
                break
            key, rest = _split_key_value(text, line_no)
            idx += 1
            if rest:
                out[key] = _parse_scalar(rest)
                continue
            if idx < len(self.items) and self.items[idx][0] > cur_indent:
                out[key], idx = self._parse_node(idx, self.items[idx][0])
            else:
                out[key] = {}
        return out, idx

    def _parse_list(self, idx, indent):
        out = []
        while idx < len(self.items):
            cur_indent, text, line_no = self.items[idx]
            if cur_indent < indent:
                break
            if cur_indent != indent or not text.startswith("- "):
                break
            item_text = text[2:].strip()
            idx += 1
            if not item_text:
                if idx < len(self.items) and self.items[idx][0] > cur_indent:
                    value, idx = self._parse_node(idx, self.items[idx][0])
                else:
                    value = None
                out.append(value)
                continue
            if ":" in item_text and not item_text.startswith(("[", "{", '"', "'")):
                item = {}
                key, rest = _split_key_value(item_text, line_no)
                if rest:
                    item[key] = _parse_scalar(rest)
                elif idx < len(self.items) and self.items[idx][0] > cur_indent:
                    item[key], idx = self._parse_node(idx, self.items[idx][0])
                else:
                    item[key] = {}
                if idx < len(self.items) and self.items[idx][0] > cur_indent:
                    extra, idx = self._parse_node(idx, self.items[idx][0])
                    if not isinstance(extra, dict):
                        raise ManifestError("List item at line %s mixes mapping and sequence" % line_no)
                    item.update(extra)
                out.append(item)
            else:
                out.append(_parse_scalar(item_text))
        return out, idx


def parse_yaml_subset(yaml_text):
    """Parse the small YAML subset used by SUT manifests."""
    return _YamlParser(yaml_text).parse()


def extract_front_matter(text):
    lines = text.splitlines()
    first = 0
    while first < len(lines) and not lines[first].strip():
        first += 1
    if first >= len(lines) or lines[first].strip() != "---":
        raise ManifestError("SUT manifest must start with YAML front matter delimited by ---")
    for idx in range(first + 1, len(lines)):
        if lines[idx].strip() == "---":
            return "\n".join(lines[first + 1:idx]), "\n".join(lines[idx + 1:])
    raise ManifestError("SUT manifest front matter is missing its closing ---")


def load_manifest(path):
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    yaml_text, body = extract_front_matter(text)
    data = parse_yaml_subset(yaml_text)
    if not isinstance(data, dict):
        raise ManifestError("SUT manifest front matter must be a mapping")
    data["_markdown_body"] = body
    data["_manifest_path"] = os.path.abspath(path)
    return data


def _require_mapping(parent, key, context):
    value = parent.get(key)
    if not isinstance(value, dict):
        raise ManifestError("%s.%s must be a mapping" % (context, key))
    return value


def _require_string(parent, key, context):
    value = parent.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ManifestError("%s.%s is required" % (context, key))
    return value.strip()


def _normalize_path(path, base_dir):
    if not path:
        return path
    expanded = os.path.expanduser(str(path))
    if os.path.isabs(expanded):
        return os.path.normpath(expanded)
    return os.path.normpath(os.path.abspath(os.path.join(base_dir, expanded)))


def _target_paths(root_output_dir, target_id):
    target_output_dir = os.path.join(root_output_dir, "targets", target_id)
    return {
        "target_output_dir": target_output_dir,
        "state_dir": os.path.join(target_output_dir, ".state"),
        "trace_dir": os.path.join(target_output_dir, ".state", "trace"),
        "contract_path": os.path.join(target_output_dir, "contract.md"),
        "contract_samples_path": os.path.join(target_output_dir, ".state", "contract_samples.json"),
        "ready_path": os.path.join(target_output_dir, ".state", "sut_ready.json"),
        "case_results_path": os.path.join(target_output_dir, "case_results.json"),
        "report_path": os.path.join(target_output_dir, "report.md"),
    }


def validate_and_normalize(data, manifest_path=None, output_dir=None):
    manifest_path = manifest_path or data.get("_manifest_path") or os.getcwd()
    manifest_dir = os.path.dirname(os.path.abspath(manifest_path))
    schema = data.get("schema_version")
    if schema != SCHEMA_VERSION:
        raise ManifestError("schema_version must be %s" % SCHEMA_VERSION)

    suite = _require_mapping(data, "suite", "manifest")
    suite_id = _require_string(suite, "id", "suite")
    suite_defaults = suite.get("defaults") if isinstance(suite.get("defaults"), dict) else {}
    root_output_dir = output_dir or suite.get("output_dir") or DEFAULT_OUTPUT_DIR
    root_output_dir = _normalize_path(root_output_dir, os.getcwd())

    targets = data.get("targets")
    if not isinstance(targets, list) or not targets:
        raise ManifestError("manifest.targets must be a non-empty list")

    seen = set()
    normalized_targets = []
    target_ids = []
    for idx, target in enumerate(targets):
        context = "targets[%s]" % idx
        if not isinstance(target, dict):
            raise ManifestError("%s must be a mapping" % context)
        target_id = _require_string(target, "id", context)
        if not TARGET_ID_RE.match(target_id):
            raise ManifestError("%s.id contains unsafe characters" % context)
        if target_id in seen:
            raise ManifestError("Duplicate target id: %s" % target_id)
        seen.add(target_id)
        target_ids.append(target_id)

        source = _require_mapping(target, "source", context)
        source_path = _require_string(source, "path", "%s.source" % context)
        runtime = _require_mapping(target, "runtime", context)
        mode = _require_string(runtime, "mode", "%s.runtime" % context)
        if mode not in ("predeployed", "managed"):
            raise ManifestError("%s.runtime.mode must be predeployed or managed" % context)
        base_url = _require_string(runtime, "base_url", "%s.runtime" % context).rstrip("/")
        readiness_probe = _require_mapping(runtime, "readiness_probe", "%s.runtime" % context)
        _require_string(readiness_probe, "method", "%s.runtime.readiness_probe" % context)
        _require_string(readiness_probe, "path", "%s.runtime.readiness_probe" % context)

        item = deepcopy(target)
        item.setdefault("name", target_id)
        item.setdefault("role", "primary")
        item.setdefault("depends_on", [])
        if item["depends_on"] is None:
            item["depends_on"] = []
        if not isinstance(item["depends_on"], list):
            raise ManifestError("%s.depends_on must be a list" % context)
        item["source"]["abs_path"] = _normalize_path(source_path, manifest_dir)
        item["runtime"]["base_url"] = base_url
        item["runtime"].setdefault("commands", {})
        if item["runtime"]["commands"] is None:
            item["runtime"]["commands"] = {}
        if not isinstance(item["runtime"]["commands"], dict):
            raise ManifestError("%s.runtime.commands must be a mapping" % context)
        if "knowledge_domain" not in item and suite_defaults.get("knowledge_domain"):
            item["knowledge_domain"] = suite_defaults["knowledge_domain"]
        item.update(_target_paths(root_output_dir, target_id))
        normalized_targets.append(item)

    target_set = set(target_ids)
    for target in normalized_targets:
        for dep in target.get("depends_on", []):
            if dep == target["id"]:
                raise ManifestError("Target %s cannot depend on itself" % target["id"])
            if dep not in target_set:
                raise ManifestError("Target %s depends on unknown target %s" % (target["id"], dep))

    return {
        "schema_version": SCHEMA_VERSION,
        "suite": {
            "id": suite_id,
            "output_dir": root_output_dir,
            "defaults": suite_defaults,
        },
        "manifest_path": os.path.abspath(manifest_path),
        "targets": normalized_targets,
        "artifacts": {
            "normalized_manifest": os.path.join(root_output_dir, ".state", "sut_manifest.normalized.json"),
            "aggregate_report": os.path.join(root_output_dir, "report.md"),
        },
    }


def build_legacy_manifest(requirement_doc=None, code_path=None, sut_base_url=None, output_dir=None):
    if not sut_base_url:
        raise ManifestError("legacy sut_base_url is required")
    code_path = code_path or "."
    return {
        "schema_version": SCHEMA_VERSION,
        "suite": {
            "id": "legacy-single-sut",
            "output_dir": output_dir or DEFAULT_OUTPUT_DIR,
            "defaults": {},
        },
        "targets": [
            {
                "id": "default",
                "name": "default",
                "role": "primary",
                "source": {"path": code_path},
                "runtime": {
                    "mode": "predeployed",
                    "base_url": sut_base_url,
                    "readiness_probe": {
                        "method": "GET",
                        "path": "/",
                        "expect_status_lt": 500,
                    },
                    "commands": {},
                },
                "probes": [],
                "depends_on": [],
            }
        ],
        "compatibility": {
            "from_sut_base_url": True,
            "requirement_doc": requirement_doc,
            "deprecation_note": "--sut-base-url is deprecated; use --sut-manifest for new runs.",
        },
    }


def normalize_legacy(requirement_doc=None, code_path=None, sut_base_url=None, output_dir=None):
    data = build_legacy_manifest(requirement_doc, code_path, sut_base_url, output_dir)
    normalized = validate_and_normalize(data, manifest_path=os.path.join(os.getcwd(), "<legacy>"), output_dir=output_dir)
    normalized["compatibility"] = data["compatibility"]
    return normalized


def write_normalized(normalized, output_path=None):
    output_path = output_path or normalized["artifacts"]["normalized_manifest"]
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(normalized, fh, ensure_ascii=False, indent=2)
    return output_path


def load_normalized(path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Parse and normalize an AutoTestFlow SUT manifest")
    parser.add_argument("--sut-manifest", help="Markdown file with YAML front matter")
    parser.add_argument("--legacy-sut-base-url", help="Deprecated single-SUT base URL")
    parser.add_argument("--requirement-doc")
    parser.add_argument("--code-path")
    parser.add_argument("--output-dir")
    parser.add_argument("--write", action="store_true", help="Write .state/sut_manifest.normalized.json")
    args = parser.parse_args(argv)

    try:
        if args.sut_manifest:
            data = load_manifest(args.sut_manifest)
            normalized = validate_and_normalize(data, args.sut_manifest, args.output_dir)
        elif args.legacy_sut_base_url:
            normalized = normalize_legacy(
                requirement_doc=args.requirement_doc,
                code_path=args.code_path,
                sut_base_url=args.legacy_sut_base_url,
                output_dir=args.output_dir,
            )
            print("[sut_manifest] WARNING: --sut-base-url is deprecated; use --sut-manifest.", file=sys.stderr)
        else:
            raise ManifestError("Provide --sut-manifest or --legacy-sut-base-url")
        if args.write:
            path = write_normalized(normalized)
            print(path)
        else:
            print(json.dumps(normalized, ensure_ascii=False, indent=2))
        return 0
    except ManifestError as exc:
        print("[sut_manifest] ERROR: %s" % exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
