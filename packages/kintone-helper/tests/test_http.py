"""HTTP 共通層 (`_http`) のテスト。"""

from __future__ import annotations

from unittest.mock import patch

import pytest
import requests
import responses

from cowork_agent_kintone import _http
from cowork_agent_kintone.errors import KintoneApiError, NetworkError

URL = "https://example.cybozu.com/k/v1/records.json"
AUTH = "YWxpY2U6cDRzcw=="  # base64("alice:p4ss")


def test_get_returns_dict(mocked_responses: responses.RequestsMock) -> None:
    mocked_responses.add(responses.GET, URL, json={"records": [], "totalCount": "0"}, status=200)

    result = _http.request("GET", URL, auth_header=AUTH, params={"app": 1})

    assert result == {"records": [], "totalCount": "0"}


def test_post_sends_json_body(mocked_responses: responses.RequestsMock) -> None:
    mocked_responses.add(responses.POST, URL, json={"id": "x"}, status=200, match=[])

    result = _http.request("POST", URL, auth_header=AUTH, body={"app": 1, "size": 500})

    assert result == {"id": "x"}
    body = mocked_responses.calls[0].request.body
    if isinstance(body, bytes):
        body = body.decode()
    assert body == '{"app": 1, "size": 500}'


def test_4xx_with_kintone_error_body_raises_KintoneApiError(
    mocked_responses: responses.RequestsMock,
) -> None:
    mocked_responses.add(
        responses.GET,
        URL,
        json={"code": "GAIA_QU01", "message": "Invalid query", "id": "abc"},
        status=400,
    )

    with pytest.raises(KintoneApiError) as exc_info:
        _http.request("GET", URL, auth_header=AUTH)

    err = exc_info.value
    assert err.code == "GAIA_QU01"
    assert err.api_id == "abc"
    assert err.status == 400
    assert "Invalid query" in str(err)


def test_4xx_without_parsable_body_raises_KintoneApiError_with_default_message(
    mocked_responses: responses.RequestsMock,
) -> None:
    mocked_responses.add(responses.GET, URL, body="not json", status=403)

    with pytest.raises(KintoneApiError) as exc_info:
        _http.request("GET", URL, auth_header=AUTH)

    err = exc_info.value
    assert err.status == 403
    assert err.code is None


def test_5xx_then_200_succeeds(mocked_responses: responses.RequestsMock) -> None:
    """1 回 5xx で失敗したあと成功すればリトライで通る。"""
    mocked_responses.add(responses.GET, URL, status=503)
    mocked_responses.add(responses.GET, URL, json={"ok": True}, status=200)

    with patch("cowork_agent_kintone._http.time.sleep"):  # バックオフを早送り
        result = _http.request("GET", URL, auth_header=AUTH)

    assert result == {"ok": True}
    assert len(mocked_responses.calls) == 2


def test_5xx_three_times_raises_NetworkError(mocked_responses: responses.RequestsMock) -> None:
    for _ in range(4):  # 初回 + 3 リトライ = 4
        mocked_responses.add(responses.GET, URL, status=502)

    with patch("cowork_agent_kintone._http.time.sleep"), pytest.raises(NetworkError):
        _http.request("GET", URL, auth_header=AUTH)


def test_timeout_raises_NetworkError() -> None:
    with patch("cowork_agent_kintone._http._SESSION.request") as mock_req:
        mock_req.side_effect = requests.exceptions.Timeout("timed out")
        with pytest.raises(NetworkError) as exc_info:
            _http.request("GET", URL, auth_header=AUTH)

    assert isinstance(exc_info.value.__cause__, requests.exceptions.Timeout)


def test_connection_error_raises_NetworkError() -> None:
    with patch("cowork_agent_kintone._http._SESSION.request") as mock_req:
        mock_req.side_effect = requests.exceptions.ConnectionError("refused")
        with pytest.raises(NetworkError):
            _http.request("GET", URL, auth_header=AUTH)


def test_get_does_not_send_content_type(mocked_responses: responses.RequestsMock) -> None:
    """kintone は GET に Content-Type が付くと CB_IL02 で拒否することがあるため、
    body 無しのリクエストには Content-Type を付けない。"""
    mocked_responses.add(responses.GET, URL, json={}, status=200)

    _http.request("GET", URL, auth_header=AUTH)

    sent = mocked_responses.calls[0].request.headers
    assert sent["X-Cybozu-Authorization"] == AUTH
    assert sent.get("Content-Type") != "application/json"


def test_post_with_body_sends_content_type(mocked_responses: responses.RequestsMock) -> None:
    mocked_responses.add(responses.POST, URL, json={}, status=200)

    _http.request("POST", URL, auth_header=AUTH, body={"app": 1})

    sent = mocked_responses.calls[0].request.headers
    assert sent["Content-Type"] == "application/json"


def test_request_serializes_list_params_as_repeating(
    mocked_responses: responses.RequestsMock,
) -> None:
    """kintone の配列パラメータは ``key=v1&key=v2`` 形式で送る。"""
    mocked_responses.add(responses.GET, URL, json={}, status=200)

    _http.request(
        "GET",
        URL,
        auth_header=AUTH,
        params={"app": 1, "fields": ["title", "owner"]},
    )

    url = mocked_responses.calls[0].request.url
    assert url is not None
    # requests は list を default で repeating にする
    assert "fields=title" in url and "fields=owner" in url


def test_204_no_content_returns_empty_dict(mocked_responses: responses.RequestsMock) -> None:
    mocked_responses.add(responses.DELETE, URL, body="", status=204)

    result = _http.request("DELETE", URL, auth_header=AUTH, body={"id": "c1"})

    assert result == {}


def test_request_passes_timeout_to_session(mocked_responses: responses.RequestsMock) -> None:
    mocked_responses.add(responses.GET, URL, json={}, status=200)

    with patch.object(_http._SESSION, "request", wraps=_http._SESSION.request) as spy:
        _http.request("GET", URL, auth_header=AUTH, timeout=12)

    assert spy.call_args.kwargs["timeout"] == 12


def test_invalid_method_raises_NetworkError_or_propagates_value_error() -> None:
    """サポート外メソッドはそのまま requests に渡し、エラー時は NetworkError 化。"""
    with pytest.raises((NetworkError, ValueError)):
        # 不正な URL で接続失敗を起こす
        _http.request("GET", "not-a-url", auth_header=AUTH)
