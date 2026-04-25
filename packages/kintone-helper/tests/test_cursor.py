"""カーソル制御のテスト。"""

from __future__ import annotations

import json
from typing import Any

import pytest
import responses

from cowork_agent_kintone import cursor
from cowork_agent_kintone.client import Client
from cowork_agent_kintone.errors import KintoneApiError, KintoneError

CURSOR_URL = "https://example.cybozu.com/k/v1/records/cursor.json"


@pytest.fixture
def client(env_credentials: None) -> Client:
    return Client()


def _add_create_cursor_response(rsps: responses.RequestsMock, *, cursor_id: str = "c1") -> None:
    rsps.add(responses.POST, CURSOR_URL, json={"id": cursor_id, "totalCount": "0"}, status=201)


def _add_fetch_pages(
    rsps: responses.RequestsMock,
    pages: list[list[dict[str, Any]]],
    *,
    final_next_false: bool = True,
) -> None:
    for i, page in enumerate(pages):
        is_last = i == len(pages) - 1
        rsps.add(
            responses.GET,
            CURSOR_URL,
            json={"records": page, "next": not (is_last and final_next_false)},
            status=200,
        )


def _add_delete_cursor(rsps: responses.RequestsMock, *, status: int = 200) -> None:
    rsps.add(responses.DELETE, CURSOR_URL, json={}, status=status)


class TestCreateCursor:
    def test_request_body_includes_app_size_query_fields(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        _add_create_cursor_response(mocked_responses)
        _add_fetch_pages(mocked_responses, [[]])
        _add_delete_cursor(mocked_responses)

        list(cursor.iter_records(client, 42, query='status = "open"', fields=["title"]))

        body = json.loads(mocked_responses.calls[0].request.body or "{}")
        assert body == {
            "app": 42,
            "size": cursor.CURSOR_PAGE_SIZE,
            "query": 'status = "open"',
            "fields": ["title"],
        }


class TestIterRecords:
    def test_zero_records(self, client: Client, mocked_responses: responses.RequestsMock) -> None:
        _add_create_cursor_response(mocked_responses)
        _add_fetch_pages(mocked_responses, [[]])
        _add_delete_cursor(mocked_responses)

        result = list(cursor.iter_records(client, 1, query=None, fields=None))

        assert result == []

    def test_single_page_500_records(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        page = [{"$id": {"value": str(i)}} for i in range(500)]
        _add_create_cursor_response(mocked_responses)
        _add_fetch_pages(mocked_responses, [page])
        _add_delete_cursor(mocked_responses)

        result = list(cursor.iter_records(client, 1, query=None, fields=None))

        assert len(result) == 500

    def test_10000_records_across_20_pages(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        pages = [[{"$id": {"value": str(p * 500 + i)}} for i in range(500)] for p in range(20)]
        _add_create_cursor_response(mocked_responses)
        _add_fetch_pages(mocked_responses, pages)
        _add_delete_cursor(mocked_responses)

        result = list(cursor.iter_records(client, 1, query=None, fields=None))

        assert len(result) == 10_000
        assert result[0]["$id"]["value"] == "0"
        assert result[-1]["$id"]["value"] == "9999"

    def test_10001_records_across_21_pages(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        pages = [[{"$id": {"value": str(p * 500 + i)}} for i in range(500)] for p in range(20)]
        pages.append([{"$id": {"value": "10000"}}])
        _add_create_cursor_response(mocked_responses)
        _add_fetch_pages(mocked_responses, pages)
        _add_delete_cursor(mocked_responses)

        result = list(cursor.iter_records(client, 1, query=None, fields=None))

        assert len(result) == 10_001

    def test_exception_during_iteration_still_deletes_cursor(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        _add_create_cursor_response(mocked_responses)
        # 1 ページ目は 1 件返す
        mocked_responses.add(
            responses.GET,
            CURSOR_URL,
            json={"records": [{"$id": {"value": "1"}}], "next": True},
            status=200,
        )
        # 2 ページ目で 500 エラー (永続)
        for _ in range(4):
            mocked_responses.add(responses.GET, CURSOR_URL, status=500)
        _add_delete_cursor(mocked_responses)

        with pytest.raises(KintoneError):
            for _ in cursor.iter_records(client, 1, query=None, fields=None):
                pass

        # DELETE が呼ばれたことを assert
        delete_calls = [c for c in mocked_responses.calls if c.request.method == "DELETE"]
        assert len(delete_calls) == 1


class TestDeleteCursor:
    def test_delete_failure_is_swallowed(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        _add_create_cursor_response(mocked_responses)
        _add_fetch_pages(mocked_responses, [[]])
        # 削除が 404 を返してもジェネレータの呼び出し側に例外を上げない
        mocked_responses.add(
            responses.DELETE,
            CURSOR_URL,
            json={"code": "GAIA_RE01", "message": "not found", "id": "x"},
            status=404,
        )

        # ここで例外が伝播したらテスト失敗
        result = list(cursor.iter_records(client, 1, query=None, fields=None))
        assert result == []


def test_create_cursor_failure_propagates(
    client: Client, mocked_responses: responses.RequestsMock
) -> None:
    """カーソル作成の失敗 (4xx) はそのまま KintoneApiError として伝播する。"""
    mocked_responses.add(
        responses.POST,
        CURSOR_URL,
        json={"code": "GAIA_QU01", "message": "bad query", "id": "x"},
        status=400,
    )

    with pytest.raises(KintoneApiError):
        list(cursor.iter_records(client, 1, query="bad query", fields=None))
