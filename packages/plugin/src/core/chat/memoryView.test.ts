import { describe, it, expect } from 'vitest';

import {
  basename,
  byteLabel,
  isStoreEmpty,
  relativeTime,
  resolveSelection,
  type MemoryStoreView,
} from './memoryView';

describe('memoryView helpers (#15)', () => {
  it('basename は末尾セグメントを返す', () => {
    expect(basename('/preferences/general.md')).toBe('general.md');
    expect(basename('a.md')).toBe('a.md');
  });

  it('byteLabel は 0 を「空」、KB/MB を整形', () => {
    expect(byteLabel(0)).toBe('空');
    expect(byteLabel(512)).toBe('512 B');
    expect(byteLabel(2150)).toBe('2.1 KB');
  });

  it('relativeTime は相対表記', () => {
    const now = new Date('2026-07-11T12:00:00Z');
    expect(relativeTime('2026-07-11T11:59:40Z', now)).toBe('たった今');
    expect(relativeTime('2026-07-11T11:30:00Z', now)).toBe('30分前');
    expect(relativeTime('2026-07-11T09:00:00Z', now)).toBe('3時間前');
  });

  it('isStoreEmpty は 0 件 or 全 0 バイトで true', () => {
    const empty: MemoryStoreView = { kind: 'preferences', label: 'x', storeId: 's', files: [] };
    const zero: MemoryStoreView = {
      kind: 'preferences',
      label: 'x',
      storeId: 's',
      files: [{ id: 'm', path: '/a.md', sizeBytes: 0, updatedAt: '' }],
    };
    const nonEmpty: MemoryStoreView = {
      kind: 'preferences',
      label: 'x',
      storeId: 's',
      files: [{ id: 'm', path: '/a.md', sizeBytes: 10, updatedAt: '' }],
    };
    expect(isStoreEmpty(empty)).toBe(true);
    expect(isStoreEmpty(zero)).toBe(true);
    expect(isStoreEmpty(nonEmpty)).toBe(false);
  });

  it('resolveSelection は storeKind + fileId から store/file を引く', () => {
    const stores: MemoryStoreView[] = [
      {
        kind: 'preferences',
        label: 'x',
        storeId: 's1',
        files: [{ id: 'm1', path: '/a.md', sizeBytes: 1, updatedAt: '' }],
      },
    ];
    expect(resolveSelection(stores, { storeKind: 'preferences', fileId: 'm1' })?.file.id).toBe('m1');
    expect(resolveSelection(stores, { storeKind: 'agent-context', fileId: 'm1' })).toBeNull();
    expect(resolveSelection(stores, null)).toBeNull();
  });
});
