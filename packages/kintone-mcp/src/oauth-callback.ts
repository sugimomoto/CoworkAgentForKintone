// GET /oauth/callback
//
// kintone OAuth Authorization Server (cybozu.com /oauth2/authorization) が
// 認可コードを redirect_uri にリダイレクトしてくる先。
//
// Worker 自体は code を受け取って:
//   1. 親ウィンドウ (Plugin) に postMessage で {code, state} を転送 (本番フロー)
//   2. 同時にページ上に code/state を可視表示 (検証スクリプトでコピペするため)
// を両立させる。Worker 自身は token 交換も client_secret も持たない。

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** JSON を inline <script> 内に埋めるとき、`</script>` での早期 close を防ぐ。 */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

export function handleOAuthCallback(request: Request): Response {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  const isError = !code || error;
  const codeJson = jsonForScript(code ?? '');
  const stateJson = jsonForScript(state);
  const errorJson = jsonForScript(error ?? null);
  const errorDescJson = jsonForScript(errorDescription ?? null);

  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>kintone OAuth Callback</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; color: #1f2937; }
    h1 { font-size: 18px; margin-bottom: 8px; }
    .ok { color: #059669; }
    .err { color: #dc2626; }
    pre { background: #f3f4f6; padding: 12px; border-radius: 8px; word-break: break-all; white-space: pre-wrap; font-size: 12px; }
    .note { color: #6b7280; font-size: 12px; margin-top: 16px; }
    button { padding: 6px 12px; border-radius: 6px; border: 1px solid #d1d5db; background: #fff; cursor: pointer; }
  </style>
</head>
<body>
  <h1 class="${isError ? 'err' : 'ok'}">${isError ? '認可エラー' : '認可コードを受け取りました'}</h1>

  ${
    isError
      ? `<p>kintone から OAuth エラーが返されました。</p>
         <pre>error: ${escapeHtml(error ?? 'unknown')}
error_description: ${escapeHtml(errorDescription ?? '')}</pre>`
      : `<p>下の <code>code</code> を検証スクリプト or Plugin に渡してください。<br/>
         (popup で開かれた場合は親ウィンドウへ自動転送されます)</p>
         <h2 style="font-size:14px;margin-top:16px;">code</h2>
         <pre id="code">${escapeHtml(code ?? '')}</pre>
         <h2 style="font-size:14px;">state</h2>
         <pre>${escapeHtml(state)}</pre>
         <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('code').textContent); this.textContent='コピーしました';">code をコピー</button>`
  }

  <p class="note">このウィンドウは閉じて構いません。</p>

  <script>
    (function() {
      var payload = {
        source: 'cowork-agent-kintone-mcp',
        code: ${codeJson},
        state: ${stateJson},
        error: ${errorJson},
        error_description: ${errorDescJson}
      };
      try {
        if (window.opener) {
          // Plugin (kintone ドメイン) は targetOrigin が事前に分からないため "*"
          // ただし state を別途検証することで CSRF を防ぐ
          window.opener.postMessage(payload, '*');
        }
      } catch (e) {
        console.error('postMessage failed', e);
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
