// テスト用 fixture builder。
// Agent / Environment / Session / jsonResponse を集約して
// 各 *.test.ts の重複を排除する。

import type {
  Agent,
  Deployment,
  DeploymentRun,
  Environment,
  Session,
  Vault,
} from '../core/managed-agents/types';

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent_default',
    name: 'Cowork Agent - Default',
    model: { id: 'claude-sonnet-4-6' },
    metadata: { source: 'cowork-agent-for-kintone', type: 'default', promptVersion: 'v23' },
    created_at: '2026-04-25T00:00:00Z',
    updated_at: '2026-04-25T00:00:00Z',
    version: 1,
    type: 'agent',
    ...overrides,
  };
}

export function makeEnv(overrides: Partial<Environment> = {}): Environment {
  return {
    id: 'env_1',
    name: 'Cowork Agent - Bootstrap',
    config: { type: 'cloud' },
    metadata: { source: 'cowork-agent-for-kintone', purpose: 'bootstrap' },
    created_at: '2026-04-25T00:00:00Z',
    updated_at: '2026-04-25T00:00:00Z',
    type: 'environment',
    ...overrides,
  };
}

export function makeVault(overrides: Partial<Vault> = {}): Vault {
  return {
    id: 'vault_1',
    display_name: 'Cowork Agent - sato@example.cybozu.com',
    metadata: {
      source: 'cowork-agent-for-kintone',
      kintoneDomain: 'example.cybozu.com',
      kintoneUserCode: 'sato',
    },
    created_at: '2026-04-25T00:00:00Z',
    updated_at: '2026-04-25T00:00:00Z',
    type: 'vault',
    ...overrides,
  };
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess_1',
    agent: { id: 'agent_default', type: 'agent' },
    environment_id: 'env_1',
    vault_ids: [],
    metadata: {
      source: 'cowork-agent-for-kintone',
      kintoneDomain: 'example.cybozu.com',
      kintoneUserCode: 'sato',
      agentId: 'agent_default',
    },
    status: 'idle',
    created_at: '2026-04-25T00:00:00Z',
    updated_at: '2026-04-25T00:00:00Z',
    type: 'session',
    ...overrides,
  };
}

export function makeDeployment(overrides: Partial<Deployment> = {}): Deployment {
  return {
    id: 'depl_1',
    type: 'deployment',
    name: '毎朝の未対応集計',
    agent: { id: 'agent_default', type: 'agent', version: 1 },
    environment_id: 'env_1',
    initial_events: [
      { type: 'user.message', content: [{ type: 'text', text: '未対応の問い合わせを集計して' }] },
    ],
    schedule: {
      type: 'cron',
      expression: '0 9 * * *',
      timezone: 'Asia/Tokyo',
      last_run_at: null,
      upcoming_runs_at: ['2026-06-15T00:00:00Z'],
    },
    status: 'active',
    paused_reason: null,
    metadata: { source: 'cowork-agent-for-kintone', owner: 'sato' },
    created_at: '2026-06-14T00:00:00Z',
    updated_at: '2026-06-14T00:00:00Z',
    ...overrides,
  };
}

export function makeDeploymentRun(overrides: Partial<DeploymentRun> = {}): DeploymentRun {
  return {
    id: 'dplr_1',
    type: 'deployment_run',
    deployment_id: 'depl_1',
    session_id: 'sess_1',
    trigger_context: { type: 'scheduled' },
    error: null,
    created_at: '2026-06-14T09:00:00Z',
    ...overrides,
  };
}
