import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { Header } from './Header';

describe('Header', () => {
  it('Agent 名 "Aoi" と AGENT バッジを表示する', () => {
    render(<Header agentName="Aoi" status="作業中 · kintone接続" />);

    expect(screen.getByText('Aoi')).toBeInTheDocument();
    expect(screen.getByText('AGENT')).toBeInTheDocument();
  });

  it('status テキストを表示する', () => {
    render(<Header agentName="Aoi" status="待機中" />);
    expect(screen.getByText('待機中')).toBeInTheDocument();
  });

  it('設定ボタン押下で onSettingsClick が呼ばれる', async () => {
    const onSettingsClick = vi.fn();
    const user = userEvent.setup();
    render(<Header agentName="Aoi" status="x" onSettingsClick={onSettingsClick} />);

    await user.click(screen.getByRole('button', { name: /設定/ }));
    expect(onSettingsClick).toHaveBeenCalledTimes(1);
  });

  it('閉じるボタン押下で onClose が呼ばれる', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Header agentName="Aoi" status="x" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /閉じる/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('onSettingsClick が未指定なら設定ボタンは出さない', () => {
    render(<Header agentName="Aoi" status="x" />);
    expect(screen.queryByRole('button', { name: /設定/ })).not.toBeInTheDocument();
  });

  it('onClose が未指定なら閉じるボタンは出さない', () => {
    render(<Header agentName="Aoi" status="x" />);
    expect(screen.queryByRole('button', { name: /閉じる/ })).not.toBeInTheDocument();
  });

  it('履歴ボタン押下で onHistoryClick が呼ばれる', async () => {
    const onHistoryClick = vi.fn();
    const user = userEvent.setup();
    render(<Header agentName="Aoi" status="x" onHistoryClick={onHistoryClick} />);

    await user.click(screen.getByRole('button', { name: /履歴/ }));
    expect(onHistoryClick).toHaveBeenCalledTimes(1);
  });

  it('新規会話ボタン押下で onNewConversationClick が呼ばれる', async () => {
    const onNewConversationClick = vi.fn();
    const user = userEvent.setup();
    render(<Header agentName="Aoi" status="x" onNewConversationClick={onNewConversationClick} />);

    await user.click(screen.getByRole('button', { name: /新規会話/ }));
    expect(onNewConversationClick).toHaveBeenCalledTimes(1);
  });

  it('履歴 / 新規会話 prop 未指定なら各ボタンは出さない', () => {
    render(<Header agentName="Aoi" status="x" />);
    expect(screen.queryByRole('button', { name: /履歴/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新規会話/ })).not.toBeInTheDocument();
  });

  describe('再連携ボタン', () => {
    it('reconnectVisible=true で表示され、押下で onReconnectKintone が呼ばれる', async () => {
      const onReconnectKintone = vi.fn();
      const user = userEvent.setup();
      render(
        <Header
          agentName="Aoi"
          status="x"
          onReconnectKintone={onReconnectKintone}
          reconnectVisible
        />,
      );

      const button = screen.getByRole('button', { name: /kintone を再連携/ });
      await user.click(button);
      expect(onReconnectKintone).toHaveBeenCalledTimes(1);
    });

    it('reconnectVisible=false なら描画しない', () => {
      render(
        <Header
          agentName="Aoi"
          status="x"
          onReconnectKintone={vi.fn()}
          reconnectVisible={false}
        />,
      );
      expect(
        screen.queryByRole('button', { name: /kintone を再連携/ }),
      ).not.toBeInTheDocument();
    });

    it('onReconnectKintone 未指定なら描画しない', () => {
      render(<Header agentName="Aoi" status="x" reconnectVisible />);
      expect(
        screen.queryByRole('button', { name: /kintone を再連携/ }),
      ).not.toBeInTheDocument();
    });

    it('reconnectDisabled=true なら disabled でクリックしても呼ばれない', async () => {
      const onReconnectKintone = vi.fn();
      const user = userEvent.setup();
      render(
        <Header
          agentName="Aoi"
          status="x"
          onReconnectKintone={onReconnectKintone}
          reconnectVisible
          reconnectDisabled
        />,
      );

      const button = screen.getByRole('button', { name: /kintone を再連携/ });
      expect(button).toBeDisabled();
      await user.click(button);
      expect(onReconnectKintone).not.toHaveBeenCalled();
    });
  });
});
