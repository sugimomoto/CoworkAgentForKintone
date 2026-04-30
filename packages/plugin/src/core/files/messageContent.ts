// 添付ファイルを含むユーザーメッセージを Anthropic content block 配列に変換する。
//
// 仕様 (requirements.md F4 / design.md §5):
//   - text 系: `添付ファイル: <filename>\n---\n<本文>\n---` の text block で inline
//   - document (PDF): document block + source.type='base64'
//   - image: image block + source.type='base64'
//   - 最後にユーザー入力 text block を 1 個追加 (空でも追加)
//   - status !== 'ready' / content 未設定は除外

import type { AttachedFile } from './types';

/**
 * UI に表示しない text block の先頭に付けるマーカー。
 *
 * Anthropic API は user.message の content を echo back してくるので、そのまま
 * UI に流すと内部メタ情報 (fileKey 一覧など) がユーザーメッセージとしてチャット
 * に出てしまう。eventInterpreter.extractText 側でこの prefix を見つけたら block
 * を skip することで、LLM には届くが UI には出さない振る舞いを実現する。
 *
 * HTML コメントの形にしているのは、万一どこかで素のままレンダリングされても
 * 副作用が無く、LLM 側も「コメントなので無視してよい」と自然に解釈できるため。
 */
export const HIDDEN_BLOCK_MARKER = '<!--cowork-agent:hidden-->';

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

  // Issue #27: kintone に保存済 (fileKey 取得済) のファイルがあれば、Agent が
  // FILE フィールドへの再添付に使えるよう fileKey 一覧を text block で差し込む。
  const kintoneStored = files.filter((f) => f.kintoneFileKey != null);
  if (kintoneStored.length > 0) {
    const lines = kintoneStored.map(
      (f) => `- ${f.filename} (fileKey: ${f.kintoneFileKey})`,
    );
    blocks.push({
      type: 'text',
      text:
        HIDDEN_BLOCK_MARKER + '\n' +
        '【kintone に保存済の添付ファイル】\n' +
        '以下のファイルは kintone にアップロード済です。レコードの FILE フィールドに' +
        '添付したい場合は、`kintone-add-record` / `kintone-update-record` の FILE フィールド値に' +
        '`[{"fileKey": "..."}]` を渡してください。`kintone-upload-file` を再度呼ぶ必要はありません。\n\n' +
        lines.join('\n'),
    });
  }

  blocks.push({ type: 'text', text });
  return blocks;
}
