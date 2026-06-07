// filterAgentsByAccess の単体テスト (#47)
//
// 階層判定: admin → null → private → 3 配列空 → OR 結合

import { describe, expect, it } from 'vitest';

import { filterAgentsByAccess, isAccessOpen } from './filterAgentsByAccess';

import type { AgentRecord } from '../bootstrap/agentTypes';

function makeAgent(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: 'a',
    name: 'Agent',
    model: 'sonnet',
    modelLabel: 'SONNET',
    description: '',
    purpose: 'business',
    iconKind: 'biz',
    iconColor: 'accentSoft',
    visibility: 'public',
    isDefault: false,
    source: 'builtin',
    quickActions: [],
    allowedUsers: [],
    allowedGroups: [],
    allowedOrganizations: [],
    ...overrides,
  };
}

const CTX_SATO = {
  code: 'sato',
  groups: ['sales-dept'] as readonly string[],
  organizations: ['org-tokyo'] as readonly string[],
};

describe('filterAgentsByAccess', () => {
  describe('admin 免除', () => {
    it('isAdmin=true なら private 含めて全 Agent を通す', () => {
      const agents = [
        makeAgent({ id: '1', visibility: 'public' }),
        makeAgent({ id: '2', visibility: 'private' }),
        makeAgent({ id: '3', allowedUsers: ['only-this-user'] }),
      ];
      const result = filterAgentsByAccess(agents, CTX_SATO, true);
      expect(result.map((a) => a.id)).toEqual(['1', '2', '3']);
    });
  });

  describe('admin null (未解決)', () => {
    it('一時的に全 Agent を通す (ラグ抑制)', () => {
      const agents = [
        makeAgent({ id: '1', visibility: 'public' }),
        makeAgent({ id: '2', visibility: 'private' }),
      ];
      const result = filterAgentsByAccess(agents, CTX_SATO, null);
      expect(result.map((a) => a.id)).toEqual(['1', '2']);
    });
  });

  describe('一般ユーザー (isAdmin=false)', () => {
    it('visibility=private は除外', () => {
      const agents = [
        makeAgent({ id: 'public', visibility: 'public' }),
        makeAgent({ id: 'private', visibility: 'private' }),
      ];
      const result = filterAgentsByAccess(agents, CTX_SATO, false);
      expect(result.map((a) => a.id)).toEqual(['public']);
    });

    it('3 配列空 → 全員 OK (後方互換)', () => {
      const agents = [makeAgent({ id: 'open' })];
      const result = filterAgentsByAccess(agents, CTX_SATO, false);
      expect(result.map((a) => a.id)).toEqual(['open']);
    });

    it('allowedUsers 一致で通す', () => {
      const agents = [
        makeAgent({ id: 'hit', allowedUsers: ['sato'] }),
        makeAgent({ id: 'miss', allowedUsers: ['tanaka'] }),
      ];
      const result = filterAgentsByAccess(agents, CTX_SATO, false);
      expect(result.map((a) => a.id)).toEqual(['hit']);
    });

    it('allowedGroups いずれか一致で通す', () => {
      const agents = [
        makeAgent({ id: 'hit', allowedGroups: ['sales-dept'] }),
        makeAgent({ id: 'miss', allowedGroups: ['marketing'] }),
      ];
      const result = filterAgentsByAccess(agents, CTX_SATO, false);
      expect(result.map((a) => a.id)).toEqual(['hit']);
    });

    it('allowedOrganizations いずれか一致で通す', () => {
      const agents = [
        makeAgent({ id: 'hit', allowedOrganizations: ['org-tokyo'] }),
        makeAgent({ id: 'miss', allowedOrganizations: ['org-osaka'] }),
      ];
      const result = filterAgentsByAccess(agents, CTX_SATO, false);
      expect(result.map((a) => a.id)).toEqual(['hit']);
    });

    it('3 軸とも非該当 → 除外', () => {
      const agents = [
        makeAgent({
          id: 'block',
          allowedUsers: ['other'],
          allowedGroups: ['marketing'],
          allowedOrganizations: ['org-osaka'],
        }),
      ];
      const result = filterAgentsByAccess(agents, CTX_SATO, false);
      expect(result).toEqual([]);
    });

    it('OR 結合: 1 軸でも一致すれば通す (グループ + 組織 ともに非該当だがユーザー一致)', () => {
      const agents = [
        makeAgent({
          id: 'hit',
          allowedUsers: ['sato'],
          allowedGroups: ['marketing'],
          allowedOrganizations: ['org-osaka'],
        }),
      ];
      const result = filterAgentsByAccess(agents, CTX_SATO, false);
      expect(result.map((a) => a.id)).toEqual(['hit']);
    });
  });

  describe('ctx=null (kintone API 失敗時)', () => {
    it('isAdmin=false + ctx=null → 3 配列空の public のみ通す (保守的)', () => {
      const agents = [
        makeAgent({ id: 'open', visibility: 'public' }),
        makeAgent({ id: 'restricted', visibility: 'public', allowedUsers: ['sato'] }),
        makeAgent({ id: 'private', visibility: 'private' }),
      ];
      const result = filterAgentsByAccess(agents, null, false);
      expect(result.map((a) => a.id)).toEqual(['open']);
    });
  });
});

describe('isAccessOpen', () => {
  it('3 配列空 → true', () => {
    expect(isAccessOpen(makeAgent())).toBe(true);
  });
  it('いずれか指定 → false', () => {
    expect(isAccessOpen(makeAgent({ allowedUsers: ['x'] }))).toBe(false);
    expect(isAccessOpen(makeAgent({ allowedGroups: ['x'] }))).toBe(false);
    expect(isAccessOpen(makeAgent({ allowedOrganizations: ['x'] }))).toBe(false);
  });
});
