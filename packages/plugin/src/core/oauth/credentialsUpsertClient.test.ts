import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { upsertKintoneCredential } from './credentialsUpsertClient';

const PLUGIN_ID = 'plg_test';
const WORKER_URL = 'https://worker.example.com';

let proxyMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  proxyMock = vi.fn();
  // @ts-expect-error global kintone shim
  globalThis.kintone = { plugin: { app: { proxy: proxyMock } } };
});

afterEach(() => {
  // @ts-expect-error cleanup
  delete globalThis.kintone;
});

const ARGS_CREATE = {
  pluginId: PLUGIN_ID,
  workerUrl: WORKER_URL,
  vaultId: 'vlt_abc',
  mcpServerUrl: `${WORKER_URL}/mcp`,
  accessToken: 'AT',
  expiresIn: 3600,
  refreshToken: 'RT',
  scope: 'k:app_record:read',
};

describe('upsertKintoneCredential', () => {
  it('Worker /credentials/upsert に POST する', async () => {
    proxyMock.mockResolvedValue([
      JSON.stringify({ credential_id: 'vcrd_new', vault_id: 'vlt_abc' }),
      200,
    ]);

    const result = await upsertKintoneCredential(ARGS_CREATE);

    expect(result.credential_id).toBe('vcrd_new');
    expect(result.vault_id).toBe('vlt_abc');

    expect(proxyMock).toHaveBeenCalledWith(
      PLUGIN_ID,
      `${WORKER_URL}/credentials/upsert`,
      'POST',
      {},
      expect.any(String),
    );
  });

  it('body に client_secret / client_id / Anthropic API key を含めない (kintone proxy ヘッダ経由のみ)', async () => {
    proxyMock.mockResolvedValue([
      JSON.stringify({ credential_id: 'vcrd_new', vault_id: 'vlt_abc' }),
      200,
    ]);

    await upsertKintoneCredential(ARGS_CREATE);

    const bodyStr = proxyMock.mock.calls[0]![4] as string;
    const body = JSON.parse(bodyStr);
    expect(body).not.toHaveProperty('clientSecret');
    expect(body).not.toHaveProperty('clientId');
    expect(body).not.toHaveProperty('anthropicApiKey');
    expect(body).not.toHaveProperty('client_secret');
    expect(body).not.toHaveProperty('client_id');
    // 必要フィールドは入っている
    expect(body.vaultId).toBe('vlt_abc');
    expect(body.accessToken).toBe('AT');
    expect(body.refreshToken).toBe('RT');
  });

  it('credentialId 有り → body に含める', async () => {
    proxyMock.mockResolvedValue([
      JSON.stringify({ credential_id: 'vcrd_existing', vault_id: 'vlt_abc' }),
      200,
    ]);

    await upsertKintoneCredential({ ...ARGS_CREATE, credentialId: 'vcrd_existing' });

    const body = JSON.parse(proxyMock.mock.calls[0]![4] as string);
    expect(body.credentialId).toBe('vcrd_existing');
  });

  it('4xx は CredentialUpsertError として例外投げ、status を保持', async () => {
    proxyMock.mockResolvedValue([
      JSON.stringify({ error: 'anthropic_error', status: 404, body: 'archived' }),
      404,
    ]);

    await expect(upsertKintoneCredential(ARGS_CREATE)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('レスポンスが credential_id 欠損なら例外', async () => {
    proxyMock.mockResolvedValue([JSON.stringify({}), 200]);

    await expect(upsertKintoneCredential(ARGS_CREATE)).rejects.toThrow(/credential_id/);
  });
});
