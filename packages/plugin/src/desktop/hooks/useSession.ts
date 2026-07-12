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

import { personaForPurpose } from '../../core/bootstrap/builtInAgents';
import { composeSystemPrompt, effectiveBase } from '../../core/bootstrap/commonPrompts';
import { initializeSession } from '../../core/bootstrap/initializeSession';
import { DEFAULT_AGENT_PERSONA } from '../../core/bootstrap/resolveAgent';
import { resolveMemoryResources } from '../../core/bootstrap/resolveMemoryStore';
import { createUserSession } from '../../core/bootstrap/resolveSession';
import { resolveStoredPersona } from '../../core/bootstrap/resolveStoredPersona';
import { debug } from '../../core/debug';
import { getPluginConfig } from '../../core/kintone/pluginConfig';
import { getCurrentSessionContext } from '../../core/kintone/user';
import { toErrorMessage } from '../../core/utils';
import { useChatStore } from '../../store/chatStore';

import { readMemoryEnabled } from './memoryEnabledStorage';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';

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

/** COMMON_BEHAVIOR (コード既定 base) 先頭の見出し。二重 base 検出 (E2E) 用のマーカー。 */
const BASE_MARKER = '【基本姿勢】';

/**
 * #141: session override 用の `system = effectiveBase(config) + persona` を組み立てる。
 * persona は **全エージェント (built-in / custom) の焼き込み system をキャッシュ取得**する。
 * 焼き込みは persona-only なので二重 base にならず、モーダルでの編集も反映される。
 * 取得失敗時は built-in なら code persona へフォールバック、custom は override せず継続。
 * 素の Default Agent (built-in 解決なし経路) は store に無いので code persona を使う。
 */
async function buildSystemOverride(
  activeAgent: AgentRecord | undefined,
  pluginId: string | null,
): Promise<string | undefined> {
  try {
    let persona: string | null;
    if (!activeAgent) {
      persona = DEFAULT_AGENT_PERSONA; // 素の Default Agent (store に無い / 編集不可)
    } else {
      persona = await resolveStoredPersona(activeAgent.id); // 焼き込み persona を取得 (キャッシュ)
      if (persona === null && activeAgent.purpose !== 'custom') {
        persona = personaForPurpose(activeAgent.purpose); // 取得失敗時の built-in フォールバック
      }
    }
    if (!persona) return undefined;
    const override = pluginId ? getPluginConfig(pluginId).baseSystemPromptOverride : null;
    const base = effectiveBase(override);
    const systemOverride = composeSystemPrompt(base, persona);
    // 反映確認用。usingCustomBase=true なら Config の base override を使用中。
    // 全文 (systemOverride) は debug ログ (window.__coworkDebug=true) のみに出し、window には
    // サマリだけ常時記録する (同一ページの他スクリプトへ prompt 全文を晒さない — レビュー指摘)。
    const summary = {
      usingCustomBase: Boolean(override && override.trim().length > 0),
      baseLen: base.length,
      personaLen: persona.length,
      totalLen: systemOverride.length,
      // コード既定 base の見出し出現回数。既定 base 使用時は 1 が正常 (2 なら二重 base)。
      baseMarkerCount: systemOverride.split(BASE_MARKER).length - 1,
    };
    debug('Session', 'system override applied', { ...summary, systemOverride });
    if (typeof window !== 'undefined') {
      (window as unknown as { __coworkLastSystemOverride?: unknown }).__coworkLastSystemOverride = summary;
    }
    return systemOverride;
  } catch {
    return undefined;
  }
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
  const setMemoryEnabled = useChatStore((s) => s.setMemoryEnabled);

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
        // #15: Memory トグルの per-user 永続値を反映 (既定 ON / opt-out)
        setMemoryEnabled(readMemoryEnabled(kctx.kintoneDomain, kctx.kintoneUserCode));

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
  }, [setStatus, setAgentId, setBuiltInAgents, setCurrentAgentId, setCurrentUserAccess, setIsAdminResolved, setMemoryEnabled]);

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

    // 通知 (#13): アクティブ Agent に Webhook が登録済なら通知 Vault を vault_ids に加える。
    const activeAgent = state.builtInAgents.find((a) => a.id === activeAgentId);
    const notifyVaultId = activeAgent?.notifyVaultId;

    const p = (async (): Promise<string> => {
      try {
        // #15: Memory トグル ON のとき、preferences + agent-context を find-or-create して attach。
        // 解決失敗は会話を止めない (catch→null)。attach は session 作成時のみ可能。
        const memoryResources = state.memoryEnabled
          ? await resolveMemoryResources({
              kintoneDomain: ctx.kintoneDomain,
              kintoneUserCode: ctx.kintoneUserCode,
              agentId: activeAgentId,
            })
          : undefined;

        // #141: session override で system = effectiveBase(config) + persona を注入。
        // base は Plugin Config で編集可 (未設定=既定)。built-in/DEFAULT の persona は code から
        // 解決 (fetch 不要)。custom は M3 まで override せず焼き込み persona で動く。失敗は握りつぶす。
        const systemOverride = await buildSystemOverride(activeAgent, state.pluginId);

        const session = await createUserSession({
          agentId: activeAgentId,
          environmentId,
          kintoneDomain: ctx.kintoneDomain,
          kintoneUserCode: ctx.kintoneUserCode,
          ...(vaultId ? { vaultId } : {}),
          ...(notifyVaultId ? { notifyVaultId } : {}),
          ...(firstMessage ? { firstMessage } : {}),
          ...(memoryResources && memoryResources.length > 0 ? { memoryResources } : {}),
          ...(systemOverride ? { systemOverride } : {}),
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
