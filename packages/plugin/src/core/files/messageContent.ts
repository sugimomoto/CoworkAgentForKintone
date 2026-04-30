// 添付ファイルを含むユーザーメッセージを Anthropic content block 配列に変換する。
//
// 仕様 (requirements.md F4 / design.md §5):
//   - text 系: `添付ファイル: <filename>\n---\n<本文>\n---` の text block で inline
//   - document (PDF): document block + source.type='base64'
//   - image: image block + source.type='base64'
//   - 最後にユーザー入力 text block を 1 個追加 (空でも追加)
//   - status !== 'ready' / content 未設定は除外

import type { AttachedFile } from './types';

/** Anthropic content block (本実装が組み立てる範囲のみ) */
export type ContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'document';
      source: { type: 'base64'; media_type: string; data: string };
      title?: string;
    }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: string; data: string };
    };

export function buildUserMessageContent(
  text: string,
  files: AttachedFile[],
): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  for (const file of files) {
    if (file.status !== 'ready' || file.content == null) continue;
    if (file.kind === 'text') {
      blocks.push({
        type: 'text',
        text: `添付ファイル: ${file.filename}\n---\n${file.content}\n---`,
      });
    } else if (file.kind === 'document') {
      blocks.push({
        type: 'document',
        source: { type: 'base64', media_type: file.mimeType, data: file.content },
        title: file.filename,
      });
    } else {
      // kind === 'image'
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: file.mimeType, data: file.content },
      });
    }
  }

  blocks.push({ type: 'text', text });
  return blocks;
}
