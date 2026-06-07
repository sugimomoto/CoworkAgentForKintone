# Agent ACL — 実装設計 (design.md)

> **位置付け**: [requirements.md](./requirements.md) で合意した「エージェント別の利用ユーザー絞り込み (公開先 ACL)」を、現在のコードベースにどう落とすかの実装設計。
>
> **対象 Issue**: #47
>
> **設計判断の指針**:
> - **Claude Design ハンドオフ (`AccessPicker.tsx` / `accessControl.ts`) を最大限そのまま使う**。Tailwind トークンを既存 (`bg-card` / `text-text` / `border-card-border` 等) に置換するだけで動かす
> - **既存パイプ (#45 quickActions / #48 quickActions metadata) のパターンを完全に踏襲**: AgentRecord → metadata JSON 配列文字列 → parse → 空配列 = key 削除
> - bootstrap で kintone 所属を 1 回取得して filter する純関数 `filterAgentsByAccess` に切り出す (テスト容易性)

---

## 1. 全体アーキテクチャ — 変更箇所マップ

```
┌─ kintone host (cookie auth、同一オリジン) ───────────────────────────┐
│  REST: /k/v1/users.json / /k/v1/groups.json / /k/v1/organizations.json│
│       /k/v1/user/groups.json?code=X                                   │
│       /k/v1/user/organizations.json?code=X                            │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ core/kintone/users.ts ⭐ 新規 ─────────────────────────────────────┐
│  fetchCurrentUserGroups(code) → string[]                              │
│  fetchCurrentUserOrganizations(code) → string[]                       │
│  searchUsers(query, exclude) → AccessEntry[]                          │
│  searchGroups(query, exclude) → AccessEntry[]                         │
│  searchOrganizations(query, exclude) → AccessEntry[]                  │
│  resolveAccessEntries(kind, codes) → AccessEntry[] (resolveEntries 用) │
│  (失敗時は空配列を返して致命傷にしない)                                  │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ useSession (拡張) ─────────────────────────────────────────────────┐
│  bootstrap 並列で:                                                    │
│    fetchCurrentUserGroups(kctx.kintoneUserCode)                       │
│    fetchCurrentUserOrganizations(kctx.kintoneUserCode)                │
│    resolveIsAdmin()                                                   │
│  → chatStore.currentUserAccess = { code, groups, organizations }      │
│  → chatStore.isAdmin = boolean                                        │
│  → filterAgentsByAccess(allAgents, ctx) を適用してから setBuiltInAgents│
└──────────────────────────────────────────────────────────────────────┘
                                  │              │
                ┌─────────────────┘              └─────────────────┐
                ▼                                                  ▼
┌─ chatStore (拡張) ─────────────────┐  ┌─ core/access/filterAgentsByAccess.ts ⭐│
│  currentUserAccess:                  │  │  pure: (agents, ctx) → filtered[]      │
│    { code, groups, organizations }   │  │  - admin → 全 Agent 通す               │
│    | null                            │  │  - visibility=private → 除外           │
│  isAdmin: boolean | null  (null=未解決)│  │  - 3 配列空 → 全員に通す                 │
│  builtInAgents: AgentRecord[]        │  │  - allowedUsers OR groups OR orgs      │
└──────────────────────────────────────┘  └────────────────────────────────────────┘
                                  │
                                  ▼
┌─ core/bootstrap/agentTypes.ts (拡張) ──────────────────────────────┐
│  AgentRecord に追加:                                                  │
│    allowedUsers: readonly string[]                                    │
│    allowedGroups: readonly string[]                                   │
│    allowedOrganizations: readonly string[]                            │
│  META_KEY_ALLOWED_USERS / GROUPS / ORGANIZATIONS 定数 export          │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ core/bootstrap/agentRecord.ts (拡張) ─────────────────────────────┐
│  parseAccessCodes(raw) — JSON 配列文字列 → string[] (silent fallback)│
│  agentToRecord で 3 配列を復元 (built-in は空配列固定)                  │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ core/managed-agents/agentDetailApi.ts (拡張) ──────────────────────┐
│  AgentEditDraft に 3 フィールド追加                                    │
│  mergeMetadataPatch で 3 配列を JSON 化、空配列なら key 削除             │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ AgentDetailModal (拡張) + AccessPicker ⭐ ─────────────────────────┐
│  クイックアクションと Skills の間に「公開先」セクションを追加               │
│  <AccessPicker value={draft.accessValue}                              │
│                onChange={...}                                          │
│                searchUsers={users.searchUsers}                        │
│                searchGroups={users.searchGroups}                      │
│                searchOrganizations={users.searchOrganizations}        │
│                resolveEntries={users.resolveAccessEntries} />         │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ AgentsListPane (拡張) ─────────────────────────────────────────────┐
│  各 Agent 行に formatAccessSummary(agent) のサマリ列を追加              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. データモデル変更

### 2.1 AgentRecord (agentTypes.ts)

```ts
export interface AgentRecord {
  // ... 既存
  /** 公開先 ACL — このユーザーコード集合に含まれるユーザーに見える (0 件 = 全員) */
  allowedUsers: readonly string[];
  /** 公開先 ACL — このグループコードに属するユーザーに見える */
  allowedGroups: readonly string[];
  /** 公開先 ACL — この組織コードに属するユーザーに見える */
  allowedOrganizations: readonly string[];
}

/** Anthropic Agent.metadata 上の ACL キー名 (parse / build 両側で共有)。 */
export const META_KEY_ALLOWED_USERS = 'allowedUsers';
export const META_KEY_ALLOWED_GROUPS = 'allowedGroups';
export const META_KEY_ALLOWED_ORGANIZATIONS = 'allowedOrganizations';
```

### 2.2 永続化 (Anthropic Agent.metadata)

| key | 値 |
|---|---|
| `allowedUsers` | `JSON.stringify(string[])` (例 `'["sato","tanaka"]'`) |
| `allowedGroups` | 同上 |
| `allowedOrganizations` | 同上 |

**空配列のときは key 自体を含めない** (= #48 で確立した `quickActions` と同じパターン)。

### 2.3 復元: agentRecord.ts

```ts
function parseAccessCodes(raw: string | undefined): readonly string[] {
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

`agentToRecord` の built-in / custom 両分岐に `allowedUsers / allowedGroups / allowedOrganizations` を追加:

- **Built-in**: spec カタログに ACL は持たないので **常に空配列** (= 全員に見える)
- **Custom**: `parseAccessCodes(meta[META_KEY_ALLOWED_USERS])` 等で復元

### 2.4 AgentEditDraft (agentDetailApi.ts)

```ts
export interface AgentEditDraft {
  // ... 既存
  allowedUsers: readonly string[];
  allowedGroups: readonly string[];
  allowedOrganizations: readonly string[];
}
```

`mergeMetadataPatch` に追加処理:

```ts
function setOrDelete(merged, key, arr) {
  if (arr.length > 0) merged[key] = JSON.stringify(arr);
  else delete merged[key];
}
setOrDelete(merged, META_KEY_ALLOWED_USERS, draft.allowedUsers);
setOrDelete(merged, META_KEY_ALLOWED_GROUPS, draft.allowedGroups);
setOrDelete(merged, META_KEY_ALLOWED_ORGANIZATIONS, draft.allowedOrganizations);
```

---

## 3. chatStore 拡張

### 3.1 新フィールド (Q-1, Q-2, Q-5 確定)

```ts
interface CurrentUserAccess {
  code: string;
  groups: readonly string[];
  organizations: readonly string[];
}

interface ChatStoreState {
  // ... 既存

  /** ログイン中ユーザーの ACL 判定用コンテキスト。bootstrap 完了で確定。 */
  currentUserAccess: CurrentUserAccess | null;

  /** cybozu.com 共通管理者か。null = 未解決、true/false = 解決後の値。 */
  isAdmin: boolean | null;

  setCurrentUserAccess: (next: CurrentUserAccess | null) => void;
  setIsAdminResolved: (value: boolean) => void;
}
```

- **Q-1 確定**: top-level の flat 構造 (既存 `bindingStatus` 等と同パターン)
- **Q-5 確定**: `isAdmin: null` を初期値とし、解決後に `true / false`。`null` 中は filter を **保留** (= 全 Agent を見せる、admin 解決後に再 filter)
- **Q-2 確定**: filter は `useSession` 内で適用してから `setBuiltInAgents` に渡す (= store には常に「現在のユーザー向けにフィルタ済」配列が乗る)
  - admin が `null → true` に解決された瞬間に re-filter する必要がある → `useEffect([isAdmin, currentUserAccess])` で再計算

### 3.2 reset / startNewConversation

- `reset()` で `currentUserAccess: null, isAdmin: null` も初期化
- `startNewConversation()` ではこれらは変更しない (= ログイン状態は維持)

---

## 4. filter 関数 — `core/access/filterAgentsByAccess.ts` (新規)

```ts
import type { AgentRecord } from '../bootstrap/agentTypes';

export interface AccessContext {
  code: string;
  groups: readonly string[];
  organizations: readonly string[];
}

/**
 * Agent を ACL に従って絞り込む純関数。
 * - admin (isAdmin === true) → filter なし、全 Agent 通す
 * - isAdmin === null (未解決) → filter なし (一時的に全表示、解決後に再 filter)
 * - visibility === 'private' → 常に除外
 * - 3 配列すべて空 → 全員 OK (旧挙動と後方互換)
 * - いずれか指定あり → OR 結合 (ユーザー OR グループ OR 組織)
 */
export function filterAgentsByAccess(
  agents: readonly AgentRecord[],
  ctx: AccessContext | null,
  isAdmin: boolean | null,
): AgentRecord[] {
  if (isAdmin === true || isAdmin === null) return [...agents];
  if (!ctx) return agents.filter((a) => a.visibility === 'public' && isAccessOpen(a));
  return agents.filter((a) => canAccess(a, ctx));
}

function canAccess(agent: AgentRecord, ctx: AccessContext): boolean {
  if (agent.visibility !== 'public') return false;
  if (isAccessOpen(agent)) return true;
  if (agent.allowedUsers.includes(ctx.code)) return true;
  if (agent.allowedGroups.some((g) => ctx.groups.includes(g))) return true;
  if (agent.allowedOrganizations.some((o) => ctx.organizations.includes(o))) return true;
  return false;
}

function isAccessOpen(agent: AgentRecord): boolean {
  return (
    agent.allowedUsers.length === 0 &&
    agent.allowedGroups.length === 0 &&
    agent.allowedOrganizations.length === 0
  );
}
```

純関数なので test 容易。`filterAgentsByAccess.test.ts` で 5 配列パターン × 3 軸 × admin/未解決/private を網羅。

---

## 5. kintone REST API ラッパー — `core/kintone/users.ts` (新規)

### 5.1 採用エンドポイント

| 用途 | エンドポイント | レスポンス想定 |
|---|---|---|
| 現在ユーザーの所属グループ | `GET /k/v1/user/groups.json?code=<userCode>` | `{ groups: [{ id, code, name }] }` |
| 現在ユーザーの所属組織 | `GET /k/v1/user/organizations.json?code=<userCode>` | `{ organizationTitles: [{ organization: { code, name }, title: {...} }] }` |
| ユーザー検索 | `GET /k/v1/users.json` (offset / size パラメタ) | `{ users: [{ code, name, email, ... }] }` |
| グループ検索 | `GET /k/v1/groups.json` | `{ groups: [{ code, name, ... }] }` |
| 組織検索 | `GET /k/v1/organizations.json` | `{ organizations: [{ code, name, parentCode }] }` |

**注意**: kintone REST API は `users.json` / `groups.json` / `organizations.json` で **keyword 検索を直接サポートしない** (`code` 配列で fetch するか全件取得)。Phase 1 では **全件取得 + クライアント側 substring 検索** で実装する (テナント内ユーザー数 < 1000 を想定)。

実機 shape との微差が発生したら実装中に shape guard を緩める方向で吸収。

### 5.2 API

```ts
import type { AccessEntry } from '../access/accessControl';

/** 現在ユーザーが属するグループコード一覧 (失敗時は []) */
export async function fetchCurrentUserGroups(userCode: string): Promise<string[]>;

/** 現在ユーザーが属する組織コード一覧 (失敗時は []) */
export async function fetchCurrentUserOrganizations(userCode: string): Promise<string[]>;

/** keyword で incremental search (クライアント側 substring filter)。最大 10 件、exclude 適用 */
export async function searchUsers(query: string, opts: { exclude: string[] }): Promise<AccessEntry[]>;
export async function searchGroups(query: string, opts: { exclude: string[] }): Promise<AccessEntry[]>;
export async function searchOrganizations(query: string, opts: { exclude: string[] }): Promise<AccessEntry[]>;

/** AccessPicker.resolveEntries 用: 保存済 code を name 付きに復元 */
export async function resolveAccessEntries(
  kind: 'user' | 'group' | 'org',
  codes: readonly string[],
): Promise<AccessEntry[]>;
```

### 5.3 全件キャッシュ

`searchUsers / searchGroups / searchOrganizations` 内部で **module-level Map<code, AccessEntry>** をキャッシュ。初回呼出で全件 fetch、以降は in-memory で substring filter。

```ts
let userDirectoryCache: AccessEntry[] | null = null;

async function getUserDirectory(): Promise<AccessEntry[]> {
  if (userDirectoryCache) return userDirectoryCache;
  // /k/v1/users.json を全件 fetch (offset paging)
  const all = await fetchAllPages('/k/v1/users.json', 'users');
  userDirectoryCache = all.map((u) => ({
    code: u.code,
    name: u.name,
    meta: u.email,
  }));
  return userDirectoryCache;
}
```

ページサイズ = 100 / リトライなし / 失敗時は空配列。

### 5.4 失敗時の挙動

`fetch` 失敗 / kintone runtime 不在 (Vitest) → 空配列を返す。UI 側 (`AccessPicker`) は「候補なし」状態を表示するだけで、保存済チップは保持される (ハンドオフの API エラー UX に準拠)。

### 5.5 認証

kintone REST は同一オリジン (Plugin が動いている `*.cybozu.com`) からの呼出なら **cookie 認証で自動的にスルー**。追加ヘッダ不要。

---

## 6. AccessPicker の組込 (`packages/plugin/src/desktop/settings/AccessPicker.tsx`)

### 6.1 配置

ハンドオフ `AccessPicker.tsx` をそのまま `packages/plugin/src/desktop/settings/AccessPicker.tsx` にコピー。
依存型 (`AccessValue` 等) は `packages/plugin/src/core/access/accessControl.ts` に配置。

### 6.2 トークンマッピング (Tailwind)

ハンドオフが想定する CSS 変数名と、既存 Plugin の token を以下にマップ:

| ハンドオフ | 既存 Plugin |
|---|---|
| `bg-card` / `bg-card-hi` / `bg-bg` | 既存定義通り (CSS 変数 `--cw-card` 等) |
| `border-border` / `border-card-border` | 既存 |
| `text-text` / `text-muted` / `text-subtle` | 既存 |
| `bg-accent` / `bg-accent-soft` / `text-accent` | 既存 |
| `text-on-accent` (新) | `text-white` で代用、または `--cw-on-accent: #fff` を追加 |
| `bg-[var(--axis)]/10` | そのまま採用 (Tailwind arbitrary value) |
| `bg-[color:var(--axis)]/0.10` 等 | そのまま採用 |
| `text-[color:var(--warn,#b45309)]` | `text-warn` で代用 (= 既存 `--cw-warn`) |

ハンドオフコードの `var(--color-accent, #0d9488)` / `var(--color-warn, #b45309)` のような fallback 付き参照は、既存 token 名 (`--cw-accent` 等) に書換 or fallback だけ既存値に合わせる。

### 6.3 props 連携

```tsx
import {
  searchUsers, searchGroups, searchOrganizations,
  resolveAccessEntries,
} from '../../core/kintone/users';

// AgentDetailModal 内:
<AccessPicker
  value={{
    allowedUsers: draft.allowedUsers,
    allowedGroups: draft.allowedGroups,
    allowedOrganizations: draft.allowedOrganizations,
  }}
  onChange={(next) => {
    update('allowedUsers', next.allowedUsers);
    update('allowedGroups', next.allowedGroups);
    update('allowedOrganizations', next.allowedOrganizations);
  }}
  searchUsers={searchUsers}
  searchGroups={searchGroups}
  searchOrganizations={searchOrganizations}
  resolveEntries={resolveAccessEntries}
/>
```

### 6.4 セクション配置

`AgentDetailModal.tsx` 内のセクション順:

```
1. 基本情報
2. System Prompt
3. クイックアクション (#45)
4. ⭐ 公開先 (新規)
5. Skills
6. kintone MCP Tools
```

### 6.5 ハンドオフコードに対する微修正

| 項目 | 修正内容 |
|---|---|
| import path | `./accessControl` → `../../core/access/accessControl` |
| `AccessPicker` の export 形式 | `export function` (既存 Plugin の convention に合わせ named export 維持) |
| `text-on-accent` class | 既存 token と合わせて `text-white` に置換 (または token 追加) |
| `color-accent` / `color-warn` フォールバック | `--cw-accent` / `--cw-warn` に書換 |
| イニシャル算出 (`initialOf`) | 漢字始まりが想定されるので「姓の頭文字を 1 文字」のロジックで十分 (= 既存通り) |

---

## 7. useSession の拡張

### 7.1 bootstrap での並列取得

```ts
// useSession.ts 内 (workerUrl ありの分岐)
const [set, env, customAgents, groups, organizations, adminResolved] = await Promise.all([
  resolveBuiltInAgents({ ... }),
  envPromise,
  listCustomAgents({ workerUrl, kintoneDomain: kctx.kintoneDomain }).catch(() => []),
  fetchCurrentUserGroups(kctx.kintoneUserCode).catch(() => []),
  fetchCurrentUserOrganizations(kctx.kintoneUserCode).catch(() => []),
  resolveIsAdmin().catch(() => false),
]);

setCurrentUserAccess({ code: kctx.kintoneUserCode, groups, organizations });
setIsAdminResolved(adminResolved);

const allRecords = [
  ...toAgentRecords(set),
  ...customAgents.map((a) => customAgentToRecord(a)),
];
const filtered = filterAgentsByAccess(allRecords, ctx, adminResolved);
setBuiltInAgents(filtered);
```

### 7.2 Q-5 (admin async 性のラグ抑制)

ハンドオフ前: 「全 Agent を一時的に表示 → admin 確定後に filter 再適用」だったが、上記 `Promise.all` で admin 解決も bootstrap の必須項目に含めることで **ラグそのものが発生しない**。`isAdmin: null` 状態のレンダーが事実上ない (bootstrap 中の `status === 'bootstrapping'` で UI は loading 状態)。

→ 「filter 適用→解除」の閃きは構造的に発生しない。

### 7.3 re-fetch トリガー

- 通常運用ではページリロードでのみ再取得
- Connect 後 (OAuth 完了) や Custom Agent 追加 / 削除時に builtInAgents が変化する → そのときは re-filter する必要がある
- 実装: `chatStore.upsertAgent` / `removeAgent` 内で `currentUserAccess` / `isAdmin` を見て filter したものを store にセット

→ `chatStore.upsertAgent / removeAgent` の中で filter を意識する必要がある。**設計判断**: filter は **`useSession` 内でのみ適用**し、`upsertAgent` 等は filter なしでそのまま追加する。`builtInAgents` には「現在のユーザーが見える Agent」が乗っている前提を維持する。Custom Agent 作成直後の表示 (admin が AgentDetailModal で保存した直後) も admin なので filter 免除で見える。

---

## 8. AgentsListPane の公開先サマリ

```tsx
import { formatAccessSummary } from '../../core/access/accessControl';

// AgentsListPane.tsx の各 Agent 行に追加 (テーブル列 or インライン badge):
<span data-testid={`agent-access-${a.id}`} className="text-[10.5px] text-muted">
  {formatAccessSummary({
    allowedUsers: [...a.allowedUsers],
    allowedGroups: [...a.allowedGroups],
    allowedOrganizations: [...a.allowedOrganizations],
  })}
</span>
```

「全員」は globe アイコン (`text-muted`) を併記、それ以外はテキストのみ。

---

## 9. AgentProposalBridge (Designer) との連携

`AgentProposalBridge` (= `propose_agent` 受信 → AgentDetailModal を `create-from-proposal` で開く) は ACL を含まない draft を渡してくる。**新規 Custom Agent は ACL なし (= 全員に公開) で作られる** のが自然なので:

- `AgentEditDraft` の初期値で `allowedUsers / allowedGroups / allowedOrganizations: []` を埋める
- Designer の `propose_agent` ツール schema には ACL を含めない (= Designer に ACL を考えさせない、admin が後で AccessPicker で指定)

---

## 10. 既存テストへの影響

`AgentRecord` リテラルを作っているテストファイル (#45 で `quickActions: []` を補完したもの) に同じ要領で 3 配列を補完:

```
packages/plugin/src/store/chatStore.test.ts
packages/plugin/src/desktop/Header.test.tsx
packages/plugin/src/desktop/hooks/useCurrentAgentPurpose.test.ts
packages/plugin/src/desktop/settings/SettingsViewBound.test.tsx
packages/plugin/src/desktop/settings/AgentsListPane.test.tsx
packages/plugin/src/desktop/settings/AgentDetailModal.test.tsx
packages/plugin/src/core/managed-agents/agentDetailApi.test.ts
packages/plugin/src/core/bootstrap/agentRecord.test.ts
packages/plugin/src/desktop/components/PresetAgentLanding.test.tsx
```

各 `makeAgent` / `makeBuiltInAgentRecord` ヘルパーのデフォルトに `allowedUsers: [], allowedGroups: [], allowedOrganizations: []` を追加すれば一括対応。

---

## 11. 新規テスト戦略

| ID | 対象 | 内容 |
|---|---|---|
| T1 | `filterAgentsByAccess.test.ts` | admin → 全通し / private → 除外 / 3 配列空 → 全通し / users 1 致 / groups 部分一致 / orgs 部分一致 / 全 OR 失敗 / null ctx 時のフォールバック |
| T2 | `accessControl.test.ts` | `accessCounts` / `formatAccessSummary` (案 1) / `formatAccessFull` (案 2) / `accessSummaryParts` (案 3) / `userLabel` |
| T3 | `users.test.ts` | `fetchCurrentUserGroups` (200 / 404 / runtime 不在) / `searchUsers` (キャッシュ + substring) / `resolveAccessEntries` (未知 code は除外) |
| T4 | `AccessPicker.test.tsx` | ステータスバナー表示 (全員 / 指定) / 軸カード件数バッジ / 検索 → 候補 → クリックでチップ追加 / × でチップ削除 / 重複防止 (exclude) / Enter キー追加 / API エラー時 retry / resolveEntries で初期 code 解決 |
| T5 | `agentRecord.test.ts` 追記 | parseAccessCodes の境界 (空 / 不正 JSON / 配列内 non-string) / built-in は常に空配列 |
| T6 | `useSession` 系既存テスト | `currentUserAccess` / `isAdmin` が bootstrap で set される / filter 適用後の `builtInAgents` が期待値 |

---

## 12. 関連 / 参照

- requirements.md (本ディレクトリ)
- Issue #47 (本要件) / #45 (前提: AgentRecord 拡張パターン) / #48 (前提: metadata JSON 配列保存パターン)
- Claude Design ハンドオフ: `/tmp/acl-design/design_handoff_access_control/`
- 既存資産:
  - [agentRecord.ts](../../packages/plugin/src/core/bootstrap/agentRecord.ts) — parseQuickActions と同パターン
  - [agentDetailApi.ts](../../packages/plugin/src/core/managed-agents/agentDetailApi.ts) — mergeMetadataPatch
  - [useIsAdmin.ts](../../packages/plugin/src/core/admin/useIsAdmin.ts) — resolveIsAdmin
  - [useSession.ts](../../packages/plugin/src/desktop/hooks/useSession.ts) — bootstrap
  - [AgentDetailModal.tsx](../../packages/plugin/src/desktop/settings/AgentDetailModal.tsx) — セクション追加先
  - [AgentsListPane.tsx](../../packages/plugin/src/desktop/settings/AgentsListPane.tsx) — サマリ列追加先
