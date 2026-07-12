# design.md — Anthropic Memory Stores 統合（#15 第1段: 基盤 + 2レイヤー preferences）

requirements.md の確定事項（A: 2 レイヤー両立 / B: トグル既定 ON / C: Step1 + CRUD 土台）に基づく実装設計。
API 正本: `.claude/skills/ClaudeManagedAgents/references/memory.md`。

---

## 1. 全体像

```
[Header MemoryToggle] --on/off--> chatStore.memoryEnabled (localStorage 永続, 既定 ON)
                                          │
初送信 (useSession.ensureSession) ────────┤ memoryEnabled?
                                          │   ├─ ON  → resolveMemoryResources() で 2 store を find-or-create + seed
                                          │   │         → createUserSession({ ..., resources[] })
                                          │   └─ OFF → resources 無しで createUserSession
                                          ▼
                              Anthropic Session (memory_store を /mnt/memory/<slug> に mount)
                                          ▼
                     Agent が agent_toolset(bash/read/write/glob/grep) で自律的に読み書き
```

- **ホスト側の責務**: store の存在保証（find-or-create）+ 初期 seed + session への attach のみ。
  memory の中身の読み書きは **agent が自分のツールで行う**（Step 1 ではホストからの編集 UI は無い）。
- **programmatic CRUD クライアント**（§3）は Step 1 では seed（create/list）にしか使わないが、
  Step 2（閲覧/編集 UI）で全面利用するため今回フル実装する（§requirements C）。

---

## 2. 2 レイヤーの store 設計（§6-A）

| レイヤー | kind | スコープ | access | mount 例 | 用途 |
|---|---|---|---|---|---|
| preferences | `preferences` | per-user | read_write | `/mnt/memory/<slug>/` | 口調・日付表記・全社的な業務用語エイリアス（エージェント非依存のユーザー資産） |
| agent-context | `agent-context` | per-user × agent | read_write | `/mnt/memory/<slug>/` | そのエージェント固有の学習・修正記録 |

- 1 Session に **2 store** attach（8 store 上限に対し余裕）。両方 read_write。
- mount の実 path は **resource 応答の `mount_path`** を正とする（`name`→slug 変換は自前で組まない）。
- **identity（find-or-create のキー）は `store.name`**。memory store が `metadata` を受けるかは公式未確定のため、
  name を決定的なキーにする（他リソースの metadata フィルタ相当を name で代替）。あわせて metadata も送るが依存しない。

### 2.1 store 命名（name = 一意キー）

```
preferences  : "cowork:pref:<kintoneDomain>:<kintoneUserCode>"
agent-context: "cowork:agentctx:<kintoneDomain>:<kintoneUserCode>:<agentId>"
```

- `<agentId>` は built-in variant なら安定 ID、custom agent なら agent_id。
- name は find のキー兼 mount slug 元。表示用ではないが衝突しない一意性を優先。
- description（system prompt に注入される）には人間可読の説明を入れる（例「あなたと <userCode> の個人設定。開始時に必ず確認」）。

### 2.2 seed するファイル構成（初回のみ・空 or 見出しだけ）

preferences store:
```
/preferences/general.md         # 口調 / 日付表記 / 敬語レベル
/preferences/field-aliases.md   # 「顧客名 = company_name」等の業務用語マッピング
```
agent-context store:
```
/context/notes.md               # このエージェント固有のメモ・学習
/context/past-corrections.md    # 「前回 ○○ と頼んだが △△ された」の修正記録
```
- seed は **存在チェック（list path_prefix）→ 無ければ create**。`409 memory_path_conflict_error` は無視（冪等）。
- 中身は見出し + 使い方コメントのみ（agent が埋めていく）。100kB 上限に配慮し小さく分割。

---

## 3. programmatic Memory クライアント（`core/managed-agents/memory.ts` 新設）

既存 `resources.ts` と同じく `apiRequest` の薄いラッパ。**memory store 系だけ beta ヘッダを置換**する。

```ts
import { apiRequest } from './client';

const MEMORY_BETA = 'agent-memory-2026-07-22';
const memHeaders = { 'anthropic-beta': MEMORY_BETA };

// ── Memory Store ──
export function createMemoryStore(p: { name: string; description?: string; metadata?: Record<string,string> }): Promise<MemoryStore>
  // POST /v1/memory_stores
export function listMemoryStores(p?: { include_archived?: boolean }): Promise<ListResponse<MemoryStore>>
  // GET /v1/memory_stores  （name/metadata フィルタはクライアント側）
export function retrieveMemoryStore(id: string): Promise<MemoryStore>
export function updateMemoryStore(id: string, p: { name?: string; description?: string }): Promise<MemoryStore>
export function archiveMemoryStore(id: string): Promise<void>   // 片道

// ── Memory（Store 配下）──
export function listMemories(sid: string, p?: { path_prefix?: string; depth?: 0|1; view?: 'basic'|'full'; order_by?: string }): Promise<ListResponse<Memory | MemoryPrefix>>
export function createMemory(sid: string, p: { path: string; content: string }): Promise<Memory>
export function retrieveMemory(sid: string, mid: string, p?: { view?: 'basic'|'full' }): Promise<Memory>
export function updateMemory(sid: string, mid: string, p: { content?: string; path?: string; precondition?: { type: 'content_sha256'; content_sha256: string } }): Promise<Memory>
export function deleteMemory(sid: string, mid: string): Promise<void>
```

- 全呼出に `memHeaders` を第4引数 `extraHeaders` で渡す（`apiRequest` は既に対応、`client.ts` が beta を置換）。
- 型（`MemoryStore` / `Memory` / `MemoryPrefix`）は `managed-agents/types.ts` に追加。
- エラーコード（`memory_path_conflict_error` / `memory_precondition_failed_error` / `memory_quota_exceeded_error` / `memory_content_too_large_error`）は `ApiError.code` で判別できるようにする（既存 ApiError を踏襲）。
- **Step 1 で実使用するのは** `listMemoryStores` / `createMemoryStore` / `listMemories` / `createMemory` のみ。retrieve/update/delete/archive は土台として実装 + 単体テストのみ（UI は Step 2）。

---

## 4. store 解決（`core/bootstrap/resolveMemoryStore.ts` 新設）

`resolveVault.ts` と同じ in-flight 保護 + pickOldest パターン。

```ts
export interface PreferencesStoreContext { kintoneDomain: string; kintoneUserCode: string; }
export interface AgentContextStoreContext extends PreferencesStoreContext { agentId: string; }

export async function resolveUserPreferencesStore(ctx): Promise<MemoryStore>
export async function resolveAgentContextStore(ctx): Promise<MemoryStore>
```

共通ヘルパ:
```ts
async function ensureStoreByName(name, description, seedFiles): Promise<MemoryStore> {
  const list = await listMemoryStores();               // include_archived=false
  const hit = list.data.find((s) => s.name === name && !s.archived_at);
  const store = hit ?? await createMemoryStore({ name, description, metadata });
  if (!hit) await seedMemories(store.id, seedFiles);    // 新規作成時のみ seed
  return store;
}
```
- in-flight Map（key = name）で連投時の重複作成を防ぐ。並行タブは list→create の race を pickOldest 相当（name 一致の最古）で吸収。
- `seedMemories` は各ファイルを `createMemory`、`memory_path_conflict_error` は握りつぶす（冪等）。
- **失敗時フォールバック（§8）**: store 解決に失敗しても throw せず null を返し、memory 無しで session を作る。

---

## 5. Session attach（`resolveSession.ts` + `useSession.ensureSession`）

### 5.1 `SessionContext` に resources を追加

`createUserSession`（既に `resources?: unknown[]` を持つ `createSession` を呼ぶ）に橋渡し:
```ts
export interface SessionContext {
  // ... 既存 ...
  memoryResources?: Array<{ type: 'memory_store'; memory_store_id: string; access: 'read_write'|'read_only'; instructions?: string }>;
}
// createUserSession 内: ...(memoryResources?.length ? { resources: memoryResources } : {})
```
attach は `managed-agents-2026-04-01`（＝既存 session 作成の beta のまま）。**memory beta は session 作成に付けない**。

### 5.2 `ensureSession` でトグル ON 時のみ解決

```ts
let memoryResources;
if (useChatStore.getState().memoryEnabled) {
  const [pref, agentCtx] = await Promise.all([
    resolveUserPreferencesStore({ kintoneDomain, kintoneUserCode }).catch(() => null),
    resolveAgentContextStore({ kintoneDomain, kintoneUserCode, agentId }).catch(() => null),
  ]);
  memoryResources = [pref, agentCtx].filter(Boolean).map((s) => ({
    type: 'memory_store', memory_store_id: s.id, access: 'read_write',
    instructions: INSTRUCTIONS_BY_KIND[...],
  }));
}
```
- 解決は初送信のクリティカルパスに入るため **Promise.all で並列**、かつ **失敗しても会話は続行**（catch→null）。
- instructions（≤4,096字）は kind 別の固定文言。

---

## 6. システムプロンプト + promptVersion bump

`COMMON_GUARDRAILS`（builtInAgents）と Default Agent の system prompt に「メモリ」ブロックを追記:
```
【メモリ（/mnt/memory）— 会話をまたぐ記憶】
- セッション開始時に /mnt/memory 配下（mount 情報は system が注入）を read/glob で確認し、
  口調・日付表記・業務用語・過去の修正を応答に反映する。
- ユーザーの新しい好み・業務用語・修正点が判明したら該当ファイルに追記する（小さく分割）。
- 機微情報（パスワード / API キー / 個人情報）は絶対に書き込まない。
```
- Default Agent: `DEFAULT_AGENT_PROMPT_VERSION` を bump（v20→v21）。built-in: `computeToolsVersion` は tools 変更が無いので**プロンプト版管理側**（プロンプトも版管理していれば）を bump。
  - ※ tools は変わらない（memory は session resource であって tool ではない）。built-in の再作成契機はプロンプト版。既存の版管理粒度を design 実装時に確認し、無ければ「プロンプト差分でも reconcile される版キー」を足す。
- **重要**: system prompt にメモリ利用を書いても、**トグル OFF のセッションでは store が mount されない**。その場合 agent は `/mnt/memory` が無いだけで無害（プロンプトは「あれば見る」トーン）。

---

## 7. Memory トグルの有効化（既定 ON / opt-out）

- `MemoryToggle`（現状 `enabled=false` 固定）を **enabled=true** にし、`on`/`onToggle` を配線。
- chatStore: `memoryEnabled`（既存フィールド）を **localStorage 永続**にする。
  - キー: `cowork-agent:memory-enabled:<kintoneDomain>:<kintoneUserCode>`（per-user）。既定 ON（未保存なら true）。
  - `usePanelOpenState` と同じ read/write ヘルパ（`useMemoryEnabledState` を新設 or agentSlice 拡張）。
- ChatPanel: `<Header memoryEnabled={true} memoryOn={memoryEnabled} onMemoryToggle={toggle} />`。
- **トグル変更は次回以降のセッションに反映**（attach は session 作成時のみ、途中変更不可という API 制約に一致）。
  現在の会話に即時反映はしない（UI 上「次の会話から有効」を title/hint で示す）。

---

## 8. エラーハンドリング / フォールバック

| 事象 | 挙動 |
|---|---|
| store find/create 失敗（ネットワーク/権限/quota） | catch→null。memory 無しで session 作成継続（会話は止めない）。debug ログのみ |
| seed の path 衝突（409） | 握りつぶす（冪等・既に seed 済み） |
| 8 store 上限 / quota 超過 | Step 1 は 2 store 固定なので通常起きない。起きたら memory 無しフォールバック |
| memory beta ヘッダ誤送（session に付与）| 400。→ session 作成は既存 beta のまま、memory 呼出だけ置換で回避（実装で担保 + テスト） |

原則: **memory は付加価値であり、失敗しても中核の会話体験を壊さない**（graceful degradation）。

---

## 9. セキュリティ / マルチテナント

- **per-user 分離**: name に `<kintoneDomain>:<kintoneUserCode>` を含めることで他ユーザーの store を引かない。list→name 完全一致でのみ hit。
- **secret-zero 維持**: memory CRUD は `kintone.plugin.app.proxy → api.anthropic.com` の既存経路。Anthropic キーは Cloudflare に置かない（[[no-anthropic-key-in-cloudflare]]）。
- **prompt injection**: read_write の preferences/agent-context に injection が書かれるリスク。システムプロンプトで「機微情報を書かない」を明示。共有系（Step 3 の domain context）は将来 **必ず read_only**。
- **機微情報**: 上記プロンプト + 将来の redact（Step 4）で対応。Step 1 では書き込み抑止の明示のみ。

---

## 10. 影響範囲 / 変更ファイル

新規:
- `core/managed-agents/memory.ts`（+ `memory.test.ts`）
- `core/bootstrap/resolveMemoryStore.ts`（+ test）
- （必要なら）`desktop/hooks/useMemoryEnabledState.ts`
- **Step 2**: `desktop/settings/MemorySection.tsx`（純表示）+ `MemorySectionBound.tsx`（store 解決 + CRUD 配線）+ test
- **Step 2**: （必要なら）`desktop/hooks/useMemorySection.ts`（memories 取得 + 編集/保存/削除の状態管理）

変更:
- `core/managed-agents/types.ts`（MemoryStore/Memory/MemoryPrefix 型）
- `core/managed-agents/client.ts`（beta 置換は既存 extraHeaders で対応可。確認のみ）
- `core/bootstrap/resolveSession.ts`（SessionContext.memoryResources → createSession.resources）
- `desktop/hooks/useSession.ts`（ensureSession で store 解決 + resources 構築）
- `core/bootstrap/builtInAgents.ts` / `resolveAgent.ts`（system prompt にメモリブロック + 版 bump）
- `store/chatStore.ts` / `store/slices/agentSlice.ts` / `store/types.ts`（memoryEnabled 永続化）
- `desktop/components/MemoryToggle.tsx`（enabled 有効化）
- `desktop/Header.tsx`（⚙️ gear を全ユーザーに開放 / トグル配線）
- `desktop/settings/SettingsNav.tsx`（`memory` nav 項目追加）/ `SettingsView.tsx` / `SettingsViewBound.tsx`（`SettingsSection` に `'memory'` 追加 + detail 描画 + 非 admin subtitle 微調整）
- docs/functional-design.md（§0.14 追記）

デグレ回避: 会話 / Deployments / Skills / MCP / タスク機構（#128）に影響なし。トグル OFF で完全に従来動作。

---

## 11. テスト計画

- **単体（vitest）**:
  - `memory.ts`: 各 CRUD が正しい path / beta ヘッダ（agent-memory-2026-07-22）/ body で `apiRequest` を呼ぶ（fetch mock）。
  - `resolveMemoryStore.ts`: find（name 一致で再利用・作成しない）/ create（無ければ作成 + seed）/ in-flight 重複防止 / 失敗時 null。
  - `resolveSession.ts`: memoryResources 指定時のみ `resources[]` を送る / 未指定なら送らない。
  - toggle 永続化: 既定 ON / 保存値の読み戻し。
- **結線**: ensureSession が memoryEnabled=false のとき store 解決を呼ばない / true のとき 2 store を解決して resources を渡す。
- **Step 2（vitest + testing-library）**:
  - `MemorySection`: ツリー描画（2 store × ファイル）/ ファイル選択で内容表示 / 編集→保存で `updateMemory` が precondition 付きで呼ばれる / 409 で再取得 / 削除で `deleteMemory` + ツリー再取得。
  - `MemorySectionBound`: 開いた時に resolve + list を呼ぶ / content_sha256 の保持と更新。
  - `SettingsNav`: `memory` 項目が非 admin でも出る / admin 専用項目は非 admin で出ない（既存テスト踏襲）。
  - `Header`: gear が非 admin でも表示される（開放後）。
- **E2E（任意・live）**: トグル ON で「ですます調が好み」→ 新規会話で継承（US-1）。設定→メモリで該当ファイルに反映を確認。コスト高のため手動確認 or skip 既定。
- tsc / lint / vitest / build 全緑。

---

## 13. Step 2 — メモリ閲覧/編集 UI（SettingsView 統合）

Step 1 で作った programmatic CRUD クライアント（§3）を使い、ユーザーが自分のメモリをブラウズ/編集できる **SettingsView の 1 セクション**を追加する。独立ペインではなく既存 SettingsView 骨格を流用する（右ペイン優先順位・Header 🧠 ボタンは**不要**）。**versions 履歴・rollback・redact は含めない（→ #149）**。

### 13.1 エントリポイント（非 admin も開ける Settings）

- 現状: Header の ⚙️ gear は **admin 限定**（`{isAdmin && onSettingsClick}`）で、非 admin には Settings 導線が無い（#81 の「非 admin=定期実行のみ」は UI 上到達不能）。
- **本段で gear を全ユーザーに開放**する。SettingsView / SettingsNav は既に `adminOnly` フラグで per-user フィルタ済み（非 admin には「定期実行」「メモリ」だけが出る）。副次的に #81 の非 admin 定期実行導線も開通する。
- SettingsView 見出しの subtitle は既に admin/非 admin で出し分け済み（「自分の設定を管理」系）。文言を per-user 向けに微調整。

### 13.2 SettingsNav に「メモリ」項目追加

`SettingsNav.tsx` の `NAV_ITEMS` に **per-user 項目**を追加（`定期実行` と同じ `adminOnly` 無し）:
```ts
{ id: 'memory', label: 'メモリ', iconName: 'brain', /* adminOnly なし = 全ユーザー */ }
```
- `SettingsSection` 型に `'memory'` を追加。選択で右 detail に `MemorySection` を描画。

### 13.3 `MemorySection`（新規 `desktop/settings/MemorySection.tsx` + `MemorySectionBound.tsx`）

他セクション（DeploymentsPane(Bound) / MCP）と同じ「純表示 + Bound アダプタ」二層構成。detail の中身:
```
メモリ                              自分の記憶を確認・編集
──────────────────────────────────────────────────────
個人設定（全エージェント共通）
  general.md         2.1 KB   🗑
  field-aliases.md   0.4 KB   🗑
このエージェント（○○）
  notes.md           1.2 KB   🗑
  past-corrections.md 空
──────────────────────────────────────────────────────
▼ general.md                              [編集]
  (Markdown レンダ / 編集時は textarea)     [保存][取消]
```

**データ取得フロー**（セクションを開いた時）:
1. `resolveUserPreferencesStore` + `resolveAgentContextStore`（find-or-create。開いた時点で無ければ作る=seed 済みで開く。agent-context は現在の `currentAgentId`）。
2. 各 store に `listMemories({ path_prefix:'/', depth:0, view:'basic' })` → ツリー描画（content は取らない）。
3. ファイル選択で `retrieveMemory(sid, mid, { view:'full' })` → 内容 + `content_sha256` を保持。

**編集/保存**:
- 編集 → textarea。保存 → `updateMemory(sid, mid, { content, precondition:{ type:'content_sha256', content_sha256 } })`。
- `memory_precondition_failed_error`（409）→「他で更新されました。再読込します」で retrieve し直し（clobber 防止、既存 Banner）。
- 保存成功で新しい `content_sha256` を保持し view モードに戻す。

**削除**:
- ファイル行の削除 → 確認（既存 `ConfirmDialog`）→ `deleteMemory(sid, mid)` → ツリー再取得。

**新規作成（任意・最小）**: 「+ ファイル追加」→ `createMemory`。Step 2 では省略可（agent が作るのが主）。実装時に要否判断。

### 13.4 表示・再利用

- Markdown レンダは既存の artifact markdown レンダラを再利用（`kind:'markdown'` 描画部）。
- 空 store / 空ファイルは「まだ記憶がありません」プレースホルダ。
- ローディング / エラーは他 Settings セクションと同じトーンのスケルトン/バナー。

### 13.5 セキュリティ / 制約

- 表示・編集対象は **自分の 2 store のみ**（resolve が name で本人分だけを引く）。他ユーザー store は列挙もしない。
- 編集は `content_sha256` 楽観ロックで agent との同時書き込み衝突を防ぐ。
- redact/履歴は #149。Step 2 は現行 head の CRUD のみ。
- gear 開放により非 admin が Settings を開けるようになるが、agents/skills/mcp は従来どおり `adminOnly` で非表示（デグレ無し）。

---

## 12. 未決 / 実装時に確定

- **built-in agent のプロンプト版管理**: tools 非変更でプロンプトだけ変わるケースの reconcile 契機を実装時に確認（無ければ版キー追加 or Default のみ bump + built-in は次回 tools 変更時に取り込む判断）。
- **instructions 文面**（kind 別・≤4,096字）と seed 見出しの最終文言。
- **memory store の metadata 対応可否**: create 時に metadata を送って retrieve で返るか実機確認。返らなければ name 一意キーのみに依存（設計は既にそれで成立）。
- **トグル OFF→ON 切替時の UX**: 「次の会話から有効」の hint 表示位置（Header or Composer）。
