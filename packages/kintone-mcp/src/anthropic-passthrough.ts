// Worker /anthropic/* — Anthropic API 汎用 passthrough (Issue #31)
//
// Plugin → kintone proxy (X-Anthropic-Api-Key 注入) → Worker → Anthropic
// の経路で全 Anthropic API を中継する。Plugin 側は「api.anthropic.com に直接
// fetch する」という前提を捨て、Worker が唯一の Anthropic gateway になる。
//
// 利点:
//   - kintone proxy のフラット data / string 返し制約を Worker が一括吸収
//   - Plugin は Worker URL 1 本だけ意識すればよい (proxy 登録も最小化)
//   - 将来 SaaS 化の足場 (利用量計測 / サブスク enforcement / API key 一括管理)
//
// 注意:
//   - `/anthropic/v1/files/{id}/content` のバイナリ DL だけは別ルート
//     (`/files/<id>/content` の base64 中継) に回す。理由は kintone proxy が
//     response body を string にしてしまい binary が破損するため。

import { isString } from './_http';

const ANTHROPIC_BASE = 'https://api.anthropic.com';

/** Plugin が転送してくる Anthropic 関連ヘッダだけホワイトリストで通す */
const FORWARDED_HEADER_PREFIXES = ['anthropic-', 'content-type', 'accept'];

function shouldForwardHeader(name: string): boolean {
  const lower = name.toLowerCase();
  return FORWARDED_HEADER_PREFIXES.some((p) => lower === p || lower.startsWith(p));
}

export async function handleAnthropicPassthrough(
  request: Request,
  upstreamPath: string,
): Promise<Response> {
  const apiKey = request.headers.get('X-Anthropic-Api-Key');
  if (!isString(apiKey)) {
    return new Response(
      JSON.stringify({ error: 'missing_anthropic_api_key' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // バイナリ DL は別ルート (kintone proxy 経由だと binary が壊れる)
  if (/^\/v1\/files\/[^/]+\/content$/.test(upstreamPath)) {
    return new Response(
      JSON.stringify({
        error: 'use_files_endpoint',
        message:
          'Use /files/<fileId>/content (base64 bridge) for binary downloads instead of /anthropic/v1/files/<id>/content',
      }),
      { status: 415, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 元 URL の query string も維持して転送
  const incoming = new URL(request.url);
  const upstreamUrl = `${ANTHROPIC_BASE}${upstreamPath}${incoming.search}`;

  // ヘッダ転送: anthropic-* / content-type / accept のみ
  const forwarded = new Headers();
  request.headers.forEach((value, key) => {
    if (shouldForwardHeader(key)) forwarded.set(key, value);
  });
  forwarded.set('X-Api-Key', apiKey);

  // body は GET/HEAD/DELETE では undefined。それ以外は raw stream を渡す
  const method = request.method;
  const hasBody = method !== 'GET' && method !== 'HEAD' && method !== 'DELETE';

  const upstream = await fetch(upstreamUrl, {
    method,
    headers: forwarded,
    body: hasBody ? await request.text() : undefined,
  });

  // upstream のレスポンスをそのまま返す。content-type 等のヘッダは保持
  const respHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    // CF / NEL / Server 系は捨てて Anthropic 由来だけ通す
    const lower = k.toLowerCase();
    if (lower === 'content-type' || lower.startsWith('anthropic-') || lower === 'request-id') {
      respHeaders.set(k, v);
    }
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}
