# a2a fault_demo —— TestKnowledgeBase/故障库接入的确定性自测 fixture

本目录是 `match_faults.py` / `record_faults.py` / `aggregate_results.py` 的**可复现自测样例**，
**无需运行中的 SUT**：用手工裁剪的 a2a 形态 `contract.md` + s1/s2 状态 + 一条 `sdk_defect` 结果，
端到端演示"TestKnowledgeBase/故障库 → 匹配计划 → 闭环积累"。

## 目录内容（输入 fixture）

```
contract.md                      # 权威性分级表（SPEC-RESP-WRAP/ID-TYPE/ENUM/SSE/ERR-* 为 spec-required；CARD-URL 为 config-dependent）
test_design.json                 # 2 条用例（TC_041 普通；TC_042 带 fault_ref=F-REQ-011）
.state/s1_index.json             # 2 个场景：FS-001 SendMessage(写,含 metadata.agentId)、FS-002 SSE 流式
.state/s1_scenarios/FS-001.json
.state/s1_scenarios/FS-002.json
.state/s2_code_facts.json        # entry_catalog 含 params.metadata.agentId（驱动关联字段匹配）
.state/results/TC_041.json       # 一条 sdk_defect（无 fault_ref → 闭环新建 F-HIST）
.state/results/TC_042.json       # 一条 sdk_defect（fault_ref=F-REQ-011 → 闭环去重跳过）
```

## 复现命令

> 说明：本 fixture 的 golden 产物来自早期 `Specification_Repository` 故障库，为保持历史回归可复现，命令显式 pin 旧库。新产品迭代默认读取 `TestKnowledgeBase/registry.json` 或扫描 `TestKnowledgeBase/Fault/*.json`，无需传 `--fault-lib`。

```bash
# 1) 阶段2.6 故障匹配（契约优先封顶）
python AutoTestFlow/scripts/match_faults.py \
    --output-dir AutoTestFlow/examples/a2a/fault_demo \
    --fault-lib Specification_Repository/rest_api_common_faults.json

# 2) 结果聚合（5 分类计数）
python AutoTestFlow/scripts/aggregate_results.py \
    --output-dir AutoTestFlow/examples/a2a/fault_demo

# 3) 闭环自积累（dry-run；加 --write 落 overlay）
python AutoTestFlow/scripts/record_faults.py \
    --output-dir AutoTestFlow/examples/a2a/fault_demo \
    --fault-lib Specification_Repository/rest_api_common_faults.json \
    --overlay-path AutoTestFlow/examples/a2a/fault_demo/project_faults.json --write

# 降级回归：关闭即不产出任何文件，与未接入时一致
python AutoTestFlow/scripts/match_faults.py \
    --output-dir AutoTestFlow/examples/a2a/fault_demo --faults off
```

## 预期产物（已附 golden）

- `.state/fault_matches.json` —— 兼容匹配计划；旧库回归为 21 条匹配：F-REQ-011（关联字段，FS-001/002）、F-PROTO-002（→SPEC-ERR-32700）、
  F-SSE-001/002（仅流式 FS-002）、F-HIST-001~005（历史→P0；F-HIST-005 卡片→`downgraded` 但仍含 spec-required L2 锚点）。
- `.state/fault_contract_alignment.md` —— 故障-契约对齐报告。
- `case_results.json` —— `sdk_defect: 2`。
- `.state/new_knowledge_candidates.json` / `.state/new_faults_detected.json` + `project_faults.json` —— 新建 `F-HIST-006`（来自 TC_041）；
  TC_042 因 `fault_ref=F-REQ-011` 已知而**去重跳过**。

> 这些 golden 文件随仓库提交，便于 review 与回归对比；重跑命令应得到一致结果。
