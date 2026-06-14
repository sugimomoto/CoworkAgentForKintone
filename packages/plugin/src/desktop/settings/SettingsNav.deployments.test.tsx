// #81: SettingsNav のロール出し分け。非 admin は「定期実行」のみ。

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SettingsNav } from './SettingsNav';

describe('SettingsNav role 出し分け', () => {
  it('admin は全セクション + 定期実行', () => {
    render(<SettingsNav section="agents" onSection={vi.fn()} isAdmin />);
    expect(screen.getByTestId('settings-nav-agents')).toBeInTheDocument();
    expect(screen.getByTestId('settings-nav-skills')).toBeInTheDocument();
    expect(screen.getByTestId('settings-nav-deployments')).toBeInTheDocument();
    expect(screen.getByTestId('settings-nav-mcp')).toBeInTheDocument();
  });

  it('非 admin は定期実行のみ', () => {
    render(<SettingsNav section="deployments" onSection={vi.fn()} isAdmin={false} />);
    expect(screen.getByTestId('settings-nav-deployments')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-nav-agents')).toBeNull();
    expect(screen.queryByTestId('settings-nav-skills')).toBeNull();
    expect(screen.queryByTestId('settings-nav-mcp')).toBeNull();
  });
});
