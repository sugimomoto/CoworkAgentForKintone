import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeploymentDetailModal } from './DeploymentDetailModal';

import type { AgentRecord } from '../../../core/bootstrap/agentTypes';

const AGENTS = [
  { id: 'agent_1', name: '業務エージェント', iconKind: 'biz', iconColor: 'accent', model: 'claude-sonnet-4-6' },
] as unknown as AgentRecord[];

describe('DeploymentDetailModal', () => {
  it('作成モードは既定プリセット daily で cron 0 9 * * * を生成', () => {
    render(
      <DeploymentDetailModal mode={{ kind: 'create' }} agents={AGENTS} onSave={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByTestId('schedule-cron-out')).toHaveTextContent('0 9 * * *');
  });

  it('名前・メッセージが空だと保存 disable、埋めると有効化', async () => {
    const user = userEvent.setup();
    render(
      <DeploymentDetailModal mode={{ kind: 'create' }} agents={AGENTS} onSave={vi.fn()} onClose={vi.fn()} />,
    );
    const save = screen.getByTestId('deployment-save');
    expect(save).toBeDisabled();
    await user.type(screen.getByTestId('deployment-name'), '毎朝集計');
    await user.type(screen.getByTestId('deployment-message'), '集計して');
    expect(save).toBeEnabled();
  });

  it('カスタムで無効な cron だと保存 disable', async () => {
    const user = userEvent.setup();
    render(
      <DeploymentDetailModal mode={{ kind: 'create' }} agents={AGENTS} onSave={vi.fn()} onClose={vi.fn()} />,
    );
    await user.type(screen.getByTestId('deployment-name'), 'x');
    await user.type(screen.getByTestId('deployment-message'), 'y');
    await user.click(screen.getByTestId('schedule-preset-custom'));
    await user.clear(screen.getByTestId('schedule-custom-cron'));
    await user.type(screen.getByTestId('schedule-custom-cron'), 'bad');
    expect(screen.getByTestId('deployment-save')).toBeDisabled();
  });

  it('保存で onSave に draft が渡る', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <DeploymentDetailModal mode={{ kind: 'create' }} agents={AGENTS} onSave={onSave} onClose={vi.fn()} />,
    );
    await user.type(screen.getByTestId('deployment-name'), '毎朝集計');
    await user.type(screen.getByTestId('deployment-message'), '集計して');
    await user.click(screen.getByTestId('deployment-save'));
    expect(onSave).toHaveBeenCalledOnce();
    const [draft, mode] = onSave.mock.calls[0]!;
    expect(draft.name).toBe('毎朝集計');
    expect(draft.agentId).toBe('agent_1');
    expect(mode.kind).toBe('create');
  });
});
