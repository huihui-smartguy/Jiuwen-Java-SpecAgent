#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = REPO / "AutoTestFlow" / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import output_layout as layout  # noqa: E402


class OutputLayoutTests(unittest.TestCase):
    def test_target_artifacts_create_canonical_parent_dirs(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td)
            design = Path(layout.target_artifact(str(out), "test_design", create_parent=True))
            result = Path(layout.result_file(str(out), "TC_001", create_parent=True))
            report = Path(layout.target_artifact(str(out), "report", create_parent=True))

            self.assertEqual(design.relative_to(out).as_posix(), "TestCases/test_design.json")
            self.assertEqual(result.relative_to(out).as_posix(), "TestRun/results/TC_001.json")
            self.assertEqual(report.relative_to(out).as_posix(), "Reports/report.md")
            self.assertTrue(design.parent.is_dir())
            self.assertTrue(result.parent.is_dir())
            self.assertTrue(report.parent.is_dir())

    def test_root_artifacts_and_display_paths_are_canonical(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td)
            normalized = Path(layout.root_artifact(str(out), "normalized_manifest", create_parent=True))
            self.assertEqual(normalized.relative_to(out).as_posix(), "RunMetadata/sut_manifest.normalized.json")
            self.assertEqual(layout.relpath(str(normalized), str(out)), "RunMetadata/sut_manifest.normalized.json")
            dirs = layout.root_artifact_dirs(str(out), create=True)
            self.assertEqual(Path(dirs["feature_analysis"]).relative_to(out).as_posix(), "FeatureAnalysis")

    def test_existing_artifacts_prefer_canonical_and_fallback_to_legacy(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td)
            legacy = out / ".state" / "results" / "TC_LEGACY.json"
            legacy.parent.mkdir(parents=True)
            legacy.write_text("{}", encoding="utf-8")

            self.assertEqual(Path(layout.existing_result_file(str(out), "TC_LEGACY")), legacy)

            canonical = out / "TestRun" / "results" / "TC_LEGACY.json"
            canonical.parent.mkdir(parents=True)
            canonical.write_text("{}", encoding="utf-8")
            self.assertEqual(Path(layout.existing_result_file(str(out), "TC_LEGACY")), canonical)

    def test_existing_glob_returns_canonical_then_legacy_without_duplicates(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td)
            canonical = out / "TestRun" / "results" / "TC_1.json"
            legacy = out / ".state" / "results" / "TC_2.json"
            canonical.parent.mkdir(parents=True)
            legacy.parent.mkdir(parents=True)
            canonical.write_text("{}", encoding="utf-8")
            legacy.write_text("{}", encoding="utf-8")

            paths = [Path(p).relative_to(out).as_posix() for p in layout.existing_glob(
                str(out),
                "TestRun/results/*.json",
                ".state/results/*.json",
            )]
            self.assertEqual(paths, ["TestRun/results/TC_1.json", ".state/results/TC_2.json"])


if __name__ == "__main__":
    unittest.main()
