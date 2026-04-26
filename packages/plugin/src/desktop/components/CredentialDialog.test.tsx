import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { CredentialDialog } from './CredentialDialog';

describe('CredentialDialog', () => {
  it('open=false なら何も描画しない', () => {
    render(<CredentialDialog open={false} onSubmit={async () => {}} onClose={() => {}} />);
    expect(screen.queryByTestId('credential-dialog')).toBeNull();
  });

  it('open=true で domain/login/password 入力欄と登録/キャンセルボタンが表示される', () => {
    render(<CredentialDialog open onSubmit={async () => {}} onClose={() => {}} />);
    expect(screen.getByTestId('credential-dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/kintone ドメイン/)).toBeInTheDocument();
    expect(screen.getByLabelText(/ログイン名/)).toBeInTheDocument();
    expect(screen.getByLabelText(/パスワード/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登録' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
  });

  it('initialDomain が domain 入力に既定値として入る', () => {
    render(
      <CredentialDialog
        open
        initialDomain="acme.cybozu.com"
        onSubmit={async () => {}}
        onClose={() => {}}
      />,
    );
    const input = screen.getByLabelText(/kintone ドメイン/) as HTMLInputElement;
    expect(input.value).toBe('acme.cybozu.com');
  });

  it('空入力では登録ボタンが disabled', () => {
    render(<CredentialDialog open onSubmit={async () => {}} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: '登録' })).toBeDisabled();
  });

  it('domain 形式が不正なときも登録ボタンが disabled', async () => {
    const user = userEvent.setup();
    render(<CredentialDialog open onSubmit={async () => {}} onClose={() => {}} />);
    await user.type(screen.getByLabelText(/kintone ドメイン/), 'not a host');
    await user.type(screen.getByLabelText(/ログイン名/), 'sato');
    await user.type(screen.getByLabelText(/パスワード/), 'p4ss');
    expect(screen.getByRole('button', { name: '登録' })).toBeDisabled();
    expect(screen.getByText(/ドメイン形式が不正/)).toBeInTheDocument();
  });

  it('全部正しく入力すれば登録ボタン押下で onSubmit が呼ばれる', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CredentialDialog open onSubmit={onSubmit} onClose={() => {}} />);
    await user.type(screen.getByLabelText(/kintone ドメイン/), 'acme.cybozu.com');
    await user.type(screen.getByLabelText(/ログイン名/), 'sato');
    await user.type(screen.getByLabelText(/パスワード/), 'p4ss');
    await user.click(screen.getByRole('button', { name: '登録' }));

    expect(onSubmit).toHaveBeenCalledWith({
      domain: 'acme.cybozu.com',
      login: 'sato',
      password: 'p4ss',
    });
  });

  it('onSubmit reject 時はエラーメッセージが表示される', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('vault create failed'));
    const user = userEvent.setup();
    render(<CredentialDialog open onSubmit={onSubmit} onClose={() => {}} />);
    await user.type(screen.getByLabelText(/kintone ドメイン/), 'acme.cybozu.com');
    await user.type(screen.getByLabelText(/ログイン名/), 'sato');
    await user.type(screen.getByLabelText(/パスワード/), 'p4ss');
    await user.click(screen.getByRole('button', { name: '登録' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/vault create failed/);
  });

  it('キャンセルボタンで onClose が呼ばれる', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CredentialDialog open onSubmit={async () => {}} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('ESC キーで onClose が呼ばれる', () => {
    const onClose = vi.fn();
    render(<CredentialDialog open onSubmit={async () => {}} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('パスワード表示切替トグルが動作する', async () => {
    const user = userEvent.setup();
    render(<CredentialDialog open onSubmit={async () => {}} onClose={() => {}} />);
    const pw = screen.getByLabelText(/パスワード/) as HTMLInputElement;
    expect(pw.type).toBe('password');
    await user.click(screen.getByRole('button', { name: '表示' }));
    expect(pw.type).toBe('text');
  });
});
