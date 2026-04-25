// Cowork Agent for kintone — ユーザー Vault + Environment のバインディング状態管理
//
// 起動時 (status='ready' になった後) に listVaults / listEnvironments で既存 Vault/Env を
// 検索し、bindingStatus を更新する。CredentialDialog から `bind(values)` が呼ばれると
// Vault 作成 + 認証情報書込 + ユーザー Environment 作成 を順に実行する。

import { useCallback, useEffect, useRef } from 'react';

import { ensureUserEnvironment } from '../../core/bootstrap/ensureEnvironment';
import { resolveUserVault, setVaultCredentials } from '../../core/bootstrap/resolveVault';
import { METADATA_SOURCE } from '../../core/constants';
import { getCurrentSessionContext } from '../../core/kintone/user';
import {
  filterByMetadata,
  listEnvironments,
  listVaults,
  pickOldest,
} from '../../core/managed-agents/resources';
import { useChatStore } from '../../store/chatStore';

import type { BindingStatus } from '../../store/chatStore';

export interface BindFormValues {
  domain: string;
  login: string;
  password: string;
}

export interface UseUserBindingResult {
  status: BindingStatus;
  /** CredentialDialog から呼ばれる。Vault 作成 + 認証書込 + Environment 作成を実施。 */
  bind: (values: BindFormValues) => Promise<void>;
}

export function useUserBinding(): UseUserBindingResult {
  const status = useChatStore((s) => s.bindingStatus);
  const agentId = useChatStore((s) => s.agentId);
  const bootstrapStatus = useChatStore((s) => s.status);
  const setBindingStatus = useChatStore((s) => s.setBindingStatus);
  const setVaultId = useChatStore((s) => s.setVaultId);
  const setUserEnvironmentId = useChatStore((s) => s.setUserEnvironmentId);

  const inFlightBindRef = useRef<Promise<void> | null>(null);
  const hasCheckedRef = useRef(false);

  // 起動完了後に既存 Vault / Env を検索 (1 回だけ)
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

        const [vaults, envs] = await Promise.all([
          listVaults({ limit: 100 }),
          listEnvironments({ limit: 100 }),
        ]);
        if (cancelled) return;

        const vMatches = filterByMetadata(vaults.data, filter);
        const eMatches = filterByMetadata(envs.data, filter);

        if (vMatches.length > 0 && eMatches.length > 0) {
          const v = pickOldest(vMatches);
          const e = pickOldest(eMatches);
          setVaultId(v.id);
          setUserEnvironmentId(e.id);
          setBindingStatus('bound');
        } else {
          setBindingStatus('unbound');
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setBindingStatus('error', message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootstrapStatus, setBindingStatus, setVaultId, setUserEnvironmentId]);

  const bind = useCallback(
    async (values: BindFormValues): Promise<void> => {
      if (!agentId) throw new Error('Agent が解決されていません');
      if (inFlightBindRef.current) return inFlightBindRef.current;

      const p = (async (): Promise<void> => {
        try {
          setBindingStatus('binding');
          const kctx = getCurrentSessionContext();

          // 1. Vault を解決 (既存 or 新規) → 認証情報を書込
          const vault = await resolveUserVault({
            kintoneDomain: kctx.kintoneDomain,
            kintoneUserCode: kctx.kintoneUserCode,
          });
          await setVaultCredentials(vault.id, values);

          // 2. ユーザー Environment を解決 (既存 or 新規)
          const env = await ensureUserEnvironment({
            agentId,
            kintoneDomain: kctx.kintoneDomain,
            kintoneUserCode: kctx.kintoneUserCode,
          });

          setVaultId(vault.id);
          setUserEnvironmentId(env.id);
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
    [agentId, setBindingStatus, setVaultId, setUserEnvironmentId],
  );

  return { status, bind };
}
