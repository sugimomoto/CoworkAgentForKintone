import { describe, expect, it } from 'vitest';

import { progressLabelOf } from './progressLabel';

describe('progressLabelOf', () => {
  it('null → 思考中…', () => {
    expect(progressLabelOf(null, null)).toBe('思考中…');
  });

  it('thinking → 思考中…', () => {
    expect(progressLabelOf('thinking', null)).toBe('思考中…');
  });

  it('tool_use + name → ツール実行中: <name>', () => {
    expect(progressLabelOf('tool_use', 'kintone-get-records')).toBe(
      'ツール実行中: kintone-get-records',
    );
  });

  it('tool_use + null name → ツール実行中…', () => {
    expect(progressLabelOf('tool_use', null)).toBe('ツール実行中…');
  });

  it('tool_result → 結果を読んでいます…', () => {
    expect(progressLabelOf('tool_result', null)).toBe('結果を読んでいます…');
  });

  it('custom_tool_use → アーティファクト処理中', () => {
    expect(progressLabelOf('custom_tool_use', null)).toBe('アーティファクト処理中');
  });

  it('message → 応答を組み立てています…', () => {
    expect(progressLabelOf('message', null)).toBe('応答を組み立てています…');
  });
});
