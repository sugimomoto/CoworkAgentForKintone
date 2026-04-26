// 軽量な multipart/form-data ボディ構築ヘルパ。
// Cloudflare Workers の script アップロードに使う。
//
// kintone proxy 経由で送るため、Body は string で構築。各 part は
// Content-Disposition + (任意で Content-Type) + 空行 + 本文 + CRLF。

export interface MultipartPart {
  /** form-data の name (例: "metadata", "worker.js") */
  name: string;
  /** ファイル part のときの filename */
  filename?: string;
  /** Content-Type (省略可) */
  contentType?: string;
  /** 本文 (string) */
  content: string;
}

export function buildMultipartBody(parts: MultipartPart[], boundary: string): string {
  const CRLF = '\r\n';
  let body = '';
  for (const p of parts) {
    body += `--${boundary}${CRLF}`;
    const disposition = p.filename
      ? `form-data; name="${p.name}"; filename="${p.filename}"`
      : `form-data; name="${p.name}"`;
    body += `Content-Disposition: ${disposition}${CRLF}`;
    if (p.contentType) body += `Content-Type: ${p.contentType}${CRLF}`;
    body += CRLF;
    body += p.content + CRLF;
  }
  body += `--${boundary}--${CRLF}`;
  return body;
}

/** 衝突のない boundary を生成 (UUID 風) */
export function generateBoundary(): string {
  // 安全な文字のみ使い、長めにとって衝突を避ける
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `cowork-agent-${hex}`;
}
