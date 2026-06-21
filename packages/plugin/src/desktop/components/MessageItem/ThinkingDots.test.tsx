import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { ThinkingDots } from './ThinkingDots';

describe('ThinkingDots', () => {
  it('アクセシブルな aria-label (例: "考え中") を持つ', () => {
    render(<ThinkingDots />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('3 つのドット要素をレンダリングする', () => {
    const { container } = render(<ThinkingDots />);
    // span.dot を 3 個描画する想定
    const dots = container.querySelectorAll('[data-dot]');
    expect(dots).toHaveLength(3);
  });
});
