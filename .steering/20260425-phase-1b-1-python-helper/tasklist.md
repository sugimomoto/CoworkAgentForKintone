# Phase 1b-1 — kintone ヘルパーライブラリ (読取版) タスクリスト

要件: [requirements.md](./requirements.md)
設計: [design.md](./design.md)

凡例: 🟥 失敗するテスト先行 / 🟩 実装 / 🔵 リファクタ / ⬜ 設定・ドキュメント

## H0. パッケージ初期化

- [ ] ⬜ `packages/kintone-helper/pyproject.toml` (hatchling + dynamic version + dev deps + ruff/mypy/pytest 設定)
- [ ] ⬜ `packages/kintone-helper/src/cowork_agent_kintone/__init__.py` (空 + `__version__ = "0.1.0a1"`)
- [ ] ⬜ `packages/kintone-helper/src/cowork_agent_kintone/py.typed` (空ファイル)
- [ ] ⬜ `packages/kintone-helper/tests/__init__.py` + `conftest.py` (responses 統合)
- [ ] ⬜ `packages/kintone-helper/README.md` skeleton
- [ ] ⬜ `packages/kintone-helper/CHANGELOG.md` (Keep a Changelog 形式、未リリース節)
- [ ] ⬜ `packages/kintone-helper/LICENSE` (MIT)
- [ ] ⬜ `pip install -e .[dev]` が通る

## H1. 例外階層

- [ ] 🟥 `tests/test_errors.py` — 5 例外クラスの基底関係 / KintoneApiError の code/message/id/status 保持
- [ ] 🟩 `errors.py` 実装

## H2. 認証

- [ ] 🟥 `tests/test_auth.py` — Credentials.basic_auth_header の base64 内容、credentials_from_env の正常系・欠落例外
- [ ] 🟩 `auth.py` 実装

## H3. HTTP 共通

- [ ] 🟥 `tests/test_http.py` — 200 OK で dict 返却
- [ ] 🟥 4xx + body あり → KintoneApiError (code/message/id 抽出)
- [ ] 🟥 4xx + body parse 失敗 → KintoneApiError(default message, status)
- [ ] 🟥 5xx 連続 1 回後に 200 → 成功 (リトライ動作)
- [ ] 🟥 5xx 3 回連続 → NetworkError
- [ ] 🟥 Timeout / ConnectionError → NetworkError (cause チェーン)
- [ ] 🟩 `_http.py` 実装 (Session 使い回し / 指数バックオフ / 例外変換)

## H4. Client

- [ ] 🟥 `tests/test_client.py` — env 完全 → Client() OK
- [ ] 🟥 引数指定が env 優先で上書き
- [ ] 🟥 必須 env 欠落 → ConfigurationError
- [ ] 🟥 Client.apps / Client.records が AppsAPI / RecordsAPI のインスタンス
- [ ] 🟩 `client.py` 実装

## H5. Apps API

- [ ] 🟥 `tests/test_apps.py::list` — 0/1/100 件 / name 部分一致 / space_ids 指定
- [ ] 🟥 `apps.get` 正常 / 404 → KintoneApiError
- [ ] 🟥 `apps.get_schema` 正常 / 404 → KintoneApiError
- [ ] 🟩 `apps.py` 実装

## H6. Cursor

- [ ] 🟥 `tests/test_cursor.py` — _create_cursor のリクエスト body (size/query/fields)
- [ ] 🟥 iter_records: 0 件
- [ ] 🟥 iter_records: 500 件 (1 ページ)
- [ ] 🟥 iter_records: 10,000 件 (20 ページ × 500)
- [ ] 🟥 iter_records: 10,001 件 (21 ページ目に 1 件)
- [ ] 🟥 反復中の例外で finally の DELETE が呼ばれる
- [ ] 🟥 DELETE 失敗 (例: 404) は握りつぶす (KintoneError 派生のみ)
- [ ] 🟩 `cursor.py` 実装

## H7. Records API

- [ ] 🟥 `tests/test_records.py::get` — query / fields / total_count フラグ
- [ ] 🟥 `records.get` 正常 / 400 → KintoneApiError
- [ ] 🟥 `records.iter_all` が cursor.iter_records に委譲してジェネレータを返す
- [ ] 🟥 `records.iter_all` 引数 (query/fields) が cursor 側に正しく渡る
- [ ] 🟩 `records.py` 実装

## H8. パッケージ仕上げ

- [ ] 🟩 `__init__.py` で公開シンボル re-export (`Client` / 例外 5 つ)
- [ ] 🟥 `tests/test_smoke.py` — `from cowork_agent_kintone import Client, KintoneApiError` がエラーなく通る
- [ ] ⬜ `pytest --cov` でカバレッジ 80%+ 確認
- [ ] ⬜ `ruff check` / `ruff format --check` 通過
- [ ] ⬜ `mypy --strict` 通過

## H9. CI

- [ ] ⬜ `.github/workflows/build-helper.yml`
  - matrix: Python 3.11 / 3.12 / 3.13
  - steps: setup-python (cache=pip) → install -e .[dev] → ruff check → ruff format --check → mypy --strict → pytest --cov
  - tag `helper-v*`: hatch build → upload artifact + gh release upload
- [ ] ⬜ 軽微な変更 push で CI が緑になることを確認

## H10. ドキュメント

- [ ] ⬜ `README.md` Quick Start (環境変数 / Client() / apps.list / records.get / records.iter_all)
- [ ] ⬜ `CHANGELOG.md` に `0.1.0a1` の変更内容を記載
- [ ] ⬜ 各公開 API に Google スタイル docstring (実装ステップ内で済ませる)

## H11. リリース

- [ ] ⬜ `helper-v0.1.0a1` タグを切る (commit 後)
- [ ] ⬜ Push tag → CI が build + Release を作成
- [ ] ⬜ Release ページに wheel + sdist が添付されていることを確認

## 完了条件

- requirements.md の AC-1〜11 + NFR-1〜4 が満たされる
- `pytest` 全緑、`ruff`/`mypy` 通過、`pytest-cov` 80%+
- `helper-v0.1.0a1` Release が公開済み
- 既存 Phase 1a tasklist (`.steering/20260425-initial-implementation/`) は変更しない
