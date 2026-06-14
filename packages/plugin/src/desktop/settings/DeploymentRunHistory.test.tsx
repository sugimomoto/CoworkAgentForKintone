import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { makeDeploymentRun } from '../../test/fixtures';

import { DeploymentRunHistory } from './DeploymentRunHistory';

import type { DeploymentView } from '../../core/deployments/view';

const VIEW: DeploymentView = {
  id: 'depl_1',
  name: '毎朝集計',
  agentId: 'agent_1',
  cron: '0 9 * * *',
  tz: 'Asia/Tokyo',
  initialMessage: '集計して',
  status: 'active',
  owner: 'sato',
  upcomingRunsAt: [],
};

function baseProps(over: Partial<React.ComponentProps<typeof DeploymentRunHistory>> = {}) {
  return {
    deployment: VIEW,
    runs: [makeDeploymentRun({ id: 'r1', session_id: 'sess_9' })],
    loading: false,
    filter: 'all' as const,
    onFilterChange: vi.fn(),
    onBack: vi.fn(),
    ...over,
  };
}

describe('DeploymentRunHistory', () => {
  it('run 行を表示し、失敗のみフィルタ pill がある', () => {
    render(<DeploymentRunHistory {...baseProps()} />);
    expect(screen.getByTestId('run-row-r1')).toBeInTheDocument();
    expect(screen.getByTestId('deployment-history-filter-failed')).toBeInTheDocument();
  });

  it('onOpenSession 指定時は「会話を開く →」で session_id を渡す', async () => {
    const onOpenSession = vi.fn();
    const user = userEvent.setup();
    render(<DeploymentRunHistory {...baseProps({ onOpenSession })} />);
    await user.click(screen.getByTestId('run-open-session-r1'));
    expect(onOpenSession).toHaveBeenCalledWith('sess_9');
  });

  it('onOpenSession 未指定なら session_id をテキスト表示 (ボタンなし)', () => {
    render(<DeploymentRunHistory {...baseProps()} />);
    expect(screen.queryByTestId('run-open-session-r1')).toBeNull();
    expect(screen.getByText('sess_9')).toBeInTheDocument();
  });
});
