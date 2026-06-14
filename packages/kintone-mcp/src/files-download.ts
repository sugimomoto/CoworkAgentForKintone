// GET /files/:fileId/content
//
// kintone.plugin.app.proxy はレスポンス body を string として返すため、
// Anthropic Files API のバイナリレスポンスをそのまま流すと UTF-8 decode で
// 不正バイトが U+FFFD に置換されて破損する。
// Worker でバイナリを **base64** 化した JSON にして返すことで、
// kintone proxy の string 返しでも安全に渡せる。

import { isString, jsonResponse, sanitizeText } from './_http';
import { anthropicHeaders } from './anthropic';

const ANTHROPIC_BASE = 'https://api.anthropic.com';
const ANTHROPIC_BETA = 'managed-agents-2026-04-01';

interface DownloadResponseBody {
  contentBase64: string;
  mime: string;
  sizeBytes: number;
}

/** ArrayBuffer → base64 (chunked で長すぎる文字列スタック超過を回避) */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000; // 32K chars at a time
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export async function handleFilesDownload(request: Request, fileId: string): Promise<Response> {
  // ① X-Anthropic-Api-Key 必須 (kintone proxy 経由で固定注入される)
  const anthropicApiKey = request.headers.get('X-Anthropic-Api-Key');
  if (!isString(anthropicApiKey)) {
    return jsonResponse({ error: 'missing_anthropic_api_key' }, 401);
  }

  // ② Anthropic Files API へ転送
  const upstream = await fetch(`${ANTHROPIC_BASE}/v1/files/${encodeURIComponent(fileId)}/content`, {
    method: 'GET',
    headers: anthropicHeaders(anthropicApiKey, ANTHROPIC_BETA),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    return jsonResponse(
      { error: 'anthropic_error', status: upstream.status, body: sanitizeText(text) },
      upstream.status,
    );
  }

  // ③ binary を base64 に詰め直す
  const buf = new Uint8Array(await upstream.arrayBuffer());
  const body: DownloadResponseBody = {
    contentBase64: bytesToBase64(buf),
    mime: upstream.headers.get('content-type') ?? 'application/octet-stream',
    sizeBytes: buf.byteLength,
  };
  return jsonResponse(body, 200);
}
