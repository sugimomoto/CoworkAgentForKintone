import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  generateNotifyKey,
  isValidNotifyKey,
  notifyKeyForBuiltIn,
  registerNotifyWebhook,
  unregisterNotifyWebhook,
} from './notifyRegistration';

const resolveNotifyVaultMock = vi.fn();
const upsertStaticBearerMock = vi.fn();
const archiveCredentialMock = vi.fn();

vi.mock('./resolveNotifyVault', () => ({
  resolveNotifyVault: (...a: unknown[]) => resolveNotifyVaultMock(...a),
}));
vi.mock('../oauth/credentialsUpsertClient', () => ({
  upsertStaticBearerCredential: (...a: unknown[]) => upsertStaticBearerMock(...a),
}));
vi.mock('../managed-agents/resources', () => ({
  archiveVaultCredential: (...a: unknown[]) => archiveCredentialMock(...a),
}));

const WEBHOOK = 'https://hooks.slack.com/services/T0/B0/SECRET';
const BASE = {
  pluginId: 'plg_1',
  workerUrl: 'https://w.example.com',
  kintoneDomain: 'example.cybozu.com',
  notifyKey: 'business',
  webhookUrl: WEBHOOK,
  platform: 'slack',
};

beforeEach(() => {
  resolveNotifyVaultMock.mockReset();
  upsertStaticBearerMock.mockReset();
  archiveCredentialMock.mockReset();
  resolveNotifyVaultMock.mockResolvedValue({ id: 'vlt_notify' });
  upsertStaticBearerMock.mockResolvedValue({ credential_id: 'vcrd_1', vault_id: 'vlt_notify' });
});

describe('notifyKey helpers', () => {
  it('notifyKeyForBuiltIn は purpose を URL セーフ化', () => {
    expect(notifyKeyForBuiltIn('business')).toBe('business');
    expect(notifyKeyForBuiltIn('data analyst')).toBe('data-analyst');
  });
  it('generateNotifyKey は valid な key を返す', () => {
    expect(isValidNotifyKey(generateNotifyKey())).toBe(true);
  });
  it('isValidNotifyKey は不正文字を弾く', () => {
    expect(isValidNotifyKey('a/b')).toBe(false);
    expect(isValidNotifyKey('ok-key_1')).toBe(true);
  });
});

describe('registerNotifyWebhook', () => {
  it('新規: mcpServerUrl を渡して Create し metadata を返す', async () => {
    const meta = await registerNotifyWebhook(BASE);

    expect(meta).toEqual({
      notifyPlatform: 'slack',
      notifyKey: 'business',
      notifyCredentialId: 'vcrd_1',
      notifyVaultId: 'vlt_notify',
    });
    const arg = upsertStaticBearerMock.mock.calls[0]![0];
    expect(arg.token).toBe(WEBHOOK);
    expect(arg.mcpServerUrl).toBe('https://w.example.com/notify/example.cybozu.com/business');
    expect(arg.credentialId).toBeUndefined();
  });

  it('同一 Vault に既存 credential があれば in-place 更新 (mcpServerUrl 無し)', async () => {
    await registerNotifyWebhook({
      ...BASE,
      existingVaultId: 'vlt_notify',
      existingCredentialId: 'vcrd_old',
    });
    const arg = upsertStaticBearerMock.mock.calls[0]![0];
    expect(arg.credentialId).toBe('vcrd_old');
    expect(arg.mcpServerUrl).toBeUndefined();
  });

  it('既存 credential が別 Vault なら Create 扱い', async () => {
    await registerNotifyWebhook({
      ...BASE,
      existingVaultId: 'vlt_OTHER',
      existingCredentialId: 'vcrd_old',
    });
    const arg = upsertStaticBearerMock.mock.calls[0]![0];
    expect(arg.credentialId).toBeUndefined();
    expect(arg.mcpServerUrl).toBeDefined();
  });

  it('不正な notifyKey は弾く', async () => {
    await expect(registerNotifyWebhook({ ...BASE, notifyKey: 'bad/key' })).rejects.toThrow();
    expect(upsertStaticBearerMock).not.toHaveBeenCalled();
  });
});

describe('unregisterNotifyWebhook', () => {
  it('credential を archive する', async () => {
    await unregisterNotifyWebhook({ vaultId: 'vlt_notify', credentialId: 'vcrd_1' });
    expect(archiveCredentialMock).toHaveBeenCalledWith('vlt_notify', 'vcrd_1');
  });
});
