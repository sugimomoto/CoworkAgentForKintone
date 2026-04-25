"""kintone カーソル API のラッパ。

`iter_records` でジェネレータを返し、レコードを 1 件ずつ消費できる。
カーソル削除はベストエフォート (例外時も finally で実施し、削除失敗は握りつぶす)。
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import TYPE_CHECKING, Any

from .errors import KintoneError

if TYPE_CHECKING:
    from .client import Client

_logger = logging.getLogger(__name__)

CURSOR_PAGE_SIZE = 500


def iter_records(
    client: Client,
    app_id: int,
    *,
    query: str | None,
    fields: list[str] | None,
) -> Iterator[dict[str, Any]]:
    """カーソルを使ってレコードを 1 件ずつ yield する。

    Raises:
        KintoneApiError / NetworkError: カーソル作成や fetch で失敗した場合。
            (削除失敗は握りつぶしてログだけ残す。)
    """
    cursor_id = _create_cursor(client, app_id, query=query, fields=fields)
    try:
        while True:
            res = client._request("GET", "/k/v1/records/cursor.json", params={"id": cursor_id})
            records = res.get("records") or []
            yield from records
            if res.get("next") is False or not records:
                return
    finally:
        _delete_cursor_safely(client, cursor_id)


def _create_cursor(
    client: Client,
    app_id: int,
    *,
    query: str | None,
    fields: list[str] | None,
) -> str:
    body: dict[str, Any] = {"app": app_id, "size": CURSOR_PAGE_SIZE}
    if query is not None:
        body["query"] = query
    if fields:
        body["fields"] = fields
    res = client._request("POST", "/k/v1/records/cursor.json", body=body)
    cursor_id = res.get("id")
    if not isinstance(cursor_id, str):
        raise KintoneError(f"unexpected cursor response (id missing): {res!r}")
    return cursor_id


def _delete_cursor_safely(client: Client, cursor_id: str) -> None:
    """ベストエフォートで削除。本処理は既に終わっているため失敗は致命的ではない。"""
    try:
        client._request("DELETE", "/k/v1/records/cursor.json", body={"id": cursor_id})
    except KintoneError as exc:
        _logger.debug("cursor delete failed (ignored): id=%s err=%s", cursor_id, exc)
