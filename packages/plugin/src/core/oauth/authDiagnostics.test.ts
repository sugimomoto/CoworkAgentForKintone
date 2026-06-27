import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { validateMcpOAuth } from '../managed-agents/resources';

import {
  captureAuthFailure,
  clearAuthLog,
  dumpAuthLog,
  recordAuthEvent,
  type AuthDiagnosticEntry,
} from './authDiagnostics';

vi.mock('../managed-agents/resources', () => ({
  validateMcpOAuth: vi.fn(),
}));

const mockValidate = vi.mocked(validateMcpOAuth);

const baseEntry: AuthDiagnosticEntry = {
  at: '2026-06-27T00:00:00.000Z',
  toolName: 'kintone-get-records',
  toolUseId: 'tu_1',
  errorText: '[HTTP 401] unauthorized',
  bindingStatusBefore: 'bound',
  vaultId: 'vlt_1',
  credentialId: 'vcrd_1',
  validate: null,
};

describe('authDiagnostics', () => {
  beforeEach(() => {
    clearAuthLog();
    mockValidate.mockReset();
  });
  afterEach(() => {
    clearAuthLog();
  });

  it('recordAuthEvent / dumpAuthLog で永続化・取得できる', () => {
    recordAuthEvent(baseEntry);
    const log = dumpAuthLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.errorText).toBe('[HTTP 401] unauthorized');
  });

  it('リングバッファは直近 50 件に丸める', () => {
    for (let i = 0; i < 55; i++) {
      recordAuthEvent({ ...baseEntry, toolUseId: `tu_${i}` });
    }
    const log = dumpAuthLog();
    expect(log).toHaveLength(50);
    expect(log[0]?.toolUseId).toBe('tu_5');
    expect(log[49]?.toolUseId).toBe('tu_54');
  });

  it('clearAuthLog で消える', () => {
    recordAuthEvent(baseEntry);
    clearAuthLog();
    expect(dumpAuthLog()).toHaveLength(0);
  });

  it('captureAuthFailure: validate=valid を記録する (誤検知/一過性の証拠)', async () => {
    mockValidate.mockResolvedValue({
      type: 'vault_credential_validation',
      vault_id: 'vlt_1',
      credential_id: 'vcrd_1',
      status: 'valid',
      has_refresh_token: true,
      refresh: null,
      mcp_probe: null,
    });
    await captureAuthFailure({
      toolName: 'kintone-get-records',
      toolUseId: 'tu_1',
      errorText: 'unauthorized',
      bindingStatusBefore: 'bound',
      vaultId: 'vlt_1',
      credentialId: 'vcrd_1',
    });
    const log = dumpAuthLog();
    expect(log).toHaveLength(1);
    expect(mockValidate).toHaveBeenCalledWith('vlt_1', 'vcrd_1');
    expect(log[0]?.validate).toMatchObject({ status: 'valid', hasRefreshToken: true });
  });

  it('captureAuthFailure: validate=invalid を記録する (本物の失効の証拠)', async () => {
    mockValidate.mockResolvedValue({
      type: 'vault_credential_validation',
      vault_id: 'vlt_1',
      credential_id: 'vcrd_1',
      status: 'invalid',
      has_refresh_token: true,
      refresh: { status: 'invalid_grant' },
      mcp_probe: { http_response: 401 },
    });
    await captureAuthFailure({
      toolName: 'kintone-get-records',
      toolUseId: 'tu_1',
      errorText: 'CB_OA01',
      bindingStatusBefore: 'bound',
      vaultId: 'vlt_1',
      credentialId: 'vcrd_1',
    });
    expect(dumpAuthLog()[0]?.validate).toMatchObject({
      status: 'invalid',
      refreshStatus: 'invalid_grant',
    });
  });

  it('captureAuthFailure: validate 失敗時も error として記録し握りつぶす', async () => {
    mockValidate.mockRejectedValue(new Error('network down'));
    await captureAuthFailure({
      toolName: null,
      toolUseId: 'tu_1',
      errorText: '401',
      bindingStatusBefore: 'bound',
      vaultId: 'vlt_1',
      credentialId: 'vcrd_1',
    });
    expect(dumpAuthLog()[0]?.validate).toMatchObject({ error: 'network down' });
  });

  it('captureAuthFailure: vault/credential 未確定なら validate を呼ばず skipped 記録', async () => {
    await captureAuthFailure({
      toolName: null,
      toolUseId: 'tu_1',
      errorText: '401',
      bindingStatusBefore: 'unbound',
      vaultId: null,
      credentialId: null,
    });
    expect(mockValidate).not.toHaveBeenCalled();
    expect(dumpAuthLog()[0]?.validate).toHaveProperty('skipped');
  });
});
