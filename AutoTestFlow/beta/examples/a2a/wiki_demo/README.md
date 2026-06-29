# wiki_demo · LLM Wiki 离线确定性 fixture（Beta v1.0）

> 无需真实 SUT / 仓 / LLM，即可验证 Beta v1.0（故障库接入 LLM Wiki，Phase A）的**确定性底座 + 接入逻辑**。
> 对应 `ChangeLogs/v3.0` §七验证、`beta/shared/wiki_rules.md` 护栏、`beta/shared/wiki_schema.md` 格式契约。

## 一、目录内容

| 文件 | 作用 |
|---|---|
| `faults.sample.json` | 输入：从全局库裁剪的 3 条故障（F-REQ-011 / F-PROTO-001 / F-HIST-001，后者 `ref:F-REQ-011`） |
| `contract.md` | 输入：契约（复用 fault_demo），含 SPEC-RESP-WRAP / SPEC-ID-TYPE / SPEC-ERR-* 等 spec-required |
| `fault_matches.slice.json` | 输入：含 1 条 `enrich.needs_bind=true`（unbound 点「响应id字段回带」）供场景 A 演示 |
| `walkthrough.md` | **纸面 trace**：wiki 如何应用于 stage2.6b（绑定）与 stage6（issue 叙事），逐条红线核对 |
| `golden/wiki/*.md` | golden：`gen_wiki.py` 对 sample 库的派生产物（3 故障 + 3 分类 + 1 索引） |
| `golden/.state/wiki_check.json` | golden：`check_wiki.py` 校验报告（C1–C5 全绿） |

## 二、复现命令（在仓根执行）

```bash
DEMO=AutoTestFlow/beta/examples/a2a/wiki_demo

# 1) 由 sample 库单向派生 wiki 到临时目录
python3 AutoTestFlow/beta/scripts/gen_wiki.py \
    --fault-lib $DEMO/faults.sample.json --wiki-dir /tmp/wiki_demo_out/wiki

# 2) 护栏校验（全绿，退出 0）
python3 AutoTestFlow/beta/scripts/check_wiki.py \
    --fault-lib $DEMO/faults.sample.json --wiki-dir /tmp/wiki_demo_out/wiki --output-dir /tmp/wiki_demo_out

# 3) 与 golden 逐字节比对（应无差异 → 证明确定性 + 幂等）
diff -r $DEMO/golden/wiki /tmp/wiki_demo_out/wiki && echo "WIKI MATCHES GOLDEN"
```

## 三、预期结果

1. 步骤 1：`生成完成：3 篇故障文章 + 3 篇分类汇总 + 1 篇索引`。
2. 步骤 2：`C1..C5 PASS`、`全部通过：5/5`、退出码 0；`wiki_check.json.ok=true`、`summary.faults_checked=3`。
3. 步骤 3：`diff -r` 无输出 + 打印 `WIKI MATCHES GOLDEN`（派生确定、幂等）。
4. `golden/wiki/F-REQ-011.md`「历史案例」回链 `F-HIST-001`（演示 `ref:` 交叉链接）；
   「契约锚点」含「不声明无条件断言级别…以 contract.md 为准」（演示 advisory 不越权）。
5. `walkthrough.md` 两场景的红线核对项逐条成立（人工可验）。

## 四、这验证了什么

- **确定性底座**：wiki 由 JSON **单向派生**、**幂等**、**可溯源**、**不越权**、**不进 matcher**（C1–C5 机械证明）。
- **接入逻辑正确**：`walkthrough.md` 证明 wiki 能被 stage2.6b / stage6 消费且**红线不破**（contract 仍唯一判据）。
- **优雅降级**：wiki 缺失时两阶段回退稳定模板逻辑（见 walkthrough 各场景末「红线核对」）。

## 五、诚实说明

- 本 demo 用 **sample 库 + 纸面 trace** 离线验证"生成/护栏/接入逻辑"的**确定性部分**。
- **真实 LLM 子 Agent 执行**（stage2.6b 实际绑定、stage6 实际产 issue）需用户在**真实环境 + 真实 LLM 运行时**下、
  以 `--beta-wiki on` 跑通；本环境无 LLM 运行时，未实跑（口径同 `ChangeLogs/v2.0` §八、README §9）。
