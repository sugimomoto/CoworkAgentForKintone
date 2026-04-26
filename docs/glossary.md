# ユビキタス言語定義 (Glossary)

**プロダクト名**: Cowork Agent for kintone
**バージョン**: 0.2 (Phase 1b-3)
**最終更新日**: 2026-04-26

ドキュメント・UI・コード全体で一貫した用語を使うための定義集。新しい用語を導入する際は本書を更新する。

---

## 1. プロダクト固有用語

| 日本語 | English / コード表記 | 定義 |
|--------|---------------------|------|
| Cowork Agent | `CoworkAgent` | 本プロダクトの AI エージェント本体を指す呼称 |
| サイドパネル | `SidePanel` / `ChatPanel` | レコード一覧画面の右側に表示されるチャット UI コンテナ |
| デフォルト Agent | `defaultAgent` | プラグインが自動作成する共通 Agent |
| カスタム Agent | `customAgent` | ユーザーが自身のニーズに合わせて作成する Agent (Phase2) |
| ユーザーバインディング | `userBinding` | kintone OAuth で発行した access/refresh token を Anthropic Vault Credential に保管し、ユーザーと紐付ける状態 |
| 実行計画 | `executionPlan` | 破壊的操作 (更新 / 削除) 前に Agent が提示する処理内容のプレビュー |
| 承認 (HITL) | `approval` | 実行計画に対するユーザーの許可操作 |

---

## 2. Claude Managed Agents 関連用語

| 日本語 | English / コード表記 | 定義 |
|--------|---------------------|------|
| Managed Agents | `ManagedAgents` | Anthropic が提供する Claude のエージェント実行基盤 (Beta) |
| Agent | `agent` | Managed Agents におけるエージェント定義リソース (モデル・システムプロンプト・ツール構成・mcp_servers) |
| Environment | `environment` | Managed Agents のサンドボックス実行環境 (ネットワーク許可リスト、パッケージ、`allow_mcp_servers`) |
| Vault | `vault` | Managed Agents の秘匿情報ストレージ。複数 Credential をぶら下げる単位 |
| Vault Credential | `vaultCredential` | Vault 内の個別認証情報。`type: 'mcp_oauth'` の場合は MCP server URL × access/refresh token を保管 |
| `mcp_oauth` 認証 | `mcpOAuth` | Vault Credential の auth type。MCP server へのリクエスト時 Anthropic が access_token を Bearer で自動付与し、期限切れ時に refresh も自動実行 |
| Session | `session` | Agent + Environment + Vault の組合せで動作する 1 会話単位 |
| Custom Tool | `customTool` | クライアント側で実行されるツール (本プロダクトでは未使用) |
| agent_toolset | `agent_toolset_20260401` | Environment 内で使える組込ツール群 (`bash` / `write` / `read` 等) |
| MCP Toolset | `mcp_toolset` | mcp_servers として登録された MCP server のツールを Agent に公開する toolset 種別 |
| メタデータ | `metadata` | 各リソースに付与する key-value ラベル。識別・検索に利用 |
| ポーリング | `polling` | SSE を使わず定期的にイベント一覧を取得する通信方式 |
| バックグラウンド実行 | `backgroundExecution` | ブラウザを閉じても Managed Agents 側で処理が継続する実行形態 |

---

## 3. kintone 関連用語

| 日本語 | English / コード表記 | 定義 |
|--------|---------------------|------|
| プラグイン | `plugin` | kintone アプリに機能を追加するインストール可能モジュール |
| プラグイン設定 | `pluginConfig` | kintone 管理者のみが設定できるプラグイン固有設定 |
| Proxy 設定 | `proxyConfig` | kintone プラグインの外部 API 呼出設定。API Key を JS から隠蔽する用途 |
| kintone.proxy | `kintone.plugin.app.proxy` | Proxy 設定に登録した URL を呼び出す kintone API |
| アプリ | `app` | kintone のレコード管理単位 |
| レコード | `record` | アプリ内の 1 データ行 |
| フィールド | `field` | レコード内の個別項目 |
| フィールドコード | `fieldCode` | フィールドを一意に識別する文字列 |
| ルックアップ | `lookup` | 他アプリの値を参照するフィールド型 |
| ログインユーザー | `loginUser` | 現在操作している kintone ユーザー |
| ユーザーコード | `userCode` | kintone ログイン名 (ユーザーの一意識別子) |
| ゲストスペース | `guestSpace` | ゲストユーザー向けスペース (MVP は対象外) |
| カーソル API | `cursorApi` | 10,000 件超のレコード取得に使う kintone REST API |
| bulkRequest | `bulkRequest` | 複数操作を 1 リクエストでアトミックに実行する API |

---

## 4. UI / UX 用語

| 日本語 | English / コード表記 | 定義 |
|--------|---------------------|------|
| チャット UI | `chatUi` | メッセージのやり取りを行う主要画面要素 |
| 会話履歴 | `messageHistory` | Session 内のメッセージ時系列 |
| メッセージ | `message` | user / agent / tool のいずれかが発信する 1 発言 |
| 承認カード | `approvalCard` | 実行計画とボタンを含むインライン UI 要素 |
| タスクインジケータ | `taskIndicator` | バックグラウンドで動作中のタスク件数と状態を示す UI |
| kintone と連携ボタン | `ConnectKintoneButton` | 未バインド時にチャット入力欄の代わりに表示。クリックで OAuth popup を開く |
| 新規会話 | `newConversation` | 過去会話をリセットして新しい Session を開始する操作 |

---

## 5. 技術用語

| 日本語 | English / コード表記 | 定義 |
|--------|---------------------|------|
| モノレポ | `monorepo` | 1 リポジトリで複数パッケージを管理する構成 (pnpm workspace) |
| MCP | Model Context Protocol | Anthropic 公開の LLM ↔ ツール間プロトコル。本プロダクトでは Worker が MCP HTTP transport を提供 |
| MCP Server | `mcpServer` | MCP プロトコルで tools を提供するエンドポイント (本プロダクトでは Cloudflare Worker `/mcp/<domain>`) |
| OAuth (Authorization Code + PKCE) | `oauthFlow` | kintone のユーザー本人認可で access/refresh token を発行するフロー。RFC 7636 PKCE (S256) 必須 |
| PKCE | `pkce` | Proof Key for Code Exchange。code_verifier / code_challenge で Authorization Code 横取りを防ぐ |
| state | `state` | OAuth フロー時の CSRF 防御 token (sessionStorage 保存 + postMessage payload と照合) |
| Bearer 透過 | `bearerPassThrough` | Worker が受け取った `Authorization: Bearer <token>` をそのまま kintone REST API に転送する設計 |
| マルチテナント Worker | `multitenantWorker` | 1 Worker が URL パス `/mcp/<domain>` で任意の cybozu ドメインに対応 |
| `setProxyConfig` | — | kintone の固定ヘッダ / body 注入機能。secret を JS から隠蔽するために使う |
| `kintone.proxy` | — | runtime 用 (デスクトップ JS / 設定画面) の外部 API 呼出 API |
| `kintone.plugin.app.proxy` | — | desktop runtime 専用 (設定画面では使えない) の Plugin 用 proxy。設定画面では `setProxyConfig` 由来の固定ヘッダが付与される |
| metadata フィルタ | `metadataFilter` | リソース一覧からクライアント側で metadata 条件で絞り込む処理 |
| ステートレス | `stateless` | Worker / Plugin ともに永続状態を持たず、Anthropic / kintone を信頼の中心とする方針 |

---

## 6. 避ける用語 / 混乱を招きやすい用語

以下の用語は混乱を招きやすいため、使用を避けるか注釈を付ける。

| 避ける用語 | 理由 | 代替 |
|-----------|------|------|
| API | あいまい (kintone API / Managed Agents API / ヘルパーライブラリ API) | **kintone REST API** / **Managed Agents API** / **ヘルパーライブラリ API** と明示 |
| Tool | あいまい (Custom Tool / agent_toolset / kintone ヘルパー) | **Custom Tool** / **agent_toolset ツール** / **ヘルパーライブラリメソッド** と明示 |
| Key | あいまい (Anthropic API Key / kintone パスワード / metadata キー) | **Anthropic API Key** / **kintone パスワード** / **metadata キー** と明示 |
| ユーザー | kintone ユーザー vs プラグインのエンドユーザー | 通常は同一だが、管理者を区別する場合は **kintone 管理者** と明示 |

---

## 7. 英語・日本語対応 (主要用語)

コード・コミットメッセージ・PR タイトルで用いる英語表記と、ドキュメント・UI で用いる日本語表記の対応。

| 日本語 | English |
|--------|---------|
| チャット | chat |
| 会話 | conversation / session |
| メッセージ | message |
| 会話履歴 | message history |
| 承認 | approval |
| 実行計画 | execution plan |
| 破壊的操作 | destructive operation |
| 非同期 / バックグラウンド | asynchronous / background |
| ポーリング | polling |
| メタデータ | metadata |
| 認証情報 | credentials |
| 接続情報リセット | reset credentials |

---

## 8. コード命名の基本対応

| 概念 | TypeScript |
|------|-----------|
| 会話セッション | `session` |
| メッセージ | `message` |
| kintone アプリ ID | `appId` |
| kintone レコード | `record` |
| フィールドコード | `fieldCode` |
| kintone ユーザーコード | `kintoneUserCode` |
| kintone ドメイン | `kintoneDomain` |
| Anthropic API Key | `anthropicApiKey` |
| バインディング | `userBinding` |
| Managed Agents | `managedAgents` |
| Worker URL | `workerUrl` |
| OAuth クライアント ID / シークレット | `oauthClientId` / `oauthClientSecret` |

> TypeScript は camelCase 原則。Phase 1b-3 で Python 配布パスは廃止されたため snake_case 列は削除。

---

## 9. 略語・頭字語

| 略語 | 正式名称 | 用途 |
|------|----------|------|
| MVP | Minimum Viable Product | 初期リリース範囲 |
| HITL | Human-in-the-Loop | 破壊的操作の承認プロセス |
| SSE | Server-Sent Events | 本プロダクトでは非採用 (kintone.proxy が非対応のため) |
| OSS | Open Source Software | 配布形態 |
| CI / CD | Continuous Integration / Continuous Deployment | GitHub Actions によるビルド・テスト・公開 |
| PII | Personally Identifiable Information | 個人識別情報 (本プロダクトでは Anthropic 規約に準拠) |

---

## 10. 変更履歴

- 2026-04-23: 初版作成
- 2026-04-26: Phase 1b-3 (OAuth pivot + multi-tenant Worker)
  - kintone helperLibrary を廃止 (Phase 1b-1 〜 1b-2 の Python パッケージは利用しない)
  - OAuth / PKCE / MCP / Vault Credential 関連用語を追加
  - CredentialDialog を ConnectKintoneButton に置換
