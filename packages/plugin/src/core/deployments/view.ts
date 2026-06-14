// Deployments の view-model とアダプタ層。
// API リソース型 (入れ子) ↔ UI 視点の平坦な DeploymentView を橋渡しする (agentRecord.ts 流儀)。

import { buildCron, DEFAULT_TZ, type ScheduleValue } from './schedule';

import type {
  CreateDeploymentParams,
  UpdateDeploymentParams,
} from '../managed-agents/resources';
import type {
  Deployment,
  DeploymentRun,
  DeploymentRunErrorType,
} from '../managed-agents/types';

/** Deployment の owner を格納する metadata キー (#47 の owner 流儀)。 */
export const META_KEY_OWNER = 'owner';

// ── エラー種別 ───────────────────────────────────────────────
export type RunErrorKey = 'env-archived' | 'agent-archived' | 'rate-limit' | 'timeout' | 'auth';

export const RUN_ERRORS: Record<RunErrorKey, { label: string; hint: string }> = {
  'env-archived': {
    label: '環境アーカイブ済',
    hint: '対象アプリ環境がアーカイブされています。環境を復元するか宛先を変更してください。',
  },
  'agent-archived': {
    label: 'エージェント無効',
    hint: '対象エージェントがアーカイブ/削除されています。エージェントを復元してください。',
  },
  'rate-limit': {
    label: 'レート制限',
    hint: 'モデルの同時実行上限に達しました。時刻をずらすと回避できます。',
  },
  timeout: {
    label: 'タイムアウト',
    hint: '実行が制限時間を超過しました。初回メッセージの範囲を絞ってください。',
  },
  auth: {
    label: '認証エラー',
    hint: 'MCP サーバーの接続が切れています。設定 → MCP で再接続してください。',
  },
};

/** API の error.type → UI の RunErrorKey。未知の type は 'timeout' に丸める。 */
export function mapRunError(type: DeploymentRunErrorType): RunErrorKey {
  switch (type) {
    case 'environment_archived_error':
      return 'env-archived';
    case 'agent_archived_error':
      return 'agent-archived';
    case 'session_rate_limited_error':
      return 'rate-limit';
    default:
      return 'timeout';
  }
}

// ── view-model ───────────────────────────────────────────────
export interface DeploymentLastRun {
  ok: boolean;
  at: string; // ISO (表示時に整形)
  err?: RunErrorKey;
  sessionId?: string | null;
}

export interface DeploymentView {
  id: string;
  name: string;
  agentId: string;
  cron: string;
  tz: string;
  initialMessage: string;
  status: 'active' | 'paused';
  pausedReason?: string;
  owner: string;
  /** API が算出する次回以降の発火 (真値)。一覧の「次回」表示はこれを使う。 */
  upcomingRunsAt: string[];
  last?: DeploymentLastRun;
}

function firstMessageText(d: Deployment): string {
  const ev = d.initial_events?.[0];
  const part = ev?.content?.find((c) => c.type === 'text');
  return part?.text ?? '';
}

/** API Deployment → DeploymentView。lastRun があれば直近 run の成否を畳み込む。 */
export function deploymentToView(d: Deployment, lastRun?: DeploymentRun | null): DeploymentView {
  const owner = d.metadata?.[META_KEY_OWNER] ?? '';
  const view: DeploymentView = {
    id: d.id,
    name: d.name,
    agentId: d.agent.id,
    cron: d.schedule?.expression ?? '',
    tz: d.schedule?.timezone ?? DEFAULT_TZ,
    initialMessage: firstMessageText(d),
    status: d.status === 'paused' ? 'paused' : 'active',
    owner,
    upcomingRunsAt: d.schedule?.upcoming_runs_at ?? [],
  };
  if (d.paused_reason?.type) view.pausedReason = d.paused_reason.type;
  if (lastRun) {
    view.last = {
      ok: !lastRun.error,
      at: lastRun.created_at,
      sessionId: lastRun.session_id,
      ...(lastRun.error ? { err: mapRunError(lastRun.error.type) } : {}),
    };
  }
  return view;
}

// ── draft → API params ───────────────────────────────────────
export interface DeploymentDraft {
  name: string;
  agentId: string;
  initialMessage: string;
  schedule: ScheduleValue;
}

export function draftToCreateParams(
  draft: DeploymentDraft,
  ctx: { environmentId: string; owner: string },
): CreateDeploymentParams {
  return {
    name: draft.name.trim(),
    agent: draft.agentId,
    environment_id: ctx.environmentId,
    initial_events: [
      { type: 'user.message', content: [{ type: 'text', text: draft.initialMessage }] },
    ],
    schedule: {
      type: 'cron',
      expression: buildCron(draft.schedule),
      timezone: draft.schedule.tz,
    },
    metadata: { [META_KEY_OWNER]: ctx.owner },
  };
}

/** 編集時の部分更新 params。owner / environment は据え置き。 */
export function draftToUpdateParams(draft: DeploymentDraft): UpdateDeploymentParams {
  return {
    name: draft.name.trim(),
    agent: draft.agentId,
    initial_events: [
      { type: 'user.message', content: [{ type: 'text', text: draft.initialMessage }] },
    ],
    schedule: {
      type: 'cron',
      expression: buildCron(draft.schedule),
      timezone: draft.schedule.tz,
    },
  };
}

// ── 権限フィルタ ─────────────────────────────────────────────
export type Role = 'admin' | 'user';

/** admin: 全件 (scope='mine' なら自分のみ) / user: 自分が作成したものだけ。 */
export function visibleDeployments(
  all: DeploymentView[],
  role: Role,
  currentUser: string,
  scope: 'all' | 'mine' = 'all',
): DeploymentView[] {
  if (role === 'user') return all.filter((d) => d.owner === currentUser);
  if (scope === 'mine') return all.filter((d) => d.owner === currentUser);
  return all;
}
