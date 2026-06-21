# 設計: アプリ設計・構築支援エージェント (built-in 4th variant) — #117

requirements.md の確定判断に基づく実装設計。**admin ゲートなし / 会話+ツール直実行 / skills で資料読解 / Opus**。

## 全体方針
既存の built-in 3 variant (業務 / エージェントデザイナー / カスタマイザー) に **4 つ目の variant
「アプリデザイナー」** を追加する。新しい仕組みは作らず、既存の variant プラグインに 1 つ足す。
- model: **Opus** (`claude-opus-4-7`、デザイナーと同じ)。
- ツール: **全 kintone ツール** (CRUD + ワークフロー + 管理系)。`mcpToolFilter: () => true`
  (= 管理系を含む唯一の built-in。kintone 権限で非 admin は 403 になるため agent 側 gate は不要)。
- skills: `pdf` / `docx` / `xlsx` (添付資料の読解を委譲)。
- 安全: preview → 会話でレビュー → `deploy-app`。破壊的操作 (deploy / delete-form-fields) は既存の承認カード。
- 提案 UI (`propose_app`) は作らない (会話 + ツール直実行)。

> 名称「アプリデザイナー」は仮 (purpose key は `app-designer`)。表示名は後で調整可。

## 新 variant の spec (`BUILTIN_AGENT_SPECS['app-designer']`)
| 項目 | 値 |
|---|---|
| purpose key | `app-designer` |
| name | アプリデザイナー (仮) |
| model | `claude-opus-4-7` / OPUS |
| promptVersion | `v1-app-designer` |
| systemPrompt | `APP_DESIGNER_SYSTEM_PROMPT` (新規) |
| anthropicSkillIds | `['pdf', 'docx', 'xlsx', 'pptx']` |
| customSkillFilter | `() => false` |
| mcpToolFilter | `() => true` (全ツール) |
| iconKind / iconColor | 例 `doc` / `accent` (調整可) |
| isDefault | false |
| variantGroup | なし |
| quickActions | 「この帳票(PDF)を kintone アプリにして」「既存アプリに項目を追加して」「ワークフロー(申請→承認→完了)を設定して」「アプリの一覧ビューを業務に合わせて作って」 |

### `APP_DESIGNER_SYSTEM_PROMPT` の骨子
- 役割: 業務要件・添付資料から kintone アプリを設計し、preview に構築 → レビュー → deploy まで伴走する admin 向けアシスタント。
- 進め方: ①ヒアリング/資料読解で要件整理 → ②設計案を会話で提示 (フィールド型・レイアウト・ビュー・プロセス・権限) →
  ③合意後に管理系ツールで preview 構築 → ④差分を説明し deploy → ⑤デプロイ状況確認。
- kintone ドメイン知識: フィールド型の選び方、**予約コード回避** (ステータス/作業者/レコード番号 等)、
  選択系の `options` 形 (index は文字列)、**更新系は全体置換** (先に get→マージ)、filterCond の演算子、
  preview→deploy が必須。← #24 のツール説明に書いた内容を prompt 側でも要約。
- 安全則: いきなり deploy しない / 削除は影響を説明して確認 / 既存アプリ改変は現状取得してから。
- 役割境界: レコード操作中心の「業務」、エージェント設計の「デザイナー」、JS/プラグインの「カスタマイザー」とは別。
- 既存 `COMMON_GUARDRAILS` (artifact / バイナリ出力等) は共通で含める。

## 変更ファイル (4th variant の配線)
- `core/bootstrap/agentTypes.ts`: `AgentPurpose` に `'app-designer'` を追加。
- `core/bootstrap/builtInAgents.ts`: `BUILTIN_AGENT_SPECS` に spec 追加 / `BUILTIN_PURPOSES` 配列に追加 /
  `APP_DESIGNER_SYSTEM_PROMPT` と `APP_DESIGNER_QUICK_ACTIONS` を定義。
- `core/bootstrap/resolveBuiltInAgents.ts`: `BuiltInAgentSet` に `appDesigner: Agent` 追加 /
  `Promise.all` に `resolveBuiltInOne('app-designer', options)` 追加 / 戻り値に追加。
  (propose_agent は customizer-opus 限定のまま。app-designer には付けない。)
- `core/bootstrap/initializeSession.ts`: `toAgentRecords` に `agentToRecord(set.appDesigner, 'app-designer')` 追加 /
  ローカル `agentToRecord` の purpose union に追加。
- `core/bootstrap/agentRecord.ts`: `isBuiltInPurpose` が `'app-designer'` を true に / built-in 分岐で spec 補完。
- (型) `BuiltInPurpose` は `Exclude<AgentPurpose,'custom'>` 由来なので自動拡張。各所の
  `'business' | 'customizer-opus' | 'customizer-sonnet'` リテラル union を `'app-designer'` 込みに更新。

## 表示・選択への影響
- Header プルダウン / 一覧に 4 つ目として出る (全ユーザに見える。非 admin は管理操作が kintone で 403)。
- 初期選択 (#108 が未対応なら) `isDefault` 次第。本 variant は `isDefault:false` なので初期選択は変えない。
- variantGroup なし → Opus/Sonnet ペア切替の対象外 (単独)。

## テスト
- `builtInAgents.test`: SPECS に app-designer があり model=opus / mcpToolFilter が管理系を通す (`()=>true`) /
  skills に pdf/xlsx/docx。
- `resolveBuiltInAgents` / `initializeSession`: 4 variant 解決され、records に app-designer が出る
  (既存テストの 3→4 への更新含む)。
- toolsVersion は新 variant 追加なので新規 ensure (既存への影響なし)。

## 受け入れ条件との対応
- AC-1/5 = 4th variant 追加 (agent gate なし・kintone 権限で実効制限)。AC-2 = skills で資料読解。
- AC-3/4/6 = #24 管理系ツール (全公開) + 既存承認カード。AC-7 = system prompt の役割境界。AC-8 = test。

## 非対象
- `propose_app` 等の専用提案 UI。admin 限定の表示制御。#24 ツール自体の追加。
