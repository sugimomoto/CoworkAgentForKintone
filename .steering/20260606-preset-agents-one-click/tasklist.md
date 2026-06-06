# tasklist.md — プリセットエージェント + ワンクリック実行 UX (Issue #45)

> requirements.md / design.md に基づく実装タスク分解。チェックボックスは進捗管理用。
>
> **Phase 順序**:
> P1 = データモデル拡張 / P2 = Composer ref 拡張 / P3 = PresetAgentLanding 実装 /
> P4 = ChatPanel 組込み / P5 = AgentDetailModal クイックアクション編集 /
> P6 = 既存テスト調整 / P7 = 動作確認 + auto-deploy

---

## P1. データモデル拡張 (quickActions)

> ※ ここまでは先行着手済 (req/design 修正に伴い `samplePrompts` → `quickActions` リネーム完了)。

- [x] **P1.1** `AgentRecord` に `quickActions: readonly string[]` を追加 ([agentTypes.ts](../../packages/plugin/src/core/bootstrap/agentTypes.ts))
- [x] **P1.2** `BuiltInAgentSpec` に `quickActions: readonly string[]` を追加 ([builtInAgents.ts](../../packages/plugin/src/core/bootstrap/builtInAgents.ts))
- [x] **P1.3** 3 variant に既定文言を設定 (business / customizer-opus / customizer-sonnet)
- [x] **P1.4** `useSession.ts:agentToRecord` で `spec.quickActions` を AgentRecord に注入
- [x] **P1.5** `agentRecord.ts:agentToRecord` (built-in 分岐) で `spec.quickActions` を注入
- [x] **P1.6** `agentRecord.ts` に `parseQuickActions(raw: string | undefined)` を実装し custom 分岐で metadata から復元
- [x] **P1.7** `builtInAgents.test.ts` に「3 variant 全てに quickActions.length >= 4 がある」assertion を追加
- [x] **P1.8** `agentRecord.test.ts` (なければ新規) に `parseQuickActions` の境界ケーステスト (空 / 不正 JSON / 配列内非文字列 / 空文字列要素フィルタ)

## P2. Composer に focus() を公開

- [x] **P2.1** `Composer.tsx` を `forwardRef<ComposerHandle, ComposerProps>` でラップ
- [x] **P2.2** `ComposerHandle` interface (`{ focus(): void }`) を export
- [x] **P2.3** `useImperativeHandle` で input 要素の focus を expose
- [x] **P2.4** 既存 Composer のテスト/呼出側に影響がないか確認 (props 互換維持)

## P3. PresetAgentLanding コンポーネント実装

- [x] **P3.1** ファイル新規作成 [packages/plugin/src/desktop/components/PresetAgentLanding.tsx](../../packages/plugin/src/desktop/components/PresetAgentLanding.tsx)
- [x] **P3.2** Props 型: `agents / onSelectPrompt / onSelectAgentForFreeInput / searchable?`
- [x] **P3.3** 公開 Agent filter (visibility=public) と初期 openId 決定 (`isDefault` 優先)
- [x] **P3.4** `<Intro>` 見出し ("何をお手伝いしましょうか？")
- [x] **P3.5** `<AccordionRow>` — header (`<AgentIcon>` + name + `<ModelBadge>` + 既定バッジ + chevron) + 開閉ロジック (排他)
- [x] **P3.6** `<PromptButton>` — accent 塗り + `active:scale-[0.99]` + 矢印アイコン
- [x] **P3.7** `<EmptyPromptsCTA>` — 「自由入力で話しかける」ボタン (`onSelectAgentForFreeInput` 呼出)
- [x] **P3.8** `<SearchBox>` — `agents.length > 6` または `searchable` 時に表示、名前 + desc 部分一致
- [x] **P3.9** **特殊ルート**: `publicAgents.length === 1` のとき `<SinglePresetView>` で中央寄せ表示
- [x] **P3.10** マイクロインタラクション — `view-fade-in` クラスをルート要素に付与
- [x] **P3.11** `view-fade-in` keyframe を [global.css](../../packages/plugin/src/styles/global.css) に追加 (`.cw-view-fade` セレクタ)
- [x] **P3.12** スタイル — 既存 Tailwind トークン (`bg-card` / `text-text` / `border-card-border` / `bg-accent` 等) に揃える (ハンドオフの teal-* ハードコード排除)
- [x] **P3.13** アクセシビリティ — `aria-expanded` / `aria-label` / `role="button"`

## P4. ChatPanel への組込み

- [x] **P4.1** `ChatPanel.tsx:369` の空状態分岐を更新
  - builtInAgents.length > 0 → `<PresetAgentLanding ... />`
  - 0 → `<WelcomeMessage />` (フォールバック)
- [x] **P4.2** `handlePresetPromptSelect(agent, prompt)` ハンドラ実装
  - `agent.id !== currentAgentId` なら `selectAgent(agent.id, ctx)`
  - `handleSubmit(prompt)` を呼ぶ
- [x] **P4.3** `handlePresetAgentForFreeInput(agent)` ハンドラ実装
  - `agent.id !== currentAgentId` なら `selectAgent(agent.id, ctx)`
  - `composerRef.current?.focus()`
- [x] **P4.4** `composerRef = useRef<ComposerHandle>(null)` を追加し `<Composer ref={composerRef} ... />` に渡す
- [x] **P4.5** OAuth 未連携時の優先表示 (`showConnectButton`) は手を入れない (現状維持)

## P5. AgentDetailModal にクイックアクション編集 UI

- [x] **P5.1** `AgentEditDraft` に `quickActions: string[]` を追加
- [x] **P5.2** `recordToDraft` / `specToDraft` で初期値を埋める
- [x] **P5.3** ローカル state `quickActionsText: string` を modal 内に追加 (textarea 用)
- [x] **P5.4** 新セクション「クイックアクション (0〜5 個)」を既存セクション群の下に配置
- [x] **P5.5** バリデーション
  - 行数 > 5 → エラー文言 + 保存 disable
  - 1 行 > 200 文字 → エラー文言 + 保存 disable
  - 全体 JSON.stringify > 1024 byte → エラー文言
- [x] **P5.6** 保存パス (`agentDetailApi.ts:updateAgent` 系) で metadata に反映
  - 空配列なら metadata key 自体を削除
  - そうでなければ `metadata.quickActions = JSON.stringify(arr)`
- [x] **P5.7** UI 文言の調整 (placeholder / helper text / エラー文言)

## P6. 既存テストの quickActions 補完

`AgentRecord` リテラルを構築している 7 ファイルに `quickActions: []` を追加 (ヘルパー化されているところはヘルパーのデフォルトを変更)。

- [x] **P6.1** `packages/plugin/src/store/chatStore.test.ts`
- [x] **P6.2** `packages/plugin/src/desktop/Header.test.tsx`
- [x] **P6.3** `packages/plugin/src/desktop/hooks/useCurrentAgentPurpose.test.ts`
- [x] **P6.4** `packages/plugin/src/desktop/settings/SettingsViewBound.test.tsx`
- [x] **P6.5** `packages/plugin/src/desktop/settings/AgentsListPane.test.tsx`
- [x] **P6.6** `packages/plugin/src/desktop/settings/AgentDetailModal.test.tsx` (+ クイックアクション編集 UI の新規テスト追加)
- [x] **P6.7** `packages/plugin/src/core/skills/resolveBundledSkillIds.test.ts` (誤検出かどうか確認)

## P7. PresetAgentLanding / ChatPanel の新規テスト

### 7.1 `PresetAgentLanding.test.tsx` (新規)

- [x] **P7.1.1 (T1)** 3 エージェントが渡され、isDefault のものが初期展開される
- [x] **P7.1.2 (T2)** 別の行ヘッダーをクリック → 排他開閉
- [x] **P7.1.3 (T3)** プロンプトボタン押下で `onSelectPrompt(agent, prompt)` が 1 回呼ばれる
- [x] **P7.1.4 (T4)** プロンプト 0 個の行を展開 → EmptyPromptsCTA
- [x] **P7.1.5 (T5)** CTA 押下で `onSelectAgentForFreeInput(agent)` が呼ばれる
- [x] **P7.1.6 (T6)** エージェント 1 個のみ → SinglePresetView レイアウト
- [x] **P7.1.7 (T7)** エージェント 7 個 → 検索ボックス自動表示
- [x] **P7.1.8 (T8)** 検索入力で filter が効く
- [x] **P7.1.9 (T9)** visibility=private は一覧に出ない
- [x] **P7.1.10 (T10)** `aria-expanded` の遷移

### 7.2 `ChatPanel.test.tsx` (既存に追記)

- [x] **P7.2.1 (I1)** builtInAgents が空 → WelcomeMessage (フォールバック)
- [x] **P7.2.2 (I2)** builtInAgents 3 件、messages 空、sessionId null → PresetAgentLanding
- [x] **P7.2.3 (I3)** プロンプト押下 → selectAgent (異なる場合) + handleSubmit 呼出
- [x] **P7.2.4 (I4)** 同じエージェントなら selectAgent 呼ばない
- [x] **P7.2.5 (I5)** 押下後 messages 追加 + PresetAgentLanding が消える
- [x] **P7.2.6 (I6)** OAuth 未連携時は ConnectKintoneButton 優先 / PresetAgentLanding は出ない
- [x] **P7.2.7 (I7)** CTA で Composer フォーカス (jsdom)

## P8. 動作確認 + auto-deploy

- [x] **P8.1** `pnpm --filter @cowork/plugin typecheck` が pass する
- [x] **P8.2** `pnpm --filter @cowork/plugin test` が pass する
- [x] **P8.3** `pnpm --filter @cowork/plugin lint` が pass する
- [x] **P8.4** auto-deploy hook によるパッケージング + kintone アップロードを確認 (Stop フックが走る前提)
- [x] **P8.5** manifest version を bump
- [ ] **P8.6** (任意) `Verify` skill を使って kintone 上での実機確認

---

## 完了の定義

- requirements.md AC-1〜AC-32 がすべて満たされている
- 上記 P1〜P8 が全てチェック
- 既存テストが全部 green
- 新規テストが全部 green
- manifest が bump され auto-deploy が成功している
