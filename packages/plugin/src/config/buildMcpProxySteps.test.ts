import { describe, expect, it } from 'vitest';

import { buildMcpProxySteps } from './buildMcpProxySteps';

const WORKER_ROOT = 'https://w.example.com/';

describe('buildMcpProxySteps', () => {
  it('none / bearer は空', () => {
    expect(
      buildMcpProxySteps({ server: { id: 's', authType: 'none' }, clientSecret: '', workerRootUrl: WORKER_ROOT }),
    ).toEqual([]);
    expect(
      buildMcpProxySteps({ server: { id: 's', authType: 'bearer' }, clientSecret: 'x', workerRootUrl: WORKER_ROOT }),
    ).toEqual([]);
  });

  it('oauth public(none) は secret 不要なので空', () => {
    expect(
      buildMcpProxySteps({
        server: { id: 's', authType: 'oauth', tokenEndpointAuthType: 'none', clientId: 'c', tokenEndpoint: 'https://e/t' },
        clientSecret: '',
        workerRootUrl: WORKER_ROOT,
      }),
    ).toEqual([]);
  });

  it('oauth post は非対応なので空', () => {
    expect(
      buildMcpProxySteps({
        server: { id: 's', authType: 'oauth', tokenEndpointAuthType: 'post', clientId: 'c', tokenEndpoint: 'https://e/t' },
        clientSecret: 'secret',
        workerRootUrl: WORKER_ROOT,
      }),
    ).toEqual([]);
  });

  it('oauth basic + secret: token_endpoint と per-server upsert URL の2ステップ', () => {
    const steps = buildMcpProxySteps({
      server: {
        id: 'srv1',
        authType: 'oauth',
        tokenEndpointAuthType: 'basic',
        clientId: 'cid',
        tokenEndpoint: 'https://idp.example.com/token',
      },
      clientSecret: 'sec',
      workerRootUrl: WORKER_ROOT,
    });
    expect(steps).toHaveLength(2);
    // 1. token endpoint に Basic 注入
    expect(steps[0]?.url).toBe('https://idp.example.com/token');
    expect(steps[0]?.headers.Authorization).toBe(`Basic ${btoa('cid:sec')}`);
    // 2. per-server upsert URL に client_id/secret 注入
    expect(steps[1]?.url).toBe('https://w.example.com/credentials/upsert/srv1');
    expect(steps[1]?.headers['X-Mcp-OAuth-Client-Secret']).toBe('sec');
    expect(steps[1]?.headers['X-Mcp-OAuth-Client-Id']).toBe('cid');
  });

  it('secret 未入力なら空（更新時に空欄据え置き）', () => {
    expect(
      buildMcpProxySteps({
        server: { id: 's', authType: 'oauth', tokenEndpointAuthType: 'basic', clientId: 'c', tokenEndpoint: 'https://e/t' },
        clientSecret: '',
        workerRootUrl: WORKER_ROOT,
      }),
    ).toEqual([]);
  });
});
