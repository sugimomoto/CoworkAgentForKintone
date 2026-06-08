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

  it('thinking kind は ThinkingStatic として表示される (アニメなし)', () => {
    const messages: ChatMessage[] = [{ id: 'm1', kind: 'thinking' }];
    render(<MessageList messages={messages} />);
    expect(screen.getByTestId('thinking-static')).toBeInTheDocument();
    expect(screen.getByText('考え中…')).toBeInTheDocument();
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

  describe('「もう一度試す」ボタンは最後の error tool カードにのみ出す', () => {
    it('error が複数あっても retry ボタンは最後の 1 つだけ', () => {
      const messages: ChatMessage[] = [
        { id: 'tu_1', kind: 'tool', name: 'kintone-add-record', input: {}, status: 'error', errorText: 'oops 1' },
        { id: 'tu_2', kind: 'tool', name: 'kintone-update-record', input: {}, status: 'error', errorText: 'oops 2' },
      ];
      render(<MessageList messages={messages} onRetryTool={() => undefined} />);
      const buttons = screen.queryAllByRole('button', { name: 'もう一度試す' });
      expect(buttons).toHaveLength(1);
    });

    it('error より新しい success/running があっても、最後の error にのみ表示', () => {
      const messages: ChatMessage[] = [
        { id: 'tu_e', kind: 'tool', name: 'kintone-add-record', input: {}, status: 'error' },
        { id: 'tu_s', kind: 'tool', name: 'kintone-get-records', input: {}, status: 'success' },
      ];
      render(<MessageList messages={messages} onRetryTool={() => undefined} />);
      // 直近の error が tu_e、それより後にも tool カードはあるが error は tu_e だけ → tu_e に retry が出る
      expect(screen.queryAllByRole('button', { name: 'もう一度試す' })).toHaveLength(1);
    });

    it('agentPhase=running のときは retry ボタンを出さない (連打防止)', () => {
      const messages: ChatMessage[] = [
        { id: 'tu_e', kind: 'tool', name: 'kintone-add-record', input: {}, status: 'error' },
      ];
      render(
        <MessageList
          messages={messages}
          onRetryTool={() => undefined}
          agentPhase="running"
        />,
      );
      expect(screen.queryAllByRole('button', { name: 'もう一度試す' })).toHaveLength(0);
    });

    it('error が無ければ retry ボタンは出ない', () => {
      const messages: ChatMessage[] = [
        { id: 'tu_s', kind: 'tool', name: 'x', input: {}, status: 'success' },
        { id: 'tu_r', kind: 'tool', name: 'x', input: {}, status: 'rejected' },
      ];
      render(<MessageList messages={messages} onRetryTool={() => undefined} />);
      expect(screen.queryAllByRole('button', { name: 'もう一度試す' })).toHaveLength(0);
    });
  });
});
