// Cowork Agent for kintone — 進行インジケータ表示文言の組み立て
//
// 直近 event 種別 (+ tool 名) から、ユーザーに見せる 1 行ラベルを純関数で算出する。
// 日本語固定。将来 i18n が必要になったらここで分岐させる。

import type { ProgressEventKind } from './progressEvent';

export function progressLabelOf(
  kind: ProgressEventKind | null,
  toolName: string | null,
): string {
  switch (kind) {
    case null:
    case 'thinking':
      return '思考中…';
    case 'tool_use':
      return toolName ? `ツール実行中: ${toolName}` : 'ツール実行中…';
    case 'tool_result':
      return '結果を読んでいます…';
    case 'custom_tool_use':
      return 'アーティファクト処理中';
    case 'message':
      return '応答を組み立てています…';
  }
}
