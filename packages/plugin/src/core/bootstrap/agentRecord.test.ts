// agentRecord.ts のテスト
//
// agentToRecord による Anthropic Agent → AgentRecord 変換、特に quickActions の
// 復元 (built-in は spec カタログ / custom は metadata.quickActions JSON) を検証。

import { describe, expect, it } from 'vitest';

import { BUILTIN_AGENT_SPECS } from './builtInAgents';
import { agentToRecord } from './agentRecord';

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
});
