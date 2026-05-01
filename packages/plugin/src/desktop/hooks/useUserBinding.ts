// Cowork Agent for kintone — kintone OAuth バインディングフック
//
// 起動時 (bootstrapStatus='ready') に既存 Vault Credential を検索して bound 状態を確定。
// 未バインドなら connect() で OAuth flow → Vault Credential 作成を実行する。

import { useCallback, useEffect, useRef } from 'react';

import { resolveUserVault } from '../../core/bootstrap/resolveVault';
import { DEFAULT_KINTONE_OAUTH_SCOPE, METADATA_SOURCE } from '../../core/constants';
import { getPluginConfig } from '../../core/kintone/pluginConfig';
import { getCurrentSessionContext } from '../../core/kintone/user';
import {
  filterByMetadata,
  listVaultCredentials,
  listVaults,
  pickOldest,
} from '../../core/managed-agents/resources';
import { CredentialUpsertError, upsertKintoneCredential } from '../../core/oauth/credentialsUpsertClient';
import { clearPkce, generatePkce, savePkce } from '../../core/oauth/pkce';
import { openOAuthPopup } from '../../core/oauth/popup';
import { buildMcpServerUrl, joinUrl, toErrorMessage } from '../../core/utils';
import { exchangeCodeForTokens } from '../../core/oauth/tokenExchange';
import { useChatStore } from '../../store/chatStore';

import type { BindingStatus } from '../../store/chatStore';

export interface UseUserBindingResult {
  status: BindingStatus;
  error: string | null;
  /** OAuth flow を起動して Vault Credential を作成・更新する */
  connect: () => Promise<void>;
}

function buildAuthorizationUrl(args: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
}): string {
  const u = new URL(args.authorizationEndpoint);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', args.clientId);
  u.searchParams.set('redirect_uri', args.redirectUri);
  u.searchParams.set('scope', args.scope);
  u.searchParams.set('state', args.state);
  u.searchParams.set('code_challenge', args.codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

export function useUserBinding(): UseUserBindingResult {
  const status = useChatStore((s) => s.bindingStatus);
  const error = useChatStore((s) => s.bindingError);
  const bootstrapStatus = useChatStore((s) => s.status);
  const setBindingStatus = useChatStore((s) => s.setBindingStatus);
  const setVaultId = useChatStore((s) => s.setVaultId);
  const setCredentialId = useChatStore((s) => s.setCredentialId);

  const inFlightConnectRef = useRef<Promise<void> | null>(null);
  const hasCheckedRef = useRef(false);

  // 起動完了後に既存 Vault + Credential を 1 回だけ検索
  useEffect(() => {
    if (bootstrapStatus !== 'ready') return;
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    let cancelled = false;
    setBindingStatus('checking');
    (async () => {
      try {
        const kctx = getCurrentSessionContext();
        const filter = {
          source: METADATA_SOURCE,
          kintoneDomain: kctx.kintoneDomain,
          kintoneUserCode: kctx.kintoneUserCode,
        };
        const vaults = await listVaults({ limit: 100 });
        if (cancelled) return;
        const vMatches = filterByMetadata(vaults.data, filter);
        if (vMatches.length === 0) {
          setBindingStatus('unbound');
          return;
        }
        const vault = pickOldest(vMatches);
        const creds = await listVaultCredentials(vault.id);
        if (cancelled) return;
        const activeCred = creds.data.find((c) => !c.archived_at);
        if (!activeCred) {
          setBindingStatus('unbound');
          return;
        }
        setVaultId(vault.id);
        setCredentialId(activeCred.id);
        setBindingStatus('bound');
      } catch (err) {
        if (cancelled) return;
        const message = toErrorMessage(err);
        setBindingStatus('error', message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrapStatus, setBindingStatus, setVaultId, setCredentialId]);

  const connect = useCallback(async (): Promise<void> => {
    if (inFlightConnectRef.current) return inFlightConnectRef.current;

    const state = useChatStore.getState();
    const pluginId = state.pluginId;
    if (!pluginId) {
      setBindingStatus('error', 'Plugin ID が解決されていません');
      throw new Error('Plugin ID is not set');
    }
    const cfg = getPluginConfig(pluginId);
    if (!cfg.workerUrl) {
      const msg = 'Worker URL が未設定です。プラグイン設定画面で登録してください。';
      setBindingStatus('error', msg);
      throw new Error(msg);
    }
    if (!cfg.oauthClientId) {
      const msg = 'kintone OAuth クライアント ID が未設定です。プラグイン設定画面で登録してください。';
      setBindingStatus('error', msg);
      throw new Error(msg);
    }

    const workerUrl = cfg.workerUrl.replace(/\/$/, '');
    const kctx = getCurrentSessionContext();
    const redirectUri = joinUrl(workerUrl, 'oauth/callback');
    const mcpServerUrl = buildMcpServerUrl(workerUrl, kctx.kintoneDomain);
    const scope = DEFAULT_KINTONE_OAUTH_SCOPE;
    const tokenEndpoint = `https://${kctx.kintoneDomain}/oauth2/token`;
    const authorizationEndpoint = `https://${kctx.kintoneDomain}/oauth2/authorization`;
    const workerOrigin = new URL(workerUrl).origin;

    const p = (async (): Promise<void> => {
      try {
        setBindingStatus('binding');

        // 1. PKCE / state
        const pkce = await generatePkce();
        savePkce(pkce);

        // 2. authorization URL を popup で開く
        const authUrl = buildAuthorizationUrl({
          authorizationEndpoint,
          clientId: cfg.oauthClientId!,
          redirectUri,
          scope,
          state: pkce.state,
          codeChallenge: pkce.codeChallenge,
        });
        const payload = await openOAuthPopup({
          authorizationUrl: authUrl,
          expectedState: pkce.state,
          expectedOrigin: workerOrigin,
        });
        if (!payload.code) throw new Error('no code in OAuth callback');

        // 3. /oauth2/token と交換
        const tokens = await exchangeCodeForTokens({
          pluginId,
          tokenUrl: tokenEndpoint,
          redirectUri,
          code: payload.code,
          codeVerifier: pkce.codeVerifier,
        });

        // 4. ユーザー Vault を解決
        const vault = await resolveUserVault({
          kintoneDomain: kctx.kintoneDomain,
          kintoneUserCode: kctx.kintoneUserCode,
        });

        // 5. credential upsert
        const existingCredentialId = useChatStore.getState().credentialId;
        const upsertArgs = {
          pluginId,
          workerUrl,
          vaultId: vault.id,
          mcpServerUrl,
          accessToken: tokens.access_token,
          expiresIn: tokens.expires_in,
          ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
          tokenEndpoint,
          scope,
        };
        let result;
        try {
          result = await upsertKintoneCredential({
            ...upsertArgs,
            ...(existingCredentialId ? { credentialId: existingCredentialId } : {}),
          });
        } catch (err) {
          if (err instanceof CredentialUpsertError && err.status === 404 && existingCredentialId) {
            // 古い credential が archive 済 → credentialId をクリアして create で再試行
            setCredentialId(null);
            result = await upsertKintoneCredential(upsertArgs);
          } else {
            throw err;
          }
        }

        setVaultId(result.vault_id);
        setCredentialId(result.credential_id);
        setBindingStatus('bound');
        clearPkce();
      } catch (err) {
        const message = toErrorMessage(err);
        setBindingStatus('error', message);
        clearPkce();
        throw err;
      } finally {
        inFlightConnectRef.current = null;
      }
    })();
    inFlightConnectRef.current = p;
    return p;
  }, [setBindingStatus, setVaultId, setCredentialId]);

  return { status, error, connect };
}
