import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { Composer } from './Composer';

describe('Composer', () => {
  it('placeholder と送信ボタンを表示する', () => {
    render(<Composer onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText(/kintone|レコード|聞く/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /送信/ })).toBeInTheDocument();
  });

  it('送信ボタン押下で onSubmit が入力値と共に呼ばれる', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Composer onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox');
    await user.type(input, '集計して');
    await user.click(screen.getByRole('button', { name: /送信/ }));

    expect(onSubmit).toHaveBeenCalledWith('集計して');
  });

  it('Enter キーで送信される', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Composer onSubmit={onSubmit} />);

    await user.type(screen.getByRole('textbox'), 'こんにちは{Enter}');

    expect(onSubmit).toHaveBeenCalledWith('こんにちは');
  });

  it('Shift+Enter では送信せず改行する', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Composer onSubmit={onSubmit} />);

    await user.type(screen.getByRole('textbox'), 'line1{Shift>}{Enter}{/Shift}line2');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('空文字や空白のみの送信は無視される', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Composer onSubmit={onSubmit} />);

    // 空で送信ボタン押下
    await user.click(screen.getByRole('button', { name: /送信/ }));
    expect(onSubmit).not.toHaveBeenCalled();

    // 空白のみで Enter
    await user.type(screen.getByRole('textbox'), '   {Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('送信後は入力欄が空になる', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Composer onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test{Enter}');

    expect(input).toHaveValue('');
  });

  it('disabled=true のとき入力も送信もできない', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Composer onSubmit={onSubmit} disabled />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: /送信/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /送信/ }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('IME 変換中 (compositionStart 後 / compositionEnd 前) の Enter では送信しない', () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'こんにちは' } });
    // IME 変換開始
    fireEvent.compositionStart(input);
    // 変換中の Enter (確定キー) — keyCode 229 + isComposing
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keyCode 229 (IME 慣例マーカー) の Enter は送信しない', () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'こんにちは' } });
    // composition の状態に関わらず keyCode 229 で来た Enter は送信しない
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('compositionEnd 直後の Enter (変換確定) でも送信しない', async () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'こんにちは' } });
    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input);
    // compositionEnd と同フレームの Enter (= 確定キー) は抑止
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();

    // 1 ティック後の Enter は送信される (= 確定後にユーザーが意図して押した)
    await new Promise((r) => setTimeout(r, 10));
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('こんにちは');
  });

  it('ヒント行 ⌘K を表示する', () => {
    render(<Composer onSubmit={vi.fn()} />);
    expect(screen.getByText(/⌘K/)).toBeInTheDocument();
  });
});
