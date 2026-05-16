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

import { resolveDefaultAgent } from '../../core/bootstrap/resolveAgent';
import { resolveBootstrapEnvironment } from '../../core/bootstrap/resolveEnvironment';
import { createUserSession } from '../../core/bootstrap/resolveSession';
import { getPluginConfig } from '../../core/kintone/pluginConfig';
import { getCurrentSessionContext } from '../../core/kintone/user';
import { toErrorMessage } from '../../core/utils';
import { useChatStore } from '../../store/chatStore';

export interface UseSessionResult {
  /** 既存 sessionId があれば返す。無ければ新規作成して store に保存し、その id を返す。 */
  ensureSession: () => Promise<string>;
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

export function useSession(): UseSessionResult {
  const setSessionId = useChatStore((s) => s.setSessionId);
  const setAgentId = useChatStore((s) => s.setAgentId);
  const setStatus = useChatStore((s) => s.setStatus);
  const resetConversation = useChatStore((s) => s.resetConversation);
  const startNewConversationStore = useChatStore((s) => s.startNewConversation);

  const ctxRef = useRef<ResolvedContext | null>(null);
  const inFlightRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('bootstrapping');
    (async () => {
      try {
        const pluginId = useChatStore.getState().pluginId;
        const cfg = pluginId
          ? getPluginConfig(pluginId)
          : { workerUrl: null, skillsMapping: {}, skillsVersion: null };
        const workerUrl = cfg.workerUrl ?? undefined;
        const kctx = getCurrentSessionContext();

        // Issue #30: 同期済 custom skill を Agent に attach
        const customSkillIds = Object.values(cfg.skillsMapping ?? {})
          .map((entry) => entry.skillId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        const agentOptions: Parameters<typeof resolveDefaultAgent>[0] = {
          ...(workerUrl ? { workerUrl, kintoneDomain: kctx.kintoneDomain } : {}),
          ...(customSkillIds.length > 0 ? { customSkillIds } : {}),
          ...(cfg.skillsVersion ? { skillsVersion: cfg.skillsVersion } : {}),
        };

        const [agent, env] = await Promise.all([
          resolveDefaultAgent(agentOptions),
          resolveBootstrapEnvironment(),
        ]);
        if (cancelled) return;
        ctxRef.current = {
          agentId: agent.id,
          environmentId: env.id,
          kintoneDomain: kctx.kintoneDomain,
          kintoneUserCode: kctx.kintoneUserCode,
        };
        setAgentId(agent.id);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
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
      cancelled = true;
    };
  }, [setStatus, setAgentId]);

  const ensureSession = useCallback(async (): Promise<string> => {
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

    const p = (async (): Promise<string> => {
      try {
        const session = await createUserSession({
          agentId: ctx.agentId,
          environmentId,
          kintoneDomain: ctx.kintoneDomain,
          kintoneUserCode: ctx.kintoneUserCode,
          ...(vaultId ? { vaultId } : {}),
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
