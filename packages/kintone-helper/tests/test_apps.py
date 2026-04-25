"""AppsAPI のテスト。"""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest
import responses

from cowork_agent_kintone.client import Client
from cowork_agent_kintone.errors import KintoneApiError


@pytest.fixture
def client(env_credentials: None) -> Client:
    return Client()


class TestAppsList:
    URL = "https://example.cybozu.com/k/v1/apps.json"

    def test_returns_empty_list(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        mocked_responses.add(responses.GET, self.URL, json={"apps": []}, status=200)

        assert client.apps.list() == []

    def test_returns_populated_list(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        apps = [{"appId": "1", "name": "営業案件"}, {"appId": "2", "name": "顧客"}]
        mocked_responses.add(responses.GET, self.URL, json={"apps": apps}, status=200)

        assert client.apps.list() == apps

    def test_default_params_include_limit_and_offset(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        mocked_responses.add(responses.GET, self.URL, json={"apps": []}, status=200)

        client.apps.list()

        url = mocked_responses.calls[0].request.url
        assert url is not None
        qs = parse_qs(urlparse(url).query)
        assert qs["limit"] == ["100"]
        assert qs["offset"] == ["0"]

    def test_name_filter_is_passed(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        mocked_responses.add(responses.GET, self.URL, json={"apps": []}, status=200)

        client.apps.list(name="顧客")

        qs = parse_qs(urlparse(mocked_responses.calls[0].request.url or "").query)
        assert qs["name"] == ["顧客"]

    def test_space_ids_passed_as_repeating_param(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        mocked_responses.add(responses.GET, self.URL, json={"apps": []}, status=200)

        client.apps.list(space_ids=[10, 20])

        url = mocked_responses.calls[0].request.url or ""
        assert "spaceIds=10" in url and "spaceIds=20" in url


class TestAppsGet:
    URL = "https://example.cybozu.com/k/v1/app.json"

    def test_returns_single_app(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        app = {"appId": "42", "name": "テスト"}
        mocked_responses.add(responses.GET, self.URL, json=app, status=200)

        assert client.apps.get(42) == app

    def test_404_raises_KintoneApiError(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        mocked_responses.add(
            responses.GET,
            self.URL,
            json={"code": "GAIA_AP01", "message": "not found", "id": "x"},
            status=404,
        )

        with pytest.raises(KintoneApiError) as exc_info:
            client.apps.get(99999)

        assert exc_info.value.code == "GAIA_AP01"


class TestAppsGetSchema:
    URL = "https://example.cybozu.com/k/v1/app/form/fields.json"

    def test_returns_properties(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        body = {
            "properties": {
                "title": {"type": "SINGLE_LINE_TEXT", "code": "title", "label": "タイトル"}
            },
            "revision": "5",
        }
        mocked_responses.add(responses.GET, self.URL, json=body, status=200)

        result = client.apps.get_schema(42)

        assert result == body
        qs = parse_qs(urlparse(mocked_responses.calls[0].request.url or "").query)
        assert qs["app"] == ["42"]

    def test_403_raises_KintoneApiError(
        self, client: Client, mocked_responses: responses.RequestsMock
    ) -> None:
        mocked_responses.add(
            responses.GET,
            self.URL,
            json={"code": "GAIA_NO01", "message": "no permission", "id": "y"},
            status=403,
        )

        with pytest.raises(KintoneApiError) as exc_info:
            client.apps.get_schema(42)

        assert exc_info.value.status == 403
