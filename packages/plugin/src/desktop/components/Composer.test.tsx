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

  // Regression: 「チャット画面を閉じた状態でリフレッシュ → 開くと textarea 高さが 0」
  // パネル open 直後でレイアウトが未確定なときに scrollHeight=0 を返しても、
  // 1 行分 (lineHeight) は確保される。
  it('scrollHeight が 0 (= 非表示直後 / 未確定) でも textarea 高さが 0 にならない', () => {
    // jsdom は scrollHeight を 0 で返す。これを利用してレース状況を再現する
    render(<Composer onSubmit={vi.fn()} />);
    const input = screen.getByLabelText('メッセージ入力') as HTMLTextAreaElement;
    expect(input.style.height).not.toBe('0px');
    expect(input.style.height).toMatch(/^\d+px$/);
    // 0 より大きい値であること
    const px = parseFloat(input.style.height);
    expect(px).toBeGreaterThan(0);
  });

  describe('running モード (Agent ターン進行中)', () => {
    it('running=true で送信ボタンの代わりにキャンセルボタンを出す', () => {
      render(<Composer onSubmit={vi.fn()} running onCancel={vi.fn()} />);
      expect(screen.getByLabelText('キャンセル')).toBeInTheDocument();
      expect(screen.queryByLabelText('送信')).toBeNull();
    });

    it('キャンセルクリック → onCancel が呼ばれる', () => {
      const onCancel = vi.fn();
      render(<Composer onSubmit={vi.fn()} running onCancel={onCancel} />);
      fireEvent.click(screen.getByLabelText('キャンセル'));
      expect(onCancel).toHaveBeenCalled();
    });

    it('running=true 時は textarea が disabled', () => {
      render(<Composer onSubmit={vi.fn()} running />);
      expect(screen.getByLabelText('メッセージ入力')).toBeDisabled();
    });

    it('running=true 時は Enter で送信されない', () => {
      const onSubmit = vi.fn();
      render(<Composer onSubmit={onSubmit} running />);
      const input = screen.getByLabelText('メッセージ入力');
      fireEvent.change(input, { target: { value: 'hi' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('添付機能', () => {
    it('📎 ボタンが描画される', () => {
      render(<Composer onSubmit={vi.fn()} attachedFiles={[]} onAttach={vi.fn()} />);
      expect(screen.getByLabelText('ファイルを添付')).toBeInTheDocument();
    });

    it('attachedFiles が空でない時 placeholder が「添付について聞く / 指示を入力...」', () => {
      render(
        <Composer
          onSubmit={vi.fn()}
          attachedFiles={[
            {
              localId: 'f1',
              filename: 'a.csv',
              size: 100,
              mimeType: 'text/csv',
              kind: 'text',
              status: 'ready',
            },
          ]}
          onAttach={vi.fn()}
          onRemoveAttachment={vi.fn()}
        />,
      );
      expect(screen.getByPlaceholderText(/添付について/)).toBeInTheDocument();
    });

    it('reading 状態のチップがあると送信ボタンは disabled', () => {
      render(
        <Composer
          onSubmit={vi.fn()}
          attachedFiles={[
            {
              localId: 'f1',
              filename: 'a.csv',
              size: 100,
              mimeType: 'text/csv',
              kind: 'text',
              status: 'reading',
            },
          ]}
          onAttach={vi.fn()}
          onRemoveAttachment={vi.fn()}
        />,
      );
      // value 空でも disabled なのは元から (空 = no submit) なので、入力後 reading で disabled をチェック
      const input = screen.getByLabelText('メッセージ入力');
      fireEvent.change(input, { target: { value: 'hi' } });
      expect(screen.getByLabelText('送信')).toBeDisabled();
    });

    it('error 状態のチップがあっても送信は可能 (= 入力テキストがあれば送信ボタン enable)', () => {
      render(
        <Composer
          onSubmit={vi.fn()}
          attachedFiles={[
            {
              localId: 'f1',
              filename: 'over.pdf',
              size: 99,
              mimeType: 'application/pdf',
              kind: 'document',
              status: 'error',
              errorText: 'サイズ超過',
            },
          ]}
          onAttach={vi.fn()}
          onRemoveAttachment={vi.fn()}
        />,
      );
      const input = screen.getByLabelText('メッセージ入力');
      fireEvent.change(input, { target: { value: 'hi' } });
      // error チップは送信時にスキップされるだけで、送信自体は妨げない
      expect(screen.getByLabelText('送信')).not.toBeDisabled();
    });

    it('📎 ボタンクリックで隠し input の click() が起動する', () => {
      const onAttach = vi.fn();
      render(<Composer onSubmit={vi.fn()} attachedFiles={[]} onAttach={onAttach} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');
      fireEvent.click(screen.getByLabelText('ファイルを添付'));
      expect(clickSpy).toHaveBeenCalled();
    });

    it('input change で onAttach が呼ばれる', () => {
      const onAttach = vi.fn();
      render(<Composer onSubmit={vi.fn()} attachedFiles={[]} onAttach={onAttach} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['hi'], 'a.txt', { type: 'text/plain' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      fireEvent.change(input);
      expect(onAttach).toHaveBeenCalled();
    });
  });
});
