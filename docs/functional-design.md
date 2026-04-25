# 機能設計書 (Functional Design Document)

**プロダクト名**: Cowork Agent for kintone
**バージョン**: 0.1 (MVP ドラフト)
**最終更新日**: 2026-04-22

---

## 1. システムアーキテクチャ

### 1.1 全体構成図

```mermaid
graph TB
    subgraph Browser["ユーザー環境 (ブラウザ)"]
        KT[kintone レコード一覧画面]
        Plugin[Cowork Agent Plugin<br/>サイドパネル チャットUI]
        KT --> Plugin
    end

    subgraph Anthropic["Anthropic Cloud"]
        ManagedAgent[Claude Managed Agent<br/>agent_toolset: bash/write/read]
        Vault[(Vault<br/>kintone ID/PW)]
        Env[Environment<br/>サンドボックス実行環境<br/>+ kintone ヘルパーライブラリ<br/>プリインストール]
        Session[(Session<br/>会話履歴)]
        ManagedAgent --> Vault
        ManagedAgent --> Env
        ManagedAgent --> Session
        Vault -.->|環境変数注入<br/>KINTONE_LOGIN/PASSWORD| Env
    end

    subgraph Kintone["kintone 環境"]
        RestAPI[kintone REST API]
        Apps[(kintone Apps)]
        RestAPI --> Apps
    end

    Plugin -->|kintone.proxy 経由<br/>Anthropic API<br/>(API Key は proxy 設定で保護)| ManagedAgent
    Env -->|ヘルパーライブラリ経由<br/>Basic認証で呼出| RestAPI
    Plugin -.->|初期設定<br/>レコード取得| RestAPI
```

### 1.2 実行モデル

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant UI as チャット UI<br/>(プラグイン)
    participant Proxy as kintone.proxy
    participant MA as Claude Managed<br/>Agents API
    participant Env as Environment<br/>(bash + ヘルパーライブラリ)
    participant K as kintone REST API

    User->>UI: 1. チャットで依頼
    UI->>Proxy: 2. メッセージ送信要求
    Proxy->>MA: 3. POST /sessions/{id}/events<br/>(user.message)
    MA-->>Proxy: 4. 受付
    Proxy-->>UI: 5. 受付応答

    loop ポーリング (バックグラウンド実行中)
        UI->>Proxy: 6. 進捗取得要求
        Proxy->>MA: 7. GET /sessions/{id}/events<br/>(差分取得)
        MA->>Env: (write でスクリプト作成 → bash で実行)
        Env->>Env: ヘルパーライブラリ import<br/>環境変数から認証情報取得
        Env->>K: Basic 認証で API呼出
        K-->>Env: レスポンス
        Env-->>MA: bash stdout/stderr
        MA-->>Proxy: 新規イベント(メッセージ)
        Proxy-->>UI: 8. 差分イベント
        UI-->>User: 9. 進捗・結果表示
    end

    Note over MA,Env: 破壊的操作時は<br/>計画を返して承認待ち状態
    User->>UI: 10. 許可
    UI->>Proxy: 11. 承認メッセージ送信
    Proxy->>MA: 12. 承認通知
    MA->>Env: 13. 更新/削除スクリプト実行
```

### 1.3 レイヤー構成

| レイヤー | 責務 | 主な構成要素 |
|---------|------|-------------|
| **プレゼンテーション層** | ユーザーとの対話 UI、kintone イベント連携 | サイドパネル、チャット表示、設定画面 |
| **アプリケーション層** | チャット状態管理、Managed Agents 呼出、SSE 受信 | Session Manager、Agent Client、Approval Handler |
| **連携層** | Managed Agents の Environment にプリインストールされた **kintone ヘルパーライブラリ** | kintone REST API ラッパ (Basic 認証)。Agent が bash + write でスクリプトを組み立てて呼出 |
| **外部サービス層** | Claude Managed Agents API、kintone REST API | 外部依存 |

---

## 2. コンポーネント設計

### 2.1 主要コンポーネント一覧

| コンポーネント | 配置 | 責務 |
|---------------|------|------|
| **ChatPanel** | ブラウザ (プラグイン) | サイドパネル内のチャット UI |
| **SessionManager** | ブラウザ (プラグイン) | Session の動的解決 (metadata 検索) / 新規作成 / 切替。sessionId はメモリキャッシュのみ |
| **AgentClient** | ブラウザ (プラグイン) | Claude Managed Agents API 呼出 (kintone.proxy 経由、ポーリングで進捗取得) |
| **EventPoller** | ブラウザ (プラグイン) | セッションのイベント差分を定期ポーリング (SSE 代替) |
| **ApprovalHandler** | ブラウザ (プラグイン) | 破壊的操作の計画提示と承認 UI |
| **ResourceResolver** | ブラウザ (プラグイン) | Managed Agents API をメタデータでフィルタして Agent / Environment / Vault を動的解決。セッション内メモリキャッシュを保持 |
| **UserBindingBootstrap** | ブラウザ (プラグイン) | チャット起動時に ResourceResolver 経由で自ユーザー用 Environment / Vault が存在するかを確認し、未登録なら認証情報入力ダイアログを表示して作成 |
| **ConfigScreen** | ブラウザ (プラグイン) | 管理者向けプラグイン設定画面 (Anthropic API Key 登録、Agent 管理) |
| **ConfigStore** | kintone プラグイン設定領域 | プラグイン設定値の保存・読込 |
| **kintone Helper Library** | Managed Agents Environment (プリインストール) | kintone REST API を操作する Python/Node ライブラリ。Agent が `bash` + `write` で呼び出す |
| **Vault 環境変数注入** | Managed Agents Environment | Vault の `KINTONE_LOGIN` / `KINTONE_PASSWORD` が Environment の環境変数として自動注入される |

### 2.2 コンポーネント間関係

```mermaid
graph LR
    subgraph Plugin["プラグイン (ブラウザ)"]
        ChatPanel --> SessionManager
        ChatPanel --> ApprovalHandler
        ChatPanel --> UserBindingBootstrap
        ChatPanel --> ResourceResolver
        UserBindingBootstrap --> ResourceResolver
        UserBindingBootstrap --> AgentClient
        ResourceResolver --> AgentClient
        SessionManager --> ResourceResolver
        SessionManager --> AgentClient
        SessionManager --> EventPoller
        EventPoller --> AgentClient
        ConfigScreen --> ConfigStore
        AgentClient --> ConfigStore
    end
    AgentClient -->|kintone.proxy| Proxy[kintone Proxy API]
    Proxy -->|HTTPS| Anthropic[Claude Managed<br/>Agents API]

    subgraph Env["Managed Agents Environment"]
        AgentToolset["agent_toolset_20260401<br/>bash / write / read"]
        HelperLib[kintone Helper Library<br/>プリインストール]
        EnvVars[環境変数<br/>KINTONE_LOGIN/PASSWORD<br/>KINTONE_DOMAIN]
        AgentToolset --> HelperLib
        HelperLib --> EnvVars
    end

    Anthropic --> AgentToolset
    HelperLib -->|Basic 認証| Kintone[kintone REST API]
```

---

## 3. データモデル

### 3.1 プラグイン設定データ

**設計方針**: プラグインに持たせる設定は **Anthropic API Key のみ** とし、Agent / Environment / Vault のリソース識別は **Managed Agents の metadata を動的参照** することで実現する。プラグイン側にはリソース ID をキャッシュしない。

#### 3.1.1 管理者入力項目 (kintone Proxy 設定)

| フィールド | 保存先 | 必須 | 説明 |
|-----------|--------|:---:|------|
| `anthropicApiKey` | kintone Proxy 設定 (固定ヘッダ) | ✓ | Anthropic API Key。ブラウザ JS からは参照不可 |

**プラグイン設定 (`kintone.plugin.app.setConfig`) には一切の永続データを保存しない**。

#### 3.1.2 Managed Agents 側のリソース識別 (metadata ベース動的参照)

各リソースはプラグインが所有するものだけを metadata でフィルタして取得する。

##### Agent

| metadata キー | 値 | 用途 |
|--------------|-----|------|
| `source` | `"cowork-agent-for-kintone"` | プラグインが管理する Agent を識別 |
| `type` | `"default"` / `"custom"` | デフォルト / カスタム Agent の区別 |
| `createdBy` | `<kintoneUserCode>` | カスタム Agent の作成者 (`type = custom` のみ) |

**取得方法**: `GET /v1/agents` で全件取得 → クライアント側で `metadata.source === "cowork-agent-for-kintone"` でフィルタ

> **注意**: Managed Agents API はサーバ側 metadata フィルタ検索を未サポート。全件取得 → クライアント側フィルタの方式で実装する。件数増加時は `limit` / `page` でページング。

##### Environment

| metadata キー | 値 | 用途 |
|--------------|-----|------|
| `source` | `"cowork-agent-for-kintone"` | プラグイン管理の Environment を識別 |
| `kintoneDomain` | `<location.hostname>` | 複数の kintone 環境との混在を防ぐ |
| `kintoneUserCode` | `<user code>` | ユーザー特定 |

**取得方法**: `GET /v1/environments` で全件取得 → クライアント側で `metadata.source` / `kintoneUserCode` / `kintoneDomain` を組み合わせてフィルタ (サーバ側 metadata フィルタ未サポートのため)

##### Vault Secret

| metadata キー | 値 | 用途 |
|--------------|-----|------|
| `source` | `"cowork-agent-for-kintone"` | 同上 |
| `kintoneDomain` | `<location.hostname>` | 同上 |
| `kintoneUserCode` | `<user code>` | 同上 |

**取得方法**: `GET /v1/vaults` で全件取得 → クライアント側でフィルタ

#### 3.1.3 リソース命名規則 (name / display_name / title)

metadata を **Source of Truth** とし、`name` / `display_name` は **Anthropic Console や API レスポンスで人間が判別するための表示用ラベル** と位置付ける。機械的識別・検索は常に metadata で行い、name はあくまで可読性向上を目的とする。

##### 命名テンプレート

| リソース | フィールド | 命名テンプレート | 例 |
|---------|-----------|----------------|----|
| Agent (default) | `name` | `Cowork Agent - Default` | `Cowork Agent - Default` |
| Agent (custom, Phase2) | `name` | `Cowork Agent - Custom: <user-provided>` | `Cowork Agent - Custom: 営業支援用` |
| Environment | `name` | `Cowork Agent - <kintoneUserCode>@<kintoneDomain>` | `Cowork Agent - sato@example.cybozu.com` |
| Vault | `display_name` | `Cowork Agent - <kintoneUserCode>@<kintoneDomain>` | `Cowork Agent - sato@example.cybozu.com` |
| Session | `title` | 初期: `新規会話 - <YYYY-MM-DD HH:mm>` / 会話後: Agent が要約して更新 | `新規会話 - 2026-04-23 10:30` |

##### 設計方針

- **プレフィックス `Cowork Agent` を全リソース共通で付与**: Anthropic Console で他ツール由来のリソースと混在しても本プラグイン由来と一目で分かる
- **Environment / Vault に `<kintoneUserCode>@<kintoneDomain>` を含める**: 管理者が Console でユーザー単位の状態を目視確認しやすい
- **文字数制限に配慮**: Agent/Environment name 256 文字、Vault display_name 255 文字以内 (kintoneUserCode + kintoneDomain を含めても十分余裕あり)
- **同じ情報を metadata にも保持する冗長は許容**: name は表示用、metadata は機械識別用と役割が分かれるため

##### Session title の運用

- Session 作成直後: `新規会話 - <日時>` で初期化
- 会話進行後: Agent が会話の主題を短いタイトルに要約し、Session の `title` を更新 (Phase2 で自動化、MVP は初期値のまま)

#### 3.1.4 実行時に動的取得する情報

| フィールド | 取得方法 |
|-----------|---------|
| `kintoneDomain` | `location.hostname` |
| `kintoneUserCode` | `kintone.getLoginUser().code` |
| `agentId` / `environmentId` / `vaultSecretRef` | Managed Agents API を全件リスト取得 → クライアント側で metadata フィルタ |

#### 3.1.5 セットアップフロー

##### (A) 管理者セットアップ (一度だけ)

```
[管理者セットアップ]
  Anthropic API Key 入力 → Proxy 設定へ保存
  完了 (プラグイン設定には何も書かない)
```

##### (B) ユーザー初回利用フロー (チャット起動時に毎回判定)

```
ユーザーがチャット UI を開く
  ↓
1. Environment / Vault を全件リスト取得 → クライアント側で metadata フィルタ
     条件: source=cowork-agent-for-kintone
         & kintoneDomain=<location.hostname>
         & kintoneUserCode=<kintone.getLoginUser().code>
  ↓
  ├─ 見つかった → そのまま利用 (再利用)
  └─ 見つからない → [kintone 認証情報入力ダイアログ]
                    ログイン名 / パスワード入力
                      ↓
                    a. Vault 作成 (metadata 付与) → 認証情報を Vault に保存
                    b. Environment 作成 (metadata 付与、Vault バインド)
                      ↓
                    完了
  ↓
2. Agent を全件リスト取得 → クライアント側で metadata.type=default でフィルタ
  ├─ 見つかった → 利用
  └─ 見つからない → Default Agent を作成 (metadata 付与)
  ↓
チャット開始
```

> **パフォーマンス想定**: MVP ではユーザー数が少ない前提のため全件取得＋クライアントフィルタで実用上問題なし。ユーザー数が 100 を超える規模で利用される場合は、別途キャッシュ機構の導入を検討する (ただしプラグイン設定は管理者限定のため、一般ユーザーが書き込めるキャッシュは設計上不可能。ブラウザローカルストレージや kintone アプリへの保存などが候補)。

> **注意**: Agent は全ユーザー共用のため、競合回避のため「作成前に再検索」する simple なロック戦略を採用 (同時インストール直後の競合は Environment / Vault のクリーンアップ処理で救済)。

##### (C) カスタム Agent の作成 (Phase2)

```
カスタム Agent 作成 UI
  ↓
name / systemPrompt / tools の設定
  ↓
Managed Agents API で Agent 作成
  metadata: { source, type=custom, createdBy=<user> }
```

### 3.2 セッションデータ

**クライアントローカルには永続化しない**。Session も Managed Agents に metadata 付きで作成し、起動時に動的参照する。

#### Session metadata

| metadata キー | 値 | 用途 |
|--------------|-----|------|
| `source` | `"cowork-agent-for-kintone"` | プラグイン管理 Session の識別 |
| `kintoneDomain` | `<location.hostname>` | 環境識別 |
| `kintoneUserCode` | `<user code>` | ユーザー識別 |
| `agentId` | `<agent id>` | どの Agent に紐づく Session か (将来のカスタム Agent 切替時に利用) |

#### 取得方法

`GET /v1/sessions?agent_id=<defaultAgentId>&order=desc&limit=100` で対象 Agent の最新 Session 一覧を取得し、クライアント側で `metadata.kintoneUserCode` / `metadata.kintoneDomain` を照合して自ユーザー分を抽出。最新のものを継続利用する。

> Sessions List は API レベルで `agent_id` によるフィルタをサポートしているため、他リソースに比べて絞り込みが効く。

#### セッション継続ポリシー (MVP)

- ユーザーが「新規会話」を明示選択しない限り、**最新の Session を継続**
- 「新規会話」押下時は新しい Session を作成 (同じく metadata 付与)
- 古い Session は Managed Agents 側で保持される (クリーンアップは運用検討事項)

#### キャッシュ

ページロード中のみメモリ上に現在の `sessionId` を保持 (ResourceResolver のキャッシュに含める)。ブラウザ再読込時は metadata 検索で再解決する。

### 3.3 会話履歴

Managed Agents の Session が正とする (プラグイン側では UI 表示用にキャッシュのみ)。

| フィールド | 型 | 説明 |
|-----------|------|------|
| `messageId` | string | メッセージID |
| `role` | `user` \| `assistant` \| `tool` \| `system` | 発信者種別 |
| `content` | string | メッセージ本文 |
| `toolCalls` | object[] | ツール呼出情報 (ツール名、引数、結果) |
| `status` | `pending` \| `running` \| `completed` \| `failed` \| `awaiting_approval` | タスク状態 |
| `timestamp` | ISO8601 string | タイムスタンプ |

### 3.4 Vault 格納情報

Managed Agents の Vault にユーザーごとに格納する秘匿情報。**Session 作成時に `vault_ids` を指定すると、Environment コンテナに環境変数として自動注入される**。

| 環境変数名 | 値 | 説明 |
|-----------|-----|------|
| `KINTONE_LOGIN` | string | kintone ログインユーザー名 |
| `KINTONE_PASSWORD` | string | kintone ログインパスワード |
| `KINTONE_DOMAIN` | string | kintone ドメイン (例: `example.cybozu.com`)。Session 作成時にプラグイン側から Vault に書き込む |

> **MVP 方針**: kintone ユーザー単位で個別に Vault Secret を作成し、Agent の実行スクリプトは環境変数経由でのみ認証情報にアクセス可能とする (Vault 本体への直接アクセスは不可)。

### 3.5 ER 図

```mermaid
erDiagram
    Agent ||--o{ Session : "runs"
    Environment ||--|| VaultSecret : "binds"
    Environment ||--o{ Session : "executes in"
    Session ||--|{ Message : "contains"
    Message ||--o{ ToolCall : "invokes"

    ProxyConfig {
        string anthropicApiKey "管理者入力"
    }
    Agent {
        string agentId PK
        string name
        string systemPrompt
        object metadata "source, type, createdBy"
    }
    Environment {
        string environmentId PK
        array preinstalledTools
        array networkAllowList
        object metadata "source, kintoneDomain, kintoneUserCode"
    }
    VaultSecret {
        string secretRef PK
        string kintone_login
        string kintone_password
        object metadata "source, kintoneDomain, kintoneUserCode"
    }
    Session {
        string sessionId PK
        string agentId FK
        string environmentId FK
        datetime createdAt
        datetime lastActiveAt
        object metadata "source, kintoneDomain, kintoneUserCode, agentId"
    }
    Message {
        string messageId PK
        string sessionId FK
        enum role
        string content
        enum status
        datetime timestamp
    }
    ToolCall {
        string toolCallId PK
        string messageId FK
        string toolName
        json args
        json result
    }
```

---

## 4. ユースケース

### 4.1 ユースケース図

```mermaid
graph LR
    User((業務ユーザー))
    Admin((プラグイン管理者))

    User --> UC1[レコード検索・集計を依頼]
    User --> UC2[レコード作成を依頼]
    User --> UC3[レコード更新を依頼]
    User --> UC4[レコード削除を依頼]
    User --> UC5[破壊的操作を承認]
    User --> UC6[会話履歴を継続]
    User --> UC7[実行中タスクを確認]
    User --> UC11[初回 kintone 認証情報を登録]
    User --> UC12[接続情報をリセット]

    Admin --> UC8[Anthropic API Key を設定]
    Admin --> UC10[プラグインを有効化するアプリを選択]
    Admin --> UC13[カスタム Agent 管理 (Phase2)]
```

### 4.2 主要ユースケース詳細

#### UC-01: レコード検索・集計を依頼 (F-02)

| 項目 | 内容 |
|------|------|
| 主アクター | 業務ユーザー |
| 事前条件 | プラグインが有効化済、API Key / Vault が設定済 |
| 基本フロー | 1. チャットで「○○を検索して」と入力<br/>2. Managed Agent が `get_app_schema` → `get_records` を呼出<br/>3. 結果を要約・集計してチャットに返答 |
| 例外 | API エラー時はチャット UI にエラーメッセージ表示 |

#### UC-02: レコード一括更新を依頼 (F-04, F-07)

| 項目 | 内容 |
|------|------|
| 主アクター | 業務ユーザー |
| 事前条件 | UC-01 と同じ |
| 基本フロー | 1. 「カテゴリ未設定のレコードを『未分類』にして」と入力<br/>2. Agent が対象レコードを `get_records` で抽出<br/>3. **実行計画を提示** (対象件数、変更内容)<br/>4. ユーザーが「許可」ボタン押下<br/>5. `update_records` を呼出<br/>6. 結果をチャットに返答 |
| 例外 | ユーザーが承認せず「キャンセル」した場合は実行しない |

#### UC-03: アプリ横断データ転記 (F-06)

| 項目 | 内容 |
|------|------|
| 主アクター | 業務ユーザー |
| 基本フロー | 1. 「問合せアプリの未対応レコードを案件アプリに転記して」と入力<br/>2. Agent が問合せアプリスキーマ取得<br/>3. 該当レコード抽出 → 実行計画提示<br/>4. 承認後、案件アプリに `add_records`<br/>5. 結果を報告 |

---

## 5. 画面設計

### 5.1 画面一覧

| 画面 ID | 画面名 | 配置 |
|--------|--------|------|
| S-01 | チャットサイドパネル | kintone レコード一覧画面 |
| S-02 | プラグイン設定画面 | kintone プラグイン管理画面 |

### 5.2 画面遷移図

```mermaid
graph TD
    Start[kintone ログイン] --> ListView[レコード一覧画面]
    ListView -->|サイドパネル展開| Chat[S-01 チャットパネル]
    Chat -->|破壊的操作要求| Approval[承認ダイアログ]
    Approval -->|許可| Chat
    Approval -->|キャンセル| Chat
    Chat -->|ユーザー切替/再ログイン| ListView

    AdminStart[kintone 管理画面] --> PluginConfig[S-02 プラグイン設定画面]
    PluginConfig -->|保存| AdminStart
```

### 5.3 S-01 チャットサイドパネル

デザインハンドオフ (`docs/design_handoff_cowork_agent/`) の Rich variant を基に実装する。高忠実度 (hi-fi) のトークン・余白・アイコン・インタラクションを厳密に再現すること。

#### 5.3.1 レイアウト構造

**固定幅 380px の縦レイアウト。上から Header / Chat scroll area / Composer の 3 ブロック。**

```
┌─────────────────────────────────────────────┐
│  Header (高さ 60px 前後、半透明 + blur)       │
│  ┌──┐  Aoi  [AGENT]                         │
│  │★ │ ● 作業中 · kintone接続       [⚯][⚙][×]│
│  └──┘                                       │
├─────────────────────────────────────────────┤
│                                             │
│  Chat scroll area (flex:1, padding 18/16)   │
│                                             │
│   [Greeting card]                  (初回のみ)│
│   [Suggestion chips × 3]                    │
│                                             │
│   ┌──────────┐                              │
│   │ User msg │ 右寄せ、radius 16/16/4/16    │
│   └──────────┘                              │
│                                             │
│   ●[Thinking …]  または                     │
│   ●[Agent message] 左寄せ、アバター 22×22   │
│                                             │
│   [Tool call card] チェック+ツール名+詳細    │
│                                             │
│   ⚠ [Plan card (destructive=true)]          │
│     ・Step 1 … ・Step 2 …                  │
│     [承認して実行] [修正] [キャンセル]       │
│                                             │
│   [Progress card] スピナー + バー + substeps│
│                                             │
│   [Result card] ヘッダ + Rows + followup    │
│                                             │
├─────────────────────────────────────────────┤
│  Composer (固定、半透明 + blur)               │
│  ┌─────────────────────────────────────┐    │
│  │ このアプリについて聞く / レコードを… │📎│→ │
│  └─────────────────────────────────────┘    │
│     ⌘K 呼び出し · Claude Managed Agents      │
└─────────────────────────────────────────────┘
```

#### 5.3.2 Header 詳細

| 要素 | 仕様 |
|------|------|
| Avatar | 34×34px, `border-radius: 10px`, 背景はアクセント色からの 135° グラデーション (`accent` → `accent+40`), 中央に 18×18 の星型アイコン (stroke 1.8), shadow `0 4px 14px accent40` |
| Status dot | Avatar 右下 11×11px, 緑 `#22c55e`, 2px パネル背景ボーダー |
| Agent 名 | "Aoi" (14px / weight 600, `text`) |
| AGENT バッジ | 10px / weight 500、`accent` 文字、`accentSoft` 背景、radius 4、padding 1/6 |
| Status line | 11px / `muted`、9×9 時計アイコン + "作業中 · kintone接続" |
| Icon buttons | タスク / 設定 / 閉じる。30×30, 透明背景, `muted`, radius 8, アイコン 12-14px stroke 1.5-1.6 |
| 背景 | `panel` (半透明), `backdrop-filter: blur(12px)`, 下 1px ボーダー |

#### 5.3.3 Composer 詳細

| 要素 | 仕様 |
|------|------|
| コンテナ | padding 10/14/14, 上 1px ボーダー, `panel` 背景, blur 12 |
| 入力ラッパー | radius 14, padding 8/8/8/14, `card` 背景, `box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px accentSoft inset` |
| Input | placeholder "このアプリについて聞く / レコードを操作..." |
| 添付ボタン | 30×30, radius 8 |
| 送信ボタン | 32×32, radius 10, accent グラデ背景, 白矢印アイコン, shadow `0 2px 8px accent55` |
| ヒント行 | 下に 10px `subtle`: `⌘K 呼び出し · Claude Managed Agents` |

#### 5.3.4 密度 (Density) 設定

ユーザー設定または管理者設定で切替可能 (MVP は Comfortable 固定)。

| | Compact | Comfortable (既定) | Airy |
|---|---|---|---|
| メッセージ間 gap | 10 | 14 | 18 |
| scroll padding top | 14 | 18 | 22 |

### 5.4 S-02 プラグイン設定画面 ワイヤフレーム

#### (A) 管理者プラグイン設定画面

```
┌─────────────────────────────────────────────────┐
│  Cowork Agent プラグイン設定                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  Anthropic API Key (必須):                      │
│  [sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxx   ]          │
│  ※ 保存後は Proxy 設定で保護され、参照不可となります│
│                                                 │
│  [接続テスト]                                   │
│                                                 │
│               [保存]  [キャンセル]              │
│                                                 │
│  ─── 情報 ───                                   │
│  ・Agent / Environment / Vault は Managed Agents│
│    側のメタデータから動的参照されるため、        │
│    プラグイン側には保存されません。              │
│  ・Agent の管理は Anthropic Console からも可能   │
│    です。                                       │
└─────────────────────────────────────────────────┘
```

#### (B) ユーザー初回バインディングダイアログ (チャット初回起動時)

```
┌─────────────────────────────────────────────────┐
│  Cowork Agent へようこそ                         │
├─────────────────────────────────────────────────┤
│                                                 │
│  ご利用を開始するために、kintone のログイン情報を│
│  登録してください。                              │
│                                                 │
│  ※ 入力情報は Claude Managed Agents の Vault に │
│     安全に保管され、あなた専用の実行環境で       │
│     kintone 操作に利用されます。                │
│                                                 │
│  kintone ログイン名:                            │
│  [your_login_name                     ]         │
│                                                 │
│  kintone パスワード:                            │
│  [●●●●●●●●●●                        ]          │
│                                                 │
│          [登録して開始] [キャンセル]             │
└─────────────────────────────────────────────────┘
```

**登録完了後:** ユーザー専用の Vault Secret / Environment が自動作成され、以降はチャット UI が直接開く。再入力は不要 (ユーザーが明示的に「接続情報をリセット」操作をしない限り)。

---

### 5.5 デザイントークン

ハンドオフから確定した値。Tailwind の `theme.extend` と CSS カスタムプロパティにそれぞれ定義し、ランタイムでテーマ切替可能にする。

#### 5.5.1 アクセント色

- **`#0d9488`** (Teal) — Rich variant のプライマリアクセント。全 CTA / リンク / プログレスバー / グラデに使用

#### 5.5.2 Light theme (既定)

| トークン | 値 | 用途 |
|---|---|---|
| `bg` | `#faf8f3` | パネル背景 (ウォームオフホワイト) |
| `panel` | `rgba(255,255,255,0.85)` | Header / Composer の半透明レイヤー |
| `border` | `rgba(35,18,0,0.10)` | 一般 1px ボーダー |
| `text` | `#231200` | 主要テキスト (濃茶) |
| `muted` | `#6b5f4a` | 補助テキスト |
| `subtle` | `#a89d85` | さらに弱い (ヒント、メタ) |
| `card` | `#ffffff` | カード背景 |
| `cardBorder` | `rgba(35,18,0,0.08)` | カードの薄ボーダー |
| `cardHi` | `rgba(255,191,0,0.06)` | ホバー / tool カード背景 (薄アンバー) |
| `accent` | `#0d9488` | プライマリアクセント |
| `accentSoft` | `#0d94881a` | accent 10% alpha — バッジ / プログレスレール |
| `user` | `#0d948814` | user バブル背景 (accent 8% alpha) |
| `userBorder` | `#0d948840` | user バブル ボーダー (accent 25% alpha) |
| `warn` | `#b45309` | 破壊的操作アクセント (アンバー濃) |
| `warnSoft` | `#fef3c7` | 破壊的 Plan ヘッダー帯 |
| `ok` | `#8a6400` | 完了チェック (kintone アンバーの濃色) |
| `okSoft` | `#fff4c9` | tool call アイコン背景 |

#### 5.5.3 Dark theme

| トークン | 値 |
|---|---|
| `bg` | `#1a160f` |
| `panel` | `rgba(34,28,19,0.75)` |
| `border` | `rgba(255,191,0,0.12)` |
| `text` | `#ede4d0` |
| `muted` | `#a89d85` |
| `subtle` | `#6b6353` |
| `card` | `rgba(42,34,23,0.85)` |
| `cardBorder` | `rgba(255,191,0,0.12)` |
| `cardHi` | `rgba(255,191,0,0.05)` |
| `warn` | `#f59e0b` |
| `warnSoft` | `#f59e0b22` |
| `ok` | `#ffbf00` |
| `okSoft` | `#ffbf0022` |

#### 5.5.4 色選定の根拠

- ベース背景 `#faf8f3` / テキスト `#231200` はホスト kintone のダークチョコヘッダー + ウォームオフホワイトの配色に合わせている
- 警告・OK 系は kintone ブランドのアンバー `#ffbf00` 周辺でまとめ、プライマリアクセントのティールが視覚的に主張するようコントラスト設計

#### 5.5.5 タイポグラフィ

- ベースフォント: `-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, sans-serif` (継承想定、システムフォント)
- モノスペース: `"JetBrains Mono", "SF Mono", Consolas, monospace` — tool 名 / 番号チップ / kbd のみ
- サイズスケール (px): `9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 16`
- 行高: テキスト 1.5-1.6, 見出し 1.25-1.4
- weight: 500 (通常), 600 (強調), 700 (数字ハイライト)

#### 5.5.6 Spacing

- メッセージ間 gap: `compact 10 / comfortable 14 / airy 18` (§5.3.4 Density 参照)
- カード内 padding: 8-14px
- 縦方向 rhythm は 4px グリッド

#### 5.5.7 Radius

- 小: 4 / 6 / 8 (badge / button / icon)
- 中: 10 / 12 (card / input)
- 大: 14 (primary card, plan, result, composer wrapper)
- バブル: `16 / 16 / 4 / 16` (user の発話方向)、`16 / 16 / 16 / 4` (agent)
- 丸: 999 (pill), 50% (avatar / status dot)

#### 5.5.8 Shadow

- カード通常: `0 2px 12px rgba(0,0,0,0.04)`
- Result カード: `0 4px 20px rgba(0,0,0,0.04)`
- Destructive Plan: `0 0 0 4px #b4530915, 0 4px 20px #b4530920` (グロー)
- Avatar: `0 4px 14px <accent>40`
- 送信ボタン: `0 2px 8px <accent>55`
- Composer inset: `0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px <accentSoft> inset`

---

### 5.6 メッセージカード仕様

Chat scroll area に表示されるメッセージカードは以下の 7 種類。`kind` フィールドで判別する。

#### 5.6.1 Greeting (初回のみ)

- タイトル: 16px / weight 600 / letter-spacing -0.3 / line-height 1.4
  "こんにちは。今日はどんな作業をお手伝いしましょうか？"
- サブ文言: 12px / `muted`
  "アプリ検索、集計、レコード操作まで。思いついたことを話しかけてください。"
- **Suggestion chips × 3**: 左寄せ、12.5px、`card` 背景、1px `cardBorder`、radius 10、padding 10/12、先頭に 20×20 矢印アイコン (`accentSoft` 背景)

#### 5.6.2 User message

- `align-self: flex-end`, max-width 85%
- 背景 `user`, ボーダー 1px `userBorder`
- radius `16 16 4 16` (右下だけ小さく、発話の尻尾を表現)
- padding 10/14, 13px, line-height 1.5

#### 5.6.3 Agent bubble / Thinking

- 左寄せ、gap 8px で 22×22 アバター円 (Header と同じグラデ) + 本文
- **Thinking**: 12px / `muted` + アクセント色の "..." 3 ドットアニメ
- **Agent message**: 13px / line-height 1.5 / `text` 色

#### 5.6.4 Tool call card

- 背景 `cardHi` (accent を 6% 乗せた半透明), ボーダー `cardBorder`
- radius 10, padding 8/11
- 左に 20×20 チェックアイコン (`okSoft` 背景、`ok` 色)
- モノスペース小文字のツール名 (10.5px, `accent`, weight 600) + ラベル (12px / weight 500)
- 11px `muted` で detail、続けて items を `accentSoft` 背景の小ピルで表示

#### 5.6.5 Plan card (HITL)

- **コンテナ**: `card` 背景、radius 14、1px ボーダー
- **Destructive 時**: ボーダー `warn + 55`, shadow `0 0 0 4px warn15, 0 4px 20px warn20` (グロー)
- **ヘッダー帯**: padding 10/14、`warnSoft` (destructive) / `accentSoft` (read-only) 背景、下 1px ボーダー
  - 14×14 アイコン (三角警告 or リスト) + 12.5px weight 600 タイトル + 右端に "要承認" / "読取" ラベル
- **本体**: padding 14、`<ol>` でステップ列挙
  - 各ステップ: 22×22 番号チップ (モノスペース 10px、`accentSoft` 背景、`accent` 文字) + `op` (9.5px upper, letter-spacing 0.6, `muted`) + `text` (12.5px)
- **見積行**: 上に 1px dashed ボーダー、時計アイコン + 11px `muted`
- **Destructive 時**: 3 ボタン横並び (gap 6, marginTop 12)
  - 「**承認して実行**」 — flex:1, padding 9/12, 12.5px weight 600, 背景 `warn`, 白文字, radius 8
  - 「**修正**」「**キャンセル**」 — 透明背景, 1px `border`, `muted` 文字, radius 8

#### 5.6.6 Progress card

- `card` 背景, 1px ボーダー, radius 12, padding 13
- **上段**: 22×22 スピナー (2px `accentSoft` リング + top のみ `accent`、0.9s 回転) + タイトル (12.5 / w600) + サブ (10.5 / `muted`) + 大きい % (16px / w700 / `accent` / tabular-nums)
- **プログレスバー**: 高さ 6, radius 3, `accentSoft` 背景、内側バー `linear-gradient(90deg, accent, accent+40)` + シマーアニメ
- **Substeps**: 縦並び 5px gap、13×13 円 (済: `ok` 塗り + 白チェック / 未: 1.5px border), 11.5px テキスト

#### 5.6.7 Result card

- `card`, 1px ボーダー, radius 14, shadow `0 4px 20px rgba(0,0,0,0.04)`
- **ヘッダー**: padding 12/14, `linear-gradient(135deg, accentSoft, transparent)` 背景, 下 1px ボーダー
  - 13.5px / w600 / letter-spacing -0.2 タイトル + 11px `muted` サブ
- **Rows**: 各 padding 7/0, 最後以外下 1px ボーダー
  - 上段 flex: 20×20 頭文字アバター (HSL を index×62° で回して色付け) + 12.5px / w500 名前 + 10.5 `subtle` 件数 + 右端 12.5 / w600 / tabular-nums 金額 (万円区切り + 10px "万")
  - 下段 `margin-left: 28` ミニバー (高さ 3, グラデ)
- **フッター**: `cardHi` 背景, followup ピルボタン (padding 5/11, radius 999, 矢印アイコン + 11px テキスト)

---

### 5.7 インタラクション・アニメーション

#### 5.7.1 アニメーション

| 対象 | 仕様 |
|------|------|
| Thinking dots | 3 ドットが順次 fade (0.4s 間隔、infinite) |
| Progress spinner | 0.9s linear infinite rotate |
| Progress bar shimmer | バー内側に `::before` で白い光スイープ (2s linear infinite) |
| 新着メッセージ | `opacity 0 → 1`, `translateY 4px → 0`, 200ms (参照 CSS `.msg-in`) |

#### 5.7.2 ホバー / フォーカス状態

- Suggestion chip, followup pill, icon button: hover で border を `accent`、背景を `accentSoft` に
- 入力: focus 時にラッパー border を `accent`、inset shadow を `accent+33` に強化

#### 5.7.3 キーボードショートカット

| キー | 動作 |
|------|------|
| `⌘K` (Mac) / `Ctrl+K` (Win) | チャットパネルの開閉トグル |
| `Enter` | メッセージ送信 (composer フォーカス時) |
| `Shift + Enter` | 改行 |
| `Esc` | モーダル / 承認カード閉じる、フォーカス解除 |

#### 5.7.4 スクロール / パネル状態

- パネル内スクロールが親に bubble しないよう `overscroll-behavior: contain` を付与
- **パネル開閉状態** のみブラウザの `localStorage` に保存して次回起動時に復元 (キー: `cowork-agent:isOpen`)
  - 認証情報・会話履歴・Session ID 等の永続化は禁止 (§3.2 ステートレス原則)

---

### 5.8 アセット

| アセット | 方針 |
|---------|------|
| アイコン | すべてインライン SVG (外部ライブラリ依存なし)。stroke ベース、`stroke-width: 1.5-1.8`、`stroke-linecap: round`、`stroke-linejoin: round` |
| フォント | システムフォント + 日本語ゴシック。JetBrains Mono は必要に応じて CDN 読込 (プラグイン zip には同梱しない) |
| 画像 | なし |
| ロゴ | Header アバターのみ (星 / コンパス型 SVG) |

---

## 6. kintone ヘルパーライブラリ設計

Managed Agents の仕様上、「Custom Tool」は**クライアント側**で実行される仕組みであり、Environment 側で実行することはできない。バックグラウンド実行を実現するため、本プロダクトでは Environment に **kintone ヘルパーライブラリ** をプリインストールし、Agent が `agent_toolset_20260401` の `bash` + `write` + `read` を使ってスクリプトを組み立てて呼び出す構成を採用する。

### 6.1 実装方式

- **言語**: Python (MVP)
- **形態**: OSS の pip パッケージ (例: `cowork-agent-kintone`)
- **プリインストール**: Environment 作成時の `config.packages.pip` に指定
- **配布先**: PyPI + GitHub リポジトリ

### 6.2 Environment 設定例

```js
{
  config: {
    type: 'cloud',
    networking: {
      type: 'limited',
      allow_package_managers: true,
      allowed_hosts: ['<kintoneDomain>'],  // ユーザーの kintone ドメインを動的に設定
    },
    packages: {
      pip: ['cowork-agent-kintone', 'requests'],
    },
  },
  metadata: {
    source: 'cowork-agent-for-kintone',
    kintoneDomain: '<domain>',
    kintoneUserCode: '<user code>',
  },
}
```

### 6.3 Agent 設定例

```js
{
  model: 'claude-sonnet-4-6',
  name: 'Cowork Agent (Default)',
  system: `あなたは kintone の業務支援エージェントです。
  ユーザーからの依頼を kintone ヘルパーライブラリ (cowork-agent-kintone) を使って遂行します。
  破壊的操作(更新/削除)の前には必ず実行計画を提示し、ユーザーの承認を得てから実行してください。
  ライブラリの使い方:
    from cowork_agent_kintone import Client
    client = Client()  # 環境変数から認証情報を自動読込
    records = client.get_records(app=123, query='...')`,
  tools: [{
    type: 'agent_toolset_20260401',
    configs: {
      bash:  { enabled: true, permission_policy: { type: 'always_allow' } },
      write: { enabled: true, permission_policy: { type: 'always_allow' } },
      read:  { enabled: true, permission_policy: { type: 'always_allow' } },
    },
  }],
  metadata: {
    source: 'cowork-agent-for-kintone',
    type: 'default',
  },
}
```

### 6.4 ヘルパーライブラリ API (MVP)

| メソッド | 用途 | 主要引数 | 返却値 |
|---------|------|---------|--------|
| `Client()` | クライアント初期化 (環境変数から認証情報自動取得) | なし | Client instance |
| `get_apps(limit?, offset?)` | 利用可能アプリ一覧取得 | `limit`, `offset` | list[App] |
| `get_app_schema(app)` | アプリのフィールド定義取得 | `app` | dict |
| `get_form_layout(app)` | フォームレイアウト取得 | `app` | dict |
| `get_records(app, query?, fields?, total_count?)` | レコード取得 (10,000 件超はカーソル API で自動継続) | `app`, `query`, `fields`, `total_count` | list[Record] |
| `add_records(app, records)` | レコード一括追加 (100 件超は自動分割) | `app`, `records` | list[id] |
| `update_records(app, records)` | レコード一括更新 (100 件超は自動分割) | `app`, `records` | dict |
| `delete_records(app, ids, revisions?)` | レコード一括削除 (100 件超は自動分割) | `app`, `ids`, `revisions` | dict |
| `bulk_request(requests)` | 複数操作のアトミック実行 (最大 20 操作) | `requests` | list[result] |

### 6.5 ライブラリ内部仕様

#### 認証
```python
# 環境変数から自動取得
KINTONE_LOGIN = os.environ['KINTONE_LOGIN']
KINTONE_PASSWORD = os.environ['KINTONE_PASSWORD']
KINTONE_DOMAIN = os.environ['KINTONE_DOMAIN']

# Basic 認証ヘッダを生成
auth = base64.b64encode(f'{KINTONE_LOGIN}:{KINTONE_PASSWORD}'.encode()).decode()
headers = {'X-Cybozu-Authorization': auth}
```

#### エラーハンドリング
- kintone REST API のエラーレスポンスは例外化 (`KintoneApiError`) し、エラーコード・メッセージを保持
- Agent は例外メッセージを読んでユーザーに自然言語で説明

#### 大量データ処理
- `get_records`: `offset/limit` と カーソル API の両方を内包し、10,000 件超は自動でカーソルに切替
- `add/update/delete_records`: 100 件超の引数は自動で 100 件ずつのチャンクに分割して直列実行 (kintone 標準制約)

### 6.6 Agent がヘルパーライブラリを使うフロー例

```
ユーザー: 「カテゴリが未分類のレコードを20件削除して」
  ↓
Agent が write でスクリプト作成:
  /tmp/script.py
    from cowork_agent_kintone import Client
    c = Client()
    recs = c.get_records(app=42, query='カテゴリ = "" limit 20')
    print(recs)
  ↓
Agent が bash で実行: python /tmp/script.py
  ↓
結果を確認、実行計画をユーザーに提示
  ↓
ユーザー承認後、削除スクリプトを write + bash で実行
  c.delete_records(app=42, ids=[...])
```

---

## 7. API 設計 (プラグイン内)

### 7.1 Claude Managed Agents API 呼出 (すべて kintone.proxy 経由)

| 呼出 | 用途 | 呼出タイミング |
|------|------|---------------|
| `GET /v1/agents` | Agent 一覧取得 → クライアント側で metadata フィルタ | 初回利用時、セッション復元時 |
| `POST /v1/agents` | Default Agent 作成 | Agent が未作成の場合 |
| `GET /v1/environments` | Environment 一覧取得 → ユーザー分をフィルタ | ユーザー初回バインディング時 |
| `POST /v1/environments` | ユーザー専用 Environment 作成 | バインディング未登録時 |
| `GET /v1/vaults` | Vault 一覧取得 → ユーザー分をフィルタ | ユーザー初回バインディング時 |
| `POST /v1/vaults` | ユーザー専用 Vault 作成 | バインディング未登録時 |
| `GET /v1/sessions?agent_id=...&order=desc` | Session 一覧取得 → metadata フィルタで自ユーザー分抽出 | チャット UI 起動時 |
| `POST /v1/sessions` | 新規セッション作成 | 該当 Session 無しか「新規会話」押下時 |
| `POST /v1/sessions/{id}/events` | イベント送信 (`user.message` / `user.custom_tool_result` / `user.tool_confirmation` / `user.interrupt`) | ユーザー送信・承認・中断時 |
| `GET /v1/sessions/{id}/events?order=asc&limit=...&page=...` | イベント一覧取得 (ポーリング) | メッセージ送信後、定期的に呼出 |
| `GET /v1/sessions/{id}` | セッション状態 (status, stats) 取得 | ポーリング補助 |

### 7.1.1 ポーリング戦略

Managed Agents API は **時点指定カーソル (`since`) を未サポート**。そのため以下の方式で差分取得を実現する。

| 項目 | 値 |
|------|-----|
| ポーリングエンドポイント | `GET /v1/sessions/{id}/events?order=asc&limit=100&page=<next_page>` |
| 差分取得方式 | 前回取得した最後のイベント ID を記憶 → 以降のポーリングでは `next_page` カーソル (`page` パラメータ) を使って続きを取得 |
| 初期ポーリング間隔 | 2 秒 |
| バックオフ | `session.status` が `idle` でイベント更新なしなら 2s → 3s → 5s → 10s で段階延長 |
| タスク完了判定 | `session.status_idle` イベント + `stop_reason.type === "end_turn"` または `"retries_exhausted"` |
| タスク完了後 | ポーリング停止 |
| ユーザーがパネルを閉じた場合 | ポーリング停止 (再表示時に最新状態を取得) |
| タイムアウト | 1 リクエスト 30 秒 (kintone.proxy の制約を考慮) |

> **復元方針**: バックグラウンドで長時間タスクが実行されている場合、ユーザーがブラウザを閉じても Managed Agents 側では処理が継続する。次回プラグイン起動時、Session を metadata で再解決 → `GET events?order=asc&limit=100` でページングしながら全イベントを取得し、既知イベント ID との突合で UI を復元する。

### 7.2 kintone プラグイン API 呼出

| API | 用途 |
|-----|------|
| `kintone.plugin.app.getConfig()` | プラグイン設定読込 |
| `kintone.plugin.app.setConfig()` | プラグイン設定保存 |
| `kintone.events.on('app.record.index.show', ...)` | レコード一覧画面表示時のイベント |
| `kintone.getLoginUser()` | ログインユーザー情報取得 (userId) |
| `kintone.plugin.app.proxy(pluginId, url, method, headers, data)` | Anthropic API 呼出 (API Key を proxy 設定側で保護) |

### 7.3 kintone.proxy 設定

Anthropic API へのリクエストはプラグイン管理画面の Proxy 設定に登録し、**API Key をブラウザ側の JS から参照できない形で保存**する。

| 設定項目 | 値 |
|---------|-----|
| URL | `https://api.anthropic.com/v1/*` (Managed Agents の実エンドポイントに合わせる) |
| リクエストヘッダ (固定) | `x-api-key: <Anthropic API Key>`、`anthropic-version: ...` 等 |
| リクエストデータ (固定) | なし (動的にプラグインから指定) |

この仕組みにより、Anthropic API Key は kintone サーバ側にのみ保存され、ブラウザ JS からは直接取得不可となる。

---

## 8. エラーハンドリング方針

| エラー種別 | 発生箇所 | 対応 |
|-----------|---------|------|
| Anthropic API 認証エラー | Managed Agents 呼出 | チャット UI に「API Key を確認してください」と表示、設定画面への誘導 |
| Managed Agents レート制限 | Managed Agents 呼出 | バックオフリトライ、チャット UI に通知 |
| ヘルパーライブラリ実行時の kintone API エラー | Environment (bash/python) | ライブラリが例外化、Agent がユーザーに自然言語で説明 |
| セッション失効 | Managed Agents 呼出 | 自動で新規セッション作成、ユーザーに通知 |
| 環境変数未設定 (認証情報欠落) | Environment | ヘルパーライブラリが明示的エラー。Agent がユーザーに「接続情報リセット」を案内 |

---

## 9. セキュリティ設計

- **API Key の取り扱い**: kintone プラグイン **Proxy 設定** に保存し、ブラウザ JS から直接参照不可とする。プラグインは `kintone.plugin.app.proxy` を介してのみ Anthropic API を呼び出す
- **Vault 利用**: kintone 認証情報はすべて Vault へ格納、プラグイン内のコードや設定ファイルに平文保持しない
- **CSP (Content Security Policy)**: kintone プラグインは外部通信先を manifest で申請する必要がある
  - Anthropic API エンドポイントは `kintone.plugin.app.proxy` 経由で呼び出すため、ブラウザ側の CSP では許可不要 (kintone 側 Proxy 設定で許可)
- **XSS 対策**: チャット表示における Markdown レンダリング時のサニタイズを徹底
- **入力バリデーション**: プラグイン設定画面での入力値検証

---

## 10. 非機能設計

### 10.1 可用性
- Anthropic / kintone のサービス稼働に依存 (SLA 継承)

### 10.2 スケーラビリティ
- プラグイン自体は静的ファイルのみ、スケール要件は Anthropic / kintone 側に委譲

### 10.3 拡張性 (フェーズ 2 以降への備え)
- Custom Tool 群は機能別に分離し、**SaaS 連携ツール追加時もツールセットを拡張するだけで対応可能**な設計とする
- チャット UI のメッセージ型は `tool_call` を汎用化し、kintone 外のツール呼出結果も表現可能にする
- モバイル対応に備え、UI コンポーネントはレスポンシブを意識 (MVP は PC 固定)

---

## 11. 未確定事項 / 今後の検討

### 確定済み (API 仕様確認による)

- Anthropic API 呼出は kintone.proxy 経由に確定 (SSE 非対応)
- **サーバ側 metadata フィルタは未サポート**: 全件リスト取得 → クライアント側フィルタ方式で実装
- **イベント差分取得の `since` カーソルは未サポート**: `page` + `order=asc` + 既知イベント ID 突合で実装
- Session のみ `agent_id` でのサーバ側フィルタが可能

### 今後の検討事項

- カスタムドメイン利用時の Environment ネットワーク許可リスト更新運用 (ユーザー作成時に動的に `allowed_hosts` を設定)
- ヘルパーライブラリのバージョン管理と更新戦略 (Environment を作り直すタイミング)
- kintone.proxy の 1 リクエストあたりタイムアウト・レスポンスサイズ制約への対応 (大量レコード扱い時)
- **ユーザー単位 Environment の管理運用**
  - ユーザー数 100 人超時のリスト取得コスト (ページング対応)
  - 退職者/無効化ユーザーの Environment / Vault クリーンアップ方式 (手動 Console 操作 or 自動)
- **カスタム Agent (Phase2) の仕様**
  - 作成権限 (全ユーザー vs 管理者のみ)
  - Agent ごとのシステムプロンプト / ツールセットのカスタマイズ範囲
  - デフォルト Agent とカスタム Agent の切替 UI
- **Default Agent 作成時の同時実行競合**
  - 別ユーザーが同時に初回起動して Agent を二重作成する可能性 → 作成直前の再検索 + 重複発見時の片方削除ロジックを検討
