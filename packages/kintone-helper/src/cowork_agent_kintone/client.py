"""kintone REST API クライアント本体。

利用例::

    from cowork_agent_kintone import Client

    c = Client()  # 環境変数から認証情報を取得
    apps = c.apps.list()
    for record in c.records.iter_all(app_id=42):
        ...
"""

from __future__ import annotations

import os
from typing import Any

from . import _http
from .apps import AppsAPI
from .auth import Credentials, _normalize_domain
from .errors import ConfigurationError
from .records import RecordsAPI


class Client:
    """kintone への REST 呼出を集約するクライアント。

    認証情報は引数 (個別指定) → 環境変数 (``KINTONE_DOMAIN`` / ``KINTONE_LOGIN`` /
    ``KINTONE_PASSWORD``) の優先順で取得する。引数で個別に渡すと、それ以外の値だけ
    環境変数から補完される。

    Args:
        domain: kintone ドメイン (例: ``"example.cybozu.com"``)。
        login: ログイン名。
        password: パスワード。
        timeout: HTTP タイムアウト秒 (既定 30)。

    Raises:
        ConfigurationError: 認証情報が揃わなかった場合。
    """

    def __init__(
        self,
        *,
        domain: str | None = None,
        login: str | None = None,
        password: str | None = None,
        timeout: int = _http.DEFAULT_TIMEOUT,
    ) -> None:
        self._creds = _resolve_credentials(domain=domain, login=login, password=password)
        self._timeout = timeout

        # サブ API は client を介して HTTP を呼ぶため、相互参照を渡す
        self.apps = AppsAPI(self)
        self.records = RecordsAPI(self)

    @property
    def base_url(self) -> str:
        """``https://<domain>`` 形式のベース URL。"""
        return f"https://{self._creds.domain}"

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """内部用: REST エンドポイントを叩いて JSON を dict で返す。"""
        return _http.request(
            method,
            f"{self.base_url}{path}",
            auth_header=self._creds.basic_auth_header(),
            params=params,
            body=body,
            timeout=self._timeout,
        )


def _resolve_credentials(
    *,
    domain: str | None,
    login: str | None,
    password: str | None,
) -> Credentials:
    """引数優先 → 環境変数の順で認証情報を解決する。"""
    resolved_domain = domain if domain is not None else os.environ.get("KINTONE_DOMAIN")
    resolved_login = login if login is not None else os.environ.get("KINTONE_LOGIN")
    resolved_password = password if password is not None else os.environ.get("KINTONE_PASSWORD")

    missing: list[str] = []
    if not resolved_domain:
        missing.append("KINTONE_DOMAIN / domain 引数")
    if not resolved_login:
        missing.append("KINTONE_LOGIN / login 引数")
    if not resolved_password:
        missing.append("KINTONE_PASSWORD / password 引数")
    if missing:
        raise ConfigurationError(f"認証情報が不足しています: {', '.join(missing)}")

    assert resolved_domain is not None
    assert resolved_login is not None
    assert resolved_password is not None

    return Credentials(
        domain=_normalize_domain(resolved_domain),
        login=resolved_login,
        password=resolved_password,
    )
