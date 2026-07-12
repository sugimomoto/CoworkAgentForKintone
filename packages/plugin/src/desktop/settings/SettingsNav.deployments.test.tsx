// #81: SettingsNav のロール出し分け。非 admin は「定期実行」のみ。

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SettingsNav } from './SettingsNav';

describe('SettingsNav role 出し分け', () => {
  it('admin は全セクション + 定期実行 + メモリ', () => {
    render(<SettingsNav section="agents" onSection={vi.fn()} isAdmin />);
    expect(screen.getByTestId('settings-nav-agents')).toBeInTheDocument();
    expect(screen.getByTestId('settings-nav-skills')).toBeInTheDocument();
    expect(screen.getByTestId('settings-nav-deployments')).toBeInTheDocument();
    expect(screen.getByTestId('settings-nav-memory')).toBeInTheDocument();
    expect(screen.getByTestId('settings-nav-mcp')).toBeInTheDocument();
  });

  it('非 admin は per-user の「定期実行」「メモリ」のみ (admin 専用は非表示)', () => {
    render(<SettingsNav section="memory" onSection={vi.fn()} isAdmin={false} />);
    expect(screen.getByTestId('settings-nav-deployments')).toBeInTheDocument();
    expect(screen.getByTestId('settings-nav-memory')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-nav-agents')).toBeNull();
    expect(screen.queryByTestId('settings-nav-skills')).toBeNull();
    expect(screen.queryByTestId('settings-nav-mcp')).toBeNull();
  });

  it('メモリ項目は per-user を示す「自分」バッジを出す', () => {
    render(<SettingsNav section="memory" onSection={vi.fn()} isAdmin={false} />);
    expect(screen.getByText('自分')).toBeInTheDocument();
  });
});
