import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeploymentsListPane } from './DeploymentsListPane';

import type { DeploymentView } from '../../core/deployments/view';

function mkView(over: Partial<DeploymentView> = {}): DeploymentView {
  return {
    id: 'depl_1',
    name: '毎朝集計',
    agentId: 'agent_1',
    cron: '0 9 * * *',
    tz: 'Asia/Tokyo',
    initialMessage: '集計して',
    status: 'active',
    owner: 'sato',
    upcomingRunsAt: ['2030-06-15T00:00:00Z'],
    ...over,
  };
}

function baseProps(over: Partial<React.ComponentProps<typeof DeploymentsListPane>> = {}) {
  return {
    deployments: [mkView()],
    agents: [],
    isAdmin: false,
    currentUser: 'sato',
    scope: 'all' as const,
    onScopeChange: vi.fn(),
    scopeCounts: { all: 1, mine: 1 },
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onRun: vi.fn().mockResolvedValue(undefined),
    onToggleStatus: vi.fn().mockResolvedValue(undefined),
    onArchive: vi.fn().mockResolvedValue(undefined),
    onOpenHistory: vi.fn(),
    ...over,
  };
}

describe('DeploymentsListPane', () => {
  it('空配列で空状態を出す', () => {
    render(<DeploymentsListPane {...baseProps({ deployments: [] })} />);
    expect(screen.getByTestId('deployments-empty')).toBeInTheDocument();
  });

  it('行と人間可読スケジュールを表示', () => {
    render(<DeploymentsListPane {...baseProps()} />);
    expect(screen.getByTestId('deployment-row-depl_1')).toBeInTheDocument();
    expect(screen.getByText('毎日 9:00')).toBeInTheDocument();
  });

  it('非 admin はスコープ pill / 所有者を出さない', () => {
    render(<DeploymentsListPane {...baseProps({ isAdmin: false })} />);
    expect(screen.queryByTestId('deployment-scope-all')).toBeNull();
    expect(screen.queryByText('sato')).toBeNull();
  });

  it('admin はスコープ pill と所有者を出す', () => {
    render(<DeploymentsListPane {...baseProps({ isAdmin: true })} />);
    expect(screen.getByTestId('deployment-scope-all')).toBeInTheDocument();
    expect(screen.getByText('sato')).toBeInTheDocument();
  });

  it('新規作成ボタンで onCreate', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<DeploymentsListPane {...baseProps({ onCreate })} />);
    await user.click(screen.getByTestId('deployment-create-btn'));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('アーカイブで確認ダイアログ → 確定で onArchive', async () => {
    const onArchive = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DeploymentsListPane {...baseProps({ onArchive })} />);
    await user.click(screen.getByTestId('deployment-archive-depl_1'));
    expect(screen.getByTestId('deployment-archive-confirm')).toBeInTheDocument();
    await user.click(screen.getByTestId('deployment-archive-confirm-btn'));
    expect(onArchive).toHaveBeenCalledOnce();
  });

  it('paused 行は一時停止バナーを出す', () => {
    render(
      <DeploymentsListPane
        {...baseProps({ deployments: [mkView({ status: 'paused', pausedReason: 'manual' })] })}
      />,
    );
    expect(screen.getByText(/一時停止中/)).toBeInTheDocument();
  });
});
