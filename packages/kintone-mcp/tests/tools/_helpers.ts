// 共通テストヘルパ (kintone-tools.test.ts / write-tools.test.ts で共有)。

import type { KintoneCreds } from '../../src/kintone';

export const TEST_CREDS: KintoneCreds = {
  domain: 'tenant.cybozu.com',
  bearer: 'oauth-access-token',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
