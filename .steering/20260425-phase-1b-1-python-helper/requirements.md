# Phase 1b-1 — kintone ヘルパーライブラリ (読取版) 要求定義

## 背景

Managed Agents の Custom Tool は **Environment コンテナ内で実行される** のではなく、ホスト側 (= 本プラグイン JS) で実行される仕組み。
バックグラウンドで kintone 操作を行うため、Environment に **Python ヘルパーライブラリ** をプリインストールし、Agent が `agent_toolset_20260401` の `bash` + `read` + `write` を使ってスクリプトを組み立てて呼び出す構成を採る (元 functional-design.md §6 の方針)。

Phase 1b-1 はそのヘルパーライブラリの **読取系 API のみ** を実装する。
書込・一括操作は Phase 1c で追加する。

## 公開方針

- 当面は **GitHub Release のみ** (PyPI には公開しない)
  - Environment 構築時の `pip install` は Git URL もしくは Release zip から行う
  - Phase 1d 終了時 (1.0 安定版) に PyPI 公開を検討
- Python サポート: **3.11+**
- パッケージ名: `cowork-agent-kintone` (リポジトリ内のディレクトリ: `packages/kintone-helper/`)
- インポート名: `cowork_agent_kintone`

## 受け入れ条件

### AC-1: パッケージ初期化
- `packages/kintone-helper/pyproject.toml` で `hatchling` ベースのビルド設定が成立
- `cowork_agent_kintone` パッケージが pip からインストール可能
- 依存ライブラリは最小限 (`requests` のみ。標準ライブラリで賄える部分はそれで)

### AC-2: 認証
- `Client()` 引数なしで生成すると、環境変数 `KINTONE_DOMAIN` / `KINTONE_LOGIN` / `KINTONE_PASSWORD` から認証情報を取得
- いずれかが未設定なら `ConfigurationError` を送出
- `Client(domain=..., login=..., password=...)` で明示的に渡すこともできる
- Basic 認証ヘッダ (`X-Cybozu-Authorization: base64(login:password)`) を組み立てる

### AC-3: HTTP 層
- すべての kintone REST 呼出は単一の `_http.py` ヘルパー経由
- タイムアウトは既定 30 秒、最大 300 秒
- 4xx は `KintoneApiError` (kintone レスポンスの `code` / `message` / `id` 保持) として送出
- 5xx は最大 3 回まで指数バックオフでリトライ後失敗

### AC-4: 読取 API (Phase 1b-1 対象)

| API | シグネチャ | 戻り値 |
|---|---|---|
| `client.apps.list(name=..., space_ids=..., limit=100)` | name 部分一致, space で絞込 | `list[App]` |
| `client.apps.get(app_id)` | 単一アプリ | `App` |
| `client.apps.get_schema(app_id)` | フィールド情報 | `dict` (`properties`) |
| `client.records.get(app_id, query=None, fields=None, total_count=False)` | 1 ページ取得 (kintone 既定 100 件) | `dict` (`records`, `totalCount`) |
| `client.records.iter_all(app_id, query=None, fields=None)` | カーソル使用、ジェネレータ | `Iterator[dict]` |

### AC-5: カーソル
- 10,000 件超の取得は内部で **カーソル API** に切替えて自動で全件返す
- `iter_all` はジェネレータで返し、メモリ消費を最小化
- カーソル取得失敗 / トークン切れの場合は `CursorError` で送出
- 内部実装でカーソルは作成 → fetch ループ → 必ず `finally` で削除する

### AC-6: 例外階層
- `KintoneError` (基底)
  - `ConfigurationError` (環境変数欠落、引数不整合)
  - `KintoneApiError` (kintone REST が返したエラー。`code`, `message`, `id`, `status` を保持)
  - `CursorError` (カーソル特有)
  - `NetworkError` (タイムアウト・接続失敗・5xx 連続失敗)

### AC-7: 型ヒント
- すべての公開 API は型ヒント付き (`mypy --strict` が通る)
- `__init__.py` で公開シンボルを `__all__` に記載

### AC-8: テスト
- すべての公開 API に対して **単体テスト** (`responses` ライブラリで HTTP 応答をモック)
- カーソル / リトライ / エラー変換は境界値テスト (0/100/500/10,000/10,001 件、4xx/5xx)
- カバレッジ: モジュール単位で 80%+
- `pytest` 1 コマンドで全テスト緑

### AC-9: Lint / Format
- `ruff` でフォーマット + lint (`ruff check` / `ruff format`)
- `mypy --strict` 通過
- pre-commit / lefthook で差分のみチェック

### AC-10: ビルドと配布
- `hatch build` で wheel + sdist を生成
- `hatchling` の dynamic version を使ってタグ (`helper-vX.Y.Z`) と同期
- GitHub Actions で `helper-v*` タグ push 時に Release に wheel + sdist を添付
- `dependency-groups` (PEP 735) は **使わず** `[project.optional-dependencies]` の `dev` で開発依存を表現

### AC-11: ドキュメント
- `packages/kintone-helper/README.md` に最小限の Quick Start
- 各公開 API に Google スタイル docstring
- CHANGELOG.md (Keep a Changelog 形式) を初期化

## 非機能要件

- NFR-1: 標準ライブラリ + `requests` だけで成立すること
- NFR-2: 1,000 件取得が 5 秒以内 (実測ではなく単位テスト中の許容モック応答時間ベース)
- NFR-3: ネットワーク不安定時の挙動が決定論的 (リトライ回数固定 / `NetworkError` で必ず終端)
- NFR-4: ログは標準 `logging` モジュール経由 (進捗報告などは Phase 1b-3 で `print(f"Progress: i/n")` を別途追加するが、本 Phase ではまだ不要)

## 想定するユーザーストーリー

> Agent が Environment 内で `pip install cowork-agent-kintone` 済みの状態で `from cowork_agent_kintone import Client; c = Client(); apps = c.apps.list()` を呼び、結果を JSON で返す。Agent が組み立てる Python スクリプトのライブラリとして使われる。

## スコープ外 (Phase 1c 以降)
- `add_records` / `update_records` / `delete_records`
- `bulk_request`
- 部分成功レポート機構 (処理済 ID 報告)
- Progress 標準出力の整備 (Phase 1b-3 で agent system prompt と合わせて統合)
- フォームレイアウト取得 (画面位置情報。alpha では用途が薄い)
- ファイル添付 / コメント / プロセス管理 / アクセス権 / プラグイン管理 API
- API トークン認証 (現状 Basic 認証のみ)
- 並列実行 / async 対応
- WebSocket / SSE
- 多言語対応 (エラーメッセージは英語のみで OK)

## 依存・前提
- リポジトリ: 既存モノレポの `packages/kintone-helper/` 配下に配置
- 既存 TypeScript 側 (`packages/plugin/`) からの参照は **Phase 1b-2** で行う (本 Phase では関与しない)
- CI: 既存の `.github/workflows/build-plugin.yml` には影響を与えず、新規 `build-helper.yml` を追加

## 影響範囲
- 新規: `packages/kintone-helper/` 一式 (pyproject.toml / src / tests / README / CHANGELOG / LICENSE)
- 新規: `.github/workflows/build-helper.yml` (Lint + 型 + テスト + tag push 時の Release 添付)
- 既存変更: ルート `pnpm-workspace.yaml` は Python 側を含めないが、ルート `package.json` の docs/CI 整備で言及する程度
- 元 Phase 1a tasklist は **変更しない** (履歴として残す)
