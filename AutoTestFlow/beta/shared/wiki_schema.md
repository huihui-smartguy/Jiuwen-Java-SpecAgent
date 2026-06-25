# Beta · LLM Wiki 文章格式契约（wiki_schema）

> 定义 `gen_wiki.py` 派生的 `Specification_Repository/wiki/*.md` 的**格式契约**。
> 该契约是确定性的：同一份 JSON + overlay → 同一组字节级文章（`check_wiki.py` C3 强制）。

## 一、文件清单（由全库派生）

| 文件 | 数量 | 内容 |
|---|---|---|
| `{fault_id}.md` | 每个 fault_id 一篇（含 history_faults） | 单故障 NL 文章 |
| `category-{cat}.md` | 每个归一类目一篇（FC-REQ/RES/PROTO/STATE/SSE/SEC/PERF + HISTORY） | 分类汇总表 |
| `index.md` | 1 | 全量索引（按类目分组，链接到各文章） |

> 归一类目 `{cat}` = `category_id` 取前两段（`FC-REQ-001`→`FC-REQ`）；history → `HISTORY`；overlay 项 → `PROJECT`。

## 二、单故障文章结构（`{fault_id}.md`）

固定章节、固定顺序（缺字段以"（未提供）"占位，保持结构稳定）：

```
# {fault_id} · {name}

> 溯源：`rest_api_common_faults.json` → `{category_id}`（{category_name}）→ `{fault_id}`
> 严重程度：{severity} ｜ 故障建议断言级别：{assertion_level}（**最终以项目 `contract.md` 权威性封顶**，见下「契约锚点」）
> 适用场景：{applicable_scenarios}            # 有则列
> 标签：{tags}                                  # 有则列
> 本文由 `beta/scripts/gen_wiki.py` 从结构化故障库**单向派生**，仅作 advisory；**不作 oracle、不进 `match_faults.py`**。

## 故障模式（通俗描述）        # ← JSON.description（逐字）
## 怎么触发                     # ← JSON.test_strategy.trigger_pattern（逐字）
## 预期行为                     # ← JSON.test_strategy.expected_behavior + validation_points（逐字列表）
## 契约锚点（候选 specId 种类） # ← candidate_spec_kinds() 派生 + 封顶说明 + 「不声明无条件断言级别」免责声明
## 常见根因方向（通用经验 · advisory）  # ← 按类通用模板（明确标注非结构化库字段）
## 历史案例                     # ← history 自身元数据；或普通故障回链关联 history（ref: 标签）；或"暂无"
## 关联故障                     # ← 同类其它 fault_id 链接 + 分类/索引返回链接
```

**字段来源对照（用于 C3 不漂移校验）**：

| 文章元素 | JSON 来源 | 性质 |
|---|---|---|
| 标题 / 溯源行 | `fault_id` / `name` / `category_id` / `category_name` | 逐字（溯源锚点） |
| 严重程度 / 建议断言级别 | `severity` / `test_strategy.assertion_level` | 逐字（**带 contract 封顶限定**） |
| 故障模式 / 触发 / 预期 / 验证点 | `description` / `test_strategy.{trigger_pattern,expected_behavior,validation_points}` | 逐字 |
| 候选 specId 种类 | `candidate_spec_kinds(category,tags)`（镜像 match_faults） | 派生（advisory） |
| 常见根因方向 | 按归一类目的固定模板 | 派生（**advisory，非库字段，显式标注**） |
| 历史案例 | history_faults 元数据 / `ref:` 关联 | 逐字 / 派生链接 |

## 三、分类汇总（`category-{cat}.md`）

- 头部：类目名 + 故障数 + advisory 免责。
- 一张表：`fault_id | 名称 | 严重度 | 建议断言级别 | 候选 specId 种类`，每行链到 `{fault_id}.md`。

## 四、索引（`index.md`）

- 头部：派生说明 + 单一真相声明 + 源库版本/overlay 版本 + 文章计数 + 重生成/校验命令。
- 正文：按类目分组，每组链到 `category-{cat}.md` 与各 `{fault_id}.md`。

## 五、生成契约（不变量）

1. **确定性顺序**：故障按 `load_faults` 出现顺序（类目文件序 → history）；类目按首次出现序。
2. **幂等**：重复运行字节一致（无时间戳、无随机）。
3. **溯源齐全**：每篇故障文章 H1 以 `# {fault_id} ` 起始，且含 `> 溯源：` 行。
4. **advisory 免责**：每篇含「不声明无条件断言级别」+「以 contract.md 为准 / 权威性封顶」。
5. **无判据化措辞**：不得出现"作为(唯一)判据 / oracle / 通过依据 / 据此判定通过"。

> 以上 1–5 由 `check_wiki.py` 的 C1–C5 机械校验；任一不过则 `wiki_check.json.ok=false`、退出码非零。
