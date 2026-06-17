# -*- coding: utf-8 -*-
"""pytest fixtures for 黑盒 A2A 用例。"""

import pytest
from a2a_client import A2aClient, base_url_from_env


@pytest.fixture(scope="session")
def base_url() -> str:
    """读取 A2A_BASE_URL（默认 http://localhost:8080）。"""
    return base_url_from_env()


@pytest.fixture
def a2a_client(base_url) -> A2aClient:
    """黑盒 A2A 客户端实例（httpx 惰性导入，无服务时连接失败=env_issue）。"""
    return A2aClient(base_url=base_url)


def pytest_configure(config):
    config.addinivalue_line("markers", "a2a: 黑盒 A2A 协议用例")
    config.addinivalue_line("markers", "sse: 流式 SSE 用例")
