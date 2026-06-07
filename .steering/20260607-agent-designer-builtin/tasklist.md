# tasklist.md — エージェントデザイナー (Issue #48)

> requirements.md / design.md に基づく実装タスク。チェックボックスは進捗管理用。
>
> **Phase 順序**:
> P1 = 基盤 (ArtifactKind / chatStore) /
> P2 = customizer-opus → designer の repurpose (spec のみ) /
> P3 = propose_agent custom tool 追加 + system prompt /
> P4 = eventInterpreter + useEventPoller 拡張 /
> P5 = AgentDetailModal `create-from-proposal` mode /
> P6 = AgentDraftArtifact renderer /
> P7 = ChatPanel watcher + AgentDetailModalBound 配線 /
> P8 = テスト / P9 = 動作確認 + manifest bump

---

## P1. 基盤 — ArtifactKind + chatStore

- [ ] **P1.1** `core/artifacts/types.ts`: `ArtifactKind` に `'agent-draft'` を追加
- [ ] **P1.2** `RENDERABLE_ARTIFACT_KINDS` に `'agent-draft'` を追加
- [ ] **P1.3** `AGENT_CREATABLE_ARTIFACT_KINDS` には **含めない** (LLM が直接 create_artifact で生成するのを禁止)
- [ ] **P1.4** `chatStore.ts`: `pendingAgentProposal: { draft: AgentEditDraft, rationale: string } | null` フィールドを top-level に追加
- [ ] **P1.5** `setPendingAgentProposal(next)` を action として export
- [ ] **P1.6** `reset()` で `pendingAgentProposal: null` も初期化
- [ ] **P1.7** chatStore.test.ts に setter / reset テスト追加

## P2. BUILTIN_AGENT_SPECS の repurpose (spec 中身差替のみ、tool attach は P3)

- [ ] **P2.1** `READONLY_KINTONE_TOOL_NAMES` を `builtInAgents.ts` に export 追加
- [ ] **P2.2** `AGENT_DESIGNER_QUICK_ACTIONS` 定数 (5 件) を `builtInAgents.ts` に追加
- [ ] **P2.3** `AGENT_DESIGNER_SYSTEM_PROMPT` 定数を `builtInAgents.ts` に追加 (design.md §8 の骨格を清書)
- [ ] **P2.4** `BUILTIN_AGENT_SPECS['customizer-opus']` の中身を以下に差替:
  - name → 'エージェントデザイナー'
  - description → 'kintone アプリを起点にエージェントを設計'
  - promptVersion → 'v23-agent-designer'
  - systemPrompt → `AGENT_DESIGNER_SYSTEM_PROMPT`
  - anthropicSkillIds → `[]`
  - customSkillFilter → `() => false`
  - mcpToolFilter → `(name) => READONLY_KINTONE_TOOL_NAMES.has(name)`
  - iconKind → 'ai'
  - iconColor → 'accent' (維持)
  - variantGroup → 削除
  - isDefault → true (維持)
  - quickActions → `AGENT_DESIGNER_QUICK_ACTIONS`
- [ ] **P2.5** `builtInAgents.test.ts`:
  - customizer-opus の name が 'エージェントデザイナー' であることを assertion
  - customizer-sonnet と variantGroup pair が解消されていることを assertion
  - mcpToolFilter が書込系を弾くこと
  - quickActions が 5 件含むこと
- [ ] **P2.6** `useCurrentAgentPurpose.test.ts` 等の既存テストで customizer-opus を「カスタマイザーエージェント」前提にしているものを更新

## P3. propose_agent custom tool 追加 + tool attach

- [ ] **P3.1** `resolveAgent.ts`: `PROPOSE_AGENT_TOOL_NAME = 'propose_agent'` 定数追加
- [ ] **P3.2** `buildProposeAgentToolSpec()` ヘルパー追加 — design.md §3.1 の input_schema を返す
- [ ] **P3.3** built-in agent 構築時、`purpose === 'customizer-opus'` のときだけ tools 配列に propose_agent spec を push
- [ ] **P3.4** `resolveAgent.test.ts`: customizer-opus にだけ propose_agent が attach され、business / customizer-sonnet には attach されないことを assertion

## P4. eventInterpreter + useEventPoller 拡張

- [ ] **P4.1** `eventInterpreter.ts`: `InterpretedAction` 型に `{ kind: 'propose-agent', toolUseId, draft, rationale }` を追加
- [ ] **P4.2** `parseProposeAgentInput(raw: unknown)` ヘルパーを `eventInterpreter.ts` 内に追加:
  - 型 guard で必須フィールド存在チェック
  - iconKind/iconColor/model の enum バリデーション (NG なら fallback: 'ai'/'teal'/'sonnet')
  - quickActions の slice(0, 5) + 空文字フィルタ
  - enabledTools を KINTONE_TOOL_NAMES に絞る (未知ツール無視)
  - anthropicSkillIds を ['xlsx','docx','pdf','pptx'] に絞る
  - AgentEditDraft 形式に組み立て (visibility='public', isDefault=false 固定)
  - 失敗時は `{ ok: false, error }` を返す
- [ ] **P4.3** `agent.custom_tool_use` 分岐に `tool_name === 'propose_agent'` ケースを追加
  - parseProposeAgentInput が ok → `propose-agent` action 返却
  - 失敗 → `tool-error` action (既存パターン) 返却
- [ ] **P4.4** `eventInterpreter.test.ts` に propose_agent ケース追加:
  - 正常入力 → propose-agent action
  - iconKind enum 外 → fallback 'ai'
  - quickActions 6 件 → 5 件に切詰め
  - enabledTools に未知名 → 除外
- [ ] **P4.5** `useEventPoller.ts`: action 処理に `case 'propose-agent'` 追加 (design.md §4.2 の処理)
- [ ] **P4.6** `useEventPoller.test.ts` に propose-agent action のテスト:
  - artifact が `kind: 'agent-draft'` で生成される
  - `pendingAgentProposal` がセットされる
  - `pendingCustomToolUseIds` にエントリが追加される
  - `activeArtifact` が新 artifact に切替わる

## P5. AgentDetailModal の create-from-proposal mode

- [ ] **P5.1** `AgentDetailModalProps.mode` 型に `{ kind: 'create-from-proposal', draft: AgentEditDraft, rationale: string }` を追加
- [ ] **P5.2** `AgentDetailModalProps` に `fallbackTemplates?: readonly AgentRecord[]` prop を追加
- [ ] **P5.3** modal 内に local mode state を追加 (`useState<ModalMode>(initialMode)`) — 「雛形から作り直す」遷移用
- [ ] **P5.4** useEffect の初期化分岐に `create-from-proposal` ケースを追加:
  - `setDraft(mode.draft)` で全項目反映
  - fetchAgent 不要、即 loading=false
- [ ] **P5.5** ヘッダーに「エージェントデザイナーによる提案」バッジ表示
- [ ] **P5.6** ヘッダー下に rationale を折りたたみ表示 (`<details>` で「設計理由」を見せる)
- [ ] **P5.7** 雛形プルダウンを `mode.kind === 'create-from-proposal'` のとき非表示
- [ ] **P5.8** フッターに「雛形から作り直す」リンクを追加 (`mode.kind === 'create-from-proposal'` のときのみ)
  - クリックで `setLocalMode({ kind: 'create', templates: fallbackTemplates ?? [] })`
  - draft を templates[0] ベースに再ロード (既存 create 経路)
- [ ] **P5.9** 保存時 `createCustomAgentFrom({ baseAgentId: <Designer の Agent ID>, draft })` を呼ぶ
  - `baseAgentId` は mode 内に持たせるか、別途 chatStore.builtInAgents から Designer の ID を引く
- [ ] **P5.10** `AgentDetailModal.test.tsx`:
  - `create-from-proposal` mode で draft が全項目に反映される
  - 雛形プルダウンが表示されない
  - rationale が表示される
  - 「雛形から作り直す」で create mode に遷移 + draft が破棄される
  - 保存時 createCustomAgentFrom が呼ばれる

## P6. AgentDraftArtifact renderer

- [ ] **P6.1** `packages/plugin/src/desktop/components/ArtifactPane/renderers/AgentDraftArtifact.tsx` 新規作成
- [ ] **P6.2** `parseAgentDraftContent(content: string)` ヘルパー (JSON parse + 型 guard)
- [ ] **P6.3** renderer 中身 (design.md §7.3 準拠):
  - header: AgentIcon + name + ModelBadge
  - description
  - クイックアクション一覧
  - 設計理由 (折りたたみ)
  - システムプロンプト (折りたたみ + monospace)
  - フッター: 「この内容で作成画面を開く」ボタン
- [ ] **P6.4** ボタン押下で `useChatStore.getState().setPendingAgentProposal({ draft, rationale })`
- [ ] **P6.5** `renderers/index.ts` (or 同等の kind→renderer マップ) に `'agent-draft': AgentDraftArtifact` を追加
- [ ] **P6.6** `AgentDraftArtifact.test.tsx`:
  - 正常 content → 全要素 render
  - 不正 JSON → fallback (エラー表示)
  - ボタン押下 → setPendingAgentProposal 呼出

## P7. ChatPanel への組込み

- [ ] **P7.1** ChatPanel に `pendingAgentProposal` の購読を追加
- [ ] **P7.2** ChatPanel 内に `<AgentDetailModalBound>` (新規 or 既存抽出) を pendingAgentProposal != null の時に render
  - mode = `{ kind: 'create-from-proposal', draft, rationale }`
  - fallbackTemplates = `builtInAgents`
  - onClose = `() => setPendingAgentProposal(null)`
  - onSaved = `(newRecord) => { setPendingAgentProposal(null); 追加処理 }`
- [ ] **P7.3** `AgentDetailModalBound` を SettingsViewBound から ChatPanel でも使える形に分離 (= 共通モジュール化 or 直接 ChatPanel から呼べるよう抽出)
- [ ] **P7.4** ChatPanel.test.tsx に統合テスト:
  - pendingAgentProposal セット → modal が表示される
  - 保存 → setPendingAgentProposal(null) + builtInAgents 更新

## P8. テスト網羅 + 残課題確認

- [ ] **P8.1** 上記 P1〜P7 で書いたテストが全部 green
- [ ] **P8.2** 既存テスト (835 件) が全部 green (新規 quickActions: [] 追加が必要なリテラルあれば随時補完)
- [ ] **P8.3** customizer-opus ベースだった既存テスト (`Header.test.tsx` 等の `'カスタマイザーエージェント'` 文字列前提) を新名称に更新

## P9. 動作確認 + auto-deploy

- [ ] **P9.1** `pnpm --filter @cowork-agent/plugin typecheck` で本変更による新規エラー 0 件を確認
- [ ] **P9.2** `pnpm --filter @cowork-agent/plugin test` で全 pass を確認
- [ ] **P9.3** `packages/plugin/plugin/manifest.json` の version を bump
- [ ] **P9.4** auto-deploy hook が走って kintone に反映されることを確認 (任意)

---

## 完了の定義

- requirements.md AC-1〜AC-35 が全て満たされている
- P1〜P9 が全てチェック
- 既存テスト + 新規テストが全部 green
- manifest version bumped → auto-deploy 成功
