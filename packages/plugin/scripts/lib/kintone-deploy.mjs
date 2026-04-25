// kintone REST API でアプリ設定を deploy するための共通ライブラリ。
// scripts/deploy-app.mjs と e2e/config.spec.ts から共有される。
//
// 認証: Basic 認証 (X-Cybozu-Authorization)
// 注意点:
//   - 単一アプリの status クエリは apps=N (apps[0]=N は CB_IL02 で拒否される)
//   - GET 時は Content-Type を付けない (kintone が 400 を返す)

export function basicAuthHeader(username, password) {
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  return { 'X-Cybozu-Authorization': auth };
}

export async function startDeploy({ baseUrl, authHeader, appId }) {
  const res = await fetch(`${baseUrl}/k/v1/preview/app/deploy.json`, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ apps: [{ app: Number(appId), revision: -1 }] }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST deploy failed: ${res.status} ${body}`);
  }
}

export async function getDeployStatus({ baseUrl, authHeader, appId }) {
  const res = await fetch(`${baseUrl}/k/v1/preview/app/deploy.json?apps=${appId}`, {
    headers: authHeader,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET deploy status failed: ${res.status} ${body}`);
  }
  const json = await res.json();
  return json.apps?.[0]?.status ?? '';
}

/**
 * deploy 開始 → SUCCESS まで poll する。
 * @param {object} opts
 * @param {string} opts.baseUrl
 * @param {Record<string,string>} opts.authHeader
 * @param {number|string} opts.appId
 * @param {number} [opts.timeoutMs=300_000] 全体タイムアウト
 * @param {number} [opts.intervalMs=2_000] poll 間隔
 * @param {(status: string) => void} [opts.onStatus] poll ごとに呼ばれる進捗コールバック
 */
export async function deployAndWait(opts) {
  const { timeoutMs = 5 * 60_000, intervalMs = 2_000, onStatus } = opts;
  await startDeploy(opts);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getDeployStatus(opts);
    onStatus?.(status);
    if (status === 'SUCCESS') return;
    if (status === 'FAIL' || status === 'CANCEL') {
      throw new Error(`deploy ended with status: ${status}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('deploy did not complete within timeout');
}
