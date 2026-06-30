import { describe, expect, it } from 'vitest';

import {
  attachHeadState,
  buildRedirectUri,
  canSaveServerDef,
  connectLabel,
  isHttpsUrl,
  maskedSecret,
  needsClientSecret,
  type McpServerDef,
} from './registry';

describe('isHttpsUrl', () => {
  it('https のみ true', () => {
    expect(isHttpsUrl('https://example.com/mcp')).toBe(true);
    expect(isHttpsUrl('http://example.com')).toBe(false);
    expect(isHttpsUrl('not a url')).toBe(false);
    expect(isHttpsUrl('')).toBe(false);
  });
});

describe('buildRedirectUri', () => {
  it('workerUrl から /oauth/callback を組む（末尾スラッシュ吸収）', () => {
    expect(buildRedirectUri('https://w.example.com')).toBe('https://w.example.com/oauth/callback');
    expect(buildRedirectUri('https://w.example.com/')).toBe('https://w.example.com/oauth/callback');
  });
});

describe('maskedSecret', () => {
  it('指定数の伏字を返す', () => {
    expect(maskedSecret(4)).toBe('●●●●');
    expect(maskedSecret()).toHaveLength(16);
  });
});

describe('needsClientSecret', () => {
  it('oauth かつ basic|post のとき true', () => {
    expect(needsClientSecret({ authType: 'oauth', tokenEndpointAuthType: 'basic' })).toBe(true);
    expect(needsClientSecret({ authType: 'oauth', tokenEndpointAuthType: 'post' })).toBe(true);
    expect(needsClientSecret({ authType: 'oauth', tokenEndpointAuthType: 'none' })).toBe(false);
    expect(needsClientSecret({ authType: 'bearer' })).toBe(false);
    expect(needsClientSecret({ authType: 'none' })).toBe(false);
  });
});

describe('canSaveServerDef', () => {
  it('none: name + https url で保存可', () => {
    expect(canSaveServerDef({ name: 'X', url: 'https://e.com', authType: 'none' })).toBe(true);
    expect(canSaveServerDef({ name: '', url: 'https://e.com', authType: 'none' })).toBe(false);
    expect(canSaveServerDef({ name: 'X', url: 'http://e.com', authType: 'none' })).toBe(false);
  });

  it('oauth public(none): endpoints + clientId で保存可（secret 不要）', () => {
    const base: Partial<McpServerDef> = {
      name: 'X',
      url: 'https://e.com',
      authType: 'oauth',
      authorizationEndpoint: 'https://e.com/auth',
      tokenEndpoint: 'https://e.com/token',
      clientId: 'cid',
      tokenEndpointAuthType: 'none',
    };
    expect(canSaveServerDef(base)).toBe(true);
    expect(canSaveServerDef({ ...base, clientId: '' })).toBe(false);
    expect(canSaveServerDef({ ...base, tokenEndpoint: 'http://e.com/token' })).toBe(false);
  });

  it('oauth confidential(basic): secret 未保存かつ未入力なら不可、入力 or 保存済なら可', () => {
    const base: Partial<McpServerDef> = {
      name: 'X',
      url: 'https://e.com',
      authType: 'oauth',
      authorizationEndpoint: 'https://e.com/auth',
      tokenEndpoint: 'https://e.com/token',
      clientId: 'cid',
      tokenEndpointAuthType: 'basic',
    };
    expect(canSaveServerDef(base)).toBe(false);
    expect(canSaveServerDef({ ...base, _secretEntered: true })).toBe(true);
    expect(canSaveServerDef({ ...base, hasSecret: true })).toBe(true);
  });
});

describe('attachHeadState', () => {
  const all = ['a', 'b', 'c'];
  it('null / subset 空 = off', () => {
    expect(attachHeadState(null, all)).toBe('off');
    expect(attachHeadState({ serverId: 's', mode: 'subset', enabledTools: [] }, all)).toBe('off');
  });
  it('mode=all は常に on（ツール一覧未取得でも）', () => {
    expect(attachHeadState({ serverId: 's', mode: 'all', enabledTools: [] }, all)).toBe('on');
    expect(attachHeadState({ serverId: 's', mode: 'all', enabledTools: [] }, [])).toBe('on');
  });
  it('subset 全 = on / 一部 = indeterminate', () => {
    expect(attachHeadState({ serverId: 's', mode: 'subset', enabledTools: all }, all)).toBe('on');
    expect(attachHeadState({ serverId: 's', mode: 'subset', enabledTools: ['a'] }, all)).toBe('indeterminate');
  });
});

describe('connectLabel', () => {
  it('oauth は「認可して接続」、他は「接続」', () => {
    expect(connectLabel('oauth')).toBe('認可して接続');
    expect(connectLabel('bearer')).toBe('接続');
    expect(connectLabel('none')).toBe('接続');
  });
});
