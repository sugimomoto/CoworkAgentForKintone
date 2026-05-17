// Header (案 C 2 段構成) のテスト
//
// admin / 非 admin で Gear の有無、Agent 切替で onSelectAgent 発火、
// AgentPicker 統合 (visibility filter, ModelBadge) を検証。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Header } from './Header';

import type { AgentRecord } from '../core/bootstrap/agentTypes';

function makeAgent(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: 'agent_default',
    name: 'カスタマイザーエージェント',
    model: 'opus',
    modelLabel: 'OPUS',
    description: 'JS カスタマイズ / Plugin 開発',
    purpose: 'customizer-opus',
    iconKind: 'cust',
    iconColor: 'accent',
    visibility: 'public',
    isDefault: true,
    variantGroup: 'customizer',
    source: 'builtin',
    ...overrides,
  };
}

const AGENTS: AgentRecord[] = [
  makeAgent({ id: 'biz', name: '業務エージェント', model: 'sonnet', modelLabel: 'SONNET', purpose: 'business', iconKind: 'biz', iconColor: 'accentSoft', isDefault: false }),
  makeAgent({ id: 'cust-opus', isDefault: true }),
  makeAgent({ id: 'cust-sonnet', name: 'カスタマイザーエージェント', model: 'sonnet', modelLabel: 'SONNET', purpose: 'customizer-sonnet', isDefault: false }),
];

describe('Header (Customizer wedge V1)', () => {
  it('上段に "Cowork Agent" + "for kintone" バッジ表示', () => {
    render(
      <Header agents={AGENTS} currentAgentId="cust-opus" onSelectAgent={vi.fn()} isAdmin={false} />,
    );
    expect(screen.getByText('Cowork Agent')).toBeInTheDocument();
    expect(screen.getByText('for kintone')).toBeInTheDocument();
  });

  it('admin=true なら Gear (設定) ボタンが表示される', () => {
    render(
      <Header
        agents={AGENTS}
        currentAgentId="cust-opus"
        onSelectAgent={vi.fn()}
        isAdmin={true}
        onSettingsClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId('header-gear')).toBeInTheDocument();
  });

  it('admin=false なら Gear ボタンは表示されない', () => {
    render(
      <Header
        agents={AGENTS}
        currentAgentId="cust-opus"
        onSelectAgent={vi.fn()}
        isAdmin={false}
        onSettingsClick={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('header-gear')).toBeNull();
  });

  it('onSettingsClick が未指定なら admin=true でも Gear は表示されない', () => {
    render(
      <Header
        agents={AGENTS}
        currentAgentId="cust-opus"
        onSelectAgent={vi.fn()}
        isAdmin={true}
      />,
    );
    expect(screen.queryByTestId('header-gear')).toBeNull();
  });

  it('Gear クリックで onSettingsClick が呼ばれる', async () => {
    const onSettingsClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Header
        agents={AGENTS}
        currentAgentId="cust-opus"
        onSelectAgent={vi.fn()}
        isAdmin={true}
        onSettingsClick={onSettingsClick}
      />,
    );
    await user.click(screen.getByTestId('header-gear'));
    expect(onSettingsClick).toHaveBeenCalledOnce();
  });

  it('閉じるボタンクリックで onClose が呼ばれる', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Header
        agents={AGENTS}
        currentAgentId="cust-opus"
        onSelectAgent={vi.fn()}
        isAdmin={false}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByTestId('header-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('AgentPicker は下段に統合され、現在の Agent 名 + MODEL バッジを表示', () => {
    render(
      <Header agents={AGENTS} currentAgentId="cust-opus" onSelectAgent={vi.fn()} isAdmin={false} />,
    );
    expect(screen.getByTestId('agent-picker')).toBeInTheDocument();
    // 下段の trigger button に現在 Agent の名前が出る (内部に複数 'カスタマイザーエージェント' があるので getAll)
    expect(screen.getAllByText('カスタマイザーエージェント').length).toBeGreaterThan(0);
    // OPUS バッジ
    const badges = screen.getAllByTestId('model-badge');
    expect(badges.some((b) => b.textContent === 'OPUS')).toBe(true);
  });

  it('AgentPicker クリックで onSelectAgent (異なる Agent ID) が発火', async () => {
    const onSelectAgent = vi.fn();
    const user = userEvent.setup();
    render(
      <Header
        agents={AGENTS}
        currentAgentId="cust-opus"
        onSelectAgent={onSelectAgent}
        isAdmin={false}
      />,
    );
    await user.click(screen.getByTestId('agent-picker-trigger'));
    await user.click(screen.getByTestId('agent-picker-item-biz'));
    expect(onSelectAgent).toHaveBeenCalledWith('biz');
  });

  it('Memory トグルは V1 で disabled placeholder として表示される', () => {
    render(
      <Header agents={AGENTS} currentAgentId="cust-opus" onSelectAgent={vi.fn()} isAdmin={false} />,
    );
    const toggle = screen.getByTestId('memory-toggle');
    expect(toggle.getAttribute('data-enabled')).toBe('0');
    expect(toggle).toBeDisabled();
  });
});
