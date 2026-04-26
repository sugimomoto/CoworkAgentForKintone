// Cowork Agent for kintone — Vault Credential を介したバインディング状態管理
//
// 起動時 (status='ready' になった後) に listVaults + listVaultCredentials で
// 既存 Credential を検索し、bindingStatus を更新する。
// CredentialDialog から `bind(values)` が呼ばれると以下を実行:
//   1. kintone proxy 経由で Worker /mint に kintone creds を送って JWT を取得
//   2. resolveUserVault で per-user Vault を解決
//   3. 既存 Credential があれば update、無ければ create で static_bearer を登録
//   4. chatStore に vaultId / credentialId を保存

import { useCallback, useEffect, useRef } from 'react';

import { resolveUserVault } from '../../core/bootstrap/resolveVault';
import { METADATA_SOURCE } from '../../core/constants';
import { getCurrentSessionContext } from '../../core/kintone/user';
import { getPluginConfig } from '../../core/kintone/pluginConfig';
import { mintKintoneJwt } from '../../core/mcp/mintClient';
import {
  createVaultCredential,
  filterByMetadata,
  listVaultCredentials,
  listVaults,
  pickOldest,
  updateVaultCredential,
} from '../../core/managed-agents/resources';
import { useChatStore } from '../../store/chatStore';

import type { BindingStatus } from '../../store/chatStore';

export interface BindFormValues {
  /** kintone ログイン名 (kintone.getLoginUser().code が初期値) */
  login: string;
  /** kintone パスワード */
  password: string;
}

export interface UseUserBindingResult {
  status: BindingStatus;
  bind: (values: BindFormValues) => Promise<void>;
}

function buildMcpUrl(workerUrl: string): string {
  return `${workerUrl.replace(/\/$/, '')}/mcp`;
}

export function useUserBinding(): UseUserBindingResult {
  const status = useChatStore((s) => s.bindingStatus);
  const bootstrapStatus = useChatStore((s) => s.status);
  const setBindingStatus = useChatStore((s) => s.setBindingStatus);
  const setVaultId = useChatStore((s) => s.setVaultId);
  const setCredentialId = useChatStore((s) => s.setCredentialId);

  const inFlightBindRef = useRef<Promise<void> | null>(null);
  const hasCheckedRef = useRef(false);

  // 起動完了後に既存 Vault + Credential を検索 (1 回だけ)
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
        // Credential の存在確認 (Vault は作っただけで Credential が無い可能性もあるため)
        const creds = await listVaultCredentials(vault.id);
        if (cancelled) return;

        // mcp_server_url で絞り込み (= 我々の Worker URL でなくても他システムと共有してる場合)
        // alpha では admin の Worker URL に対して 1 件のみある想定
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
        const message = err instanceof Error ? err.message : String(err);
        setBindingStatus('error', message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootstrapStatus, setBindingStatus, setVaultId, setCredentialId]);

  const bind = useCallback(
    async (values: BindFormValues): Promise<void> => {
      if (inFlightBindRef.current) return inFlightBindRef.current;

      const state = useChatStore.getState();
      const pluginId = state.pluginId;
      if (!pluginId) {
        setBindingStatus('error', 'Plugin ID が解決されていません');
        throw new Error('Plugin ID is not set');
      }
      const config = getPluginConfig(pluginId);
      if (!config.workerUrl) {
        const msg = 'Worker URL が未設定です。プラグイン設定画面で MCP Server を登録してください。';
        setBindingStatus('error', msg);
        throw new Error(msg);
      }

      const p = (async (): Promise<void> => {
        try {
          setBindingStatus('binding');
          const kctx = getCurrentSessionContext();

          // 1. Worker /mint で JWT を取得
          const jwt = await mintKintoneJwt(pluginId, {
            workerUrl: config.workerUrl!,
            kintone_domain: kctx.kintoneDomain,
            kintone_login: values.login,
            kintone_password: values.password,
          });

          // 2. user 用 Vault を解決 (既存 or 新規)
          const vault = await resolveUserVault({
            kintoneDomain: kctx.kintoneDomain,
            kintoneUserCode: kctx.kintoneUserCode,
          });

          // 3. 既存 Credential を確認、あれば update、無ければ create
          const mcpUrl = buildMcpUrl(config.workerUrl!);
          const existing = await listVaultCredentials(vault.id);
          const matched = existing.data.find(
            (c) =>
              !c.archived_at &&
              c.auth.type === 'static_bearer' &&
              c.auth.mcp_server_url === mcpUrl,
          );

          let credentialId: string;
          if (matched) {
            await updateVaultCredential(vault.id, matched.id, {
              auth: {
                type: 'static_bearer',
                mcp_server_url: mcpUrl,
                token: jwt,
              },
            });
            credentialId = matched.id;
          } else {
            const created = await createVaultCredential(vault.id, {
              display_name: `kintone (${kctx.kintoneUserCode}@${kctx.kintoneDomain})`,
              auth: {
                type: 'static_bearer',
                mcp_server_url: mcpUrl,
                token: jwt,
              },
            });
            credentialId = created.id;
          }

          setVaultId(vault.id);
          setCredentialId(credentialId);
          setBindingStatus('bound');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setBindingStatus('error', message);
          throw err;
        } finally {
          inFlightBindRef.current = null;
        }
      })();
      inFlightBindRef.current = p;
      return p;
    },
    [setBindingStatus, setVaultId, setCredentialId],
  );

  return { status, bind };
}
