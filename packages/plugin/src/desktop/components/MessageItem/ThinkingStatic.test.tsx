import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThinkingStatic } from './ThinkingStatic';

describe('ThinkingStatic', () => {
  it('「考え中…」テキストとアバターを描画する', () => {
    const { getByText, getByTestId } = render(<ThinkingStatic />);
    expect(getByText('考え中…')).toBeTruthy();
    expect(getByTestId('thinking-static')).toBeTruthy();
  });

  it('role="note" (= 静的痕跡)', () => {
    const { getByTestId } = render(<ThinkingStatic />);
    expect(getByTestId('thinking-static').getAttribute('role')).toBe('note');
  });

  it('アニメ用クラス (cw-dot 等) を含まない', () => {
    const { container } = render(<ThinkingStatic />);
    expect(container.querySelectorAll('[data-dot]').length).toBe(0);
  });
});
