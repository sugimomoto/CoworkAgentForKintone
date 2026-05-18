# Customizer Wedge デザイン — 要求定義

> **本ドキュメントの位置づけ**: Issue #9 (umbrella) の wedge 戦略を実装に落とすための要求整理。情シス・カスタマイザー向け体験を「**Cowork Agent と組んで kintone を作り続ける**」レベルまで引き上げるための全体像と必要な機能・権限・段階構築計画を定義する。
>
> ここで合意したスコープに沿って、サブ Issue (#19 分解 / #20 / #30 残り) を確定する。

---

## 1. 背景

### 1.1 戦略 (Issue #9 で合意済)

- 初期ターゲット = **kintone カスタマイズを行う情シス / 社内開発者**
- 業務ユーザー向け体験 (レコード問合せ等) は維持しつつ、wedge は情シスから取りに行く
- 競合差別化の中核は「**kintone 特化の MCP + skill + 適用フロー**」(Cursor / Claude Code の wedge 戦略と同型)

### 1.2 現状の制約 (= 解決すべきもの)

| 制約 | 影響 |
|---|---|
| **1 ワークスペース 1 Default Agent** で全用途共用 | system prompt が肥大化、業務ユーザーと情シスのペルソナ衝突、ツール権限の過剰付与 |
| **生成 → 手動コピペ** で本番反映 | Agent 価値が「コード補完」止まり、wedge ループ未完成 |
| **失敗時のロールバック手段なし** | 本番 kintone を壊すリスクで admin が Agent を信頼しきれない |
| **GitHub / 履歴管理が外** | カスタマイザーの当たり前 (PR レビュー / コミット履歴) と分断 |
| **MCP の管理系ツール不在** | フィールド追加 / プロセス管理を Agent から触れない |

---

## 2. ペルソナと典型シナリオ

### 2.1 主ペルソナ: 情シス・カスタマイザー (`Customizer`)

- 業務部門から日々「こうしたい」依頼を受け取る
- 試行錯誤 (作る → テスト → 修正 → 適用 → 不具合 → ロールバック) を伴う
- kintone JS API / cli-kintone / Plugin 仕様は完全には覚えていない (リファレンスを引きながら書く)
- 本番影響を恐れて preview 環境 / dry-run / ロールバックの仕組みを求める

### 2.2 副ペルソナ: 業務ユーザー (`BusinessUser`)

- レコード操作・問合せ・ドキュメント生成が主用途
- カスタマイズ機能は触らない
- 既存体験は維持しつつ、Customizer モードに切替不要なら干渉しないこと

### 2.3 隠れペルソナ: Plugin 管理者 (`Admin`)

- kintone のプラグイン管理画面に入れる人 (= cybozu.com 共通管理者 or 部分管理者)
- Anthropic API Key / Worker URL の登録、Agent 構成のキュレーションを担う
- end user の使う Agent 種類・権限を制御したい

### 2.4 典型シナリオ

| # | シナリオ | 担当ペルソナ |
|---|---|---|
| **A** | 「完了案件の行は背景緑に」 | Customizer |
| **B** | 「Slack 通知 Plugin 作って」 | Customizer |
| **C** | 「申請アプリ作って承認フロー組んで」 | Customizer |
| **D** | 「複雑なクエリで月次集計」 | Customizer + BusinessUser 両者 |
| **E** | 「先月の顧客 100 件の進捗まとめて」 | BusinessUser |
| **F** | 「議事録を pptx にまとめて」 | BusinessUser |

シナリオ A〜D が wedge のコア対象、E〜F は維持対象。

---

## 3. 提供する体験 (North Star)

### 3.1 Customizer の North Star ワークフロー

```
業務部門からの依頼
       ↓
Customizer: チャット (Cowork Agent for kintone Plugin)
       ↓
[ Agent 選択: ◉ Customizer Agent ]
       ↓
依頼を自然言語で伝える
       ↓
┌─────────────────────────────────────────────────┐
│ Customizer Agent                                │
│  ├── kintone MCP        (参照 + 書込 + 管理系)  │
│  ├── Customizer Skills  (customize-js / plugin-dev / query / error-recovery 等) │
│  ├── GitHub MCP (将来)  (commit / PR)           │
│  ├── Apply Tools (将来) (preview / deploy / rollback) │
│  └── Memory (将来)      (規約 / 命名学習)       │
└─────────────────────────────────────────────────┘
       ↓
[ Artifact: コード / 図 / Plugin zip ]
       ↓
   ┌── プレビュー       ── 実機シミュレーション
   ├── 本番適用         ── kintone preview→deploy API
   ├── GitHub commit/PR ── 履歴管理
   └── ロールバック     ── 直前状態に戻す
       ↓
業務部門に納品 (kintone が「使える状態」になる)
```

### 3.2 BusinessUser の North Star ワークフロー (現状維持)

```
レコード一覧画面
       ↓
[ Agent 選択: ◉ 業務ユーザー Agent ]
       ↓
「先月の顧客 100 件の進捗まとめて」
       ↓
Business Agent → kintone-get-records → 集計
       ↓
Artifact (Markdown / CSV) で結果表示
```

両ペルソナが **別 Agent** で動き、互いに干渉しない。

---

## 4. 必要な能力一覧 (Capability Matrix)

| カテゴリ | 機能 | 現状 | 必要な Issue |
|---|---|---|---|
| **会話 UI** | Chat / Composer / MessageList / Artifact pane | ✅ | — |
| **Agent (複数)** | Default + Customizer(Opus) + Customizer(Sonnet) の Built-in 3 variant | ❌ | **#39** |
| **Agent 切替** | Header / Plugin Config から選択 | ❌ | **#39** |
| **Agent カスタマイズ** | skill / tool ON-OFF (admin) | ❌ | V2-新規 (Agent 詳細編集) |
| **Agent 新規作成** | system prompt / model 編集 (admin) | ❌ | V3-新規 (Custom Agent 作成) |
| **Custom Skills** | インフラ + customize-js + plugin-development | ✅ Phase1 | #30 |
| **Custom Skills 追加** | query / error-recovery / app-design / batch-patterns | ❌ | #30 Phase2+ |
| **JS 適用フロー** | プレビュー → 本番反映 → ロールバック | ❌ | **#20** ⭐ |
| **Plugin ビルド** | pack → upload (Agent 経由) | ❌ | 別 Issue (#17 拡張 or 新規) |
| **GitHub 統合** | リポジトリ / commit / PR | ❌ | **#17** |
| **MCP: 管理系** | フィールド追加 / プロセス / ACL / deploy | ❌ | #24 |
| **MCP: ワークフロー** | status / assignees | ❌ | #22 |
| **Memory** | 自社規約 / プロジェクト記憶 | ❌ | #15 |
| **モデル選択** | Agent ごとに Opus / Sonnet / Haiku | ❌ | #7 + V2-新規 (Agent 詳細編集) |

⭐ = wedge ループ完成の臨界点

---

## 5. Surface 分割: Plugin Config vs Chat Panel Settings

### 5.1 設計原則

**「Plugin Config = 最小 Bootstrap、Chat Panel = プロダクト本体」** に再定義する。

理由:

- Plugin Config は kintone admin 画面の iframe で、**継続的な編集 / 反復に向かない貧弱な UI**
- Agent / Skill / Memory / 追加 MCP Server は **継続的にチューニングする対象** → 毎回 kintone admin 画面に戻るのは生産性を破壊する
- Chat Panel は React で組まれた **本物のアプリ UI** → 設定 UI もリッチに作れる
- 管理者は会話の文脈で「あ、この skill 足りない」「Agent をもう 1 個作りたい」と気付くので、**会話と設定を同じ surface に置く**のが自然

### 5.2 Surface 別の責務 (3 階層)

| Surface | 責務 | 操作者 | 頻度 |
|---|---|---|---|
| **Plugin Config** (kintone admin 画面) | **Bootstrap + 接続情報 registry**:<br>・Cloudflare Worker デプロイ (任意)<br>・Worker URL 登録<br>・Anthropic API Key 登録<br>・kintone OAuth client_id / secret 登録<br>・追加 MCP Server の接続情報 (URL / OAuth client_id / secret) 登録 | kintone admin | 初回 + 鍵更新時 + 新 MCP Server 追加時 |
| **Chat Panel: Settings View** | **Ongoing 管理**:<br>・Agents の追加 / 編集 / 選択 / 公開設定 / Tool・Skill の Agent への紐付け<br>・Skills の同期 / 追加 / 削除<br>・Memory の追加 / 一覧 / 削除<br>・MCP Server への OAuth 接続実行 / 切断 / Vault Credential 管理 / Tool 一覧表示 | kintone admin (権限 check 経由) | 日常的 |
| **Chat Panel: Conversation View** | 会話・カスタマイズ作業 | 全ユーザー | 毎日 |

### 5.3 なぜこの分割なのか (技術的制約)

Plugin Config に最低限 4 項目を残さざるを得ない理由は **kintone Plugin の仕様制約**:

- `kintone.plugin.app.setProxyConfig()` は **Plugin Config 画面でしか呼べない**
- 固定ヘッダ (Anthropic API Key / OAuth Basic 認証) を kintone runtime に登録するのに必須
- end-user side (record 画面 / Chat Panel) から呼ぶと undefined エラー

逆にそれ以外の操作は **Anthropic API 直接呼出** で完結するので Chat Panel から扱える:

- Skills 同期 = `POST /v1/skills` (workspace スコープ、API Key + kintone.proxy で可)
- Agent 作成 = `POST /v1/agents`
- Memory 作成 = `POST /v1/memory-stores` (Issue #15)
- Vault Credential 追加 = `POST /v1/vaults/{id}/credentials` (新規 MCP Server 登録用)

### 5.4 Chat Panel の View 構成

```
┌──────────────────────────────────────────────────┐
│ Header [Cowork Agent — Customizer ▼] [💬] [⚙] [×] │
├──────────────────────────────────────────────────┤
│                                                  │
│   ◉ Conversation View    (default)               │
│   ○ Settings View         (admin だけ ⚙ で開ける)│
│   ○ History View          (既存)                 │
│                                                  │
└──────────────────────────────────────────────────┘
```

ヘッダの ⚙ (設定アイコン) は **kintone admin にのみ表示** される。クリックで Settings View が右ペイン全画面、または現在の ArtifactPane の代わりに表示。

### 5.5 Settings View の sub-section 構成

Notion のサイドバー / VS Code の Settings 風に、**左サイドナビ + 右パネル** の 2 ペイン構成:

```
┌─ Settings ─────────────────────────────────────────┐
│ ┌─ Nav ──────┬─ Detail ─────────────────────────┐ │
│ │ 🤖 Agents  │  [選択中 Agent の編集 UI]         │ │
│ │ 🧠 Skills  │                                  │ │
│ │ 💾 Memory  │                                  │ │
│ │ 🔌 MCP     │                                  │ │
│ └────────────┴──────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

Sub-section ごとの責務:

| Section | 内容 | 関連 Issue |
|---|---|---|
| **🤖 Agents** | Built-in / Custom Agent の一覧、skill / tool ON-OFF、新規作成、公開設定、組織のデフォルト | #39 + V2/V3 新規 |
| **🧠 Skills** | 同梱 skill + admin 追加 skill の一覧、Anthropic への同期、新規 skill のテキスト投入 | #30 拡張 |
| **🔌 MCP** | 追加 MCP server (GitHub / Slack / Notion 等) の登録、各 server の Vault Credential 管理 | #17 / 新規 |

> Memory は admin がキュレーションする対象ではなく **end user が会話で Agent に蓄積させる personalization state** なので、Settings View には置かない。Conversation View 側の Memory トグルだけで完結する (Section 6.7)。

### 5.5.1 Usage / Bootstrap sub-section を作らない理由

#### Usage (API 利用量 / トークン使用状況) は **本 Plugin では扱わない**

理由: Anthropic の **Usage / Cost API は Admin API Key (organization 単位の高権限)** でしか叩けない。

- 通常 API Key (= 顧客が Plugin に登録するキー) からは `usage_report` / `cost_report` 系エンドポイントに 403 で弾かれる
- Admin API Key を Plugin に登録させるのは権限委譲が大きすぎて NG (組織の全 API Key 管理 / 削除 / 鍵更新まで可能になる)
- 利用量確認は **Anthropic Console / AWS Cost Explorer (#32 CPA 後)** を別途見てもらう運用とする
- 将来 Anthropic が「通常 API Key からも自分のキーの利用量だけ取れる API」を出したら再検討

#### Bootstrap リンクは **不要**

理由: admin は元々 kintone 管理画面 → プラグイン管理 → Cowork Agent → 設定 という標準経路で Plugin Config に到達できる。

- Chat Panel から戻りリンクを置くと Nav が散らかる
- Settings View に入る前にすでに admin は「kintone 管理画面に入っている」前提
- Bootstrap 設定は年数回しか触らない → そもそも頻度が低いので近道は不要

### 5.6 Bootstrap (Plugin Config) は何を残すか — 最小化

| 項目 | 残す理由 |
|---|---|
| **Step 0**: Cloudflare Worker デプロイ (任意) | 初回環境構築。外部 Worker URL を使う組織はスキップ可 |
| **Step 1**: Worker URL 登録 | proxyConfig 経路の起点 |
| **Step 1**: Anthropic API Key | secret、setProxyConfig 経由でしか登録できない |
| **Step 2**: cybozu OAuth client 登録案内 | 外部リンクのみ (kintone admin 画面への誘導) |
| **Step 3**: kintone OAuth client_id / client_secret | OAuth flow 必須、secret は setProxyConfig 必須 |
| **Step 4 (新規)**: 追加 MCP Server の接続情報 | name / URL / OAuth credentials。secret 部分 (client_secret) は setProxyConfig 経由で固定登録 (Section 6.8) |

→ Plugin Config は **Bootstrap + 接続情報 registry** という位置づけ。secret / proxy 登録経路系のものだけ。

→ それ以外の「Skills 同期」「Agent 設定」「Memory 管理」「OAuth 接続実行」「Tool 一覧表示」「Tool の Agent 紐付け」は **Chat Panel Settings** に移管する。

---

## 6. Agent / Skill / Memory / MCP 管理機構の要求

> 本セクションの設定 UI はすべて **Chat Panel: Settings View** に置く (Section 5 参照)。

### 6.1 Agent 種別

| 種別 | 説明 | 例 |
|---|---|---|
| **Built-in** (Plugin 同梱) | Plugin バージョンアップで自動更新。Workspace に自動プロビジョニング | "業務ユーザー Agent" / "カスタマイザー Agent" |
| **Custom** (admin 作成) | 管理者が Chat Panel Settings → Agents で新規作成・編集 | "営業 Agent" / "経理 Agent" 等 |

Built-in Agent は **Plugin 起動時に metadata で識別して自動 ensure** する (skill bundle と同じ思想)。

### 6.2 Agent の構成要素

各 Agent は **Anthropic 側に保存される定義** と **Plugin 側で擬似的に保持する補助 metadata** の 2 層構造を持つ:

#### Anthropic 側 (`POST /v1/agents` の body に含まれる)

```
Agent (Anthropic-managed)
├── name                  ("Customizer Agent" 等、人間向けラベル)
├── model                 (claude-opus-4-7 / claude-sonnet-4-6 / claude-haiku-4-5)
├── system                (用途特化のペルソナ / ガードレール)
├── tools                 (agent_toolset + MCP toolset + custom tools)
├── skills                (Anthropic 製 + custom)
├── mcp_servers           (kintone + 将来 GitHub 等)
└── metadata
    ├── source            ("cowork-agent-for-kintone")
    ├── purpose           (default | customizer | custom-<name>)
    ├── promptVersion     (v19 等)
    └── skillsVersion     (sha256:xxx)
```

#### Plugin 側 (Plugin Config の Agent metadata)

```
PluginAgentMetadata (Plugin-managed)
├── visibility            (公開 / 非公開) — end user に選択可否
└── isDefault             (組織のデフォルト Agent フラグ)
```

> Memory Store は Agent metadata に持たせない。Memory は Conversation View の ON/OFF トグルで (user × agent) 単位に Plugin が auto-ensure する (Section 6.7)。

#### なぜ 2 層なのか

Anthropic Managed Agents の Agent 定義は **Visibility / Default フラグを持てない** (Plugin プロダクト機能のため Anthropic 側に概念が無い)。これらを Plugin Config 内で擬似的に持ち、Agent プルダウン描画時に Plugin が解決する。

### 6.3 デフォルトの Built-in Agent 3 variant (Phase 1 で提供)

> 業務ユーザー Agent (Sonnet) + カスタマイザー Agent の Opus / Sonnet 2 variant。詳細は Section 6.4.1 を参照。

#### 業務ユーザー Agent (`purpose: default`)

- model: Sonnet 4.6
- skills: xlsx / docx / pdf / pptx (ドキュメント生成系)
- mcp_tools: kintone MCP 参照系 + 書込系 (管理系は除外)
- system prompt: 親しみやすい業務サポート、過剰確認なし
- visibility: 公開

#### カスタマイザー Agent (`purpose: customizer`)

- model: **Opus 4.7 / Sonnet 4.6 から切替可能** (論点 6 決定。実現方式は Section 6.4.1 参照)
- skills: customize-js / plugin-development / query / error-recovery (Customizer Pack)
- mcp_tools: kintone MCP 全部 + 管理系 (#24 完了後)
- system prompt: kintone 開発者向け co-pilot ペルソナ、preview → apply → rollback の安全 workflow 厳守、適用前確認必須
- visibility: 公開

### 6.4 Agent 切替 UI (Conversation View 内)

- **Header にプルダウン**を配置 (現在の Agent 名 + ▼)
- 公開された Agent だけが選択肢に出る
- **切替は新規会話のトリガー** (進行中セッションの途中切替不可、混乱回避)
- localStorage に最後に選択した Agent を保存 → 次回起動時の初期値
- Settings → Agents で **組織のデフォルト Agent** を admin が指定可能 (新規ユーザーの初期値)

### 6.4.1 Customizer Agent のモデル切替 (論点 6 決定の実現方式)

カスタマイザー Agent は **Opus 4.7 (高品質・高コスト) / Sonnet 4.6 (速度・低コスト)** をユーザーが選択できる。

#### 前提制約 (Anthropic Managed Agents API)

> Agent 定義に **model がバインド** されており、Session / Conversation 開始時に model を上書きする API は **存在しない**。Agent 編集 API (`POST /v1/agents/{id}`) で model を変えると Agent 全体の新 version が生成され、既存 Session には影響しない。

つまり **「同じ Customizer Agent で model だけ切替」は API 上不可能**。model 違いを提供するには **別 Agent として登録** するしかない。

#### V1 採用方式 — Built-in Agent を 3 variant で auto-ensure

Plugin が初回起動 / Skills 同期時に、Anthropic Workspace へ以下 3 つを auto-ensure する:

```
Built-in Agents (Plugin が auto-ensure)
├── 業務ユーザー Agent             (purpose: default,    model: Sonnet 4.6)
├── カスタマイザー Agent (Opus)    (purpose: customizer, model: Opus 4.7)
└── カスタマイザー Agent (Sonnet)  (purpose: customizer, model: Sonnet 4.6)
```

カスタマイザー側の 2 variant は **system prompt / skills / tools をすべて同一**にし、model だけが異なる。Plugin metadata で `agentVariantGroup: 'customizer'` のような紐付け識別子を持っておくと、将来 (B) 案 (下記) に拡張する時に流用できる。

#### UI: Header の Agent プルダウンに 3 つ並べる (V1)

```
[Cowork Agent — カスタマイザー (Opus) ▼]
  ├ 業務ユーザー
  ├ カスタマイザー (Opus)        ← 高品質
  └ カスタマイザー (Sonnet)      ← 速度・低コスト
```

- end user は**会話開始前に**選択 (途中切替不可は既存設計)
- localStorage で最後に選択した variant を記憶
- admin は Settings → Agents で **組織デフォルト variant** を指定可能 (Opus を初期値にするか Sonnet 既定で課金抑制するか組織で選べる)

#### V2 以降の改善案 (UI 簡素化、本文書では V1 不採用)

Header に「Agent: ▼」と「モデル: ▼」を **2 セレクタ並列**で出し、Plugin が内部的に (purpose × model) の組から 3 variant のどれかを resolve する案。UI 上は「同じ Agent で model 切替」に見えるが、**裏側は依然として variant agent を別 Agent として持つ** (Anthropic API 制約上)。Custom Agent 作成 (#41) の拡張で UX を整える時に再検討。

#### 採用理由

- 既存 Header プルダウン UI を流用 → 追加 UI コンポーネント不要
- resolveAgent / Plugin Config の Agent metadata 構造を変更せずに済む
- Built-in Agent が 3 個に増えるが、auto-ensure 対象 = admin の手間は増えない
- Anthropic API 制約に素直に従った設計

### 6.5 Agent 編集 UI (Chat Panel Settings → Agents)

#### 一覧画面

```
┌─ Settings → 🤖 Agents ───────────────────────────────┐
│                                                      │
│ [Built-in]                                           │
│  ▶ 業務ユーザー Agent     ☑ 公開    モデル: Sonnet  │
│  ▶ カスタマイザー Agent   ☑ 公開    モデル: Opus    │
│                                                      │
│ [Custom Agents]                                      │
│  [+ 新規 Agent 作成]                                 │
│                                                      │
│ デフォルト Agent: ◉ 業務ユーザー  ○ カスタマイザー    │
└──────────────────────────────────────────────────────┘
```

#### Agent 詳細・編集画面 (▶ クリックで展開)

```
┌─ 🤖 Agent: カスタマイザー ────────────────────────────┐
│                                                       │
│ 基本情報                                              │
│  名前   : [カスタマイザー Agent          ]            │
│  ☑ 公開 (end user の Header プルダウンに出す)         │
│  モデル : [Claude Opus 4.7 ▼]                         │
│                                                       │
│ ─────────────────────────────────────────             │
│ Skills (Workspace の skill 一覧から個別 ON-OFF)        │
│   ☑ kintone-customize-js          [v_xxx]             │
│   ☑ kintone-plugin-development    [v_xxx]             │
│   ☐ kintone-query                 (未同期)            │
│   ☐ kintone-error-recovery        (未同期)            │
│   ☐ xlsx                          [anthropic]         │
│   ☐ docx                          [anthropic]         │
│   ...                                                 │
│                                                       │
│ ─────────────────────────────────────────             │
│ Tools (MCP Server / Tool 単位で個別 ON-OFF)            │
│                                                       │
│  ▼ ⚙ Agent Toolset (組込)              [☑ 全選択]    │
│     ☑ bash                                            │
│     ☑ read / write / edit                             │
│     ☑ glob / grep                                     │
│     ☐ web_fetch                                       │
│     ☐ web_search                                      │
│                                                       │
│  ▼ 🟦 Kintone MCP Server                [◧ 一部]      │
│     ┌─ 参照系 ────────────────────────────┐          │
│     │ ☑ kintone-get-apps                  │          │
│     │ ☑ kintone-get-app                   │          │
│     │ ☑ kintone-get-form-fields           │          │
│     │ ☑ kintone-get-records               │          │
│     ├─ 書込系 ────────────────────────────┤          │
│     │ ☑ kintone-add-record                │          │
│     │ ☑ kintone-add-records               │          │
│     │ ☑ kintone-update-record             │          │
│     │ ☑ kintone-update-records            │          │
│     │ ☑ kintone-add-record-comment        │          │
│     │ ☑ kintone-delete-records   ⚠ ask   │          │
│     ├─ ファイル ──────────────────────────┤          │
│     │ ☑ kintone-upload-file               │          │
│     │ ☑ kintone-download-file             │          │
│     ├─ 管理系 (#24 完了後) ──────────────┤          │
│     │ ☐ kintone-add-fields                │          │
│     │ ☐ kintone-deploy-app                │          │
│     └──────────────────────────────────────┘          │
│                                                       │
│  ▶ 🟪 GitHub MCP Server                 [☐ 全選択]    │
│  ▶ 🟧 Slack MCP Server                  [☐ 全選択]    │
│                                                       │
│ ─────────────────────────────────────────             │
│ Custom Tools (Plugin 内蔵、変更不可)                  │
│  ・create_artifact (常時 ON)                          │
│  ・preview-apply-rollback (#20 完了後、Customizer のみ) │
│                                                       │
│ [保存] [破棄] [この Agent を削除]                     │
└───────────────────────────────────────────────────────┘
```

> Memory は Agent 編集 UI に出さない。Conversation View 側の ON/OFF トグルで (user × agent) 単位に Plugin が auto-ensure する設計 (Section 6.7)。

#### UI の規約

- **MCP Server header** はクリックで折りたたみ可能、`▶ / ▼` トグル
- **`[☑ 全選択]` / `[◧ 一部]` / `[☐ 全選択]`** の 3 状態 (CheckBox の indeterminate も使う)
  - MCP Server header の checkbox をクリック → 配下全 tool が cascade で ON/OFF
- **カテゴリ** (参照系 / 書込系 / ファイル / 管理系) は Kintone MCP Server 内部で **目視グルーピング** (折りたたみ不要)
- **`⚠ ask`** は per-tool の `permission_policy: always_ask` を示す。クリックで `always_allow` / `always_ask` を切替可能 (将来)
- **Agent Toolset (組込)** は MCP ではないが同じ UI 階層に並べる (Anthropic 提供の bash / read / write / web_fetch 等)
- **Custom Tools (Plugin 内蔵)** は変更不可。情報表示のみ
- **未同期 skill** は ☐ disabled で表示し、ホバーで「Settings → Skills で同期してください」案内

#### 保存処理

編集後「保存」で:

1. Anthropic `POST /v1/agents/{id}` (新 version 作成) — model / system / tools / skills すべてを送信
2. Plugin Config の Agent metadata を更新 (skill / tool 構成変更で別 Agent 扱いするための version 識別子)
3. 既存セッションには影響しない (新規セッションから新構成が反映)

#### MCP Server / Tool の動的解決

- **MCP Server 一覧**: Settings → MCP で登録されたものを Agent 編集画面で表示 (Section 6.8 参照)
- **各 MCP Server の Tool 一覧**: Worker の `/mcp/<domain>` に `tools/list` JSON-RPC を投げて取得 (Anthropic Managed Agents が Session 作成時にやる動作と同じ)
- 新しい Tool が MCP Server 側で追加されると、Agent 編集画面で自動的に選択肢に出る

#### V1 / V2 / V3 でできること差分

| Phase | UI で出来ること |
|---|---|
| **V1 (#39)** | 一覧画面のみ。Agent 切替 + 公開トグル + デフォルト指定。Skill / Tool は Built-in でハードコード設定 |
| **V2 (#40)** | 詳細画面 (上記モックアップ) で Skill / Tool 個別 ON-OFF |
| **V3 (#41)** | 新規 Custom Agent 作成 + system prompt 編集 |

### 6.6 Skills 管理 UI (Settings → Skills)

```
┌─ Settings → 🧠 Skills ──────────────────────────────┐
│                                                     │
│ 同梱 Skills (Plugin 同梱)                           │
│  ✓ kintone-customize-js     最新版同期済 (v_xxx)    │
│  ✓ kintone-plugin-development  最新版同期済          │
│                                                     │
│  [Plugin 同梱 skill を Anthropic に同期] ボタン     │
│                                                     │
│ Custom Skills (admin が追加)                        │
│  [+ Custom skill を追加]                            │
│   ┌─ モーダル: SKILL.md テキスト投入 ─┐             │
│   │ name: …                         │             │
│   │ description: …                  │             │
│   │ 本文 (Markdown): [textarea]      │             │
│   │ [Anthropic にアップロード]        │             │
│   └────────────────────────────────┘             │
│                                                     │
│ Workspace の全 skill 一覧 (Anthropic から取得)      │
│  ・kintone-customize-js (source: custom)            │
│  ・xlsx (source: anthropic)                         │
│  ・...                                              │
│   [非同期に削除] ボタン                             │
└─────────────────────────────────────────────────────┘
```

### 6.7 Memory 機能 — シンプルな ON/OFF トグル

#### 設計方針: admin 管理 UI を作らない

[Anthropic Memory API](https://platform.claude.com/docs/en/managed-agents/memory) は強力だが、本 Plugin では **admin 管理 UI を作らない**。理由:

- **「コーディング規約 / 命名規則 / 業務ルール」は Skill の領域** (静的 / 共有 / SKILL.md として GitHub 管理可能)。Memory に持たせると skill の劣化版になる
- Memory の本来価値は **会話の中で Agent が勝手に蓄積する personalization state**:
  - 「このユーザーは tab 派 (空白派ではない)」
  - 「先週のプロジェクト Y の続き」
  - 「前回ユーザーが怒ったポイント」
- これは admin がキュレーションするものでなく **end user が会話の中で育てる** ものなので、**Settings (admin 専用) ではなく Conversation View に置く**

→ ChatGPT の "Memory: On/Off" と同じ思想。1 トグルで完結する。

#### UI: Conversation View の Memory トグル

```
[Header]
┌────────────────────────────────────────────────────┐
│ [Cowork Agent — Customizer ▼]  💾 Memory: [● ON]   │
│                                              ↑ toggle│
└────────────────────────────────────────────────────┘
```

- Agent プルダウンの隣に **小さなトグル**を配置
- localStorage に **(user × agent) 単位** で状態を保存
- デフォルト は OFF (オプトイン)
- ON にしたまま新規会話を開始すると Memory が自動 attach
- トグル状態は Conversation View 上で常時可視 (現在のセッションが Memory 使ってるか分かる)

#### 動作仕様

| トグル状態 | Session 作成時の挙動 |
|---|---|
| **OFF** (デフォルト) | `resources[]` に memory_store を入れない。毎回 fresh な会話 |
| **ON** | (user × agent) 専用の Memory Store を **Plugin が自動 ensure** (無ければ create) → `resources[]` に `read_write` で attach |

Plugin 内部処理:

```ts
// 新規 Session 作成時
async function createSessionWithMemory(agentId: string, memoryOn: boolean) {
  const resources = [];
  if (memoryOn) {
    const userCode = kintone.getLoginUser().code;
    const storeName = `cowork-${userCode}-${agentPurpose}`;  // (user × agent) で一意
    const storeId = await ensureMemoryStore(storeName);     // 無ければ create
    resources.push({
      type: 'memory_store',
      memory_store_id: storeId,
      access: 'read_write',
      instructions: 'ユーザーの好み・過去会話の文脈・繰り返しのミス等を記録してください',
    });
  }
  return createSession({ agent: agentId, environment_id: envId, resources });
}
```

#### Memory Store の lifecycle (Plugin が裏で管理)

- **作成**: ユーザーが初めて Memory: ON でチャット開始 → `POST /v1/memory_stores` で自動作成
- **使用中**: 既存 store を attach
- **削除**: Plugin UI からは出さない (admin が必要なら Anthropic Console で削除)
- **export / 中身確認**: Anthropic Console で見る (admin 向け運用)

→ Plugin 側に Memory CRUD UI を持たない代わりに、Anthropic Console で運用補助できる

#### V1 / V2 / V3 でできること差分

| Phase | Memory 機能 |
|---|---|
| **V1** | 機能なし (V1 スコープから外す)、Customizer wedge MVP に Memory は不要 |
| **V2** | Conversation View に Memory トグル追加 (1 機能のみ)、(user × agent) 単位の自動 ensure |
| **V3** | (任意) Memory の export / import / 中身 preview / 削除 などの軽量管理 UI を Settings に追加検討 |

→ **V1 では Memory に手を付けない**。Customizer wedge のコア (Agent / Skill / 適用フロー) を完成させてから V2 で Memory トグル追加が現実的。

#### 関連 Issue

- #15 (Memory Stores) のスコープを **Conversation View の Memory トグル** に縮小 (大規模な admin 管理 UI は本ドキュメントでは作らない方針)

### 6.8 MCP Server 管理 UI (Settings → MCP)

新しい MCP Server (GitHub / Slack / Salesforce 等) を追加する流れは **3 ステップに分離** する。secret / 接続情報の登録は Plugin Config、OAuth フロー実行 + Vault 管理は Chat Panel、Tool の Agent 紐付けは Agent 編集画面でと、それぞれの surface の特性に合わせて分担する。

#### 役割マップ

| Step | Surface | 内容 |
|---|---|---|
| **1. 接続情報登録** | Plugin Config (Step 4 として追加) | Name / Remote URL / OAuth Authorization URL / OAuth Token URL / Client ID / Client Secret を入力。setProxyConfig で token endpoint への Basic auth ヘッダを固定登録 |
| **2. OAuth 接続** | Chat Panel Settings → MCP | 「接続」ボタン押下 → OAuth popup → callback → token 交換 → Anthropic Vault に Credential 保存。接続成功後 MCP server の `tools/list` を取得して Tool 一覧表示 |
| **3. Agent に紐付け** | Chat Panel Settings → Agents | 該当 Agent の編集画面で MCP Server / 個別 Tool を attach (Section 6.5) |

→ なぜこの分割か:
- **client_secret は setProxyConfig 経由でしか kintone runtime に安全保管できない** → Plugin Config に置くしかない
- **OAuth popup は記録ユーザー単位の操作** で、admin がチャット画面でログインする方が自然
- **Tool の Agent 紐付け** は試行錯誤の対象 → Chat Panel で繰り返し編集できる方が良い

#### Plugin Config 側 (Step 4 として追加)

```
[Step 4. 追加 MCP Server (任意)]

┌─ MCP Servers ─────────────────────────────────────┐
│ 名前    │ Remote URL          │ Auth   │ 操作    │
│ kintone │ ${workerUrl}/mcp/.. │ OAuth │ (Built-in) │  ← 既存、編集不可
│ GitHub  │ https://api...      │ OAuth │ 編集|削除 │
│ Slack   │ https://...         │ OAuth │ 編集|削除 │
│ ───────────────────────────────────────────────  │
│ [+ MCP Server を追加]                            │
└──────────────────────────────────────────────────┘

「追加」モーダル:
  Name              : [GitHub                ]
  Remote URL        : [https://api.github.com/mcp]
  OAuth Authz URL   : [https://github.com/login/oauth/authorize]
  OAuth Token URL   : [https://github.com/login/oauth/access_token]
  Client ID         : [Iv1.xxxxxx          ]
  Client Secret     : [●●●●●●●●            ]
  [保存]
```

保存時 setProxyConfig 経由で以下を登録:
- POST `<OAuth Token URL>` に `Authorization: Basic <Base64(client_id:client_secret)>` 固定ヘッダ
- (kintone OAuth と同じパターン)

#### Chat Panel 側 — Settings → 🔌 MCP

```
┌─ Settings → 🔌 MCP Servers ─────────────────────────┐
│                                                     │
│ Built-in                                            │
│  🟦 kintone        接続済 (admin@example.com)       │
│     Tools: 11 個 [一覧 ▼]  [再接続] [切断]          │
│                                                     │
│ 追加 MCP Server (Plugin Config Step 4 で登録済)      │
│  🟪 GitHub        [未接続]                          │
│     [🔗 接続] ← OAuth flow 起動                     │
│                                                     │
│  🟧 Slack         接続済 (admin@example.com)        │
│     Tools: 18 個 [一覧 ▼]  [再接続] [切断]          │
│                                                     │
│ ───────────────────────────────────────────         │
│ 新規 MCP Server を追加するには:                     │
│   Plugin Config → Step 4 で接続情報を登録 → ここで  │
│   「接続」ボタンを押してください                    │
└─────────────────────────────────────────────────────┘
```

#### 「接続」ボタン押下時のフロー (kintone OAuth と同じパターン)

1. Plugin Config で登録された OAuth Authorization URL を取得
2. ポップアップで認可画面を開く
3. Callback URL (= Worker の `/oauth/callback`) に `code` 付きで戻る
4. Worker が `code` を token に交換 (Client Secret は setProxyConfig 経由で Basic auth に注入)
5. Worker `/credentials/upsert` 経由で Anthropic Vault に Credential (access_token + refresh_token) を保存
6. Plugin が `tools/list` を MCP server に投げて Tool 名一覧を取得
7. UI に Tool 一覧表示
8. Agent 編集画面で個別 attach できる状態になる

#### 「切断」ボタン

- Anthropic Vault Credential を削除 (`DELETE /v1/vaults/{vid}/credentials/{cid}`)
- Plugin Config の登録 (Step 4) は残す → 再接続できる
- Agent 編集画面では当該 Tool が **未接続バッジ付き** で表示 (Agent 設定は維持されるが、実行時に動かない)

#### Tool 一覧の動的取得

MCP server の Tool は **`tools/list` で動的に列挙** されるので、サーバ側で Tool が増えた場合も Plugin の再ビルドは不要 (Settings → MCP で再接続 or 「Tool 一覧を更新」操作で最新化)。Agent 編集画面 (6.5) の Tool ツリーも、ここで取得した最新リストをもとに描画される。

---

## 7. 権限モデル

### 7.1 階層

| 役割 | できること | 紐付く kintone 権限 |
|---|---|---|
| **Plugin 管理者** | Bootstrap 設定 (Plugin Config) + Settings View で Agent / Skill / Memory / MCP の全操作 | プラグイン管理画面に入れる人 (= cybozu.com 共通管理者 / 部分管理者) |
| **アプリ管理者** (任意 / Phase 4) | アプリ単位で利用可能 Agent を絞る | アプリ設定権限 |
| **End User** | 公開された Agent を選択して使う / 会話する。Settings View は **見えない / 開けない** | アプリ閲覧権限 |

### 7.2 admin 判定ロジック

Chat Panel の Settings View 表示制御に使うフラグ:

```ts
const isAdmin = kintone.getLoginUser().administrator === true
              || /* 将来: アプリ管理者 API で個別チェック */;
```

- `kintone.getLoginUser().administrator` = cybozu.com 共通管理者フラグ
- Phase 1 (V1) はこれだけで判定 (大半の組織で問題なし)
- 将来、アプリ管理者レベルでも触りたい要望が出たら拡張 (Phase 4)

### 7.3 設計原則

- **kintone ネイティブ権限を流用**: 新しい権限レイヤーは作らない
- **Settings View の表示制御だけが権限ゲート**: 非 admin は ⚙ アイコンが見えず、URL 直接アクセスも不可
- **API レベルの二重防御**:
  - Anthropic API Key は Plugin Config で固定ヘッダ登録、end user が直接見ることはできない
  - 仮に非 admin が Settings の動作を盗み見ても、kintone 側の admin 権限が無ければ kintone REST API (管理系) は 403 で防がれる

### 7.4 セキュリティ観点

- 管理系 MCP ツール (フィールド削除 / アプリ deploy / ACL 変更) は **Customizer Agent にのみ attach**、Default Agent には付けない
- 削除系操作は引き続き `permission_policy: always_ask` で UI 確認 (現行通り)
- end user が誤って Customizer Agent を選んでも、kintone 側の admin 権限がなければ管理系 API は 403 (二重防御)
- ⚙ アイコン非表示は **UI の都合の制御** であり、本質的なセキュリティは Anthropic Workspace + kintone 側で担保される

---

## 8. 段階的リリース計画

### 8.1 V1 — wedge MVP

**ゴール**: 「**Customizer Agent が存在し、JS を書いて適用 → ロールバックまで完結する**」

| Issue | 内容 |
|---|---|
| ✅ #30 Phase1 | Skills インフラ + customize-js + plugin-development |
| 🔥 **#39** | Built-in Agent 3 variant (Default + Customizer Opus + Customizer Sonnet) + Header 切替 UI |
| 🔥 **#40** | **Chat Panel Settings View インフラ** (View 切替 + admin 判定 + Agents/Skills 最小サブセクション) |
| 🔥 **#20** | カスタマイズ JS プレビュー / 適用 / ロールバック |
| ⚙️ #30 Phase2 | kintone-query / error-recovery skill 追加 (Customizer の品質底上げ) |
| 🧹 Plugin Config 縮小 | Skills 同期セクションを Chat Panel に移管 (Plugin Config は Bootstrap だけ残す) |

### 8.2 V2 — GitHub 統合 + Agent 細かい設定 + 追加 MCP

**ゴール**: 履歴管理が完結、admin が Agent / MCP を Chat Panel から細かく調整可能

| Issue | 内容 |
|---|---|
| 🔥 **#17** | GitHub 連携 (repo / commit / PR) + Chat Panel Settings → MCP に GitHub MCP server 登録 UI |
| 🔥 **V2-新規 (Agent 詳細編集)** | Chat Panel Settings → Agents の skill / tool ON-OFF 編集機能 |
| 🔥 **V2-新規 (Custom Skill 編集 / 削除)** | Chat Panel Settings → Skills でカスタム skill の本文 (SKILL.md) 編集 + 削除。Anthropic API: `POST /v1/skills/{id}/versions` (新 version) と `DELETE /v1/skills/{id}` |
| ⚙️ **V2-新規 (MCP 登録)** | Chat Panel Settings → MCP の追加 MCP server 登録 + Vault Credential 管理 |
| ⚙️ Plugin pack/upload | cli-kintone 相当の MCP ツール (新規 Issue or #17 拡張) |
| 💾 **#15 (縮小)** | Conversation View に Memory ON/OFF トグル + (user × agent) 単位の auto-ensure (Section 6.7) |

### 8.3 V3 — フル管理スイート

**ゴール**: アプリ設計から運用まで Agent が完結支援

| Issue | 内容 |
|---|---|
| #24 | kintone MCP Phase C (管理系: フィールド / プロセス / deploy / ACL) |
| #22 | kintone MCP Phase B-1 (ワークフロー status / assignees) |
| #15 | (V2 で Memory トグル実装済の場合) Memory store の export / preview / 削除 などの軽量管理 UI を Settings に追加検討 |
| **V3-新規 (Custom Agent 作成)** | Custom Agent 新規作成 UI (system prompt 編集) |
| #25 | エラーコード対応表 / クエリビルダ拡充 |
| #30 Phase3+ | app-design / batch-patterns skill |

### 8.4 (任意) V4 — エンタープライズ機能

- #32〜#38: Claude Platform on AWS 並列サポート
- #14: モバイル対応 (#4)
- #6: Suggested prompts
- 等

> 旧案にあった「アプリ単位 Agent 制限 (#19d)」は、1 plugin = 1 app で自然に分離されるため不要と判断 (Section 13 論点 8 決定)。

---

## 9. ユーザーストーリー (V1 完成後の代表シナリオ)

### 9.1 初回 admin がセットアップする

1. kintone Plugin インストール
2. Plugin Config 画面で **Bootstrap だけ** 設定 (Worker URL + Anthropic API Key + OAuth client_id/secret)
3. 「保存」 → proxy 設定登録完了
4. **チャットパネルを開く** → Header の ⚙ アイコンから Settings View に入る
5. Settings → 🧠 Skills で「Plugin 同梱 skill を Anthropic に同期」をクリック
6. Settings → 🤖 Agents で Built-in 2 Agent が自動 ensure 済みであることを確認
7. (任意) 業務ユーザー Agent を非公開にする / モデルを変更する etc.

### 9.2 Customizer が JS カスタマイズを作って適用する

**前提**: 初回セットアップ完了済

1. Customizer がチャットパネルを開く
2. Header プルダウンから「**カスタマイザー Agent**」を選択 (初回は admin が設定したデフォルト)
3. 「営業案件アプリで完了ステータスの行を緑にして」と依頼
4. Agent が `kintone-get-form-fields` で対象アプリのフィールドを確認
5. Agent が `kintone-customize-js` skill を自動ロード
6. Artifact pane に JS コードが表示される (kind=code)
7. Customizer が「プレビュー」ボタンを押下 → 実機シミュレーション
8. 期待動作を確認後「**適用**」ボタン押下 → kintone preview→deploy API で本番反映
9. 業務部門に「適用しました」と通知
10. もし不具合発覚 → 「**ロールバック**」ボタンで直前状態に戻す

### 9.3 BusinessUser が今まで通り使う

1. レコード一覧画面でチャットパネルを開く
2. Header プルダウンは「**業務ユーザー Agent**」 (admin が組織デフォルトに設定)
3. **⚙ アイコンは表示されない** (admin 権限が無いので)
4. 「先月の進捗まとめて」と依頼
5. Agent が `kintone-get-records` でデータ取得
6. Artifact (Markdown 表) で結果表示
7. Customizer 用ツール (プレビュー / 適用 / ロールバック) は **UI 上表示されない** (Agent に attach されていないため)

### 9.4 Admin が Agent をキュレーションする (チャット画面側で完結)

1. **チャット画面**を開き Header の ⚙ アイコン → Settings View
2. **Settings → 🤖 Agents** で Built-in 2 Agent が表示される
3. 「業務ユーザー Agent」のカードで **公開トグルを OFF** にする (組織が Customizer 中心の場合)
4. 「保存」 → end user の Header プルダウンから「業務ユーザー」が消える
5. **kintone admin 画面を開きに行く必要なし**、チャット画面で完結

### 9.5 Admin が新しい MCP Server (例: GitHub) を追加する (V2 後)

**3 ステップ** に分かれる (Plugin Config → Chat Panel 接続 → Agent 紐付け)。

1. **Plugin Config を開く** → Step 4「追加 MCP Server」で「+ 追加」
2. モーダルで Name / Remote URL / OAuth Authz URL / Token URL / Client ID / Client Secret を入力
3. 「保存」 → setProxyConfig 経由で Token URL に Basic auth 固定ヘッダ登録、Plugin Config の MCP リストに追加
4. **チャット画面に戻る** → Header の ⚙ → Settings → 🔌 MCP Servers
5. GitHub 行の「🔗 接続」ボタンを押下 → OAuth popup → 認可 → callback で code 受領 → Worker が token 交換 → Anthropic Vault に Credential 保管
6. 接続成功後、GitHub MCP の Tool 一覧が表示される
7. **Settings → 🤖 Agents** で「カスタマイザー Agent」を編集 → Tool セクションの GitHub MCP Server ツリーが選択可能になる
8. 必要な Tool (例: create-issue / list-issues) を ON にして保存
9. 以降、Customizer Agent との会話で GitHub Tool が使える

---

## 10. 受け入れ条件 (V1 完成基準)

### 10.1 機能面 — Agent

- [ ] Plugin 起動時に **2 つの Built-in Agent** (Default / Customizer) が Anthropic workspace に自動 ensure される
- [ ] Header に **Agent プルダウン**が表示され、公開された Agent から選択できる
- [ ] Agent を切り替えると **新規会話が開始** される (進行中セッションは保持されない)
- [ ] **Customizer Agent** には customize-js + plugin-development skill が attach されている
- [ ] **Default Agent** には xlsx/docx/pdf/pptx skill のみが attach されている (customize 系は attach されない)
- [ ] Customizer Agent で「プレビュー」「適用」「ロールバック」のいずれかのアクションを呼び出せる (#20 完了)

### 10.2 機能面 — Chat Panel Settings View (Surface 分割)

- [ ] Header 右に **⚙ アイコン**が **admin にのみ表示** される (kintone.getLoginUser().administrator チェック)
- [ ] ⚙ クリックで Settings View が表示される
- [ ] Settings View で以下のサブセクションが表示される:
  - 🤖 Agents (Built-in 一覧、公開トグル、デフォルト設定)
  - 🧠 Skills (同梱 skill 一覧、同期ボタン)
  - 🛠 Bootstrap (Plugin Config へのリンク)
- [ ] Plugin Config から **Skills 同期セクションが削除** され、Chat Panel Settings に移管されている
- [ ] Plugin Config に残っているのは Bootstrap 4 項目 (Worker URL / Anthropic API Key / OAuth client_id / client_secret) と Cloudflare デプロイ (任意) のみ

### 10.3 権限面

- [ ] **kintone admin (= cybozu.com 共通管理者)** だけが ⚙ アイコンを見られる / Settings View を開ける
- [ ] **end user** (非 admin) からは ⚙ アイコンが表示されず、Settings View にアクセス不能
- [ ] end user は Agent プルダウンで **公開された Agent を選ぶこと**のみ可能
- [ ] kintone admin 権限を持たないユーザーが管理系 kintone API を Agent 経由で呼んでも 403 で防がれる (二重防御)

### 10.4 非機能面

- [ ] 全テスト pass (Plugin + Worker)
- [ ] E2E で「Agent 切替 → Default で会話 → Customizer に切替 → 別 Agent で会話」が通る
- [ ] E2E で「admin が Chat Panel Settings → Skills 同期」が通る
- [ ] V1 完成時の system prompt トークン数が現状から **10% 以上削減** (Agent 分離で各 prompt が簡潔化される副次効果)

---

## 11. 制約事項

| 制約 | 影響 / 対処 |
|---|---|
| **`kintone.plugin.app.setProxyConfig` は Plugin Config 画面でしか呼べない** | secret (Anthropic API Key / OAuth client_secret) の登録は Plugin Config に残さざるを得ない (Bootstrap 4 項目の根拠) |
| **`kintone.plugin.app.proxy` は desktop.js でしか動かない** | Chat Panel Settings からは `kintone.proxy()` を使う。固定ヘッダが効かないので API Key を Anthropic Vault 経由 or React state から都度ヘッダ付与する設計 |
| **Anthropic Managed Agents API: 1 session = 1 Agent** | Session 途中で Agent 切替不可。新規会話必須 (UI で明示) |
| **Anthropic Managed Agents API: Agent 定義に model が bind** | Session / Conversation 作成時に model を上書きする API は存在しない。model 違いの variant が必要なら**別 Agent として登録**する (Section 6.4.1 の Customizer Opus / Sonnet 2 variant がこれに該当) |
| **Anthropic Workspace = 全 Agent の入れ物** | 1 ユーザーが複数 workspace を持つ場合は Plugin Config の API Key 切替で対応 (現状の仕様) |
| **admin 判定は kintone.getLoginUser().administrator** | cybozu.com 共通管理者だけ。アプリ管理者レベルの細かい制御は Phase 4 |
| **kintone Plugin Config は 1 アプリ 1 設定** | 1 plugin instance あたり Agent 構成は 1 セット。複数アプリで違う構成にしたければ別 plugin instance を作る (kintone ネイティブの制約) |
| **Anthropic Skills の workspace スコープ** | Agent が異なっても skill は workspace 内で共有。skill ON/OFF は Agent 単位の attach 設定で実現 (skill 自体は同期されたものを使い回す) |
| **AWS 移行ライン (#31-#38) と並走** | 本 wedge デザインは BYOK + Anthropic Direct を前提に組む。CPA 切替後も Agent 構成は同じ仕組みで動く (endpoint だけが Worker /anthropic/* 経由) |
| **MCP Server の OAuth client_secret は Plugin Config 登録必須** | secret は setProxyConfig 経由で固定ヘッダにせざるを得ない → 追加 MCP Server も Plugin Config への登録ステップが避けられない (1 サーバーあたり 1 度) |
| **MCP Server 接続情報追加には Plugin Config 再保存が必要** | proxyConfig は admin が Plugin Config 保存ボタンを押した時にだけ登録されるので、新サーバ追加のたびに「Plugin Config で保存 → Chat Panel で接続」の往復が発生する。1 回切りの操作だが UX として明示する |
| **Memory Store は Agent ではなく Session に紐づく** | Agent 編集 UI に Memory 設定は持たない。Conversation View の ON/OFF トグルで、Session 作成時に `resources[]` へ `read_write` で attach する (Section 6.7) |
| **Memory Store の Session 中 attach/detach 不可** | Memory トグル切替 → 新規会話開始が必要。UI で明示する |
| **Memory Store は (user × agent) 単位で Plugin が auto-ensure** | admin が事前に Memory Store を作成・キュレーションする UI は持たない。end user が Memory: ON で会話開始した時に Plugin が初回 create する (Section 6.7) |

---

## 12. 関連 Issue / 後続作業

### 既存 Issue

| # | 関係 |
|---|---|
| #9 (umbrella) | 本ドキュメントの上位 |
| #19 | 本ドキュメントで 3 分割 (#39 + V2/V3 新規) を提案 |
| #20 | V1 必須 |
| #30 | Phase1 done、Phase2 が V1 範囲 |
| #17 | V2 範囲 |
| #15 / #22 / #24 / #25 | V3 範囲 |

### 新規 Issue 候補 (本ドキュメント承認後に起票)

| 仮 # | タイトル案 | スコープ |
|---|---|---|
| **#39** | Built-in Agent 3 variant + Header 切替 UI | V1 — Default + Customizer(Opus) + Customizer(Sonnet) の自動 ensure / Plugin UI / resolveAgent 拡張 (Section 6.4.1) |
| **#40** | **Chat Panel Settings View インフラ** (View 切替 + admin 判定 + Agents/Skills サブセクション) | V1 — 本要求のコア |
| **#40** | Chat Panel Settings → Agents の skill / tool ON-OFF 編集 | V2 |
| **V2-新規 (Custom Skill 編集 / 削除)** | Chat Panel Settings → Skills でカスタム skill 本文 (SKILL.md) の編集 + 削除 (`POST /v1/skills/{id}/versions` / `DELETE /v1/skills/{id}`) | V2 |
| **V2-新規 (MCP 登録)** | Chat Panel Settings → MCP の追加 MCP server 登録 + Vault Credential 管理 | V2 |
| **#41** | Custom Agent 新規作成 UI (system prompt 編集) | V3 |
| **V2-新規 (Plugin pack)** | Plugin pack / upload を Agent から実行 (cli-kintone 同等 MCP) | V2 |
| **#41** | Plugin Config から Skills セクション削除 (Chat Panel へ移管) | V1 (本要求の必須クリーンアップ) |
| (任意) **V4-不要決定済** | アプリ単位の利用可能 Agent 制限 | V4 |

### docs/ への永続化

合意後、本 requirements.md の以下だけ抜粋して `docs/customizer-experience.md` に格納 (永続的ドキュメント):

- **Surface 分割設計** (Section 5)
- **Capability Matrix** (Section 4)
- **段階リリース計画** (Section 8)

---

## 13. 決定事項 (2026-05-17 レビューで合意)

| # | 論点 | 決定 |
|---|---|---|
| 1 | **Surface 分割の境界線** | ✅ 妥当 — Plugin Config = Bootstrap 4 項目 (Worker URL / Anthropic API Key / OAuth credentials / MCP Server 接続情報) のみ、それ以外は Chat Panel Settings に集約 |
| 2 | **Settings View の表示方法** | ✅ **Artifact ペインを置き換える Side-by-Side** で右に表示。**左 192px nav + 右 detail** の 2-pane (Claude Design 2026-05-17 ハンドオフで確定、Section 15 参照) |
| 3 | **admin 判定の粒度** | ✅ `kintone.getLoginUser().administrator` (cybozu 共通管理者) で V1 OK。アプリ管理者開放は V4 でも不要 (論点 8 と整合) |
| 4 | **#40 (Settings View インフラ) を V1 必須にするか** | ✅ V1 必須。後で剥がす作業を避けるため、#39/#40 着手前に #40 のインフラを先行実装 |
| 5 | **Built-in Agent (Default) の skill 構成** | ✅ Default に customize-js skill は attach しない。表示制御等が欲しい業務ユーザーは Header で Customizer Agent に切替可 |
| 6 | **Customizer Agent のモデル選択** | ✅ Opus / Sonnet を **切替可能**にする。実現方式は次セクションで詰める (Built-in Agent を Opus/Sonnet 2 variant で登録するか、Conversation View でモデル選択 UI を出すか) |
| 7 | **「適用」ボタンの実装場所** | ✅ **Artifact カードのフッターに 5 状態 step bar** (プレビュー → 適用 → ロールバック)。詳細は Section 15.5 参照 |
| 8 | **アプリ単位 Agent 制限の必要性** | ❌ 不要。1 plugin = 1 app で自然に分離されるので V4 計画からも外す |
| 9 | **Anthropic 課金の見通し** | ⏸ V1 リリース後の利用データを見て判断。本要求では考慮しない |
| 10 | **#30 Phase1 (Plugin Config の Skills 同期 UI) の扱い** | ✅ V1 で **剥がす** — #41 で削除。Skills 管理は Chat Panel Settings に完全移行 |

凡例: ✅ 決定 / ⏸ 後続フェーズで詰める / ❌ 不要

---

## 14. 次のステップ

Section 13 の論点はすべて決定済み、デザインも Claude Design ハンドオフで確定 (2026-05-17)。残作業:

1. **design.md** にブレイクダウン (アーキ図、データ構造、resolveAgent / Settings View 構造 / 3 variant Built-in Agent ensure ロジック / API 設計)。UI 仕様は Section 15 と `docs/design-handoff/customizer-wedge/` を一次ソースにする
2. **tasklist.md** で実装タスクに分解
3. 既存 Issue #9 を本要求に合わせて更新
4. 新規 Issue #39 (Built-in Agent 3 variant + Header 切替) / #40 (Settings View インフラ) / #41 (Plugin Config Skills セクション削除) を起票
5. V1 着手開始 (#39 → #40 → #41 の順で並走可能、#20 はデザインが既に固まっているので並行で実装可)

---

## 15. デザインハンドオフ (Claude Design 2026-05-17)

> **一次ソース**: `docs/design-handoff/customizer-wedge/` 配下に Claude Design (`claude.ai/design`) の HTML/JSX プロトタイプ一式を格納。本セクションは「実装で迷ったらどこを見ればいいか」の地図 + 主要な決定の固定化。
>
> **重要**: プロトタイプは HTML/JSX で書かれているが、本プロジェクトの実装は React + Tailwind 既存スタック (`packages/plugin/src/chat/` 配下) を踏襲する。**ピクセルを再現する**のが目的であって、プロトタイプの内部構造をコピーするのではない。

### 15.1 ハンドオフバンドルの読み方

| パス | 内容 | 実装時の用途 |
|---|---|---|
| `docs/design-handoff/customizer-wedge/README.md` | Claude Design が生成したハンドオフ説明 | コーディングエージェントへの引き継ぎ書 |
| `docs/design-handoff/customizer-wedge/chats/chat6.md` | **設計決定経緯** (Header 2 段化 / 命名変更 / カスタムスキルファイル投入 等) | 「なぜこの形か」の根拠 |
| `docs/design-handoff/customizer-wedge/project/Cowork Agent Chat Panel.html` | エントリ。design canvas に全 artboard を並べた俯瞰 | 全画面の俯瞰 |
| `docs/design-handoff/customizer-wedge/project/wedge-header.jsx` | **Header 案 C (2 段構成) 確定版** + MODEL バッジ + Memory トグル + Agent ドロップダウン | 6.4 / 6.4.1 / 6.7 の具体仕様 |
| `docs/design-handoff/customizer-wedge/project/wedge-settings.jsx` (1647 行) | **Settings View 全部** — Agents 一覧 / Agent 編集 (V2) / Skills / カスタムスキル追加 (ファイル / 直接入力) / MCP / MCP Tools 詳細 / カスタム Agent 作成 (V3) / IconPicker | 6.5 / 6.6 / 6.8 の具体仕様 |
| `docs/design-handoff/customizer-wedge/project/wedge-workflow.jsx` | **プレビュー → 適用 → ロールバック** 5 状態 step bar + FileTree + CustomizerArtifactCard | #20 の具体仕様 |
| `docs/design-handoff/customizer-wedge/project/wedge-canvas.jsx` | design canvas (全 artboard をプロトタイプとして並べる) | 各画面の組み合わせ確認 |
| `docs/design-handoff/customizer-wedge/project/styles.css` | 共通トークン (フォント / アニメーション / Markdown body) | デザイントークン |
| `docs/design-handoff/customizer-wedge/project/variant-rich.jsx` | 既存 Rich variant (会話 UI 本体)。新規ではなくベース | 統合先 |
| `docs/design-handoff/customizer-wedge/project/artifact.jsx` | 既存 Artifact ペイン | Settings View / Customizer Artifact のレイアウト整合 |

### 15.2 Header: 案 C (2 段構成、確定)

選定理由: 380px パネル幅で「カスタマイザーエージェント (OPUS)」が省略されずに読める。

```
┌─ Header 上段 (~45px) ─────────────────────────┐
│ [CA] Cowork Agent [for kintone]  [💾 メモリ OFF] [⚙] [×] │
└────────────────────────────────────────────────┘
┌─ Header 下段 (~45px) — フル幅 Agent pill ──────┐
│ [🤖] カスタマイザーエージェント  [OPUS ▾]      │
└────────────────────────────────────────────────┘
```

**仕様詳細**:

| 要素 | 仕様 |
|---|---|
| CA brand mark | 32×32 / radius 9 / accent 背景 / 白文字「CA」JetBrains Mono 10.5px font-weight 800、緑ステータスドット 10×10 (右下に -2px オーバーラップ) |
| タイトル | 「Cowork Agent」13px font-weight 700 letter-spacing -0.2 + `[for kintone]` バッジ (accent ソフト bg + accent 文字 9px) |
| Memory トグル | pill 999 radius / border / `[💾] メモリ ON/OFF` の 3 要素 / V1 は **disabled 寄り** (opacity 0.6, cursor default, title="メモリ機能は V2 で有効化されます") |
| ⚙ Gear ボタン | 28×28 / radius 7 / **admin にのみ表示** / hover で cardHi 背景 |
| × Close ボタン | 28×28 / radius 7 |
| Agent pill (下段) | フル幅 / radius 10 / 22×22 アイコン + 名前 (text-overflow ellipsis) + MODEL バッジ + ▾ |
| MODEL バッジ | **OPUS = 塗り** (accent bg / onAccent text) / **SONNET = 枠線** (accent border / accent text) / JetBrains Mono 8.5–9.5px font-weight 700 letter-spacing 0.6 / radius 3 |
| Agent ドロップダウン | 下段 pill の真下に同幅で展開、3 Agent + フッターヒント「切替時は新規会話が開始されます」 |

実装ファイル参照: `docs/design-handoff/customizer-wedge/project/wedge-header.jsx:306-390` (HeaderVariantC)

### 15.3 Agent カタログ (Built-in 3 variant、確定命名)

| ID | name | model | desc | isDefault |
|---|---|---|---|---|
| `biz` | **業務エージェント** | sonnet | レコード操作 / 集計 / ドキュメント生成 | false |
| `cust-opus` | **カスタマイザーエージェント** | opus | JS カスタマイズ / Plugin 開発 — 高品質 | **true** |
| `cust-sonnet` | **カスタマイザーエージェント** | sonnet | JS カスタマイズ / Plugin 開発 — 速度・低コスト | false |

> 「業務ユーザー Agent」「カスタマイザー Agent」という旧命名は廃止 (chat6.md で確定)。リポジトリ内の resolveAgent.ts / promptVersion 等もこの命名に揃える。

### 15.4 Settings View: 2-pane 構成 (確定)

- Artifact ペインを **置き換えて右側に表示** (Side-by-Side、modal でも別画面でもない)
- 左 **192px nav** + 右 **detail** の 2-pane
- Header: ⚙ アイコン + 「設定」13px font-weight 600 + 「管理者専用 · 変更は新規セッションから反映」サブテキスト + ×
- Nav 構成: **🤖 エージェント / 🧠 スキル / 🔌 MCP サーバー** の 3 項目 (各 item に件数バッジ)
- Nav 下部に「**外部接続 > Plugin Config →**」リンク (Bootstrap 画面への戻り導線、Section 5.5.1 の判断を覆して **入れる**)
- Memory タブは **存在しない** (Section 6.7 の決定通り)
- Usage タブも **存在しない** (Section 5.5.1)

#### Agents 一覧 (V1 — #39)

- Built-in 3 variant を並列表示 + 公開トグル
- **「組織のデフォルト」セクションは無し** (chat6.md で削除決定)
- 新規 Custom Agent 作成ボタン (V3)

#### Agent 編集 (V2 — #40)

- 名前 / アイコン / 説明 (Description) 編集行 + System Prompt textarea
- Skills ON-OFF リスト
- Tools ツリー (MCP Server header → cascade、Kintone MCP はカテゴリで目視グルーピング、`⚠ ask` バッジ)
- Built-in には **「Plugin が管理」バッジ + 上書き注意** を表示

#### Skills 管理 (V1)

- 同梱 / カスタム / Workspace 全体の 3 層表示
- 「カスタムスキル追加」モーダルは **タブ切替** で `📤 ファイル` / `📝 直接入力` 両モード対応
  - ファイル: ドロップゾーン (SKILL.md / .md / .zip、最大 8 MB) → frontmatter 自動抽出
  - 直接入力: name / description / SKILL.md textarea
- アップロードボタンは reading 中 disabled

#### MCP Tools 詳細 (V2 — #45)

- **フラット一覧** (参照系 / 書込系 / 管理系 の **グルーピングは無し** — chat6.md で削除決定。理由: MCP Server 側がこの分類情報を持たないため)
- ソート: 名前順 / 使用頻度順 / 要承認を上に
- 列: 名前 / 説明 / 使用エージェント数 / `⚠ ask` バッジ

#### カスタム Agent 作成 (V3 — #41)

- IconPicker: **8 glyph × 8 color マトリクス + ライブプレビュー (44×44)**
- Glyph: 業務 / 開発 / 分析 / メール / 予定 / 運用 / AI / 文書

### 15.5 Customizer Artifact カード + Workflow フッター (#20)

#### レイアウト

```
┌─ Artifact Header ─────────────────────────────────────┐
│ [JS] 完了行ハイライト ▾    [ソース|差分] [📋][⬇][×]    │
├──────────────┬─────────────────────────────────────────┤
│ [FileTree   ]│ [Source viewer]                         │
│  customize/  │  // 完了行ハイライト                    │
│  ├ desktop.js│  (() => {                               │
│  │   M ●     │    'use strict';                        │
│  ├ mobile.js │    ...                                  │
│  └ desktop.css│                                        │
│  manifest    │                                         │
│  README.md   │                                         │
│              │                                         │
│ ● プレビュー  │                                         │
│   環境 と同期 │                                         │
├──────────────┴─────────────────────────────────────────┤
│ [Step1 プレビュー] ─ [Step2 適用] ─ [Step3 ロールバック]│
│ ● status line ─────────────────── [primary action btn] │
│ 変更したい場合はチャットに新しい指示を入力してください │
└────────────────────────────────────────────────────────┘
```

#### Workflow 5 状態

| state | step.preview | step.apply | step.rollback | status line | primary action |
|---|---|---|---|---|---|
| `ready` | current | locked | locked | まだ実機で動かしていません (neutral) | **プレビューを実行** |
| `previewed` | done | current | locked | プレビューで動作確認済 — 本番反映できます (ok 緑) | もう一度プレビュー / **kintone に適用** |
| `applying` | done | inprogress | locked | kintone preview → deploy を実行中… (work) | 適用中… (disabled, cursor wait) |
| `applied` | done | done | current | 「{appName}」に適用済 · HH:MM (ok 緑) | 適用先を開く / **ロールバック** (warn #b45309) |
| `rolled-back` | done | done | done | ロールバック完了 — 直前のカスタマイズに戻しました (warn) | **もう一度適用** |

#### FileTree (左 200px サイドバー)

- ファイル種別バッジ (JS/CSS/JSON/MD カラー違い)
- 変更ステータス: `M` (modified) / `+` (new) / なし (unchanged)
- 現在編集中ファイルは accent border-left 2px + cardHi 背景
- フッター: 緑ドット + 「プレビュー環境 と同期」

実装ファイル参照: `docs/design-handoff/customizer-wedge/project/wedge-workflow.jsx` (WorkflowFooter / FileTree / CustomizerArtifactCard)

### 15.6 デザイントークン (確定値)

#### 色 (Rich variant、accent = ティール)

| トークン | 値 |
|---|---|
| `bg` (panel 背景) | `#faf8f3` (light) |
| `panel` (header / footer) | 同上 + backdrop-filter: blur(12px) |
| `card` / `cardHi` | 段階的に明るい / 暗いバリエーション |
| `text` | `#231200` (ダークブラウン) |
| `accent` (default) | `#0d9488` (ティール) — Tweak で `#059669` / `#d97706` / `#ffbf00` / `#231200` に切替可 |
| `border` | `rgba(35,18,0,0.10)` 等 |
| warning | `#b45309` / `#f59e0b` / `#fef3c7` |
| success | `#22c55e` |

> kintone admin 画面側 (host) は **黄色アクセント `#ffbf00`** だが、Plugin 内パネルは **ティール `#0d9488`** で差別化。

#### タイポグラフィ

| 用途 | フォント | サイズ |
|---|---|---|
| 本文 (日本語) | Noto Sans JP / Hiragino Sans / Yu Gothic | 12.5–13.5 px |
| コード / ID / 数値 | JetBrains Mono | 8.5–11.5 px |
| ヘッダー | Noto Sans JP 700 | 13–15 px |

#### 共通アニメーション (styles.css)

- `slideUp 0.28s` — メッセージ fade-in
- `blink 1.2s` — typing dot
- `shimmer 1.6s` — progress bar
- `pulse-ring 1.8s` — status dot
- `think 1.6s` — thinking text

### 15.7 admin vs 業務ユーザー の差分

| 要素 | admin | 業務ユーザー |
|---|---|---|
| Header ⚙ アイコン | ✅ 表示 | ❌ 非表示 |
| Agent プルダウンの選択肢 | 公開された全 Agent | 公開された全 Agent (現状は同じ。アプリ管理者 ACL は V4 不要決定) |
| Settings View アクセス | ✅ | ❌ (URL 直接アクセスも不可) |
| 非公開 Agent | プルダウンに出さない (両者共通) | プルダウンに出さない (両者共通) |

判定: `kintone.getLoginUser().administrator === true`

### 15.8 design.md / tasklist.md への展開時の方針

- 本セクションは **UI の最終仕様**。design.md は「これをどう React + Tailwind で再現するか」のアーキ図に集中する
- ピクセル単位の数値は本セクションを一次ソースにする。プロトタイプ JSX の数値と本セクションが矛盾したら **本セクションが勝つ**
- 新規 Issue (#39 / #40 / #41) の Acceptance Criteria は本セクションを引用する

### 15.9 design ハンドオフを取り込んだことで Section 13 / 7 が解決済になった項目

| Section | 解決方法 |
|---|---|
| 13 #2 (Settings View 表示方法) | ✅ Side-by-Side 2-pane (192 + detail) |
| 13 #7 (適用ボタン) | ✅ Artifact フッターに 5 状態 step bar |
| 5.5.1 Bootstrap リンク不要 | ⚠ **覆して残す** — Settings View nav 下部に「Plugin Config →」を配置 (デザインで自然に置けた) |

> Section 5.5.1 の判断は「不要」だったが、デザインで nav 末尾に小さく置く形なら散らからずに済むと判断し **入れる方針に変更**。Bootstrap 設定への戻り導線として有用。
