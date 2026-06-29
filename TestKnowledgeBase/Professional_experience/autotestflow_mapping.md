# AutoTestFlow 映射方案

## 1. 设计目标

把行业专业经验转成 AutoTestFlow 可消费的轻量协议，不改变现有主链路，不破坏 contract-first。

推荐新增可选产物：

```text
.state/professional_acceptance.json
.state/ai_eval_readiness.json
```

这些文件由 AutoTestFlow 的 `professional_acceptance.py` 生成，作为 advisory artifact 注入主链路，不破坏 contract-first。

## 2. 阶段映射

| AutoTestFlow 阶段 | 可使用的经验项 | 建议产物 |
|---|---|---|
| stage1 需求分析 | 可测性、用户链路、失败模式、非功能目标、AI 成功标准 | `.state/professional_acceptance.seed.json` |
| stage2 代码扫描 | 可观测性、错误处理、配置、依赖、鉴权、并发线索 | `.state/professional_acceptance.code_gaps.json` |
| stage2.5 契约校准 | traceId、错误质量、SSE 终态、tool call、latency 观察项 | `contract.md` 观察项，不升级强断言 |
| stage2.6 故障匹配 | 用专业经验控制故障配额和优先级 | `.state/fault_matches.json` 的 priority note |
| stage3b 用例设计 | 测试金字塔、AI eval、红队、DFX、canary/readiness | `.state/professional_case_guidance.json` + `test_design.json` 的 `acceptance_refs` |
| stage4 执行 | trace、grader、成本、延迟、tool call、环境证据 | `.state/results/*.json` 的 evidence 字段 |
| stage5 报告 | release readiness、AI readiness、coverage matrix | `.state/professional_acceptance.json` + `.state/ai_eval_readiness.json` + `report.md` 的专业验收矩阵 |

## 3. 推荐 schema

### 3.1 `acceptance_refs`

```json
{
  "acceptance_refs": [
    {
      "standard_id": "PE-SW-FAST-FEEDBACK",
      "dimension": "software_testing",
      "reason": "该用例属于 PR 前快速反馈层",
      "evidence_required": ["test_runtime", "deterministic_input", "trace"]
    }
  ]
}
```

### 3.2 `professional_acceptance.json`

```json
{
  "meta": {
    "generated_by": "professional_experience",
    "knowledge_version": "1.0.0"
  },
  "gates": [
    {
      "standard_id": "PE-AI-EVAL-DATASET",
      "status": "pass | warn | fail | not_applicable",
      "evidence": ["eval_dataset.jsonl", "grader_config.json"],
      "note": "AI Agent 有代表性数据集和评分器"
    }
  ]
}
```

## 4. 与故障库的合并逻辑

故障库命中时，优先级由三个来源共同决定：

| 来源 | 作用 |
|---|---|
| `Fault/*.json` 的 `severity` | 缺陷风险 |
| `Professional_experience/acceptance_criteria.json` 的 `release_gate` | 上线门禁权重 |
| `contract.md` 的 authority | 是否能形成强断言 |

合并规则：

1. `sdk_defect` 必须同时满足故障触发证据和 contract-backed 断言失败。
2. 只有专业经验命中但契约无背书时，输出 `warn` 或观察项，不判缺陷。
3. AI 安全、隐私、工具调用、过度自治类问题如果缺少明确契约，应进入 `ai_eval_gap`，推动补契约或人工裁决。
4. 历史故障命中且专业经验判定为 release gate，应提升为 P0/P1。

## 5. 专业报告模板建议

stage5 可增加以下结构：

```markdown
## 专业验收结论

| 维度 | 状态 | 证据 | 风险 | 下一步 |
|---|---|---|---|---|
| 快速反馈 | pass | P0 smoke 12/12, runtime 3m | 低 | 保持 |
| 故障覆盖 | warn | FC-SSE 覆盖不足 | 中 | 增加流式中断用例 |
| AI eval | fail | 无红队样本 | 高 | 补 prompt injection 和 tool misuse eval |
| 生产闭环 | warn | 无采样评估计划 | 中 | 配置线上采样与漂移告警 |
```
