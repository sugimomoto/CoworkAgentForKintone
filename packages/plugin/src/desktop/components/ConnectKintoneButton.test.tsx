import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConnectKintoneButton } from './ConnectKintoneButton';

describe('ConnectKintoneButton', () => {
  it("status='unbound': ボタンが表示され、クリックで onConnect を呼ぶ", () => {
    const onConnect = vi.fn();
    render(<ConnectKintoneButton status="unbound" onConnect={onConnect} />);

    const btn = screen.getByRole('button', { name: /kintone と連携/ });
    fireEvent.click(btn);
    expect(onConnect).toHaveBeenCalled();
  });

  it("status='binding': スピナー + 文言、クリック不可", () => {
    const onConnect = vi.fn();
    render(<ConnectKintoneButton status="binding" onConnect={onConnect} />);

    expect(screen.getByText(/認可中/)).toBeInTheDocument();
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("status='error': エラー表示 + 再試行ボタン", () => {
    const onConnect = vi.fn();
    render(<ConnectKintoneButton status="error" error="auth failed" onConnect={onConnect} />);

    expect(screen.getByText(/auth failed/)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /再試行/ });
    fireEvent.click(btn);
    expect(onConnect).toHaveBeenCalled();
  });

  it("status='bound': 何も描画しない", () => {
    const { container } = render(<ConnectKintoneButton status="bound" onConnect={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("status='checking' or 'unknown': 何も描画しない (バックグラウンドで判定中)", () => {
    const { container, rerender } = render(
      <ConnectKintoneButton status="unknown" onConnect={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
    rerender(<ConnectKintoneButton status="checking" onConnect={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
