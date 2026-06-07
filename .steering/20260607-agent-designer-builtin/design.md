# Agent Designer — 実装設計 (design.md)

> **位置付け**: [requirements.md](./requirements.md) で合意した「kintone 構造起点 + 選択肢型対話 + AgentDetailModal 直接展開」の体験を、現在のコードベースにどう落とすかの実装設計。
>
> **対象 Issue**: #48
>
> **設計判断の指針**:
> - 既存の Custom Tool インフラ (`useEventPoller` + `eventInterpreter` + `useCustomToolResponder`) を **そのまま再利用**。新規ルートは作らない
> - 既存のアーティファクト機構 (`ArtifactPane/renderers/`) に新 kind を 1 つ足すだけで履歴復帰性を実現
> - `BUILTIN_AGENT_SPECS['customizer-opus']` を **purpose key を維持したまま中身を repurpose** することで、既存テナントの Agent ID を活かす

---

## 1. 全体アーキテクチャ — 変更箇所マップ

```
┌─ Anthropic Managed Agents (Designer 専用 Agent) ────────────────────┐
│  custom_tool[]:                                                       │
│    - create_artifact   (既存、全 Agent 共通)                          │
│    - propose_agent     ⭐ 新規 (Designer のみに attach)               │
│  mcp_toolset.kintone.configs[]:                                       │
│    - kintone-get-apps / kintone-get-app / kintone-get-form-fields     │
│    - kintone-get-records   (system prompt で limit ≦ 5 強制)          │
│    ⊘ 書込系 (add/update/delete) は attach しない                       │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ events stream
┌─ useEventPoller (既存) ─────────────────────────────────────────────┐
│  agent.custom_tool_use を観測 → eventInterpreter に渡す               │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ eventInterpreter.ts (既存・拡張) ──────────────────────────────────┐
│  switch (tool_name):                                                  │
│    case 'create_artifact':  既存 → upsert-artifact action             │
│    case 'propose_agent': ⭐ 新規 → propose-agent action               │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ useEventPoller の action 処理 (既存・拡張) ───────────────────────┐
│  case 'propose-agent':                                                │
│    1. chatStore.upsertArtifact({ kind: 'agent-draft', content })     │
│    2. chatStore.setActiveArtifact(id) — 右ペインを新案にフォーカス     │
│    3. pendingCustomToolUseIds.set(toolUseId, artifactId)             │
│    ⊘ setPendingAgentProposal は呼ばない (= モーダル自動展開しない)     │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ chatStore (拡張) ──────────────────────────────────────────────────┐
│  pendingAgentProposal: { draft, rationale, model } | null            │
│  (Q-1 A 確定: top-level、Q-5 B 確定: AgentEditDraft とは別管理)      │
│  ⚠ propose_agent 受信時には自動セットされない。                       │
│     アーティファクトカードの「作成画面を開く」ボタン押下で初めてセットされる。  │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ ArtifactPane/renderers/AgentDraftArtifact.tsx ⭐ 新規 ───────────────┐
│  右ペインに設計案カードを表示 (header + クイックアクション + rationale  │
│  + systemPrompt + 推奨ツール)。                                       │
│  フッターに「この内容で作成画面を開く →」ボタン。                       │
│  → クリックで setPendingAgentProposal({ draft, rationale, model })   │
│    → ChatPanel watcher が AgentDetailModal を起動                    │
│  (この間にユーザーは Designer に追加の修正依頼を投げられる)             │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ ChatPanel + AgentProposalBridge (拡張) ────────────────────────────┐
│  pendingAgentProposal を watch                                       │
│    ≠ null → <AgentDetailModal                                       │
│              mode='create-from-proposal'                             │
│              draft / rationale / model />                            │
│  保存 or キャンセルで setPendingAgentProposal(null) → モーダル閉じる   │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ AgentDetailModal (拡張) ─────────────────────────────────────────────┐
│  mode = { kind: 'create-from-proposal', draft, rationale, model }     │
│    ├─ 雛形プルダウン非表示                                              │
│    ├─ 全項目を draft で初期化                                          │
│    ├─ ヘッダーに「エージェントデザイナーによる提案」バッジ + rationale   │
│    └─ 「雛形から作り直す」リンク → mode='create' に切替 (draft 破棄)    │
└──────────────────────────────────────────────────────────────────────┘

  useCustomToolResponder (既存・無改修):
    pendingCustomToolUseIds を購読して user.custom_tool_result を POST
    (Designer 経路でも同じハンドラが動く)
```

---

## 2. BUILTIN_AGENT_SPECS の repurpose

### 2.1 spec 中身の差替

```ts
// packages/plugin/src/core/bootstrap/builtInAgents.ts

'customizer-opus': {
  name: 'エージェントデザイナー',                     // ← 全面書換
  description: 'kintone アプリを起点にエージェントを設計',
  model: 'claude-opus-4-7',
  modelLabel: 'OPUS',
  modelKind: 'opus',
  promptVersion: 'v23-agent-designer',                 // ← bump
  systemPrompt: AGENT_DESIGNER_SYSTEM_PROMPT,          // ← 全面書換 (§5)
  anthropicSkillIds: [],                                // skill 不要
  customSkillFilter: () => false,                       // custom skill 不要
  mcpToolFilter: (name) => READONLY_KINTONE_TOOL_NAMES.has(name), // get 系のみ
  iconKind: 'ai',                                       // ← 'cust' → 'ai' (星)
  iconColor: 'accent',                                  // 維持 (Opus = 塗り)
  variantGroup: undefined,                              // ← variantGroup を外す
  isDefault: true,                                      // V1 既定維持
  quickActions: AGENT_DESIGNER_QUICK_ACTIONS,           // ← 全面書換
},
```

`variantGroup` を外すのは、もう Sonnet との pair 関係がなくなるため。

### 2.2 READONLY_KINTONE_TOOL_NAMES の追加

```ts
// builtInAgents.ts 共有定数
export const READONLY_KINTONE_TOOL_NAMES = new Set<KintoneToolName>([
  'kintone-get-apps',
  'kintone-get-app',
  'kintone-get-form-fields',
  'kintone-get-records',
]);
```

### 2.3 既存テナントへの影響

- `promptVersion` を bump することで再 bootstrap 時に Anthropic 側の Agent 内容が必ず差し替わる
- purpose key (`customizer-opus`) は維持なので **Anthropic Agent ID は変わらない**
- = テナント側 admin が設定した visibility / isDefault は維持される
- = 旧 quickActions (= Customizer Opus 用) は spec source-of-truth なので自動で新文言に切替

### 2.4 既存 Header / AgentPicker への影響

variantGroup を外したことで、Header の Opus/Sonnet 切替 pair が片方 (Sonnet のみ) になる。これは UX 上問題なし (Designer は単独で意味のあるエージェント)。

---

## 3. Custom Tool `propose_agent` の定義

### 3.1 attach 方法

`resolveAgent.ts` の Agent definition で、`tools: [...]` 配列に追加する。既存の `create_artifact` と同じ位置に置く:

```ts
// packages/plugin/src/core/bootstrap/resolveAgent.ts (Designer 専用分岐に追加)

{
  type: 'custom',
  name: 'propose_agent',
  description: 'インタビュー完了後、ユーザーが Cowork Agent に新たに登録すべき' +
               '「エージェント設計案」を提出する。呼出と同時に管理画面が開かれる。',
  input_schema: {
    type: 'object',
    properties: {
      name:        { type: 'string', description: 'エージェント表示名 (10〜20 字)' },
      description: { type: 'string', description: '1 行説明 (20〜35 字)' },
      iconKind:    { type: 'string', enum: ['biz','cust','dev','analytics','mail','calendar','ops','ai','doc'] },
      iconColor:   { type: 'string', enum: ['teal','emerald','amber','rose','indigo','slate','sky','fuchsia'] },
      model:       { type: 'string', enum: ['opus','sonnet'] },
      systemPrompt:{ type: 'string', description: 'エージェント本体の system prompt 全文' },
      quickActions:{ type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 5 },
      enabledTools:{ type: 'array', items: { type: 'string' }, description: 'kintone MCP ツール名' },
      anthropicSkillIds:{ type: 'array', items: { type: 'string', enum: ['xlsx','docx','pdf','pptx'] } },
      rationale:   { type: 'string', description: 'この設計に至った理由 (3〜5 文)' },
    },
    required: ['name','description','iconKind','iconColor','model','systemPrompt','quickActions','enabledTools','anthropicSkillIds','rationale'],
  },
  permission_policy: { type: 'always_allow' },
}
```

### 3.2 既存 Agent への非 attach

`propose_agent` は **Designer 以外 (business / customizer-sonnet) には attach しない**。`resolveAgent.ts` の spec 分岐で `purpose === 'customizer-opus'` のときだけ tools 配列に push する形にする。

### 3.3 Custom Tool である理由 (MCP server ではない理由)

- LLM 側からは「ツールを 1 つ呼ぶ」だけで Plugin 側に強制的に effect を起こせる = MCP より軽量
- MCP server を立てると Cloudflare Workers 側の deployment + URL 管理 + 認証が必要、Phase 1 では過剰
- 既存 `create_artifact` (custom tool) と同じパターンで実装できる

---

## 4. eventInterpreter / useEventPoller への拡張

### 4.1 eventInterpreter.ts

既存の action 型に新 kind を追加:

```ts
// eventInterpreter.ts
export type InterpretedAction =
  | { kind: 'upsert-artifact', toolUseId, input }            // 既存
  | {
      kind: 'propose-agent';                                  // ⭐ 新規
      toolUseId: string;
      draft: AgentEditDraft;
      rationale: string;
    }
  | ... (他既存);

// agent.custom_tool_use 観測時の分岐:
case 'agent.custom_tool_use': {
  const toolName = event.tool_name;
  if (toolName === 'create_artifact') {
    return { kind: 'upsert-artifact', ... };           // 既存
  }
  if (toolName === 'propose_agent') {                  // ⭐ 新規
    const parsed = parseProposeAgentInput(event.input);
    if (!parsed.ok) {
      return { kind: 'tool-error', toolUseId, message: parsed.error };
    }
    return {
      kind: 'propose-agent',
      toolUseId: event.id,
      draft: parsed.draft,
      rationale: parsed.rationale,
    };
  }
  return { kind: 'unknown-tool', toolName };
}
```

#### parseProposeAgentInput

```ts
function parseProposeAgentInput(raw: unknown): 
  | { ok: true, draft: AgentEditDraft, rationale: string }
  | { ok: false, error: string }
{
  // 1. 型 guard で必須フィールド存在チェック
  // 2. iconKind / iconColor / model の enum バリデーション (NG なら fallback)
  // 3. quickActions の slice(0, 5) + 空文字フィルタ
  // 4. enabledTools を KINTONE_TOOL_NAMES に絞る (未知ツール無視)
  // 5. anthropicSkillIds を ['xlsx','docx','pdf','pptx'] に絞る
  // 6. AgentEditDraft 形式に組み立てる (visibility='public', isDefault=false 固定)
}
```

### 4.2 useEventPoller.ts

action 処理ループに新 case を追加:

```ts
case 'propose-agent': {
  const { toolUseId, draft, rationale, model } = action;
  const artifactId = `agent-draft-${toolUseId}`;
  store.upsertArtifact({
    id: artifactId,
    kind: 'agent-draft',
    title: `エージェント案: ${draft.name}`,
    content: JSON.stringify({ draft, rationale, model }),
  });
  store.setActiveArtifact(artifactId);
  // ⚠ モーダルは自動展開しない — setPendingAgentProposal はここで呼ばず、
  //    ユーザーがアーティファクトカードの「作成画面を開く」ボタンを押したときに
  //    AgentDraftArtifact 内で呼ばれる。
  // custom_tool_result の責務は既存 responder に任せる:
  store.addPendingCustomToolUse(toolUseId, artifactId);
  break;
}
```

`useCustomToolResponder` は **無改修**。`pendingCustomToolUseIds` に (toolUseId → artifactId) が追加されれば、既存ロジックが `user.custom_tool_result` を POST する。

**UX 上の意義**: モーダルが自動展開しないことで、ユーザーは下記の自然な流れで作業できる:
1. 右ペインに表示された設計案カードを確認
2. (必要なら) Designer に「ここを変えて」「もう少し〜」と修正依頼 → 同じツール経由で artifact が新規生成される
3. 内容が固まったら自分のタイミングで「この内容で作成画面を開く」ボタンを押して登録

---

## 5. chatStore 拡張

### 5.1 新フィールド (Q-1 A 確定 = top-level / Q-5 B 確定 = 別フィールド)

```ts
interface AgentProposalPayload {
  draft: AgentEditDraft;
  rationale: string;
}

interface ChatStoreState {
  // 既存フィールド...

  /** Designer の propose_agent 呼出で起こる「全項目入力済モーダルを開く」シグナル */
  pendingAgentProposal: AgentProposalPayload | null;

  setPendingAgentProposal: (next: AgentProposalPayload | null) => void;
}
```

### 5.2 reset() への組込み

新規会話・ログアウト時の reset で `pendingAgentProposal: null` も初期化する。

### 5.3 観点: `AgentEditDraft` を chatStore で持つことの是非

`AgentEditDraft` 型は `core/managed-agents/agentDetailApi.ts` に置かれている。chatStore がここを import するのは循環なし (chatStore → agentDetailApi は片方向)。問題なし。

---

## 6. AgentDetailModal の `create-from-proposal` mode

### 6.1 Props 拡張

```ts
type ModalMode =
  | { kind: 'edit'; agent: AgentRecord }
  | { kind: 'create'; templates: readonly AgentRecord[] }
  | { kind: 'create-from-proposal'; draft: AgentEditDraft; rationale: string };  // ⭐ 新規
```

### 6.2 初期化処理

既存の `useEffect` で agent fetch → buildDraftFromAgent していたところに新分岐:

```ts
useEffect(() => {
  if (mode.kind === 'edit')               { /* 既存 */ }
  else if (mode.kind === 'create')        { /* 既存 */ }
  else if (mode.kind === 'create-from-proposal') {
    setDraft(mode.draft);
    setLoading(false);
  }
}, [mode]);
```

`mode.draft` は既に AgentEditDraft なので fetchAgent 不要、即表示。

### 6.3 UI 差分

| 部位 | 通常の create | create-from-proposal |
|---|---|---|
| ヘッダーラベル | `+ Custom Agent を追加` | `エージェントデザイナーによる提案` バッジ |
| 雛形プルダウン | 表示 | **非表示** |
| rationale 表示 | (なし) | ヘッダー下に折りたたみ表示 (`<details>` 風) |
| 「雛形から作り直す」リンク | (なし) | フッター左に表示 |
| 保存ボタン | 「作成」 | 「作成」 (同じ、既存 createCustomAgentFrom 経由) |

### 6.4 「雛形から作り直す」遷移 (Q-4 確定: draft 破棄)

クリック時:
```ts
setLocalMode({ kind: 'create', templates: <既存 templates 渡し> });
// draft は再ロード (= buildDraftFromAgent(templates[0]) で上書き)
```

Proposal の draft は破棄。理由:
- 「最初から作り直したい」意図への素直な応答
- 雛形を選び直すと templates の値で全項目が再初期化されるため、proposal の draft が残っても上書きで消える → 残しても無意味
- 「Proposal に戻る」逃げ道は **アーティファクトカードの「この内容で開く」ボタン** で十分

### 6.5 templates の供給

`create-from-proposal` mode でも「雛形から作り直す」遷移時には既存 templates が必要。ChatPanel 側が builtInAgents を templates として渡す:

```tsx
<AgentDetailModal
  mode={{ kind: 'create-from-proposal', draft, rationale }}
  fallbackTemplates={builtInAgents}   // ⭐ 新 prop
  onSave={...}
  onClose={...}
/>
```

Modal 内で「雛形から作り直す」押下時:
```ts
setLocalMode({ kind: 'create', templates: fallbackTemplates });
```

---

## 7. アーティファクト `kind: 'agent-draft'`

### 7.1 ArtifactKind への追加

```ts
// core/artifacts/types.ts
export type ArtifactKind =
  | 'markdown' | 'code' | 'json' | 'react'
  | 'mermaid' | 'svg' | 'csv' | 'html'
  | 'agent-draft';   // ⭐ 新規

export const RENDERABLE_ARTIFACT_KINDS = new Set<ArtifactKind>([
  ..., 'agent-draft',
]);

// AGENT_CREATABLE_ARTIFACT_KINDS には ⊘ 含めない
// (LLM が直接 create_artifact({ kind: 'agent-draft' }) を呼ぶことは認めない、
//  propose_agent ツール経由で生成されるのみ)
```

### 7.2 renderer の配置 (Q-2 確定)

```
packages/plugin/src/desktop/components/ArtifactPane/renderers/
  ├─ MarkdownArtifact.tsx
  ├─ CodeArtifact.tsx
  ├─ JsonArtifact.tsx
  ├─ ...
  └─ AgentDraftArtifact.tsx   ⭐ 新規
```

### 7.3 renderer の中身

```tsx
export function AgentDraftArtifact({ artifact }: { artifact: Artifact }) {
  const parsed = parseAgentDraftContent(artifact.content);
  if (!parsed.ok) return <ArtifactParseError ... />;
  const { draft, rationale } = parsed.value;
  const setPending = useChatStore((s) => s.setPendingAgentProposal);

  return (
    <div className="...">
      <header className="flex items-center gap-2">
        <AgentIcon kind={draft.iconKind} color={draft.iconColor} size={36} />
        <div>
          <h2>{draft.name}</h2>
          <ModelBadge model={draft.model} />
        </div>
      </header>
      <p className="text-muted">{draft.description}</p>

      <section>
        <h3>クイックアクション</h3>
        <ul>{draft.quickActions.map(...)}</ul>
      </section>

      <details>
        <summary>設計理由</summary>
        <p>{rationale}</p>
      </details>

      <section>
        <h3>システムプロンプト</h3>
        <pre className="font-mono text-xs ...">{draft.systemPrompt}</pre>
      </section>

      <footer>
        <button onClick={() => setPending({ draft, rationale })}>
          この内容で作成画面を開く →
        </button>
      </footer>
    </div>
  );
}
```

### 7.4 ArtifactRefMessage / ArtifactPane の dispatch

`renderers/index.ts` (= 既存の kind → renderer map) に `'agent-draft': AgentDraftArtifact` を追加するだけ。残りはルーティング側が既存ロジックでハンドリング。

---

## 8. system prompt の骨格

```
あなたは Cowork Agent for kintone の「エージェントデザイナー」です。
ユーザーは kintone を業務基盤として使う admin / 業務担当者です。
あなたの目的は、ユーザーから kintone アプリ構造を起点にヒアリングを行い、
新たに登録すべきエージェントの設計案を作成することです。

【最重要ルール — 守らなければ無効】
1. オープン質問は禁止。常に番号付き選択肢 (3〜5 個 + 「その他」) を提示する
   - 各選択肢には 1 行で根拠を添える ("ステータスフィールドがあるため" 等)
   - ユーザーは番号で回答 (複数選択可と明示してよい、例: "1,3")
2. 質問する前に必ず関連 kintone アプリ構造を MCP ツールで取得する
   - 1 ターン目: kintone-get-apps で一覧取得 → 選択肢化
   - 選択後: 該当アプリの kintone-get-app + kintone-get-form-fields で構造把握
   - 必要に応じて kintone-get-records (limit ≦ 5、絶対遵守)
3. 7 ターン以内に propose_agent ツールを呼ぶ
   - 情報が足りなくても合理的な仮定を置き、デフォルト推奨で埋める

【会話フェーズ】
Phase 1 — アプリ起点の探索:
  kintone-get-apps → ユーザーに選択肢化して提示
  「あなたの kintone には N 個のアプリがあります。どのアプリを起点に
   エージェントを考えますか?
     1. <appName> (推定: <ドメイン>)
     2. ...
     N. アプリ横断 (複数アプリを組み合わせる)
     N+1. アプリ非依存 (汎用エージェント)」

Phase 2 — 構造分析:
  選ばれたアプリの get-app + get-form-fields を実行
  フィールド構成を 1〜2 行で要約してユーザーに見せる
  「案件管理は『ステータス』『金額』『担当者』『更新日』を持ち、
   パイプライン管理と進捗追跡が主用途と推察できます」

Phase 3 — エージェント類型の選択:
  下記ヒューリスティクスから 3〜5 個の候補を生成
  「このアプリ構造から、以下のエージェントが有効です。どれを設計しますか?」
  各候補に「なぜこれを推すか」の根拠を 1 行添える

Phase 4 — 詳細詰め (3 ターン):
  - 想定ユーザー (営業担当 / マネージャー / バックオフィス / 全社員 / その他)
  - クイックアクションの粒度 (1 クリックで完結 / 対話で詰める / 両方)
  - モデル (Sonnet 速度重視 / Opus 品質重視)

Phase 5 — 提案出力:
  propose_agent({ name, description, iconKind, iconColor, model,
                  systemPrompt, quickActions, enabledTools,
                  anthropicSkillIds, rationale }) を呼ぶ
  会話本文には「ご提案をまとめました。作成画面が開きます。
              右ペインのアーティファクトカードからもいつでも開けます。」と書く

【propose_agent 呼出時の規約】
- iconKind は 'biz'|'cust'|'dev'|'analytics'|'mail'|'calendar'|'ops'|'ai'|'doc' から選択
- iconColor は 'teal'|'emerald'|'amber'|'rose'|'indigo'|'slate'|'sky'|'fuchsia' から選択
- model は対話で確定した値
- quickActions は 4〜5 個、1 文 20〜60 字程度、業務文脈を反映
- enabledTools は kintone MCP の参照系 (kintone-get-*) を基本、書込が必要なときのみ追加
  (delete-records は絶対追加しない)
- anthropicSkillIds は出力形式に応じて [xlsx/docx/pdf/pptx] から必要なものだけ
- systemPrompt はそのエージェント本体の system prompt 全文を書ききる
  (テンプレ文ではなくユーザーの業務文脈を反映する)
- rationale はこの設計に至った理由を 3〜5 文 (「あなたのアプリで〜のため」と業務文脈で書く)

【ドメイン推察ヒューリスティクス】
- ステータス + 担当者 + 期限 → 進捗追跡 / アラート / 期限超過検出
- 数値 + カテゴリ → 集計 / KPI ダッシュボード
- 計算フィールド多 → データ整形 / 検算
- FILE フィールド → 添付物処理 (議事録抽出 / 契約書要約)
- LOOKUP 多 → 横断検索 / マスタ整合チェック
- ユーザー / 組織フィールド → 担当割振 / 通知文生成
- カテゴリ / タグ → 分類 / 振分
- プロセス管理 (workflow) → ワークフロー支援 / 承認補助
- サブテーブル → 明細処理 (見積 / 発注)
- (アプリ名から) 営業 / 経理 / 人事 → 業種特化案を追加で提示

【データアクセス制約】
- kintone-get-records の query には絶対 limit ≦ 5 を含める (大量データ参照禁止)
- 書込系ツール (add / update / delete) は持っていない (今回の Agent には付与されていない)

【スコープ外】
- Agent の実登録 (admin が AgentDetailModal で「保存」ボタンを押す)
- JS カスタマイズコードの生成 (カスタマイザー Sonnet が担当)
- 業務データ自体の操作 (業務エージェントが担当)
- スケジュール / 自動トリガー (現プロダクトに該当機能なし、提案も不要)
```

---

## 9. ChatPanel への組込み

### 9.1 watcher

```tsx
const pendingAgentProposal = useChatStore((s) => s.pendingAgentProposal);
const setPendingAgentProposal = useChatStore((s) => s.setPendingAgentProposal);
```

### 9.2 modal レンダリング (既存 SettingsViewBound と並列)

既存の SettingsViewBound 横に modal を出す層を追加:

```tsx
{pendingAgentProposal && (
  <AgentDetailModalBound
    mode={{
      kind: 'create-from-proposal',
      draft: pendingAgentProposal.draft,
      rationale: pendingAgentProposal.rationale,
    }}
    fallbackTemplates={builtInAgents}
    onClose={() => setPendingAgentProposal(null)}
    onSaved={(newAgentRecord) => {
      setPendingAgentProposal(null);
      // builtInAgents への反映は SettingsViewBound の既存ロジックを再利用
      useChatStore.getState().setBuiltInAgents([...builtInAgents, newAgentRecord]);
    }}
  />
)}
```

`AgentDetailModalBound` は SettingsViewBound 内に存在する閉じた wrapper のため、**それを再利用できる形に上昇させる必要がある** (現状はおそらく private)。

### 9.3 onSave のフロー

- `mode.kind === 'create-from-proposal'` のとき、保存ボタンは内部で **`createCustomAgentFrom`** を呼ぶ (既存の create と同じ)
- 雛形 (= baseAgentId) には **Designer 自身** を使う (= mode 内に持つか別途渡す)。これは新 Custom Agent の `base.model / mcp_servers / find filter` を継承するのに必要

実は AgentDetailModal の現行実装は `createCustomAgentFrom({ baseAgentId, draft })` を呼ぶので、`create-from-proposal` mode のときは **baseAgentId = Designer の Agent ID** を使う (Designer の MCP 設定が新 Agent に継承される)。

---

## 10. Q-3 確定: tool result メッセージの方針

**確定**: tool result は `{ success: true }` のみ返し、**LLM が次の自然なテキストで会話を締める** (system prompt §5 のフレーズ「ご提案をまとめました…」)。

- artifact / modal の発火は完全に Plugin 側 side effect
- LLM 側に追加の指示なし
- 会話タイムラインには `propose_agent` の tool_use と LLM のクロージングテキストが残る
- → ユーザーが会話履歴を遡ったときに自然に追える

---

## 11. テスト戦略

### 11.1 新規

| ID | テスト対象 | 内容 |
|---|---|---|
| T1 | `builtInAgents.test.ts` | customizer-opus が新 spec に置き換わっていることを assertion |
| T2 | `eventInterpreter.test.ts` | `agent.custom_tool_use` (tool_name=propose_agent) → `propose-agent` action |
| T3 | `eventInterpreter.test.ts` | iconKind/iconColor の enum 外 → fallback (`ai`/`teal`) |
| T4 | `useEventPoller.test.ts` | propose-agent action 処理 → artifact 生成 + pendingAgentProposal セット + pendingCustomToolUseIds 追加 |
| T5 | `chatStore.test.ts` | `setPendingAgentProposal` の動作と reset() で null クリア |
| T6 | `AgentDraftArtifact.test.tsx` | renderer の rendering と「作成画面を開く」ボタン |
| T7 | `AgentDetailModal.test.tsx` | `create-from-proposal` mode の初期化 + 雛形プルダウン非表示 |
| T8 | `AgentDetailModal.test.tsx` | 「雛形から作り直す」リンクで `create` mode に遷移 + draft 破棄 |
| T9 | `ChatPanel.test.tsx` | pendingAgentProposal セット → modal 表示 |

### 11.2 既存

- 既存テスト (#45 で 835 件) は全部 pass を維持
- `BUILTIN_AGENT_SPECS.test.ts` の customizer-opus が「カスタマイザーエージェント」前提だった部分は新 spec 用に書換

---

## 12. ロールアウト戦略

V1 リリース時点で **全 admin に自動有効化**。
- `promptVersion` bump で再 bootstrap → 全テナントの旧 customizer-opus Agent が新 designer に置換される (内容のみ更新、Agent ID は維持)
- 既存ユーザーは「Customizer Opus」が「エージェントデザイナー」にリネームされた形で発見
- リネーム告知は #45 と合わせて V2 リリース notes で行う

### 12.1 ロールバック

万一トラブル時:
- `BUILTIN_AGENT_SPECS['customizer-opus']` を旧 Customizer Opus spec に戻す + promptVersion を `v22-customizer` に戻す
- 次回 bootstrap で内容が旧版に戻る (Agent ID 維持のため)

---

## 13. 関連 / 参照

- requirements.md (本ディレクトリ)
- Issue #48 (本要件) / #45 (前提)
- 既存資産:
  - [resolveAgent.ts](../../packages/plugin/src/core/bootstrap/resolveAgent.ts) — Agent definition + tool attach
  - [eventInterpreter.ts](../../packages/plugin/src/core/managed-agents/eventInterpreter.ts) — custom_tool_use 解釈
  - [useEventPoller.ts](../../packages/plugin/src/desktop/hooks/useEventPoller.ts) — action dispatch
  - [useCustomToolResponder.ts](../../packages/plugin/src/desktop/hooks/useCustomToolResponder.ts) — 既存・無改修で使う
  - [AgentDetailModal.tsx](../../packages/plugin/src/desktop/settings/AgentDetailModal.tsx) — mode 追加
  - [ArtifactPane/renderers/](../../packages/plugin/src/desktop/components/ArtifactPane/renderers/) — 新 renderer 配置先
