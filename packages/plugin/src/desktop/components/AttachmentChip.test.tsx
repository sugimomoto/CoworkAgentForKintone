import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { AttachmentChip } from './AttachmentChip';

import type { AttachedFile } from '../../core/files/types';

function makeFile(partial: Partial<AttachedFile>): AttachedFile {
  return {
    localId: 'f1',
    filename: 'a.csv',
    size: 12 * 1024,
    mimeType: 'text/csv',
    kind: 'text',
    status: 'ready',
    ...partial,
  };
}

describe('AttachmentChip', () => {
  it('ready: filename / subline (PDF · 2.4 MB) / 削除ボタンが描画される', () => {
    const onRemove = vi.fn();
    render(
      <AttachmentChip
        file={makeFile({
          filename: 'report.pdf',
          mimeType: 'application/pdf',
          kind: 'document',
          size: 2.4 * 1024 * 1024,
        })}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    // subline: "PDF · 2.4 MB" の形式で 1 つは存在 (SVG 内の <text> もマッチするので複数許容)
    expect(screen.getAllByText(/PDF/).length).toBeGreaterThan(0);
    expect(screen.getByText(/MB/)).toBeInTheDocument();
    expect(screen.getByLabelText('削除')).toBeInTheDocument();
  });

  it('reading: spinner + 「読込中…」 + 削除ボタンは出ない', () => {
    render(
      <AttachmentChip
        file={makeFile({ status: 'reading' })}
        onRemove={() => undefined}
      />,
    );
    expect(screen.getByText('読込中…')).toBeInTheDocument();
    expect(screen.queryByLabelText('削除')).toBeNull();
    // spinner は data-attach-spinner で識別
    expect(document.querySelector('[data-attach-spinner]')).not.toBeNull();
  });

  it('error: errorText が subline に表示され、削除ボタンが出る', () => {
    const onRemove = vi.fn();
    render(
      <AttachmentChip
        file={makeFile({
          status: 'error',
          errorText: 'サイズ上限 (10 MB) を超えています',
        })}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByText(/サイズ上限/)).toBeInTheDocument();
    expect(screen.getByLabelText('削除')).toBeInTheDocument();
  });

  it('削除ボタンクリックで onRemove が呼ばれる', () => {
    const onRemove = vi.fn();
    render(<AttachmentChip file={makeFile({})} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText('削除'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('画像の subline は "画像 · NN KB" 形式', () => {
    render(
      <AttachmentChip
        file={makeFile({ filename: 'p.png', mimeType: 'image/png', kind: 'image', size: 5 * 1024 })}
        onRemove={() => undefined}
      />,
    );
    expect(screen.getByText(/画像/)).toBeInTheDocument();
  });
});
