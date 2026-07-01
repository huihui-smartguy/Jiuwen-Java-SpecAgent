#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SUT manifest parsing and normalization for AutoTestFlow.

The public SUT description can be either:

* a natural-language Markdown document, preferred for user authoring; or
* the legacy Markdown file with YAML front matter.

To keep the skill self-contained in environments without PyYAML, this module
implements a small YAML subset parser covering mappings, lists, inline
lists/maps, booleans, numbers, nulls, and quoted strings. Natural-language
documents are converted into the same canonical manifest shape and then pass
through the deterministic validator below.
"""

import argparse
import json
import os
import re
import sys
from copy import deepcopy
from urllib.parse import urlparse


SCHEMA_VERSION = "autotestflow.sut-manifest.v1"
DESCRIPTION_PARSE_VERSION = "autotestflow.sut-description.parse.v1"
DEFAULT_OUTPUT_DIR = "analysis_output"
TARGET_ID_RE = re.compile(r"^[A-Za-z0-9_.-]+$")
REDACTED_VALUE = "***REDACTED***"
SECRET_NAME_RE = re.compile(
    r"(TOKEN|SECRET|PASSWORD|PASSWD|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|CREDENTIAL|AUTH)",
    re.IGNORECASE,
)
URL_RE = re.compile(r"https?://[^\s,;)\]>]+")
IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
PORT_RE = re.compile(r"\bport\s*[:=]\s*(\d{2,5})\b", re.IGNORECASE)
KEY_VALUE_RE = re.compile(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^\s,;]+)")


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


def has_front_matter(text):
    lines = text.splitlines()
    first = 0
    while first < len(lines) and not lines[first].strip():
        first += 1
    return first < len(lines) and lines[first].strip() == "---"


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


def _slugify(text, fallback):
    raw = str(text or "").strip().lower()
    raw = re.sub(r"[^a-z0-9_.-]+", "-", raw)
    raw = re.sub(r"-+", "-", raw).strip("-.")
    if not raw:
        raw = fallback
    return raw[:80]


def _strip_inline_value(value):
    value = str(value or "").strip().strip("`\"'")
    return value.rstrip(".,;")


def _value_after_marker(line, markers):
    for marker in markers:
        match = re.search(r"\b%s\b\s*[:=]\s*(.+)$" % re.escape(marker), line, re.IGNORECASE)
        if match:
            return _strip_inline_value(match.group(1))
    return None


def _split_csv_words(text):
    text = text.replace(" and ", ",").replace("、", ",").replace("，", ",")
    return [_strip_inline_value(part) for part in text.split(",") if _strip_inline_value(part)]


def _redact_env_value(name, value):
    if value is None:
        return None, False
    if SECRET_NAME_RE.search(name or ""):
        return REDACTED_VALUE, True
    return _strip_inline_value(value), False


def _parse_environment(line, env):
    lower = line.lower()
    env_file = _value_after_marker(line, ["env file", "environment file", ".env file", "env"])
    if env_file and (".env" in env_file or "/" in env_file):
        env.setdefault("files", [])
        if env_file not in env["files"]:
            env["files"].append(env_file)

    pairs = KEY_VALUE_RE.findall(line)
    if pairs:
        env.setdefault("variables", [])
        existing = {item.get("name") for item in env["variables"]}
        for name, value in pairs:
            redacted_value, redacted = _redact_env_value(name, value)
            if name not in existing:
                env["variables"].append({"name": name, "value": redacted_value, "redacted": redacted})
                existing.add(name)

    if "environment variable" in lower or "env var" in lower or "环境变量" in line:
        value = _value_after_marker(line, ["Environment variables", "Environment variable", "Env vars", "Env var"])
        if not value and ":" in line:
            value = line.split(":", 1)[1]
        if value:
            env.setdefault("variables", [])
            existing = {item.get("name") for item in env["variables"]}
            for name in _split_csv_words(value):
                if "=" in name:
                    key, raw_value = name.split("=", 1)
                    redacted_value, redacted = _redact_env_value(key, raw_value)
                    item = {"name": key.strip(), "value": redacted_value, "redacted": redacted}
                else:
                    item = {"name": name.strip(), "value": None, "redacted": False}
                if item["name"] and item["name"] not in existing:
                    env["variables"].append(item)
                    existing.add(item["name"])


def _split_description_sections(text):
    sections = []
    current = None
    title_seen = False
    for raw in text.splitlines():
        line = raw.rstrip()
        stripped = line.strip()
        bracket = re.match(r"^\[([^\]]+)\]\s*$", stripped)
        heading = re.match(r"^#{1,4}\s+(.+?)\s*$", stripped)
        heading_name = None
        if bracket:
            heading_name = bracket.group(1)
        elif heading:
            candidate = heading.group(1).strip()
            lower = candidate.lower()
            if not title_seen and any(word in lower for word in ("description", "overview", "sut")):
                title_seen = True
            else:
                heading_name = candidate
        if heading_name:
            current = {"name": heading_name.strip(), "lines": []}
            sections.append(current)
            continue
        if current is None:
            current = {"name": "default", "lines": []}
            sections.append(current)
        current["lines"].append(line)

    meaningful = []
    for section in sections:
        if section["name"] != "default" or any(line.strip() for line in section["lines"]):
            meaningful.append(section)
    return meaningful or [{"name": "default", "lines": text.splitlines()}]


def _section_has_target_signal(section):
    text = "\n".join(section.get("lines", []))
    return bool(
        URL_RE.search(text)
        or IP_RE.search(text)
        or PORT_RE.search(text)
        or re.search(r"\b(accessible directly|direct access|requires?|source path|code path|environment variable)\b", text, re.IGNORECASE)
        or re.search(r"直接访问|需要|环境变量|源码|代码", text)
    )


def _base_url_from_parts(url, host, port):
    if url:
        parsed = urlparse(url)
        if parsed.scheme and parsed.netloc:
            return "%s://%s" % (parsed.scheme, parsed.netloc)
        return url.rstrip("/")
    if host and port:
        return "http://%s:%s" % (host, port)
    return None


def _probe_path_from_text(text, base_url=None):
    if base_url:
        parsed = urlparse(base_url)
        if parsed.path and parsed.path != "/":
            return parsed.path
    for pattern in (r"(/[\w./-]*(?:health|ready|actuator/health|docs|agent-card\.json)[\w./-]*)", r"\b(/[\w./-]+)\b"):
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
    if re.search(r"\bhealth\b|探活|就绪|ready", text, re.IGNORECASE):
        return "/health"
    return "/"


def _line_value(line, markers):
    value = _value_after_marker(line, markers)
    if value:
        return value
    lower = line.lower()
    for marker in markers:
        marker_l = marker.lower()
        if lower.startswith(marker_l):
            return _strip_inline_value(line[len(marker):].lstrip(":=- "))
    return None


def _parse_section(section, idx):
    name = section["name"].strip() or "target-%s" % idx
    text = "\n".join(section["lines"])
    target_id = _slugify(name, "target-%s" % idx)
    lines = [line.strip(" -\t") for line in section["lines"] if line.strip()]

    url = None
    host = None
    port = None
    source_path = None
    role = None
    knowledge_domain = None
    remediation_config = None
    commands = {}
    env = {}
    dependency_names = []
    mode_hint = None
    reasons = []
    risky = []

    for line in lines:
        lower = line.lower()
        if not url:
            match = URL_RE.search(line)
            if match:
                url = _strip_inline_value(match.group(0))
        if not host:
            host = _line_value(line, ["ip", "host", "hostname", "address"])
            if not host:
                ip_match = IP_RE.search(line)
                if ip_match:
                    host = ip_match.group(0)
        if not port:
            port_value = _line_value(line, ["port"])
            if port_value:
                port_match = re.search(r"\d{2,5}", port_value)
                if port_match:
                    port = port_match.group(0)
            elif PORT_RE.search(line):
                port = PORT_RE.search(line).group(1)

        source_value = _line_value(line, ["source path", "code path", "source", "code", "project path", "repo path"])
        if source_value and not source_path:
            source_path = source_value
        role_value = _line_value(line, ["role"])
        if role_value and not role:
            role = _slugify(role_value, role_value)
        domain_value = _line_value(line, ["knowledge domain", "domain"])
        if domain_value and not knowledge_domain:
            knowledge_domain = _slugify(domain_value, domain_value)
        remediation_value = _line_value(line, ["remediation config", "remediation.config", "repair config"])
        if remediation_value and not remediation_config:
            remediation_config = remediation_value

        for command_name in ("build", "start", "stop"):
            command_value = _line_value(line, [command_name, "%s command" % command_name])
            if command_value:
                commands[command_name] = command_value

        _parse_environment(line, env)

        if re.search(r"\baccessible directly\b|\bdirect access\b|\balready (running|available|deployed)\b|直接访问|已部署|已启动", line, re.IGNORECASE):
            mode_hint = mode_hint or "predeployed"
        if re.search(r"\brequires? (creation|build|start|launch)\b|\bmanaged\b|需要(创建|构建|启动)|需(创建|构建|启动)", line, re.IGNORECASE):
            mode_hint = "managed"
        dep_match = re.search(r"\bdepends on\b\s+(.+)$", line, re.IGNORECASE)
        if dep_match:
            dependency_names.extend(_split_csv_words(dep_match.group(1)))
        conjunction_match = re.search(r"\b(?:with|in conjunction with)\b\s+(.+)$", line, re.IGNORECASE)
        if "requires" in lower and conjunction_match:
            dependency_names.extend(_split_csv_words(conjunction_match.group(1)))

    base_url = _base_url_from_parts(url, host, port)
    mode = mode_hint or ("managed" if commands or source_path else "predeployed")
    readiness_path = _probe_path_from_text(text, url)
    source = {"path": source_path, "available": True} if source_path else {"available": False}
    runtime = {
        "mode": mode,
        "base_url": base_url or "",
        "readiness_probe": {
            "method": "GET",
            "path": readiness_path,
            "expect_status_lt": 500,
        },
        "commands": commands,
    }

    if not base_url:
        reasons.append("missing_base_url")
    if mode == "managed":
        risky.append("managed_runtime_requires_confirmation")
        if not source_path:
            reasons.append("managed_target_missing_source_path")
        if commands:
            risky.append("inferred_build_or_start_commands")
    if not source_path and mode == "predeployed":
        reasons.append("source_unavailable_code_scan_skipped")

    target = {
        "id": target_id,
        "name": name,
        "role": role or "primary",
        "depends_on": [],
        "source": source,
        "runtime": runtime,
        "probes": [{"name": "readiness", "method": "GET", "path": readiness_path}],
    }
    if dependency_names:
        target["_dependency_names"] = dependency_names
    if knowledge_domain:
        target["knowledge_domain"] = knowledge_domain
    if env:
        target["environment"] = env
    if remediation_config:
        target["remediation"] = {"config_path": remediation_config}

    return {
        "target": target,
        "review_reasons": reasons,
        "risky_inferences": risky,
        "confidence": max(0.2, 0.95 - (0.18 * len(reasons)) - (0.12 * len(risky))),
    }


def parse_natural_language_description(text, manifest_path=None, output_dir=None):
    sections = _split_description_sections(text)
    if len(sections) > 1:
        sections = [section for section in sections if _section_has_target_signal(section)]
    sections = sections or [{"name": "default", "lines": text.splitlines()}]
    parsed_targets = [_parse_section(section, idx + 1) for idx, section in enumerate(sections)]
    target_ids = {item["target"]["id"] for item in parsed_targets}
    review_reasons = []
    risky_inferences = []
    confidence_values = []

    for item in parsed_targets:
        target = item["target"]
        depends_on = []
        unknown = []
        for dep_name in target.pop("_dependency_names", []):
            dep_id = _slugify(dep_name, dep_name)
            if dep_id in target_ids and dep_id != target["id"]:
                depends_on.append(dep_id)
            else:
                unknown.append(dep_name)
        target["depends_on"] = depends_on
        if unknown:
            item["review_reasons"].append("unknown_dependency:%s" % ",".join(unknown))
        review_reasons.extend(item["review_reasons"])
        risky_inferences.extend(item["risky_inferences"])
        confidence_values.append(item["confidence"])

    manifest_base = os.path.splitext(os.path.basename(manifest_path or "autotestflow.suts.md"))[0]
    suite_id = _slugify(manifest_base, "natural-language-sut")
    candidate = {
        "schema_version": SCHEMA_VERSION,
        "suite": {
            "id": suite_id,
            "output_dir": output_dir or DEFAULT_OUTPUT_DIR,
            "defaults": {},
        },
        "targets": [item["target"] for item in parsed_targets],
        "_input_format": "natural_language",
    }
    confidence = round(min(confidence_values or [0.2]), 2)
    review_required = bool(risky_inferences or [r for r in review_reasons if r != "source_unavailable_code_scan_skipped"])
    parse_doc = {
        "schema_version": DESCRIPTION_PARSE_VERSION,
        "generated_by": "sut_manifest.py",
        "source": os.path.abspath(manifest_path) if manifest_path else None,
        "input_format": "natural_language",
        "review": {
            "required": review_required,
            "confidence": confidence,
            "reasons": sorted(set(review_reasons)),
            "risky_inferences": sorted(set(risky_inferences)),
        },
        "candidate_manifest": candidate,
    }
    return candidate, parse_doc


def load_manifest(path):
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    if has_front_matter(text):
        yaml_text, body = extract_front_matter(text)
        data = parse_yaml_subset(yaml_text)
        if not isinstance(data, dict):
            raise ManifestError("SUT manifest front matter must be a mapping")
        data["_markdown_body"] = body
        data["_input_format"] = "yaml_front_matter"
    else:
        data, parse_doc = parse_natural_language_description(text, manifest_path=path)
        data["_markdown_body"] = text
        data["_sut_description_parse"] = parse_doc
    data["_manifest_path"] = os.path.abspath(path)
    return data


def load_candidate_manifest(path):
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if isinstance(data, dict) and isinstance(data.get("candidate_manifest"), dict):
        data = data["candidate_manifest"]
    if not isinstance(data, dict):
        raise ManifestError("candidate manifest must be a JSON object")
    data["_input_format"] = data.get("_input_format") or "candidate_manifest"
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


def _description_artifact_paths(root_output_dir):
    state_dir = os.path.join(root_output_dir, ".state")
    return {
        "sut_description_parse": os.path.join(state_dir, "sut_description.parse.json"),
        "sut_description_review": os.path.join(state_dir, "sut_description.review.md"),
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

        runtime = _require_mapping(target, "runtime", context)
        mode = _require_string(runtime, "mode", "%s.runtime" % context)
        if mode not in ("predeployed", "managed"):
            raise ManifestError("%s.runtime.mode must be predeployed or managed" % context)
        base_url = _require_string(runtime, "base_url", "%s.runtime" % context).rstrip("/")
        readiness_probe = _require_mapping(runtime, "readiness_probe", "%s.runtime" % context)
        _require_string(readiness_probe, "method", "%s.runtime.readiness_probe" % context)
        _require_string(readiness_probe, "path", "%s.runtime.readiness_probe" % context)

        source = target.get("source") if isinstance(target.get("source"), dict) else {}
        source_path = source.get("path")
        source_available = source.get("available")
        if source_available is None:
            source_available = bool(source_path)
        if source_path:
            source_path = str(source_path).strip()
        if not source_path and not (mode == "predeployed" and source_available is False):
            raise ManifestError(
                "%s.source.path is required for managed targets; direct predeployed targets may set source.available=false"
                % context
            )

        item = deepcopy(target)
        item.setdefault("name", target_id)
        item.setdefault("role", "primary")
        item.setdefault("depends_on", [])
        if item["depends_on"] is None:
            item["depends_on"] = []
        if not isinstance(item["depends_on"], list):
            raise ManifestError("%s.depends_on must be a list" % context)
        item.setdefault("source", {})
        item["source"]["available"] = bool(source_available)
        if source_path:
            item["source"]["path"] = source_path
            item["source"]["abs_path"] = _normalize_path(source_path, manifest_dir)
            item["source"].setdefault("skip_code_scan", False)
        else:
            item["source"]["path"] = None
            item["source"]["abs_path"] = None
            item["source"]["skip_code_scan"] = True
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

    normalized = {
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
            **_description_artifact_paths(root_output_dir),
        },
    }
    if data.get("_input_format"):
        normalized["input_format"] = data["_input_format"]
    if isinstance(data.get("_sut_description_parse"), dict):
        parse_doc = deepcopy(data["_sut_description_parse"])
        parse_doc["candidate_manifest"] = {
            "schema_version": SCHEMA_VERSION,
            "suite": normalized["suite"],
            "targets": normalized_targets,
        }
        normalized["sut_description_parse"] = {
            "review_required": bool(parse_doc.get("review", {}).get("required")),
            "confidence": parse_doc.get("review", {}).get("confidence"),
            "reasons": parse_doc.get("review", {}).get("reasons", []),
            "risky_inferences": parse_doc.get("review", {}).get("risky_inferences", []),
        }
        normalized["_sut_description_parse"] = parse_doc
    return normalized


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
    payload = deepcopy(normalized)
    payload.pop("_sut_description_parse", None)
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    return output_path


def write_sut_description_artifacts(normalized):
    parse_doc = normalized.get("_sut_description_parse")
    if not parse_doc:
        return []
    parse_path = normalized["artifacts"]["sut_description_parse"]
    review_path = normalized["artifacts"]["sut_description_review"]
    os.makedirs(os.path.dirname(os.path.abspath(parse_path)), exist_ok=True)
    with open(parse_path, "w", encoding="utf-8") as fh:
        json.dump(parse_doc, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    review = parse_doc.get("review", {})
    lines = [
        "# SUT Description Parse Review",
        "",
        "| Field | Value |",
        "|---|---|",
        "| Review required | %s |" % ("yes" if review.get("required") else "no"),
        "| Confidence | %s |" % review.get("confidence"),
        "| Reasons | %s |" % (", ".join(review.get("reasons", [])) or "none"),
        "| Risky inferences | %s |" % (", ".join(review.get("risky_inferences", [])) or "none"),
        "",
        "## Targets",
        "",
    ]
    for target in parse_doc.get("candidate_manifest", {}).get("targets", []):
        runtime = target.get("runtime", {})
        source = target.get("source", {})
        env = target.get("environment", {})
        variables = ", ".join(
            "%s=%s" % (item.get("name"), item.get("value") or "<provided at runtime>")
            for item in env.get("variables", [])
        )
        lines.extend([
            "### %s" % target.get("name", target.get("id")),
            "",
            "- id: `%s`" % target.get("id"),
            "- role: `%s`" % target.get("role", "primary"),
            "- mode: `%s`" % runtime.get("mode"),
            "- base_url: `%s`" % runtime.get("base_url"),
            "- source_available: `%s`" % source.get("available"),
            "- source_path: `%s`" % source.get("path"),
            "- depends_on: `%s`" % (", ".join(target.get("depends_on", [])) or "none"),
            "- environment_variables: `%s`" % (variables or "none"),
            "",
        ])
    with open(review_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines).rstrip() + "\n")
    return [parse_path, review_path]


def load_normalized(path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Parse and normalize an AutoTestFlow SUT description")
    parser.add_argument("--sut-manifest", help="Natural-language Markdown SUT description or legacy Markdown+YAML manifest")
    parser.add_argument("--candidate-manifest", help="Canonical JSON manifest produced by the Stage 0 LLM parser")
    parser.add_argument("--legacy-sut-base-url", help="Deprecated single-SUT base URL")
    parser.add_argument("--requirement-doc")
    parser.add_argument("--code-path")
    parser.add_argument("--output-dir")
    parser.add_argument("--write", action="store_true", help="Write .state/sut_manifest.normalized.json")
    args = parser.parse_args(argv)

    data = None
    try:
        if args.sut_manifest:
            data = load_manifest(args.sut_manifest)
            normalized = validate_and_normalize(data, args.sut_manifest, args.output_dir)
        elif args.candidate_manifest:
            data = load_candidate_manifest(args.candidate_manifest)
            normalized = validate_and_normalize(data, args.candidate_manifest, args.output_dir)
        elif args.legacy_sut_base_url:
            normalized = normalize_legacy(
                requirement_doc=args.requirement_doc,
                code_path=args.code_path,
                sut_base_url=args.legacy_sut_base_url,
                output_dir=args.output_dir,
            )
            print("[sut_manifest] WARNING: --sut-base-url is deprecated; use --sut-manifest.", file=sys.stderr)
        else:
            raise ManifestError("Provide --sut-manifest, --candidate-manifest, or --legacy-sut-base-url")
        if args.write:
            path = write_normalized(normalized)
            for artifact in write_sut_description_artifacts(normalized):
                print(artifact)
            print(path)
        else:
            printable = deepcopy(normalized)
            printable.pop("_sut_description_parse", None)
            print(json.dumps(printable, ensure_ascii=False, indent=2))
        return 0
    except ManifestError as exc:
        if args.write and isinstance(data, dict) and isinstance(data.get("_sut_description_parse"), dict):
            suite = data.get("suite") if isinstance(data.get("suite"), dict) else {}
            root_output_dir = _normalize_path(args.output_dir or suite.get("output_dir") or DEFAULT_OUTPUT_DIR, os.getcwd())
            write_sut_description_artifacts({
                "_sut_description_parse": data["_sut_description_parse"],
                "artifacts": _description_artifact_paths(root_output_dir),
            })
        print("[sut_manifest] ERROR: %s" % exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
