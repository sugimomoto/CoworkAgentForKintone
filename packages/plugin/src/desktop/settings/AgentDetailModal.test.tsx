// AgentDetailModal の単体テスト (#40)
//
// fetchAgent / onSave / onDelete を mock し、form の初期化・編集・保存・リセット・削除
// の各シナリオを検証する。Anthropic API は呼ばない (上位の SettingsViewBound 側で wire)。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AgentDetailModal,
  type AgentDetailModalProps,
  type AvailableSkill,
} from './AgentDetailModal';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';
import type { Agent } from '../../core/managed-agents/types';

function makeBuiltInAgentRecord(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: 'agent_biz_1',
    name: '業務エージェント',
    model: 'sonnet',
    modelLabel: 'SONNET',
    description: 'レコード操作 / 集計 / ドキュメント生成',
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

function makeCustomAgentRecord(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: 'agent_custom_1',
    name: 'マイ Custom',
    model: 'sonnet',
    modelLabel: 'SONNET',
    description: 'カスタム',
    purpose: 'custom',
    iconKind: 'ai',
    iconColor: 'teal',
    visibility: 'public',
    isDefault: false,
    source: 'custom',
    quickActions: [],
    allowedUsers: [],
    allowedGroups: [],
    allowedOrganizations: [],
    ...overrides,
  };
}

function makeAnthropicAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent_biz_1',
    name: '業務エージェント',
    description: 'レコード操作',
    system: '元の system prompt 本文',
    model: { id: 'claude-sonnet-4-6' },
    tools: [
      {
        type: 'mcp_toolset',
        mcp_server_name: 'kintone',
        configs: [
          { name: 'kintone-get-records', enabled: true },
          { name: 'kintone-add-record', enabled: true },
          { name: 'kintone-delete-records', enabled: false },
        ],
      },
    ],
    metadata: {
      purpose: 'business',
      workerUrl: 'https://w.example.com',
      kintoneDomain: 'tenant.cybozu.com',
    },
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-30T00:00:00Z',
    version: 1,
    type: 'agent',
    ...overrides,
  } as Agent;
}

const SKILLS: readonly AvailableSkill[] = [
  { skillId: 'xlsx', type: 'anthropic', label: 'xlsx (Excel/CSV)' },
  { skillId: 'docx', type: 'anthropic', label: 'docx (Word)' },
  { skillId: 'sk_custom_1', type: 'custom', label: 'kintone-customize-js' },
];

function renderModal(overrides: Partial<AgentDetailModalProps> = {}): {
  user: ReturnType<typeof userEvent.setup>;
  fetchAgent: ReturnType<typeof vi.fn>;
  onSave: ReturnType<typeof vi.fn>;
  onDelete: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
} {
  const fetchAgent = vi.fn().mockResolvedValue(makeAnthropicAgent());
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();

  const props: AgentDetailModalProps = {
    mode: { kind: 'edit', agent: makeBuiltInAgentRecord() },
    fetchAgent,
    onSave,
    onDelete,
    availableSkills: SKILLS,
    onClose,
    ...overrides,
  };
  render(<AgentDetailModal {...props} />);
  return { user: userEvent.setup(), fetchAgent, onSave, onDelete, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AgentDetailModal — edit mode (built-in)', () => {
  it('open すると fetchAgent が呼ばれ form が Agent.system で初期化される', async () => {
    const { fetchAgent } = renderModal();
    await waitFor(() => expect(fetchAgent).toHaveBeenCalledWith('agent_biz_1'));
    const sysInput = (await screen.findByTestId('agent-detail-system')) as HTMLTextAreaElement;
    expect(sysInput.value).toBe('元の system prompt 本文');
    const nameInput = screen.getByTestId('agent-detail-name') as HTMLInputElement;
    expect(nameInput.value).toBe('業務エージェント');
  });

  it('built-in には「初期値に戻す」ボタンが出て、削除ボタンは出ない', async () => {
    renderModal();
    expect(await screen.findByTestId('agent-detail-reset')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-detail-delete')).not.toBeInTheDocument();
  });

  it('system prompt を空にすると保存ボタンが disabled', async () => {
    const { user } = renderModal();
    const sys = await screen.findByTestId('agent-detail-system');
    await user.clear(sys);
    const save = screen.getByTestId('agent-detail-save');
    expect(save).toBeDisabled();
  });

  it('編集 → 保存で onSave が (draft, sourceAgent) で呼ばれる', async () => {
    const { user, onSave } = renderModal();
    const name = await screen.findByTestId('agent-detail-name');
    await user.clear(name);
    await user.type(name, '業務 (改)');
    await user.click(screen.getByTestId('agent-detail-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const [draft, sourceAgent] = onSave.mock.calls[0]!;
    expect(draft.name).toBe('業務 (改)');
    expect(draft.systemPrompt).toBe('元の system prompt 本文');
    expect(sourceAgent.id).toBe('agent_biz_1');
  });

  it('「初期値に戻す」で system prompt が出荷時 spec に戻る', async () => {
    const { user } = renderModal();
    const sys = (await screen.findByTestId('agent-detail-system')) as HTMLTextAreaElement;
    await user.clear(sys);
    await user.type(sys, '一時編集');
    expect(sys.value).toBe('一時編集');
    await user.click(screen.getByTestId('agent-detail-reset'));
    await waitFor(() => {
      const after = screen.getByTestId('agent-detail-system') as HTMLTextAreaElement;
      // 出荷時 spec の system prompt 冒頭フレーズが含まれる (intro 「業務支援エージェント」)
      expect(after.value).toContain('業務支援エージェント');
    });
  });

  it('tool 一覧が KINTONE_TOOL_NAMES 全件、既に enabled な 2 件が ON', async () => {
    renderModal();
    await screen.findByTestId('agent-detail-system');
    const get = screen.getByTestId('agent-detail-tool-kintone-get-records') as HTMLInputElement;
    const add = screen.getByTestId('agent-detail-tool-kintone-add-record') as HTMLInputElement;
    const del = screen.getByTestId('agent-detail-tool-kintone-delete-records') as HTMLInputElement;
    expect(get.checked).toBe(true);
    expect(add.checked).toBe(true);
    expect(del.checked).toBe(false);
  });
});

describe('AgentDetailModal — edit mode (custom)', () => {
  it('custom には削除ボタンが出て、初期値に戻すボタンは出ない', async () => {
    renderModal({
      mode: { kind: 'edit', agent: makeCustomAgentRecord() },
      fetchAgent: vi.fn().mockResolvedValue(
        makeAnthropicAgent({ id: 'agent_custom_1', metadata: { purpose: 'custom' } }),
      ),
    });
    expect(await screen.findByTestId('agent-detail-delete')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-detail-reset')).not.toBeInTheDocument();
  });

  it('削除確認 → 「削除する」で onDelete が呼ばれる', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const { user } = renderModal({
      mode: { kind: 'edit', agent: makeCustomAgentRecord() },
      fetchAgent: vi.fn().mockResolvedValue(
        makeAnthropicAgent({ id: 'agent_custom_1', metadata: { purpose: 'custom' } }),
      ),
      onDelete,
    });
    await user.click(await screen.findByTestId('agent-detail-delete'));
    await user.click(screen.getByTestId('agent-detail-delete-confirm-yes'));
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
  });
});

describe('AgentDetailModal — create mode', () => {
  const templates: AgentRecord[] = [
    makeBuiltInAgentRecord(),
    makeBuiltInAgentRecord({
      id: 'agent_cust_o',
      name: 'Customizer (Opus)',
      purpose: 'customizer-opus',
      model: 'opus',
      modelLabel: 'OPUS',
    }),
  ];

  it('雛形プルダウンが表示され、最初の template で form が初期化される', async () => {
    const fetchAgent = vi.fn().mockResolvedValue(makeAnthropicAgent());
    renderModal({
      mode: { kind: 'create', templates },
      fetchAgent,
    });
    expect(await screen.findByTestId('agent-detail-template')).toBeInTheDocument();
    await waitFor(() => expect(fetchAgent).toHaveBeenCalledWith('agent_biz_1'));
    const name = (await screen.findByTestId('agent-detail-name')) as HTMLInputElement;
    // create モードで name に「 のコピー」suffix
    expect(name.value).toBe('業務エージェント のコピー');
  });

  it('雛形変更で fetchAgent が再呼出される', async () => {
    const fetchAgent = vi
      .fn()
      .mockResolvedValueOnce(makeAnthropicAgent())
      .mockResolvedValueOnce(
        makeAnthropicAgent({ id: 'agent_cust_o', name: 'Customizer (Opus)', system: 'cust prompt' }),
      );
    const { user } = renderModal({
      mode: { kind: 'create', templates },
      fetchAgent,
    });
    await screen.findByTestId('agent-detail-system');
    const sel = screen.getByTestId('agent-detail-template');
    await user.selectOptions(sel, 'agent_cust_o');
    await waitFor(() => expect(fetchAgent).toHaveBeenCalledWith('agent_cust_o'));
    await waitFor(() => {
      const sys = screen.getByTestId('agent-detail-system') as HTMLTextAreaElement;
      expect(sys.value).toBe('cust prompt');
    });
  });

  it('保存で onSave が (draft, sourceAgent=雛形) で呼ばれる', async () => {
    const { user, onSave } = renderModal({
      mode: { kind: 'create', templates },
      fetchAgent: vi.fn().mockResolvedValue(makeAnthropicAgent()),
    });
    await screen.findByTestId('agent-detail-system');
    await user.click(screen.getByTestId('agent-detail-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const [, sourceAgent] = onSave.mock.calls[0]!;
    expect(sourceAgent.id).toBe('agent_biz_1');
  });

  it('雛形を切替えて保存すると sourceAgent も切替後の Agent', async () => {
    const fetchAgent = vi
      .fn()
      .mockResolvedValueOnce(makeAnthropicAgent())
      .mockResolvedValueOnce(makeAnthropicAgent({ id: 'agent_cust_o' }));
    const { user, onSave } = renderModal({
      mode: { kind: 'create', templates },
      fetchAgent,
    });
    await screen.findByTestId('agent-detail-system');
    await user.selectOptions(screen.getByTestId('agent-detail-template'), 'agent_cust_o');
    await waitFor(() => expect(fetchAgent).toHaveBeenCalledWith('agent_cust_o'));
    await user.click(screen.getByTestId('agent-detail-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const [, sourceAgent] = onSave.mock.calls[0]!;
    expect(sourceAgent.id).toBe('agent_cust_o');
  });
});

describe('AgentDetailModal — quickActions 編集 (#45)', () => {
  it('quickActions textarea が描画される (1 行 1 件、placeholder 付き)', async () => {
    renderModal();
    const ta = (await screen.findByTestId(
      'agent-detail-quick-actions',
    )) as HTMLTextAreaElement;
    expect(ta).toBeInTheDocument();
    expect(ta.placeholder).toMatch(/例:/);
  });

  it('入力すると draft.quickActions が空行除去・trim 済みで反映され、保存時に渡る', async () => {
    const { user, onSave } = renderModal({
      mode: {
        kind: 'edit',
        agent: makeBuiltInAgentRecord({
          source: 'custom',
          purpose: 'custom',
          quickActions: [],
          allowedUsers: [],
          allowedGroups: [],
          allowedOrganizations: [],
        }),
      },
    });
    const ta = (await screen.findByTestId(
      'agent-detail-quick-actions',
    )) as HTMLTextAreaElement;
    await user.clear(ta);
    await user.type(ta, 'アプリ一覧を見せて\n\n  案件を集計して  \n');
    await user.click(screen.getByTestId('agent-detail-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const [draft] = onSave.mock.calls[0]!;
    expect(draft.quickActions).toEqual(['アプリ一覧を見せて', '案件を集計して']);
  });

  it('6 行を超えると警告メッセージ + 保存時に 5 件まで切詰められる', async () => {
    const { user, onSave } = renderModal({
      mode: {
        kind: 'edit',
        agent: makeBuiltInAgentRecord({
          source: 'custom',
          purpose: 'custom',
          quickActions: [],
          allowedUsers: [],
          allowedGroups: [],
          allowedOrganizations: [],
        }),
      },
    });
    const ta = (await screen.findByTestId(
      'agent-detail-quick-actions',
    )) as HTMLTextAreaElement;
    await user.clear(ta);
    await user.type(ta, ['a', 'b', 'c', 'd', 'e', 'f'].join('\n'));
    expect(screen.getByTestId('agent-detail-quick-actions-errors')).toBeInTheDocument();
    await user.click(screen.getByTestId('agent-detail-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const [draft] = onSave.mock.calls[0]!;
    expect(draft.quickActions).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('1 行が 200 文字を超えると警告メッセージが出る', async () => {
    const { user } = renderModal({
      mode: {
        kind: 'edit',
        agent: makeBuiltInAgentRecord({
          source: 'custom',
          purpose: 'custom',
          quickActions: [],
          allowedUsers: [],
          allowedGroups: [],
          allowedOrganizations: [],
        }),
      },
    });
    const ta = (await screen.findByTestId(
      'agent-detail-quick-actions',
    )) as HTMLTextAreaElement;
    await user.clear(ta);
    await user.type(ta, 'x'.repeat(201));
    const errors = screen.getByTestId('agent-detail-quick-actions-errors');
    expect(errors.textContent).toMatch(/200 文字/);
  });
});

describe('AgentDetailModal — error handling', () => {
  it('fetchAgent reject で error 表示', async () => {
    renderModal({
      fetchAgent: vi.fn().mockRejectedValue(new Error('upstream 503')),
    });
    expect(await screen.findByText(/upstream 503/)).toBeInTheDocument();
  });

  it('onSave reject で error banner + form 値保持', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('forbidden'));
    const { user } = renderModal({ onSave });
    await screen.findByTestId('agent-detail-system');
    await user.click(screen.getByTestId('agent-detail-save'));
    expect(await screen.findByText(/forbidden/)).toBeInTheDocument();
    // form 値は維持される (name のまま)
    const name = screen.getByTestId('agent-detail-name') as HTMLInputElement;
    expect(name.value).toBe('業務エージェント');
  });
});
