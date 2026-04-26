// /oauth/callback ハンドラのテスト。
// 期待動作: code/state クエリを HTML に埋め込み + postMessage 用 inline script を吐く。
// XSS 対策の HTML escape も検証。

import { describe, expect, it } from 'vitest';

import { handleOAuthCallback } from '../src/oauth-callback';

function callbackRequest(query: string): Request {
  return new Request(`https://example.com/oauth/callback${query}`, { method: 'GET' });
}

describe('handleOAuthCallback', () => {
  it('code/state 有り → HTML に値が埋め込まれ、success セクション', async () => {
    const res = handleOAuthCallback(callbackRequest('?code=ABC123&state=xyz'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('認可コードを受け取りました');
    expect(html).toContain('ABC123');
    expect(html).toContain('xyz');
    // postMessage payload にも code/state が含まれる
    expect(html).toContain('"ABC123"');
    expect(html).toContain('"xyz"');
  });

  it('error クエリ → エラー表示分岐', async () => {
    const res = handleOAuthCallback(callbackRequest('?error=access_denied&error_description=User+rejected'));
    const html = await res.text();
    expect(html).toContain('認可エラー');
    expect(html).toContain('access_denied');
    expect(html).toContain('User rejected');
  });

  it('code 無し → エラー扱い', async () => {
    const res = handleOAuthCallback(callbackRequest('?state=xyz'));
    const html = await res.text();
    expect(html).toContain('認可エラー');
  });

  it('表示部は HTML エスケープして埋め込む', async () => {
    const res = handleOAuthCallback(
      callbackRequest('?code=%3Cscript%3Ealert(1)%3C/script%3E&state=xyz'),
    );
    const html = await res.text();
    // 表示部 (<pre>/<h1>) では HTML エスケープ済
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('inline <script> 内の JSON は </script> 早期 close を防ぐためエスケープされる', async () => {
    const res = handleOAuthCallback(
      callbackRequest('?code=evil%3C/script%3E%3Cimg%20src=x%3E&state=xyz'),
    );
    const html = await res.text();
    // postMessage payload は < でエスケープされ、生の </script> は出ない
    expect(html).toContain('\\u003c/script\\u003e');
    // 表示部の </script> ではなく、payload 内の </script> リテラルが現れないこと
    // (表示部 <pre> は escapeHtml で &lt;/script&gt; になるので生 < は無い)
    expect(html).not.toMatch(/code:\s*"[^"]*<\/script>/);
  });
});
