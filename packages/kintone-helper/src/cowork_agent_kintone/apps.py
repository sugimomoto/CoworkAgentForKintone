"""kintone のアプリ関連 REST API。

H5 で実装する。スタブとして AppsAPI クラスのみ先に定義 (Client が import するため)。
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .client import Client


class AppsAPI:
    """``client.apps.*`` でアクセスされるアプリ系メソッド集。"""

    def __init__(self, client: Client) -> None:
        self._c = client

    def list(
        self,
        *,
        name: str | None = None,
        space_ids: list[int] | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """アプリ一覧を返す。

        Args:
            name: アプリ名で部分一致検索。
            space_ids: 指定スペース内のアプリのみ返す。
            limit: 1 リクエストの最大取得件数 (kintone 仕様で 100 が上限)。
            offset: 取得開始位置。

        Returns:
            アプリ情報の dict リスト。
        """
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        if name is not None:
            params["name"] = name
        if space_ids:
            params["spaceIds"] = space_ids
        result = self._c._request("GET", "/k/v1/apps.json", params=params)
        apps = result.get("apps", [])
        return list(apps) if isinstance(apps, list) else []

    def get(self, app_id: int) -> dict[str, Any]:
        """単一アプリの基本情報を返す。"""
        return self._c._request("GET", "/k/v1/app.json", params={"id": app_id})

    def get_schema(self, app_id: int) -> dict[str, Any]:
        """アプリのフィールド定義を返す。"""
        return self._c._request("GET", "/k/v1/app/form/fields.json", params={"app": app_id})
