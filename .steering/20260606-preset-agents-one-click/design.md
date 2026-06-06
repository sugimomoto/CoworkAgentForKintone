# Preset Agent Panel — 実装設計 (design.md)

> **位置づけ**: [requirements.md](./requirements.md) で合意したプリセットエージェント + ワンクリック実行 UX (Issue #45) を、現在のコードベース ([packages/plugin/src/](../../packages/plugin/src/)) にどう落とすかの実装設計。
> UI 仕様の一次ソースは Claude Design ハンドオフバンドル (`Preset Agent Panel - Prototype.html` 案 A + `handoff/PresetAgentLanding.tsx` 等)。
>
> **対象 Issue**: #45 (本書) / #46 (配布方式は別 Issue、本書はスコープ外)
>
> **設計判断の指針**:
> - **ハンドオフコード (`handoff/*.tsx`) は構造の参考**にしつつ、**既存資産** (`AgentIcon` / `ModelBadge` / `AgentRecord` / Tailwind デザイントークン) を最大限再利用する
> - **既存 ChatPanel の状態遷移を変えない**。空状態の描画コンポーネントだけ差し替え (= `<WelcomeMessage />` → `<PresetAgentLanding ... />`)
> - **既存 `handleSubmit` を通す**。ワンクリック実行は user message として残し、agent ターン進行は既存フックがそのまま処理
> - Built-in と Custom で **quickActions の source-of-truth を分ける** (spec カタログ / Anthropic metadata)

---

## 1. 全体アーキテクチャ — 変更箇所マップ

```
┌─ ChatPanel.tsx ─────────────────────────────────────────────────────┐
│                                                                      │
│  view==='chat' && messages.length===0 && sessionId===null            │
│       ↓                                                              │
│       ┌─ <WelcomeMessage />   (現状) ─→ <PresetAgentLanding />  ⭐ │
│       │                                                              │
│       └─ <ConnectKintoneButton />   (showConnectButton=true 時、現状維持)│
│                                                                      │
│  view==='chat' && (messages.length>0 || sessionId!==null)            │
│       ↓                                                              │
│       <MessageList messages={messages} ... />   (変更なし)           │
│                                                                      │
│  view==='history' / view==='settings' は変更なし                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ chatStore.ts ──────────────────────────────────────────────────────┐
│  builtInAgents: AgentRecord[]    (既存) ★ quickActions を載せて流す│
│  currentAgentId: string | null   (既存)                             │
│  messages / sessionId / view など (変更なし)                        │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ core/bootstrap/* ──────────────────────────────────────────────────┐
│  agentTypes.ts        ⭐ AgentRecord に quickActions を追加         │
│  builtInAgents.ts     ⭐ BuiltInAgentSpec に quickActions を追加    │
│                          + 3 variant のデフォルト文言               │
│  agentRecord.ts       ⭐ Anthropic Agent → AgentRecord 変換時に       │
│                          spec / metadata から quickActions を復元   │
│  useSession.ts (toAgentRecords) ⭐ built-in 経路にも quickActions 注入│
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ AgentDetailModal.tsx ──────────────────────────────────────────────┐
│  Custom Agent の作成・編集 UI に quickActions 編集セクション追加    │
│  保存時に metadata.quickActions (JSON 配列文字列) として永続化      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. データモデル変更

### 2.1 `AgentRecord` (agentTypes.ts)

```ts
export interface AgentRecord {
  // ... 既存フィールド (id / name / model / iconKind / iconColor / visibility / isDefault / variantGroup / source / purpose / description / modelLabel)
  /**
   * プリセットエージェント一覧 (`PresetAgentLanding`) で並べるクイックアクション (0〜5 個)。
   * Built-in は spec カタログから注入、Custom は metadata.quickActions (JSON 配列) から復元。
   */
  quickActions: readonly string[];
}
```

- **必須プロパティ**として持つ (`readonly string[]`)。空配列は許容、`undefined` は許容しない (UI 側で `array.length` を素直に分岐させるため)。

### 2.2 `BuiltInAgentSpec` (builtInAgents.ts)

```ts
export interface BuiltInAgentSpec {
  // ... 既存フィールド (name / description / model / promptVersion / systemPrompt / ...)
  /** プリセットエージェント一覧で並べるクイックアクション。0〜5 個。 */
  quickActions: readonly string[];
}
```

3 variant に文言を埋め込む:

| purpose | quickActions |
|---|---|
| `business` | requirements.md §6.1 の 5 文 |
| `customizer-opus` | `CUSTOMIZER_QUICK_ACTIONS` 定数 (§6.2 の 5 文) |
| `customizer-sonnet` | 同上 (Opus と共有) |

### 2.3 Anthropic Agent.metadata (Custom Agent 用)

- **key**: `quickActions`
- **値**: `JSON.stringify(string[])` (= `'["..","..",...]'`)
- **上限**: 1KB を超えないことをクライアント側でバリデーション (`new Blob([raw]).size <= 1024` 程度)
- 不正 JSON や非文字列要素はパース時に **silent に空配列フォールバック** (UI が壊れないことを優先)

### 2.4 Source-of-Truth の二系統

| Agent source | quickActions の取得経路 | 編集経路 |
|---|---|---|
| `builtin` | `BUILTIN_AGENT_SPECS[purpose].quickActions` (= spec カタログ) | コード変更でのみ更新 (admin UI からは不可) |
| `custom` | `Agent.metadata.quickActions` (JSON) | `AgentDetailModal` の編集セクション |

**重要**: Built-in は metadata に書かない。Plugin 再起動時に常に最新文言が反映される (admin が手動同期する必要なし)。

---

## 3. コンポーネント設計

### 3.1 ファイル配置

新規:
- `packages/plugin/src/desktop/components/PresetAgentLanding.tsx` — 本体
- `packages/plugin/src/desktop/components/PresetAgentLanding.test.tsx` — ユニットテスト

既存に手を入れる:
- `packages/plugin/src/desktop/ChatPanel.tsx` — `<WelcomeMessage>` を置換
- `packages/plugin/src/desktop/settings/AgentDetailModal.tsx` — quickActions 編集セクション追加

**`WelcomeMessage.tsx` の扱い**: 削除はしない。`builtInAgents.length === 0` (bootstrap 進行中 / 失敗時) のフォールバック用に残す。ただし通常運用ではもう描かれない。

### 3.2 `PresetAgentLanding` の API

```ts
export interface PresetAgentLandingProps {
  /** 一覧に並べる候補。呼出側で visibility filter 済みでも未済でも内部で再 filter する */
  agents: readonly AgentRecord[];
  /** プロンプト押下時。チャット遷移と送信は親が行う */
  onSelectPrompt: (agent: AgentRecord, prompt: string) => void;
  /** 「自由入力で話しかける」CTA 押下時。送信はせず、エージェント切替 + Composer フォーカスのみ */
  onSelectAgentForFreeInput: (agent: AgentRecord) => void;
  /** 検索ボックス強制表示 (既定: 6 個超で自動 ON)。テスト用に上書き可 */
  searchable?: boolean;
}

export function PresetAgentLanding(props: PresetAgentLandingProps): JSX.Element;
```

**設計判断**:
- **`onSelectPrompt` / `onSelectAgentForFreeInput` を分離**する。プロンプトありとなしで親側のハンドラが大きく違う (送信 vs フォーカス) ため、空文字列のフラグ運用にしない
- ハンドオフ版は `onSelectPrompt(agent, '')` で空文字列ケースを混ぜていたが、こちらは明示分離した方が型安全

### 3.3 内部構造 (1 ファイル内に閉じる小コンポーネント)

```
PresetAgentLanding
 ├─ <Intro>              "何をお手伝いしましょうか？" 見出し
 ├─ <SearchBox>          (公開エージェント > 6 個 のみ)
 └─ <AccordionRow> × n
      ├─ button (header)
      │    ├─ <AgentIcon>        既存コンポーネント (30px)
      │    ├─ name + <ModelBadge>
      │    ├─ "既定" バッジ (isDefault のみ)
      │    └─ chevron
      └─ 展開時:
           ├─ <PromptButton> × m
           └─ <EmptyPromptsCTA>  (m === 0 のとき)
```

**特殊ルート**: `publicAgents.length === 1` のときは `<SinglePresetView>` に分岐 (アコーディオン chrome を省略して中央寄せ表示)。

### 3.4 状態管理

- `openId: string | null` — 開いているアコーディオン行 (排他、`useState`)
- `query: string` — 検索ボックス入力 (検索表示時のみ意味あり)
- 初期値: `openId = defaultOpenId(publicAgents)` (= `isDefault: true` の Agent 優先、無ければ先頭)

### 3.5 スタイル方針 — ハンドオフから既存トークンへの置換

ハンドオフは Tailwind の `teal-*` / `slate-*` をハードコードしている。Plugin 側は既存 CSS カスタムプロパティに揃える:

| ハンドオフ | 置換先 (既存トークン) |
|---|---|
| `bg-white` | `bg-card` |
| `border-slate-200` | `border-card-border` |
| `border-slate-200/70` | `border-card-border opacity-70` 相当 |
| `text-slate-800` / `text-slate-700` | `text-text` |
| `text-slate-500` / `text-slate-400` | `text-muted` / `text-subtle` |
| `bg-slate-50` | `bg-bg` |
| `bg-teal-600` | `bg-accent` |
| `bg-teal-600/10` | `bg-accent-soft` |
| `text-teal-700` | `text-accent` |
| `text-white` (アクセント塗りの上) | `text-white` のまま (accent 上の前景色) |
| `shadow-[0_4px_14px_rgba(13,148,136,0.25)]` | accent カラーの shadow に変換 — 簡易化のため `shadow-card` で十分 |

**色味のレイヤ**: アイコンチップ色は **既存 `AgentIcon` の `color` prop** に委ねる (= AgentRecord.iconColor を渡すだけ)。ハンドオフの purpose 別塗り分けロジックは持ち込まない。

### 3.6 マイクロインタラクション

- **一覧 → チャット画面フェード**: 既存 `view-fade` CSS animation が `chatPanel.styles.css` 系に**未定義**。**新規追加**する:

```css
/* packages/plugin/src/styles/global.css または landing 専用 module */
@keyframes view-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.cw-view-fade { animation: view-fade-in 160ms ease-out both; }
```

- **アコーディオン chevron**: `transition-transform duration-200 rotate-180` の組み合わせ (`open` 状態クラス)
- **プロンプトボタン押下**: Tailwind `active:` プレフィックスで `scale-[0.99]` + 背景 → accent + 文字 → white
- **アコーディオン展開**: 高さアニメーションは入れない (中身が短いので 0 ↔ 自然高で十分。実装簡素化)

### 3.7 アクセシビリティ

- アコーディオン行 button に `aria-expanded={open}`
- 検索ボックスに `aria-label="エージェントを検索"`
- 行内の button にはツールチップ的 `title` は不要 (テキストが本文)
- カラーコントラスト: accent 塗り (`bg-accent`) 上の白文字は AA 通過 (`--cw-accent` = teal-600 系)

---

## 4. ChatPanel への組込み

### 4.1 配置箇所

[ChatPanel.tsx:369](../../packages/plugin/src/desktop/ChatPanel.tsx#L369) の以下の分岐を差し替える:

```tsx
{messages.length === 0 && sessionId === null ? (
  <WelcomeMessage />          // ← 現状
) : (
  <MessageList ... />
)}
```

↓

```tsx
{messages.length === 0 && sessionId === null ? (
  builtInAgents.length > 0 ? (
    <PresetAgentLanding
      agents={builtInAgents}
      onSelectPrompt={handlePresetPromptSelect}
      onSelectAgentForFreeInput={handlePresetAgentForFreeInput}
    />
  ) : (
    <WelcomeMessage />        // bootstrap 未完了 / 失敗時のフォールバック
  )
) : (
  <MessageList ... />
)}
```

`showConnectButton` の判定は変更しない (= 未バインド時は依然として `<ConnectKintoneButton />` が優先表示される)。

### 4.2 ハンドラ実装

#### 4.2.1 `handlePresetPromptSelect`

```tsx
const handlePresetPromptSelect = useCallback(
  async (agent: AgentRecord, prompt: string) => {
    // 1. エージェント切替 (異なる場合のみ)
    if (agent.id !== currentAgentId) {
      const ctx = getCurrentSessionContext();
      selectAgent(agent.id, ctx);
      // selectAgent 内部で startNewConversation() が呼ばれ messages がクリアされる
    }
    // 2. 通常の handleSubmit と同経路で送信
    await handleSubmit(prompt);
  },
  [currentAgentId, handleSubmit],
);
```

**呼出順序の安全性**:
- `selectAgent()` は同期 (localStorage 書込 + zustand setState)。完了直後に `handleSubmit` を呼んでよい
- `handleSubmit` は `useChatStore.getState()` で最新 state を読むので、setState がフラッシュされている必要はない
- `handleSubmit` 内 `ensureSession()` は最新 `currentAgentId` で session を作る (`useSession.ts:177` `state.currentAgentId ?? ctx.agentId`)

#### 4.2.2 `handlePresetAgentForFreeInput`

```tsx
const handlePresetAgentForFreeInput = useCallback(
  (agent: AgentRecord) => {
    if (agent.id !== currentAgentId) {
      const ctx = getCurrentSessionContext();
      selectAgent(agent.id, ctx);
    }
    // Composer にフォーカス (詳細は §4.3)
    composerRef.current?.focus();
  },
  [currentAgentId],
);
```

### 4.3 Composer のフォーカス機構

現状 `Composer` は `useRef` 公開を持たない。最小変更で実現するため:

**選択肢 A (採用)**: `Composer` に `ref` 転送と `focus()` メソッドを追加 (`forwardRef + useImperativeHandle`)。
- 影響: `Composer.tsx` の signature 変更 1 箇所のみ
- テスト容易性: `ref.current.focus()` を直接呼べる

**選択肢 B (不採用)**: グローバルイベント (`window.dispatchEvent`) で通知。
- 影響面が広がる、テストしづらい

→ **A を採用**。

### 4.4 OAuth 未連携時の動作

既存 `WelcomeMessage` と同じく **main 領域 (空状態 UI) は出し続け、Composer 領域のみ `<ConnectKintoneButton />` に置換** する (= showConnectButton の判定は現状維持。main 領域には引き続き `PresetAgentLanding` が描画される)。

PresetAgentLanding が表示された状態で未連携のままクイックアクションが押された場合、既存 `handleSubmit` 内の `bindingStatus === 'unbound' | 'error'` 分岐により `pendingText` に保留され、Connect 完了後に送信される (AC-17 を素直に満たす)。

---

## 5. quickActions の persistence 詳細

### 5.1 Built-in 経路

```
BUILTIN_AGENT_SPECS[purpose].quickActions
        │
        ▼
useSession.ts: agentToRecord(agent, purpose)
        │   spec.quickActions をそのまま AgentRecord に載せる
        ▼
chatStore.setBuiltInAgents(records)
        ▼
ChatPanel.builtInAgents (Zustand)
        ▼
<PresetAgentLanding agents={builtInAgents} />
```

→ Anthropic API へは quickActions を送らない。spec を直接消費。

### 5.2 Custom 経路 (将来用、Phase 1 では UI 未実装でも復元側は対応)

```
admin が AgentDetailModal で編集
        │
        ▼  保存時:
agentDetailApi.update(agent, { metadata: { ..., quickActions: JSON.stringify(arr) } })
        │
        ▼
Anthropic 側 Agent.metadata.quickActions に永続化
        ▼  list 時:
agentRecord.ts: agentToRecord(agent)
        │   parseSamplePrompts(meta.quickActions) で復元
        ▼
AgentRecord.quickActions: readonly string[]
```

`parseSamplePrompts` の挙動:
```ts
function parseSamplePrompts(raw: string | undefined): readonly string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === 'string' && s.length > 0);
    }
  } catch { /* silent */ }
  return [];
}
```

---

## 6. AgentDetailModal の編集 UI

### 6.1 UI

「クイックアクション (0〜5 個)」セクションを既存セクション群の下に追加。

```
┌─ クイックアクション ─────────────────────────────┐
│ 業務ユーザーがチャットパネルを開いた瞬間に並ぶ        │
│ 「すぐ押せる」ボタンの文言。1 行 1 プロンプト、空行無視。│
│ 最大 5 個。                                       │
│                                                 │
│ ┌──────────────────────────────────────────┐    │
│ │ kintone アプリ一覧を見せて                │    │
│ │ 先週追加された案件レコードを集計して       │    │
│ │ ...                                       │    │
│ └──────────────────────────────────────────┘    │
│                                                 │
│  ⚠ 5 個を超えています                            │ (バリデーション時)
└─────────────────────────────────────────────────┘
```

### 6.2 バリデーション

| 条件 | 動作 |
|---|---|
| 空行 | 無視 (= count しない、配列に入れない) |
| 同一行重複 | 重複は許可 (admin 判断) |
| 行数 > 5 | エラー表示 + 保存ボタン disabled |
| 1 行 > 200 文字 | エラー表示 + 保存ボタン disabled |
| 全体 (JSON.stringify) > 1024 byte | エラー表示 (5 個 × 200 字で十分余裕。例外的なケースのみ) |

### 6.3 編集 draft への載せ方

`AgentEditDraft` (既存) に `quickActions: string[]` を追加。modal 内部では `quickActionsText: string` (textarea 用) を別フィールドで保持し、`onChange` で `split('\n').map(trim).filter(Boolean)` をかけて `quickActions` に反映。

### 6.4 保存パス

`agentDetailApi.ts:updateAgent` が組み立てる metadata に `quickActions: JSON.stringify(draft.quickActions)` を追加。空配列は **空文字列ではなく `"[]"`** として保存 (parseSamplePrompts 側で空配列に戻る)。空配列でも key を残すか削除するかは:
- **削除する** (= 空のときは metadata key 自体を含めない)。理由: metadata の容量を節約 / `[]` と未設定の区別をしない

---

## 7. 既存テストへの影響と更新方針

7 ファイルが `AgentRecord` リテラルを直接構築している:

```
packages/plugin/src/store/chatStore.test.ts
packages/plugin/src/desktop/Header.test.tsx
packages/plugin/src/desktop/hooks/useCurrentAgentPurpose.test.ts
packages/plugin/src/desktop/settings/SettingsViewBound.test.tsx
packages/plugin/src/desktop/settings/AgentsListPane.test.tsx
packages/plugin/src/desktop/settings/AgentDetailModal.test.tsx
packages/plugin/src/core/skills/resolveBundledSkillIds.test.ts  (※skill 側で AgentRecord は使っていない、grep 誤検出)
```

**更新方針**:
- すべてのリテラルに `quickActions: []` を追加 (テスト本体の意図に quickActions は無関係なので空配列で十分)
- 既存 `makeAgent({ ... })` 系ヘルパー (e.g. `AgentsListPane.test.tsx`) がある場合はヘルパーのデフォルトに `quickActions: []` を仕込めば一括対応できる
- AgentDetailModal.test.tsx だけは quickActions セクションの動作テスト (バリデーション / 保存) を新規追加

`resolveBuiltInAgents.test.ts` / `builtInAgents.test.ts` は spec カタログを参照する側なので、spec 拡張の単体テスト (quickActions が 3 variant に存在することを assert) を追加。

---

## 8. 新規テスト戦略

### 8.1 `PresetAgentLanding.test.tsx`

| ID | シナリオ |
|---|---|
| T1 | 3 エージェントが渡され、isDefault のものが初期展開される |
| T2 | 別の行ヘッダーをクリックすると、それまで開いていた行は閉じる (排他) |
| T3 | プロンプトボタン押下で `onSelectPrompt(agent, promptText)` が 1 回呼ばれる |
| T4 | プロンプト 0 個の行を展開すると「自由入力で話しかける」CTA が出る |
| T5 | CTA 押下で `onSelectAgentForFreeInput(agent)` が呼ばれる (`onSelectPrompt` は呼ばれない) |
| T6 | エージェント 1 個のみ → SinglePresetView レイアウト (アコーディオン chrome なし) |
| T7 | エージェント 7 個 → 検索ボックスが自動表示される |
| T8 | 検索ボックスに入力すると名前 + desc に対する部分一致で filter される |
| T9 | visibility=private のエージェントは一覧に出ない |
| T10 | プロンプトボタンの `aria-expanded` / `role="listbox"` などのアクセシビリティ |

### 8.2 ChatPanel 統合テスト (`ChatPanel.test.tsx` 追記)

| ID | シナリオ |
|---|---|
| I1 | builtInAgents が空のとき WelcomeMessage が出る (フォールバック維持) |
| I2 | builtInAgents 3 件、messages 空、sessionId null のとき PresetAgentLanding が出る |
| I3 | プロンプト押下 → `selectAgent` (異なる場合) + `handleSubmit` 呼出 |
| I4 | 同じエージェントのプロンプト押下では `selectAgent` を呼ばない |
| I5 | 押下後、messages に user メッセージが追加され、PresetAgentLanding が消える |
| I6 | OAuth 未連携時は ConnectKintoneButton が優先表示され、PresetAgentLanding は出ない |
| I7 | 「自由入力で話しかける」CTA で Composer にフォーカスが移る (jsdom focus 検証) |

### 8.3 単体テスト (型 / 変換ロジック)

- `agentRecord.test.ts` に `parseSamplePrompts` の境界ケースを追加 (空文字 / 不正 JSON / 配列内非文字列混入 / 空文字列要素フィルタ)
- `builtInAgents.test.ts` に 3 variant 全てに `quickActions.length >= 4` を assert

---

## 9. 段階的ロールアウト

V1 リリース時点で**全 admin に自動有効化**で問題ない理由:
- フィーチャーフラグ不要 — 機能追加のみで既存ユーザーへの破壊的変更なし
- 既存ユーザーは「空状態に出ていた説明文」が「ボタン UI」に変わるだけ。Composer は引き続き使える
- フォールバック (`WelcomeMessage`) は bootstrap 失敗時に自動で出る安全装置

---

## 10. 関連 / 参照

- requirements.md (本ディレクトリ)
- Issue #45 (本要件) / #46 (配布方式は対象外)
- ハンドオフバンドル (Claude Design): `Preset Agent Panel - Prototype.html` 案 A + `handoff/*.tsx`
- 既存資産:
  - `AgentIcon` ([packages/plugin/src/desktop/components/AgentIcon.tsx](../../packages/plugin/src/desktop/components/AgentIcon.tsx))
  - `ModelBadge` ([packages/plugin/src/desktop/components/ModelBadge.tsx](../../packages/plugin/src/desktop/components/ModelBadge.tsx))
  - `AgentPicker` ([packages/plugin/src/desktop/components/AgentPicker.tsx](../../packages/plugin/src/desktop/components/AgentPicker.tsx))
  - `agentRecord.ts` ([packages/plugin/src/core/bootstrap/agentRecord.ts](../../packages/plugin/src/core/bootstrap/agentRecord.ts))
  - `useSession.ts` ([packages/plugin/src/desktop/hooks/useSession.ts](../../packages/plugin/src/desktop/hooks/useSession.ts))
