# requirements.md — Anthropic Memory Stores 統合（#15 / Step 1 基盤+preferences ＋ Step 2 閲覧編集UI）

親 Issue: [#15](https://github.com/sugimomoto/CoworkAgentForKintone/issues/15)（size L / tier 2-foundation / V2 縮小スコープ）
API 正本: `.claude/skills/ClaudeManagedAgents/references/memory.md`
（memory store 系エンドポイントは beta `agent-memory-2026-07-22` / session attach は `managed-agents-2026-04-01`。両者を同一リクエストに混在させない）

> **2026-07-11 改訂**: 当初この段は「#128 のタスク台帳を Memory Store にする」決定の土台として位置づけていたが、
> #128 は概念B（session スコープの進行管理・Memory 不使用）に確定したため、その駆動関係は**失効**。
> 本ステアリングは **#15 単独の価値**（セッションを跨ぐ好み・業務文脈の継承）として独立して進める。

## 1. 概要 / 背景

Managed Agents の **Memory Stores** を統合し、Session を跨いでユーザーの好み・業務コンテキストを引き継げるようにする。Memory Store は workspace スコープのテキスト文書集合で、Session に attach すると agent の container 内に `/mnt/memory/<store-name>/` としてマウントされ、agent が標準ツール（bash/read/write）で読み書きする。CRUD は host（プラグイン）からも Anthropic API 直で可能（Worker 不要・既存 `kintone.proxy → api.anthropic.com` 経路）。

本ステアリングは #15 の **第1段（Step 1 / V2 縮小スコープ）** のみを対象とする。これは同時に **#128 のタスク台帳が使う programmatic Memory クライアントの土台**になる。

## 2. 今回のスコープ

### 2.1 In Scope（第1段）

1. **programmatic Memory クライアント**（`core/managed-agents/` に新設）
   - Memory Store: create / list（全件 → クライアント側 name フィルタ）/ retrieve / update / archive
   - Memory: list(path_prefix/depth/view) / create / retrieve / update(precondition=content_sha256) / delete
   - memory store 系だけ beta ヘッダを `agent-memory-2026-07-22` に**置換**して送る（`apiRequest` の extraHeaders 経由）。
   - 既存 API クライアント（`kintone.plugin.app.proxy` 経由 Anthropic 呼出）の上に薄く実装。
   - ※ 将来の閲覧/編集 UI（Step 2）の土台。
2. **2 レイヤーの store 解決（find-or-create）** — §6-A
   - `resolveUserPreferencesStore({ kintoneDomain, kintoneUserCode })`（per-user 共有）。
   - `resolveAgentContextStore({ kintoneDomain, kintoneUserCode, agentId })`（per-user × agent）。
   - 既存 `resolveUserVault` と同じ in-flight 保護 + 最古採用。identity は `name`（find のキー / mount slug 元）で決定的に組み立て、必要なら metadata も付す。
   - 初回に基本ファイルを空 seed（存在チェックしてから create、409 は無視）。
3. **Session attach**
   - `createUserSession`（`resolveSession`）に `resources[]` を追加し、preferences（read_write）+ agent-context（read_write）を `instructions` 付きで attach。
   - attach は **Memory トグル ON のときのみ**。mount path は resource 応答の `mount_path` を正とする（slug を自前生成しない）。
4. **システムプロンプト調整 + promptVersion bump**
   - 「開始時に `/mnt/memory` 配下（mount_path）を確認し、口調・業務用語・過去の修正を反映。新しい好みは追記。機微情報は書かない」を追記。
   - 既存 Agent を再作成/更新（bootstrap reconcile）で反映。
5. **Memory トグルの有効化（既定 ON / opt-out）** — §6-B
   - 既存の placeholder `MemoryToggle`（常時 disabled）を有効化し、ON/OFF を chatStore + 永続化（per-user, localStorage）に保存。既定 ON。トグルが次回以降のセッションの attach 有無を制御。

6. **メモリ閲覧/編集 UI（Step 2 / SettingsView 統合）** — 2026-07-11 スコープ追加
   - **設定画面（SettingsView）に per-user の「メモリ」セクション**を追加（独立ペインではない。「定期実行」と同じ非 admin 可）。
   - そのため **⚙️ gear を全ユーザーに開放**（非 admin には「定期実行」「メモリ」のみ表示。#81 の非 admin 導線も同時開通）。
   - 2 store（preferences / agent-context）をツリー表示 → ファイル選択で内容表示（Markdown レンダ）。
   - インライン編集 + 保存（`updateMemory`、`content_sha256` 楽観ロック）/ ファイル削除。
   - **versions 履歴・rollback・redact は含めない**（→ #149 に分離）。

### 2.2 Out of Scope（後続段）

- **versions 履歴 UI / rollback / redact**（compliance）→ **別 Issue #149**
- **Step 3**: domain context store（admin が seed する共有ナレッジ・read_only attach）＋ admin UI
- **Step 5**: workflow definitions（#12 連動）
- 複数 store の高度な運用、GDPR 削除運用ドキュメント（設計メモに残すのみ）

## 3. ユーザーストーリー（第1段）

- **US-1**: 「私はですます調が好み」と伝えると preferences に記録され、次の**新規会話でも自動でですます調**になる。
- **US-2**: 「お客様アプリの ID は 5」と伝えると業務用語として記録され、次回「お客様アプリの5件」と頼んでも正しく解釈される。
- **US-3**: メモリを使いたくない会話では **トグル OFF** にでき、その会話ではメモリを attach しない。
- **US-4（Step 2）**: 設定画面の「メモリ」から自分のメモリをツリーで開き、内容を確認・手直し（編集/削除）できる。

## 4. 受け入れ条件

**Step 1（基盤）**
- [ ] Memory トグル ON のとき、新規セッション作成時に preferences / agent-context store が find-or-create され `read_write` で attach される。
- [ ] agent が書いた内容が、次の新規セッション（同一ユーザー）でも参照される（口調/業務用語の継承）。
- [ ] トグル OFF のセッションでは memory store が attach されない。
- [ ] store はユーザー（+agent-context は agent）ごとに name で完全分離され、他ユーザーからアクセスできない。
- [ ] programmatic Memory クライアント（store/memories CRUD）が単体テストで検証されている。
- [ ] store 解決に失敗しても会話は継続する（graceful degradation）。

**Step 2（閲覧/編集 UI・SettingsView 統合）**
- [ ] 非 admin も ⚙️ から設定画面を開け、「メモリ」セクションが見える（admin 専用セクションは非表示のまま）。
- [ ] 「メモリ」で preferences / agent-context のファイルツリーが見える。
- [ ] ファイルを選ぶと内容が表示され、インライン編集 → 保存（楽観ロック）できる。
- [ ] ファイル削除ができる。versions 履歴/rollback/redact は含まない（→ #149）。

**共通**
- [ ] 既存機能（会話/Deployments/Skills/MCP/タスク機構#128）にデグレなし。型/lint/vitest/build グリーン。

## 5. 制約 / 非機能

- **secret-zero**: Anthropic キーは Cloudflare に置かない（[[no-anthropic-key-in-cloudflare]]）。Memory CRUD は `kintone.plugin.app.proxy` 経由の既存 Anthropic 呼出で完結（Worker 不要）。
- **prompt injection 防御**: read_write の preferences は injection が書き込まれるリスクがあるため、システムプロンプトで「機微情報を書かない」を明示。共有系（Step 3）は必ず read_only。
- **1 Session 最大 8 store / attach は作成時のみ / 個別 memory ≤ 100kB**（API 制約を design で遵守）。
- **楽観ロック**: 将来 admin+agent が同一 memory に書く場合に備え、update は `content_sha256` precondition を使えるクライアント設計にする。

## 6. 決定事項（2026-07-11 確定）

- **A. store の粒度 → 2 レイヤー両立**:
  - **preferences store（per-user 共有）**: 口調・日付表記・全社的な業務用語エイリアスなど、エージェントに依らないユーザー資産。全エージェント共通で attach。
  - **agent-context store（per-user × agent）**: そのエージェント固有の学習・修正記録。現在のエージェントのセッションにのみ attach。
  - 1 Session に 2 store attach（8 store 上限に対し余裕）。「どのセッションでも共通／エージェントごとに最適化」の 2 軸に対応。
- **B. トグルの既定値 → ON（opt-out）**: 新規ユーザーは既定で Memory 有効。ユーザーが不要な会話で OFF にできる。
  - プライバシー配慮はシステムプロンプト（機微情報を書かない）とトグル OFF で担保する。
- **C. スコープ → Step 1 + programmatic CRUD 土台**: agent 自律の読み書き（Step 1）に加え、host 側の store/memories CRUD クライアントも今回実装する（将来の閲覧/編集 UI = Step 2 や他用途の土台）。
  - #128 との駆動関係は失効済み（§冒頭改訂ノート参照）。

## 7. 未決（design で決める）

- find-or-create の具体（`name_query` で引くか、`GET /v1/memory_stores` 全件 + metadata フィルタか）。命名（`store.name` が mount ディレクトリ名になる点に注意）。
- 初期 seed するファイル構成（general.md / field-aliases.md 等）と instructions 文面（≤4,096字）。
- 完了検知・エラー時の attach フォールバック（store 作成失敗時はメモリ無しで続行する等）。
- promptVersion bump に伴う既存 Agent 反映（reconcile）の具体。
