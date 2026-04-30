// kintone-upload-file: 添付ファイルアップロード (`POST /k/v1/file.json`)。
//
// 取得した fileKey は kintone-add-record / kintone-update-record の
// FILE フィールド値として `[{ fileKey }]` の形で渡す。

import { kintoneUploadFile } from '../kintone';
import { createTool } from './factory';
import { base64ToBytes } from './utils/base64';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

interface Args {
  filename: string;
  content: string;
  contentType?: string;
}

export const uploadFile = createTool<Args>(
  'kintone-upload-file',
  {
    title: 'Upload File',
    description:
      'Upload a file to kintone and obtain a fileKey. ' +
      'Use the returned fileKey as `[{ "fileKey": "..." }]` in a FILE field value when calling ' +
      '`kintone-add-record` / `kintone-update-record`. ' +
      'Input `content` must be base64-encoded; max 10 MB after decoding.',
    inputSchema: {
      filename: { type: 'string', description: 'Original filename (with extension)' },
      content: {
        type: 'string',
        description: 'File bytes encoded as base64 (max 10 MB after decoding)',
      },
      contentType: {
        type: 'string',
        description: 'MIME type (optional). Falls back to application/octet-stream',
      },
    },
    outputSchema: {
      fileKey: { type: 'string', description: 'kintone fileKey for use in FILE field values' },
    },
  },
  async (args, { creds }) => {
    if (!args.filename) throw new Error('kintone-upload-file: filename is required');
    if (!args.content) throw new Error('kintone-upload-file: content (base64) is required');

    const bytes = base64ToBytes(args.content);
    if (bytes.byteLength > MAX_BYTES) {
      throw new Error(
        `kintone-upload-file: file too large (${bytes.byteLength} bytes, max ${MAX_BYTES})`,
      );
    }

    const result = await kintoneUploadFile(creds, args.filename, bytes, args.contentType);

    return {
      structuredContent: result,
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);
