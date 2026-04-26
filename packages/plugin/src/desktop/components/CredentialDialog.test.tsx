import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { CredentialDialog } from './CredentialDialog';

const DOMAIN = 'tenant.cybozu.com';

describe('CredentialDialog', () => {
  it('open=false なら何も描画しない', () => {
    render(
      <CredentialDialog open={false} domain={DOMAIN} onSubmit={async () => {}} onClose={() => {}} />,
    );
    expect(screen.queryByTestId('credential-dialog')).toBeNull();
  });

  it('open=true で domain (read-only) / login / password 入力欄と登録/キャンセルボタンが表示される', () => {
    render(<CredentialDialog open domain={DOMAIN} onSubmit={async () => {}} onClose={() => {}} />);
    expect(screen.getByTestId('credential-dialog')).toBeInTheDocument();
    const domainInput = screen.getByLabelText(/kintone ドメイン/) as HTMLInputElement;
    expect(domainInput.value).toBe(DOMAIN);
    expect(domainInput).toHaveAttribute('readonly');
    expect(screen.getByLabelText(/ログイン名/)).toBeInTheDocument();
    expect(screen.getByLabelText(/パスワード/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登録' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
  });

  it('initialLogin が login 入力に既定値として入る', () => {
    render(
      <CredentialDialog
        open
        domain={DOMAIN}
        initialLogin="sato"
        onSubmit={async () => {}}
        onClose={() => {}}
      />,
    );
    const input = screen.getByLabelText(/ログイン名/) as HTMLInputElement;
    expect(input.value).toBe('sato');
  });

  it('login + password 未入力では登録ボタンが disabled', () => {
    render(<CredentialDialog open domain={DOMAIN} onSubmit={async () => {}} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: '登録' })).toBeDisabled();
  });

  it('login + password を入力すれば登録ボタン押下で onSubmit が呼ばれる ({login, password} のみ)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CredentialDialog open domain={DOMAIN} onSubmit={onSubmit} onClose={() => {}} />);
    await user.type(screen.getByLabelText(/ログイン名/), 'sato');
    await user.type(screen.getByLabelText(/パスワード/), 'p4ss');
    await user.click(screen.getByRole('button', { name: '登録' }));

    expect(onSubmit).toHaveBeenCalledWith({ login: 'sato', password: 'p4ss' });
  });

  it('onSubmit reject 時はエラーメッセージが表示される', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('mint failed'));
    const user = userEvent.setup();
    render(<CredentialDialog open domain={DOMAIN} onSubmit={onSubmit} onClose={() => {}} />);
    await user.type(screen.getByLabelText(/ログイン名/), 'sato');
    await user.type(screen.getByLabelText(/パスワード/), 'p4ss');
    await user.click(screen.getByRole('button', { name: '登録' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/mint failed/);
  });

  it('キャンセルボタンで onClose が呼ばれる', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CredentialDialog open domain={DOMAIN} onSubmit={async () => {}} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('ESC キーで onClose が呼ばれる', () => {
    const onClose = vi.fn();
    render(<CredentialDialog open domain={DOMAIN} onSubmit={async () => {}} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('パスワード表示切替トグルが動作する', async () => {
    const user = userEvent.setup();
    render(<CredentialDialog open domain={DOMAIN} onSubmit={async () => {}} onClose={() => {}} />);
    const pw = screen.getByLabelText(/パスワード/) as HTMLInputElement;
    expect(pw.type).toBe('password');
    await user.click(screen.getByRole('button', { name: '表示' }));
    expect(pw.type).toBe('text');
  });
});
