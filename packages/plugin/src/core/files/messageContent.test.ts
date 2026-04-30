import { describe, it, expect } from 'vitest';

import { buildUserMessageContent } from './messageContent';

import type { AttachedFile } from './types';

function ready(input: Partial<AttachedFile>): AttachedFile {
  return {
    localId: input.localId ?? 'l',
    filename: input.filename ?? 'a.csv',
    size: input.size ?? 100,
    mimeType: input.mimeType ?? 'text/csv',
    kind: input.kind ?? 'text',
    status: 'ready',
    content: input.content ?? '',
  };
}

describe('buildUserMessageContent', () => {
  it('空 files + text → text block 1 個 (ユーザー入力のみ)', () => {
    expect(buildUserMessageContent('Hello', [])).toEqual([{ type: 'text', text: 'Hello' }]);
  });

  it('text 系ファイル 1 個 → 添付 text block + ユーザー text block', () => {
    const file = ready({
      filename: 'customers.csv',
      mimeType: 'text/csv',
      kind: 'text',
      content: 'id,name\n1,Alice',
    });
    expect(buildUserMessageContent('登録して', [file])).toEqual([
      {
        type: 'text',
        text: '添付ファイル: customers.csv\n---\nid,name\n1,Alice\n---',
      },
      { type: 'text', text: '登録して' },
    ]);
  });

  it('PDF 1 個 → document block (base64) + ユーザー text', () => {
    const file = ready({
      filename: 'report.pdf',
      mimeType: 'application/pdf',
      kind: 'document',
      content: 'JVBERi0xLg==',
    });
    expect(buildUserMessageContent('要約して', [file])).toEqual([
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0xLg==' },
        title: 'report.pdf',
      },
      { type: 'text', text: '要約して' },
    ]);
  });

  it('画像 1 個 → image block (base64) + ユーザー text', () => {
    const file = ready({
      filename: 'photo.png',
      mimeType: 'image/png',
      kind: 'image',
      content: 'iVBORw==',
    });
    expect(buildUserMessageContent('何が写ってる?', [file])).toEqual([
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: 'iVBORw==' },
      },
      { type: 'text', text: '何が写ってる?' },
    ]);
  });

  it('複数 (画像 + PDF + CSV) → 添付順に並ぶ + 最後にユーザー text', () => {
    const img = ready({ filename: 'p.png', mimeType: 'image/png', kind: 'image', content: 'i' });
    const pdf = ready({ filename: 'r.pdf', mimeType: 'application/pdf', kind: 'document', content: 'p' });
    const csv = ready({ filename: 'c.csv', mimeType: 'text/csv', kind: 'text', content: 'a,b' });
    const r = buildUserMessageContent('comment', [img, pdf, csv]);
    expect(r).toHaveLength(4);
    expect(r[0]?.type).toBe('image');
    expect(r[1]?.type).toBe('document');
    expect(r[2]?.type).toBe('text');
    expect((r[2] as { text: string }).text).toContain('c.csv');
    expect(r[3]).toEqual({ type: 'text', text: 'comment' });
  });

  it('status !== ready のファイルは除外する', () => {
    const reading: AttachedFile = {
      localId: 'r1',
      filename: 'x.pdf',
      size: 10,
      mimeType: 'application/pdf',
      kind: 'document',
      status: 'reading',
    };
    const error: AttachedFile = {
      localId: 'e1',
      filename: 'y.pdf',
      size: 10,
      mimeType: 'application/pdf',
      kind: 'document',
      status: 'error',
      errorText: 'oops',
    };
    expect(buildUserMessageContent('hi', [reading, error])).toEqual([
      { type: 'text', text: 'hi' },
    ]);
  });

  it('content が undefined のファイルも除外する', () => {
    const noContent: AttachedFile = {
      localId: 'n1',
      filename: 'z.pdf',
      size: 10,
      mimeType: 'application/pdf',
      kind: 'document',
      status: 'ready',
      // content 未設定
    };
    expect(buildUserMessageContent('hi', [noContent])).toEqual([
      { type: 'text', text: 'hi' },
    ]);
  });
});
