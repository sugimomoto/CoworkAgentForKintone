"""RecordsAPI のテスト (cursor 経由の iter_all 含む)。"""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest
import responses

from cowork_agent_kintone.client import Client
from cowork_agent_kintone.errors import KintoneApiError


@pytest.fixture
def client(env_credentials: None) -> Client:
    return Client()


URL = "https://example.cybozu.com/k/v1/records.json"
CURSOR_URL = "https://example.cybozu.com/k/v1/records/cursor.json"


class TestRecordsGet:
    def test_passes_app_id(self, client: Client, mocked_responses: responses.RequestsMock) -> None:
        mocked_responses.add(responses.GET, URL, json={"records": []}, status=200)

        client.records.get(42)

        qs = parse_qs(urlparse(mocked_responses.calls[0].request.url or "").query)
        assert qs["app"] == ["42"]

    def test_passes_query_and_fields_and_total_count(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        mocked_responses.add(responses.GET, URL, json={"records": []}, status=200)

        client.records.get(
            42,
            query='created_time > "2026-01-01"',
            fields=["title", "owner"],
            total_count=True,
        )

        url = mocked_responses.calls[0].request.url or ""
        qs = parse_qs(urlparse(url).query)
        assert "created_time" in qs["query"][0]
        assert "fields=title" in url and "fields=owner" in url
        assert qs["totalCount"] == ["true"]

    def test_omits_optional_params_when_not_set(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        mocked_responses.add(responses.GET, URL, json={"records": []}, status=200)

        client.records.get(42)

        qs = parse_qs(urlparse(mocked_responses.calls[0].request.url or "").query)
        assert "query" not in qs
        assert "fields" not in qs
        assert "totalCount" not in qs

    def test_400_raises_KintoneApiError(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        mocked_responses.add(
            responses.GET,
            URL,
            json={"code": "GAIA_QU01", "message": "Invalid query", "id": "x"},
            status=400,
        )

        with pytest.raises(KintoneApiError):
            client.records.get(42, query="bogus")


class TestRecordsIterAll:
    def test_delegates_to_cursor_and_yields_records(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        records = [{"$id": {"value": "1"}}, {"$id": {"value": "2"}}]
        mocked_responses.add(responses.POST, CURSOR_URL, json={"id": "c1"}, status=201)
        mocked_responses.add(
            responses.GET, CURSOR_URL, json={"records": records, "next": False}, status=200
        )
        mocked_responses.add(responses.DELETE, CURSOR_URL, json={}, status=200)

        result = list(client.records.iter_all(42))

        assert result == records

    def test_passes_query_and_fields_to_cursor(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        import json

        mocked_responses.add(responses.POST, CURSOR_URL, json={"id": "c1"}, status=201)
        mocked_responses.add(
            responses.GET, CURSOR_URL, json={"records": [], "next": False}, status=200
        )
        mocked_responses.add(responses.DELETE, CURSOR_URL, json={}, status=200)

        list(client.records.iter_all(42, query='x = "y"', fields=["a", "b"]))

        post_body = json.loads(mocked_responses.calls[0].request.body or "{}")
        assert post_body["query"] == 'x = "y"'
        assert post_body["fields"] == ["a", "b"]
