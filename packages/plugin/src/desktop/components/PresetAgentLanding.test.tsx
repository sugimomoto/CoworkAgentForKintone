// PresetAgentLanding のテスト
//
// 仕様: .steering/20260606-preset-agents-one-click/{requirements,design,tasklist}.md

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PresetAgentLanding } from './PresetAgentLanding';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';

function makeAgent(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: 'a',
    name: 'Agent',
    model: 'sonnet',
    modelLabel: 'SONNET',
    description: 'desc',
    purpose: 'business',
    iconKind: 'biz',
    iconColor: 'accentSoft',
    visibility: 'public',
    isDefault: false,
    source: 'builtin',
    quickActions: [],
    ...overrides,
  };
}

const THREE_AGENTS: AgentRecord[] = [
  makeAgent({
    id: 'biz',
    name: '業務エージェント',
    description: 'レコード操作',
    quickActions: ['アプリ一覧を見せて', '案件を集計して'],
  }),
  makeAgent({
    id: 'cust-opus',
    name: 'カスタマイザー',
    model: 'opus',
    modelLabel: 'OPUS',
    description: 'JS カスタマイズ',
    iconKind: 'cust',
    iconColor: 'accent',
    isDefault: true,
    quickActions: ['空フィールドで保存をブロックする JS', '色分けの JS'],
  }),
  makeAgent({
    id: 'cust-sonnet',
    name: 'カスタマイザー (高速)',
    description: 'JS カスタマイズ — 高速',
    iconKind: 'cust',
    iconColor: 'accent',
    quickActions: [],
  }),
];

describe('PresetAgentLanding', () => {
  it('T1: isDefault のエージェント (cust-opus) が初期展開される', () => {
    render(
      <PresetAgentLanding
        agents={THREE_AGENTS}
        onSelectPrompt={vi.fn()}
        onSelectAgentForFreeInput={vi.fn()}
      />,
    );
    const allRows = screen.getAllByTestId('preset-agent-row');
    const openRows = allRows.filter((r) => r.getAttribute('data-open') === 'true');
    expect(openRows).toHaveLength(1);
    expect(openRows[0]!.getAttribute('data-agent-id')).toBe('cust-opus');
    // 開いた行のプロンプトが見える
    expect(within(openRows[0]!).queryAllByTestId('preset-prompt').length).toBeGreaterThan(0);
  });

  it('T2: 別の行ヘッダーをクリックすると排他的に切替わる', async () => {
    const user = userEvent.setup();
    render(
      <PresetAgentLanding
        agents={THREE_AGENTS}
        onSelectPrompt={vi.fn()}
        onSelectAgentForFreeInput={vi.fn()}
      />,
    );
    const bizRow = screen.getAllByTestId('preset-agent-row').find(
      (r) => r.getAttribute('data-agent-id') === 'biz',
    )!;
    await user.click(within(bizRow).getByRole('button'));
    // biz が開き、cust-opus は閉じる
    expect(bizRow.getAttribute('data-open')).toBe('true');
    const opusRow = screen.getAllByTestId('preset-agent-row').find(
      (r) => r.getAttribute('data-agent-id') === 'cust-opus',
    )!;
    expect(opusRow.getAttribute('data-open')).toBe('false');
  });

  it('T3: クイックアクションボタン押下で onSelectPrompt(agent, prompt) が 1 回呼ばれる', async () => {
    const onSelectPrompt = vi.fn();
    const user = userEvent.setup();
    render(
      <PresetAgentLanding
        agents={THREE_AGENTS}
        onSelectPrompt={onSelectPrompt}
        onSelectAgentForFreeInput={vi.fn()}
      />,
    );
    // cust-opus が初期展開なので最初のプロンプトを押す
    const buttons = screen.getAllByTestId('preset-prompt');
    await user.click(buttons[0]!);
    expect(onSelectPrompt).toHaveBeenCalledTimes(1);
    const [agent, prompt] = onSelectPrompt.mock.calls[0]!;
    expect((agent as AgentRecord).id).toBe('cust-opus');
    expect(prompt).toBe('空フィールドで保存をブロックする JS');
  });

  it('T4/T5: quickActions 0 個の行を開くと EmptyPromptsCTA が出て、押下で onSelectAgentForFreeInput が呼ばれる', async () => {
    const onSelectPrompt = vi.fn();
    const onSelectAgentForFreeInput = vi.fn();
    const user = userEvent.setup();
    render(
      <PresetAgentLanding
        agents={THREE_AGENTS}
        onSelectPrompt={onSelectPrompt}
        onSelectAgentForFreeInput={onSelectAgentForFreeInput}
      />,
    );
    const sonnetRow = screen.getAllByTestId('preset-agent-row').find(
      (r) => r.getAttribute('data-agent-id') === 'cust-sonnet',
    )!;
    await user.click(within(sonnetRow).getByRole('button'));
    const cta = within(sonnetRow).getByTestId('preset-empty-cta');
    expect(cta).toBeInTheDocument();
    await user.click(within(cta).getByRole('button'));
    expect(onSelectAgentForFreeInput).toHaveBeenCalledTimes(1);
    expect((onSelectAgentForFreeInput.mock.calls[0]![0] as AgentRecord).id).toBe('cust-sonnet');
    expect(onSelectPrompt).not.toHaveBeenCalled();
  });

  it('T6: エージェント 1 個のみ → SinglePresetView レイアウト (data-single=true)', () => {
    render(
      <PresetAgentLanding
        agents={[THREE_AGENTS[0]!]}
        onSelectPrompt={vi.fn()}
        onSelectAgentForFreeInput={vi.fn()}
      />,
    );
    const landing = screen.getByTestId('preset-agent-landing');
    expect(landing.getAttribute('data-single')).toBe('true');
    // アコーディオン行は出ない
    expect(screen.queryAllByTestId('preset-agent-row')).toHaveLength(0);
    // プロンプトボタンは出る
    expect(screen.getAllByTestId('preset-prompt')).toHaveLength(2);
  });

  it('T7/T8: エージェント 7 個 → 検索ボックスが自動表示され、filter が効く', async () => {
    const sevenAgents = [
      ...THREE_AGENTS,
      makeAgent({ id: 'a4', name: '営業分析', description: 'KPI 集計' }),
      makeAgent({ id: 'a5', name: 'ドキュメント作成', description: '議事録の自動作成' }),
      makeAgent({ id: 'a6', name: 'メール下書き', description: '顧客メール' }),
      makeAgent({ id: 'a7', name: '受発注オペ', description: '在庫管理' }),
    ];
    const user = userEvent.setup();
    render(
      <PresetAgentLanding
        agents={sevenAgents}
        onSelectPrompt={vi.fn()}
        onSelectAgentForFreeInput={vi.fn()}
      />,
    );
    const search = screen.getByLabelText('エージェントを検索');
    expect(search).toBeInTheDocument();
    await user.type(search, '営業');
    const rows = screen.getAllByTestId('preset-agent-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.getAttribute('data-agent-id')).toBe('a4');
  });

  it('T9: visibility=private のエージェントは一覧に出ない', () => {
    const withPrivate: AgentRecord[] = [
      ...THREE_AGENTS,
      makeAgent({ id: 'hidden', name: '隠れエージェント', visibility: 'private' }),
    ];
    render(
      <PresetAgentLanding
        agents={withPrivate}
        onSelectPrompt={vi.fn()}
        onSelectAgentForFreeInput={vi.fn()}
      />,
    );
    expect(screen.queryByText('隠れエージェント')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('preset-agent-row')).toHaveLength(3);
  });

  it('T10: 行ヘッダー button に aria-expanded が反映される', async () => {
    const user = userEvent.setup();
    render(
      <PresetAgentLanding
        agents={THREE_AGENTS}
        onSelectPrompt={vi.fn()}
        onSelectAgentForFreeInput={vi.fn()}
      />,
    );
    const bizRow = screen.getAllByTestId('preset-agent-row').find(
      (r) => r.getAttribute('data-agent-id') === 'biz',
    )!;
    const header = within(bizRow).getByRole('button');
    expect(header.getAttribute('aria-expanded')).toBe('false');
    await user.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('true');
  });

  it('検索 hit ゼロ → preset-search-empty メッセージ', async () => {
    const user = userEvent.setup({ delay: null });
    const sevenAgents = THREE_AGENTS.concat(
      [4, 5, 6, 7].map((i) => makeAgent({ id: `x${i}`, name: `X-${i}` })),
    );
    render(
      <PresetAgentLanding
        agents={sevenAgents}
        onSelectPrompt={vi.fn()}
        onSelectAgentForFreeInput={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText('エージェントを検索'), '存在しないキーワード');
    expect(screen.getByTestId('preset-search-empty')).toBeInTheDocument();
  });

  it('public エージェントが 0 個 → null を返す (親側 WelcomeMessage にフォールバックする想定)', () => {
    const { container } = render(
      <PresetAgentLanding
        agents={[makeAgent({ visibility: 'private' })]}
        onSelectPrompt={vi.fn()}
        onSelectAgentForFreeInput={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
