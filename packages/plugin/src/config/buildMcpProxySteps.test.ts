import { describe, expect, it } from 'vitest';

import { buildMcpProxySteps } from './buildMcpProxySteps';

const WORKER_ROOT = 'https://w.example.com/';
const API_KEY = 'sk-ant-test';

describe('buildMcpProxySteps', () => {
  it('none / bearer は空', () => {
    expect(
      buildMcpProxySteps({ server: { id: 's', authType: 'none' }, clientSecret: '', anthropicApiKey: API_KEY, workerRootUrl: WORKER_ROOT }),
    ).toEqual([]);
    expect(
      buildMcpProxySteps({ server: { id: 's', authType: 'bearer' }, clientSecret: 'x', anthropicApiKey: API_KEY, workerRootUrl: WORKER_ROOT }),
    ).toEqual([]);
  });

  it('oauth public(none) は token_endpoint に Content-Type だけ登録（runtime proxy 用・secret 不要）', () => {
    expect(
      buildMcpProxySteps({
        server: { id: 's', authType: 'oauth', tokenEndpointAuthType: 'none', clientId: 'c', tokenEndpoint: 'https://e/t' },
        clientSecret: '',
        anthropicApiKey: API_KEY,
        workerRootUrl: WORKER_ROOT,
      }),
    ).toEqual([
      { url: 'https://e/t', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    ]);
  });

  it('oauth post は非対応なので空', () => {
    expect(
      buildMcpProxySteps({
        server: { id: 's', authType: 'oauth', tokenEndpointAuthType: 'post', clientId: 'c', tokenEndpoint: 'https://e/t' },
        clientSecret: 'secret',
        anthropicApiKey: API_KEY,
        workerRootUrl: WORKER_ROOT,
      }),
    ).toEqual([]);
  });

  it('Anthropic キー未取得なら空（per-server URL に自己完結で載せられないため）', () => {
    expect(
      buildMcpProxySteps({
        server: { id: 's', authType: 'oauth', tokenEndpointAuthType: 'basic', clientId: 'c', tokenEndpoint: 'https://e/t' },
        clientSecret: 'secret',
        anthropicApiKey: '',
        workerRootUrl: WORKER_ROOT,
      }),
    ).toEqual([]);
  });

  it('oauth basic + secret + apiKey: token_endpoint と per-server upsert URL の2ステップ（upsert に Anthropic キーも載る）', () => {
    const steps = buildMcpProxySteps({
      server: {
        id: 'srv1',
        authType: 'oauth',
        tokenEndpointAuthType: 'basic',
        clientId: 'cid',
        tokenEndpoint: 'https://idp.example.com/token',
      },
      clientSecret: 'sec',
      anthropicApiKey: API_KEY,
      workerRootUrl: WORKER_ROOT,
    });
    expect(steps).toHaveLength(2);
    // 1. token endpoint に Basic 注入
    expect(steps[0]?.url).toBe('https://idp.example.com/token');
    expect(steps[0]?.headers.Authorization).toBe(`Basic ${btoa('cid:sec')}`);
    // 2. per-server upsert URL に Anthropic キー + client_id/secret（最長一致総取り対策で自己完結）
    expect(steps[1]?.url).toBe('https://w.example.com/credentials/upsert/srv1');
    expect(steps[1]?.headers['X-Anthropic-Api-Key']).toBe(API_KEY);
    expect(steps[1]?.headers['X-Mcp-OAuth-Client-Secret']).toBe('sec');
    expect(steps[1]?.headers['X-Mcp-OAuth-Client-Id']).toBe('cid');
  });

  it('secret 未入力なら空（更新時に空欄据え置き）', () => {
    expect(
      buildMcpProxySteps({
        server: { id: 's', authType: 'oauth', tokenEndpointAuthType: 'basic', clientId: 'c', tokenEndpoint: 'https://e/t' },
        clientSecret: '',
        anthropicApiKey: API_KEY,
        workerRootUrl: WORKER_ROOT,
      }),
    ).toEqual([]);
  });
});
