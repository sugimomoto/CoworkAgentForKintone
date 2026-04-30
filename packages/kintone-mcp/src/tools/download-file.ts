// kintone-download-file: 添付ファイルダウンロード (`GET /k/v1/file.json?fileKey=...`)。
//
// レコードの FILE フィールド値に含まれる fileKey を渡すと、バイナリを base64 で返す。
// Anthropic の tool result payload 上限を考慮して 10 MB を超える場合は明示的に例外。

import { kintoneDownloadFile } from '../kintone';
import { createTool } from './factory';
import { bytesToBase64 } from './utils/base64';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

interface Args {
  fileKey: string;
}

export const downloadFile = createTool<Args>(
  'kintone-download-file',
  {
    title: 'Download File',
    description:
      'Download a file attached to a kintone record by its fileKey. ' +
      'Returns `{ content (base64), contentType, size }`. ' +
      'Files larger than 10 MB are rejected to stay within tool result size limits.',
    inputSchema: {
      fileKey: { type: 'string', description: 'kintone fileKey from a FILE field value' },
    },
    outputSchema: {
      content: { type: 'string', description: 'File bytes encoded as base64' },
      contentType: {
        type: ['string', 'null'] as unknown as string,
        description: 'MIME type from the Content-Type response header (may be null)',
      },
      size: { type: 'number', description: 'File size in bytes' },
    },
  },
  async (args, { creds }) => {
    if (!args.fileKey) throw new Error('kintone-download-file: fileKey is required');

    const { bytes, contentType, size } = await kintoneDownloadFile(creds, args.fileKey);
    if (size > MAX_BYTES) {
      throw new Error(
        `kintone-download-file: file too large (${size} bytes, max ${MAX_BYTES})`,
      );
    }

    const out = { content: bytesToBase64(bytes), contentType, size };
    return {
      structuredContent: out,
      content: [
        {
          type: 'text',
          text: JSON.stringify({ contentType, size, contentBase64Length: out.content.length }, null, 2),
        },
      ],
    };
  },
);
