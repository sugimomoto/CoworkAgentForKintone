// ConversationUtilityBar のテスト

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConversationUtilityBar } from './ConversationUtilityBar';

describe('ConversationUtilityBar', () => {
  it('新規会話 / 履歴ボタンは常に表示される', () => {
    render(
      <ConversationUtilityBar
        onHistoryClick={vi.fn()}
        onNewConversationClick={vi.fn()}
        onReconnectKintone={vi.fn()}
        bindingStatus="unbound"
      />,
    );
    expect(screen.getByTestId('utility-new-conversation')).toBeInTheDocument();
    expect(screen.getByTestId('utility-history')).toBeInTheDocument();
  });

  it('bindingStatus=bound で再連携ボタンが表示される', () => {
    render(
      <ConversationUtilityBar
        onHistoryClick={vi.fn()}
        onNewConversationClick={vi.fn()}
        onReconnectKintone={vi.fn()}
        bindingStatus="bound"
      />,
    );
    expect(screen.getByTestId('utility-reconnect')).toBeInTheDocument();
  });

  it('bindingStatus=unbound では再連携ボタンは出ない (ConnectKintoneButton と重複しない)', () => {
    render(
      <ConversationUtilityBar
        onHistoryClick={vi.fn()}
        onNewConversationClick={vi.fn()}
        onReconnectKintone={vi.fn()}
        bindingStatus="unbound"
      />,
    );
    expect(screen.queryByTestId('utility-reconnect')).toBeNull();
  });

  it('bindingStatus=binding で再連携ボタンは disabled', () => {
    render(
      <ConversationUtilityBar
        onHistoryClick={vi.fn()}
        onNewConversationClick={vi.fn()}
        onReconnectKintone={vi.fn()}
        bindingStatus="binding"
      />,
    );
    expect(screen.getByTestId('utility-reconnect')).toBeDisabled();
  });

  it('クリックで各 callback が呼ばれる', async () => {
    const onHistory = vi.fn();
    const onNew = vi.fn();
    const onReconnect = vi.fn();
    const user = userEvent.setup();
    render(
      <ConversationUtilityBar
        onHistoryClick={onHistory}
        onNewConversationClick={onNew}
        onReconnectKintone={onReconnect}
        bindingStatus="bound"
      />,
    );
    await user.click(screen.getByTestId('utility-new-conversation'));
    await user.click(screen.getByTestId('utility-history'));
    await user.click(screen.getByTestId('utility-reconnect'));
    expect(onNew).toHaveBeenCalledOnce();
    expect(onHistory).toHaveBeenCalledOnce();
    expect(onReconnect).toHaveBeenCalledOnce();
  });
});
