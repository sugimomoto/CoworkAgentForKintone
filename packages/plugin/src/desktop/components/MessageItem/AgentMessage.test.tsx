import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { AgentMessage } from './AgentMessage';

describe('AgentMessage', () => {
  it('本文を表示する', () => {
    render(<AgentMessage text="今月は 3 件あります" />);
    expect(screen.getByText('今月は 3 件あります')).toBeInTheDocument();
  });

  it('アバターを含む (装飾要素)', () => {
    const { container } = render(<AgentMessage text="x" />);
    expect(container.querySelector('svg, img')).not.toBeNull();
  });

  describe('Markdown レンダリング', () => {
    it('見出し # → h1', () => {
      const { container } = render(<AgentMessage text={'# 集計結果'} />);
      const h1 = container.querySelector('h1');
      expect(h1?.textContent).toBe('集計結果');
    });

    it('太字 **x** → strong', () => {
      const { container } = render(<AgentMessage text="今月は **3 件** あります" />);
      const strong = container.querySelector('strong');
      expect(strong?.textContent).toBe('3 件');
    });

    it('箇条書き → ul/li', () => {
      const { container } = render(<AgentMessage text={'- A\n- B\n- C'} />);
      const items = container.querySelectorAll('ul > li');
      expect(items.length).toBe(3);
      expect(items[0]?.textContent).toBe('A');
    });

    it('番号付き → ol/li', () => {
      const { container } = render(<AgentMessage text={'1. 一\n2. 二'} />);
      expect(container.querySelectorAll('ol > li').length).toBe(2);
    });

    it('インラインコード `x` → code', () => {
      const { container } = render(<AgentMessage text="`title` フィールドを更新" />);
      expect(container.querySelector('code')?.textContent).toBe('title');
    });

    it('コードブロック ```...``` → pre > code', () => {
      const { container } = render(
        <AgentMessage text={'```\nconsole.log(1)\n```'} />,
      );
      expect(container.querySelector('pre code')).not.toBeNull();
    });

    it('リンクは target=_blank + rel=noopener', () => {
      const { container } = render(<AgentMessage text="[公式](https://example.com)" />);
      const a = container.querySelector('a');
      expect(a?.getAttribute('href')).toBe('https://example.com');
      expect(a?.getAttribute('target')).toBe('_blank');
      expect(a?.getAttribute('rel')).toContain('noopener');
    });

    it('GFM 表 → table', () => {
      const md = '| ID | Name |\n|---|---|\n| 1 | A |\n| 2 | B |';
      const { container } = render(<AgentMessage text={md} />);
      const ths = container.querySelectorAll('th');
      expect(ths.length).toBe(2);
      expect(container.querySelectorAll('tbody tr').length).toBe(2);
    });

    it('raw HTML (script など) はパースされない (XSS 防御)', () => {
      const { container } = render(
        <AgentMessage text={'<script>alert(1)</script> 続き'} />,
      );
      // <script> がそのままテキストとして残るか、要素として埋まらないこと
      expect(container.querySelector('script')).toBeNull();
    });

    it('未完成の Markdown (ストリーミング途中) でも壊れない', () => {
      // ** がペアにならない / ``` が閉じない 等
      expect(() =>
        render(<AgentMessage text={'部分応答 **強'} />),
      ).not.toThrow();
      expect(() =>
        render(<AgentMessage text={'```ts\nconst x = 1'} />),
      ).not.toThrow();
    });
  });
});
