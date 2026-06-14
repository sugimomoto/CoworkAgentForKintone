// SettingsView shell + SettingsNav の統合テスト
//
// nav 切替で detail が変わる / Plugin Config リンクが発火 / MCP が disabled

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../store/chatStore';

import { SettingsView } from './SettingsView';

beforeEach(() => {
  useChatStore.getState().reset();
});

describe('SettingsView', () => {
  it('default で agents セクションが表示される', () => {
    render(<SettingsView onClose={vi.fn()} isAdmin />);
    expect(screen.getByTestId('settings-view')).toBeInTheDocument();
    expect(screen.getByTestId('agents-list-pane')).toBeInTheDocument();
    expect(screen.queryByTestId('skills-pane')).toBeNull();
  });

  it('Skills タブクリックで SkillsPane に切り替わる', async () => {
    const user = userEvent.setup();
    render(<SettingsView onClose={vi.fn()} isAdmin />);
    await user.click(screen.getByTestId('settings-nav-skills'));
    expect(screen.getByTestId('skills-pane')).toBeInTheDocument();
    expect(screen.queryByTestId('agents-list-pane')).toBeNull();
  });

  it('MCP タブは disabled で click しても切り替わらない', async () => {
    const user = userEvent.setup();
    render(<SettingsView onClose={vi.fn()} isAdmin />);
    const mcpBtn = screen.getByTestId('settings-nav-mcp');
    expect(mcpBtn).toBeDisabled();
    await user.click(mcpBtn);
    expect(screen.queryByTestId('mcp-pane-placeholder')).toBeNull();
    expect(screen.getByTestId('agents-list-pane')).toBeInTheDocument();
  });

  it('Plugin Config リンクが発火する', async () => {
    const onPluginConfigClick = vi.fn();
    const user = userEvent.setup();
    render(<SettingsView onClose={vi.fn()} isAdmin onPluginConfigClick={onPluginConfigClick} />);
    await user.click(screen.getByTestId('settings-nav-plugin-config'));
    expect(onPluginConfigClick).toHaveBeenCalledOnce();
  });

  it('Plugin Config ハンドラ未指定なら disabled', () => {
    render(<SettingsView onClose={vi.fn()} isAdmin />);
    expect(screen.getByTestId('settings-nav-plugin-config')).toBeDisabled();
  });

  it('閉じるボタンクリックで onClose が呼ばれる', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SettingsView onClose={onClose} isAdmin />);
    await user.click(screen.getByTestId('settings-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
