import { describe, it, expect } from 'vitest';

import { HIDDEN_BLOCK_MARKER, buildUserMessageContent } from './messageContent';

import type { AttachedFile } from './types';

function ready(input: Partial<AttachedFile>): AttachedFile {
  const base: AttachedFile = {
    localId: input.localId ?? 'l',
    filename: input.filename ?? 'a.csv',
    size: input.size ?? 100,
    mimeType: input.mimeType ?? 'text/csv',
    kind: input.kind ?? 'text',
    status: 'ready',
    content: input.content ?? '',
  };
  if (input.kintoneFileKey !== undefined) base.kintoneFileKey = input.kintoneFileKey;
  if (input.kintoneUpload !== undefined) base.kintoneUpload = input.kintoneUpload;
  return base;
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

  describe('kintoneFileKey 付きファイル (#27)', () => {
    it('fileKey ありのファイルがあれば fileKey 一覧 text block が user text の前に追加される', () => {
      const pdf = ready({
        filename: 'scan.pdf',
        mimeType: 'application/pdf',
        kind: 'document',
        content: 'p',
        kintoneFileKey: 'fk-1',
      });
      const r = buildUserMessageContent('レコード 5 に添付して', [pdf]);
      expect(r).toHaveLength(3);
      expect(r[0]?.type).toBe('document');
      expect(r[1]?.type).toBe('text');
      const meta = r[1] as { text: string };
      expect(meta.text).toContain('【kintone に保存済の添付ファイル】');
      expect(meta.text).toContain('scan.pdf');
      expect(meta.text).toContain('fileKey: fk-1');
      // UI 非表示マーカーを先頭に持つ (eventInterpreter.extractText が skip する)
      expect(meta.text.startsWith(HIDDEN_BLOCK_MARKER)).toBe(true);
      expect(r[2]).toEqual({ type: 'text', text: 'レコード 5 に添付して' });
    });

    it('複数の fileKey を 1 つの block にまとめる', () => {
      const a = ready({
        filename: 'a.csv',
        mimeType: 'text/csv',
        kind: 'text',
        content: 'x,y',
        kintoneFileKey: 'fk-A',
      });
      const b = ready({
        filename: 'b.png',
        mimeType: 'image/png',
        kind: 'image',
        content: 'i',
        kintoneFileKey: 'fk-B',
      });
      const r = buildUserMessageContent('hi', [a, b]);
      // text(a) + image(b) + meta + user = 4
      expect(r).toHaveLength(4);
      const meta = r[2] as { text: string };
      expect(meta.text).toContain('a.csv');
      expect(meta.text).toContain('fk-A');
      expect(meta.text).toContain('b.png');
      expect(meta.text).toContain('fk-B');
    });

    it('fileKey が無いファイルだけのときは fileKey block を追加しない (既存挙動)', () => {
      const pdf = ready({
        filename: 'r.pdf',
        mimeType: 'application/pdf',
        kind: 'document',
        content: 'p',
      });
      const r = buildUserMessageContent('要約', [pdf]);
      expect(r).toHaveLength(2);
      expect(r[1]).toEqual({ type: 'text', text: '要約' });
    });
  });
});
