import { describe, expect, it } from 'vitest';

import { makeDeployment, makeDeploymentRun } from '../../test/fixtures';

import {
  deploymentToView,
  draftToCreateParams,
  draftToUpdateParams,
  mapRunError,
  visibleDeployments,
  type DeploymentDraft,
  type DeploymentView,
} from './view';

describe('deploymentToView', () => {
  it('API 入れ子型を平坦化し owner/cron/tz/初回メッセージ/upcoming を抽出', () => {
    const v = deploymentToView(makeDeployment());
    expect(v.agentId).toBe('agent_default');
    expect(v.cron).toBe('0 9 * * *');
    expect(v.tz).toBe('Asia/Tokyo');
    expect(v.initialMessage).toBe('未対応の問い合わせを集計して');
    expect(v.owner).toBe('sato');
    expect(v.status).toBe('active');
    expect(v.upcomingRunsAt).toEqual(['2026-06-15T00:00:00Z']);
    expect(v.last).toBeUndefined();
  });

  it('paused は status=paused + pausedReason', () => {
    const v = deploymentToView(
      makeDeployment({ status: 'paused', paused_reason: { type: 'manual' } }),
    );
    expect(v.status).toBe('paused');
    expect(v.pausedReason).toBe('manual');
  });

  it('成功 run を畳み込む', () => {
    const v = deploymentToView(makeDeployment(), makeDeploymentRun());
    expect(v.last?.ok).toBe(true);
    expect(v.last?.err).toBeUndefined();
    expect(v.last?.sessionId).toBe('sess_1');
  });

  it('失敗 run はエラー種別をマップ', () => {
    const v = deploymentToView(
      makeDeployment(),
      makeDeploymentRun({
        session_id: null,
        error: { type: 'environment_archived_error', message: 'x' },
      }),
    );
    expect(v.last?.ok).toBe(false);
    expect(v.last?.err).toBe('env-archived');
  });
});

describe('mapRunError', () => {
  it('既知 type', () => {
    expect(mapRunError('environment_archived_error')).toBe('env-archived');
    expect(mapRunError('agent_archived_error')).toBe('agent-archived');
    expect(mapRunError('session_rate_limited_error')).toBe('rate-limit');
  });
  it('未知 type は timeout に丸める', () => {
    expect(mapRunError('something_else')).toBe('timeout');
  });
});

describe('draftToCreateParams', () => {
  const draft: DeploymentDraft = {
    name: '  毎朝集計  ',
    agentId: 'agent_x',
    initialMessage: '集計して',
    schedule: {
      presetType: 'daily',
      hour: 9,
      minute: 0,
      weekday: 1,
      monthday: 1,
      customCron: '',
      tz: 'Asia/Tokyo',
    },
  };

  it('initial_events / schedule / owner / environment を構築', () => {
    const p = draftToCreateParams(draft, { environmentId: 'env_9', owner: 'tanaka' });
    expect(p.name).toBe('毎朝集計'); // trim
    expect(p.agent).toBe('agent_x');
    expect(p.environment_id).toBe('env_9');
    expect(p.initial_events[0]!.content[0]!.text).toBe('集計して');
    expect(p.schedule).toEqual({ type: 'cron', expression: '0 9 * * *', timezone: 'Asia/Tokyo' });
    expect(p.metadata).toEqual({ owner: 'tanaka' });
  });

  it('draftToUpdateParams は owner/environment を含まない', () => {
    const p = draftToUpdateParams(draft);
    expect(p.metadata).toBeUndefined();
    expect(p.environment_id).toBeUndefined();
    expect(p.schedule?.expression).toBe('0 9 * * *');
  });
});

describe('visibleDeployments', () => {
  const mk = (id: string, owner: string): DeploymentView => ({
    id,
    name: id,
    agentId: 'a',
    cron: '0 9 * * *',
    tz: 'Asia/Tokyo',
    initialMessage: '',
    status: 'active',
    owner,
    upcomingRunsAt: [],
  });
  const all = [mk('1', 'sato'), mk('2', 'tanaka'), mk('3', 'sato')];

  it('user は自分の所有分のみ', () => {
    expect(visibleDeployments(all, 'user', 'sato').map((d) => d.id)).toEqual(['1', '3']);
  });
  it('admin は全件 (既定 scope=all)', () => {
    expect(visibleDeployments(all, 'admin', 'sato')).toHaveLength(3);
  });
  it('admin scope=mine は自分のみ', () => {
    expect(visibleDeployments(all, 'admin', 'tanaka', 'mine').map((d) => d.id)).toEqual(['2']);
  });
});
