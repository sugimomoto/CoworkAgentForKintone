# 技術仕様書 (Architecture Document)

**プロダクト名**: Cowork Agent for kintone
**バージョン**: 0.1 (MVP ドラフト)
**最終更新日**: 2026-04-22

---

## 1. 技術スタック概要

本プロダクトは **2 つの独立したコードベース** で構成される。

| コンポーネント | 言語 | 配布形態 |
|---------------|------|---------|
| **kintone プラグイン本体** (ブラウザ側) | TypeScript + HTML/CSS | `.zip` (kintone プラグイン形式) |
| **kintone ヘルパーライブラリ** (Environment 側) | Python | pip パッケージ (PyPI) |

---

## 2. kintone プラグイン (ブラウザ側)

### 2.1 言語・フレームワーク

| 項目 | 採用技術 | 理由 |
|------|---------|------|
| 言語 | **TypeScript 5.x** | 型安全、エディタ補完、OSS コントリビューション時の可読性 |
| UI フレームワーク | **React 18** | チャット UI の状態管理に適する、エコシステム豊富 |
| 状態管理 | **Zustand** | 軽量で学習コスト低。Redux/Recoil は過剰 |
| スタイリング | **Tailwind CSS 3.x** | kintone デザインと衝突しないユーティリティクラス方式 |
| バンドラ | **Vite 5.x** | ビルド速度、kintone 向け成果物作成との相性 |
| テスト | **Vitest** + **Testing Library** | Vite エコシステム連携 |
| Lint/Format | **ESLint** + **Prettier** | kintone JS SDK の推奨設定を採用 |

### 2.2 kintone 関連ライブラリ

| ライブラリ | 用途 |
|-----------|------|
| `@kintone/rest-api-client` | 初期設定・接続テスト時の kintone API 呼出 (ブラウザ側) |
| `@kintone/plugin-packer` | プラグイン zip 化 |
| `@kintone/create-plugin` | プラグイン雛形生成 (開発環境初期化時のみ) |
| `@kintone/dts-gen` | (任意) フィールド型生成 |
| `cli-kintone` | プラグインアップロード・鍵管理 |

### 2.3 Managed Agents 連携ライブラリ

- **自作の薄いクライアントを同梱**: 公式 `@anthropic-ai/sdk` は Node.js 前提のため、ブラウザから `kintone.plugin.app.proxy` 経由で呼ぶ軽量 HTTP クライアントを TypeScript で実装
- **主要ヘルパー**:
  - Agent / Environment / Vault の metadata 検索
  - Session 作成、イベント POST (`user.message`, `user.custom_tool_result`)
  - イベント **ポーリング** (`GET /v1/sessions/{id}/events?since=<cursor>`)

### 2.4 プラグイン構造

```
plugin/
├── manifest.json          # プラグイン定義 (CSP / Proxy 設定含む)
├── html/
│   └── config.html        # プラグイン設定画面
├── js/
│   ├── desktop.js         # レコード一覧画面にチャット UI を描画
│   ├── config.js          # 設定画面ロジック
│   └── mobile.js          # (Phase2) モバイル対応
├── css/
│   └── desktop.css
└── image/
    └── icon.png
```

### 2.5 kintone プラグイン特有の制約

| 制約 | 影響 | 対応 |
|------|------|------|
| `manifest.json` の `external` で外部通信先を宣言 | Anthropic API は Proxy 設定経由なので **ブラウザ側 CSP 登録は不要** | — |
| プラグイン zip 合計 30 MB 以内 | バンドルサイズ制限 | Vite で最適化、動的 import を活用 |
| 設定画面は別 HTML ファイル | SPA ではなく独立画面 | React を設定画面でも利用 |
| プラグイン間通信なし | 他プラグインとの連携は想定外 | — |

---

## 3. kintone ヘルパーライブラリ (Environment 側)

### 3.1 言語・配布

| 項目 | 採用技術 |
|------|---------|
| 言語 | **Python 3.11+** |
| ライブラリ名 | `cowork-agent-kintone` (pip) |
| HTTP クライアント | **`requests`** (標準的で Environment にプリインストール可能) |
| 配布 | PyPI + GitHub Releases |
| パッケージング | **`hatchling`** (シンプル、PEP 517 対応) |
| Lint | **Ruff** |
| 型チェック | **mypy** |
| テスト | **pytest** + `responses` (HTTP モック) |

### 3.2 ライブラリ依存関係

- 最小依存: `requests` のみ (Environment のプリインストール負荷を最小化)
- 将来的に非同期版を追加検討時は `httpx` / `aiohttp`

### 3.3 Python バージョン

- Managed Agents Environment の Python デフォルトランタイム (3.11+) に合わせる
- `pyproject.toml` で `requires-python = ">=3.11"`

---

## 4. Managed Agents 連携アーキテクチャ

### 4.1 通信経路

```
ブラウザプラグイン
   │
   │ kintone.plugin.app.proxy (API Key を Proxy 設定で保護)
   ▼
kintone Proxy Server
   │
   │ HTTPS
   ▼
Claude Managed Agents API (api.anthropic.com)
   │
   │ 実行コマンド
   ▼
Managed Agents Environment
   │
   │ Basic 認証 (環境変数からヘルパーライブラリが構築)
   ▼
kintone REST API (*.cybozu.com / *.kintone.com / カスタムドメイン)
```

### 4.2 API バージョン

| API | ヘッダ |
|-----|-------|
| Anthropic 基本 | `anthropic-version: 2023-06-01` |
| Managed Agents Beta | `anthropic-beta: managed-agents-2026-04-01` |

### 4.3 リソース識別

前述の通り **metadata ベース動的参照**。プラグイン側にリソース ID を永続化しない。

---

## 5. 開発ツール・プロセス

### 5.1 開発環境

| 項目 | ツール |
|------|-------|
| Node.js | **20.x LTS** |
| Python | **3.11+** |
| パッケージマネージャ (JS) | **pnpm** (高速、モノレポ向き) |
| パッケージマネージャ (Python) | **uv** (高速なインストール) |
| Git ホスティング | **GitHub** |
| エディタ | Visual Studio Code (推奨) |

### 5.2 リポジトリ構成

モノレポで 2 つのパッケージを管理:

```
CoworkAgentForKintone/
├── packages/
│   ├── plugin/               # kintone プラグイン (TypeScript)
│   │   ├── src/
│   │   ├── manifest.json
│   │   └── package.json
│   └── kintone-helper/       # Python ライブラリ
│       ├── src/cowork_agent_kintone/
│       ├── tests/
│       └── pyproject.toml
├── docs/
├── .steering/
├── .github/workflows/
├── CLAUDE.md
├── pnpm-workspace.yaml
└── README.md
```

### 5.3 CI / CD

| フェーズ | ツール | 内容 |
|---------|-------|------|
| Lint / Format | GitHub Actions | PR ごとに ESLint + Prettier + Ruff |
| 型チェック | GitHub Actions | `tsc --noEmit` + `mypy` |
| ユニットテスト | GitHub Actions | Vitest + pytest |
| プラグインビルド | GitHub Actions | `cli-kintone plugin pack` で `.zip` 生成、Release にアップロード |
| Python 配布 | GitHub Actions | タグ push で PyPI に自動公開 |

### 5.4 バージョニング戦略

- **セマンティックバージョニング** (MAJOR.MINOR.PATCH)
- 2 つのパッケージは **独立してバージョン管理**
  - プラグイン: kintone Plugin Manifest の `version`
  - Python ライブラリ: `pyproject.toml` の `version`
- **互換性マトリクス** を README に記載

---

## 6. セキュリティ技術仕様

### 6.1 Anthropic API Key 保護

- kintone プラグインの **Proxy 設定** 機能で HTTP ヘッダ `x-api-key` として固定保存
- ブラウザ JS から API Key は取得不可
- Proxy 設定の管理は kintone スペース管理者権限が必要

### 6.2 kintone 認証情報保護

- ユーザーが入力した ID/PW は **Managed Agents Vault** に直接 push (プラグイン側に保存しない)
- Vault は Anthropic インフラの暗号化ストレージで管理
- Environment コンテナへは環境変数として注入 (シェル経由や外部 API 送出は不可)

### 6.3 通信路

- すべて HTTPS (TLS 1.2 以上)
- kintone ↔ Anthropic 間は kintone Proxy が中継
- Anthropic ↔ kintone 間は Environment の許可リスト制限 (`allowed_hosts`)

### 6.4 XSS / インジェクション対策

- チャット表示の Markdown レンダリングは **`DOMPurify`** でサニタイズ
- ユーザー入力は React の JSX 経由でエスケープ済み
- Agent 生成スクリプトはサンドボックス化された Environment 内でのみ実行 (ユーザー環境への影響なし)

---

## 7. 技術的制約

### 7.1 kintone 側制約

| 項目 | 制約 |
|------|------|
| REST API レート制限 | アプリあたり **100 req/sec**、1 分あたり **10,000 req** (kintone スタンダード) |
| レコード取得上限 | 1 回 500 件、カーソルで最大 30 万件 |
| 一括更新/追加/削除 | **100 件/リクエスト** |
| bulkRequest | **20 操作/リクエスト** |
| kintone.proxy タイムアウト | 約 **30 秒** |
| kintone.proxy レスポンスサイズ | 約 **10 MB** |

### 7.2 Managed Agents 側制約 (API 仕様書確認済)

| 項目 | 制約 |
|------|------|
| Beta API | 仕様変更の可能性 (`anthropic-beta: managed-agents-2026-04-01` ヘッダ必須) |
| metadata | 最大 16 ペア / key 64 文字以下 / value 512 文字以下 |
| List API のサーバ側 metadata フィルタ | **未サポート**。全件リスト取得 → クライアント側フィルタが必要 |
| Sessions List のフィルタ | `agent_id` / `created_at[...]` / `order` はサーバ側サポートあり |
| イベント差分取得 (`since` カーソル) | **未サポート**。`page` (opaque cursor) + `order` + 既知 ID 突合で実装 |
| List API ページング | Default 20 件、最大 100 件/ページ、`next_page` トークンで継続 |
| Agent の tools | 最大 128 |
| Agent の MCP servers / skills | 各 20 |
| Agent の system prompt | 100,000 文字以内 |
| Environment / Vault / Session の総数 | API 仕様書に明示上限なし (運用で監視) |
| Session 状態 | `rescheduling` / `running` / `idle` / `terminated` |

### 7.3 ブラウザ側制約

- モダンブラウザ (Chrome / Edge / Safari / Firefox) 最新版のみ対応
- モバイル対応は Phase2

---

## 8. パフォーマンス要件

### 8.1 MVP 時点

定量目標は設定しない。以下の **ベースライン計測** を運用開始時に実施する。

| 計測項目 | 想定範囲 |
|---------|---------|
| チャット UI 初回表示 | < 1 秒 |
| ユーザーメッセージ → 最初の Agent レスポンス | < 30 秒 (複雑タスクは除く) |
| kintone ヘルパーライブラリ 1 操作 | < 5 秒 (通常レコード数) |
| イベントポーリング間隔 | 2〜10 秒 (指数バックオフ) |

### 8.2 スケーリング方針

- プラグイン自体は静的ファイルのみで、スケール要件は kintone / Anthropic 側に委譲
- ヘルパーライブラリは 100 件単位の自動分割でスループット確保
- 10,000 件超はカーソル API 活用

---

## 9. 運用・監視

### 9.1 MVP 時点

- エンドユーザーのブラウザコンソールログ以外に集中監視機構は持たない
- Anthropic / kintone のダッシュボードに依存
- Issue は GitHub Issues で受付

### 9.2 Phase 2 以降で検討

- Sentry 等のエラートラッキング連携 (オプトイン)
- kintone アプリへの監査ログ出力

---

## 10. アクセシビリティ

- **キーボード操作対応**: チャット UI の全操作をキーボードで完結可能にする
- **スクリーンリーダー**: WAI-ARIA 属性を適切に付与
- **カラーコントラスト**: WCAG AA 準拠を目標

---

## 11. 国際化 (i18n)

### 11.1 MVP
- **日本語のみ対応**
- UI 文言はすべて `locales/ja.json` に集約

### 11.2 将来
- 英語対応を視野に、文言埋込せず `i18n` ライブラリ (`i18next` 等) 経由で参照する実装方針

---

## 12. ライセンス

- **OSS**: MIT ライセンス (候補)
  - 依存ライブラリに GPL 系がなく配布制約が最小
  - 企業環境での採用障壁が低い
  - 最終決定は README 整備時に確定

---

## 13. 未確定事項

- kintone.proxy のレスポンスサイズ制約 (約 10MB) が Session イベント一括取得時にボトルネックとなる可能性 (ページング必須)
- Python ヘルパーライブラリの初版公開前の名前確定 (`cowork-agent-kintone` が PyPI で利用可能か要確認)
- OSS ライセンス最終決定 (MIT / Apache-2.0)
- Environment / Vault / Session のレート制限 (API 仕様書に明記なし、運用開始時に監視して規模拡大時の対処方針を策定)
