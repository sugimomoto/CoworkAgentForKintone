import { describe, expect, it } from 'vitest';

import {
  binaryArtifactIdFromFileId,
  getBundleContent,
  parseCreateArtifactInput,
  serializeBundleContent,
  type Artifact,
} from './types';

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

describe('kintone-customize-bundle (#20 V2 Phase 1)', () => {
  it('parseCreateArtifactInput は kintone-customize-bundle を受け付ける', () => {
    const content = serializeBundleContent({
      files: [{ path: 'desktop.js', content: 'console.log(1);' }],
    });
    const r = parseCreateArtifactInput({
      id: 'cust-1',
      kind: 'kintone-customize-bundle',
      title: 'bundle 1',
      content,
    });
    expect(r).not.toBeNull();
    expect(r!.kind).toBe('kintone-customize-bundle');
  });

  function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
    return {
      id: 'x',
      kind: 'kintone-customize-bundle',
      title: 't',
      content: '',
      createdAt: 0,
      updatedAt: 0,
      version: 1,
      ...overrides,
    };
  }

  it('getBundleContent は valid な JSON を parse して files を返す', () => {
    const a = makeArtifact({
      content: serializeBundleContent({
        files: [
          { path: 'desktop.js', content: 'JS' },
          { path: 'desktop.css', content: 'CSS' },
        ],
      }),
    });
    const b = getBundleContent(a);
    expect(b?.files).toHaveLength(2);
    expect(b?.files[0]).toEqual({ path: 'desktop.js', content: 'JS' });
    expect(b?.files[1]).toEqual({ path: 'desktop.css', content: 'CSS' });
  });

  it('kind 不一致なら null', () => {
    const a = makeArtifact({ kind: 'code', content: 'foo' });
    expect(getBundleContent(a)).toBeNull();
  });

  it('壊れた JSON は null', () => {
    const a = makeArtifact({ content: 'not a json' });
    expect(getBundleContent(a)).toBeNull();
  });

  it('files が配列でない場合は null', () => {
    const a = makeArtifact({ content: JSON.stringify({ files: 'oops' }) });
    expect(getBundleContent(a)).toBeNull();
  });

  it('未知の path は skip して valid な entry のみ返す', () => {
    const a = makeArtifact({
      content: JSON.stringify({
        files: [
          { path: 'desktop.js', content: 'ok' },
          { path: 'foo.bar', content: 'invalid path' },
          { path: 'mobile.css', content: 'ok2' },
        ],
      }),
    });
    const b = getBundleContent(a);
    expect(b?.files).toHaveLength(2);
    expect(b?.files.map((f) => f.path)).toEqual(['desktop.js', 'mobile.css']);
  });

  it('serialize → parse のラウンドトリップ', () => {
    const original = {
      files: [
        { path: 'desktop.js' as const, content: 'A' },
        { path: 'mobile.js' as const, content: 'B' },
      ],
    };
    const a = makeArtifact({ content: serializeBundleContent(original) });
    expect(getBundleContent(a)).toEqual(original);
  });
});
