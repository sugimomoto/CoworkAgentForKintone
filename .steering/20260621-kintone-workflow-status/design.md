# 設計: kintone プロセス管理（ワークフロー）レコード操作 — #22 Phase B-1

requirements.md の確定事項に基づく実装設計。

## 全体方針
- **Worker（kintone-mcp）**: kintone REST API を叩く 3 ツールを既存 `createTool` パターンで追加。
- **Plugin**: 3 ツールを Agent の toolset に公開。**業務（business）built-in variant のみ**。
  ステータス変更系は `always_ask`（承認カード）、作業者変更は `always_allow`。
- エラーは既存 `KintoneApiError` がそのまま分かる形で surface する（特別処理は最小）。

---

## 1. Worker — 追加ツール（3）

既存の `update-record.ts` / `update-records.ts` と同じ構造（`createTool` + `kintoneRequest` + `toolResult`）。

### 1.1 `kintone-update-record-status`
- API: `PUT /k/v1/record/status.json`
- 入力: `app`(必須), `id`(必須), `action`(必須), `assignee?`(単一 code), `revision?`
- body: `{ app, id, action, assignee?, revision? }`
- 出力: `{ revision }`
- バリデーション: `app` / `id` / `action` 必須（`action` は非空文字列）。

### 1.2 `kintone-update-records-statuses`
- API: `PUT /k/v1/records/status.json`
- 入力: `app`(必須), `records: [{ id, action, assignee?, revision? }]`（最大 100）
- body: `{ app, records }`
- 出力: `{ records: [{ id, revision }] }`
- バリデーション: `assertMaxBatch`（100）、`assertNonEmpty`、各 entry の `id` / `action` 必須。

### 1.3 `kintone-update-record-assignees`
- API: `PUT /k/v1/record/assignees.json`
- 入力: `app`(必須), `id`(必須), `assignees: [code, …]`, `revision?`
- body: `{ app, id, assignees, revision? }`
- 出力: `{ revision }`
- バリデーション: `app` / `id` 必須。`assignees` は配列（**空配列 = 全作業者解除**として許容）。

### 入力スキーマ部品（`utils/schemas.ts` に追加）
```ts
export const actionSchema = {
  type: 'string',
  description: 'プロセス管理で定義されたアクション名 (例「対応開始」「完了する」)。アプリ設定に存在する名称のみ。',
} as const;
export const assigneeCodeSchema = {
  type: 'string',
  description: '作業者のログイン名 (ユーザ code)。ステータス遷移先が作業者指定を要する場合に渡す。',
} as const;
export const assigneesSchema = {
  type: 'array',
  items: { type: 'string' },
  description: '作業者のログイン名 (code) 配列。空配列で全作業者を解除。',
} as const;
```

### エラー設計（追加実装ほぼ不要）
`kintoneRequest` は失敗時 `KintoneApiError`（`message = "kintone <status> [<code>]: <body>"`）を投げ、
MCP のツール結果としてそのまま LLM に渡る。これにより:
- **AC-4 不正 action** → `400 [...]` にアプリ側メッセージ（「アクションが存在しません」等）が乗る。
- **AC-5 revision 競合** → `409`（`GAIA_CO02` 等）。
- **AC-6 権限なし / ワークフロー無効** → `403` / `400`（kintone の文言）。
→ 追加のハンドリングは不要。引数バリデーション（必須/最大件数）のみツール側で行う。

---

## 2. Plugin — Agent への公開（業務 variant のみ）

### 2.1 公開するツール名
3 ツールを kintone ツール名リストに追加:
`kintone-update-record-status` / `kintone-update-records-statuses` / `kintone-update-record-assignees`

### 2.2 配線箇所（調査して確定）
- built-in 用ツール名と destructive 集合は **`core/bootstrap/builtInAgents.ts`** の
  `KINTONE_TOOL_NAMES` / `DESTRUCTIVE_TOOL_NAMES`、custom 用は **`core/bootstrap/agentToolDefs.ts`** にある。
  → 両方の `KINTONE_TOOL_NAMES` に 3 ツールを追加（Worker の `TOOL_NAMES` と手動同期。コメントの指示どおり）。
- **business variant のみ**に出す: 各 built-in spec の `mcpToolFilter(name)` で variant 別に絞っている。
  業務 spec の filter が 3 ツールを通し、Customizer Opus / Sonnet の filter は通さないようにする。
- **always_ask**: `DESTRUCTIVE_TOOL_NAMES`（= `permission_policy: always_ask` にマップ）に
  **status 系 2 ツールを追加**（`update-record-status` / `update-records-statuses`）。
  `update-record-assignees` は追加しない（= `always_allow`、可逆操作）。
  - 命名は「destructive」だが実体は「承認カードを要する（取り戻し不可リスク）」集合。コメントで補足する。
  - 旧来の delete に加え status 系も承認対象になる。

### 2.3 always_ask の根拠（確定）
ステータス遷移は「完了 → 取り戻し不可」設定があり得る。アプリの取り戻し可否を事前判定するには
`kintone-get-process-management`（#24, 本スコープ外）が必要なため、**当面は安全側に倒し status 変更を
一律 `always_ask`**（承認カード）とする。作業者変更は可逆なので `always_allow`。
（将来 #24 で取り戻し可否を読めるようになれば動的出し分けに変更可能。）

### 2.4 toolsVersion 連動（#86）
業務 spec の `mcpToolFilter` 出力が変わるため `computeToolsVersion` が変化し、既存の業務 built-in Agent は
次回 bootstrap 時に `reconcileBuiltInAgentTools` で `updateAgent`（tools + mcp_servers）追従する。追加作業なし。

---

## 3. 変更ファイル

### Worker（kintone-mcp）
- `src/tools/update-record-status.ts`（新規）
- `src/tools/update-records-statuses.ts`（新規）
- `src/tools/update-record-assignees.ts`（新規）
- `src/tools/utils/schemas.ts`（actionSchema / assigneeCodeSchema / assigneesSchema 追加）
- `src/tools/index.ts`（tools 配列に 3 つ追加）
- `tests/tools/*.test.ts`（新規 3 ファイル、または既存に追記）

### Plugin
- `src/core/bootstrap/builtInAgents.ts`（`KINTONE_TOOL_NAMES` に 3 追加 / `DESTRUCTIVE_TOOL_NAMES` に status 系 2 追加 / 業務 spec の `mcpToolFilter`）
- `src/core/bootstrap/agentToolDefs.ts`（custom 用 `KINTONE_TOOL_NAMES` / `DESTRUCTIVE_TOOL_NAMES` 同期）
- 必要に応じて関連テスト（tool 数 assert・business が 3 ツールを持つ・always_ask）

> 注: `KINTONE_TOOL_NAMES` の真の source は Worker `tools/index.ts` の `TOOL_NAMES`（別バンドルゆえ手動同期）。
> 実装時に builtInAgents.ts / agentToolDefs.ts の現在の定義を確認し、重複があれば既存方針どおり両方更新する。

---

## 4. テスト方針
- **Worker**: 各ツールで (a) 正常系（API path / body / 出力）、(b) バリデーション（必須欠落・最大件数超過）、
  (c) `KintoneApiError` 伝播（400/409）を既存テストパターンで検証。
- **Plugin**: 業務 built-in が 3 ツールを含むこと、status 系が `always_ask`・assignees が `always_allow`、
  Customizer variant には出ないこと。toolsVersion 変化は既存 reconcile テストの範囲。

## 5. 受け入れ条件との対応
| AC | 対応 |
|---|---|
| AC-1/2/3 | 3 ツール実装 + 正常系テスト |
| AC-4/5/6 | KintoneApiError がそのまま surface（追加処理不要）+ テストで確認 |
| AC-7 | status 系 always_ask（承認カード）/ assignees always_allow |
| AC-8 | Worker/Plugin unit test green、business toolset に 3 ツール追加 |
