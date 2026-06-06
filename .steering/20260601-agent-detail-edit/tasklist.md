# #40 Agent 詳細編集 UI — Tasklist

要求定義: [requirements.md](./requirements.md) / 設計: [design.md](./design.md)

## タスク一覧

| ID | 内容 | サイズ | 前提 | 状態 |
|----|------|--------|------|------|
| T1 | `resources.archiveAgent(id)` を追加 | XS | — | ✅ |
| T2 | `buildAgentTools(enabledTools)` ヘルパー新設 + テスト | S | T1 | ✅ |
| T3 | `agentDetailApi.ts` 実装 (applyAgentEdit / createCustomAgentFrom / archiveAgent ラッパ) + テスト | M | T1, T2 | ✅ |
| T4 | `agentRecord.ts` (Agent → AgentRecord 変換) 切り出し | S | — | ✅ |
| T5 | `chatStore.upsertAgent` / `removeAgent` 追加 | XS | — | ✅ |
| T6 | `AgentDetailModal.tsx` + テスト (UI / form 状態) | L | T2-T5 | ✅ |
| T7 | `AgentsListPane.tsx` 改修 (編集ボタン enable, 追加ボタン enable, Custom Agent セクション動的化) | M | T6 | ✅ |
| T8 | `SettingsViewBound.tsx` wiring (onEditAgent / onCreateAgent / onDeleteAgent ハンドラ + reload) | M | T6, T7 | ✅ |
| T9 | `SettingsView.tsx` props 追加 | XS | T8 | ✅ |
| T10 | 「初期値に戻す」を built-in spec から再構築する関数 + Modal 統合 | S | T6 | ✅ |
| T11 | テスト追加 (SettingsViewBound 拡張、フル shipping check) | M | T7-T10 | ✅ |
| T12 | リリース確認 (vitest 全 pass、tsc、Plugin auto-deploy) | S | T1-T11 | ✅ |

## タスク詳細

### T1: `archiveAgent` を resources.ts に追加

- `packages/plugin/src/core/managed-agents/resources.ts` に追加
- 既存の `archiveVaultCredential` 参照、POST 系の generic を流用
- 署名: `export async function archiveAgent(agentId: string): Promise<void>`
- 呼出: `await post(/v1/agents/${id}/archive, undefined)` (body 不要)
- 完了基準: 既存 resources.test.ts 風 mock テスト追加 (POST URL 検証)

### T2: `buildAgentTools` ヘルパー

- `packages/plugin/src/core/managed-agents/buildAgentTools.ts` 新規
- 引数: `enabledTools: readonly KintoneToolName[]`
- 返り値: `Array<Record<string, unknown>>` (Anthropic API の tools[] 形式)
- 既存 `resolveAgent.ts:552` `buildBuiltInAgentTools` の構造をそのまま組み立てる
  - `agent_toolset_20260401` (always_allow)
  - `CREATE_ARTIFACT_TOOL`
  - `mcp_toolset` kintone_mcp_server with configs[] (enabled per draft)
- destructive tool (`DESTRUCTIVE_TOOL_NAMES`) は `always_ask`
- テスト: 全件 ON / 部分 OFF / destructive policy / configs[] 順序

### T3: `agentDetailApi.ts`

- `packages/plugin/src/core/managed-agents/agentDetailApi.ts` 新規
- 公開関数 3 種:
  ```ts
  export interface AgentEditDraft {
    name: string;
    description: string;
    iconKind: AgentGlyph;
    iconColor: AgentColor;
    visibility: 'public' | 'private';
    isDefault: boolean;
    systemPrompt: string;
    anthropicSkillIds: readonly string[];
    customSkillIds: readonly string[];
    enabledTools: readonly KintoneToolName[];
  }

  // 既存 Agent を編集 (system / tools / skills / metadata 等を replace)
  export async function applyAgentEdit(agentId: string, draft: AgentEditDraft): Promise<Agent>;

  // 雛形 Agent を base に新規 Custom Agent を作成
  export async function createCustomAgentFrom(args: {
    baseAgentId: string;
    draft: AgentEditDraft;
  }): Promise<Agent>;

  // Custom Agent をアーカイブ (built-in は呼ばない、UI 側でガード)
  export async function archiveAgentById(agentId: string): Promise<void>;
  ```
- 内部実装:
  - applyAgentEdit: `retrieveAgent` で既存取得 → metadata merge → `updateAgent(id, { name, description, system, tools: buildAgentTools(), skills: buildAgentSkills(), metadata })`
  - createCustomAgentFrom: base の model / workerUrl / kintoneDomain / mcp_servers を維持して `createAgent({...})`
- skills の API パラメータ送信: `skills` フィールドは createAgent 側で受け付ける (CreateAgentParams に追加が必要なら拡張)
- テスト: apiRequest mock で URL / method / body を検証

### T4: `agentRecord.ts`

- Anthropic Agent → AgentRecord 変換ロジックを resolveAgent.ts から切り出し
- 既存 resolveAgent.ts の該当箇所を探して関数化 (重複コード除去)
- `packages/plugin/src/core/bootstrap/agentRecord.ts` 新規
- export: `agentToRecord(agent: Agent): AgentRecord`
- resolveAgent.ts はこれを import に置換

### T5: chatStore upsert/remove

- `packages/plugin/src/store/chatStore.ts` に追加:
  ```ts
  upsertAgent: (record: AgentRecord) => void;
  removeAgent: (agentId: string) => void;
  ```
- 実装: builtInAgents 配列を find-or-append / filter
- テスト: chatStore のユニットテスト (既存ファイル) に追加

### T6: AgentDetailModal

- `packages/plugin/src/desktop/settings/AgentDetailModal.tsx` 新規 + テスト
- Props:
  ```ts
  interface AgentDetailModalProps {
    mode: { kind: 'edit'; agent: AgentRecord } | { kind: 'create'; templates: AgentRecord[] };
    /** 初期 fetch (system / tools / skills) のために Agent 詳細を取得する */
    fetchAgent: (id: string) => Promise<Agent>;
    /** 編集モードで保存 */
    onSave: (draft: AgentEditDraft) => Promise<void>;
    /** 削除モードで archive (custom のみ) */
    onDelete?: (agent: AgentRecord) => Promise<void>;
    /** 利用可能な skill リスト (描画用) */
    availableSkills: {
      anthropic: Array<{ id: string; label: string }>;  // xlsx/docx/pdf/pptx
      custom: Array<{ skillId: string; name: string; displayTitle: string }>;
    };
    onClose: () => void;
  }
  ```
- 状態: useState で AgentDraft、編集中 / 保存中 / エラー
- リセットボタン: built-in (= `agent.source === 'builtin'`) のみ表示
- 削除ボタン: custom (= `agent.source === 'custom'`) のみ表示
- 雛形プルダウン: `mode.kind === 'create'` 時のみ表示
- テスト: 8 ケース以上
  - form 初期値 (edit mode)
  - form 初期値 (create mode、templates[0] が初期選択)
  - 雛形変更で form リロード
  - system prompt 空で保存ボタン disabled
  - 保存クリックで onSave が draft 引数で呼ばれる
  - リセットクリックで form が spec 初期値に戻る (built-in)
  - 削除クリックで confirm → onDelete (custom)
  - 編集 → エラー → form 値が保持される

### T7: AgentsListPane

- 「編集 →」ボタンを enable (`disabled` 削除、title 削除)
- onClick で props.onEdit?.(agent) を呼ぶ
- Custom Agent セクションを `agents.filter(a => a.source === 'custom')` 駆動
- 「+ Custom Agent を追加」ボタンを enable + onClick で props.onCreate?.() を呼ぶ
- Custom Agent 行も Built-in 行と同じ AgentRow を使う (visibility toggle はそのまま使える)
- Props 追加:
  ```ts
  onEditAgent?: (agent: AgentRecord) => void;
  onCreateAgent?: () => void;
  ```

### T8: SettingsViewBound wiring

- AgentDetailModal を内包し、開閉状態を `useState<{ mode: ... } | null>(null)` で管理
- handlers:
  - `handleEditAgent(agent)` → modal を edit mode で open
  - `handleCreateAgent()` → templates として builtInAgents を渡して create mode で open
  - `handleSave(draft)` → applyAgentEdit or createCustomAgentFrom 呼出、chatStore 更新、modal close
  - `handleDelete(agent)` → archiveAgentById、chatStore.removeAgent、modal close
- skillsプロパティは既存の resolveSkillSet().bundled / .custom から組立
- `fetchAgent`: `retrieveAgent` をそのまま渡す

### T9: SettingsView props

- AgentsListPane に onEditAgent / onCreateAgent / onDeleteAgent を流す optional props 追加

### T10: 「初期値に戻す」

- Modal 内に独立 useCallback で実装
- 引数: `agent` (現在の AgentRecord、purpose で spec を引く)
- `BUILTIN_AGENT_SPECS[agent.purpose as ...]` から spec 取得
- AgentDraft を再構築 (custom skill ID は availableSkills.custom から filter)
- API は呼ばず、useState だけ更新 (admin が保存ボタンで反映)

### T11: テスト

- `SettingsViewBound.test.tsx` 拡張
  - 編集ボタンクリック → モーダル open
  - モーダル内保存 → chatStore.builtInAgents に反映
  - 雛形コピー → 新 Agent が append
- 既存 vitest 全 pass 維持

### T12: リリース確認

- `pnpm vitest run` (Plugin: +20 tests 程度、合計 ~798)
- `pnpm tsc --noEmit` で本タスク起因の新規エラー無し
- Plugin auto-deploy (Stop hook) で実機反映
- 実機テスト:
  - 業務 Agent 編集 → system prompt 短縮 → 保存 → 新 Session で挙動変化
  - 業務 Agent コピーで新 Custom Agent 作成 → Header picker に表示
  - Custom Agent 削除 → Header picker から消える
  - 業務 Agent 編集 → 「初期値に戻す」 → form がリセット
- README / Issue #40 body に完了報告 (任意)

## 完了基準

- [x] T1〜T11 全タスク完了 (T12 は実機確認のみ)
- [x] vitest 全 pass (74 files / **801 tests**、+23 from #30 baseline)
- [x] tsc に本タスク由来の新規 error 無し (pre-existing errors のみ)
- [ ] 実機で「業務 Agent 編集 / 新規 Custom Agent 作成 / 削除 / リセット」の 4 シナリオが動く (Plugin auto-deploy 後に手動確認)
- [x] requirements.md の受け入れ条件 9 件すべて単体テストで pass

**#40 Agent 詳細編集 UI 実装完了 (2026-06-01)**

## 着手順序

1 → 2 → 3 → 4 → 5 (API レイヤ揃える)
↓
6 (Modal 単体)
↓
7 → 8 → 9 (Wiring)
↓
10 → 11 → 12 (リセット & テスト & リリース)

Step 1-5 と 6 は並行可能だが、6 のテストで 1-5 の関数を mock する必要があるので 1-5 を先に確定させる方が安全。
