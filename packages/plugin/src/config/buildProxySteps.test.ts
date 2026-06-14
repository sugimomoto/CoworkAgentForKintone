import { describe, expect, it } from 'vitest';

import { buildProxySteps } from './buildProxySteps';

const BASE = {
  workerRootUrl: 'https://w.example.workers.dev/',
  tokenEndpoint: 'https://tenant.cybozu.com/oauth2/token',
  clientId: '',
  clientSecret: '',
  apiKey: '',
};

describe('buildProxySteps', () => {
  it('全て空なら空配列', () => {
    expect(buildProxySteps(BASE)).toEqual([]);
  });

  it('API キーのみ → Worker root の POST + GET の 2 ステップ', () => {
    const steps = buildProxySteps({ ...BASE, apiKey: 'sk-ant-x' });
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ url: BASE.workerRootUrl, method: 'POST' });
    expect(steps[0]!.headers['X-Anthropic-Api-Key']).toBe('sk-ant-x');
    expect(steps[0]!.headers['X-Kintone-OAuth-Client-Id']).toBeUndefined();
    expect(steps[1]).toMatchObject({ url: BASE.workerRootUrl, method: 'GET' });
  });

  it('OAuth のみ (API キー無し) → /oauth2/token の 1 ステップだけ', () => {
    const steps = buildProxySteps({ ...BASE, clientId: 'cid', clientSecret: 'sec' });
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ url: BASE.tokenEndpoint, method: 'POST' });
    expect(steps[0]!.headers['Authorization']).toBe(`Basic ${btoa('cid:sec')}`);
  });

  it('OAuth + API キー → token + Worker POST(client header 付き) + Worker GET の 3 ステップ', () => {
    const steps = buildProxySteps({
      ...BASE,
      clientId: 'cid',
      clientSecret: 'sec',
      apiKey: 'sk-ant-x',
    });
    expect(steps).toHaveLength(3);
    expect(steps[0]!.url).toBe(BASE.tokenEndpoint);
    const post = steps[1]!;
    expect(post.method).toBe('POST');
    expect(post.headers['X-Kintone-OAuth-Client-Id']).toBe('cid');
    expect(post.headers['X-Kintone-OAuth-Client-Secret']).toBe('sec');
    expect(steps[2]!.method).toBe('GET');
  });
});
