# リポジトリ構造定義書 (Repository Structure)

**プロダクト名**: Cowork Agent for kintone
**バージョン**: 0.2 (Phase 1b-3)
**最終更新日**: 2026-04-26

---

## 1. 概要

本リポジトリは **pnpm workspace** を利用したモノレポ構成で、以下 2 パッケージを管理する。

| パッケージ | 言語 / ランタイム | 成果物 |
|-----------|------------------|--------|
| `packages/plugin` | TypeScript + React + esbuild + Tailwind | kintone プラグイン `.zip` |
| `packages/kintone-mcp` | TypeScript + Cloudflare Workers Runtime | Cloudflare Workers script |

> Phase 1b-1 の `packages/kintone-helper` (Python) は Phase 1b-3 で廃止された。

---

## 2. リポジトリ全体構造

```
CoworkAgentForKintone/
├── .claude/                         # Claude Code 設定・スキル (開発支援)
├── .github/
│   └── workflows/                   # GitHub Actions 定義
├── .steering/                       # 作業単位ドキュメント (時系列の意思決定記録)
│   └── [YYYYMMDD]-[title]/
│       ├── requirements.md
│       ├── design.md
│       └── tasklist.md
├── docs/                            # 永続ドキュメント (恒久的な仕様)
│   ├── product-requirements.md
│   ├── functional-design.md
│   ├── architecture.md
│   ├── repository-structure.md     # 本ファイル
│   ├── development-guidelines.md
│   └── glossary.md
├── packages/
│   ├── plugin/                      # kintone プラグイン (TypeScript)
│   └── kintone-mcp/                 # Cloudflare Worker (TypeScript)
├── scripts/
│   ├── auto-deploy-plugin.sh        # Claude Code Stop フック用 auto-deploy
│   ├── verify-mcp-oauth.mjs         # OAuth flow 単発検証スクリプト
│   ├── test-proxy-nested-body.js    # kintone proxy 仕様確認 (ブラウザコンソール用)
│   └── setup-labels.sh              # GitHub label 初期化
├── .editorconfig
├── .env.example
├── .gitignore
├── .prettierrc / .prettierignore
├── .eslintrc.cjs
├── CLAUDE.md                        # プロジェクトメモリ (開発規約)
├── LICENSE                          # MIT
├── README.md                        # 公開リポジトリのトップ
├── package.json                     # workspace root + 共通スクリプト
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── tsconfig.base.json
```

---

## 3. packages/plugin (kintone プラグイン)

### 3.1 ディレクトリ構造

```
packages/plugin/
├── plugin/                          # kintone Plugin format (zip 化される)
│   ├── manifest.json                # version は build 時自動 +1
│   ├── html/config.html
│   ├── js/{desktop,config}.js       # esbuild 出力 (gitignore)
│   └── css/{desktop,config}.css     # Tailwind 出力 (gitignore)
├── src/
│   ├── desktop/                     # レコード一覧画面 (Chat UI)
│   │   ├── index.tsx                # app.record.index.show エントリ
│   │   ├── ChatPanel.tsx            # ルート (Header + MessageList + Composer | History)
│   │   ├── HistoryView.tsx
│   │   ├── components/
│   │   │   ├── ConnectKintoneButton.tsx  # OAuth 連携トリガー
│   │   │   ├── Composer.tsx              # メッセージ入力欄
│   │   │   ├── Header.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageItem/              # AgentMessage / UserMessage / ThinkingDots
│   │   │   └── WelcomeMessage.tsx
│   │   └── hooks/
│   │       ├── useSession.ts             # Agent + Environment bootstrap
│   │       ├── useUserBinding.ts         # OAuth flow + Vault Credential 解決
│   │       ├── useEventPoller.ts         # Session events ポーリング
│   │       └── usePanelOpenState.ts
│   ├── config/                      # プラグイン設定画面 (4 ステップウィザード)
│   │   ├── index.tsx
│   │   └── ConfigScreen.tsx
│   ├── core/                        # UI 非依存のロジック層
│   │   ├── managed-agents/          # Anthropic API (client / resources / events / types / eventInterpreter)
│   │   ├── kintone/                 # kintone JS API ラッパ (proxyTransport / pluginConfig / user / setProxyConfigAsync)
│   │   ├── oauth/                   # PKCE / popup / tokenExchange / credentialsUpsertClient
│   │   ├── cloudflare/              # Worker デプロイ client + multipart 構築
│   │   ├── bootstrap/               # resolveAgent / resolveEnvironment / resolveSession / resolveVault
│   │   ├── constants.ts             # METADATA / DEFAULT_KINTONE_OAUTH_SCOPE / CLOUDFLARE_WORKER_SCRIPT_NAME 等
│   │   ├── format.ts                # 日付フォーマット
│   │   └── utils.ts                 # sleep / toErrorMessage / joinUrl / buildMcpServerUrl
│   ├── store/
│   │   └── chatStore.ts             # Zustand
│   ├── styles/
│   │   └── global.css               # Tailwind directive
│   ├── types/
│   │   └── kintone-plugin.d.ts      # kintone JS API の型定義
│   ├── test/
│   │   └── fixtures.ts              # 共通テストフィクスチャ
│   └── generated/                   # build 時自動生成 (gitignore)
│       └── worker-bundle.ts         # Worker JS の文字列定数 + version
├── e2e/                             # Playwright spec
│   ├── auth.setup.ts                # kintone ログイン (storageState 保存)
│   ├── credential-bind.setup.ts     # OAuth flow を popup 自動化で完走
│   ├── config.spec.ts               # 設定画面 + Cloudflare deploy
│   ├── live-with-mcp.spec.ts        # MCP 経由で kintone データ取得
│   ├── live.spec.ts                 # Anthropic API 連携 (応答テキスト)
│   ├── panel-toggle.spec.ts         # パネル開閉
│   ├── session-history.spec.ts      # 履歴
│   └── smoke.spec.ts                # マウント確認
├── scripts/
│   ├── build.mjs                    # Worker bundle + Plugin JS + CSS 生成
│   ├── deploy.mjs                   # cli-kintone でアップロード
│   ├── e2e.mjs                      # Playwright runner ラッパ
│   └── lib/kintone-deploy.mjs       # REST API deploy + poll
├── package.json
├── tsconfig.json
├── playwright.config.ts
├── postcss.config.js
├── tailwind.config.ts
└── vitest.config.ts
```

### 3.2 ビルド成果物 (gitignore)

```
plugin/js/{desktop,config}.js
plugin/css/{desktop,config}.css
src/generated/
dist/, dist-plugin/
```

---

## 4. packages/kintone-mcp (Cloudflare Worker)

### 4.1 ディレクトリ構造

```
packages/kintone-mcp/
├── src/
│   ├── index.ts                     # ルータ (/mcp/<domain>, /credentials/upsert, /oauth/callback, /version, /healthz, /debug/echo)
│   ├── mcp.ts                       # POST /mcp/<domain> ハンドラ (JSON-RPC 2.0)
│   ├── credentials-upsert.ts        # POST /credentials/upsert (Anthropic Vault Credential 中継)
│   ├── oauth-callback.ts            # GET /oauth/callback (postMessage 中継)
│   ├── kintone.ts                   # kintone REST API クライアント (Bearer 専用)
│   ├── version.ts                   # __BUILD_VERSION__ / __BUILD_TIME__
│   ├── _http.ts                     # jsonResponse / isString / maskToken
│   └── tools/
│       ├── factory.ts               # createTool / createToolCallback
│       ├── index.ts                 # 4 ツール集約
│       ├── get-app.ts
│       ├── get-apps.ts
│       ├── get-form-fields.ts
│       ├── get-records.ts
│       ├── types/                   # Tool / ToolConfig / ToolCallback
│       └── utils/build-query.ts     # filters → kintone query 変換
├── tests/                           # vitest (60 件)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── wrangler.toml                    # 環境変数なし (compatibility_date のみ)
```

### 4.2 デプロイ

通常は **Plugin 設定画面 Step 0** からブラウザ経由で API デプロイ。
開発中は `pnpm exec wrangler deploy` で直接デプロイ可 (この場合 `__BUILD_VERSION__` 未注入で `/version` は `dev`)。

---

## 5. ファイル配置ルール

### 5.1 docs/ vs .steering/

| 配置先 | 内容 | 更新頻度 |
|--------|------|---------|
| `docs/` | 永続的な仕様 (アーキテクチャ・要件・規約) | 大きな設計変更時のみ |
| `.steering/[YYYYMMDD]-[title]/` | 作業単位の意思決定記録 (要件・設計・タスク) | 作業ごとに新規作成、完了後は履歴として保持 |

**新しい作業を始める際は必ず `.steering/` に新ディレクトリを作る** (CLAUDE.md 参照)。

### 5.2 src/ 配下の責務

- **`src/desktop/`**: レコード一覧画面で動く UI (React コンポーネント + フック)
- **`src/config/`**: プラグイン設定画面で動く UI
- **`src/core/`**: UI 非依存のロジック (HTTP / OAuth / kintone API / Anthropic API / 状態解決)
- **`src/store/`**: Zustand
- **`src/types/`**: アンビエント型定義 (グローバル `kintone` 等)
- **`src/test/`**: vitest 用フィクスチャ (本体コードからの参照禁止)
- **`src/generated/`**: ビルド時自動生成 (手動編集禁止、gitignore)

### 5.3 命名規則

- **コンポーネント**: PascalCase (例: `ChatPanel.tsx`)
- **フック**: `use*` プレフィックス + camelCase (例: `useUserBinding.ts`)
- **テスト**: 対象ファイル + `.test.ts` / `.test.tsx`
- **定数**: SCREAMING_SNAKE_CASE (例: `DEFAULT_KINTONE_OAUTH_SCOPE`)
- **シングルトン関数**: camelCase (例: `resolveDefaultAgent`)

---

## 6. 環境変数

### 6.1 ローカル開発用 `.env`

`.env.example` を `.env` にコピーして必要な値を埋める。詳細は [`.env.example`](../.env.example)。

主要な値:

| キー | 用途 |
|---|---|
| `KINTONE_BASE_URL` / `KINTONE_USERNAME` / `KINTONE_PASSWORD` | kintone プラグインアップロード用 |
| `ANTHROPIC_API_KEY` | E2E (live spec) / `scripts/verify-mcp-oauth.mjs` 用 |
| `KINTONE_TEST_APP_ID` / `KINTONE_TEST_PLUGIN_ID` | E2E 用 |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | Worker デプロイ E2E 用 |
| `KINTONE_OAUTH_*` | `verify-mcp-oauth.mjs` 用 |

### 6.2 本番

Plugin Config 画面で設定 (admin のみ実行可)。詳細は [README](../README.md)。

---

## 7. CI / CD

### 7.1 GitHub Actions

| ワークフロー | トリガー | 内容 |
|---|---|---|
| `ci.yml` (想定) | PR / push | `pnpm -r typecheck` + `pnpm -r test` + `pnpm lint` |
| `release.yml` (想定) | tag push (`vX.Y.Z`) | Plugin zip ビルド + GitHub Release アップロード |

### 7.2 ローカル auto-deploy

Claude Code の Stop フック (`scripts/auto-deploy-plugin.sh`) が、Plugin の変更を検出したら自動的に kintone へアップロードする (`.claude/settings.local.json` で有効化)。
