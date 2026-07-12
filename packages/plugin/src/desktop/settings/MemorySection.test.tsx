import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { MemorySection } from './MemorySection';

import type { MemoryStoreView } from '../../core/chat/memoryView';

const STORES: MemoryStoreView[] = [
  {
    kind: 'preferences',
    label: '個人設定（全エージェント共通）',
    storeId: 'memstore_pref',
    files: [
      { id: 'm1', path: '/preferences/general.md', sizeBytes: 2150, updatedAt: '2026-07-11T00:00:00Z', content: '# 口調\nですます調。' },
      { id: 'm2', path: '/preferences/field-aliases.md', sizeBytes: 0, updatedAt: '2026-07-11T00:00:00Z' },
    ],
  },
  {
    kind: 'agent-context',
    label: 'このエージェント（業務エージェント）',
    storeId: 'memstore_agent',
    files: [],
  },
];

function setup(overrides: Partial<React.ComponentProps<typeof MemorySection>> = {}) {
  const props: React.ComponentProps<typeof MemorySection> = {
    stores: STORES,
    selection: null,
    onSelect: vi.fn(),
    mode: 'view',
    onModeChange: vi.fn(),
    asyncState: 'idle',
    draft: '',
    onDraftChange: vi.fn(),
    onSave: vi.fn(),
    onReload: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<MemorySection {...props} />);
  return props;
}

describe('MemorySection (#15 Step 2)', () => {
  it('2 store の見出しとファイル行を描画し、空 store はプレースホルダ', () => {
    setup();
    expect(screen.getByText('個人設定（全エージェント共通）')).toBeInTheDocument();
    expect(screen.getByText('このエージェント（業務エージェント）')).toBeInTheDocument();
    expect(screen.getByText('general.md')).toBeInTheDocument();
    // 空 store (agent-context) はプレースホルダ
    expect(screen.getByText(/まだ記憶がありません/)).toBeInTheDocument();
  });

  it('ファイル行クリックで onSelect が呼ばれる', () => {
    const props = setup();
    fireEvent.click(screen.getByText('general.md'));
    expect(props.onSelect).toHaveBeenCalledWith({ storeKind: 'preferences', fileId: 'm1' });
  });

  it('選択・閲覧時に Markdown 本文を表示し [編集] で onModeChange(edit)', () => {
    const props = setup({ selection: { storeKind: 'preferences', fileId: 'm1' } });
    expect(screen.getByText('ですます調。')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('memory-edit'));
    expect(props.onModeChange).toHaveBeenCalledWith('edit');
  });

  it('編集モードで textarea + [保存] を出し onSave を呼ぶ', () => {
    const props = setup({
      selection: { storeKind: 'preferences', fileId: 'm1' },
      mode: 'edit',
      draft: '# 口調\n編集後',
    });
    const editor = screen.getByTestId('memory-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('# 口調\n編集後');
    fireEvent.click(screen.getByTestId('memory-save'));
    expect(props.onSave).toHaveBeenCalled();
  });

  it('競合 (asyncState=conflict) で再読込バナーを出し onReload を呼ぶ', () => {
    const props = setup({ selection: { storeKind: 'preferences', fileId: 'm1' }, asyncState: 'conflict' });
    expect(screen.getByText(/他で更新されました/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('再読込'));
    expect(props.onReload).toHaveBeenCalled();
  });

  it('削除アイコン → 確認ダイアログ → 確定で onDelete', () => {
    const props = setup({ selection: { storeKind: 'preferences', fileId: 'm1' } });
    // general.md 行の削除ボタン
    const row = screen.getByTestId('memory-file-general.md');
    fireEvent.click(row.querySelector('button[aria-label="削除"]')!);
    expect(screen.getByTestId('memory-delete-confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByText('削除する'));
    expect(props.onDelete).toHaveBeenCalledWith({ storeKind: 'preferences', fileId: 'm1' });
  });

  it('削除確認を開いた後に対象ファイルが一覧から消えたらダイアログを閉じる (stale 回避)', () => {
    const onSelect = vi.fn();
    const base: React.ComponentProps<typeof MemorySection> = {
      stores: STORES,
      selection: null,
      onSelect,
      mode: 'view',
      onModeChange: vi.fn(),
      asyncState: 'idle',
      draft: '',
      onDraftChange: vi.fn(),
      onSave: vi.fn(),
      onReload: vi.fn(),
      onDelete: vi.fn(),
    };
    const { rerender } = render(<MemorySection {...base} />);
    const row = screen.getByTestId('memory-file-general.md');
    fireEvent.click(row.querySelector('button[aria-label="削除"]')!);
    expect(screen.getByTestId('memory-delete-confirm')).toBeInTheDocument();

    // general.md が消えた stores で再描画 → ダイアログは消える (空ファイル名で出さない)
    const withoutGeneral: MemoryStoreView[] = [
      { ...STORES[0]!, files: STORES[0]!.files.filter((f) => f.id !== 'm1') },
      STORES[1]!,
    ];
    rerender(<MemorySection {...base} stores={withoutGeneral} />);
    expect(screen.queryByTestId('memory-delete-confirm')).toBeNull();
  });

  it('loading では選択ファイル領域にスケルトンを出す', () => {
    setup({ asyncState: 'loading', selection: { storeKind: 'preferences', fileId: 'm1' } });
    // Markdown 本文は出ない (スケルトン表示)
    expect(screen.queryByText('ですます調。')).not.toBeInTheDocument();
  });
});
