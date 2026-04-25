"""kintone のレコード関連 REST API。

H7 で実装する。スタブとして RecordsAPI クラスのみ先に定義 (Client が import するため)。
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import TYPE_CHECKING, Any

from . import cursor

if TYPE_CHECKING:
    from .client import Client


class RecordsAPI:
    """``client.records.*`` でアクセスされるレコード系メソッド集。"""

    def __init__(self, client: Client) -> None:
        self._c = client

    def get(
        self,
        app_id: int,
        *,
        query: str | None = None,
        fields: list[str] | None = None,
        total_count: bool = False,
    ) -> dict[str, Any]:
        """1 ページ取得 (kintone 既定 100 件、最大 500 件)。

        10,000 件超の取得には :meth:`iter_all` を使う。

        Args:
            app_id: 対象アプリ ID。
            query: kintone クエリ式。
            fields: 取得対象フィールドコードのリスト。
            total_count: ``totalCount`` を含めて返すかどうか。

        Returns:
            ``{"records": [...], "totalCount": "N" | None}`` 形式の dict。
        """
        params: dict[str, Any] = {"app": app_id}
        if query is not None:
            params["query"] = query
        if fields:
            params["fields"] = fields
        if total_count:
            params["totalCount"] = "true"
        return self._c._request("GET", "/k/v1/records.json", params=params)

    def iter_all(
        self,
        app_id: int,
        *,
        query: str | None = None,
        fields: list[str] | None = None,
    ) -> Iterator[dict[str, Any]]:
        """カーソルを使った全件取得 (10,000 件超対応)。

        ジェネレータを返すため、レコードを 1 件ずつ消費できる。
        例外発生時もカーソルは finally で必ず削除される。

        Args:
            app_id: 対象アプリ ID。
            query: kintone クエリ式。
            fields: 取得対象フィールドコードのリスト。

        Yields:
            個別レコード dict。
        """
        return cursor.iter_records(self._c, app_id, query=query, fields=fields)
