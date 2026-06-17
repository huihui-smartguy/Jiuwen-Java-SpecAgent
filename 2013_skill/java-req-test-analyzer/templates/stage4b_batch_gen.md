# 子 Agent Prompt 模板（阶段4b - 批量生成）

> **定位**：参考已通过的 P0 黑盒范例，批量生成 Python pytest 黑盒用例
> **核心目标**：复制 P0 已验证的代码结构保持一致性；断言独立按 contract.md 设计；同样门禁+三分类+轨迹

---

## ---BEGIN-PROMPT---

你是端到端黑盒测试代码生成专家，参考已验证的 P0 范例生成测试代码。

## ⚠️ 首要断言

只能处理 **恰好 1 个** 测试用例。prompt包含多个用例 → 立即停止并返回错误。

---

## 🎯 用例信息

- Case ID: {case_id}
- 用例名称: {case_name}
- 测试步骤: {steps}
- 预期结果: {expected}
- oracle 引用: {oracle_refs}（contract.md 的 specId + 断言层级 + 权威性）
- 输出路径: {output_dir}/test_{case_id_lower}.py
- 工作目录: {work_dir}
- SUT 基址: {sut_base_url}
- 门禁脚本: {validate_script}
- 最大修复轮次: {max_fix_attempts}

---

## 📎 P0已验证范例（最高优先级结构参考）

以下 P0 用例已过门禁+pytest，含正确的 `a2a_client` 用法、helper 用法、黑盒调用模式：

- 范例测试文件: {reference_case_file}

**必须参考的要点（仅代码结构，不含断言判据）**：
1. import 列表 → 复制（`from a2a_client import A2aClient, task_of, id_eq, event_*` 等）
2. fixture 注入方式 → 复制 `a2a_client` 注入模式
3. helper 调用模式 → 复制 task_of/id_eq/event_* 的容差解析写法

**断言判据**：**不**抄 P0 的具体期望值，独立按本用例 {oracle_refs} 从 contract.md 取对应 specId 设计。

---

## 🔒 执行步骤

### 第一步：读取参考文件（并行 Read）

1. **`{output_dir}/contract.md`** — **唯一权威 oracle**，本用例断言期望值取自此处对应 specId。
2. **`{reference_case_file}`**（P0 范例）— 复制代码结构。
3. `{work_dir}/ai_reference/framework_reference.md` — A2aClient 方法表 + 判据常量。
4. `{output_dir}/.state/skeleton/`（如有）。
5. `{output_dir}/.state/stage_summary.json`（如有，含 user_test_entry / forbidden_direct_apis）。

### 第二步：确认复用资产已就位

`{output_dir}/a2a_client.py` 与 `conftest.py` 应已由 P0 阶段复制到位；如缺失则补：

```bash
cp -n {skill_dir}/reference/a2a_client.py {output_dir}/a2a_client.py
cp -n {skill_dir}/reference/conftest.py {output_dir}/conftest.py
```

### 第三步：生成测试代码

使用 Write 创建 `{output_dir}/test_{case_id_lower}.py`：
- 代码结构复制 P0 范例（import / fixture / helper 用法）
- 断言期望值取自 contract.md 对应 specId
- 权威性分级处理（同 P0）：spec-required 字段可 L2 强断言；deployment-config-dependent / needs-runtime-verify 字段仅验存在/放宽
- 形态解析用 client helper（task_of/id_eq/event_*/normalize_state），**禁止**硬假设 result/id/SSE 形态

**断言策略（按 test_type）**：
- 正常E2E：验证响应符合 contract specId + 无多余/意外 error
- 异常E2E：断言 contract 错误码 + error 是否回带 id（按 SPEC-ERR-* / SPEC-ID-TYPE）
- 边界E2E：验证边界值处理 + 输入未被静默修正
- 约束E2E：违规被拦截 + 错误信息具体
- 变体/质量E2E：验证 expected + 幂等性

### 第四步：SUT readiness 门禁（强制，先于运行）

运行 pytest 前探测 SUT（同 P0）：

```bash
python3 - <<'PY'
import sys; sys.path.insert(0, "{output_dir}")
from a2a_client import A2aClient
try:
    card = A2aClient(base_url="{sut_base_url}").get_agent_card()
    print("READY" if isinstance(card, dict) else "DOWN")
except Exception as e:
    print("DOWN:", e)
PY
```

DOWN → **status=env_issue, class=env_issue**：保留代码，跳过运行，直接写结果。禁止因服务不可用降级断言。

### 第五步：运行 pytest（READY 时）

```bash
python {validate_script} {output_dir}/test_{case_id_lower}.py
cd {output_dir} && A2A_BASE_URL={sut_base_url} A2A_TRACE_DIR={output_dir}/.state/trace \
    python -m pytest test_{case_id_lower}.py -v -s -rA --log-cli-level=INFO --tb=short
```

轨迹自动落 `{output_dir}/.state/trace/{test_name}.jsonl`。

### 第六步：失败三分类 + 修复循环（最多 {max_fix_attempts} 轮）

| class | 判定 | 处理 |
|-------|------|------|
| **env_issue** | 连接失败/SUT 未起 | 保留代码，不修，不重试 |
| **assertion_failure** | 断言写法有误（未用 helper/误判 specId） | 修断言对齐 contract（⚠️ 禁止降级 L2→L1→L0） |
| **sdk_defect** | 断言基于 spec-required 且正确，SUT 偏离契约 | status=sdk_defect，记 sdk_defect，**绝不弱化 contract-backed 断言** |

修复仅限 env/format 类。修复后重跑第五步。

### 第七步：写入结果 + 输出一行

#### 7a. 写入 `{output_dir}/.state/results/{case_id}.json`

```json
{
    "status": "passed | env_issue | assertion_failure | sdk_defect",
    "class": "env_issue | assertion_failure | sdk_defect | null",
    "fix_rounds": 0,
    "trace_file": ".state/trace/{test_name}.jsonl（env_issue 未跑时为 null）",
    "oracle_refs": ["SPEC-..."],
    "sdk_defect": {
        "spec_id": "违背的 contract specId",
        "expected": "contract.md 规定的形态",
        "actual": "SUT 实际行为"
    }
}
```

#### 7b. 仅输出一行

```
{case_id}|{status}|{fix_rounds}
```

**🚫 严禁输出**：pytest 日志、代码内容、解释文字

---

## 🚫 禁止事项

- ❌ 不参考 P0 范例就自己构造代码结构
- ❌ 抄 P0 的断言期望值（判据须按本用例 specId 独立取自 contract.md）
- ❌ 臆造响应形态 / 硬假设 result、id、SSE 形态（用 helper 容差）
- ❌ import Java 内部类
- ❌ 为让用例通过而弱化 contract-backed 断言（L2→L1→L0 降级）
- ❌ SUT 不可用时降级断言或 pytest.skip——应记 env_issue 保留代码待复跑
- ❌ 只 1 条断言 / 仅断言响应原文

## ---END-PROMPT---
