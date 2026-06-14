# 設計: Deployments (cron 定期実行) — #81

requirements.md と Claude Design ハンドオフ（[docs/design-handoff/deployments/](../../docs/design-handoff/deployments/)）を正とする。
ハンドオフは UI/UX の真値、本書は API 整合・データ変換・配線・テストの設計。

## 0. 方針サマリ
- Worker / client は改修不要（passthrough + 既定 beta header）。Plugin 側のみ実装。
- UI はハンドオフの採寸・コピーをピクセル単位で再現。`bg-[var(--cw-*)]` は既存の意味クラス
  （`bg-card` / `text-text` / `text-muted` / `border-card-border` 等）へ機械置換。
- 状態は store スライスを作らず、既存 skills と同様 Settings 層の local state + 直接 fetch。
- 「UI 視点の view-model」と「API リソース型」を**アダプタ層**で橋渡しする（`agentRecord.ts` 流儀）。

---

## 1. API 型（`core/managed-agents/types.ts` に追加）
Update Deployment 応答形（確認済み）を正に定義する。

```ts
export interface CronSchedule {
  type: 'cron';
  expression: string;                 // "分 時 日 月 曜日"
  timezone: string;                   // IANA
  last_run_at: string | null;
  upcoming_runs_at: string[];         // 次回以降（API が算出する真値・最大10秒 jitter）
}

export interface Deployment {
  id: string;
  type: 'deployment';
  name: string;
  description?: string | null;
  agent: { id: string; type: 'agent'; version?: number };
  environment_id: string;
  initial_events: DeploymentInitialEvent[];
  schedule: CronSchedule | null;
  status: 'active' | 'paused' | 'archived';
  paused_reason: { type: string } | null;
  metadata: ManagedAgentsMetadata;    // owner 等を格納
  vault_ids?: string[];
  resources?: unknown[];
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}

export interface DeploymentInitialEvent {
  type: 'user.message';
  content: Array<{ type: 'text'; text: string }>;
}

export type DeploymentRunErrorType =
  | 'environment_archived_error' | 'agent_archived_error' | 'session_rate_limited_error' | string;

export interface DeploymentRunError { type: DeploymentRunErrorType; message: string; }

export interface DeploymentRun {
  id: string;
  type: 'deployment_run';
  deployment_id: string;
  session_id: string | null;
  trigger_context: { type: 'scheduled' | 'manual' | string };
  error?: DeploymentRunError | null;
  created_at: string;
}
```

`ListResponse<T>` は既存を再利用。

---

## 2. resources.ts に追加（low-level API）
既存 `get` / `post` / `archiveAgent`（`POST /…/archive`）パターンを踏襲。`del` は無い。

```ts
// params 型は resources.ts 内に co-locate
export interface DeploymentsListParams { page?: string; }
export interface CreateDeploymentParams {
  name: string;
  agent: string | { id: string; version?: number };
  environment_id: string;
  initial_events: DeploymentInitialEvent[];
  schedule: { type: 'cron'; expression: string; timezone: string };
  metadata?: ManagedAgentsMetadata;
}
export type UpdateDeploymentParams = Partial<Omit<CreateDeploymentParams, 'agent'>> & {
  agent?: string | { id: string; version?: number };
};
export interface DeploymentRunsListParams { deployment_id: string; has_error?: boolean; page?: string; }

export const listDeployments    = (p?) => get<ListResponse<Deployment>>('/v1/deployments', p);
export const createDeployment   = (b)  => post<Deployment>('/v1/deployments', b);
export const retrieveDeployment = (id) => get<Deployment>(`/v1/deployments/${id}`);
export const updateDeployment   = (id, b) => post<Deployment>(`/v1/deployments/${id}`, b);   // 部分更新・version 不要
export const runDeployment      = (id) => apiRequest('POST', `/v1/deployments/${id}/run`, {});
export const pauseDeployment    = (id) => apiRequest('POST', `/v1/deployments/${id}/pause`, {});
export const unpauseDeployment  = (id) => apiRequest('POST', `/v1/deployments/${id}/unpause`, {});
export const archiveDeployment  = (id) => apiRequest('POST', `/v1/deployments/${id}/archive`, {});
export const listDeploymentRuns = (p)  => get<ListResponse<DeploymentRun>>('/v1/deployment_runs', p); // buildQuery が deployment_id/has_error を直列化
export const retrieveDeploymentRun = (id) => get<DeploymentRun>(`/v1/deployment_runs/${id}`);
```

> `buildQuery` は `has_error: true` を `has_error=true` に直列化できる（既存の created_at[gte] と同じ仕組み）。

---

## 3. アダプタ層 + cron ヘルパー（新規 `core/deployments/`）
ハンドオフ `deployments.ts` を **2 つに分割**して移植（純ロジックは core へ、UI は desktop へ）。

### 3.1 `core/deployments/schedule.ts`（cron 純ロジック）
ハンドオフ `deployments.ts` の cron 部分をそのまま移植: `ScheduleValue` / `PresetType` /
`buildCron` / `parseCron` / `cronHuman` / `nextRuns` / `dstRisk` / `fmtRun` / `relDay` /
`TIMEZONES` / `DEFAULT_TZ`。**変更なし**（テスト追加のみ）。

### 3.2 `core/deployments/view.ts`（view-model + アダプタ）
UI 視点の平坦な view-model と、API ↔ view の変換。

```ts
export interface DeploymentView {
  id: string;
  name: string;
  agentId: string;
  cron: string;
  tz: string;
  initialMessage: string;
  status: 'active' | 'paused';        // archived は一覧から除外
  pausedReason?: string;
  owner: string;                      // metadata.owner
  upcomingRunsAt: string[];           // API の真値
  last?: { ok: boolean; at: string; err?: RunErrorKey };
}

// API → view
export function deploymentToView(d: Deployment, lastRun?: DeploymentRun): DeploymentView;
// view draft → 作成 params（owner / environment_id / initial_events / schedule を構築）
export function draftToCreateParams(draft, ctx: { environmentId; owner }): CreateDeploymentParams;
// view draft → 更新 params（変更分のみ）
export function draftToUpdateParams(draft): UpdateDeploymentParams;

export const RUN_ERROR_MAP: Record<DeploymentRunErrorType, RunErrorKey> = {
  environment_archived_error: 'env-archived',
  agent_archived_error: 'auth',          // ※下記注記
  session_rate_limited_error: 'rate-limit',
};
export function visibleDeployments(all, role, currentUser, scope); // ハンドオフから移植
```

要点:
- **owner**: `metadata.owner`。作成時に `getCurrentSessionContext()`（[user.ts](../../packages/plugin/src/core/kintone/user.ts)）の
  ユーザーコードをセット。#47 の owner 流儀と一致。
- **次回実行**: view の `upcomingRunsAt` は **API の `schedule.upcoming_runs_at`**。一覧の「次回」表示は
  これを使う（`nextRuns()` は使わない）。`nextRuns()` は §5 モーダルのプレビュー専用。
- **直近 run**: 一覧表示用に `listDeploymentRuns({deployment_id, page: first})` の先頭1件を引いて
  `last` を作る（成否 + エラー種別）。エラー種別は `RUN_ERROR_MAP` で UI キーに丸める。
  - 注記: `agent_archived_error` はハンドオフの 4 キーに直接対応がない。`auth` に寄せるか、
    `RunErrorKey` に `agent-archived` を1つ足す（実装時に後者を採用予定 = ラベル「エージェント無効」）。

### 3.3 高レベル API ラッパ `core/managed-agents/deploymentsApi.ts`（任意・薄い）
`agentDetailApi.ts` 相当。`createDeploymentFromDraft(draft, ctx)` / `updateDeploymentFromDraft` /
`fetchDeploymentViews()`（list + 各 deployment の直近 run を束ねて view 化）をまとめる。
薄ければ Bound に直書きでも可。

---

## 4. Settings ロール出し分け（既存挙動の変更）
### 4.1 入口開放
- [ChatPanel.tsx:162](../../packages/plugin/src/desktop/ChatPanel.tsx#L162) `handleSettingsClick` の `if (isAdmin)` を撤廃し、全ユーザーが `setView('settings')` 可能に。
- [ChatPanel.tsx:297](../../packages/plugin/src/desktop/ChatPanel.tsx#L297) ヘッダへの `onSettingsClick` 受け渡しの `isAdmin` ガードを撤廃。
- [ChatPanel.tsx:340](../../packages/plugin/src/desktop/ChatPanel.tsx#L340) 非 admin リダイレクト撤廃、[397](../../packages/plugin/src/desktop/ChatPanel.tsx#L397) のレンダ条件を `view === 'settings'`（admin 問わず）に。
- `SettingsViewBound` / `SettingsView` に `isAdmin` を渡す（既に store にある）。

### 4.2 セクション出し分け（`SettingsNav.tsx` / `SettingsView.tsx`）
- `SettingsSection` に `'deployments'` 追加。`NAV_ITEMS` に時計アイコンで項目追加（`NavIcon` の union に `'clock'` 追加）。
- nav 項目を role でフィルタ: **非 admin は `deployments` のみ**。admin は全項目。
- `SettingsView` の section 初期値を role 依存に（非 admin は `'deployments'`）。
- ヘッダのサブテキストを role で出し分け（admin「全ユーザーの定期実行を管理」/ 一般「自分の定期実行」）。

> ⚠️ これは「歯車が admin 専用」という現挙動の変更。動作確認チェックリストに含める。
> Agents / Skills / MCP セクションは **admin のみ表示**（中身の権限は今回いじらない）。

---

## 5. UI コンポーネント（`desktop/settings/`）
ハンドオフ §1–7 を再現。AgentsListPane / AgentDetailModal / ConfirmDialog のパターン踏襲。

| ファイル | 役割 | 参照 |
|---|---|---|
| `DeploymentsListPane.tsx` | 一覧ペイン（PaneHeading + 新規作成 + admin スコープ pill/所有者列 + 空状態 + ユースケース3例） | §2, §2-b |
| `DeploymentRow.tsx`（Pane 内 or 分割） | 行（アイコン/名前/StatusBadge/AgentMini/スケジュール/次回/直近 run+owner/アクション） | §2 |
| `deployment-detail/DeploymentDetailModal.tsx` | 作成・編集モーダル（controlled draft、3段） | §3 |
| `deployment-detail/SchedulePicker.tsx` | ハンドオフ移植（クラスを意味クラスへ置換） | §5 |
| `deployment-detail/buildDraft.ts` / `types.ts` | draft 初期値 / mode 型（AgentDetail と同形） | §State |
| `DeploymentRunHistory.tsx` | 行→breadcrumb サブビュー（サマリ + 失敗のみ pill + run 行 + セッションリンク） | §7 |
| アーカイブ確認 | 既存 `components/ConfirmDialog` を流用（warn 強調・不可逆文言） | §6 |
| 手動実行トースト | ペイン内 absolute トースト（「履歴を開く →」） | §4 |

AgentMini / ModelBadge / AgentGlyph は既存（[AgentsListPane.tsx](../../packages/plugin/src/desktop/settings/AgentsListPane.tsx) の ModelBadge / AgentIcon）を流用。

### 配線（`SettingsViewBound.tsx`）
- `view==='settings'` で section state を持つ。`deployments` 選択時に `fetchDeploymentViews()` を呼び local state に保持。
- modal state（create/edit）を Bound が保持し `DeploymentDetailModal` を兄弟レンダ（AgentDetailModal と同形）。
- environment は modal open or 保存時に `resolveBootstrapEnvironment()` で resolve し `environment_id` に。
- callbacks: 作成/更新（保存→`draftToCreate|UpdateParams`→API→local state upsert）/ run（→トースト）/
  pause・unpause（→status 反映）/ archive（ConfirmDialog→`archiveDeployment`→list から除外）。
- role/scope: `visibleDeployments(views, isAdmin?'admin':'user', currentUserCode, scope)`。scope pill は admin のみ。

---

## 6. State Management
- store スライス新設なし。`SettingsViewBound` に `deployments: DeploymentView[]`、`scope`、`modal`、`historyOf` を local state。
- 一覧の「次回」は view.upcomingRunsAt（API 真値）。モーダルのプレビューのみ `nextRuns()`（保存前で API 応答なし）。
- 楽観更新は最小（操作後に該当 deployment を retrieve し直して upsert する素直な実装）。

---

## 7. テスト設計
- `resources` 単体（fetch mock）: 各 deployments / deployment_runs エンドポイントの URL・method・body・
  `has_error=true` クエリ直列化を assert。archive/pause/unpause/run が `POST /…/{verb}` であること。
- `schedule.ts` 単体: `buildCron` / `cronHuman`（毎日/毎週(複数曜日)/毎月/null）/ `nextRuns`（dom・dow OR）/ `dstRisk`。
- `view.ts` 単体: `deploymentToView`（owner 抽出 / upcoming / last+エラーマップ）/ `draftToCreateParams`
  （initial_events 構築 / metadata.owner / schedule）/ `visibleDeployments`（admin all/mine, user 自分のみ）。
- UI: `DeploymentsListPane`（空状態 / 行表示 / admin の所有者列・scope pill / 非 admin は自分のみ）、
  `DeploymentDetailModal`（プリセット→cron→プレビュー、custom 無効で保存 disable）、
  アーカイブ確認、トースト表示、`SettingsNav` の role 別項目数。
- fixtures: `test/fixtures.ts` に `makeDeployment` / `makeDeploymentRun` 追加。

---

## 8. 影響範囲 / リスク
- **挙動変更**: Settings 入口の非 admin 開放（要動作確認）。他は新規追加で既存機能に非破壊。
- **tz 近似**: `nextRuns()` はローカル近似。一覧は API 真値を使うので実害は薄いが、モーダルプレビューは
  概算である旨を hint で明示（または将来 date-fns-tz 導入を別タスク）。
- **直近 run の取得コスト**: 一覧で deployment ごとに run を1件引くと N+1。MVP は許容、
  必要なら後で「list 応答に last_run が含まれるか」を確認して最適化。
- 1,000 deployment 上限・archive 不可逆は UI 文言で担保。
