# 機能設計書 (Functional Design Document)

**プロダクト名**: Cowork Agent for kintone
**バージョン**: 0.3 (V1 wedge MVP — Custom Skills / Wedge / Custom Agent / Designer 反映)
**最終更新日**: 2026-06-07

---

> **2026-04-26 注**: Phase 1b-3 で大きな設計変更がありました。
>
> - kintone 認証を **Basic 認証 + Python ヘルパーライブラリ** から **OAuth (Authorization Code + PKCE) + MCP Server (Cloudflare Workers)** に変更
> - Vault には ID/PW ではなく **`mcp_oauth` 型 Vault Credential** で access/refresh token を保管
> - Environment は **`networking.allow_mcp_servers: true`** が必須
> - 詳細シーケンスは下記「§0. V1 wedge MVP シーケンス図」と [`.steering/20260426-phase-1b-3-oauth-pivot/`](../.steering/20260426-phase-1b-3-oauth-pivot/) を参照
>
> 以下 §1 以降の旧設計記述は **Phase 1a/1b-1/1b-2 の歴史記録**として保持しています。最新動作は §0 + [`architecture.md`](architecture.md) が正です。

> **2026-06-07 注**: V1 wedge MVP の機能群を §0 配下に追加しました。
>
> - §0.5 **Custom Skills インフラ** (.skill バンドル同期 / kintone-customize-js / kintone-plugin-development)
> - §0.6 **Customizer Wedge シーケンス** (preview → apply → rollback の 5 状態 + `kintone-customize-bundle` artifact)
> - §0.7 **Agent 詳細編集 + Custom Agent 永続化** (AgentEditDraft / 雛形コピー / archive 削除)
> - §0.8 **プリセットエージェント + クイックアクション** (AgentRecord.quickActions / Composer 下ボタン UX)
> - §0.9 **エージェントデザイナー** (built-in 3rd variant + `propose_agent` Custom Tool + `agent-draft` artifact)
>
> §0.1〜§0.4 (OAuth + MCP) は変更なし。これら V1 機能はすべて §0.1〜§0.4 の通信経路の上に乗っています。

---

## 0. V1 wedge MVP シーケンス図

### 0.1 管理者セットアップ (ConfigScreen 4 ステップ + 保存)

```mermaid
sequenceDiagram
    autonumber
    participant Admin as 管理者 (ブラウザ)
    participant Config as Plugin Config
    participant CF as Cloudflare API
    participant Cybozu as cybozu OAuth 管理画面 (別タブ)
    participant Kintone as kintone (proxy 設定保管)

    Admin->>Config: Step 0: Cloudflare Account ID + API Token
    Config->>CF: kintone.proxy 経由で /workers/scripts PUT (multipart) + /subdomain
    CF-->>Config: Worker URL
    Config->>Config: Worker URL を Step 1 に自動入力 + /version 照合

    Admin->>Config: Step 1: Anthropic API Key 入力
    Config->>Admin: Step 2: callbackUrl + 推奨スコープ + admin 画面リンク
    Admin->>Cybozu: OAuth クライアント追加 → client_id / client_secret
    Admin->>Config: Step 3: client_id / client_secret 入力 + 保存

    Note over Config,Kintone: setProxyConfig × 4 経路を 700ms 間隔で逐次登録
    Config->>Kintone: /oauth2/token (Basic auth fixed header)
    Config->>Kintone: <worker>/credentials/upsert (X-Anthropic-Api-Key + OAuth client headers)
    Config->>Kintone: api.anthropic.com (POST: X-Api-Key)
    Config->>Kintone: api.anthropic.com (GET: X-Api-Key)
    Config->>Kintone: setConfig({workerUrl, oauthClientId, oauthScope, saved:true})
```

### 0.2 End-user OAuth バインディング

```mermaid
sequenceDiagram
    autonumber
    participant U as User (kintone ブラウザ)
    participant P as Plugin (chat panel)
    participant Pop as popup
    participant CY as cybozu OAuth
    participant W as Worker
    participant KP as kintone proxy
    participant A as Anthropic API

    U->>P: 「kintone と連携」ボタン
    P->>P: PKCE 生成 (code_verifier / challenge / state)
    P->>Pop: window.open(/oauth2/authorization?...)
    Pop->>CY: GET /oauth2/authorization
    CY-->>U: 同意画面
    U->>CY: 許可
    CY-->>Pop: 302 → <worker>/oauth/callback?code&state
    Pop->>W: GET /oauth/callback
    W-->>Pop: HTML + script
    Pop->>P: window.opener.postMessage({code, state})
    Pop->>Pop: window.close()

    P->>P: state 検証

    P->>KP: kintone.plugin.app.proxy(/oauth2/token, POST, body)
    KP->>CY: POST /oauth2/token + Authorization: Basic
    CY-->>KP: {access_token, refresh_token, expires_in}
    KP-->>P: tokens

    P->>P: chatStore.vaultId 取得 (なければ POST /v1/vaults)
    P->>KP: kintone.plugin.app.proxy(<worker>/credentials/upsert, POST)
    KP->>W: POST + X-Anthropic-Api-Key + X-Kintone-OAuth-*
    W->>A: POST /v1/vaults/{id}/credentials (mcp_oauth + refresh ブロック)
    A-->>W: {credential_id, vault_id}
    W-->>KP: 同上
    KP-->>P: 同上
    P-->>U: status='bound' → ConnectKintoneButton 消えて Composer 表示
```

### 0.3 通常チャット時 (kintone データ取得)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant P as Plugin
    participant KP as kintone proxy
    participant A as Anthropic
    participant V as Vault (内部)
    participant CY as cybozu /oauth2/token
    participant W as Worker /mcp/<domain>
    participant K as kintone REST API

    U->>P: 「アプリ一覧を見せて」
    P->>KP: POST /v1/sessions/{id}/events
    KP->>A: 同上 + X-Api-Key

    A->>V: vault_ids から credential 解決<br/>(mcp_server_url URL 一致)
    V-->>A: access_token

    alt access_token 期限切れ
        A->>CY: POST /oauth2/token (refresh)<br/>Authorization: Basic <client_id:client_secret>
        CY-->>A: 新 access_token + refresh_token
        A->>V: tokens 更新
    end

    A->>W: POST /mcp/<domain> + Authorization: Bearer <access_token>
    W->>K: GET /k/v1/apps.json + Authorization: Bearer <token>
    K-->>W: {apps: [...]}
    W-->>A: MCP tool_result
    A-->>KP: SSE: agent.mcp_tool_result + agent.message
    KP-->>P: 同上
    P-->>U: チャット応答描画
```

### 0.4 重要な不変条件

- **Worker は何の secret も静的保持しない**。すべての secret は kintone proxy 由来の固定ヘッダで都度運ばれる
- **client_secret が Plugin JS / setConfig / HTML に露出することは無い** (一般 plugin user の `getConfig` から見えない)
- access_token / refresh_token は Anthropic Vault に暗号化保管され、API レスポンスでも返らない
- 期限切れ refresh は Anthropic 内蔵で完結 (Plugin / Worker は介在しない)

---

### 0.5 Custom Skills インフラ

組織固有のコーディング規約や利用パターンを Skill バンドル (`.skill` zip) としてエージェントに注入する仕組み。Plugin に同梱されるビルトイン Skill (`kintone-customize-js` / `kintone-plugin-development`) と、admin が Chat Panel から追加する Custom Skill の両方をサポート。

詳細仕様: [.steering/20260516-issue-30-custom-skills-infra/](../.steering/20260516-issue-30-custom-skills-infra/)

#### 0.5.1 Skill 同期シーケンス (admin)

```mermaid
sequenceDiagram
    autonumber
    participant Admin as 管理者 (Chat Panel Settings)
    participant SV as Settings View
    participant SB as skills-bundle (Plugin 同梱)
    participant A as Anthropic API
    participant Ag as Built-in Agent

    Admin->>SV: 「Skill を同期」ボタン
    SV->>SB: ビルトイン Skill 一覧読込<br/>(skills-bundle.ts で生成済み)
    SB-->>SV: [kintone-customize-js, kintone-plugin-development, ...]

    alt Custom Skill (.skill アップロード)
        Admin->>SV: .skill zip 選択
        SV->>SV: SKILL.md / resources/ 検証
    end

    loop 各 Skill
        SV->>A: GET /v1/skills?name=<name>
        alt 既存あり
            SV->>A: POST /v1/skills/{id}/versions (新バージョン作成)
        else
            SV->>A: POST /v1/skills (新規作成)
        end
        SV->>A: PATCH Agent.skills (skillsVersion 更新)
    end

    SV-->>Admin: 同期完了
```

#### 0.5.2 Skill bundle 形式

```
my-skill.skill (zip)
├── SKILL.md             # フロントマター: name / description / version
├── resources/            # 参考ドキュメント (任意)
│   └── kintone-api.md
└── scripts/              # 実行可能スクリプト (任意)
    └── example.py
```

ビルトイン Skill は [packages/plugin/src/skills/](packages/plugin/src/skills/) にソース配置し、ビルド時に `skills-bundle.ts` (バイナリ embed) として `import` 可能な形にコンパイルされる。

#### 0.5.3 重要な不変条件

- Skill の content は **Anthropic 側に保存される** (Plugin 側は version 番号のみキャッシュ)
- ビルトイン Skill の更新は Plugin リリースに連動 (skillsVersion を bump して再同期が必要)
- Custom Skill は admin 権限が必要 (一般ユーザーは閲覧のみ)

---

### 0.6 Customizer Wedge シーケンス (preview → apply → rollback)

情シス・カスタマイザーが「カスタマイズ JS を生成 → preview → apply → rollback」を会話だけで完結できる差別化機能。Phase 1 (desktop.js のみ対応) は 2026-05-30 完了。

詳細仕様: [.steering/20260517-customizer-wedge-design/](../.steering/20260517-customizer-wedge-design/) + [.steering/20260518-customizer-wedge-actualization/](../.steering/20260518-customizer-wedge-actualization/)

#### 0.6.1 5 状態 step bar

```mermaid
stateDiagram-v2
    [*] --> generating: ユーザー依頼
    generating --> previewing: Agent が JS 生成<br/>kintone-customize-bundle 完成
    previewing --> applied: 「適用」ボタン<br/>(REST API で kintone app 更新)
    previewing --> generating: 「修正依頼」(チャット継続)
    applied --> rolled_back: 「ロールバック」<br/>(直前の snapshot に戻す)
    rolled_back --> previewing: 修正版を再 preview
    applied --> [*]: 確定
```

#### 0.6.2 アーティファクト構造 (`kintone-customize-bundle`)

```ts
type CustomizeBundle = {
  kind: 'kintone-customize-bundle';
  files: FileNode[];        // FileTree (desktop.js / desktop.css 等)
  status: 'previewing' | 'applied' | 'rolled_back';
  previewSnapshot?: {       // apply 時に取った直前の kintone 設定
    appId: number;
    desktopJs: string[];    // 既存 JS ファイル URL 群
    desktopCss: string[];
    revisionHash: string;
  };
  appliedAt?: string;       // ISO8601
};
```

artifact ペイン側に **FileTree + Monaco エディタ** で表示し、preview/apply/rollback ボタンを step bar に重ねて配置。

#### 0.6.3 重要な不変条件

- apply 直前に必ず **previewSnapshot を取得** (rollback 復元用)
- previewSnapshot は in-memory 保持のみ (V1 — GitHub 連携 #17 で永続化予定)
- mobile.js / config.js は V1 スコープ外 (Phase 2 #20 で解禁予定)

---

### 0.7 Agent 詳細編集 + Custom Agent 永続化

admin が Chat Panel の Settings View から Built-in Agent の表示名 / icon / system prompt / skills / tools を編集できるようにし、雛形を複製して Custom Agent を作成・永続化できる仕組み。完了 2026-06-01。

詳細仕様: [.steering/20260601-agent-detail-edit/](../.steering/20260601-agent-detail-edit/)

#### 0.7.1 AgentEditDraft ライフサイクル

```mermaid
stateDiagram-v2
    [*] --> viewing: AgentDetailModal を開く
    viewing --> editing: 編集モード ON
    editing --> editing: フィールド変更<br/>(AgentEditDraft に蓄積)
    editing --> viewing: 「保存」<br/>(diff のみ Agent record に反映)
    editing --> viewing: 「キャンセル」<br/>(draft 破棄)

    viewing --> creating: 「雛形からコピー」<br/>(createFromProposal)
    creating --> editing: name 等を編集
    editing --> [*]: 保存 → 新 Custom Agent

    viewing --> archived: 「アーカイブ」<br/>(metadata.archived=true)
    archived --> [*]
```

#### 0.7.2 データモデル拡張

| フィールド | 型 | 説明 |
|---|---|---|
| `AgentRecord.kind` | `'builtin' \| 'custom'` | 種別 |
| `AgentRecord.variantGroup` | string | 同一 purpose のグループ識別 (例: `customizer`) |
| `AgentRecord.archived` | boolean | アーカイブフラグ (一覧から非表示) |
| `AgentRecord.rationale` | string? | デザイナーが生成した場合の設計意図 (任意) |
| `AgentEditDraft` | object | 編集中の差分。`Agent record` には保存ボタンで diff のみ反映 |

#### 0.7.3 重要な不変条件

- Built-in Agent の元定義 (BUILTIN_AGENT_SPECS) は変更不可、編集は overlay として保管される
- archive は **論理削除のみ** (Anthropic 側 Agent は残る → 再表示可能)
- Custom Agent 削除は archive で代用 (物理削除 UI は提供しない)

---

### 0.8 プリセットエージェント + クイックアクション

業務ユーザーの導入摩擦を下げるため、頻出依頼を「ワンクリック実行ボタン」として Composer 下に表示する。AgentRecord に `quickActions: string[]` を持たせ、Agent ごとにキュレーション可能。完了 2026-06-06。

詳細仕様: [.steering/20260606-preset-agents-one-click/](../.steering/20260606-preset-agents-one-click/)

#### 0.8.1 UX シーケンス

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant C as Composer
    participant Q as QuickActions
    participant S as Session

    U->>Q: 「未対応案件を集計」ボタン押下
    Q->>C: prompt 文字列を Composer に注入
    C->>C: 自動 focus (編集可能)
    alt そのまま送信
        U->>C: Enter
    else 編集してから送信
        U->>C: 文言を追記
        U->>C: Enter
    end
    C->>S: POST /v1/sessions/{id}/events (user.message)
```

#### 0.8.2 データモデル

```ts
type AgentRecord = {
  // 既存フィールド ...
  quickActions?: string[];  // プリセット依頼文 (最大 6 件想定)
};
```

#### 0.8.3 重要な不変条件

- quickActions はあくまで **Composer への注入** (送信は別アクション) → 誤発火を防止
- Agent 切替時に Composer 下のボタンも切り替わる
- 空配列または未設定の場合はボタン行ごと非表示

---

### 0.9 エージェントデザイナー (Agent-draft + propose_agent)

「業務に合った Custom Agent をチャットで設計する Agent」を built-in 3rd variant として追加。`propose_agent` Custom Tool が呼ばれると、agent-draft artifact が artifact ペインに描画され、admin が確認・編集・保存できる。完了 2026-06-07。

詳細仕様: [.steering/20260607-agent-designer-builtin/](../.steering/20260607-agent-designer-builtin/)

#### 0.9.1 設計フロー

```mermaid
sequenceDiagram
    autonumber
    participant Admin as 管理者
    participant D as デザイナー Agent<br/>(built-in 3rd variant)
    participant CT as Custom Tool<br/>propose_agent
    participant Art as Artifact ペイン<br/>(agent-draft renderer)
    participant Save as AgentDetailModal<br/>(createFromProposal mode)

    Admin->>D: 「経費精算アプリの入力アシスタントを作りたい」
    D->>D: 要件ヒアリング (役割 / 困りごと / 既存運用)
    D->>CT: propose_agent({<br/>  name, icon, systemPrompt,<br/>  skills, quickActions, rationale<br/>})
    CT-->>Art: agent-draft artifact 描画
    Art-->>Admin: ドラフト確認 (フィールドごとに編集可)
    Admin->>Save: 「この内容で保存」
    Save->>Save: createFromProposal モードで<br/>新 Custom Agent 作成
    Save-->>Admin: 完了 → Agent 一覧に追加
```

#### 0.9.2 アーティファクト構造 (`agent-draft`)

```ts
type AgentDraft = {
  kind: 'agent-draft';
  name: string;
  icon?: string;            // emoji or SVG
  systemPrompt: string;
  skills?: string[];        // 推奨 Skill 名
  quickActions?: string[];  // 推奨プリセット依頼
  rationale: string;        // 設計意図 (なぜこの構成か)
};
```

#### 0.9.3 重要な不変条件

- デザイナー Agent は **エージェント定義を提案するのみ** (保存は admin の明示操作)
- `propose_agent` Custom Tool は admin role でのみ実行可能 (一般ユーザーには Custom Tool が公開されない)
- ドラフトはセッションに紐づく (保存しない限り永続化されない)
- 保存後の編集は §0.7 AgentEditDraft フローと同じ

### 0.10 定期実行 (Deployments / cron) — #81

Anthropic Managed Agents の **Scheduled Deployments** を用いて、エージェントを cron スケジュールで
自律起動する。「毎朝9時に未対応レコードを集計して担当者に通知」のような定期タスクを、自前スケジューラ
なしで回せる。実行結果の通知・書き込みは初回メッセージ + kintone MCP ツールでエージェント自身が行う。

```mermaid
sequenceDiagram
    participant U as 業務ユーザー / admin
    participant SP as Settings「定期実行」
    participant W as Cloudflare Worker (passthrough)
    participant MA as Managed Agents API
    participant SCH as Anthropic Scheduler

    U->>SP: 対象 Agent / 初回メッセージ / cron / tz を入力
    SP->>W: POST /v1/deployments (agent, environment_id, initial_events, schedule, vault_ids, metadata.owner)
    W->>MA: 中継 (anthropic-* ヘッダ転送)
    MA-->>SP: Deployment (schedule.upcoming_runs_at = 次回発火 真値)
    Note over SCH: cron 到来
    SCH->>MA: session を自動生成 (Deployment Run を記録)
    MA->>W: kintone MCP 初期化 (vault_ids の認証情報を解決)
    W->>MA: MCP ツール実行 (集計 / 書き込み)
    U->>SP: 実行履歴 → run の session_id で会話を表示
```

**設計上の要点:**

- **Worker / client は改修不要**: `/anthropic/*` の汎用 passthrough が任意パス・メソッド・`anthropic-*`
  ヘッダを転送するため、`/v1/deployments` 系はそのまま通る。beta header もクライアント既定の
  `managed-agents-2026-04-01` が使われる。
- **API ↔ view-model アダプタ**: API の入れ子型 (`agent` / `initial_events` / `schedule` / `paused_reason`)
  と UI 視点の平坦な `DeploymentView` を `core/deployments/view.ts` で変換 (agentRecord 流儀)。
- **「次回実行」の真値**: 保存済み一覧は API の `schedule.upcoming_runs_at` を表示。cron プレビュー計算
  (`nextRuns`) は作成/編集モーダル専用 (保存前で API 応答がない場面)。
- **MCP 認証 (vault_ids)**: scheduled run の MCP server 初期化には Vault が必須。createDeployment /
  updateDeployment に `vault_ids: [vaultId]` を渡す (インタラクティブセッションと同じ仕組み)。未連携では作成不可。
- **所有者 / 権限**: `metadata.owner` = 作成者の kintone ユーザーコード。一般ユーザーは自分の所有分のみ、
  admin は全ユーザー分を一覧・操作 (`visibleDeployments`)。これは UI 上の整理であり認可ではない
  (厳密な enforcement はサーバ側の別 Issue)。
- **Settings ロール出し分け**: 入口を非 admin にも開放し、非 admin は「定期実行」セクションのみ表示、
  admin は全セクション。
- **実行履歴**: `GET /v1/deployment_runs?deployment_id=…[&has_error=true]` で run 一覧 (成否 / エラー種別)。
  各 run の `session_id` から会話を会話ビューで開ける (設定を開いたまま左ペインにロード)。
- **MVP 外**: 承認フロー / 作成者制限・コストガード / イベント駆動トリガー / files・github・memory・vault
  リソース指定 / session の詳細追跡。

---

## 1. システムアーキテクチャ (Phase 1a/1b-1/1b-2 の歴史記録)

> 以下は旧設計の記述。現行は §0 を参照。

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

**右側固定パネル、可変幅 (320〜800px、既定 380px) の縦レイアウト。上から Header / (Banner 群) / Chat scroll area / Composer の 4 ブロック。**

左端には 6px のドラッグハンドル (col-resize) があり、ホバーでアクセント色がうっすら出る。
パネル幅は `localStorage("cowork-agent.panel-width")` に永続化、別タブの変更にも追従する (`storage` event)。

```
   ↕ パネル左端の 6px ドラッグハンドル (横幅変更)
┌─┬─────────────────────────────────────────────┐
││ │  Header (高さ 60px 前後、半透明 + blur)       │
││ │  ┌──┐  Aoi  [AGENT]                         │
││ │  │★ │ ● 作業中 · kintone接続    [+][⚯][⚙][×]│
││ │  └──┘                                       │
││ ├─────────────────────────────────────────────┤
││ │ ⚠ Banner (任意): auth エラー / OAuth 失効 / │
│↕│ │   セッション終了。Composer 上部に挿入される │
││ ├─────────────────────────────────────────────┤
││ │  Chat scroll area (flex:1, padding 18/16)   │
││ │                                             │
││ │   [Greeting card]                  (初回のみ)│
││ │   ┌──────────┐                              │
││ │   │ User msg │ 右寄せ、radius 16/16/4/16    │
││ │   └──────────┘                              │
││ │   ●[Thinking …]  または                     │
││ │   ●[Agent message] Markdown 描画 (見出し /  │
││ │     リスト / 表 / コード / リンク)           │
││ │                                             │
││ │   [ToolCardMessage] 5 状態 (running /       │
││ │     success / error / pending-confirmation /│
││ │     rejected) — §5.6.4                      │
││ ├─────────────────────────────────────────────┤
││ │  Composer (固定、半透明 + blur)               │
││ │  ┌─────────────────────────────────────┐    │
││ │  │ 入力欄 (1〜8 行 auto-grow)           │ → │
││ │  └─────────────────────────────────────┘    │
││ │     ⌘K 呼び出し · Claude Managed Agents      │
└─┴─────────────────────────────────────────────┘
   送信中は ▲ → ■ (赤) のキャンセルボタンに切替
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
| Textarea | placeholder "このアプリについて聞く / レコードを操作...", `rows={1}` 起点で **scrollHeight ベースに 1〜8 行 auto-grow**、超過時は内部スクロール |
| 送信ボタン (既定) | 32×32, radius 10, accent グラデ背景, 白矢印アイコン, shadow `0 2px 8px accent55` |
| キャンセルボタン (Agent ターン進行中) | 32×32, radius 10, **赤背景** (`bg-red-500`), 白い ■ アイコン。クリックで `user.interrupt` を Session に送信 |
| disabled 条件 | `disabled || running || sessionTerminated`。送信中は textarea も入力不可 |
| ヒント行 | 下に 10px `subtle`: `⌘K 呼び出し · Claude Managed Agents` |

**IME ガード**: `keyCode === 229` / `e.nativeEvent.isComposing` / `compositionStart/End` の 3 段で日本語変換確定 Enter の誤送信を抑止する ([Composer.tsx:39-54](packages/plugin/src/desktop/components/Composer.tsx#L39))。

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

#### 5.6.4 ToolCardMessage (ツール実行カード)

`agent.tool_use` / `agent.mcp_tool_use` イベントを受けて 1 カードを生成し、続く `agent.tool_result` / `agent.mcp_tool_result` または `session.status_idle (requires_action)` で **同一カードを更新** する。実装: [ToolCardMessage.tsx](packages/plugin/src/desktop/components/MessageItem/ToolCardMessage.tsx)。

##### 5 つの状態

| status | 枠 | アイコン | バッジ | 主要要素 |
|---|---|---|---|---|
| `running` | 灰 (`border-border bg-surface-2`) | 回転スピナー | "実行中… (Ns)" | ツール名 + 引数サマリ。`useElapsedSeconds` で 1s 刻みの経過秒数表示 |
| `success` | 緑 (`border-emerald-300 bg-emerald-50`) | ✓ | "完了" | 同上 + 結果サマリ (折り畳み詳細あり) |
| `error` | 赤 (`border-red-300 bg-red-50`) | ⚠ | "失敗" | エラー本文 (200 文字切り詰め) + **「もう一度試す」ボタン** ※ |
| `pending-confirmation` | オレンジ (`border-amber-400 bg-amber-50`) | ? | "承認が必要" | 引数サマリ + **[承認] [却下] ボタン** |
| `rejected` | 灰 (`border-border bg-surface-2`) | ✕ | "キャンセル" | 「このツール呼び出しはキャンセルされました。」 |

※ retry ボタンは **履歴中で最後の error tool カード 1 つ** にのみ表示し、Agent ターン進行中 (`isAgentRunning=true`) は出さない (連打防止)。

##### 引数サマリ

`summarize(name, input)` で kintone ツール 10 種に個別整形を当てる:

| ツール | 例 |
|---|---|
| `kintone-add-record` | `app=5, fields=[title, status]` |
| `kintone-update-record` | `app=5, id=123, fields=[x]` または `app=5, updateKey.code=ABC, fields=[x]` |
| `kintone-delete-records` | `app=5, ids=[1, 2, 3] (3 件)` (6 件以上は省略表示) |
| `kintone-add-record-comment` | `record=99, text="..."` (30 文字切り詰め) |
| `kintone-get-records` 等 | `app=5, filters=2 個, limit=10` |
| 未知ツール | `JSON.stringify(input)` を 80 文字切り詰め |

##### 折り畳み詳細

`<details>` で input / result の生 JSON を必要時に開ける。`<pre>` 内に `JSON.stringify(.., null, 2)` で整形表示。

##### DOM アサート用属性

- `data-msg-kind="tool"` (MessageList 共通)
- `data-tool-status="running" | "success" | "error" | "pending-confirmation" | "rejected"`

#### 5.6.5 Banner (上部通知)

[Banner.tsx](packages/plugin/src/desktop/components/Banner.tsx) で 3 種類の通知を一元化:

| 種別 | tone | 出る条件 | 操作 |
|---|---|---|---|
| **API Key 認証エラー CTA** (F3-1) | warn (赤系) | `status === 'error'` かつ error 文言が auth 系を示唆 (`unauthorized` / `HTTP 4xx` / `kintone CB_OA*` 等) | [プラグイン設定を開く] → `onSettingsClick` |
| **OAuth 失効 (mid-session)** (F3-2) | info (オレンジ系) | mid-session (sessionId or messages あり) かつ `bindingStatus === 'error'`。tool_result の `is_error=true` で auth 失効パターンが検出されると自動で発火する | [再連携] → `useUserBinding.connect()` |
| **Session terminated** (F3-4) | info (オレンジ系) | `sessionTerminated === true`。`useEventPoller` が `retrieveSession` で `archived_at != null` または `status === 'terminated'` を検知 | [新しいセッションを開始] → `startNewConversation()` |

**初期未バインド** は従来どおり `ConnectKintoneButton` が大きく出るので、銀行は `isMidSession` フラグで切替えて二重表示しない。

#### 5.6.6 Markdown レンダリング (Agent message)

[AgentMessage.tsx](packages/plugin/src/desktop/components/MessageItem/AgentMessage.tsx) は `markdown-to-jsx` (~13KB) でレンダリングする。**ストリーミング応答の途中状態** (ペアにならない `**` / 閉じない ` ``` ` 等) でも例外を投げない実装。

| 要素 | スタイル方針 |
|---|---|
| h1〜h6 | weight 600、12〜15px、上下 small margin |
| ul / ol | `list-disc` / `list-decimal`, ml-18 |
| code (inline) | `bg-surface-2` 背景, font-mono, 12px, 4px padding |
| pre / code block | overflow-x-auto, 12px, 8px padding |
| blockquote | 左 2px ボーダー, ml-8 padding |
| a | `text-accent` underline, **`target=_blank` + `rel=noopener noreferrer`** (XSS 防御) |
| table (GFM) | border-collapse, 12px, th は `bg-surface-2 + font-semibold` |
| `<script>` 等 raw HTML | **`disableParsingRawHTML: true`** で無効化 (XSS 防御) |

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

### 確定済み (API 仕様 + 実機ログ突合による)

#### 通信経路
- Anthropic API 呼出は kintone.proxy 経由に確定 (SSE 非対応)
- **サーバ側 metadata フィルタは未サポート**: 全件リスト取得 → クライアント側フィルタ方式で実装
- **イベント差分取得の `since` カーソルは未サポート**: `page` + `order=asc` + 既知イベント ID 突合で実装
- Session のみ `agent_id` でのサーバ側フィルタが可能

#### MCP / ツール周りの実仕様 (実機ログから判明、ドキュメントとは差異あり)

| # | 項目 | 仕様 |
|---|---|---|
| 1 | `mcp_toolset.configs` | **配列形式** `[{name, enabled, permission_policy}]`。object map ではない |
| 2 | MCP ツール呼出 event | `agent.mcp_tool_use` (組み込み `agent.tool_use` とは別) |
| 3 | MCP ツール結果 event | `agent.mcp_tool_result`、リンク id は **`mcp_tool_use_id`** (組み込みは `tool_use_id`) |
| 4 | 承認待ちの stop_reason | `session.status_idle.stop_reason.type === 'requires_action'`、`event_ids[]` に pending tool_use_id |
| 5 | Session archive 通知 | events ストリームには **流れない**。Session リソースの `archived_at` / `status` を別途取得して検知する |
| 6 | kintone OAuth 失効の tool_result | `Tool error: kintone 401: {"code":"CB_OA01","message":"Cannot access protected resource."}` 形式。`isOAuthFailureText` で `CB_OA*` / 401 / unauthorized 等を検出 |

これらは [eventInterpreter.ts](packages/plugin/src/core/managed-agents/eventInterpreter.ts) と [useEventPoller.ts](packages/plugin/src/desktop/hooks/useEventPoller.ts) で吸収している。

### 今後の検討事項

- カスタムドメイン利用時の Environment ネットワーク許可リスト更新運用 (ユーザー作成時に動的に `allowed_hosts` を設定)
- ヘルパーライブラリのバージョン管理と更新戦略 (Environment を作り直すタイミング)
- kintone.proxy の 1 リクエストあたりタイムアウト・レスポンスサイズ制約への対応 (大量レコード扱い時)
- **ユーザー単位 Environment の管理運用**
  - ユーザー数 100 人超時のリスト取得コスト (ページング対応)
  - 退職者/無効化ユーザーの Environment / Vault クリーンアップ方式 (手動 Console 操作 or 自動)
- ~~**カスタム Agent (Phase2) の仕様**~~ → **V1 で確定** (§0.7 / §0.9 参照): admin のみが作成可、AgentDetailModal で system prompt / skills / tools / quickActions を編集、Built-in / Custom は variantGroup で区別、Header プルダウンで切替
- **Default Agent 作成時の同時実行競合**
  - 別ユーザーが同時に初回起動して Agent を二重作成する可能性 → 作成直前の再検索 + 重複発見時の片方削除ロジックを検討
- **Agent ACL** (進行中、本書反映待ち): Agent ごとの利用ユーザー / グループ制限。詳細は [.steering/20260607-agent-acl/](../.steering/20260607-agent-acl/)
- **Customizer Wedge Phase 2** ([#20](https://github.com/sugimomoto/CoworkAgentForKintone/issues/20)): mobile.js / config.js / CSS 解禁時の artifact 拡張、GitHub 連携での snapshot 永続化
- **Custom Skill のバージョン管理運用**: ビルトイン Skill 更新時のユーザー通知タイミング、Custom Skill の差分マージ戦略
