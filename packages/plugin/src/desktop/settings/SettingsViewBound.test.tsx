// SettingsViewBound のテスト
//
// SettingsView の props 配線 (bundledSkills 算出 / 各種ハンドラ) を検証。
// chatPanelSkillsSync / agentVisibility の wrapper を mock で差し替えて呼出経路を確認する。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyAgentEdit,
  archiveAgentById,
  createCustomAgentFrom,
} from '../../core/managed-agents/agentDetailApi';
import { setAgentVisibility } from '../../core/managed-agents/agentVisibility';
import { retrieveAgent } from '../../core/managed-agents/resources';
import {
  syncBundledSkillsFromChatPanel,
  syncCustomSkillFromChatPanel,
} from '../../core/skills/chatPanelSkillsSync';
import { useChatStore } from '../../store/chatStore';

import { SettingsViewBound } from './SettingsViewBound';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';

vi.mock('../../core/skills/chatPanelSkillsSync', () => ({
  syncBundledSkillsFromChatPanel: vi.fn().mockResolvedValue({ results: [] }),
  syncCustomSkillFromChatPanel: vi.fn().mockResolvedValue({ results: [] }),
  editCustomSkillFromChatPanel: vi.fn().mockResolvedValue({ results: [] }),
  deleteCustomSkillFromChatPanel: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../core/managed-agents/agentVisibility', () => ({
  setAgentVisibility: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../core/managed-agents/agentDetailApi', () => ({
  applyAgentEdit: vi.fn(),
  createCustomAgentFrom: vi.fn(),
  archiveAgentById: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../core/managed-agents/resources', () => ({
  retrieveAgent: vi.fn(),
}));
vi.mock('../../core/kintone/pluginConfig', () => ({
  getPluginConfig: vi.fn(() => ({
    workerUrl: 'https://w.example.com',
    oauthClientId: null,
  })),
}));
vi.mock('../../core/skills/resolveBundledSkillIds', () => ({
  resolveBundledSkillIds: vi.fn().mockResolvedValue([]),
  resolveSkillSet: vi.fn().mockResolvedValue({ bundled: [], custom: [] }),
}));


const mockSyncBundled = vi.mocked(syncBundledSkillsFromChatPanel);
const mockSyncCustom = vi.mocked(syncCustomSkillFromChatPanel);
const mockSetVisibility = vi.mocked(setAgentVisibility);
const mockApplyAgentEdit = vi.mocked(applyAgentEdit);
const mockCreateCustomAgent = vi.mocked(createCustomAgentFrom);
const mockArchiveAgent = vi.mocked(archiveAgentById);
const mockRetrieveAgent = vi.mocked(retrieveAgent);

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
    quickActions: [],
    allowedUsers: [],
    allowedGroups: [],
    allowedOrganizations: [],
    ...overrides,
  };
}

beforeEach(() => {
  useChatStore.getState().reset();
  useChatStore.getState().setPluginId('plugin_1');
  // #81: Settings はロール出し分け。本テスト群は admin 機能 (agents/skills) を検証するため admin にする
  useChatStore.getState().setIsAdminResolved(true);
  mockSyncBundled.mockClear();
  mockSyncCustom.mockClear();
  mockSetVisibility.mockClear();
  mockApplyAgentEdit.mockReset();
  mockCreateCustomAgent.mockReset();
  mockArchiveAgent.mockClear();
  mockRetrieveAgent.mockReset();
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

  // #40 Agent 詳細編集
  it('編集 → ボタン → AgentDetailModal が open する', async () => {
    useChatStore.getState().setBuiltInAgents([makeAgent({ id: 'biz' })]);
    mockRetrieveAgent.mockResolvedValue({
      id: 'biz',
      name: '業務',
      system: 'sp',
      model: { id: 'claude-sonnet-4-6' },
      metadata: { purpose: 'business' },
      tools: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      version: 1,
      type: 'agent',
    } as never);
    const user = userEvent.setup();
    render(<SettingsViewBound onClose={vi.fn()} />);
    await user.click(screen.getByTestId('settings-nav-agents'));
    await user.click(screen.getByTestId('agent-edit-biz'));
    expect(await screen.findByTestId('agent-detail-modal')).toBeInTheDocument();
    expect(mockRetrieveAgent).toHaveBeenCalledWith('biz');
  });

  it('編集モーダルから保存 → applyAgentEdit が呼ばれ chatStore.builtInAgents が更新される', async () => {
    useChatStore.getState().setBuiltInAgents([makeAgent({ id: 'biz' })]);
    mockRetrieveAgent.mockResolvedValue({
      id: 'biz',
      name: '業務',
      system: 'sp',
      model: { id: 'claude-sonnet-4-6' },
      metadata: { purpose: 'business' },
      tools: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      version: 1,
      type: 'agent',
    } as never);
    mockApplyAgentEdit.mockResolvedValue({
      id: 'biz',
      name: '業務 (改)',
      description: '更新',
      system: 'sp',
      model: { id: 'claude-sonnet-4-6' },
      metadata: { purpose: 'business', iconKind: 'biz', iconColor: 'teal', visibility: 'public', isDefault: '0' },
      tools: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-05-30T00:00:00Z',
      version: 2,
      type: 'agent',
    } as never);
    const user = userEvent.setup();
    render(<SettingsViewBound onClose={vi.fn()} />);
    await user.click(screen.getByTestId('settings-nav-agents'));
    await user.click(screen.getByTestId('agent-edit-biz'));
    await screen.findByTestId('agent-detail-system');
    await user.click(screen.getByTestId('agent-detail-save'));
    await waitFor(() => expect(mockApplyAgentEdit).toHaveBeenCalledOnce());
    await waitFor(() => {
      const agents = useChatStore.getState().builtInAgents;
      // updated agent が反映されている (name は agentToRecord 変換で spec のもの = '業務エージェント' になる)
      expect(agents.find((a) => a.id === 'biz')).toBeDefined();
    });
  });

  it('+ Custom Agent 追加 → createCustomAgentFrom が呼ばれ builtInAgents に append', async () => {
    useChatStore.getState().setBuiltInAgents([makeAgent({ id: 'biz' })]);
    mockRetrieveAgent.mockResolvedValue({
      id: 'biz',
      name: '業務',
      system: 'sp',
      model: { id: 'claude-sonnet-4-6' },
      metadata: { purpose: 'business' },
      tools: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      version: 1,
      type: 'agent',
    } as never);
    mockCreateCustomAgent.mockResolvedValue({
      id: 'agent_new_custom',
      name: '業務 のコピー',
      system: 'sp',
      model: { id: 'claude-sonnet-4-6' },
      metadata: {
        purpose: 'custom',
        iconKind: 'biz',
        iconColor: 'teal',
        visibility: 'public',
        isDefault: '0',
      },
      tools: [],
      created_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
      version: 1,
      type: 'agent',
    } as never);
    const user = userEvent.setup();
    render(<SettingsViewBound onClose={vi.fn()} />);
    await user.click(screen.getByTestId('settings-nav-agents'));
    await user.click(screen.getByTestId('agent-create-btn'));
    await screen.findByTestId('agent-detail-system');
    await user.click(screen.getByTestId('agent-detail-save'));
    await waitFor(() => expect(mockCreateCustomAgent).toHaveBeenCalledOnce());
    await waitFor(() => {
      const agents = useChatStore.getState().builtInAgents;
      expect(agents.find((a) => a.id === 'agent_new_custom')).toBeDefined();
      expect(agents.find((a) => a.id === 'agent_new_custom')!.source).toBe('custom');
    });
  });

  it('Custom Agent 削除 → archiveAgentById + builtInAgents から除去', async () => {
    useChatStore.getState().setBuiltInAgents([
      makeAgent({ id: 'biz' }),
      makeAgent({
        id: 'agent_custom_1',
        name: 'My Custom',
        purpose: 'custom',
        source: 'custom',
      }),
    ]);
    mockRetrieveAgent.mockResolvedValue({
      id: 'agent_custom_1',
      name: 'My Custom',
      system: 'sp',
      model: { id: 'claude-sonnet-4-6' },
      metadata: { purpose: 'custom' },
      tools: [],
      created_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
      version: 1,
      type: 'agent',
    } as never);
    const user = userEvent.setup();
    render(<SettingsViewBound onClose={vi.fn()} />);
    await user.click(screen.getByTestId('settings-nav-agents'));
    await user.click(screen.getByTestId('agent-edit-agent_custom_1'));
    await user.click(await screen.findByTestId('agent-detail-delete'));
    await user.click(screen.getByTestId('agent-detail-delete-confirm-yes'));
    await waitFor(() => expect(mockArchiveAgent).toHaveBeenCalledWith('agent_custom_1'));
    await waitFor(() => {
      const agents = useChatStore.getState().builtInAgents;
      expect(agents.find((a) => a.id === 'agent_custom_1')).toBeUndefined();
    });
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
