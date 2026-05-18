# Customizer Wedge V1 — タスクリスト (tasklist.md)

> [design.md](./design.md) Section 9 を 1 タスク = 1 commit 粒度に分解。
> 完了したら `[x]` でチェック。Issue は本リスト確定後に起票。
> 凡例: **工数** = S (≤ 30 分) / M (≤ 2 時間) / L (≤ 半日)。**並列** = 他タスク完了を待たず着手可。

## ステータスダッシュボード

| Phase | 概要 | 関連 Issue | タスク数 | 状態 |
|---|---|---|---|---|
| **Phase 1** | 基盤型・データ層 | #39 / #40 | 6 | ✅ 完了 |
| **Phase 2** | UI 主要 (Header / Settings View) | #39 / #40 | 3 | ✅ 完了 |
| **Phase 3** | Skills 移管 + Plugin Config 縮小 | #40 / #41 | 3 | ✅ 完了 |
| **Phase 4** | Customizer Wedge ループ | #20 | 4 | ✅ 完了 |
| **Phase 4.5** | V1 wire-up 仕上げ (実 API 連携 / Artifact 統合 / テスト書き直し) | #39 / #40 / #20 | 5 | ✅ 5/5 完了 |
| **Phase 5** | E2E + リリース準備 | 全 V1 | 4 | ⬜ |

---

## Phase 1 — 基盤型・データ層

### [x] P1.1 — `useIsAdmin` hook 実装

**Issue**: #40 / **工数**: S / **並列**: ✅ 即着手可

- 新規 `packages/plugin/src/core/admin/useIsAdmin.ts`
- 新規 `packages/plugin/src/core/admin/useIsAdmin.test.ts`
- `kintone.getLoginUser().administrator === true` を返す。`window.kintone` が無い (テスト環境) ケースで false にフォールバック
- 受け入れ: vitest pass / カバレッジ 100%

---

### [x] P1.2 — `AgentRecord` / `AgentGlyph` / `AgentColor` 型定義

**Issue**: #39 / **工数**: S / **並列**: ✅ 即着手可

- 新規 `packages/plugin/src/core/bootstrap/agentTypes.ts` ([design.md §2.4](./design.md#24-builtinagent--agentrecord-型))
  - `AgentGlyph` = `'biz' | 'cust' | 'dev' | 'analytics' | 'mail' | 'calendar' | 'ops' | 'ai' | 'doc'`
  - `AgentColor` = `'accent' | 'accentSoft' | 'teal' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate'`
  - `AgentRecord` interface (id / name / model / modelLabel / description / purpose / iconKind / iconColor / visibility / isDefault / variantGroup? / source)
- 受け入れ: tsc 通る / 既存テスト影響なし

---

### [x] P1.3 — `builtInAgents.ts` spec テーブル + system prompt 分割

**Issue**: #39 / **工数**: L / **依存**: P1.2

- 新規 `packages/plugin/src/core/bootstrap/builtInAgents.ts`
  - `BUILTIN_AGENT_SPECS: Record<Purpose, AgentSpec>` ([design.md §3.3](./design.md#33-agent-定義の分離--builtinagentsts))
  - 3 variant: `business` / `customizer-opus` / `customizer-sonnet`
- 既存 `resolveAgent.ts` の `DEFAULT_AGENT_SYSTEM_PROMPT` (184 行) を分割:
  - `COMMON_GUARDRAILS` (artifact / ファイル添付 / FILE フィールド注意)
  - `BUSINESS_TOOLS_PROMPT` (kintone-* ツール案内、削除確認)
  - `CUSTOMIZER_WORKFLOW_PROMPT` (preview/apply/rollback の安全 workflow、適用前確認必須)
- 新規 `packages/plugin/src/core/bootstrap/builtInAgents.test.ts`
  - 各 variant が model / skill / tool 構成を正しく返す
  - skill filter / mcp tool filter が purpose 別に正しく動く
- 受け入れ: vitest pass / トークン数が分割前と同等以下

---

### [x] P1.4 — `resolveBuiltInAgents` を resolveAgent.ts に追加

**Issue**: #39 / **工数**: M / **依存**: P1.3

- 既存 `packages/plugin/src/core/bootstrap/resolveAgent.ts` を拡張
  - `resolveBuiltInAgents(options) → Promise<{ business, customizerOpus, customizerSonnet }>` 新規エクスポート
  - 内部で `Promise.all([resolveOne('business', ...), resolveOne('customizer-opus', ...), resolveOne('customizer-sonnet', ...)])`
  - in-flight Promise キャッシュは purpose 単位 (`Map<purpose, Promise<Agent>>`)
  - metadata に `purpose` / `iconKind` / `iconColor` / `variantGroup` / `isDefault` / `visibility` を含める
  - 既存 `resolveDefaultAgent` は **破壊的変更しない** (後方互換)
- 新規 `packages/plugin/src/core/bootstrap/resolveBuiltInAgents.test.ts`
  - 既存 Agent 検出 → 新規作成のフォールバック
  - レース対策 (pickOldest)
  - kintoneDomain 違いで別 Agent 扱い
- 受け入れ: vitest pass / 既存 `resolveDefaultAgent.test.ts` も pass

---

### [x] P1.5 — `chatStore` 拡張

**Issue**: #39 / #40 / **工数**: M / **並列**: ✅ 即着手可 (P1.2 と並走)

- 既存 `packages/plugin/src/store/chatStore.ts` を拡張 ([design.md §2.3](./design.md#23-chatstore-拡張))
  - `view: 'chat' | 'history' | 'settings'` に `'settings'` 追加
  - `currentAgentId: string | null` 追加 + setter
  - `builtInAgents: AgentRecord[]` 追加 + setter
  - `memoryEnabled: boolean` 追加 (V1 は常に false)
  - `workflowHistory: Map<artifactId, prevCustomizeJs>` 追加 (P4 ロールバック用)
- localStorage persist: `currentAgentId` のみ `cowork-agent:current-agent:<domain>:<userCode>` で永続化
- 既存 `chatStore.test.ts` 拡張
- 受け入れ: vitest pass / 既存 view 切替テスト影響なし

---

### [x] P1.6 — `AgentIcon` コンポーネント

**Issue**: #39 / **工数**: M / **依存**: P1.2

- 新規 `packages/plugin/src/desktop/components/AgentIcon.tsx`
  - props: `kind: AgentGlyph`, `color: AgentColor`, `size: number`
  - 9 glyph すべて SVG で実装 ([docs/design-handoff/customizer-wedge/project/wedge-header.jsx:44-62](../../docs/design-handoff/customizer-wedge/project/wedge-header.jsx) + wedge-settings.jsx の glyph 定義を参考)
  - 10 color (accent / accentSoft / teal / emerald / amber / rose / indigo / slate) を CSS 変数 or token map で解決
- 新規 `packages/plugin/src/desktop/components/AgentIcon.test.tsx`
  - 各 glyph がレンダーされる / size が反映される / color トークンが背景に出る
- 受け入れ: vitest pass / 全 9 glyph × 10 color の組み合わせで型エラーなし

---

## Phase 2 — UI 主要 (Header / Settings View)

### [x] P2.1 — Header (案 C) + `ModelBadge` + `AgentPicker` + `MemoryToggle`

**Issue**: #39 / #40 / **工数**: L / **依存**: P1.5 / P1.6

- 新規 `packages/plugin/src/desktop/Header.tsx` ([design.md §5](./design.md#5-header-コンポーネント--design-案-c-2-段構成))
  - 上段: CA brand mark + "Cowork Agent" + `[for kintone]` バッジ + MemoryToggle + GearButton + CloseButton
  - 下段: フル幅 AgentPicker pill
- 新規 `packages/plugin/src/desktop/components/ModelBadge.tsx`
  - props: `model: 'opus' | 'sonnet'`
  - OPUS = 塗り (accent bg) / SONNET = 枠線
- 新規 `packages/plugin/src/desktop/components/AgentPicker.tsx`
  - Header 下段の pill + ドロップダウン
  - visibility='public' な Agent だけリスト
  - 選択時に `setCurrentAgentId` + 新規会話開始 (既存 `startNewConversation` 流用)
  - フッターヒント「切替時は新規会話が開始されます」
- 新規 `packages/plugin/src/desktop/components/MemoryToggle.tsx`
  - V1 は **常に disabled** (`enabled=false`, opacity 0.6, title="メモリ機能は V2 で有効化されます")
- 既存 `ChatPanel.tsx` の現状 Header 部分を `<Header />` に置換
- テスト: Header.test.tsx / AgentPicker.test.tsx / ModelBadge.test.tsx
  - admin / 非 admin で GearButton の表示切替
  - Agent 切替で startNewConversation が発火
  - visibility=private は出ない
  - isDefault バッジ表示
- 受け入れ: vitest pass / E2E preview で 380px 幅で文字切れなし

---

### [x] P2.2 — `SettingsView` + `SettingsNav` shell (空 detail)

**Issue**: #40 / **工数**: M / **依存**: P1.1 / P1.5

- 新規 `packages/plugin/src/desktop/settings/SettingsView.tsx` ([design.md §4.3](./design.md#43-settingsview-コンポーネント階層))
  - 2-pane: 左 192px nav + 右 detail (Artifact ペインを置き換える)
  - Header: ⚙ + "設定" + "管理者専用 · 変更は新規セッションから反映" + ×
  - 内部 state: `section: 'agents' | 'skills' | 'mcp'`, `detail: string | null`
- 新規 `packages/plugin/src/desktop/settings/SettingsNav.tsx`
  - 3 項目: 🤖 エージェント / 🧠 スキル / 🔌 MCP サーバー (V1 は MCP disabled)
  - 各 NavItem に件数バッジ
  - 下部に divider + 「Plugin Config →」リンク (`window.open(adminUrl)`)
- 既存 `ChatPanel.tsx` に `view === 'settings'` 分岐追加
  - admin チェック (`useIsAdmin`) で false なら view='chat' にリダイレクト
- テスト: SettingsView.test.tsx
  - 非 admin が view='settings' に到達したら chat に redirect
  - section 切替で detail がリセット
- 受け入れ: vitest pass / E2E preview で 2-pane レイアウト確認

---

### [x] P2.3 — `AgentsListPane` (V1 機能: 公開トグル + AgentIcon)

**Issue**: #39 / **工数**: M / **依存**: P1.4 / P1.6 / P2.2

- 新規 `packages/plugin/src/desktop/settings/AgentsListPane.tsx`
  - Built-in 3 variant を縦並び (`AgentIcon` で表示)
  - 各 Agent 行に **公開トグル** (`visibility: public ↔ private`)
  - トグル変更時:
    1. `POST /v1/agents/{id}` で `metadata.visibility` を update (Agent ID 安定化、[design.md §11 R1](./design.md#11-リスク--未確定事項))
    2. chatStore の `builtInAgents` を refresh
- 「組織のデフォルト」セクションは **作らない** (requirements.md 15.4)
- (V2 stub) 各 Agent クリックで `setDetail('edit')` だが V1 では実際の編集画面は出さない (toast「V2 で対応予定」)
- テスト: AgentsListPane.test.tsx
  - 公開トグル切替で Anthropic API update が呼ばれる
  - V1 で詳細編集が disabled
- 受け入れ: vitest pass / E2E で公開トグル動作確認

---

## Phase 3 — Skills 移管 + Plugin Config 縮小

### [x] P3.1 — `SkillsPane` (一覧 + 同期ボタン)

**Issue**: #40 / **工数**: M / **依存**: P2.2

- 新規 `packages/plugin/src/desktop/settings/SkillsPane.tsx` (requirements.md 6.6)
  - 同梱 skill 一覧 (Plugin 同梱 = kintone-customize-js / kintone-plugin-development) + 同期状態 + バージョン
  - 「Plugin 同梱 skill を Anthropic に同期」ボタン → 既存 `skillsSyncClient.syncSkills()` 流用
  - カスタム skill 一覧 + 「+ Custom skill を追加」ボタン
  - Workspace 全 skill 一覧 (Anthropic から `GET /v1/skills` で取得)
- 既存 `skillsSyncClient.ts` は **変更しない** (Chat Panel から呼ばれる構造は既に対応済)
- テスト: SkillsPane.test.tsx
  - 同期ボタン押下で syncSkills が呼ばれる
  - 既存 skill 一覧表示
- 受け入れ: vitest pass

---

### [x] P3.2 — `SkillAddModal` (ファイル / 直接入力タブ)

**Issue**: #40 / **工数**: L / **依存**: P3.1

- 新規 `packages/plugin/src/desktop/settings/SkillAddModal.tsx` (requirements.md 15.4 / chat6.md 確定)
  - 2 タブ: `📤 ファイル` / `📝 直接入力`
  - **ファイル モード**:
    - ドロップゾーン (受付: `SKILL.md` / `.md` / `.zip`、max 8 MB)
    - 選択後カード: md ロゴ + 名前 + サイズ + frontmatter 自動抽出 (`js-yaml` 新規依存) + 差替/削除
    - 内容プレビュー (textarea readonly)
  - **直接入力 モード**: name / description / SKILL.md textarea
  - フッターのバリデーション + アップロードボタン (mode 依存で disable)
- 新規依存: `js-yaml` (frontmatter パース用、bundler サイズ影響を測定)
- ファイル → Anthropic 送信は `POST /v1/skills` (multipart) を Chat Panel から `kintone.proxy()` 経由で叩く
- テスト: SkillAddModal.test.tsx
  - タブ切替で UI が変わる
  - frontmatter パースで name / description 自動抽出
  - reading 中 (file 解析中) はアップロードボタン disabled
- 受け入れ: vitest pass / .zip は V2 以降に延期 (明示)

---

### [x] P3.3 — `ConfigScreen.tsx` から Skills セクションを剥がす (#41)

**Issue**: #41 / **工数**: M / **依存**: P3.1 (Chat Panel 側で同期できることを確認後)

- 既存 `packages/plugin/src/config/ConfigScreen.tsx` 編集
  - Skills 同期 UI ブロックを削除
  - skill bundle 取得 / 同期ボタンハンドラ削除
  - `skillsSyncClient` の import 削除 (Chat Panel 側で使う)
- 既存 `ConfigScreen.test.tsx` から Skills 関連テストを削除
- `manifest.json` の `setProxyConfig` 関連変更があるか確認 (skillsSync 用 proxy エントリは元々 Worker URL 共通ヘッダーなので変更不要のはず)
- 受け入れ: vitest pass / E2E `config.spec.ts` から Skills 部分を削除し pass

---

## Phase 4 — Customizer Wedge ループ (#20)

### [x] P4.1 — `useApplyWorkflow` state machine

**Issue**: #20 / **工数**: M / **依存**: P1.5

- 新規 `packages/plugin/src/chat/workflow/useApplyWorkflow.ts` ([design.md §6.2](./design.md#62-状態機械))
  - 5 状態: `ready` / `previewed` / `applying` / `applied` / `rolled-back`
  - API: `preview()` / `apply()` / `rollback()` を返す
  - 状態は `chatStore.workflowState[artifactId]` に保存
  - rollback 用に apply 直前の旧 customize.js を `chatStore.workflowHistory[artifactId]` に保存
- 新規 `useApplyWorkflow.test.ts`
  - 5 状態遷移の網羅
  - エラーパス (preview/apply 失敗時の状態保持)
- 受け入れ: vitest pass

---

### [x] P4.2 — `WorkflowFooter` UI

**Issue**: #20 / **工数**: L / **依存**: P4.1

- 新規 `packages/plugin/src/chat/workflow/WorkflowFooter.tsx` (requirements.md 15.5)
  - 5 状態 × step.preview / step.apply / step.rollback の表示パターン (locked / current / inprogress / done)
  - status line (各状態のメッセージ + tone)
  - primary action ボタン (state ごとに切替)
  - ヒント行「変更したい場合はチャットに新しい指示を入力してください」+ GitHub にコミット (V2 stub)
- 既存 Artifact pane の Footer を Customizer Agent 時のみ `WorkflowFooter` に差し替え
  - 判定: `artifact.kind === 'code' && artifact.language === 'javascript' && currentAgent.purpose.startsWith('customizer')`
- テスト: WorkflowFooter.test.tsx
  - 各 state で UI が design 仕様通り
  - 非 Customizer Agent では出ない
- 受け入れ: vitest pass / E2E preview で 5 状態のスクショ確認

---

### [x] P4.3 — `FileTree` (V1: hardcoded)

**Issue**: #20 / **工数**: S / **並列**: ✅ 即着手可

- 新規 `packages/plugin/src/chat/workflow/FileTree.tsx` (requirements.md 15.5)
  - 左 200px サイドバー
  - V1 は **hardcoded ファイル一覧** (customize/desktop.js / mobile.js / desktop.css / libs/ / manifest.json / README.md)
  - kind バッジ (JS/CSS/JSON/MD) + 変更ステータス (M / +)
  - 現在編集中ファイルは accent border-left
  - フッター「● プレビュー環境と同期」
- テスト: FileTree.test.tsx
  - kind バッジ色 / 変更ステータス表示
- 受け入れ: vitest pass

---

### [x] P4.4 — preview / apply / rollback の kintone API 連携

**Issue**: #20 / **工数**: L / **依存**: P4.1

- 新規 `packages/plugin/src/chat/workflow/kintoneCustomizeApi.ts`
  - `previewCustomize(appId, jsContent)` — iframe sandbox で artifact.content を実行 (host には触れない)
  - `applyCustomize(appId, jsContent)` — `GET /k/v1/preview/app/customize.json` で旧 JS 取得 → snapshot 保存 → `PUT /k/v1/preview/app/customize.json` で新 JS 設定 → `POST /k/v1/preview/app/deploy.json`
  - `rollbackCustomize(appId)` — `chatStore.workflowHistory[artifactId]` のスナップショットを `PUT` で書き戻し → deploy
- 既存 kintone API 呼出は `kintone.api()` を使う (現状の chat 内 kintone 呼出と同じ)
- エラーハンドリング: 403 (権限不足) → WorkflowFooter の status line で「アプリ管理権限が必要です」表示
- テスト: kintoneCustomizeApi.test.ts
  - mocked kintone.api で各エンドポイント呼出を検証
  - 403 で適切なエラー
- 受け入れ: vitest pass / kintone テスト環境で実機検証

---

## Phase 4.5 — V1 wire-up 仕上げ (実 API 連携 / Artifact 統合 / テスト書き直し)

> **背景**: Phase 1〜4 完了時点で V1 の主要コンポーネントは揃ったが、Anthropic API
> の実呼出しや既存テストの新 Header 対応など、リリース前に必須の仕上げ wire-up が残る。
> 統合作業の P-Wire1 (`7e37e15`) / P-Wire2 (`20da4cf`) で TODO を含む暫定実装を入れた
> 箇所を本 Phase で完成させる。

### [x] P4.5.1 — AgentsListPane の公開トグルを Anthropic API で永続化

**Issue**: #39 / **工数**: M / **依存**: 統合作業 P-Wire2

現状: ChatPanel.tsx の `SettingsViewBound.handleToggleVisibility` は chatStore の
ローカル state を更新するだけで、Plugin リロードで visibility 状態が消える。

対応:
- 新規 `packages/plugin/src/core/managed-agents/agents.ts` (またはそれに準ずる場所) に
  `updateAgentMetadata(agentId, metadata)` ラッパーを追加
- `POST /v1/agents/{id}` で `metadata.visibility` を更新 (Agent ID 安定化 = 新規作成しない)
- 既存 metadata (purpose / promptVersion / kintoneDomain 等) は維持 (filter から外れないように)
- ChatPanel.tsx の `handleToggleVisibility` で呼出 → 成功時のみ chatStore を更新、失敗時はエラー伝播
- 新規 `agents.test.ts` で metadata merge + Agent ID 不変を検証
- 既存 `AgentsListPane.test.tsx` の `onToggleVisibility が reject すると row 内に error が表示される`
  シナリオが本物の API パスで動くことを確認

受け入れ:
- vitest pass
- 実機 (kintone tenant) で 業務エージェント の公開トグルを OFF → リロード → OFF 維持を確認
- リロード後 end user の Header プルダウンから「業務エージェント」が消えていることを確認

---

### [x] P4.5.2 — Custom skill 追加 wire-up (Worker /skills/sync 拡張 + SkillAddModal 連携)

**Issue**: #40 / **工数**: L / **依存**: P4.5.1 と並走可

現状: ChatPanel.tsx の `SettingsViewBound.handleAddCustomSkill` は throw のまま (V1
配線中)。Worker `/skills/sync` は **同梱 skill bundle の name で識別** する設計のため、
admin がカスタム skill を追加する場合 name 衝突しないかをサーバ側でチェックする必要がある。

対応:
- Worker (`packages/kintone-mcp/src/skills-sync.ts`):
  - リクエスト body の `skills[].source = 'custom'` フィールドを追加 (同梱 / カスタム区別)
  - カスタム skill name が同梱 skill と衝突する場合は明示エラー (409)
  - 同名カスタム skill の上書き (= 既存 skill の update) は許可
- Plugin (`packages/plugin/src/core/skills/skillsSyncClient.ts`):
  - `syncSingleCustomSkill(input: CustomSkillInput)` 関数を追加 (`source='custom'` を送る)
  - kintone.plugin.app.proxy 経由で呼ぶ variant (ChatPanel から API Key 引数不要)
- ChatPanel.tsx `handleAddCustomSkill`:
  - `syncSingleCustomSkill` を呼んで成功時に Plugin Config の skillsMapping を更新
  - 失敗時はエラーメッセージを SkillAddModal の `submitError` に伝播
- Worker / Plugin 両側にテスト追加 (name 衝突 / 上書き)

受け入れ:
- vitest pass (Plugin + Worker 両方)
- 実機で SkillAddModal から `.md` ファイル投入 → Anthropic Workspace に登録される
- 同名カスタム skill 投入で「上書き OK」の挙動を確認

---

### [x] P4.5.3 — Customizer Artifact 表示時に WorkflowFooter + FileTree を統合

**Issue**: #20 / **工数**: M / **依存**: P4.2 / P4.3 / P4.4 / 統合作業

現状: WorkflowFooter / FileTree / kintoneCustomizeApi は単体で動くが、ArtifactPane
からは参照されていない (Customizer Agent が生成した JS artifact でも通常の footer が
表示される)。

対応:
- 新規 `packages/plugin/src/desktop/components/CustomizerArtifactCard.tsx` (または
  ArtifactPane 内に分岐ロジック):
  - artifact.kind === 'code' && language === 'javascript' && **currentAgent.purpose.startsWith('customizer')**
    の時のみ「Customizer モード」で表示
  - 左 200px に `<FileTree />`、メインに code viewer (既存)、フッターに `<WorkflowFooter />`
  - kintoneCustomizeApi.makeKintoneCustomizeWorkflow で callbacks 生成
- 現在のアプリ ID 取得: `kintone.app.getId()` で host kintone から
- chatStore.currentAgentId と builtInAgents から purpose を resolve するヘルパー (例:
  `useCurrentAgentPurpose()`)
- 既存 ArtifactPane (CodeArtifact 系) のレイアウトを壊さないように差し込む (条件分岐)

テスト:
- CustomizerArtifactCard.test.tsx: business agent の artifact では WorkflowFooter が出ない /
  Customizer agent では出る / FileTree が左に表示される
- useCurrentAgentPurpose.test.ts: purpose 解決ロジック

受け入れ:
- vitest pass
- 実機で「完了行を緑に」生成 → Artifact pane に FileTree + step bar 表示
- preview → applied → rollback の wedge ループが UI 上で完結 (実 deploy は P4.5.3 では no-op)

---

### [x] P4.5.4 — Conversation View 内に履歴 / 新規会話 / 再連携の代替動線

**Issue**: #39 / **工数**: M / **依存**: 統合作業 P-Wire2

現状: 新 Header (案 C 2 段) には History / 新規会話 / 再連携ボタンが無い。Banner で
一部 (新規会話 / 再連携) は出るが、明示的な「履歴を開く」ボタンが MessageList の
近くに無いと UX が落ちる。

対応:
- MessageList 上部 or Composer 隣に **二次行 utility** を配置:
  - 履歴アイコン (旧 HistoryIcon を流用) → setView('history')
  - 新規会話アイコン → handleNewConversationClick
  - 再連携アイコン (bindingStatus === 'bound' | 'binding' | 'error' で表示)
- もしくは Composer の右側に collapsible utility menu (3 dots) として実装

design 案は本タスク内で軽く詰める (chat6.md の Conversation View 構成と整合させる)。

受け入れ:
- vitest pass
- 実機で履歴ボタンクリック → HistoryView 表示 → セッション復帰
- 新規会話で messages クリア
- OAuth 失効時に再連携ボタンが出て connect() が走る

---

### [x] P4.5.5 — ChatPanel.test.tsx の 6 skip ケースを新 Header で書き直し

**Issue**: #40 / **工数**: M / **依存**: P4.5.4 (履歴 / 新規会話 / 再連携ボタンの新配置確定後)

現状: 統合作業 P-Wire2 で旧 Header 依存の 6 ケースを `it.skip` 化 (TODO 付き)。

対応 (test 名 / 場所):
- `[V1 で書き直し] Header / MessageList / Composer を描画する` →
  新 Header の testId (wedge-header) で基本描画を assert
- `[V1 で書き直し / 履歴 UI は別所] Header の履歴ボタンで view が chat ⇄ history に切替わる` →
  P4.5.4 で配置した履歴ボタンを対象に書き直し
- `[V1 で書き直し / 再連携 UI は別所] Header の再連携ボタン...` (2 ケース) →
  P4.5.4 の再連携ボタンを対象に書き直し
- `[V1 動作変更 / Gear は view=settings を開く] Header の設定アイコンクリック...` →
  admin: Gear クリックで view='settings' / 非 admin: Gear 非表示 + onSettingsClick (Plugin Config)
  は Banner の "プラグイン設定を開く" CTA で発火する流れに書き直し
- `[V1 で書き直し / 新規会話 UI は別所] Header の新規会話ボタン...` →
  P4.5.4 の新規会話ボタンを対象に書き直し

追加:
- Header 案 C 固有のテスト追加 (admin 切替時の Gear visibility / Memory トグル disabled /
  Agent プルダウン切替で selectAgent が呼ばれて新規会話が始まる)

受け入れ:
- ChatPanel.test.tsx の skip が 0 件
- 全テスト pass
- カバレッジ低下なし

---

### [ ] P5.1 — E2E: `customizer-wedge.spec.ts`

**Issue**: 全 V1 / **工数**: L / **依存**: Phase 1〜4 完了

- 新規 `packages/plugin/e2e/customizer-wedge.spec.ts`
- シナリオ:
  1. admin がログイン
  2. Plugin Config で Bootstrap (4項目)
  3. Chat Panel を開く → ⚙ から Settings → Skills 同期
  4. Header で Customizer (Opus) 選択
  5. 「完了行を緑に」生成
  6. preview → applied → rollback の wedge ループ
- 受け入れ: Playwright pass

---

### [ ] P5.2 — E2E: `agent-switch.spec.ts`

**Issue**: #39 / **工数**: M / **依存**: Phase 2 完了

- 新規 `packages/plugin/e2e/agent-switch.spec.ts`
- シナリオ:
  - end user (非 admin) ログイン → Gear 非表示確認
  - Agent プルダウンで業務 ↔ Customizer 切替
  - 切替で会話履歴がクリアされる
- 受け入れ: Playwright pass

---

### [ ] P5.3 — E2E: `admin-only-settings.spec.ts`

**Issue**: #40 / **工数**: S / **依存**: Phase 2 完了

- 新規 `packages/plugin/e2e/admin-only-settings.spec.ts`
- シナリオ:
  - 非 admin が Settings View に到達できないことを確認
  - ⚙ ボタンが DOM に存在しない
- 受け入れ: Playwright pass

---

### [ ] P5.4 — リリース準備 (CHANGELOG / Plugin Config E2E 更新 / プラグインビルド)

**工数**: M / **依存**: Phase 1〜4 + P5.1〜3 完了

- 既存 `packages/plugin/e2e/config.spec.ts` を Bootstrap 4 項目のみに整理
- `packages/plugin/plugin/manifest.json` の version bump
- `cli-kintone plugin pack` で `dist/plugin.zip` 生成 (auto-deploy で動作確認)
- `CHANGELOG.md` 更新 (もし存在すれば)
- 受け入れ: 全テスト pass / 実 kintone tenant で動作確認

---

## 完了基準 (V1 受け入れ)

requirements.md Section 10 の受け入れ条件と整合:

- [ ] 機能面 — Agent (Section 10.1): 3 variant ensure / Header プルダウン / 切替で新規会話 / Customizer に customize-js / Default に xlsx 系のみ / Customizer に preview/apply/rollback 呼出可能
- [ ] 機能面 — Settings View (Section 10.2): ⚙ admin only / 2-pane / 🤖 / 🧠 / Plugin Config 縮小完了
- [ ] 権限面 (Section 10.3): admin only / 非 admin 不可 / 二重防御
- [ ] 非機能面 (Section 10.4): 全テスト pass / system prompt トークン 10% 削減 (variant 分離効果)

---

## 後続作業 (V2 以降、本リスト範囲外)

V2:
- #40 Agent 詳細編集 UI (skill/tool ON-OFF + System Prompt 編集)
- V2-新規 (Custom Skill 編集 / 削除) Chat Panel Settings → Skills でカスタム skill の本文 (SKILL.md) 編集 + 削除。Anthropic API: `POST /v1/skills/{id}/versions` (新 version) と `DELETE /v1/skills/{id}`
- V2-新規 (MCP 登録) 追加 MCP Server 登録 (Plugin Config Step 4 + Chat Panel 接続 + Vault Credential)
- #15 (縮小) Conversation View に Memory ON/OFF トグル + (user × agent) auto-ensure
- #17 GitHub MCP

V3:
- #41 Custom Agent 新規作成 UI + IconPicker (8 glyph × 8 color)
- #24 / #22 / #25 / #30 Phase3+
