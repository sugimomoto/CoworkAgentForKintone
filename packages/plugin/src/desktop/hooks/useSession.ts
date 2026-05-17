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

import { resolveBuiltInAgents, resolveDefaultAgent } from '../../core/bootstrap/resolveAgent';
import { BUILTIN_AGENT_SPECS } from '../../core/bootstrap/builtInAgents';
import { resolveBootstrapEnvironment } from '../../core/bootstrap/resolveEnvironment';
import { createUserSession } from '../../core/bootstrap/resolveSession';
import { getPluginConfig } from '../../core/kintone/pluginConfig';
import { getCurrentSessionContext } from '../../core/kintone/user';
import { resolveBundledSkillIds } from '../../core/skills/resolveBundledSkillIds';
import { toErrorMessage } from '../../core/utils';
import { useChatStore } from '../../store/chatStore';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';
import type { BuiltInAgentSet } from '../../core/bootstrap/resolveAgent';
import type { Agent } from '../../core/managed-agents/types';

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
  const resetConversation = useChatStore((s) => s.resetConversation);
  const startNewConversationStore = useChatStore((s) => s.startNewConversation);
  const setBuiltInAgents = useChatStore((s) => s.setBuiltInAgents);
  const setCurrentAgentId = useChatStore((s) => s.setCurrentAgentId);

  const ctxRef = useRef<ResolvedContext | null>(null);
  const inFlightRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('bootstrapping');
    (async () => {
      try {
        const pluginId = useChatStore.getState().pluginId;
        const cfg = pluginId ? getPluginConfig(pluginId) : { workerUrl: null };
        const workerUrl = cfg.workerUrl ?? undefined;
        const kctx = getCurrentSessionContext();

        // Anthropic 側 source-of-truth から custom skill_id を解決 (Plugin Config は介在しない)。
        // 失敗時は skill 無しで bootstrap を続行 (admin が同期ボタンを押せば後で attach される)。
        let customSkillIds: string[] = [];
        if (workerUrl) {
          try {
            const resolved = await resolveBundledSkillIds();
            customSkillIds = resolved
              .map((r) => r.skillId)
              .filter((id): id is string => typeof id === 'string' && id.length > 0);
          } catch {
            // 解決失敗時は skill 無し継続 (Settings View 側でも fetch して UI 反映する)
          }
        }

        // Customizer wedge V1: workerUrl があれば resolveBuiltInAgents (3 variant) を ensure。
        // 無い場合 (Bootstrap 未完了) は従来の resolveDefaultAgent にフォールバック (Phase 1b 互換)。
        let activeAgentId: string;
        let builtInSet: BuiltInAgentSet | null = null;
        const envPromise = resolveBootstrapEnvironment();

        if (workerUrl) {
          const [set, env] = await Promise.all([
            resolveBuiltInAgents({
              workerUrl,
              kintoneDomain: kctx.kintoneDomain,
              ...(customSkillIds.length > 0 ? { customSkillIds } : {}),
            }),
            envPromise,
          ]);
          if (cancelled) return;
          builtInSet = set;
          ctxRef.current = {
            agentId: '', // 下で activeAgentId を入れる
            environmentId: env.id,
            kintoneDomain: kctx.kintoneDomain,
            kintoneUserCode: kctx.kintoneUserCode,
          };

          // AgentRecord[] に変換して chatStore へ
          const records = toAgentRecords(set);
          setBuiltInAgents(records);

          // localStorage から復元 → 無ければ isDefault=true → それも無ければ最初の Agent
          activeAgentId = pickInitialAgentId(records, kctx);
          setCurrentAgentId(activeAgentId);
          ctxRef.current.agentId = activeAgentId;
        } else {
          // workerUrl 無し: 旧 resolveDefaultAgent で 1 つだけ ensure (Phase 1b 互換)
          const agentOptions: Parameters<typeof resolveDefaultAgent>[0] = {
            ...(customSkillIds.length > 0 ? { customSkillIds } : {}),
          };
          const [agent, env] = await Promise.all([
            resolveDefaultAgent(agentOptions),
            envPromise,
          ]);
          if (cancelled) return;
          activeAgentId = agent.id;
          ctxRef.current = {
            agentId: agent.id,
            environmentId: env.id,
            kintoneDomain: kctx.kintoneDomain,
            kintoneUserCode: kctx.kintoneUserCode,
          };
        }

        setAgentId(activeAgentId);
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
  }, [setStatus, setAgentId, setBuiltInAgents, setCurrentAgentId]);

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
 * resolveBuiltInAgents の戻り値 (Agent × 3) を Plugin UI 用 AgentRecord[] に変換する。
 * metadata から iconKind / iconColor / visibility / isDefault を読み、無ければ
 * BUILTIN_AGENT_SPECS のデフォルトで補完する。
 */
function toAgentRecords(set: BuiltInAgentSet): AgentRecord[] {
  return [
    agentToRecord(set.business, 'business'),
    agentToRecord(set.customizerOpus, 'customizer-opus'),
    agentToRecord(set.customizerSonnet, 'customizer-sonnet'),
  ];
}

function agentToRecord(
  agent: Agent,
  purpose: 'business' | 'customizer-opus' | 'customizer-sonnet',
): AgentRecord {
  const spec = BUILTIN_AGENT_SPECS[purpose];
  const meta = (agent.metadata ?? {}) as Record<string, string>;
  return {
    id: agent.id,
    name: spec.name,
    model: spec.modelKind,
    modelLabel: spec.modelLabel,
    description: spec.description,
    purpose,
    iconKind: (meta.iconKind as AgentRecord['iconKind']) ?? spec.iconKind,
    iconColor: (meta.iconColor as AgentRecord['iconColor']) ?? spec.iconColor,
    visibility: (meta.visibility as 'public' | 'private') ?? 'public',
    isDefault: meta.isDefault === '1' || spec.isDefault,
    ...(spec.variantGroup ? { variantGroup: spec.variantGroup } : {}),
    source: 'builtin',
  };
}

/**
 * 初期 Agent ID を決定する。
 *   1. localStorage に最後の選択あり、かつそれが records に含まれていれば、それを返す
 *   2. records 内で visibility=public + isDefault=true の Agent
 *   3. records 内で最初の visibility=public な Agent
 *   4. fallback: records[0]
 */
function pickInitialAgentId(
  records: AgentRecord[],
  ctx: { kintoneDomain: string; kintoneUserCode: string },
): string {
  if (records.length === 0) return '';
  try {
    const stored = window.localStorage.getItem(
      currentAgentStorageKey(ctx.kintoneDomain, ctx.kintoneUserCode),
    );
    if (stored && records.some((r) => r.id === stored)) return stored;
  } catch {
    // localStorage 不可な環境 (Vitest 含む) では無視
  }
  const def = records.find((r) => r.visibility === 'public' && r.isDefault);
  if (def) return def.id;
  const pub = records.find((r) => r.visibility === 'public');
  if (pub) return pub.id;
  return records[0]!.id;
}

/**
 * Header から呼ばれる「Agent 切替」のフロー。
 * - localStorage に保存
 * - chatStore.currentAgentId / agentId を更新
 * - 新規会話を開始 (messages クリア + sessionId null)
 *
 * 注意: 本ヘルパーは hook 外でも使えるよう独立関数。useSession 内では未使用。
 */
export function selectAgent(
  agentId: string,
  ctx: { kintoneDomain: string; kintoneUserCode: string },
): void {
  try {
    window.localStorage.setItem(currentAgentStorageKey(ctx.kintoneDomain, ctx.kintoneUserCode), agentId);
  } catch {
    // ignore
  }
  const store = useChatStore.getState();
  store.setCurrentAgentId(agentId);
  store.setAgentId(agentId);
  store.startNewConversation();
}
