# AutoTestFlow · Beta（预研特性区）

> 本目录是 AutoTestFlow 的 **Beta 预研暂存区**：用于在**不污染稳定流水线**的前提下，预研可能接入的新特性。
> 所有 Beta 特性**默认关闭**，由开关显式开启；关闭时流水线与稳定版**字节级一致**（优雅降级，复用 v2.0 `--remediate` 范式）。

---

## 一、定位与边界

- **物理隔离**：Beta 代码全部在 `AutoTestFlow/beta/` 子树内（scripts / templates / shared / examples），
  稳定目录（`scripts/`、`templates/`、`reference/`、`shared/`）**零改动**。
- **开关激活**：编排器 `SKILL.md` 仅以 **additive** 方式接入 Beta（新增参数 + 一个门控小节）；
  开关 `off`（默认）时**不调用任何 Beta 代码、不产任何 Beta 文件**。
- **不破坏内核**：Beta 特性**不得违反** `DESIGN.md` §1–§7（尤其 §2「contract 唯一 Oracle / 生成器不得自我认证」、
  §7「不洗绿」）与 `shared/rules.md` §4（5 分类执行边界）。Beta 只能在这些不变量之上做**增强**，不能绕过它们。

## 二、当前预研项

| Beta 版本 | 特性 | 开关 | 状态 |
|---|---|---|---|
| **v1.0** | **故障库接入 LLM Wiki（Phase A：仓内派生 NL 文章）** | `--beta-wiki on\|off`（默认 off） | 预研中 |

预研依据：`FaultsAnalysis/07-LLM_Wiki与故障库知识源分析.md` §九演进路线 **Phase A**——
由结构化故障库**单向派生**仓内 NL 文章（默认 `TestKnowledgeBase/Fault/wiki/*.md`），供 **stage2.6b / stage6** 的
LLM 子 Agent 按 `fault_id` 确定性取用，作 **advisory 建议层**；**不作 oracle、不进 `match_faults.py`**。

## 三、v1.0（LLM Wiki Phase A）组成

```
AutoTestFlow/beta/
├── README.md                              # 本文件
├── scripts/
│   ├── gen_wiki.py                        # 故障库 JSON → wiki/*.md（单向派生，幂等，纯确定性）
│   └── check_wiki.py                      # 护栏校验器：覆盖/溯源/不漂移/不越权/非matcher（产 .state/wiki_check.json）
├── templates/
│   ├── stage2_6_fault_match.beta.md       # = 稳定模板 + 一步 advisory wiki 上下文（红线逐条保留）
│   └── stage6_defect_analyze.beta.md      # = 稳定模板 + 一步 advisory wiki 上下文（红线逐条保留）
├── shared/
│   ├── wiki_rules.md                      # Beta wiki 纪律（单一真相/单向派生/advisory/非oracle非matcher/强制溯源）
│   └── wiki_schema.md                     # wiki 文章格式契约 + 生成契约
└── examples/a2a/wiki_demo/                # 离线确定性 fixture + golden + 纸面 trace（无需真实 SUT/LLM）

TestKnowledgeBase/Fault/wiki/              # 【生成产物】由 TestKnowledgeBase/Fault/*.json 派生；Specification_Repository/wiki 为 legacy
```

## 四、怎么用（`--beta-wiki on`）

```bash
# 1) 由结构化库生成/刷新仓内 wiki 文章（单向派生，幂等）
python AutoTestFlow/beta/scripts/gen_wiki.py

# 2) 护栏校验（全绿才算 wiki 可用）
python AutoTestFlow/beta/scripts/check_wiki.py        # 产 .state/wiki_check.json，全绿退出 0

# 3) 在流水线中启用（编排器据 --beta-wiki on 选用 beta 模板，并把 wiki_dir 传给 stage2.6b/stage6 子 Agent）
/auto-test-flow 需求.md <java仓>/<模块> --sut-base-url http://host:port \
    --faults on --fault-enrich on --beta-wiki on
```

- **关闭（默认）**：`--beta-wiki off` → 编排器用稳定模板、不跑 `gen_wiki.py`、不读 wiki → 与 v2.x 字节级一致。
- **复现离线 demo**：见 `examples/a2a/wiki_demo/README.md`（无需 SUT/LLM）。

## 五、数据流（v1.0）

```
TestKnowledgeBase/Fault/rest_api_faults.json           ← 后续单一真相（matcher/record 默认输入）
   │
   ├──► scripts/match_faults.py / record_faults.py      [确定性消费者：只吃 JSON，零改动]
   │
   └──(beta/scripts/gen_wiki.py 单向派生)──► TestKnowledgeBase/Fault/wiki/*.md（advisory NL 层）
          │  每篇溯源 fault_id（+category）；不声明无条件断言级别
          └──► stage2.6b(beta) / stage6(beta) 的 LLM 子 Agent   [LLM 消费者：按 fault_id 读 wiki]
                 判据仍由 contract.md 封顶；wiki 不作 oracle
                              ▲
            beta/scripts/check_wiki.py 把上述护栏变为可执行断言（离线机械校验）
```

## 六、毕业 / 退役标准

- **毕业到稳定**：当某 Beta 特性经多 SUT 验证稳定、文档/测试齐备、无内核冲突 → 把 `beta/` 下对应代码并入稳定目录，
  开关从 `--beta-*` 提升为正式参数，更新 `DESIGN.md`/`SKILL.md`/ChangeLog。
- **退役**：若预研结论为不采用 → 删除对应 `beta/` 子项与开关，`TestKnowledgeBase/Fault/wiki/` 等派生产物一并移除；
  因全程隔离 + 默认关闭，退役**不影响**稳定流水线。

> 详细变更见 `ChangeLogs/v3.0-Beta预研_故障库接入LLM_Wiki.md`。
