// Cowork Agent for kintone — ユーザー Vault + Credential のバインディング状態管理
//
// Phase 1b-2 改訂版 (Remote MCP + JWT Bearer)。
// 現在は M0 cleanup の暫定スタブ。P4 で完全実装に置き換える。
//
// 完全実装の予定:
//   - 起動時: listVaults + listVaultCredentials で binding 状態判定
//   - bind(): Worker /mint → JWT 取得 → resolveUserVault → createVaultCredential

import { useCallback, useEffect, useRef } from 'react';

import { useChatStore } from '../../store/chatStore';

import type { BindingStatus } from '../../store/chatStore';

export interface BindFormValues {
  /** ログイン名 (kintone.getLoginUser().code が初期値) */
  login: string;
  /** パスワード */
  password: string;
}

export interface UseUserBindingResult {
  status: BindingStatus;
  /** P4 で完全実装。現在はスタブ。 */
  bind: (values: BindFormValues) => Promise<void>;
}

export function useUserBinding(): UseUserBindingResult {
  const status = useChatStore((s) => s.bindingStatus);
  const bootstrapStatus = useChatStore((s) => s.status);
  const setBindingStatus = useChatStore((s) => s.setBindingStatus);

  const hasCheckedRef = useRef(false);

  // 暫定: bootstrap 完了後に unbound 状態にしておく (P4 で実 Vault/Credential 検索に置換)
  useEffect(() => {
    if (bootstrapStatus !== 'ready') return;
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    setBindingStatus('unbound');
  }, [bootstrapStatus, setBindingStatus]);

  const bind = useCallback(async (_values: BindFormValues): Promise<void> => {
    // P4 で実装: Worker /mint → resolveUserVault → createVaultCredential
    throw new Error('useUserBinding.bind は P4 (Phase 1b-2 改訂) で実装予定');
  }, []);

  return { status, bind };
}
