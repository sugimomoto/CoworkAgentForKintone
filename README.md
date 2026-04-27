# Cowork Agent for kintone

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

kintone のレコード一覧画面に、Anthropic Claude を組み込んだ業務支援エージェント「Aoi」を表示する kintone プラグインです。
ログインしているユーザー本人の権限でアプリ・レコードを参照しながら、自然言語で kintone を操作できます。

> 🚧 **Beta**: Claude Managed Agents Beta API + kintone OAuth が前提です。本番運用前に必ずステージング環境で動作確認してください。

## 何ができるか

### kintone データ操作
- レコード一覧画面の右側にサイドパネルでチャット UI を表示 (⌘K / Ctrl+K で開閉、左端ドラッグで横幅変更 320〜800px)
- 「アプリ一覧を見せて」「先月の案件レコードの件数は?」のような自然言語で kintone データを参照
- レコードの追加・更新・削除・コメント追加 (10 ツール: 読み取り 4 + 書き込み 6)
- 会話履歴の保存・復元、過去セッションへの切替
- バックグラウンド実行 (タブを閉じても Anthropic 側で処理継続)

### UX
- **HITL 承認 UI**: 削除操作 (`kintone-delete-records`) は Agent が呼び出した瞬間に [承認] [却下] ボタン付きカードが立ち、許可されるまで実行されない (`permission_policy: always_ask`)
- **ツール実行カード**: ツール呼出を 5 状態 (running / success / error / pending-confirmation / rejected) で可視化、引数サマリ + 折り畳み詳細
- **Markdown レンダリング**: 見出し / リスト / 表 / コードブロック / リンクを kintone UI 風に整形 (ストリーミング途中でも壊れない)
- **エラー UX**: API Key 認証エラー時の設定画面 CTA、OAuth 失効時の再連携バナー (mid-session 自動検知)、Session terminated 時の新規開始ボタン
- **入力体験**: Composer は 1〜8 行 auto-grow、送信中は赤い ■ キャンセルボタン (Agent ターン中断 = `user.interrupt`)

## アーキテクチャ概要

```
┌──────────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│ kintone (browser)│     │ Anthropic Managed    │     │ Cloudflare Workers │
│                  │     │ Agents               │     │ (kintone-mcp)      │
│ ┌──────────────┐ │     │                      │     │                    │
│ │ ChatPanel    │ │     │ Agent + Session      │     │ /mcp/<domain>      │
│ │ ConfigScreen │─┼────▶│ + Vault Credential   │────▶│ → kintone REST API │
│ │ OAuth flow   │ │     │   (mcp_oauth)        │     │ /credentials/upsert│
│ └──────────────┘ │     │                      │     │ /oauth/callback    │
└────────┬─────────┘     └──────────────────────┘     │ /version           │
         │                                            └────────────────────┘
         │                                                     ▲
         │ kintone OAuth (Authorization Code + PKCE)           │
         ▼                                                     │
┌─────────────────────────────────────────────────────────────┘
│ kintone OAuth Authorization Server  (cybozu.com)
└─────────────────────────────────────────────────────────────
```

- **Plugin** はブラウザ内で動作し、kintone の設定画面 + チャット UI を提供
- **Cloudflare Worker (`kintone-mcp`)** は完全ステートレス・マルチテナント。kintone の OAuth access_token を Bearer で受け取り、kintone REST API に転送するだけ
- **Anthropic Vault Credential (`mcp_oauth`)** が access_token / refresh_token を保管。Anthropic が自動 refresh
- 詳細: [docs/architecture.md](docs/architecture.md) / [docs/functional-design.md](docs/functional-design.md)

## 管理者向けセットアップ手順

セットアップは **概ね 15-20 分** で完了します。Cloudflare アカウント (無料枠で OK) と Anthropic API Key、kintone のシステム管理権限が必要です。

### 0. 事前準備

| 必要なもの | 取得先 |
|---|---|
| Cloudflare アカウント (無料枠 OK) | https://dash.cloudflare.com/sign-up |
| Cloudflare API Token (`Edit Cloudflare Workers` テンプレート) | https://dash.cloudflare.com/profile/api-tokens |
| Cloudflare Account ID (Dashboard 右側の 16 進文字列) | https://dash.cloudflare.com/ |
| Anthropic API Key (`sk-ant-...`) | https://console.anthropic.com/settings/keys |
| kintone のシステム管理者アカウント | — |

### 1. プラグイン zip を取得

GitHub Releases から最新版の `cowork-agent-for-kintone-vX.Y.Z.zip` をダウンロード。

### 2. プラグインを kintone にインストール

1. kintone の **システム管理** → **その他** → **プラグイン** → **読み込む**
2. 取得した `.zip` を選択 → 追加
3. 表示された **プラグイン ID** (32 文字英数字) を控える

### 3. 対象アプリにプラグインを追加

1. プラグインを使いたいアプリを開く → **アプリの設定** → **プラグイン**
2. 「プラグインを追加」→ Cowork Agent for kintone を選択 → 追加
3. アプリを **更新** (運用環境にデプロイ)

### 4. プラグイン設定画面を開く

アプリ設定 → プラグイン → Cowork Agent for kintone → **歯車アイコン (設定)**

### 5. Step 0: Cloudflare Worker をデプロイ

設定画面の **Step 0** に以下を入力して「Worker をデプロイ」をクリック:

- **Cloudflare Account ID** (16 進 32 文字)
- **Cloudflare API Token** (Edit Cloudflare Workers テンプレートで作成)

成功すると Worker URL が `Step 1` の入力欄に自動で入ります (`https://cowork-agent-kintone-mcp.<account>.workers.dev`)。

> 💡 **既に Worker をデプロイ済の場合**: Step 0 は飛ばして Step 1 の Worker URL に既存の URL を入力するだけで OK です。

### 6. Step 1: Worker URL + Anthropic API Key を入力

- **Worker URL**: Step 0 で自動入力済 (または既存 URL を貼付)
- **Anthropic API Key**: `sk-ant-...`

### 7. Step 2: cybozu.com OAuth クライアントを作成

設定画面 Step 2 に表示される指示に従います:

1. 表示された **コールバック URL** (`<worker>/oauth/callback`) をコピー
2. 表示された **推奨スコープ** をコピー
3. 「cybozu.com 共通管理 → OAuth クライアント追加画面を開く」リンクをクリック
4. 開いた cybozu 管理画面で:
   - クライアント名: 任意 (例: `Cowork Agent`)
   - リダイレクト URI: 上で貼り付けたコールバック URL
   - スコープ: 上のスコープをすべてチェック
   - 「追加」を押すと **client_id / client_secret** が表示される

### 8. Step 3: client_id / client_secret を入力 → 保存

- **client_id**: Step 7 で発行された値
- **client_secret**: Step 7 で発行された値
- **scope**: デフォルトのまま (Step 7 で登録したスコープと一致させる)

「保存」をクリック → アプリを更新。

### 9. ユーザーごとに「kintone と連携」

レコード一覧画面でチャットパネルを開き、**「kintone と連携」** ボタンを押下。
popup で kintone OAuth の同意画面が出るので「許可」をクリック。
完了すると Composer (入力欄) が出てチャット可能に。

### 10. 動作確認

「kintone のアプリ一覧を見せて」と入力。アプリ名 + ID が応答に含まれれば成功です 🎉

## トラブルシューティング

### 「データベースのロックに失敗しました」と保存時に出る

kintone 内部で `setProxyConfig` が連続書込競合を起こしています。再読み込み → 1 回だけ保存ボタンを押してください。

### `/credentials/upsert failed (401): missing_anthropic_api_key`

Step 1 の Anthropic API Key と Step 3 の OAuth 情報が両方入った状態で保存されているか確認。**必ず再読み込み後 1 回だけ保存** してください。

### Worker `/version` が `dev` を返す

Plugin Config の Step 0 経由ではなく、直接 `wrangler deploy` でデプロイした場合は version 情報が注入されません。Plugin Config からの再デプロイで解決します。

### MCP server host(s) blocked by environment network policy

旧世代の Anthropic Environment が残存しています。Plugin を再起動 (タブを閉じて開き直す) すると、新しい `allow_mcp_servers: true` 付き Environment が作成されます。

## 開発者向け

### リポジトリ構成

```
.
├── packages/
│   ├── plugin/        # kintone プラグイン (TypeScript + React + Tailwind + Vite)
│   └── kintone-mcp/   # Cloudflare Worker (kintone REST API への MCP transport)
├── docs/              # 永続的設計ドキュメント
├── .steering/         # 作業単位の steering ドキュメント (要件・設計・タスク)
└── scripts/           # 開発・検証スクリプト
```

詳細は [docs/repository-structure.md](docs/repository-structure.md)。

### ビルド・テスト

```bash
# 依存インストール
pnpm install

# 全 typecheck + unit tests (Worker 60 + Plugin 267)
pnpm -r typecheck
pnpm -r test

# Plugin ビルド (manifest.json の version 自動 +1)
pnpm plugin:build

# Plugin の auto-deploy (.env で kintone 認証情報を設定済の前提)
pnpm plugin:deploy

# Worker の手動デプロイ (通常は Plugin Config 経由)
cd packages/kintone-mcp && pnpm exec wrangler deploy

# E2E (Playwright)
pnpm plugin:e2e
COWORK_E2E_FORCE_REBIND=1 pnpm plugin:e2e   # 既存 Vault を archive して OAuth flow を再実行
COWORK_E2E_SKIP_LIVE=1 pnpm plugin:e2e      # LLM コスト系を skip (CI 用)
```

`.env` のテンプレートは [`.env.example`](.env.example) を参照。

### 設計ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/product-requirements.md](docs/product-requirements.md) | プロダクト要求定義 (誰の・何の課題を解くか) |
| [docs/functional-design.md](docs/functional-design.md) | 機能設計 (画面・データモデル・シーケンス) |
| [docs/architecture.md](docs/architecture.md) | 技術仕様 (スタック・通信経路・制約) |
| [docs/repository-structure.md](docs/repository-structure.md) | リポジトリ構造 |
| [docs/development-guidelines.md](docs/development-guidelines.md) | 開発ガイドライン (コーディング・テスト規約) |
| [docs/glossary.md](docs/glossary.md) | ユビキタス言語 |

### コントリビュート

不具合報告 / 機能要望は [GitHub Issues](https://github.com/sugimomoto/CoworkAgentForKintone/issues) へお願いします。

## ライセンス

[MIT License](LICENSE)
