// kintone proxy 設定 (setProxyConfig) に登録するステップ配列を構築する純関数。
//
// Worker root URL は前方一致なので、1 登録で配下の全パス
// (/credentials/upsert, /files/<id>/content, /skills/sync, /anthropic/*) をカバーする。
// 再保存時に空欄の secret に依存するステップは含めない (= 入力があるものだけ登録)。

export interface ProxyStep {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
}

export interface BuildProxyStepsInput {
  /** Worker root URL (末尾スラッシュ付き) */
  workerRootUrl: string;
  /** kintone 自身の /oauth2/token エンドポイント */
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  apiKey: string;
}

export function buildProxySteps(input: BuildProxyStepsInput): ProxyStep[] {
  const hasOAuth = input.clientId.length > 0 && input.clientSecret.length > 0;
  const hasApiKey = input.apiKey.length > 0;
  const steps: ProxyStep[] = [];

  // 1. /oauth2/token (token 交換 + Anthropic 自動 refresh) — kintone 自身のドメイン
  if (hasOAuth) {
    steps.push({
      url: input.tokenEndpoint,
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${input.clientId}:${input.clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  // 2. Worker root URL (POST) — 配下の全パスに共通の固定ヘッダ。
  //    各 Worker ハンドラは必要なヘッダだけ読み、不要なものは無視する。
  if (hasApiKey) {
    const postHeaders: Record<string, string> = {
      'X-Anthropic-Api-Key': input.apiKey,
      'Content-Type': 'application/json',
    };
    if (hasOAuth) {
      postHeaders['X-Kintone-OAuth-Client-Id'] = input.clientId;
      postHeaders['X-Kintone-OAuth-Client-Secret'] = input.clientSecret;
    }
    steps.push({ url: input.workerRootUrl, method: 'POST', headers: postHeaders });

    // 3. Worker root URL (GET) — 配下の全 GET エンドポイント (/files/<id>/content, /anthropic/*, /version)
    steps.push({
      url: input.workerRootUrl,
      method: 'GET',
      headers: { 'X-Anthropic-Api-Key': input.apiKey },
    });
  }

  return steps;
}
