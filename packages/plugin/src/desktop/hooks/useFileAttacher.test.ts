import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../store/chatStore';

import { useFileAttacher } from './useFileAttacher';

function makeFile(name: string, sizeBytes: number, type = '', content = ''): File {
  const data = content || new Uint8Array(sizeBytes);
  const blob = new Blob([data], { type });
  return new File([blob], name, { type });
}

beforeEach(() => {
  useChatStore.getState().reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFileAttacher', () => {
  it('text 系 (CSV) を attach すると reading → ready になり content が UTF-8 文字列で入る', async () => {
    const { result } = renderHook(() => useFileAttacher());
    const file = makeFile('a.csv', 0, 'text/csv', 'id,name\n1,Alice');

    result.current.attach([file]);

    await waitFor(() => {
      const list = useChatStore.getState().attachedFiles;
      expect(list).toHaveLength(1);
      expect(list[0]?.status).toBe('ready');
    });
    const f = useChatStore.getState().attachedFiles[0]!;
    expect(f.kind).toBe('text');
    expect(f.mimeType).toBe('text/csv');
    expect(f.content).toBe('id,name\n1,Alice');
    expect(f.errorText).toBeUndefined();
  });

  it('PDF を attach すると base64 文字列が content に入る', async () => {
    const { result } = renderHook(() => useFileAttacher());
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const file = new File([bytes], 'r.pdf', { type: 'application/pdf' });

    result.current.attach([file]);

    await waitFor(() => {
      const list = useChatStore.getState().attachedFiles;
      expect(list[0]?.status).toBe('ready');
    });
    const f = useChatStore.getState().attachedFiles[0]!;
    expect(f.kind).toBe('document');
    expect(f.mimeType).toBe('application/pdf');
    // btoa('%PDF') === 'JVBERg=='
    expect(f.content).toBe('JVBERg==');
  });

  it('画像 (PNG) を attach すると kind=image で base64 化される', async () => {
    const { result } = renderHook(() => useFileAttacher());
    const file = makeFile('p.png', 0, 'image/png', 'x');

    result.current.attach([file]);

    await waitFor(() => {
      expect(useChatStore.getState().attachedFiles[0]?.status).toBe('ready');
    });
    const f = useChatStore.getState().attachedFiles[0]!;
    expect(f.kind).toBe('image');
  });

  it('未対応拡張子 (.docx) は status=error で追加され errorText が入る', async () => {
    const { result } = renderHook(() => useFileAttacher());
    const file = makeFile('doc.docx', 100, 'application/octet-stream');

    result.current.attach([file]);

    await waitFor(() => {
      const list = useChatStore.getState().attachedFiles;
      expect(list).toHaveLength(1);
      expect(list[0]?.status).toBe('error');
    });
    expect(useChatStore.getState().attachedFiles[0]?.errorText).toMatch(/未対応/);
  });

  it('11 MB の PDF は status=error (サイズ超過)', async () => {
    const { result } = renderHook(() => useFileAttacher());
    const file = makeFile('big.pdf', 11 * 1024 * 1024, 'application/pdf');

    result.current.attach([file]);

    await waitFor(() => {
      expect(useChatStore.getState().attachedFiles[0]?.status).toBe('error');
    });
    expect(useChatStore.getState().attachedFiles[0]?.errorText).toMatch(/サイズ上限/);
  });

  it('11 個目は status=error (件数超過)', async () => {
    const { result } = renderHook(() => useFileAttacher());
    // 既に 10 件入っている状態を作る
    for (let i = 0; i < 10; i++) {
      useChatStore.getState().addAttachedFile({
        localId: `existing-${i}`,
        filename: `${i}.csv`,
        size: 1,
        mimeType: 'text/csv',
        kind: 'text',
        status: 'ready',
        content: '',
      });
    }
    const file = makeFile('over.csv', 1, 'text/csv', 'a');

    result.current.attach([file]);

    await waitFor(() => {
      const list = useChatStore.getState().attachedFiles;
      expect(list).toHaveLength(11);
      expect(list[10]?.status).toBe('error');
    });
    expect(useChatStore.getState().attachedFiles[10]?.errorText).toMatch(/最大|10/);
  });

  it('".png" 拡張子だが中身が AVIF のファイルは status=error (未対応形式)', async () => {
    const { result } = renderHook(() => useFileAttacher());
    // AVIF magic: 4 byte size + "ftyp" + "avif"
    const avifHeader = new Uint8Array([
      0, 0, 0, 0x1c,
      0x66, 0x74, 0x79, 0x70, // ftyp
      0x61, 0x76, 0x69, 0x66, // avif
      0, 0, 0, 0,
    ]);
    const file = new File([avifHeader], 'masquerade.png', { type: 'image/png' });

    result.current.attach([file]);

    await waitFor(() => {
      expect(useChatStore.getState().attachedFiles[0]?.status).toBe('error');
    });
    expect(useChatStore.getState().attachedFiles[0]?.errorText).toMatch(/AVIF/);
  });

  it('".png" 拡張子で実体が JPEG なら mimeType を image/jpeg に補正して ready', async () => {
    const { result } = renderHook(() => useFileAttacher());
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    const file = new File([jpegHeader], 'misnamed.png', { type: 'image/png' });

    result.current.attach([file]);

    await waitFor(() => {
      expect(useChatStore.getState().attachedFiles[0]?.status).toBe('ready');
    });
    expect(useChatStore.getState().attachedFiles[0]?.mimeType).toBe('image/jpeg');
  });

  it('複数を並列 attach できる', async () => {
    const { result } = renderHook(() => useFileAttacher());
    const f1 = makeFile('a.csv', 0, 'text/csv', 'x,y');
    const f2 = makeFile('b.md', 0, 'text/markdown', '# hello');

    result.current.attach([f1, f2]);

    await waitFor(() => {
      const list = useChatStore.getState().attachedFiles;
      expect(list).toHaveLength(2);
      expect(list.every((f) => f.status === 'ready')).toBe(true);
    });
  });
});
