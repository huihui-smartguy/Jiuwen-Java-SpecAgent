# -*- coding: utf-8 -*-
"""pytest fixtures for 黑盒 A2A 用例 + 交互轨迹日志配置。"""

import os
import logging

import pytest

import a2a_client
from a2a_client import A2aClient, base_url_from_env


# ---------------------------------------------------------------------------
# 日志：把 logger "a2a" 的请求/响应/SSE 行打到 stdout（配合 -s/--log-cli-level）；
# 若设置 A2A_TRACE_DIR，再加一个 {dir}/session.log 文件 handler。只配置一次。
# ---------------------------------------------------------------------------
def _configure_logging():
    log = logging.getLogger("a2a")
    log.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")

    has_stream = any(
        isinstance(h, logging.StreamHandler) and not isinstance(h, logging.FileHandler)
        for h in log.handlers
    )
    if not has_stream:
        sh = logging.StreamHandler()  # stdout/stderr 默认 stderr -> 由 pytest -s 捕获
        sh.setLevel(logging.INFO)
        sh.setFormatter(fmt)
        log.addHandler(sh)

    trace_dir = os.environ.get("A2A_TRACE_DIR")
    if trace_dir:
        try:
            os.makedirs(trace_dir, exist_ok=True)
            session_log = os.path.join(trace_dir, "session.log")
            has_file = any(
                isinstance(h, logging.FileHandler)
                and getattr(h, "baseFilename", None) == os.path.abspath(session_log)
                for h in log.handlers
            )
            if not has_file:
                fh = logging.FileHandler(session_log, encoding="utf-8")
                fh.setLevel(logging.INFO)
                fh.setFormatter(fmt)
                log.addHandler(fh)
        except Exception:
            pass


_configure_logging()


@pytest.fixture(scope="session")
def base_url() -> str:
    """读取 A2A_BASE_URL（默认 http://localhost:8080）。"""
    return base_url_from_env()


@pytest.fixture
def a2a_client(base_url) -> A2aClient:
    """黑盒 A2A 客户端实例（httpx 惰性导入，无服务时连接失败=env_issue）。"""
    return A2aClient(base_url=base_url)


@pytest.fixture(autouse=True)
def _trace(request):
    """每个用例：开始时绑定 case 名；结束时（若开启 trace）打印该用例轨迹文件路径。"""
    a2a_client.set_current_case(request.node.name)
    yield
    trace_dir = os.environ.get("A2A_TRACE_DIR")
    if trace_dir:
        path = os.path.join(trace_dir, "%s.jsonl" % request.node.name)
        print("[trace] %s -> %s" % (request.node.name, path))


def pytest_configure(config):
    config.addinivalue_line("markers", "a2a: 黑盒 A2A 协议用例")
    config.addinivalue_line("markers", "sse: 流式 SSE 用例")
