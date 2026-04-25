"""kintone Basic 認証情報の保持と環境変数読込。"""

from __future__ import annotations

import os
from base64 import b64encode
from dataclasses import dataclass

from .errors import ConfigurationError


@dataclass(frozen=True)
class Credentials:
    """kintone への Basic 認証情報。

    Attributes:
        domain: ホスト名のみ (例: ``"example.cybozu.com"``)。スキーム ``https://`` は含めない。
        login: ログイン名。
        password: パスワード。
    """

    domain: str
    login: str
    password: str

    def basic_auth_header(self) -> str:
        """``X-Cybozu-Authorization`` ヘッダ用に base64 エンコード済の値を返す。"""
        return b64encode(f"{self.login}:{self.password}".encode()).decode("ascii")


def credentials_from_env() -> Credentials:
    """環境変数 ``KINTONE_DOMAIN`` / ``KINTONE_LOGIN`` / ``KINTONE_PASSWORD`` から
    認証情報を組み立てる。

    Raises:
        ConfigurationError: いずれかの環境変数が未設定の場合。
    """
    domain = os.environ.get("KINTONE_DOMAIN")
    login = os.environ.get("KINTONE_LOGIN")
    password = os.environ.get("KINTONE_PASSWORD")

    missing = [
        name
        for name, value in (
            ("KINTONE_DOMAIN", domain),
            ("KINTONE_LOGIN", login),
            ("KINTONE_PASSWORD", password),
        )
        if not value
    ]
    if missing:
        raise ConfigurationError(f"環境変数が未設定です: {', '.join(missing)}")

    assert domain is not None
    assert login is not None
    assert password is not None

    return Credentials(
        domain=_normalize_domain(domain),
        login=login,
        password=password,
    )


def _normalize_domain(domain: str) -> str:
    """先頭の ``https://`` / ``http://`` と末尾スラッシュを取り除く。"""
    d = domain.strip()
    for prefix in ("https://", "http://"):
        if d.startswith(prefix):
            d = d[len(prefix) :]
            break
    return d.rstrip("/")
