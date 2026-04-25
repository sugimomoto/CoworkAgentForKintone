"""共通 pytest fixture。"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
import responses


@pytest.fixture
def mocked_responses() -> Iterator[responses.RequestsMock]:
    """`responses` で HTTP をモック。各テスト終端で確実に呼出回数を検証する。"""
    with responses.RequestsMock() as rsps:
        yield rsps


@pytest.fixture
def env_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    """環境変数で認証情報を提供 (Client() を引数なしで生成可能にする)。"""
    monkeypatch.setenv("KINTONE_DOMAIN", "example.cybozu.com")
    monkeypatch.setenv("KINTONE_LOGIN", "alice")
    monkeypatch.setenv("KINTONE_PASSWORD", "p4ssw0rd")
