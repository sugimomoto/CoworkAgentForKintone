import { describe, it, expect, beforeEach } from 'vitest';

import {
  memoryEnabledStorageKey,
  readMemoryEnabled,
  writeMemoryEnabled,
} from './memoryEnabledStorage';

beforeEach(() => {
  localStorage.clear();
});

describe('memoryEnabledStorage (#15)', () => {
  it('未保存は既定 ON (opt-out)', () => {
    expect(readMemoryEnabled('acme.cybozu.com', 'sato')).toBe(true);
  });

  it('write→read で往復する', () => {
    writeMemoryEnabled('acme.cybozu.com', 'sato', false);
    expect(readMemoryEnabled('acme.cybozu.com', 'sato')).toBe(false);
    writeMemoryEnabled('acme.cybozu.com', 'sato', true);
    expect(readMemoryEnabled('acme.cybozu.com', 'sato')).toBe(true);
  });

  it('per-user で分離される', () => {
    writeMemoryEnabled('acme.cybozu.com', 'sato', false);
    // 別ユーザーは影響を受けず既定 ON のまま
    expect(readMemoryEnabled('acme.cybozu.com', 'tanaka')).toBe(true);
  });

  it('キーは domain × userCode を含む', () => {
    expect(memoryEnabledStorageKey('acme.cybozu.com', 'sato')).toBe(
      'cowork-agent:memory-enabled:acme.cybozu.com:sato',
    );
  });
});
