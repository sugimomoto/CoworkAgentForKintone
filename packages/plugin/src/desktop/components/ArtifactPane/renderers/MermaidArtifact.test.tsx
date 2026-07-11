// MermaidArtifact の srcdoc 堅牢化ガード (#137 / #142)。
// iframe 内で描画するため実際のレンダリングは Playwright で別途検証しているが、
// ここでは srcdoc に「複数 CDN フォールバック / リトライ / ズーム / 初期フィット堅牢化 / CJK 埋込」が
// 含まれることを静的に保証し、退行（単一 CDN 化・ズーム喪失等）を防ぐ。

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MermaidArtifact } from './MermaidArtifact';

import type { Artifact } from '../../../../core/artifacts/types';

function makeArtifact(content: string): Artifact {
  return { id: 'mmd_1', kind: 'mermaid', title: 'ER', content, createdAt: 0, updatedAt: 0, version: 1 };
}

function srcdocOf(content: string): string {
  const { container } = render(<MermaidArtifact artifact={makeArtifact(content)} />);
  return container.querySelector('iframe')?.getAttribute('srcdoc') ?? '';
}

describe('MermaidArtifact srcdoc', () => {
  it('複数 CDN フォールバック(esm.sh→jsdelivr)＋バンドル指定を含む', () => {
    const src = srcdocOf('erDiagram\n  A { STRING x }');
    expect(src).toContain('esm.sh/mermaid@11.16.0?bundle');
    expect(src).toContain('cdn.jsdelivr.net/npm/mermaid@11.16.0/+esm');
    // esm.sh 側はキャッシュ回避リトライを併用
    expect(src).toContain('?bundle&_r=1');
  });

  it('ズーム/パン操作と初期フィット堅牢化(ResizeObserver)を含む', () => {
    const src = srcdocOf('erDiagram\n  A { STRING x }');
    expect(src).toContain('id="zin"');
    expect(src).toContain('id="zout"');
    expect(src).toContain('id="zfit"');
    expect(src).toContain('ResizeObserver');
    expect(src).toContain("addEventListener('wheel'");
    expect(src).toContain("addEventListener('pointerdown'");
  });

  it('CJK を含むグラフを srcdoc に埋め込む（v11 で描画可能）', () => {
    const src = srcdocOf('erDiagram\n  顧客管理 { STRING 会社名 }');
    expect(src).toContain('顧客管理');
    expect(src).toContain('会社名');
  });
});
