// AgentsListPane のテスト
//
// chatStore.builtInAgents を読んで Built-in 3 variant を表示する。
// 公開トグルクリックで onToggleVisibility callback が呼ばれる。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../store/chatStore';

import { AgentsListPane } from './AgentsListPane';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';

function makeAgent(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: 'agent_x',
    name: 'Agent',
    model: 'sonnet',
    modelLabel: 'SONNET',
    description: 'test agent',
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
});

describe('AgentsListPane', () => {
  it('builtInAgents が空なら "読み込み中" を表示', () => {
    render(<AgentsListPane />);
    expect(screen.getByText('エージェントを読み込み中…')).toBeInTheDocument();
  });

  it('builtInAgents 3 variant を一覧表示', () => {
    useChatStore.getState().setBuiltInAgents([
      makeAgent({ id: 'biz', name: '業務エージェント' }),
      makeAgent({
        id: 'opus',
        name: 'カスタマイザーエージェント',
        model: 'opus',
        modelLabel: 'OPUS',
        purpose: 'customizer-opus',
        iconKind: 'cust',
        iconColor: 'accent',
        isDefault: true,
      }),
      makeAgent({
        id: 'sonnet',
        name: 'カスタマイザーエージェント',
        purpose: 'customizer-sonnet',
        iconKind: 'cust',
        iconColor: 'accent',
      }),
    ]);
    render(<AgentsListPane />);
    expect(screen.getByTestId('agent-row-biz')).toBeInTheDocument();
    expect(screen.getByTestId('agent-row-opus')).toBeInTheDocument();
    expect(screen.getByTestId('agent-row-sonnet')).toBeInTheDocument();
  });

  it('isDefault=true の Agent には "既定" バッジが付く', () => {
    useChatStore.getState().setBuiltInAgents([
      makeAgent({ id: 'opus', isDefault: true }),
    ]);
    render(<AgentsListPane />);
    expect(screen.getByText('既定')).toBeInTheDocument();
  });

  it('公開トグルクリックで onToggleVisibility (next=private) が呼ばれる', async () => {
    useChatStore.getState().setBuiltInAgents([makeAgent({ id: 'biz', visibility: 'public' })]);
    const onToggle = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AgentsListPane onToggleVisibility={onToggle} />);
    await user.click(screen.getByTestId('agent-visibility-biz'));
    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'biz', visibility: 'public' }),
      'private',
    );
  });

  it('visibility=private の Agent は "非公開" ラベルが表示され toggle が off', () => {
    useChatStore.getState().setBuiltInAgents([
      makeAgent({ id: 'biz', visibility: 'private' }),
    ]);
    render(<AgentsListPane />);
    const toggle = screen.getByTestId('agent-visibility-biz') as HTMLInputElement;
    expect(toggle.getAttribute('data-visibility')).toBe('private');
    expect(toggle.checked).toBe(false);
    expect(screen.getByText('非公開')).toBeInTheDocument();
  });

  it('onToggleVisibility 未指定ならトグルは disabled', () => {
    useChatStore.getState().setBuiltInAgents([makeAgent({ id: 'biz' })]);
    render(<AgentsListPane />);
    expect(screen.getByTestId('agent-visibility-biz')).toBeDisabled();
  });

  it('onToggleVisibility が reject すると row 内に error が表示される', async () => {
    useChatStore.getState().setBuiltInAgents([makeAgent({ id: 'biz', visibility: 'public' })]);
    const onToggle = vi.fn().mockRejectedValue(new Error('403 forbidden'));
    const user = userEvent.setup();
    render(<AgentsListPane onToggleVisibility={onToggle} />);
    await user.click(screen.getByTestId('agent-visibility-biz'));
    expect(await screen.findByText('403 forbidden')).toBeInTheDocument();
  });

  it('Built-in Agent には skill/tool count + variant id footer が表示される', () => {
    useChatStore.getState().setBuiltInAgents([
      makeAgent({ id: 'agent_01HXabcd123', purpose: 'business' }),
    ]);
    render(<AgentsListPane />);
    // skill count = anthropicSkillIds (4: xlsx/docx/pdf/pptx) + customSkillFilter (business は 0)
    expect(screen.getByText(/スキル\s+\d+/)).toBeInTheDocument();
    expect(screen.getByText(/ツール\s+\d+/)).toBeInTheDocument();
    // variant id = agent.id の末尾 6 文字に v_ prefix
    expect(screen.getByText(/v_[a-zA-Z0-9]{6}/)).toBeInTheDocument();
  });

  it('編集→ ボタンは onEditAgent 未指定なら disabled (V1 互換), 指定時は enabled + click で呼出', async () => {
    useChatStore.getState().setBuiltInAgents([makeAgent({ id: 'biz' })]);
    const { rerender } = render(<AgentsListPane />);
    expect(screen.getByTestId('agent-edit-biz')).toBeDisabled();

    const onEditAgent = vi.fn();
    rerender(<AgentsListPane onEditAgent={onEditAgent} />);
    const editBtn = screen.getByTestId('agent-edit-biz');
    expect(editBtn).not.toBeDisabled();
    const user = userEvent.setup();
    await user.click(editBtn);
    expect(onEditAgent).toHaveBeenCalledWith(expect.objectContaining({ id: 'biz' }));
  });

  it('カスタム エージェント section: Custom が無ければ empty placeholder + 追加ボタン (onCreateAgent 指定時)', async () => {
    useChatStore.getState().setBuiltInAgents([makeAgent({ id: 'biz' })]);
    const onCreateAgent = vi.fn();
    render(<AgentsListPane onCreateAgent={onCreateAgent} />);
    expect(screen.getByTestId('custom-agents-empty')).toBeInTheDocument();
    const addBtn = screen.getByTestId('agent-create-btn');
    expect(addBtn).not.toBeDisabled();
    const user = userEvent.setup();
    await user.click(addBtn);
    expect(onCreateAgent).toHaveBeenCalledOnce();
  });

  it('カスタム エージェントがあれば一覧に表示される (Built-in と分離)', () => {
    useChatStore.getState().setBuiltInAgents([
      makeAgent({ id: 'biz', source: 'builtin' }),
      makeAgent({
        id: 'custom_1',
        name: 'My Custom',
        source: 'custom',
        purpose: 'custom',
      }),
    ]);
    render(<AgentsListPane />);
    expect(screen.getByTestId('agent-row-biz')).toBeInTheDocument();
    expect(screen.getByTestId('agent-row-custom_1')).toBeInTheDocument();
    // empty placeholder は出ない
    expect(screen.queryByTestId('custom-agents-empty')).not.toBeInTheDocument();
  });

  // #47 AC-6: Custom Agent 行にも公開先サマリが出る (counts=null でも表示)
  it('Custom Agent 行に公開先サマリが表示される', () => {
    useChatStore.getState().setBuiltInAgents([
      makeAgent({ id: 'biz', source: 'builtin' }),
      makeAgent({
        id: 'custom_1',
        name: 'My Custom',
        source: 'custom',
        purpose: 'custom',
        allowedUsers: ['sales01', 'sales02'],
      }),
    ]);
    render(<AgentsListPane />);
    const summary = screen.getByTestId('agent-access-custom_1');
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent('公開先:');
    // 全員ではなく絞り込み済みの表現になっている
    expect(summary).not.toHaveTextContent('公開先: 全員');
  });
});
