// SettingsViewBound のテスト
//
// SettingsView の props 配線 (bundledSkills 算出 / 各種ハンドラ) を検証。
// chatPanelSkillsSync / agentVisibility の wrapper を mock で差し替えて呼出経路を確認する。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../store/chatStore';

import { SettingsViewBound } from './SettingsViewBound';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';

vi.mock('../../core/skills/chatPanelSkillsSync', () => ({
  syncBundledSkillsFromChatPanel: vi.fn().mockResolvedValue(undefined),
  syncCustomSkillFromChatPanel: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../core/managed-agents/agentVisibility', () => ({
  setAgentVisibility: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../core/kintone/pluginConfig', () => ({
  getPluginConfig: vi.fn(() => ({
    workerUrl: 'https://w.example.com',
    skillsMapping: {},
    skillsVersion: null,
  })),
}));

import {
  syncBundledSkillsFromChatPanel,
  syncCustomSkillFromChatPanel,
} from '../../core/skills/chatPanelSkillsSync';
import { setAgentVisibility } from '../../core/managed-agents/agentVisibility';

const mockSyncBundled = vi.mocked(syncBundledSkillsFromChatPanel);
const mockSyncCustom = vi.mocked(syncCustomSkillFromChatPanel);
const mockSetVisibility = vi.mocked(setAgentVisibility);

function makeAgent(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: 'agent_biz',
    name: '業務エージェント',
    model: 'sonnet',
    modelLabel: 'SONNET',
    description: 'business',
    purpose: 'business',
    iconKind: 'biz',
    iconColor: 'accentSoft',
    visibility: 'public',
    isDefault: false,
    source: 'builtin',
    ...overrides,
  };
}

beforeEach(() => {
  useChatStore.getState().reset();
  useChatStore.getState().setPluginId('plugin_1');
  mockSyncBundled.mockClear();
  mockSyncCustom.mockClear();
  mockSetVisibility.mockClear();
});

describe('SettingsViewBound', () => {
  it('SettingsView を含む shell が描画される', () => {
    render(<SettingsViewBound onClose={vi.fn()} />);
    expect(screen.getByTestId('settings-view')).toBeInTheDocument();
  });

  it('Skills 同期ボタンクリックで syncBundledSkillsFromChatPanel が pluginId + workerUrl で呼ばれる', async () => {
    const user = userEvent.setup();
    render(<SettingsViewBound onClose={vi.fn()} />);
    await user.click(screen.getByTestId('settings-nav-skills'));
    await user.click(screen.getByTestId('skills-sync-btn'));
    await waitFor(() =>
      expect(mockSyncBundled).toHaveBeenCalledWith({
        pluginId: 'plugin_1',
        workerUrl: 'https://w.example.com',
      }),
    );
  });

  it('Agent 公開トグルクリックで setAgentVisibility + chatStore 更新', async () => {
    useChatStore.getState().setBuiltInAgents([makeAgent({ id: 'biz', visibility: 'public' })]);
    const user = userEvent.setup();
    render(<SettingsViewBound onClose={vi.fn()} />);
    await user.click(screen.getByTestId('agent-visibility-biz'));
    await waitFor(() => {
      expect(mockSetVisibility).toHaveBeenCalledWith('biz', 'private');
    });
    // chatStore も更新される
    const agents = useChatStore.getState().builtInAgents;
    expect(agents.find((a) => a.id === 'biz')?.visibility).toBe('private');
  });

  it('setAgentVisibility が reject すると chatStore は変更されず error が伝播', async () => {
    useChatStore.getState().setBuiltInAgents([makeAgent({ id: 'biz', visibility: 'public' })]);
    mockSetVisibility.mockRejectedValueOnce(new Error('403 forbidden'));
    const user = userEvent.setup();
    render(<SettingsViewBound onClose={vi.fn()} />);
    await user.click(screen.getByTestId('agent-visibility-biz'));
    expect(await screen.findByText('403 forbidden')).toBeInTheDocument();
    // chatStore は変更されない
    expect(useChatStore.getState().builtInAgents.find((a) => a.id === 'biz')?.visibility).toBe(
      'public',
    );
  });

  it('onClose / onPluginConfigClick が SettingsView に渡される', async () => {
    const onClose = vi.fn();
    const onPluginConfigClick = vi.fn();
    const user = userEvent.setup();
    render(<SettingsViewBound onClose={onClose} onPluginConfigClick={onPluginConfigClick} />);
    await user.click(screen.getByTestId('settings-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
