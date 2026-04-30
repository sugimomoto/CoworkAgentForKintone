import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { AttachmentChipRow } from './AttachmentChipRow';

import type { AttachedFile } from '../../core/files/types';

function file(name: string, size: number): AttachedFile {
  return {
    localId: name,
    filename: name,
    size,
    mimeType: 'text/csv',
    kind: 'text',
    status: 'ready',
  };
}

describe('AttachmentChipRow', () => {
  it('files が空なら何も描画しない', () => {
    const { container } = render(
      <AttachmentChipRow files={[]} onRemove={() => undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('1 件 → footer に "1件" + 合計サイズ', () => {
    render(<AttachmentChipRow files={[file('a.csv', 500)]} onRemove={() => undefined} />);
    expect(screen.getByText('1件')).toBeInTheDocument();
    // 合計サイズはチップ subline と footer の両方に出るので 1 つ以上あれば OK
    expect(screen.getAllByText(/500 B|0\.5 KB/).length).toBeGreaterThan(0);
  });

  it('合計 30 MB 未満なら警告メッセージは出ない', () => {
    const files = [file('a.csv', 5 * 1024 * 1024), file('b.csv', 5 * 1024 * 1024)];
    render(<AttachmentChipRow files={files} onRemove={() => undefined} />);
    expect(screen.queryByText(/合計サイズが大きめ/)).toBeNull();
  });

  it('合計 30 MB 以上なら警告メッセージが出る', () => {
    const files = [
      file('a.csv', 10 * 1024 * 1024),
      file('b.csv', 10 * 1024 * 1024),
      file('c.csv', 10 * 1024 * 1024),
    ];
    render(<AttachmentChipRow files={files} onRemove={() => undefined} />);
    expect(screen.getByText(/合計サイズが大きめ/)).toBeInTheDocument();
  });
});
