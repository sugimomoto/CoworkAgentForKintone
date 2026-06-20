// Cowork Agent for kintone — Agent / Environment ブートストラップフック
//
// 起動時に Default Agent と Bootstrap Environment を解決し、status を ready にする。
// Session は **作成しない** (設計変更: 20260425-session-redesign)。
//
// Session のライフサイクル:
//   - ensureSession(): まだ無ければ新規作成 (初送信時)。in-flight 保護で連投にも 1 本だけ作る
//   - selectSession(id): 履歴復元時に sessionId を切替えて messages をクリア
//   - startNewConversation(): messages を空に、sessionId を null に戻す

import { useCallback, useEffect, useRef } from 'react';

import { initializeSession } from '../../core/bootstrap/initializeSession';
import { createUserSession } from '../../core/bootstrap/resolveSession';
import { getCurrentSessionContext } from '../../core/kintone/user';
import { toErrorMessage } from '../../core/utils';
import { useChatStore } from '../../store/chatStore';

export interface UseSessionResult {
  /** 既存 sessionId があれば返す。無ければ新規作成して store に保存し、その id を返す。 */
  ensureSession: (firstMessage?: string) => Promise<string>;
  /** 履歴から特定 Session を復元する。messages をクリアして sessionId を切替える。 */
  selectSession: (sessionId: string) => void;
  /** 新規会話を開始する (messages クリア + sessionId を null に戻す)。 */
  startNewConversation: () => void;
}

interface ResolvedContext {
  agentId: string;
  environmentId: string;
  kintoneDomain: string;
  kintoneUserCode: string;
}

/**
 * localStorage キー: 最後に選択した Agent ID を (kintone domain × userCode) 単位で保存。
 * Plugin 再起動時に同じ Agent で再開できる。
 */
function currentAgentStorageKey(kintoneDomain: string, kintoneUserCode: string): string {
  return `cowork-agent:current-agent:${kintoneDomain}:${kintoneUserCode}`;
}

export function useSession(): UseSessionResult {
  const setSessionId = useChatStore((s) => s.setSessionId);
  const setAgentId = useChatStore((s) => s.setAgentId);
  const setStatus = useChatStore((s) => s.setStatus);
  const setCurrentUserAccess = useChatStore((s) => s.setCurrentUserAccess);
  const setIsAdminResolved = useChatStore((s) => s.setIsAdminResolved);
  const resetConversation = useChatStore((s) => s.resetConversation);
  const startNewConversationStore = useChatStore((s) => s.startNewConversation);
  const setBuiltInAgents = useChatStore((s) => s.setBuiltInAgents);
  const setCurrentAgentId = useChatStore((s) => s.setCurrentAgentId);

  const ctxRef = useRef<ResolvedContext | null>(null);
  const inFlightRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('bootstrapping');
    (async () => {
      try {
        const pluginId = useChatStore.getState().pluginId;
        // localStorage 由来の前回選択 Agent (Web Storage は core に持ち込まない)
        const kctx = getCurrentSessionContext();
        const preferredAgentId = readStoredAgentId(kctx);

        const result = await initializeSession(
          { pluginId, preferredAgentId },
          { signal: controller.signal },
        );

        ctxRef.current = {
          agentId: result.agentId,
          environmentId: result.environmentId,
          kintoneDomain: result.kintoneDomain,
          kintoneUserCode: result.kintoneUserCode,
        };

        // built-in 解決経路 (workerUrl あり) のときだけ Header / ACL 関連を反映する
        if (result.builtInAgents !== null) {
          setCurrentUserAccess(result.currentUserAccess);
          setIsAdminResolved(result.isAdmin ?? false);
          setBuiltInAgents(result.builtInAgents);
          setCurrentAgentId(result.agentId);
        }

        setAgentId(result.agentId);
        setStatus('ready');
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = toErrorMessage(err);
        const lower = message.toLowerCase();
        const hint =
          lower.includes('failed to fetch') || lower.includes('network')
            ? ' — kintone のプロキシ設定で Worker URL (`<workerUrl>/anthropic/`) への許可 (GET / POST) が登録されているか確認してください。プラグイン設定画面で「保存」を押すと再登録されます。'
            : lower.includes('authentication')
              ? ' — kintone プラグイン設定の Anthropic API Key が正しいか確認してください。'
              : '';
        setStatus('error', `${message}${hint}`);
      }
    })();
    return () => {
      controller.abort();
    };
  }, [setStatus, setAgentId, setBuiltInAgents, setCurrentAgentId, setCurrentUserAccess, setIsAdminResolved]);

  const ensureSession = useCallback(async (firstMessage?: string): Promise<string> => {
    const state = useChatStore.getState();
    const existing = state.sessionId;
    if (existing) return existing;
    if (inFlightRef.current) return inFlightRef.current;

    const ctx = ctxRef.current;
    if (!ctx) throw new Error('bootstrap が完了していません');

    // bound 状態なら vault_ids を含めて Session を作成 (MCP の access_token 解決に必要)
    const useVault =
      state.bindingStatus === 'bound' &&
      state.vaultId !== null &&
      state.credentialId !== null;
    const environmentId = ctx.environmentId;
    const vaultId = useVault ? state.vaultId! : undefined;

    // Customizer wedge V1: currentAgentId が設定されていればそれを優先 (Header プルダウンで切替された Agent)。
    // 無ければ bootstrap 時の ctx.agentId にフォールバック。
    const activeAgentId = state.currentAgentId ?? ctx.agentId;

    const p = (async (): Promise<string> => {
      try {
        const session = await createUserSession({
          agentId: activeAgentId,
          environmentId,
          kintoneDomain: ctx.kintoneDomain,
          kintoneUserCode: ctx.kintoneUserCode,
          ...(vaultId ? { vaultId } : {}),
          ...(firstMessage ? { firstMessage } : {}),
        });
        setSessionId(session.id);
        return session.id;
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = p;
    return p;
  }, [setSessionId]);

  const setAgentRunning = useChatStore((s) => s.setAgentRunning);
  const setSessionTerminated = useChatStore((s) => s.setSessionTerminated);

  const selectSession = useCallback(
    (sessionId: string) => {
      resetConversation();
      setSessionId(sessionId);
      // 切替先のセッション状態を最初は未知扱いにする (フラグが残ると古い banner が出続ける)
      setAgentRunning(false);
      setSessionTerminated(false);
    },
    [resetConversation, setSessionId, setAgentRunning, setSessionTerminated],
  );

  const startNewConversation = useCallback(() => {
    startNewConversationStore();
  }, [startNewConversationStore]);

  return { ensureSession, selectSession, startNewConversation };
}

// ─── Customizer wedge V1 ヘルパー ────────────────────────────────────────

/**
 * 前回選択した Agent ID を localStorage から読む (無ければ null)。
 * Web Storage 依存はここ (hook 層) に閉じ込め、core の initializeSession には
 * preferredAgentId として渡す。localStorage 不可な環境 (Vitest 含む) では null。
 */
function readStoredAgentId(ctx: { kintoneDomain: string; kintoneUserCode: string }): string | null {
  try {
    return window.localStorage.getItem(
      currentAgentStorageKey(ctx.kintoneDomain, ctx.kintoneUserCode),
    );
  } catch {
    return null;
  }
}

/**
 * Header から呼ばれる「Agent 切替」のフロー。
 * - localStorage に保存
 * - chatStore.currentAgentId / agentId を更新
 * - 新規会話を開始 (messages クリア + sessionId null)
 *
 * 既に同じ agentId が選択中なら no-op (= 不要な startNewConversation を抑制)。
 * 本ヘルパーは hook 外でも使えるよう独立関数。
 */
export function selectAgent(
  agentId: string,
  ctx: { kintoneDomain: string; kintoneUserCode: string },
): void {
  const store = useChatStore.getState();
  if (store.currentAgentId === agentId) return;
  try {
    window.localStorage.setItem(currentAgentStorageKey(ctx.kintoneDomain, ctx.kintoneUserCode), agentId);
  } catch {
    // ignore
  }
  store.setCurrentAgentId(agentId);
  store.setAgentId(agentId);
  store.startNewConversation();
}
