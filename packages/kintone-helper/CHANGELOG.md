# Changelog

[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 形式で記録します。

## [Unreleased]

## [0.1.0a3] — 2026-04-26

### Changed
- 配布チャネルを **TestPyPI** に追加。Managed Agents Environment は
  ``--extra-index-url https://test.pypi.org/simple/`` 経由で取得できるようになった。
- GitHub Release への wheel/sdist 添付は引き続き行う。

### Internal
- `build-helper.yml` に `publish-testpypi` job を追加 (tag push 時のみ実行)。

## [0.1.0a2] — 2026-04-25

### Fixed
- GET リクエストに `Content-Type: application/json` を付けていたため、kintone が一部
  エンドポイント (例: `/k/v1/apps.json`) で `CB_IL02` を返していた問題を修正。
  body を送る場合のみ `Content-Type` を付与するようにした。
- 実 kintone 環境でのスモーク検証で動作確認済 (apps.list / apps.get / apps.get_schema /
  records.get / records.iter_all すべて正常応答)。

## [0.1.0a1] — 2026-04-25

### Added
- 初版 (Phase 1b-1)
- `Client` クラス (環境変数 / 引数からの認証情報取得)
- 例外階層: `KintoneError` / `ConfigurationError` / `KintoneApiError` / `NetworkError` / `CursorError`
- HTTP 共通層 (`_http`): タイムアウト 30s、5xx 指数バックオフ最大 3 回、4xx の `KintoneApiError` 変換
- `client.apps.list` / `apps.get` / `apps.get_schema`
- `client.records.get` / `records.iter_all` (cursor 自動利用、10,000 件超対応)
- Python 3.11 / 3.12 / 3.13 サポート

### スコープ外 (今後の Phase で対応)
- `add_records` / `update_records` / `delete_records` / `bulk_request` (Phase 1c)
- フォームレイアウト取得 / ファイル / コメント / プロセス管理 (将来 Phase)
