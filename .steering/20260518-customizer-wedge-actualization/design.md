# Customizer Wedge 実用化 — Design (Phase 1)

> **対象**: [#20 Customizer wedge 実用化](https://github.com/sugimomoto/CoworkAgentForKintone/issues/20) Phase 1
> **親**: [#44 V2 umbrella](https://github.com/sugimomoto/CoworkAgentForKintone/issues/44)
> **前提**: [requirements.md](./requirements.md) で全論点確定済 (bundle artifact / 動作テスト環境プレビュー / in-memory rollback / OAuth scope 追加 / キャンセルボタン)

---

## 1. 全体アーキテクチャ

```
┌──────────────────────────────── kintone host (record-list 画面) ────────────────────────────────┐
│                                                                                                  │
│  ┌─────────────── ChatPanel ────────────────┐    ┌─────────────── ArtifactPane ──────────────┐ │
│  │                                            │    │  ┌─FileTree (200px)─┐ ┌─Editor──────┐ │ │
│  │  Customizer Agent との会話                 │    │  │ bundle.files から  │ │ activeFile  │ │ │
│  │   ↓ create_artifact                       │    │  │ 動的構築            │ │ の content  │ │ │
│  │  ArtifactCard (id: customize-xxx)         │    │  │ ┌─ desktop.js ─⚪  │ │ を表示 / 編集│ │ │
│  │                                            │    │  │ │ (Phase 2 で複数)│ │             │ │ │
│  │                                            │    │  └────────────────────┘ └─────────────┘ │ │
│  │                                            │    │  ┌────── WorkflowFooter ─────────┐    │ │
│  │                                            │    │  │ [プレビュー][適用][キャンセル][↩] │    │ │
│  │                                            │    │  └────────────────────────────────┘    │ │
│  └────────────────────────────────────────────┘    └────────────────────────────────────────┘ │
│                                                                                                  │
│                                                       ▲                                          │
│                                                       │ apply / preview / rollback /             │
│                                                       │ cancel                                   │
└───────────────────────────────────────────────────────┼──────────────────────────────────────────┘
                                                        │
                          ┌─────────────────────────────┼─────────────────────────────┐
                          │                             │                             │
                  ┌───────▼────────┐          ┌─────────▼────────┐         ┌─────────▼────────┐
                  │ kintone REST   │          │ chatStore        │         │ /k/admin/preview │
                  │ API            │          │ workflowHistory  │         │ /<appId>/        │
                  │  file.json     │          │ (in-memory       │         │ (動作テスト環境  │
                  │  customize.json│          │  snapshot)       │         │  別タブ)         │
                  │  deploy.json   │          └──────────────────┘         └──────────────────┘
                  └────────────────┘
```

---

## 2. データ構造

### 2.1 新 Artifact kind: `kintone-customize-bundle`

```ts
// packages/plugin/src/core/artifacts/types.ts
export type ArtifactKind =
  | 'code'
  | 'markdown'
  | 'json'
  | 'mermaid'
  | 'svg'
  | 'html'
  | 'react'
  | 'csv'
  | 'binary'
  | 'kintone-customize-bundle';   // ← 新規

export type CustomizeFilePath =
  | 'desktop.js'
  | 'mobile.js'      // Phase 2 で生成解禁
  | 'desktop.css'    // Phase 2
  | 'mobile.css';    // Phase 2

export interface CustomizeBundleContent {
  files: Array<{
    path: CustomizeFilePath;
    content: string;
  }>;
}

// Artifact base interface (既存) に kind: 'kintone-customize-bundle' のとき
// content は CustomizeBundleContent を JSON.stringify した文字列で保存
// (既存 Artifact.content は string 型なので JSON 文字列として扱う)
```

### 2.2 chatStore.workflowHistory (既存継承)

```ts
// packages/plugin/src/store/chatStore.ts (既存型を継承)
interface WorkflowSnapshot {
  artifactId: string;
  appId: number;
  capturedAt: number;       // apply 直前の Date.now()
  customizeSnapshot: CustomizeJsResponse;  // GET /k/v1/preview/app/customize.json のレスポンス
  // Phase 2 で GitHub commit sha を追加予定
}

workflowHistory: Map<string, WorkflowSnapshot>;  // artifactId をキー
```

### 2.3 kintone customize.json (REST API レスポンス、§2.5.2 で確定)

```ts
interface CustomizeJsResponse {
  scope: 'ALL' | 'ADMIN' | 'NONE';
  desktop: { js: CustomizeFileEntry[]; css: CustomizeFileEntry[] };
  mobile:  { js: CustomizeFileEntry[]; css: CustomizeFileEntry[] };
  revision: string;
}

type CustomizeFileEntry =
  | { type: 'URL'; url: string }
  | { type: 'FILE'; file: { fileKey: string; name?: string; contentType?: string; size?: string } };
```

---

## 3. 主要コンポーネント設計

### 3.1 `kintoneCustomizeApi.ts` (REST API ラッパー、本実装)

**役割**: kintone REST API を呼んで preview / apply / rollback / cancel を実行する。`useApplyWorkflow` から callbacks 経由で呼ばれる。

```ts
// 簡略 API (実装スケッチ)
export interface KintoneCustomizeApi {
  /** preview: 現状の customize.json を取得し、artifact.bundle.files を merge して PUT preview */
  previewBundle(args: { artifactId: string; appId: number; bundle: CustomizeBundleContent }): Promise<void>;

  /** apply: snapshot 保存 → preview と同じ PUT → POST deploy.json (live 反映) */
  applyBundle(args: { artifactId: string; appId: number; bundle: CustomizeBundleContent }): Promise<void>;

  /** rollback: chatStore.workflowHistory から snapshot を取り出し PUT + deploy で復元 */
  rollback(args: { artifactId: string; appId: number }): Promise<void>;

  /** cancel: deploy 前に preview を破棄 (= live と同期) */
  cancelPreview(args: { appId: number }): Promise<void>;

  /** 動作テスト環境 URL を構築 */
  getPreviewUrl(appId: number): string;
}
```

**previewBundle / applyBundle 内部フロー (共通):**

```
1. (apply 時のみ) GET /k/v1/preview/app/customize.json (preview の現状)
   → revision X, 既存 customize を chatStore.workflowHistory に snapshot 保存

2. bundle.files を順次 POST /k/v1/file.json で upload
   → fileKey[] を取得

3. 既存 customize.json を bundle で merge:
   - bundle に含まれない既存 entry (URL / 別 FILE) は **そのまま保持**
   - bundle 内の path に対応する既存 entry は **置換**
   - bundle に追加された path で既存に無いものは末尾に **追加**

4. PUT /k/v1/preview/app/customize.json (revision X 指定で楽観ロック)
   → revision X+1 取得

5. (apply 時のみ) POST /k/v1/preview/app/deploy.json
   → SUCCESS まで status ポーリング (deploy.json GET)

6. 失敗時は ApiError を throw、useApplyWorkflow が state を戻す
```

**rollback 内部フロー:**
```
1. chatStore.workflowHistory.get(artifactId) で snapshot 取得
   → 無ければ「ロールバック履歴がありません (Plugin リロードで失われた可能性)」エラー

2. snapshot.customizeSnapshot を PUT /k/v1/preview/app/customize.json
3. POST /k/v1/preview/app/deploy.json → SUCCESS ポーリング
4. snapshot を Map から削除 (rollback 済)
```

**cancelPreview 内部フロー:**
```
1. POST /k/v1/preview/app/deploy.json {apps:[{app}], revert: true}
2. ポーリングは不要 (revert は即時)
```

### 3.2 `useApplyWorkflow.ts` 拡張 (state machine)

既存 5 状態 + `applied` 状態時の rollback API 経路を本実装に置換。

**state 遷移 (既存維持):**
```
ready ──[プレビュー]──▶ previewed ──[適用]──▶ applying ──▶ applied ──[ロールバック]──▶ rolled-back
            │
            └──[キャンセル]──▶ ready
```

**callbacks (新規 `cancel` 追加):**
```ts
export interface WorkflowCallbacks {
  preview: () => Promise<void>;   // previewBundle 呼出
  apply: () => Promise<void>;     // applyBundle 呼出
  rollback: () => Promise<void>;  // rollback 呼出
  cancel: () => Promise<void>;    // ← 新規 (cancelPreview 呼出)
}
```

### 3.3 `WorkflowFooter.tsx` 拡張

**`previewed` 状態時のボタン構成:**
- 既存: [適用] [↩ プレビューに戻る (no-op)]
- 新規: **[キャンセル]** ボタンを [適用] と並列で配置
  - 押下時に確認ダイアログ → cancelPreview 呼出
- 既存: [プレビューを開く] ボタン (動作テスト環境 URL を新タブで開く)
  - `getPreviewUrl(appId)` で URL 構築

**全状態のボタン:**

| state | 表示ボタン |
|---|---|
| `ready` | [プレビュー] |
| `previewed` | [動作テスト環境を開く] [適用] [キャンセル] |
| `applying` | (操作不可、spinner) |
| `applied` | [ロールバック] |
| `rolled-back` | [プレビュー] (= ready と同等、再度試せる) |

### 3.4 `FileTree.tsx` 動的化

V1 hardcoded を撤廃、props で受け取る形に。

```ts
export interface FileTreeProps {
  /** bundle.content.files から構築されたエントリ */
  files: FileTreeEntry[];
  /** 現在編集中の path */
  activeFilePath: CustomizeFilePath;
  /** ファイル選択ハンドラ */
  onSelect: (path: CustomizeFilePath) => void;
}
```

V1 の `DEFAULT_CUSTOMIZE_FILES` は削除。`ArtifactPane` 側で bundle から FileTree 用 entry を構築する責任を持つ。

**変更ステータス計算**:
- Phase 1 では「現在編集中の bundle に含まれる path」を `modified` 扱い、それ以外は表示しない
- 「kintone 上に既存だが bundle に無い customize entry」は **表示しない** (= Phase 1 では bundle が source of truth)
- Phase 2 で `useCustomizeFiles` hook 経由で kintone 既存も表示するよう拡張

### 3.5 `ArtifactPane/index.tsx` Customizer モード

```tsx
// kind=kintone-customize-bundle のときの分岐 (簡略)
function CustomizerArtifactView({ artifact }: { artifact: CustomizeBundleArtifact }) {
  const bundle = JSON.parse(artifact.content) as CustomizeBundleContent;
  const [activeFilePath, setActiveFilePath] = useState<CustomizeFilePath>(
    bundle.files[0]?.path ?? 'desktop.js'
  );
  const activeFile = bundle.files.find((f) => f.path === activeFilePath);
  const workflow = useApplyWorkflow({
    artifactId: artifact.id,
    callbacks: makeKintoneCustomizeWorkflow({ artifactId: artifact.id, appId, apiFn }),
  });

  return (
    <div className="flex h-full">
      <FileTree
        files={bundle.files.map((f) => ({ type: 'file', path: f.path, ... }))}
        activeFilePath={activeFilePath}
        onSelect={setActiveFilePath}
      />
      <div className="flex-1 flex flex-col">
        <CodeViewer content={activeFile?.content ?? ''} language={languageFromPath(activeFilePath)} />
        <WorkflowFooter state={workflow.state} onPreview={...} onApply={...} onCancel={...} onRollback={...} />
      </div>
    </div>
  );
}
```

### 3.6 `builtInAgents.ts` の Customizer Agent prompt 拡張

`CUSTOMIZER_WORKFLOW_PROMPT` を bundle artifact 規約に書き換え。Phase 1 制約 (desktop.js のみ) を明示。

```ts
const CUSTOMIZER_WORKFLOW_PROMPT = [
  '【kintone カスタマイズ生成 — bundle artifact 規約】',
  '',
  'カスタマイズ JS を生成する場合は **必ず `kind: "kintone-customize-bundle"`** で',
  '`create_artifact` を呼ぶこと。会話本文には生成した JS の解説のみ、コード本体は artifact に。',
  '',
  '【content の構造】',
  '```ts',
  'content: {',
  '  files: [',
  '    { path: "desktop.js", content: "(() => { ... })();" }',
  '  ]',
  '}',
  '```',
  '',
  '【Phase 1 制約 (重要)】',
  '- 現在は **path に "desktop.js" のみ** 含めること',
  '- mobile.js / desktop.css / mobile.css の生成は Phase 2 (#17 GitHub 連携統合) で対応予定',
  '- CSS 変更を依頼されたら「CSS 編集機能は今後のリリースで対応予定です。当面は JavaScript からスタイルを設定する方法 (例: setFieldStyle / setRowStyle / style プロパティ直接書き換え) を提案します」と案内',
  '',
  '【同じ customize を更新するとき】',
  '- 同じ artifact id を再利用 (= 同 id で再 create、新バージョンになる)',
  '- 新規 customize は別 id (例: "deal-color-v1" → 大幅変更なら "deal-color-v2")',
  '',
  '【適用フロー】',
  '- artifact 生成だけして apply はしない (admin がボタンで実施)',
  '- 影響範囲 (どのアプリ / どの画面) を artifact のコメント冒頭に明記',
  '- 安全 workflow: プレビュー (動作テスト環境) → 適用 → 必要ならロールバック',
  ...
].join('\n');
```

---

## 4. データフロー

### 4.1 admin が「商談フェーズが受注の行を黄色に」と依頼するケース

```
admin: "商談フェーズが受注の行を黄色に"
   ↓
Customizer Agent (Anthropic SSE):
   create_artifact({
     id: 'deal-color-v1',
     kind: 'kintone-customize-bundle',
     content: JSON.stringify({
       files: [{ path: 'desktop.js', content: '(() => { ... })();' }]
     })
   })
   ↓
chatStore.artifacts に CustomizeBundleArtifact が追加
   ↓
ArtifactPane が右ペインに表示:
   - FileTree: desktop.js 1 件
   - CodeViewer: desktop.js の content を表示
   - WorkflowFooter: ready 状態
   ↓
[プレビュー] 押下
   ↓
useApplyWorkflow.preview() → callbacks.preview()
   ↓
previewBundle(): file.json upload → PUT customize.json (preview)
   ↓
state: ready → previewed
   ↓
[動作テスト環境を開く] 押下 → /k/admin/preview/3/ を新タブで開く
   ↓
admin が実機確認 → OK
   ↓
[適用] 押下
   ↓
useApplyWorkflow.apply() → applying → callbacks.apply()
   ↓
applyBundle():
  - GET /k/v1/preview/app/customize.json で旧 customize 取得 → workflowHistory に snapshot
  - file.json upload (もし preview 時と異なる場合)
  - PUT customize.json
  - POST deploy.json → SUCCESS ポーリング
   ↓
state: applying → applied
   ↓
(動かなかった場合) [ロールバック] 押下
   ↓
useApplyWorkflow.rollback() → callbacks.rollback()
   ↓
rollback(): snapshot を PUT + deploy
   ↓
state: applied → rolled-back
```

### 4.2 admin が動作テスト環境を見て「やめる」判断するケース

```
[プレビュー] 押下 → previewed 状態
   ↓
[動作テスト環境を開く] → admin が実機確認 → NG
   ↓
[キャンセル] 押下 → 確認ダイアログ「動作テスト環境の変更を破棄します」
   ↓
useApplyWorkflow.cancel() → callbacks.cancel()
   ↓
cancelPreview(): POST deploy.json {revert: true}
   ↓
state: previewed → ready (workflowHistory 操作なし、snapshot 保存もまだしてない)
```

---

## 5. OAuth scope 追加と再連携 (§3.7)

### 5.1 scope 不足検出

`apiFn` (kintone REST API ラッパー) で 403 エラー時に **scope 不足判定**:

```ts
// kintoneCustomizeApi.ts 内
async function callKintoneApi(path: string, method: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, ...);
  if (res.status === 403) {
    const text = await res.text();
    if (text.includes('app_settings:write') || text.includes('file:write')) {
      throw new OAuthScopeError(['k:app_settings:write', 'k:file:write']);
    }
  }
  // ...
}
```

### 5.2 再連携 UX (V1 #28 を再利用)

`useApplyWorkflow.preview()` 内で `OAuthScopeError` を catch → V1 既存の `useUserBinding` の再連携フローをトリガー:

```ts
const handlePreview = async () => {
  try {
    await workflow.preview();
  } catch (e) {
    if (e instanceof OAuthScopeError) {
      // V1 #28 で実装済の再連携トリガー
      await triggerReauth({ additionalScopes: e.missingScopes });
      return;  // 再連携後は admin が再度プレビューを押す
    }
    throw e;
  }
};
```

V1 既存の `Header` の「OAuth 再認可」ボタンに「Customizer 用 scope」追加項目も併設。

---

## 6. ファイル変更サマリ

### 6.1 修正

| ファイル | 変更内容 |
|---|---|
| `core/artifacts/types.ts` | `kintone-customize-bundle` kind 追加、`CustomizeBundleContent` 型 |
| `chat/workflow/FileTree.tsx` | hardcoded 撤廃、props で受ける、activeFilePath ハイライト |
| `chat/workflow/kintoneCustomizeApi.ts` | mock を撤廃して本実装 (file.json upload + customize.json PUT + deploy.json POST + snapshot 保存) |
| `chat/workflow/useApplyWorkflow.ts` | `cancel` callback / state 遷移は既存維持、rollback の実 API 化 |
| `chat/workflow/WorkflowFooter.tsx` | [キャンセル] ボタン追加、[動作テスト環境を開く] ボタン追加 |
| `desktop/components/ArtifactPane/index.tsx` | kind=bundle 分岐、activeFilePath state |
| `core/bootstrap/builtInAgents.ts` | `CUSTOMIZER_WORKFLOW_PROMPT` を bundle 規約に書き換え (Phase 1 制約含む) |
| `core/oauth/scope.ts` (新規 or 既存拡張) | `k:app_settings:write` / `k:file:write` を追加 scope として定義 |

### 6.2 新規

| ファイル | 役割 |
|---|---|
| `chat/workflow/customizeApi/*.ts` | kintone REST API 呼出ヘルパー (file.json / customize.json / deploy.json) を分割 |
| `chat/workflow/CustomizerArtifactView.tsx` | bundle artifact 表示の Customizer モード (FileTree + CodeViewer + WorkflowFooter) |
| `chat/workflow/OAuthScopeError.ts` | scope 不足エラー型 |

### 6.3 既存テストの追従

| テスト | 変更内容 |
|---|---|
| `useApplyWorkflow.test.ts` | `cancel` callback 追加、rollback の挙動テスト更新 |
| `FileTree.test.tsx` | hardcoded → props ベースのテストに |
| `WorkflowFooter.test.tsx` | [キャンセル] ボタン状態のテスト追加 |
| `kintoneCustomizeApi.test.ts` | mock fetch でフルフロー (preview/apply/rollback/cancel) を網羅 |

---

## 7. テスト戦略

### 7.1 単体テスト (vitest)

- `useApplyWorkflow`: state 遷移ロジック (cancel が ready に戻る、rollback 失敗時に state 戻す、等)
- `kintoneCustomizeApi`: mock fetch で REST API 呼出順序 / 楽観ロック / エラーパス
- `FileTree`: bundle props → DOM 構築、activeFilePath ハイライト

### 7.2 統合テスト

- `ArtifactPane` + bundle artifact + WorkflowFooter の組合せで preview → apply → rollback フローを mock kintone API で実行

### 7.3 E2E (Playwright)

- 新規 `e2e/customizer-wedge.spec.ts`: テスト用 app に対して
  1. Agent との会話で bundle artifact 生成 (mock SSE)
  2. [プレビュー] → 動作テスト環境 URL が opened されることを検証 (ただし新タブ open 自体は browser API 動作なので skip 可)
  3. [適用] → 実機 kintone deploy 完了
  4. [ロールバック] → 実機 deploy 完了 (元に戻る)
  5. [キャンセル] (別ケース) → revert 完了

### 7.4 CSS sanity (既存)

- Tailwind class が specificity 競合で消えていないかの既存 spec を継続

---

## 8. リスクと対策

| Risk | 影響 | 対策 |
|---|---|---|
| R1 | OAuth 追加 scope 取得で admin が再連携に迷う | 既存 #28 UX を再利用、エラー時に明確なメッセージ |
| R2 | `apply` 中の楽観ロック競合 (他 admin が同時に customize 変更) | PUT 失敗 (revision 不一致) で「他 admin が編集中」と表示 |
| R3 | 動作テスト環境を別タブで開いたが admin がブラウザ閉じて preview のまま放置 | 「キャンセル」ボタンを明示、Header に「動作テスト環境に未適用の変更があります」バナー (任意) |
| R4 | rollback snapshot が Plugin リロードで失われた状態でロールバック試行 | エラー表示「Plugin をリロードしたためロールバック履歴が失われました。Phase 2 で永続対応予定」 |
| R5 | bundle に含まれない既存 URL タイプ entry (admin が手動登録した CDN リンク) を誤って削除 | merge ロジックで bundle に含まれない既存 entry を保持 (要 unit test) |
| R6 | file.json upload した UUID fileKey が孤児として残る | Phase 1 では cleanup しない (Phase 2 で git 連携時に管理)、容量影響は小さい |

---

## 9. オープン論点 (実装中に確定)

- bundle artifact の content 文字列 vs object: 既存 Artifact の content が string 型のため JSON.stringify で保存するが、editor に渡すときは parse が必要。型安全に扱うラッパー (`getBundle(artifact)` / `setBundle(artifact, bundle)`) を作るか
- Customizer Agent prompt で「desktop.js のみ」制約に違反して mobile.js を生成した場合の UI 挙動: warning 表示 or 黙って無視
- 動作テスト環境 URL を「新タブで開く」のは popup ブロックされる可能性 → 「リンクをクリックで開く」UX (= ボタンが anchor tag) にする

---

## 10. 次のステップ

1. **本 design.md のユーザーレビュー**
2. 確定後 → `tasklist.md` で Phase 1 のタスク分解 (各タスクは S/M で 1 PR 単位)
3. 着手 (実装 → テスト → デプロイ)
