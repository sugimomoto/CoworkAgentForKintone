"""Client クラスのテスト。"""

from __future__ import annotations

import pytest

from cowork_agent_kintone.client import Client
from cowork_agent_kintone.errors import ConfigurationError


def test_env_vars_are_used_when_no_args(env_credentials: None) -> None:
    c = Client()
    assert c.base_url == "https://example.cybozu.com"


def test_explicit_args_override_env(env_credentials: None) -> None:
    c = Client(domain="other.cybozu.com", login="bob", password="pw2")
    assert c.base_url == "https://other.cybozu.com"


def test_missing_env_vars_raise_configuration_error(monkeypatch: pytest.MonkeyPatch) -> None:
    for k in ("KINTONE_DOMAIN", "KINTONE_LOGIN", "KINTONE_PASSWORD"):
        monkeypatch.delenv(k, raising=False)

    with pytest.raises(ConfigurationError):
        Client()


def test_partial_args_fill_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """domain だけ引数で渡すと、login/password は env から取得される。"""
    monkeypatch.delenv("KINTONE_DOMAIN", raising=False)
    monkeypatch.setenv("KINTONE_LOGIN", "bob")
    monkeypatch.setenv("KINTONE_PASSWORD", "pw")

    c = Client(domain="x.cybozu.com")

    assert c.base_url == "https://x.cybozu.com"


def test_partial_args_no_env_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("KINTONE_DOMAIN", raising=False)
    monkeypatch.delenv("KINTONE_LOGIN", raising=False)
    monkeypatch.delenv("KINTONE_PASSWORD", raising=False)

    with pytest.raises(ConfigurationError):
        Client(domain="x.cybozu.com")  # login/password 不足


def test_apps_and_records_are_attached(env_credentials: None) -> None:
    from cowork_agent_kintone.apps import AppsAPI
    from cowork_agent_kintone.records import RecordsAPI

    c = Client()

    assert isinstance(c.apps, AppsAPI)
    assert isinstance(c.records, RecordsAPI)


def test_https_prefix_is_stripped_from_arg_domain(env_credentials: None) -> None:
    c = Client(domain="https://acme.cybozu.com")
    assert c.base_url == "https://acme.cybozu.com"
