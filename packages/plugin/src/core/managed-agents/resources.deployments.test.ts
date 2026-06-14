import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeDeployment } from '../../test/fixtures';

import {
  archiveDeployment,
  createDeployment,
  listDeploymentRuns,
  listDeployments,
  pauseDeployment,
  runDeployment,
  unpauseDeployment,
  updateDeployment,
} from './resources';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function lastCall(): { url: string; init: RequestInit } {
  const c = fetchMock.mock.calls.at(-1)!;
  return { url: c[0] as string, init: c[1] as RequestInit };
}

describe('listDeployments', () => {
  it('GET /v1/deployments', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [], next_page: null }));
    await listDeployments();
    const { url, init } = lastCall();
    expect(url).toBe('https://api.anthropic.com/v1/deployments');
    expect(init.method).toBe('GET');
  });
});

describe('createDeployment', () => {
  it('POST /v1/deployments に body を送る', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeDeployment()));
    await createDeployment({
      name: 'x',
      agent: 'agent_1',
      environment_id: 'env_1',
      initial_events: [{ type: 'user.message', content: [{ type: 'text', text: 'hi' }] }],
      schedule: { type: 'cron', expression: '0 9 * * *', timezone: 'Asia/Tokyo' },
      metadata: { owner: 'sato' },
    });
    const { url, init } = lastCall();
    expect(url).toBe('https://api.anthropic.com/v1/deployments');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.schedule.expression).toBe('0 9 * * *');
    expect(body.metadata.owner).toBe('sato');
  });
});

describe('updateDeployment', () => {
  it('POST /v1/deployments/{id} に部分 body (version 不要)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeDeployment()));
    await updateDeployment('depl_1', {
      schedule: { type: 'cron', expression: '0 8 * * 1', timezone: 'Asia/Tokyo' },
    });
    const { url, init } = lastCall();
    expect(url).toBe('https://api.anthropic.com/v1/deployments/depl_1');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.version).toBeUndefined();
    expect(body.schedule.expression).toBe('0 8 * * 1');
  });
});

describe('lifecycle verbs は POST /v1/deployments/{id}/{verb}', () => {
  it.each([
    ['run', runDeployment],
    ['pause', pauseDeployment],
    ['unpause', unpauseDeployment],
    ['archive', archiveDeployment],
  ] as const)('%s', async (verb, fn) => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await fn('depl_1');
    const { url, init } = lastCall();
    expect(url).toBe(`https://api.anthropic.com/v1/deployments/depl_1/${verb}`);
    expect(init.method).toBe('POST');
  });
});

describe('listDeploymentRuns', () => {
  it('deployment_id と has_error をクエリに直列化', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [], next_page: null }));
    await listDeploymentRuns({ deployment_id: 'depl_1', has_error: true });
    const { url } = lastCall();
    expect(url).toContain('/v1/deployment_runs');
    expect(url).toContain('deployment_id=depl_1');
    expect(url).toContain('has_error=true');
  });
});
