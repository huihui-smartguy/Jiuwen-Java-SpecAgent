import re
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
AUTOTESTFLOW = REPO / "AutoTestFlow"


class WorkerLocalPathTests(unittest.TestCase):
    def test_removed_root_asset_directories_do_not_exist(self):
        for name in ("templates", "scripts", "shared", "reference", "examples", "beta"):
            self.assertFalse(
                (AUTOTESTFLOW / name).exists(),
                "%s should be owned under AutoTestFlow/workers/" % name,
            )

    def test_no_root_asset_execution_paths_remain(self):
        forbidden = re.compile(
            r"AutoTestFlow/(scripts|shared|reference|templates|examples|beta)(/|`|\\b)"
            r"|\\{skill_dir\\}/(scripts|shared|reference|templates|examples|beta)/"
        )
        offenders = []
        for path in AUTOTESTFLOW.rglob("*"):
            if not path.is_file() or path.suffix not in {".md", ".py", ".json"}:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            for lineno, line in enumerate(text.splitlines(), 1):
                if forbidden.search(line):
                    offenders.append("%s:%s: %s" % (path.relative_to(REPO), lineno, line.strip()))
        self.assertEqual([], offenders)

    def test_forbidden_supervisor_runtime_concepts_are_absent(self):
        forbidden_names = {
            "stage_registry.json",
            "stage_task_schema.md",
            "supervisor_runtime.py",
            "test_supervisor_runtime.py",
        }
        present = [str(p.relative_to(REPO)) for p in AUTOTESTFLOW.rglob("*") if p.name in forbidden_names]
        self.assertEqual([], present)

        forbidden_text = re.compile(r"stage_dag\.json|StageTask protocol|StageTask file")
        offenders = []
        for path in AUTOTESTFLOW.rglob("*"):
            if not path.is_file() or path.suffix not in {".md", ".py", ".json"}:
                continue
            if path == Path(__file__):
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            for lineno, line in enumerate(text.splitlines(), 1):
                if forbidden_text.search(line):
                    offenders.append("%s:%s: %s" % (path.relative_to(REPO), lineno, line.strip()))
        self.assertEqual([], offenders)


if __name__ == "__main__":
    unittest.main()
