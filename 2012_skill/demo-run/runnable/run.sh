#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# 黑盒 A2A 测试套件运行脚本（在已部署 agent-runtime 的服务器上执行）
#
# 用法:
#   bash run.sh                       # 自动探测 base url 并运行
#   A2A_BASE_URL=http://host:8080 bash run.sh   # 指定 base url
#
# 安全提示: 切勿在本脚本或环境变量中写入任何明文口令/密钥。
# -----------------------------------------------------------------------------
set -u
cd "$(dirname "$0")"

# ---------------------------------------------------------------------------
# 1. 确定 A2A_BASE_URL：优先用环境变量，否则探测本机候选端口
# ---------------------------------------------------------------------------
CARD_PATH="/.well-known/agent-card.json"
CANDIDATE_PORTS="8080 8081 8888 9090 18080"

if [ -n "${A2A_BASE_URL:-}" ]; then
  echo "[info] 使用已设置的 A2A_BASE_URL=${A2A_BASE_URL}"
else
  echo "[info] 未设置 A2A_BASE_URL，探测本机候选端口: ${CANDIDATE_PORTS}"
  for port in ${CANDIDATE_PORTS}; do
    url="http://localhost:${port}"
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${url}${CARD_PATH}" 2>/dev/null || echo "000")
    if [ "${code}" = "200" ]; then
      export A2A_BASE_URL="${url}"
      echo "[info] 探测命中: ${url}${CARD_PATH} -> HTTP 200"
      break
    else
      echo "[info]   ${url}${CARD_PATH} -> HTTP ${code}（跳过）"
    fi
  done
fi

if [ -z "${A2A_BASE_URL:-}" ]; then
  echo "[error] 未能自动探测到运行中的 agent-runtime。"
  echo "[error] 请确认服务已启动后，手动指定，例如:"
  echo "          export A2A_BASE_URL=http://localhost:8080"
  echo "        然后重新执行: bash run.sh"
  exit 1
fi
echo "[info] 选中 base url: ${A2A_BASE_URL}"

# ---------------------------------------------------------------------------
# 2. 准备 Python 依赖：优先 venv，pip 失败则回退系统已装 httpx/pytest
# ---------------------------------------------------------------------------
USE_VENV=0
if python3 -m venv .venv >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  . .venv/bin/activate
  if pip install -q -r requirements.txt >/dev/null 2>&1; then
    USE_VENV=1
    echo "[info] 已创建 venv 并安装依赖 (httpx/pytest)。"
  else
    echo "[warn] venv 内 pip install 失败（可能无外网）。"
    echo "[warn] 退出 venv，改用系统已安装的 httpx/pytest 继续。"
    deactivate 2>/dev/null || true
  fi
else
  echo "[warn] 无法创建 venv，改用系统已安装的 httpx/pytest 继续。"
fi

# 校验 pytest/httpx 是否可用（无论 venv 还是系统）
if ! python3 -c "import pytest, httpx" >/dev/null 2>&1; then
  echo "[error] 未找到 pytest/httpx。请先安装: pip install pytest httpx"
  exit 1
fi
echo "[info] pytest 版本: $(python3 -m pytest --version 2>&1 | head -n1)"

# ---------------------------------------------------------------------------
# 3. 运行测试（允许测试失败，不因 set -e 中断；显式关闭 errexit）
# ---------------------------------------------------------------------------
# 交互轨迹目录：每个用例一份 trace/<case>.jsonl + trace/session.log
export A2A_TRACE_DIR="$(pwd)/trace"
rm -rf "$A2A_TRACE_DIR"
mkdir -p "$A2A_TRACE_DIR"
echo "[info] 交互轨迹目录: ${A2A_TRACE_DIR}"

set +e
echo "[info] 运行: python3 -m pytest -v -s -rA --log-cli-level=INFO"
python3 -m pytest -v -s -rA --log-cli-level=INFO 2>&1 | tee results.txt
echo "[info] 生成 JUnit XML: results.junit.xml"
python3 -m pytest -q --junitxml=results.junit.xml >/dev/null 2>&1
PYTEST_RC=$?
set -e

# 可选：附加服务端 agent-runtime 日志尾部（best-effort）
if [ -n "${AGENT_RUNTIME_LOG:-}" ] && [ -f "${AGENT_RUNTIME_LOG}" ]; then
  {
    echo "--- agent-runtime 服务端日志(尾100行) ---"
    tail -n 100 "${AGENT_RUNTIME_LOG}"
  } >> results.txt 2>&1
fi

# ---------------------------------------------------------------------------
# 4. 统计 passed/failed/errored 并打印结果路径
# ---------------------------------------------------------------------------
SUMMARY=$(grep -E "passed|failed|error" results.txt | tail -n1)
echo "------------------------------------------------------------------"
echo "[result] 概要: ${SUMMARY:-（无概要行，见 results.txt）}"
PASSED=$(grep -oE "[0-9]+ passed" results.txt | tail -n1 | grep -oE "[0-9]+" || echo 0)
FAILED=$(grep -oE "[0-9]+ failed" results.txt | tail -n1 | grep -oE "[0-9]+" || echo 0)
ERRORED=$(grep -oE "[0-9]+ error" results.txt | tail -n1 | grep -oE "[0-9]+" || echo 0)
echo "[result] passed=${PASSED:-0}  failed=${FAILED:-0}  errored=${ERRORED:-0}"
echo "[result] 详细输出: $(pwd)/results.txt"
echo "[result] JUnit XML : $(pwd)/results.junit.xml"
echo "------------------------------------------------------------------"
echo "[trace] 交互轨迹: ${A2A_TRACE_DIR}"
ls -1 "${A2A_TRACE_DIR}"
echo "------------------------------------------------------------------"
echo "[info] 请把 results.txt 内容贴回以便分析。"

exit 0
