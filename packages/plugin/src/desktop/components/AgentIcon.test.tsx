// AgentIcon コンポーネントのテスト
//
// 9 glyph × 10 color × size の組み合わせで SVG が正しくレンダーされるか検証。

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AGENT_COLORS, AGENT_GLYPHS } from '../../core/bootstrap/agentTypes';

import { AgentIcon } from './AgentIcon';

describe('AgentIcon', () => {
  it('全 glyph × 全 color の組み合わせがエラーなくレンダーされる', () => {
    for (const kind of AGENT_GLYPHS) {
      for (const color of AGENT_COLORS) {
        const { unmount } = render(<AgentIcon kind={kind} color={color} size={26} />);
        const el = screen.getByTestId('agent-icon');
        expect(el.getAttribute('data-agent-glyph')).toBe(kind);
        expect(el.getAttribute('data-agent-color')).toBe(color);
        unmount();
      }
    }
  });

  it('size prop が外側 box の幅と高さに反映される', () => {
    render(<AgentIcon kind="cust" color="accent" size={32} />);
    const el = screen.getByTestId('agent-icon');
    expect(el).toHaveStyle({ width: '32px', height: '32px' });
  });

  it('radius prop が省略されると size * 0.27 が border-radius になる', () => {
    render(<AgentIcon kind="cust" color="accent" size={26} />);
    const el = screen.getByTestId('agent-icon');
    // 26 * 0.27 = 7.02 → Math.round = 7
    expect(el).toHaveStyle({ borderRadius: '7px' });
  });

  it('radius を明示すると優先される', () => {
    render(<AgentIcon kind="cust" color="accent" size={26} radius={12} />);
    const el = screen.getByTestId('agent-icon');
    expect(el).toHaveStyle({ borderRadius: '12px' });
  });

  it('SVG の中身は size の ~55% でレンダーされる', () => {
    render(<AgentIcon kind="biz" color="accentSoft" size={32} />);
    const svg = screen.getByTestId('agent-icon').querySelector('svg');
    expect(svg).not.toBeNull();
    // Math.round(32 * 0.55) = 18
    expect(svg?.getAttribute('width')).toBe('18');
    expect(svg?.getAttribute('height')).toBe('18');
  });

  it("color='accent' は accent CSS 変数 + 白文字で塗る", () => {
    render(<AgentIcon kind="cust" color="accent" size={26} />);
    const el = screen.getByTestId('agent-icon');
    expect(el).toHaveStyle({ background: 'var(--cw-accent)' });
    const svg = el.querySelector('svg');
    expect(svg?.getAttribute('stroke')).toBe('#ffffff');
  });

  it("color='accentSoft' は accent-soft 背景 + accent 文字", () => {
    render(<AgentIcon kind="biz" color="accentSoft" size={26} />);
    const el = screen.getByTestId('agent-icon');
    expect(el).toHaveStyle({ background: 'var(--cw-accent-soft)' });
    const svg = el.querySelector('svg');
    expect(svg?.getAttribute('stroke')).toBe('var(--cw-accent)');
  });

  it("color='teal' (Custom 用) は Tailwind 標準カラーの hex を使う", () => {
    render(<AgentIcon kind="analytics" color="teal" size={26} />);
    const el = screen.getByTestId('agent-icon');
    expect(el).toHaveStyle({ background: '#14b8a626' });
    const svg = el.querySelector('svg');
    expect(svg?.getAttribute('stroke')).toBe('#0f766e');
  });

  it('title prop が要素に反映される (a11y / tooltip)', () => {
    render(<AgentIcon kind="cust" color="accent" size={26} title="カスタマイザー" />);
    const el = screen.getByTestId('agent-icon');
    expect(el.getAttribute('title')).toBe('カスタマイザー');
  });

  it('className prop が追加 class として反映される', () => {
    render(<AgentIcon kind="cust" color="accent" size={26} className="custom-cls" />);
    const el = screen.getByTestId('agent-icon');
    expect(el.className).toContain('custom-cls');
    expect(el.className).toContain('inline-flex'); // default classes 残る
  });

  it("kind='biz' は clipboard + check の SVG パスを持つ", () => {
    render(<AgentIcon kind="biz" color="accent" size={26} />);
    const paths = screen.getByTestId('agent-icon').querySelectorAll('path');
    // 3 path: clipboard body / clipboard top / check mark
    expect(paths.length).toBeGreaterThanOrEqual(2);
    // チェックマークの d 属性に着目 (M7.5 10l2 2 ...)
    const hasCheckPath = Array.from(paths).some((p) => p.getAttribute('d')?.includes('7.5 10'));
    expect(hasCheckPath).toBe(true);
  });

  it("kind='cust' は brace { } の SVG パスを持つ", () => {
    render(<AgentIcon kind="cust" color="accent" size={26} />);
    const paths = screen.getByTestId('agent-icon').querySelectorAll('path');
    // 左ブレース + 右ブレース = 2 path
    expect(paths.length).toBe(2);
  });
});
