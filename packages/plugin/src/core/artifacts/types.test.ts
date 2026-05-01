import { describe, expect, it } from 'vitest';

import { binaryArtifactIdFromFileId, parseCreateArtifactInput } from './types';

describe('parseCreateArtifactInput', () => {
  it('markdown は id / kind / title / content が揃えば通る', () => {
    const r = parseCreateArtifactInput({
      id: 'doc',
      kind: 'markdown',
      title: 'doc',
      content: '# hi',
    });
    expect(r).not.toBeNull();
    expect(r!.kind).toBe('markdown');
    expect(r!.content).toBe('# hi');
  });

  it('content が空なら null', () => {
    expect(
      parseCreateArtifactInput({ id: 'a', kind: 'markdown', title: 't', content: '' }),
    ).toBeNull();
  });

  it('未知の kind は null', () => {
    expect(
      parseCreateArtifactInput({ id: 'a', kind: 'unknown', title: 't', content: 'x' }),
    ).toBeNull();
  });

  it('binary kind は Agent から作成不可 (Files API 経路で plugin 側生成のため)', () => {
    expect(
      parseCreateArtifactInput({ id: 'a', kind: 'binary', title: 't', content: 'x' }),
    ).toBeNull();
  });
});

describe('binaryArtifactIdFromFileId', () => {
  it('file_id を `file:` prefix 付きの artifact id に変換する', () => {
    expect(binaryArtifactIdFromFileId('file_abc123')).toBe('file:file_abc123');
  });
});
