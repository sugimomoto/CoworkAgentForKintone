// useCurrentAgentPurpose / isCustomizerPurpose のテスト

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useChatStore } from '../../store/chatStore';

import { isCustomizerPurpose, useCurrentAgentPurpose } from './useCurrentAgentPurpose';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';

function makeAgent(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: 'agent_a',
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
    ...overrides,
  };
}

beforeEach(() => {
  useChatStore.getState().reset();
});

describe('useCurrentAgentPurpose', () => {
  it('currentAgentId が null なら null を返す', () => {
    const { result } = renderHook(() => useCurrentAgentPurpose());
    expect(result.current).toBeNull();
  });

  it('builtInAgents から currentAgentId にマッチする purpose を返す', () => {
    useChatStore.getState().setBuiltInAgents([
      makeAgent({ id: 'biz', purpose: 'business' }),
      makeAgent({ id: 'opus', purpose: 'customizer-opus' }),
    ]);
    useChatStore.getState().setCurrentAgentId('opus');
    const { result } = renderHook(() => useCurrentAgentPurpose());
    expect(result.current).toBe('customizer-opus');
  });

  it('currentAgentId が builtInAgents に無ければ null', () => {
    useChatStore.getState().setBuiltInAgents([makeAgent({ id: 'biz' })]);
    useChatStore.getState().setCurrentAgentId('unknown');
    const { result } = renderHook(() => useCurrentAgentPurpose());
    expect(result.current).toBeNull();
  });
});

describe('isCustomizerPurpose', () => {
  it('customizer-opus / customizer-sonnet は true', () => {
    expect(isCustomizerPurpose('customizer-opus')).toBe(true);
    expect(isCustomizerPurpose('customizer-sonnet')).toBe(true);
  });

  it('business / custom / null / undefined は false', () => {
    expect(isCustomizerPurpose('business')).toBe(false);
    expect(isCustomizerPurpose('custom')).toBe(false);
    expect(isCustomizerPurpose(null)).toBe(false);
    expect(isCustomizerPurpose(undefined)).toBe(false);
  });
});
