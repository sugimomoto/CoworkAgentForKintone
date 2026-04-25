"""kintone REST API への HTTP 呼出共通層。

* 4xx → :class:`KintoneApiError` (レスポンス body の ``code``/``message``/``id`` を抽出)
* 5xx → 指数バックオフで最大 3 回リトライ。最終的に :class:`NetworkError`
* Timeout / ConnectionError → :class:`NetworkError` (``__cause__`` で原因連鎖)

利用側 (:mod:`client`) は ``_http.request`` を呼ぶだけで済むよう設計している。
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import requests

from .errors import KintoneApiError, NetworkError

_logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 30
MAX_RETRIES_5XX = 3
RETRY_BACKOFF_BASE = 1.0  # 秒。指数バックオフ (1, 2, 4)

# requests.Session はモジュールスコープで使い回し、Connection を再利用する。
_SESSION = requests.Session()


def request(
    method: str,
    url: str,
    *,
    auth_header: str,
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """kintone REST 呼出の単一エントリポイント。

    Args:
        method: HTTP メソッド (``GET`` / ``POST`` / ``PUT`` / ``DELETE``)。
        url: 完全な URL (スキーム + ホスト + パス)。
        auth_header: ``X-Cybozu-Authorization`` に乗せる base64 値。
        params: URL クエリパラメータ。リスト値は ``key=v1&key=v2`` 形式で送出される。
        body: JSON ボディ (``Content-Type: application/json`` で送出)。
        timeout: 秒。

    Returns:
        レスポンス JSON を ``dict`` として。204 (No Content) の場合は空 dict。

    Raises:
        KintoneApiError: 4xx を受け取ったとき。
        NetworkError: 5xx 連続失敗 / タイムアウト / 接続失敗。
    """
    # kintone は GET 時に Content-Type ヘッダがあると CB_IL02 で拒否することがあるため、
    # body を送るときだけ Content-Type を付ける。
    headers: dict[str, str] = {"X-Cybozu-Authorization": auth_header}
    if body is not None:
        headers["Content-Type"] = "application/json"

    last_5xx: requests.Response | None = None
    for attempt in range(MAX_RETRIES_5XX + 1):
        try:
            response = _SESSION.request(
                method,
                url,
                params=params,
                data=json.dumps(body) if body is not None else None,
                headers=headers,
                timeout=timeout,
            )
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
            raise NetworkError(f"network error calling {method} {url}: {exc}") from exc

        if 200 <= response.status_code < 300:
            if response.status_code == 204 or not response.content:
                return {}
            return _parse_json(response)

        if 400 <= response.status_code < 500:
            raise _build_api_error(response)

        # 5xx
        last_5xx = response
        if attempt < MAX_RETRIES_5XX:
            backoff = RETRY_BACKOFF_BASE * (2**attempt)
            _logger.warning(
                "kintone 5xx (%s) on attempt %d/%d, retrying after %.1fs",
                response.status_code,
                attempt + 1,
                MAX_RETRIES_5XX,
                backoff,
            )
            time.sleep(backoff)
            continue

    assert last_5xx is not None  # ループを抜けるのは 5xx 連続のみ
    raise NetworkError(f"kintone returned {last_5xx.status_code} after {MAX_RETRIES_5XX} retries")


def _parse_json(response: requests.Response) -> dict[str, Any]:
    try:
        result = response.json()
    except ValueError as exc:
        raise NetworkError(f"failed to parse JSON from {response.url}: {exc}") from exc
    if not isinstance(result, dict):
        raise NetworkError(f"unexpected JSON shape (not dict): {type(result).__name__}")
    return result


def _build_api_error(response: requests.Response) -> KintoneApiError:
    """4xx レスポンスを :class:`KintoneApiError` に変換する。"""
    code: str | None = None
    api_id: str | None = None
    message = f"HTTP {response.status_code}"
    try:
        body = response.json()
    except ValueError:
        body = None

    if isinstance(body, dict):
        code = body.get("code") if isinstance(body.get("code"), str) else None
        api_id = body.get("id") if isinstance(body.get("id"), str) else None
        if isinstance(body.get("message"), str):
            message = body["message"]

    return KintoneApiError(
        message,
        code=code,
        api_id=api_id,
        status=response.status_code,
    )
