# #40 Agent 詳細編集 UI — 設計

要求定義: [requirements.md](./requirements.md)

## 1. 全体アーキテクチャ

```
┌─────────────────── AgentsListPane (admin / 既存) ──────────────────┐
│ Built-in セクション                                                  │
│   [Agent row] visibility toggle  [編集 →]                            │
│   [Agent row] visibility toggle  [編集 →]                            │
│   [Agent row] visibility toggle  [編集 →]                            │
│                                                                       │
│ Custom Agent セクション                                              │
│   [Agent row] visibility toggle  [編集 →]                            │
│   [+ Custom Agent を追加]                                            │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼ (編集 / 追加クリック)
┌────────────── AgentDetailModal (新規) ─────────────────────────────┐
│  ヘッダー: <name> を編集 / Custom Agent を追加                       │
│  雛形プルダウン (追加時のみ)                                          │
│  ─────────────────────────────────────────                            │
│  基本情報セクション:                                                  │
│    name (text)                                                        │
│    description (text)                                                 │
│    icon (IconPicker)  /  color (ColorPicker)                          │
│    visibility (toggle)  /  isDefault (radio)                          │
│  ─────────────────────────────────────────                            │
│  動作セクション:                                                      │
│    system prompt (textarea, mono)                                     │
│    skills (checkbox list: bundled + custom)                           │
│    tools  (checkbox list: KINTONE_TOOL_NAMES)                         │
│  ─────────────────────────────────────────                            │
│  [初期値に戻す (built-in のみ)]  [削除 (custom のみ)]                 │
│  [キャンセル] [保存]                                                  │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼ (保存)
┌────────── agentDetailApi.ts (新規) ───────────────────────────────┐
│  applyAgentEdit(agentId, draft):                                     │
│    1. retrieveAgent(id) で最新 metadata 取得 (merge 用)              │
│    2. tools / skills 構造体を組立て                                  │
│    3. updateAgent(id, { name, description, system, tools, metadata })│
│    4. (skills は別 endpoint がないので tools 同様 update 内で)       │
│                                                                      │
│  createCustomAgentFrom(base, draft):                                 │
│    1. tools / skills / metadata を base spec から流用                │
│    2. createAgent({ model, name, system, tools, skills, metadata })  │
│                                                                      │
│  archiveAgent(id):                                                   │
│    1. POST /v1/agents/{id}/archive  (resources.ts に未実装 → 追加)    │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼ (chatStore に反映)
chatStore.setBuiltInAgents(updated)  // 既存 setter を流用
```

## 2. 編集対象データのマッピング

`AgentRecord` ↔ Anthropic Agent (create/update params) ↔ UI form:

| UI field         | AgentRecord    | Anthropic field          | 編集可? |
|------------------|----------------|--------------------------|---------|
| Name (text)      | `name`         | `name`                   | ○       |
| Description      | `description`  | `description`            | ○       |
| Icon glyph       | `iconKind`     | `metadata.iconKind`      | ○       |
| Icon color       | `iconColor`    | `metadata.iconColor`     | ○       |
| Visibility       | `visibility`   | `metadata.visibility`    | ○       |
| Is default       | `isDefault`    | `metadata.isDefault`     | ○       |
| Model            | `model`        | `model`                  | ✕       |
| Purpose          | `purpose`      | `metadata.purpose`       | ✕       |
| Variant group    | `variantGroup` | `metadata.variantGroup`  | ✕       |
| System prompt    | (UI のみ)      | `system`                 | ○       |
| Tools (kintone)  | (UI のみ)      | `tools[]` の mcp_toolset 配下 `configs[]` enabled flag | ○ |
| Skills           | (UI のみ)      | `skills[]` (type/skill_id) | ○     |

system / tools / skills は AgentRecord に保存していないので、編集 UI 側で **モーダル open 時に `retrieveAgent(id)` で fetch する**。

## 3. 新規ファイル / 既存ファイルの変更

### 3.1 新規

| ファイル | 役割 |
|---|---|
| `packages/plugin/src/desktop/settings/AgentDetailModal.tsx` | 編集 / 追加モーダル (UI 本体) |
| `packages/plugin/src/desktop/settings/AgentDetailModal.test.tsx` | モーダル単体テスト (form / 保存 / リセット) |
| `packages/plugin/src/core/managed-agents/agentDetailApi.ts` | applyAgentEdit / createCustomAgentFrom / archiveAgent (Anthropic API 呼出) |
| `packages/plugin/src/core/managed-agents/agentDetailApi.test.ts` | apiRequest mock で API シーケンス検証 |
| `packages/plugin/src/desktop/settings/IconPicker.tsx` | iconKind / iconColor 選択 (再利用可能なら既存も) |

### 3.2 変更

| ファイル | 変更内容 |
|---|---|
| `AgentsListPane.tsx` | 「編集 →」ボタンを enable + click ハンドラ追加。Custom Agent セクションを `agents.filter(a => a.source === 'custom')` 駆動 + 「追加」ボタン enable |
| `SettingsViewBound.tsx` | onEditAgent / onCreateAgent / onDeleteAgent / onReloadAgents ハンドラ wiring |
| `SettingsView.tsx` | props 追加して AgentsListPane に流す |
| `managed-agents/resources.ts` | `archiveAgent(id)` (POST /v1/agents/{id}/archive) を追加 |
| `core/bootstrap/builtInAgents.ts` | `getBuiltInSpec(purpose)` を export (リセット時に使う) |
| `store/chatStore.ts` | `upsertAgent(record)` / `removeAgent(id)` helper を追加 (setBuiltInAgents の冗長コピーを避ける) |

## 4. AgentDetailModal の状態モデル

```ts
type AgentDraft = {
  name: string;
  description: string;
  iconKind: AgentGlyph;
  iconColor: AgentColor;
  visibility: 'public' | 'private';
  isDefault: boolean;
  systemPrompt: string;
  /** 選択された Anthropic 製 skill ID (xlsx/docx/...) */
  anthropicSkillIds: string[];
  /** 選択された custom skill ID */
  customSkillIds: string[];
  /** ON にされた kintone MCP tool 名 */
  enabledTools: KintoneToolName[];
};

type ModalMode =
  | { kind: 'edit'; agent: AgentRecord }
  | { kind: 'create'; templateAgentId: string };  // 雛形 Agent ID
```

ライフサイクル:

1. モーダル open → loading=true
2. `retrieveAgent(target.id)` で Agent を fetch (system / tools / skills は body から取り出す)
3. AgentDraft を初期化して form に反映、loading=false
4. ユーザーが編集
5. 保存ボタン押下 → `applyAgentEdit` or `createCustomAgentFrom` → chatStore 更新 → close
6. 初期値に戻す (built-in のみ) → builtInAgents.ts の spec から AgentDraft を再構築 (API 呼ばない、保存時にまとめて POST)
7. 削除 (custom のみ) → 確認 → `archiveAgent` → chatStore.removeAgent → close

## 5. tools / skills の組み立て

### 5.1 Tools (kintone MCP toolset)

`resolveAgent.ts:552` の `buildBuiltInAgentTools(spec)` と同じ構造を組立。差分は `configs[]` の enabled に AgentDraft.enabledTools を反映する点のみ。

ヘルパー関数を新設:

```ts
// packages/plugin/src/core/managed-agents/buildAgentTools.ts
export function buildAgentTools(
  enabledTools: readonly KintoneToolName[],
): Array<Record<string, unknown>>
```

- `KINTONE_TOOL_NAMES` 全件をループ
- `enabledTools` に含まれていれば `enabled: true`、無ければ `enabled: false`
- destructive (`DESTRUCTIVE_TOOL_NAMES`) は `permission_policy.type='always_ask'`、それ以外は `always_allow`
- `agent_toolset_20260401` / `create_artifact` (CREATE_ARTIFACT_TOOL) はそのまま付ける

### 5.2 Skills

```ts
type AgentSkillEntry = { type: 'anthropic' | 'custom'; skill_id: string };

function buildAgentSkills(draft: AgentDraft): AgentSkillEntry[] {
  return [
    ...draft.anthropicSkillIds.map((id) => ({ type: 'anthropic' as const, skill_id: id })),
    ...draft.customSkillIds.map((id) => ({ type: 'custom' as const, skill_id: id })),
  ];
}
```

skill 一覧 (画面表示用) は SettingsViewBound 側で `resolveSkillSet()` 結果から渡す (既存ロジックを流用)。

## 6. リセット (built-in 限定)

```ts
function buildDraftFromSpec(spec: BuiltInAgentSpec): AgentDraft {
  return {
    name: spec.name,
    description: spec.description,
    iconKind: spec.iconKind,
    iconColor: spec.iconColor,
    visibility: 'public', // 出荷時既定
    isDefault: spec.isDefault,
    systemPrompt: spec.systemPrompt,
    anthropicSkillIds: [...spec.anthropicSkillIds],
    customSkillIds: customSkillNames.filter((n) => spec.customSkillFilter(n)),  // 名前ベース
    enabledTools: KINTONE_TOOL_NAMES.filter(spec.mcpToolFilter),
  };
}
```

ただし custom skill は **Anthropic 側の skill_id** が必要なので、`customSkillIds` は `resolveSkillSet().custom` で取得した entry の `skillId` を引いて埋める。「初期値に戻す」 = フォームを spec ベースに再構築するだけで、保存ボタンを押すまで Anthropic API は呼ばない。

## 7. 新規 Custom Agent 作成シーケンス

1. AgentsListPane で「+ Custom Agent を追加」クリック
2. AgentDetailModal が `mode: 'create'` で開く
3. 冒頭の「雛形」プルダウンで base Agent を選択 (デフォルト = `isDefault: true` の Agent、無ければ最初の built-in)
4. 選択された base Agent を `retrieveAgent(baseId)` で fetch
5. AgentDraft を base から初期化 (name に「 のコピー」suffix、isDefault=false)
6. admin が編集
7. 保存ボタン → `createAgent({ model: base.model, name, system, tools, skills, metadata })` を呼ぶ
   - metadata.source = 'managed-agents-cowork-agent-for-kintone' (METADATA_SOURCE)
   - metadata.type = AGENT_TYPE.default
   - metadata.purpose = 'custom'
   - metadata.workerUrl + kintoneDomain は base から引き継ぐ
   - metadata.iconKind / iconColor / visibility / isDefault は draft から
8. 返却された Agent を `chatStore.upsertAgent(toAgentRecord(...))` で append
9. モーダルを閉じる

## 8. AgentRecord 変換

Anthropic Agent → AgentRecord の変換は既存 `resolveAgent.ts` 内に `toAgentRecord` 相当のロジックがある (Agent.metadata から組み立て)。**1 関数として export し、本機能でも流用**する。無ければ新規に作る:

```ts
// packages/plugin/src/core/bootstrap/agentRecord.ts (新規 or resolveAgent から export)
export function agentToRecord(agent: Agent): AgentRecord {
  const md = agent.metadata ?? {};
  return {
    id: agent.id,
    name: agent.name,
    model: /* Agent.model → 'opus' | 'sonnet' */,
    modelLabel: ...,
    description: agent.description ?? md.description ?? '',
    purpose: (md.purpose as AgentPurpose) ?? 'custom',
    iconKind: (md.iconKind as AgentGlyph) ?? 'ai',
    iconColor: (md.iconColor as AgentColor) ?? 'teal',
    visibility: md.visibility === 'private' ? 'private' : 'public',
    isDefault: md.isDefault === '1',
    variantGroup: md.variantGroup as 'customizer' | undefined,
    source: md.source === METADATA_SOURCE ? (md.purpose === 'custom' ? 'custom' : 'builtin') : 'custom',
  };
}
```

ただし既存 resolveAgent 側で同様のマッピングをしているはずなので、まず **既存実装の有無を確認** → あればそれを export、無ければ新規。

## 9. UI 詳細 (Tailwind / Modal レイアウト)

既存 SkillAddModal.tsx と同じ枠を流用:
- `fixed inset-0 z-[200] flex items-center justify-center bg-black/40` overlay
- 中央に `w-[640px] max-h-[85vh]` のカード
- ヘッダー / 本文 (overflow-y-auto) / フッター (操作ボタン) の 3 セクション
- 本文を 2 カラム grid にし、左に基本情報 / 右に動作 (skills/tools) を並べる (画面幅が足りなければ縦並びに折返し)

system prompt textarea は `rows={12}` mono、`resize-y`。複雑な editor は使わない。

skill 一覧 / tool 一覧は scrollable な `ul` で全件チェックボックス。destructive ツールには小バッジで「破壊的」表示。

## 10. エラー処理

| 失敗箇所 | UI |
|---|---|
| retrieveAgent (初期 fetch) | モーダル内に full-bleed エラー、再試行ボタン |
| save (apply / create) | モーダル下部に赤 banner、フォームは維持 |
| delete | モーダル下部に赤 banner |

OAuth scope 不足エラー (V2 #20 で導入した `OAuthScopeError`) は Agent API では発生しない (Skills と同じ Workspace スコープ) ので追加対応不要。

## 11. テスト戦略

| レイヤ | テストファイル | 検証内容 |
|---|---|---|
| Unit | `agentDetailApi.test.ts` | apiRequest mock で create / update / archive のリクエスト形 |
| Unit | `buildAgentTools.test.ts` | enabledTools の ON/OFF が configs[] に正しく反映 |
| Component | `AgentDetailModal.test.tsx` | form 初期値 / 編集 / リセット / 保存 callback / 雛形コピー |
| Integration | `SettingsViewBound.test.tsx` (拡張) | 「編集 →」ボタンクリック → モーダル open / 保存後 chatStore 更新 |

E2E (Playwright) は本タスクでは見送り (admin 専用画面で表面的フローは Component test で十分カバー可能)。

## 12. 互換性 / マイグレーション

- 既存の built-in Agent (V2 P3.1 以前に作成済み) はそのまま動く
- 「初期値に戻す」を押しても **Anthropic 側 metadata** は spec.promptVersion など find filter 列を維持する (= 再 bootstrap 時に同じ Agent を見つける)
- もし admin が built-in を削除しようとしたら... → そもそも UI に削除ボタンを出さない (custom のみ)
- Anthropic 側で Agent が archive 済みの場合: chatStore からは消えるが、Agent ID をハードコードした古い Session が残る可能性がある → archive は Anthropic 仕様で「新規 Session 作成不可、既存 Session は継続実行可」なので問題ない (本機能の責任範囲外)

## 13. 段階導入

このタスクは一気に出すと差分が大きいので、内部的に 4 ステップに分ける (PR 単位を意識):

1. **API helpers** (agentDetailApi.ts / buildAgentTools.ts / resources.archiveAgent)
2. **Modal UI** (AgentDetailModal.tsx + テスト、まだ AgentsListPane からは呼ばない)
3. **Wiring** (AgentsListPane / SettingsViewBound、編集ボタン enable、追加ボタン enable)
4. **Reset / Delete** (built-in リセット & custom archive)

各ステップで vitest が pass する状態を保つ。
