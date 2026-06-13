# 設計: リファクタリング Phase 3 — God ファイル分割

## 概要

requirements.md のスコープ A〜E (resolveAgent / chatStore / AgentDetailModal / SkillAddModal / ConfigScreen) を、それぞれ独立した PR として分割する実装設計。原則は「**移動のみの commit とロジック変更の commit を分ける**」「**分割先に対応するテストを先に/同時に用意する**」。

Phase 2 完了が前提 (型が core にあり、core → desktop import が ESLint で禁止され、initializeSession が抽出済みであること)。

## A. resolveAgent.ts (695 行) の分割

### 分割後の構成

```
core/bootstrap/
├── resolveAgent.ts            … resolveDefaultAgent() + その in-flight キャッシュ (legacy パス)
├── resolveBuiltInAgents.ts    … resolveBuiltInAgents() / resolveBuiltInOne() + キャッシュ (新設)
├── buildAgentTools.ts         … Default / Built-in 共通のツール定義構築 (新設)
└── findResourceByMetadata.ts  … メタデータフィルタの汎用ヘルパー (新設)
```

### findResourceByMetadata (重複解消の核)

`resolveAgent.ts` / `resolveEnvironment.ts:35-42` / `resolveVault.ts` で繰り返される「ページングしながら metadata 一致を探す」パターンを汎用化:

```typescript
export async function findResourceByMetadata<T extends { metadata?: Record<string, unknown> | null }>(
  listPage: (page: number) => Promise<{ items: T[]; hasMore: boolean }>,
  predicate: (metadata: Record<string, unknown>) => boolean,
): Promise<T | null>
```

実装時は既存 3 箇所のページング形状 (`listAgents` / `listEnvironments` / `listVaults` の戻り) を確認し、必要ならアダプタ関数をシグネチャに合わせる。**呼び出し 3 箇所の置換は挙動同一のリグレッションテストを既存テストで担保**。

### キャッシュとテスト用リセット

in-flight 重複排除キャッシュ (`_resetResolveDefaultAgentCache` 等) は各モジュールに同居させ、`@internal` JSDoc を付与する。テストの import 先を分割先に更新。

## B. chatStore.ts (561 行) の分割

### 確定: 単一ストア + スライス合成 (別ストア化はしない)

別ストア (`create()` を複数) にすると、`startNewConversation()` のような**複数領域を跨ぐアトミックなリセット**が崩れ、subscribe の整合も難しくなる。Zustand 公式の slices pattern で 1 ストアを維持しつつファイルを分ける:

```
store/
├── chatStore.ts          … create() + 全スライス合成 + 跨り操作 (startNewConversation / reset)
├── slices/
│   ├── messageSlice.ts   … messages / addMessage / mergeMessage / replaceMessage / updateTool
│   ├── sessionSlice.ts   … sessionId / agentId / status / error / isAgentRunning / lastEvent / sessionTerminated / view
│   ├── artifactSlice.ts  … artifacts / activeArtifactId / pendingCustomToolUseIds / upsert 系
│   ├── bindingSlice.ts   … vaultId / credentialId / bindingStatus / bindingError
│   ├── fileSlice.ts      … attachedFiles / add・update・remove・clear
│   └── agentSlice.ts     … builtInAgents / currentAgentId / memoryEnabled / workflowSnapshots (wedge 系)
└── utils.ts              … upsertInArray<T>(arr, item, keyOf) 等の共有ヘルパー
```

- 各 slice は `StateCreator<ChatState, [], [], SliceState>` 型で定義
- **公開 API (`useChatStore` のフィールド名・関数名) は一切変えない** — 利用側 (ChatPanel ほか 20+ 箇所) の変更はゼロ
- 配列 upsert の重複 (`upsertAgent` / `updateAttachedFile` / `saveWorkflowSnapshot` 等) は `upsertInArray` ヘルパーに集約
- テストも slice 単位に分割 (`messageSlice.test.ts` 等)。既存 `chatStore.test.ts` は跨り操作 (startNewConversation 等) のテストとして残す

## C. AgentDetailModal.tsx (1004 行) の分解

### 分割後の構成

```
desktop/settings/
├── AgentDetailModal.tsx        … モーダル枠 + フェッチ effect + 保存/削除ハンドラ (~350 行)
├── agent-detail/
│   ├── useAgentModalMode.ts    … localMode / templateId / sourceAgent 算出 (現 L106-146)
│   ├── DraftForm.tsx           … フォーム本体 (現 L420-653 のネストコンポーネントを独立)
│   ├── SkillsSection.tsx       … Skills チェックリスト
│   ├── ToolsSection.tsx        … Tools チェックリスト
│   └── QuickActionsSection.tsx … 既存 (L846-919) を同ディレクトリへ移動
desktop/components/
└── ConfirmDialog.tsx           … 汎用削除確認 (現 ConfirmDeleteOverlay L657-705 を汎用化)
```

### ConfirmDialog (Phase 4 Modal 共通化の先行成果物)

```typescript
export interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;      // default '削除'
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}
```

見た目は現 ConfirmDeleteOverlay を忠実に再現する (Phase 3 では視覚変更なし)。

### 同時に直すバグ (requirements AC-4)

フェッチ effect (現 L157-191) の依存配列から `localMode` を外し、`sourceAgent` の同一性で再フェッチを制御する。`useAgentModalMode` 抽出と同一 commit で実施し、テストで「mode 切替のみでは再フェッチしない」ことを検証。

## D. SkillAddModal.tsx (655 行) の分解

```
desktop/settings/
├── SkillAddModal.tsx           … モーダル枠 + タブ切替 + 送信 (~250 行)
├── skill-add/
│   ├── parseSkillFile.ts       … JSZip 展開 / frontmatter パース / バリデーション (core 寄りの純関数群)
│   ├── useSkillFileUpload.ts   … drag-drop 状態 + parseSkillFile 呼び出し + エラー状態
│   ├── SkillFileTab.tsx        … ファイルタブ UI
│   └── SkillTextTab.tsx        … テキストタブ UI (現ネスト TextTab を独立)
```

確定事項: ファイル処理 (`parseSkillFile.ts`) は **React 非依存の純関数**として切り出す (`File` → `Promise<CustomSkillInput>`)。バリデーションエラーは Error subclass か Result 型で表現し、ユニットテストを vitest で直接書く (これまでモーダル経由でしかテストできなかった部分)。

## E. ConfigScreen.tsx (554 行) の分解

```
config/
├── ConfigScreen.tsx               … フォーム JSX + ステップ表示 (~300 行)
├── hooks/useCloudflareDeployment.ts … deploy 状態機械 + バージョンポーリング (現 L121-171)
└── buildProxySteps.ts             … proxy 設定ステップ配列の構築 (現 handleSave 内 L191-228)
```

### 同時に直すバグ (requirements AC-4)

`useCloudflareDeployment` 内のバージョンポーリング (現 `ConfigScreen.tsx:139-144`) に `cancelled` フラグ + クリーンアップを実装し、アンマウント後の setState を防ぐ。

### buildProxySteps

```typescript
export function buildProxySteps(input: {
  clientId: string; clientSecret: string; apiKey: string; workerUrl: string;
}): ProxyStep[]
```

純関数化により「OAuth のみ / API キーのみ / 両方」の組合せをユニットテストで網羅する。

## 変更ファイル一覧 (新設のみ抜粋)

| 新設ファイル | 由来 | PR |
|---|---|---|
| `core/bootstrap/resolveBuiltInAgents.ts` / `buildAgentTools.ts` / `findResourceByMetadata.ts` | resolveAgent.ts | PR-A |
| `store/slices/*.ts` (6 slice) + `store/utils.ts` | chatStore.ts | PR-B |
| `desktop/settings/agent-detail/*` + `desktop/components/ConfirmDialog.tsx` | AgentDetailModal.tsx | PR-C |
| `desktop/settings/skill-add/*` | SkillAddModal.tsx | PR-D |
| `config/hooks/useCloudflareDeployment.ts` + `config/buildProxySteps.ts` | ConfigScreen.tsx | PR-E |

## 影響範囲

- 公開 API (store のフィールド名 / コンポーネントの props / data-testid) は不変 → E2E は無変更で green になる想定
- 見た目・文言の変更なし
- AC-4 の 2 バグ修正のみ意図的な挙動変更 (再フェッチ抑制 / unmount 後 setState 解消)

## PR 分割と順序

1. **PR-A**: resolveAgent 分割 (core のみ、UI 影響なし)
2. **PR-B**: chatStore スライス化 (公開 API 不変)
3. **PR-C**: AgentDetailModal 分解 + ConfirmDialog
4. **PR-D**: SkillAddModal 分解
5. **PR-E**: ConfigScreen 分解

A→B は順序依存なし (並行可)。C は ConfirmDialog を生むため D より先。各 PR 内の commit は「移動」→「ロジック変更」の順に分ける。
