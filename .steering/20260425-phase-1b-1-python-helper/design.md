# Phase 1b-1 — kintone ヘルパーライブラリ (読取版) 設計

要件: [requirements.md](./requirements.md)

## 1. パッケージ構造

```
packages/kintone-helper/
├── pyproject.toml
├── README.md
├── CHANGELOG.md
├── LICENSE                       # MIT
├── .python-version               # 3.11 (任意ファイル)
├── src/
│   └── cowork_agent_kintone/
│       ├── __init__.py           # 公開 API の re-export
│       ├── _http.py              # HTTP 共通 (リトライ / 例外変換)
│       ├── auth.py               # Basic 認証ヘッダ生成
│       ├── client.py             # Client クラス本体
│       ├── errors.py             # 例外階層
│       ├── apps.py               # AppsAPI クラス
│       ├── records.py            # RecordsAPI クラス
│       ├── cursor.py             # カーソル制御
│       └── py.typed              # PEP 561 marker (空ファイル)
└── tests/
    ├── conftest.py               # Client の fixture / responses 統合
    ├── test_auth.py
    ├── test_errors.py
    ├── test_http.py
    ├── test_client.py
    ├── test_apps.py
    ├── test_records.py
    └── test_cursor.py
```

`src/` レイアウトを採用 (テスト時にインストール済モジュールを参照させ、ローカル import の取り違えを避ける)。

---

## 2. 公開 API (Inside-Out 順)

### 2.1 例外 (`errors.py`)

```python
class KintoneError(Exception):
    """ヘルパー全体の基底例外"""

class ConfigurationError(KintoneError):
    """環境変数欠落 / 引数不整合"""

class NetworkError(KintoneError):
    """タイムアウト / 接続失敗 / 5xx 連続失敗"""

class KintoneApiError(KintoneError):
    """kintone REST が返した 4xx エラー。code / message / id / status を保持"""
    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        api_id: str | None = None,
        status: int = 0,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.api_id = api_id
        self.status = status

class CursorError(KintoneError):
    """カーソル特有 (作成失敗 / トークン切れ / 取得中の異常)"""
```

### 2.2 認証 (`auth.py`)

```python
@dataclass(frozen=True)
class Credentials:
    domain: str          # 例: "example.cybozu.com" (スキーム除く)
    login: str
    password: str

    def basic_auth_header(self) -> str:
        token = b64encode(f"{self.login}:{self.password}".encode()).decode()
        return token

def credentials_from_env() -> Credentials:
    """環境変数から読込。欠落時は ConfigurationError"""
```

### 2.3 HTTP 層 (`_http.py`)

```python
DEFAULT_TIMEOUT = 30
MAX_RETRIES_5XX = 3
RETRY_BACKOFF_BASE = 1.0  # 秒、指数バックオフ (1, 2, 4)

def request(
    method: str,
    url: str,
    *,
    auth_header: str,
    params: dict | None = None,
    body: dict | None = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict:
    """
    kintone REST 呼出の単一エントリ。
    - 4xx: KintoneApiError 送出 (response body の code/message/id を抽出)
    - 5xx: 最大 3 回まで指数バックオフ。最終失敗で NetworkError 送出
    - timeout / connection error: NetworkError 送出
    - 成功時は JSON を dict として返す
    """
```

実装ポリシー:
- `requests.Session` を使い回す (Connection 再利用)
- `requests.exceptions.Timeout` / `ConnectionError` を `NetworkError` に変換
- 5xx で `time.sleep(BASE * 2 ** attempt)` バックオフ
- ヘッダは `{"Content-Type": "application/json", "X-Cybozu-Authorization": auth_header}` を毎回付与

### 2.4 Client (`client.py`)

```python
class Client:
    def __init__(
        self,
        *,
        domain: str | None = None,
        login: str | None = None,
        password: str | None = None,
        timeout: int = 30,
    ) -> None:
        # 引数指定優先、無ければ環境変数、両方無ければ ConfigurationError
        self._creds = ...
        self._timeout = timeout
        self.apps = AppsAPI(self)        # 注入
        self.records = RecordsAPI(self)

    @property
    def base_url(self) -> str:
        return f"https://{self._creds.domain}"

    def _request(self, method, path, *, params=None, body=None) -> dict:
        return _http.request(
            method,
            f"{self.base_url}{path}",
            auth_header=self._creds.basic_auth_header(),
            params=params,
            body=body,
            timeout=self._timeout,
        )
```

### 2.5 Apps API (`apps.py`)

```python
class AppsAPI:
    def __init__(self, client: Client) -> None:
        self._c = client

    def list(
        self,
        *,
        name: str | None = None,
        space_ids: list[int] | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        params = {"limit": limit, "offset": offset}
        if name is not None:
            params["name"] = name
        if space_ids:
            params["spaceIds"] = space_ids
        return self._c._request("GET", "/k/v1/apps.json", params=params)["apps"]

    def get(self, app_id: int) -> dict:
        return self._c._request("GET", "/k/v1/app.json", params={"id": app_id})

    def get_schema(self, app_id: int) -> dict:
        return self._c._request(
            "GET", "/k/v1/app/form/fields.json", params={"app": app_id}
        )
```

### 2.6 Records API (`records.py`)

```python
class RecordsAPI:
    def __init__(self, client: Client) -> None:
        self._c = client

    def get(
        self,
        app_id: int,
        *,
        query: str | None = None,
        fields: list[str] | None = None,
        total_count: bool = False,
    ) -> dict:
        """1 ページ取得 (最大 500 件; kintone 既定は 100)。"""
        params: dict[str, object] = {"app": app_id}
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
    ) -> Iterator[dict]:
        """
        カーソル使用で全件取得 (10,000 件超対応)。
        メモリ消費を抑えるため Iterator を返す。
        例外時は finally でカーソルを削除する。
        """
        return cursor.iter_records(self._c, app_id, query=query, fields=fields)
```

### 2.7 カーソル (`cursor.py`)

```python
CURSOR_PAGE_SIZE = 500

def iter_records(
    client: Client,
    app_id: int,
    *,
    query: str | None,
    fields: list[str] | None,
) -> Iterator[dict]:
    cursor_id = _create_cursor(client, app_id, query=query, fields=fields)
    try:
        while True:
            res = client._request(
                "GET", "/k/v1/records/cursor.json", params={"id": cursor_id}
            )
            for r in res["records"]:
                yield r
            if res["next"] is False:
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
    body: dict[str, object] = {"app": app_id, "size": CURSOR_PAGE_SIZE}
    if query is not None:
        body["query"] = query
    if fields:
        body["fields"] = fields
    res = client._request("POST", "/k/v1/records/cursor.json", body=body)
    return res["id"]

def _delete_cursor_safely(client: Client, cursor_id: str) -> None:
    """ベストエフォート。削除失敗はログのみで握りつぶす (本処理は既に終わっているため)。"""
    try:
        client._request("DELETE", "/k/v1/records/cursor.json", body={"id": cursor_id})
    except KintoneError:
        # cursor 期限切れなど想定範囲内
        logger.debug("cursor delete failed (ignored): %s", cursor_id)
```

### 2.8 公開シンボル (`__init__.py`)

```python
from .client import Client
from .errors import (
    ConfigurationError,
    CursorError,
    KintoneApiError,
    KintoneError,
    NetworkError,
)

__all__ = [
    "Client",
    "ConfigurationError",
    "CursorError",
    "KintoneApiError",
    "KintoneError",
    "NetworkError",
]

__version__ = "0.1.0a1"  # alpha 1
```

---

## 3. エラー変換マッピング (`_http.py` 内)

| HTTP status | レスポンス body | 送出 |
|---|---|---|
| 200/201/204 | (任意) | dict 返却 |
| 4xx | `{"code", "message", "id"}` あり | `KintoneApiError(message, code=..., api_id=..., status=...)` |
| 4xx | body parse 失敗 | `KintoneApiError(f"HTTP {status}", status=status)` |
| 5xx | (任意) | リトライ → 最終的に `NetworkError` |
| Timeout / ConnectionError | — | `NetworkError(原因チェーン)` |

---

## 4. テスト戦略

### 4.1 ライブラリ
- `pytest` (本体)
- `responses` (HTTP モック)
- `pytest-cov` (カバレッジ)

### 4.2 fixture (`conftest.py`)

```python
@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("KINTONE_DOMAIN", "example.cybozu.com")
    monkeypatch.setenv("KINTONE_LOGIN", "alice")
    monkeypatch.setenv("KINTONE_PASSWORD", "p4ss")
    return Client()

@pytest.fixture
def mocked_responses():
    with responses.RequestsMock() as rsps:
        yield rsps
```

### 4.3 境界値

| API | テストケース |
|---|---|
| `Client()` | 環境変数完全 / 一部欠落 / 引数 vs 環境変数優先順位 / Basic 認証ヘッダ生成内容 |
| `_http.request` | 200 OK / 4xx with body / 4xx without body / 500 でリトライ成功 / 500 連続でリトライ尽きる / Timeout / ConnectionError |
| `apps.list` | 0 件 / 1 件 / 100 件 / name 部分一致 / space_ids 指定 |
| `apps.get` / `apps.get_schema` | 正常 / 404 → KintoneApiError |
| `records.get` | クエリ / fields / totalCount フラグ |
| `records.iter_all` | 0 件 / 100 件 / 500 件 / 10,000 件 / 10,001 件 / カーソル中の例外 → 必ず削除呼出 / カーソル削除失敗は握りつぶす |

### 4.4 mypy strict

- `pytest` テストにも型を付ける
- `Iterator[dict]` などジェネリック表記を最終的に `Iterator[Mapping[str, Any]]` に明示

---

## 5. ビルド・配布

### 5.1 pyproject.toml 概要

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "cowork-agent-kintone"
description = "kintone helper library for Cowork Agent"
readme = "README.md"
license = { text = "MIT" }
requires-python = ">=3.11"
authors = [{ name = "..." }]
keywords = ["kintone", "cybozu", "claude", "agent"]
classifiers = [
  "License :: OSI Approved :: MIT License",
  "Programming Language :: Python :: 3 :: Only",
  "Programming Language :: Python :: 3.11",
  "Programming Language :: Python :: 3.12",
  "Programming Language :: Python :: 3.13",
]
dependencies = ["requests>=2.32"]
dynamic = ["version"]

[project.optional-dependencies]
dev = [
  "pytest>=8",
  "pytest-cov>=5",
  "responses>=0.25",
  "ruff>=0.6",
  "mypy>=1.11",
  "types-requests>=2.32",
]

[tool.hatch.version]
path = "src/cowork_agent_kintone/__init__.py"

[tool.hatch.build.targets.wheel]
packages = ["src/cowork_agent_kintone"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "B", "UP", "SIM", "C4"]

[tool.mypy]
strict = true
python_version = "3.11"

[tool.pytest.ini_options]
addopts = "-ra --strict-markers --cov=cowork_agent_kintone --cov-report=term-missing"
testpaths = ["tests"]
```

### 5.2 GitHub Actions (新規 `build-helper.yml`)

```yaml
name: Build Helper

on:
  pull_request:
    paths: ["packages/kintone-helper/**", ".github/workflows/build-helper.yml"]
  push:
    branches: [main]
    paths: ["packages/kintone-helper/**", ".github/workflows/build-helper.yml"]
    tags: ["helper-v*"]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python: ["3.11", "3.12", "3.13"]
    steps:
      - checkout
      - setup-python with cache
      - pip install -e .[dev]
      - ruff check / ruff format --check
      - mypy --strict
      - pytest --cov

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - checkout
      - setup-python 3.11
      - pip install hatch
      - hatch build
      - upload-artifact (wheel + sdist)
      - on tag helper-v*: gh release upload (wheel + sdist)
```

### 5.3 リリースタグ規約
- `helper-v0.1.0a1` (alpha 1)
- `helper-v0.1.0` (1.0 安定版、Phase 1d 終了時)
- 既存 `plugin-v*` とは独立した名前空間

---

## 6. 段階的な実装順序 (Inside-Out TDD)

1. **errors** — 例外階層 + 5 件のテスト
2. **auth** — Credentials / from_env / Basic 認証ヘッダ + 3 件のテスト
3. **_http** — 200 / 4xx / 5xx リトライ / Timeout の 6 件のテスト
4. **client** — 環境変数読込・引数優先・apps/records の注入 + 3 件のテスト
5. **apps** — list / get / get_schema + 5 件のテスト
6. **cursor** — _create_cursor / _delete_cursor / iter_records + 6 件のテスト (境界値含む)
7. **records** — get / iter_all (cursor 経由) + 4 件のテスト
8. **__init__ + py.typed + version export** — import smoke test 1 件
9. **README / CHANGELOG / LICENSE 整備**
10. **CI (build-helper.yml)** — Lint + 型 + テスト + tag リリース
11. **動作確認**: ローカルで `pip install -e .` + 実 kintone (オプション) でスモーク

各ステップで失敗するテスト先行 (Red) → 実装 (Green) → 必要なら refactor。

---

## 7. ロギング方針

- `logging.getLogger("cowork_agent_kintone")` で全モジュール共通
- ライブラリ側で `addHandler` はしない (利用側で構成)
- DEBUG レベル: HTTP 呼出・リトライ・カーソル削除失敗
- WARNING レベル: 5xx リトライ中
- Phase 1b-3 で Agent が `print(f"Progress: i/n")` 形式で標準出力に進捗を出すフックを追加する予定だが、本 Phase ではまだ載せない (records.iter_all は Iterator なので、利用側で進捗表示しやすい設計になっている)

---

## 8. リスク・未確定事項

| リスク | 対応 |
|---|---|
| `requests` の TLS / プロキシ環境差 | 当面はデフォルト挙動。`HTTPS_PROXY` 環境変数尊重で開発側に任せる |
| 大量取得時の rate limit | kintone は 1 アプリ 100 req/min。3 回バックオフで足りる範囲想定。Phase 1c 書込で再評価 |
| カーソル数上限 (アプリ単位 10 件) | 同時実行 1 本前提のためアラート不要。並列化対応は 1c 以降 |
| Python 3.13 サポート | matrix CI で確認。requests 2.32 が 3.13 対応済 |
