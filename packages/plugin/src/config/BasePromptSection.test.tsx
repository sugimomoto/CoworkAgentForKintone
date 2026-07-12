import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { canSave, charCount, isUsingDefault, statusOf } from './basePrompt';
import { BasePromptSection } from './BasePromptSection';

const DEFAULT_BASE = '# 既定の base\n作法...';

function setup(props: Partial<React.ComponentProps<typeof BasePromptSection>> = {}) {
  const merged: React.ComponentProps<typeof BasePromptSection> = {
    value: '',
    onChange: vi.fn(),
    defaultBase: DEFAULT_BASE,
    onResetToDefault: vi.fn(),
    defaultOpen: true,
    ...props,
  };
  render(<BasePromptSection {...merged} />);
  return merged;
}

describe('basePrompt helpers (#141)', () => {
  it('空/空白は既定使用中', () => {
    expect(isUsingDefault('')).toBe(true);
    expect(isUsingDefault('  \n')).toBe(true);
    expect(isUsingDefault('x')).toBe(false);
    expect(statusOf('')).toBe('default');
    expect(statusOf('x')).toBe('custom');
  });
  it('charCount / canSave (上限超過で不可)', () => {
    expect(charCount('あいう')).toBe(3);
    expect(canSave('a'.repeat(10), 20)).toBe(true);
    expect(canSave('a'.repeat(21), 20)).toBe(false);
  });
});

describe('BasePromptSection (#141)', () => {
  it('既定使用中: 「既定を使用中」チップ + 「読み込んで編集」導線', () => {
    setup({ value: '' });
    expect(screen.getByText('既定を使用中')).toBeInTheDocument();
    expect(screen.getByTestId('base-prompt-load-default')).toBeInTheDocument();
    expect(screen.queryByTestId('base-prompt-reset')).toBeNull();
  });

  it('「既定を読み込んで編集」で defaultBase を onChange に流す', () => {
    const p = setup({ value: '' });
    fireEvent.click(screen.getByTestId('base-prompt-load-default'));
    expect(p.onChange).toHaveBeenCalledWith(DEFAULT_BASE);
  });

  it('override あり: 「カスタム」チップ + 「デフォルトに戻す」→確認→onResetToDefault', () => {
    const p = setup({ value: 'カスタム base' });
    expect(screen.getByText('カスタム')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('base-prompt-reset'));
    fireEvent.click(screen.getByTestId('base-prompt-reset-confirm'));
    expect(p.onResetToDefault).toHaveBeenCalled();
  });

  it('上限超過で警告を出す', () => {
    setup({ value: 'a'.repeat(25), maxLength: 20 });
    expect(screen.getByTestId('base-prompt-over')).toBeInTheDocument();
  });

  it('textarea 入力が onChange に流れる', () => {
    const p = setup({ value: '' });
    fireEvent.change(screen.getByTestId('base-prompt-editor'), { target: { value: 'new base' } });
    expect(p.onChange).toHaveBeenCalledWith('new base');
  });
});
