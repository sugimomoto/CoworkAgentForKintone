// Cowork Agent for kintone — OAuth scope 不足エラー (#20 V2 Phase 1)
//
// Customizer wedge の apply / preview で kintone REST API (`customize.json` /
// `file.json` / `deploy.json`) を呼んだ際に scope 不足 (HTTP 403 + 該当 scope
// 名がエラーメッセージに含まれる) を検出して throw する。
//
// 上位 (CustomizerArtifactView) が catch して V1 #28 既存の OAuth 再認可 UX
// (useUserBinding の再連携フロー) をトリガーする。

export class OAuthScopeError extends Error {
  constructor(
    /** 不足している scope 一覧 (例: ['k:app_settings:write']) */
    public readonly missingScopes: readonly string[],
    /** 元のレスポンス本文 (デバッグ用) */
    public readonly responseBody?: string,
  ) {
    super(`OAuth scope 不足: ${missingScopes.join(' / ')}`);
    this.name = 'OAuthScopeError';
  }
}

/**
 * kintone REST API レスポンス本文から不足 scope を推定する。
 * kintone は 403 で "permission" 系のエラーコード (CB_*) を返すが、
 * scope ベースのエラー文言は OAuth 利用時のみ。判定ロジックは緩め。
 */
export function detectMissingScopes(responseBody: string): string[] {
  const found = new Set<string>();
  // 文言ベースで scope を拾う (誤検出は実害なし、再連携を促す UX なので)
  const knownScopes = [
    'k:app_settings:write',
    'k:app_settings:read',
    'k:file:write',
    'k:file:read',
    'k:app_record:write',
    'k:app_record:read',
  ];
  for (const s of knownScopes) {
    if (responseBody.includes(s)) found.add(s);
  }
  return Array.from(found);
}
