# ユビキタス言語定義 (Glossary)

**プロダクト名**: Cowork Agent for kintone
**バージョン**: 0.1 (MVP ドラフト)
**最終更新日**: 2026-04-23

ドキュメント・UI・コード全体で一貫した用語を使うための定義集。新しい用語を導入する際は本書を更新する。

---

## 1. プロダクト固有用語

| 日本語 | English / コード表記 | 定義 |
|--------|---------------------|------|
| Cowork Agent | `CoworkAgent` | 本プロダクトの AI エージェント本体を指す呼称 |
| サイドパネル | `SidePanel` / `ChatPanel` | レコード一覧画面の右側に表示されるチャット UI コンテナ |
| デフォルト Agent | `defaultAgent` | プラグインが自動作成する共通 Agent |
| カスタム Agent | `customAgent` | ユーザーが自身のニーズに合わせて作成する Agent (Phase2) |
| ユーザーバインディング | `userBinding` | kintone ユーザーと、そのユーザー専用 Environment / Vault の紐付け |
| 実行計画 | `executionPlan` | 破壊的操作 (更新 / 削除) 前に Agent が提示する処理内容のプレビュー |
| 承認 (HITL) | `approval` | 実行計画に対するユーザーの許可操作 |

---

## 2. Claude Managed Agents 関連用語

| 日本語 | English / コード表記 | 定義 |
|--------|---------------------|------|
| Managed Agents | `ManagedAgents` | Anthropic が提供する Claude のエージェント実行基盤 (Beta) |
| Agent | `agent` | Managed Agents におけるエージェント定義リソース (モデル・システムプロンプト・ツール構成) |
| Environment | `environment` | Managed Agents のサンドボックス実行環境 (ネットワーク許可リスト、パッケージ、環境変数) |
| Vault | `vault` | Managed Agents の秘匿情報ストレージ。コンテナに環境変数注入される |
| Session | `session` | Agent + Environment + Vault の組合せで動作する 1 会話単位 |
| Custom Tool | `customTool` | クライアント側で実行されるツール (本プロダクトでは未使用) |
| agent_toolset | `agent_toolset_20260401` | Environment 内で使える組込ツール群 (`bash` / `write` / `read` 等) |
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
| 認証情報入力ダイアログ | `credentialDialog` | 初回利用時に kintone ID / PW を求めるモーダル |
| 新規会話 | `newConversation` | 過去会話をリセットして新しい Session を開始する操作 |

---

## 5. 技術用語

| 日本語 | English / コード表記 | 定義 |
|--------|---------------------|------|
| モノレポ | `monorepo` | 1 リポジトリで複数パッケージを管理する構成 |
| ヘルパーライブラリ | `helperLibrary` | `cowork-agent-kintone` — Environment にプリインストールされる Python ライブラリ |
| Basic 認証 | `basicAuth` | kintone の `X-Cybozu-Authorization` ヘッダによる認証 |
| metadata フィルタ | `metadataFilter` | リソース一覧からクライアント側で metadata 条件で絞り込む処理 |
| ステートレス | `stateless` | プラグイン側に永続状態を持たず、都度 Managed Agents API から取得する方針 |

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

| 概念 | TypeScript | Python |
|------|-----------|--------|
| 会話セッション | `session` | `session` |
| メッセージ | `message` | `message` |
| kintone アプリ ID | `appId` | `app_id` |
| kintone レコード | `record` | `record` |
| フィールドコード | `fieldCode` | `field_code` |
| kintone ユーザーコード | `kintoneUserCode` | `kintone_user_code` |
| kintone ドメイン | `kintoneDomain` | `kintone_domain` |
| Anthropic API Key | `anthropicApiKey` | `anthropic_api_key` |
| バインディング | `userBinding` | `user_binding` |
| Managed Agents | `managedAgents` | `managed_agents` |

> TypeScript は camelCase、Python は snake_case を原則とし、同じ概念を表す命名は揃える。

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
