// reconcileAgentWebhook の単体テスト (#13)。
// register/unregister と updateAgent をモックし、3 分岐 + built-in notifyKey 導出を検証する。

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { reconcileAgentWebhook } from './agentDetailApi';

const registerMock = vi.fn();
const unregisterMock = vi.fn();
const updateAgentMock = vi.fn();
const retrieveAgentMock = vi.fn();

vi.mock('../bootstrap/notifyRegistration', async () => {
  const actual = await vi.importActual<typeof import('../bootstrap/notifyRegistration')>(
    '../bootstrap/notifyRegistration',
  );
  return {
    ...actual,
    registerNotifyWebhook: (...a: unknown[]) => registerMock(...a),
    unregisterNotifyWebhook: (...a: unknown[]) => unregisterMock(...a),
  };
});
vi.mock('./resources', () => ({
  updateAgent: (...a: unknown[]) => updateAgentMock(...a),
  retrieveAgent: (...a: unknown[]) => retrieveAgentMock(...a),
  archiveAgent: vi.fn(),
  createAgent: vi.fn(),
}));

const CTX = { pluginId: 'plg_1', workerUrl: 'https://w.example.com' };

function agent(metadata: Record<string, string>) {
  return { id: 'agent_1', version: 3, metadata } as never;
}

beforeEach(() => {
  registerMock.mockReset();
  unregisterMock.mockReset();
  updateAgentMock.mockReset();
  retrieveAgentMock.mockReset();
  updateAgentMock.mockImplementation((_id: string, params: { metadata: unknown }) =>
    Promise.resolve({ id: 'agent_1', version: 4, metadata: params.metadata }),
  );
  registerMock.mockResolvedValue({
    notifyPlatform: 'slack',
    notifyKey: 'k',
    notifyCredentialId: 'vcrd_new',
    notifyVaultId: 'vlt_n',
  });
});

describe('reconcileAgentWebhook', () => {
  it('伏字のまま (url 無し) は no-op', async () => {
    const a = agent({ purpose: 'custom', notifyKey: 'abc', kintoneDomain: 'd.cybozu.com' });
    const out = await reconcileAgentWebhook(a, { platform: 'slack' }, CTX);
    expect(out).toBe(a);
    expect(registerMock).not.toHaveBeenCalled();
    expect(updateAgentMock).not.toHaveBeenCalled();
  });

  it('Custom: url 付き → register し metadata を更新', async () => {
    const a = agent({ purpose: 'custom', notifyKey: 'uuid-1', kintoneDomain: 'd.cybozu.com' });
    await reconcileAgentWebhook(
      a,
      { platform: 'slack', url: 'https://hooks.slack.com/services/x' },
      CTX,
    );
    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({ notifyKey: 'uuid-1', webhookUrl: 'https://hooks.slack.com/services/x' }),
    );
    const meta = updateAgentMock.mock.calls[0]![1].metadata;
    expect(meta.notifyPlatform).toBe('slack');
    expect(meta.notifyCredentialId).toBe('vcrd_new');
    expect(meta.notifyVaultId).toBe('vlt_n');
    // URL は metadata に残らない
    expect(JSON.stringify(meta)).not.toContain('hooks.slack.com');
  });

  it('Built-in: notifyKey は purpose から導出して register', async () => {
    const a = agent({ purpose: 'business', kintoneDomain: 'd.cybozu.com' }); // notifyKey 無し
    await reconcileAgentWebhook(a, { platform: 'teams', url: 'https://x.webhook.office.com/y' }, CTX);
    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({ notifyKey: 'business' }),
    );
  });

  it('null + 登録済 → unregister し metadata をクリア', async () => {
    const a = agent({
      purpose: 'custom',
      notifyKey: 'uuid-1',
      kintoneDomain: 'd.cybozu.com',
      notifyPlatform: 'slack',
      notifyCredentialId: 'vcrd_old',
      notifyVaultId: 'vlt_n',
    });
    await reconcileAgentWebhook(a, null, CTX);
    expect(unregisterMock).toHaveBeenCalledWith({ vaultId: 'vlt_n', credentialId: 'vcrd_old' });
    const meta = updateAgentMock.mock.calls[0]![1].metadata;
    expect(meta.notifyPlatform).toBeUndefined();
    expect(meta.notifyCredentialId).toBeUndefined();
    expect(meta.notifyVaultId).toBeUndefined();
    // notifyKey は残す (再登録で同じパスを使う)
    expect(meta.notifyKey).toBe('uuid-1');
  });

  it('null + 未登録 → 何もしない', async () => {
    const a = agent({ purpose: 'custom', notifyKey: 'uuid-1', kintoneDomain: 'd.cybozu.com' });
    const out = await reconcileAgentWebhook(a, null, CTX);
    expect(out).toBe(a);
    expect(unregisterMock).not.toHaveBeenCalled();
    expect(updateAgentMock).not.toHaveBeenCalled();
  });
});
