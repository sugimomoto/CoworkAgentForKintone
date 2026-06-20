import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../store/chatStore';

import { ProgressIndicator } from './ProgressIndicator';

function resetStore(): void {
  useChatStore.setState({
    isAgentRunning: false,
    lastEvent: null,
    agentRunningSince: null,
    messages: [],
    pendingCustomToolUseIds: new Map(),
  });
}

describe('ProgressIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStore();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetStore();
  });

  it('phase !== running なら何も描画しない', () => {
    const { container } = render(<ProgressIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('phase === running + event 未受信なら「思考中…」を出す', () => {
    useChatStore.setState({ isAgentRunning: true });
    const { getByTestId } = render(<ProgressIndicator />);
    expect(getByTestId('progress-indicator-label').textContent).toBe('思考中…');
  });

  it('lastEvent.kind=tool_use + toolName で「ツール実行中: <name>」', () => {
    useChatStore.setState({
      isAgentRunning: true,
      lastEvent: { at: Date.now(), kind: 'tool_use', toolName: 'kintone-get-records' },
    });
    const { getByTestId } = render(<ProgressIndicator />);
    expect(getByTestId('progress-indicator-label').textContent).toBe(
      'ツール実行中: kintone-get-records',
    );
  });

  it('lastEvent.kind=tool_result で「結果を読んでいます…」', () => {
    useChatStore.setState({
      isAgentRunning: true,
      lastEvent: { at: Date.now(), kind: 'tool_result', toolName: null },
    });
    const { getByTestId } = render(<ProgressIndicator />);
    expect(getByTestId('progress-indicator-label').textContent).toBe('結果を読んでいます…');
  });

  it('lastEvent.kind=custom_tool_use で「アーティファクト処理中」', () => {
    useChatStore.setState({
      isAgentRunning: true,
      lastEvent: { at: Date.now(), kind: 'custom_tool_use', toolName: null },
    });
    const { getByTestId } = render(<ProgressIndicator />);
    expect(getByTestId('progress-indicator-label').textContent).toBe('アーティファクト処理中');
  });

  it('経過秒が表示される (初期 0s)', () => {
    useChatStore.setState({
      isAgentRunning: true,
      lastEvent: { at: Date.now(), kind: 'thinking', toolName: null },
    });
    const { getByTestId } = render(<ProgressIndicator />);
    expect(getByTestId('progress-indicator-elapsed').textContent?.replace(/\s/g, '')).toBe('·0s');
  });

  it('#78: lastEvent 未受信でも agentRunningSince を起点に経過秒がカウントされる', () => {
    // 送信直後〜最初の進行イベント到達前 (lastEvent === null) の状態
    useChatStore.setState({
      isAgentRunning: true,
      lastEvent: null,
      agentRunningSince: Date.now() - 3000, // 3 秒前にターン開始
    });
    const { getByTestId } = render(<ProgressIndicator />);
    expect(getByTestId('progress-indicator-elapsed').textContent?.replace(/\s/g, '')).toBe('·3s');
  });

  it('role="status" aria-live="polite" を持つ', () => {
    useChatStore.setState({ isAgentRunning: true });
    const { getByTestId } = render(<ProgressIndicator />);
    const el = getByTestId('progress-indicator');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('awaiting-confirm (pending-confirmation tool) のときは非表示', () => {
    useChatStore.setState({
      isAgentRunning: true,
      messages: [
        {
          id: 'tu1',
          kind: 'tool',
          name: 'kintone-delete-records',
          input: {},
          status: 'pending-confirmation',
        },
      ],
    });
    const { container } = render(<ProgressIndicator />);
    expect(container.firstChild).toBeNull();
  });
});
