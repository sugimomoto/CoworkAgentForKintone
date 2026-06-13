// agentRecord.ts のテスト
//
// agentToRecord による Anthropic Agent → AgentRecord 変換、特に quickActions の
// 復元 (built-in は spec カタログ / custom は metadata.quickActions JSON) を検証。

import { describe, expect, it } from 'vitest';

import { agentToRecord } from './agentRecord';
import { BUILTIN_AGENT_SPECS } from './builtInAgents';

import type { Agent } from '../managed-agents/types';

function makeAgent(overrides: Partial<Agent> & { metadata?: Record<string, string> }): Agent {
  return {
    id: 'agent_test',
    name: 'test agent',
    description: 'test',
    model: 'claude-sonnet-4-6',
    version: 1,
    workspace_id: 'ws',
    created_at: '2026-06-06T00:00:00Z',
    updated_at: '2026-06-06T00:00:00Z',
    ...overrides,
  } as Agent;
}

describe('agentToRecord — quickActions の復元', () => {
  describe('built-in agent (metadata.purpose=business/customizer-*)', () => {
    it('purpose=business の場合、spec.quickActions を継承する', () => {
      const record = agentToRecord(
        makeAgent({ metadata: { purpose: 'business' } }),
      );
      expect(record.source).toBe('builtin');
      expect(record.quickActions).toEqual(BUILTIN_AGENT_SPECS.business.quickActions);
    });

    it('purpose=customizer-opus の場合、spec.quickActions を継承する', () => {
      const record = agentToRecord(
        makeAgent({ metadata: { purpose: 'customizer-opus' } }),
      );
      expect(record.quickActions).toEqual(
        BUILTIN_AGENT_SPECS['customizer-opus'].quickActions,
      );
    });

    it('purpose=customizer-sonnet の場合、spec.quickActions を継承する', () => {
      const record = agentToRecord(
        makeAgent({ metadata: { purpose: 'customizer-sonnet' } }),
      );
      expect(record.quickActions).toEqual(
        BUILTIN_AGENT_SPECS['customizer-sonnet'].quickActions,
      );
    });

    it('built-in は metadata.quickActions を無視する (spec が source-of-truth)', () => {
      const record = agentToRecord(
        makeAgent({
          metadata: {
            purpose: 'business',
            quickActions: JSON.stringify(['IGNORED']),
          },
        }),
      );
      expect(record.quickActions).toEqual(BUILTIN_AGENT_SPECS.business.quickActions);
      expect(record.quickActions).not.toContain('IGNORED');
    });
  });

  describe('custom agent (metadata.purpose=custom or 未設定)', () => {
    it('metadata.quickActions が JSON 配列文字列なら復元する', () => {
      const record = agentToRecord(
        makeAgent({
          metadata: {
            purpose: 'custom',
            quickActions: JSON.stringify(['a', 'b', 'c']),
          },
        }),
      );
      expect(record.source).toBe('custom');
      expect(record.quickActions).toEqual(['a', 'b', 'c']);
    });

    it('metadata.quickActions が未設定なら空配列', () => {
      const record = agentToRecord(makeAgent({ metadata: { purpose: 'custom' } }));
      expect(record.quickActions).toEqual([]);
    });

    it('不正な JSON は silent に空配列フォールバック', () => {
      const record = agentToRecord(
        makeAgent({
          metadata: { purpose: 'custom', quickActions: '{not json' },
        }),
      );
      expect(record.quickActions).toEqual([]);
    });

    it('配列以外の JSON 値も空配列フォールバック', () => {
      const record = agentToRecord(
        makeAgent({
          metadata: { purpose: 'custom', quickActions: JSON.stringify({ foo: 1 }) },
        }),
      );
      expect(record.quickActions).toEqual([]);
    });

    it('配列内の非文字列要素は除外される', () => {
      const record = agentToRecord(
        makeAgent({
          metadata: {
            purpose: 'custom',
            quickActions: JSON.stringify(['a', 123, null, 'b', { x: 1 }, 'c']),
          },
        }),
      );
      expect(record.quickActions).toEqual(['a', 'b', 'c']);
    });

    it('空文字列要素は除外される', () => {
      const record = agentToRecord(
        makeAgent({
          metadata: { purpose: 'custom', quickActions: JSON.stringify(['a', '', 'b']) },
        }),
      );
      expect(record.quickActions).toEqual(['a', 'b']);
    });

    it('空文字列の metadata 値は空配列フォールバック', () => {
      const record = agentToRecord(
        makeAgent({ metadata: { purpose: 'custom', quickActions: '' } }),
      );
      expect(record.quickActions).toEqual([]);
    });
  });

  describe('#47 公開先 ACL (allowedUsers / allowedGroups / allowedOrganizations)', () => {
    it('built-in は常に 3 配列が空', () => {
      const record = agentToRecord(
        makeAgent({
          metadata: {
            purpose: 'business',
            // 仮に metadata に入っていても built-in は無視 (spec が source-of-truth)
            allowedUsers: JSON.stringify(['IGNORED']),
          },
        }),
      );
      expect(record.allowedUsers).toEqual([]);
      expect(record.allowedGroups).toEqual([]);
      expect(record.allowedOrganizations).toEqual([]);
    });

    it('custom: 3 軸とも metadata から復元', () => {
      const record = agentToRecord(
        makeAgent({
          metadata: {
            purpose: 'custom',
            allowedUsers: JSON.stringify(['sato', 'tanaka']),
            allowedGroups: JSON.stringify(['sales-dept']),
            allowedOrganizations: JSON.stringify(['org-tokyo']),
          },
        }),
      );
      expect(record.allowedUsers).toEqual(['sato', 'tanaka']);
      expect(record.allowedGroups).toEqual(['sales-dept']);
      expect(record.allowedOrganizations).toEqual(['org-tokyo']);
    });

    it('custom: 未設定 / 不正 JSON / 配列外の値はすべて空配列フォールバック', () => {
      const record = agentToRecord(
        makeAgent({
          metadata: {
            purpose: 'custom',
            allowedUsers: '{not json',
            allowedGroups: JSON.stringify({ foo: 1 }),
            // allowedOrganizations 未設定
          },
        }),
      );
      expect(record.allowedUsers).toEqual([]);
      expect(record.allowedGroups).toEqual([]);
      expect(record.allowedOrganizations).toEqual([]);
    });

    it('custom: 配列内の non-string 要素は除外', () => {
      const record = agentToRecord(
        makeAgent({
          metadata: {
            purpose: 'custom',
            allowedUsers: JSON.stringify(['sato', 123, null, 'tanaka', {}]),
          },
        }),
      );
      expect(record.allowedUsers).toEqual(['sato', 'tanaka']);
    });
  });
});
