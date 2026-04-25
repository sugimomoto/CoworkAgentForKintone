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
    // img か svg のいずれかをアバターとして表示している想定
    expect(container.querySelector('svg, img')).not.toBeNull();
  });
});
