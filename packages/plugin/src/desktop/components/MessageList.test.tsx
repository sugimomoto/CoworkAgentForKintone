import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { MessageList, type ChatMessage } from './MessageList';

describe('MessageList', () => {
  it('空配列のとき何もレンダリングしない (エラーにもならない)', () => {
    const { container } = render(<MessageList messages={[]} />);
    expect(container.querySelectorAll('[data-msg]')).toHaveLength(0);
  });

  it('user kind は UserMessage として表示される', () => {
    const messages: ChatMessage[] = [{ id: 'm1', kind: 'user', text: 'こんにちは' }];
    render(<MessageList messages={messages} />);
    expect(screen.getByText('こんにちは')).toBeInTheDocument();
  });

  it('agent kind は AgentMessage として表示される', () => {
    const messages: ChatMessage[] = [{ id: 'm1', kind: 'agent', text: '了解しました' }];
    render(<MessageList messages={messages} />);
    expect(screen.getByText('了解しました')).toBeInTheDocument();
  });

  it('thinking kind は ThinkingDots として表示される', () => {
    const messages: ChatMessage[] = [{ id: 'm1', kind: 'thinking' }];
    render(<MessageList messages={messages} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('複数メッセージを順序通りに表示する', () => {
    const messages: ChatMessage[] = [
      { id: 'm1', kind: 'user', text: 'Q1' },
      { id: 'm2', kind: 'agent', text: 'A1' },
      { id: 'm3', kind: 'user', text: 'Q2' },
    ];
    render(<MessageList messages={messages} />);
    const wrapper = screen.getByText('Q1').closest('[data-msg]');
    expect(wrapper).not.toBeNull();

    const allMsgs = Array.from(document.querySelectorAll('[data-msg]'));
    expect(allMsgs).toHaveLength(3);
    expect(allMsgs[0]!.textContent).toContain('Q1');
    expect(allMsgs[1]!.textContent).toContain('A1');
    expect(allMsgs[2]!.textContent).toContain('Q2');
  });

  it('未知の kind は無視される (落ちない)', () => {
    const messages = [{ id: 'm1', kind: 'unknown', text: 'x' }] as unknown as ChatMessage[];
    const { container } = render(<MessageList messages={messages} />);
    expect(container.querySelectorAll('[data-msg]')).toHaveLength(0);
  });
});
