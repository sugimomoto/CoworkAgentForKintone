"""認証ヘッダ生成と環境変数読込のテスト。"""

from __future__ import annotations

from base64 import b64decode

import pytest

from cowork_agent_kintone.auth import Credentials, credentials_from_env
from cowork_agent_kintone.errors import ConfigurationError


class TestCredentials:
    def test_basic_auth_header_is_base64_login_password(self) -> None:
        creds = Credentials(domain="example.cybozu.com", login="alice", password="p4ss")
        token = creds.basic_auth_header()
        assert b64decode(token).decode() == "alice:p4ss"

    def test_is_frozen_dataclass(self) -> None:
        from dataclasses import FrozenInstanceError

        creds = Credentials(domain="x", login="y", password="z")
        with pytest.raises(FrozenInstanceError):
            creds.domain = "other"  # type: ignore[misc]


class TestCredentialsFromEnv:
    def test_reads_all_three_env_vars(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("KINTONE_DOMAIN", "test.cybozu.com")
        monkeypatch.setenv("KINTONE_LOGIN", "bob")
        monkeypatch.setenv("KINTONE_PASSWORD", "secret")

        creds = credentials_from_env()

        assert creds.domain == "test.cybozu.com"
        assert creds.login == "bob"
        assert creds.password == "secret"

    def test_missing_domain_raises_configuration_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("KINTONE_DOMAIN", raising=False)
        monkeypatch.setenv("KINTONE_LOGIN", "bob")
        monkeypatch.setenv("KINTONE_PASSWORD", "secret")

        with pytest.raises(ConfigurationError, match="KINTONE_DOMAIN"):
            credentials_from_env()

    def test_missing_login_raises_configuration_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("KINTONE_DOMAIN", "x.cybozu.com")
        monkeypatch.delenv("KINTONE_LOGIN", raising=False)
        monkeypatch.setenv("KINTONE_PASSWORD", "secret")

        with pytest.raises(ConfigurationError, match="KINTONE_LOGIN"):
            credentials_from_env()

    def test_missing_password_raises_configuration_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("KINTONE_DOMAIN", "x.cybozu.com")
        monkeypatch.setenv("KINTONE_LOGIN", "bob")
        monkeypatch.delenv("KINTONE_PASSWORD", raising=False)

        with pytest.raises(ConfigurationError, match="KINTONE_PASSWORD"):
            credentials_from_env()

    def test_strips_https_prefix_from_domain(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # ユーザーが誤って https:// 付きで設定しても受け入れる
        monkeypatch.setenv("KINTONE_DOMAIN", "https://x.cybozu.com")
        monkeypatch.setenv("KINTONE_LOGIN", "bob")
        monkeypatch.setenv("KINTONE_PASSWORD", "secret")

        creds = credentials_from_env()

        assert creds.domain == "x.cybozu.com"
