import { describe, it, expect } from 'vitest';

import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('単純な header + data を分離する', () => {
    const r = parseCsv('id,name\n1,Alice\n2,Bob');
    expect(r.hasHeader).toBe(true);
    expect(r.headers).toEqual(['id', 'name']);
    expect(r.rows).toEqual([['1', 'Alice'], ['2', 'Bob']]);
  });

  it('CRLF 改行を扱える', () => {
    const r = parseCsv('a,b\r\n1,2\r\n3,4');
    expect(r.rows).toEqual([['1', '2'], ['3', '4']]);
  });

  it('ダブルクォート内のカンマと改行を保持する', () => {
    const r = parseCsv('name,note\n"Alice","hello,\nworld"');
    expect(r.rows).toEqual([['Alice', 'hello,\nworld']]);
  });

  it('"" でエスケープされたダブルクォートを 1 つの " として扱う', () => {
    const r = parseCsv('msg\n"He said ""hi"""');
    expect(r.rows).toEqual([['He said "hi"']]);
  });

  it('header と推定できないとき (重複あり) は連番ヘッダを生成', () => {
    const r = parseCsv('1,1\n2,3');
    expect(r.hasHeader).toBe(false);
    expect(r.headers).toEqual(['col1', 'col2']);
    expect(r.rows).toEqual([['1', '1'], ['2', '3']]);
  });

  it('空文字列は空 result', () => {
    const r = parseCsv('');
    expect(r.headers).toEqual([]);
    expect(r.rows).toEqual([]);
  });

  it('末尾改行で空行が出ない', () => {
    const r = parseCsv('a,b\n1,2\n');
    expect(r.rows).toEqual([['1', '2']]);
  });
});
