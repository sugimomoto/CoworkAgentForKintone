// Cowork Agent for kintone — Session イベントポーリングフック
//
// kintone.proxy は SSE 非対応のため、fetchAllEventsSince を定期呼び出しして差分取得。
// 取得した Managed Agents イベントを UI 用の ChatMessage に変換して store に追加する。
//
// バックオフ: 2s → 3s → 5s → 10s (進捗なしで段階延長)
// ターン終了後 (session.status_idle + end_turn) はポーリングを止めず、最大間隔で
// 待機し続ける。ユーザーが次のメッセージを送ると新しいイベントが流れて即座にバックオフが
// 初期値に戻る。完全停止すると次ターンの応答を取りこぼすため。

import { useEffect, useRef } from 'react';

import { POLLING_INTERVAL_MS } from '../../core/constants';
import { debug, warn } from '../../core/debug';
import { interpretEvent, isTerminalEvent } from '../../core/managed-agents/eventInterpreter';
import { fetchAllEventsSince } from '../../core/managed-agents/events';
import { mapEventToProgressKind } from '../../core/managed-agents/progressEvent';
import { retrieveSession } from '../../core/managed-agents/resources';
import { useChatStore } from '../../store/chatStore';

import type { ProgressEventKind } from '../../core/managed-agents/progressEvent';
import type { SessionEvent } from '../../core/managed-agents/types';

/**
 * tool_result の errorText が「kintone OAuth の失効」を示しているか判定する。
 *
 * Worker の /mcp が返す 401 / kintone REST API の認証エラー文言を拾う。
 * 一般のツールエラー (バリデーション失敗等) と区別するため、十分特徴的なパターンに絞る。
 */
export function isOAuthFailureText(text: string | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  if (lower.includes('unauthorized')) return true;
  if (lower.includes('invalid_token') || lower.includes('invalid token')) return true;
  if (lower.includes('token expired') || lower.includes('expired token')) return true;
  // 401 をステータスコード文脈で検出 (record id "401_xxx" や金額 "1401" を弾く)
  // 許容する形: "[HTTP 401]" "kintone 401:" "Status: 401" "(401)" "401 " "401:"
  // = 直前が word-char でない && 直後が ":" / ")" / "]" / 空白 / 文末
  if (/(?:^|[^a-z0-9_])401(?:[:)\]\s]|$)/.test(lower)) return true;
  // kintone OAuth / Basic 認証 / ログイン関連のエラーコード
  if (/\bcb_oa\d{2}\b/.test(lower)) return true; // CB_OA01 (token 無効) / CB_OA02 (scope 不足) など
  if (lower.includes('cb_au01') || lower.includes('gaia_il01')) return true;
  // OAuth 仕様上の典型メッセージ
  if (lower.includes('cannot access protected resource')) return true;
  return false;
}

export interface UseEventPollerProps {
  sessionId: string | null;
  enabled: boolean;
}

export function useEventPoller({ sessionId, enabled }: UseEventPollerProps): void {
  const mergeMessage = useChatStore((s) => s.mergeMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const updateTool = useChatStore((s) => s.updateTool);
  const upsertArtifact = useChatStore((s) => s.upsertArtifact);
  const setActiveArtifact = useChatStore((s) => s.setActiveArtifact);
  const addPendingCustomToolUse = useChatStore((s) => s.addPendingCustomToolUse);
  const removePendingCustomToolUse = useChatStore((s) => s.removePendingCustomToolUse);
  const setAgentRunning = useChatStore((s) => s.setAgentRunning);
  const setLastEvent = useChatStore((s) => s.setLastEvent);
  const setSessionTerminated = useChatStore((s) => s.setSessionTerminated);
  const setBindingStatus = useChatStore((s) => s.setBindingStatus);
  const lastEventIdRef = useRef<string | undefined>(undefined);
  const intervalIdxRef = useRef(0);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    // 一度リセット (新セッションごとに)
    lastEventIdRef.current = undefined;
    intervalIdxRef.current = 0;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const poll = async (): Promise<void> => {
      if (cancelled) return;

      let events: SessionEvent[] = [];
      try {
        events = await fetchAllEventsSince(sessionId, lastEventIdRef.current);
        if (events.length > 0) {
          debug(
            'Poller',
            `fetched ${events.length} events`,
            events.map((e) => e.type),
          );
        }
      } catch (err) {
        warn('Poller', 'fetchAllEventsSince failed', err);
      }
      if (cancelled) return;

      // Session 本体の状態も併せて確認する。
      // archive (= terminated) は events ストリームでは通知されないため、
      // Session リソースの archived_at / status を見ないと検知できない。
      // 既に terminated 確定なら再 fetch しない (無駄打ち防止)。
      if (!useChatStore.getState().sessionTerminated) {
        try {
          const session = await retrieveSession(sessionId);
          if (session.archived_at !== null && session.archived_at !== undefined) {
            setSessionTerminated(true);
            setAgentRunning(false);
          } else if (session.status === 'terminated') {
            setSessionTerminated(true);
            setAgentRunning(false);
          } else if (session.status === 'idle' && useChatStore.getState().isAgentRunning) {
            // Anthropic 側が `idle` なのに、events stream に terminal stop_reason が
            // 含まれない (もしくは未到達の) ケースの安全網。
            // 「まだ進行中」とみなす条件:
            //   - 承認待ちツール (pending-confirmation) がある
            //   - オプティミスティック thinking (`pending-` プレフィックス) がある
            //   - 未応答の custom_tool_use がある (create_artifact 応答中)
            const stateNow = useChatStore.getState();
            const inProgress =
              stateNow.messages.some(
                (m) => m.kind === 'tool' && m.status === 'pending-confirmation',
              ) ||
              stateNow.messages.some(
                (m) => m.kind === 'thinking' && m.id.startsWith('pending-'),
              ) ||
              stateNow.pendingCustomToolUseIds.size > 0;
            if (!inProgress) {
              debug('Session', 'safety net: setAgentRunning(false)');
              setAgentRunning(false);
            }
          }
        } catch {
          // 取得失敗は次のインターバルで再試行
        }
        if (cancelled) return;
      }

      // 今回のバッチに含まれる user.custom_tool_result から「応答済み」を確定して
      // chatStore.pendingCustomToolUseIds から削除 (responder hook の再送ループを止める)。
      const respondedIdsThisBatch = new Set<string>();
      for (const e of events) {
        if (e.type === 'user.custom_tool_result') {
          const tuid = (e as { custom_tool_use_id?: string }).custom_tool_use_id;
          if (tuid) {
            respondedIdsThisBatch.add(tuid);
            removePendingCustomToolUse(tuid);
          }
        }
      }

      let sawTerminal = false;
      let sawAgentMessage = false;
      // バッチ内の最後の進行 event を 1 つだけ覚えておき、ループ終了後に 1 回 setLastEvent する。
      // event 1 件ずつ store に書くと subscribers が 1 batch で N 回 re-render され、
      // useElapsedSinceEvent の setInterval も無駄に teardown→再生成される (どうせ中間値は
      // <1 frame で消費されないので意味がない)。
      let lastProgress: { kind: ProgressEventKind; toolName?: string } | null = null;
      for (const e of events) {
        const effects = interpretEvent(e);
        for (const r of effects) {
          if (r.kind === 'add') {
            mergeMessage(r.message);
            if (r.message.kind === 'agent') sawAgentMessage = true;
          } else if (r.kind === 'update-tool') {
            updateTool(r.toolUseId, r.patch);
            // tool_result が OAuth 失効を示すなら bindingStatus を error に倒し、
            // ChatPanel 側の「再連携」バナーを発火させる (mid-session 自動検知)
            if (
              r.patch.status === 'error' &&
              isOAuthFailureText(r.patch.errorText) &&
              useChatStore.getState().bindingStatus !== 'error'
            ) {
              setBindingStatus('error', 'kintone の認証が切れました');
            }
          } else if (r.kind === 'upsert-artifact') {
            const artifact = upsertArtifact(r.input);
            debug('CustomTool', 'agent.custom_tool_use observed', {
              toolUseId: r.toolUseId,
              artifactId: artifact.id,
              kind: r.input.kind,
            });
            // 同じ batch 内に既に user.custom_tool_result があるなら replay = 応答済 →
            // pending には登録しない。なければ pending に積んで responder hook に POST を任せる。
            if (!respondedIdsThisBatch.has(r.toolUseId)) {
              addPendingCustomToolUse(r.toolUseId, artifact.id);
            } else {
              debug('CustomTool', 'replay: skip POST for', r.toolUseId);
            }
          } else if (r.kind === 'propose-agent') {
            // #48: Designer の propose_agent 受信 → artifact のみ生成 + 右ペインに focus。
            // モーダルは自動で開かない — ユーザーが artifact を確認し、必要なら追加の
            // 修正依頼を Designer に出した上で、自分のタイミングで「作成画面を開く」
            // ボタンを押す自然なフロー。
            const artifactId = `agent-draft-${r.toolUseId}`;
            const artifact = upsertArtifact({
              id: artifactId,
              kind: 'agent-draft',
              title: `エージェント案: ${r.draft.name}`,
              content: JSON.stringify({
                draft: r.draft,
                rationale: r.rationale,
                model: r.model,
              }),
            });
            setActiveArtifact(artifact.id);
            debug('CustomTool', 'propose_agent observed', {
              toolUseId: r.toolUseId,
              artifactId: artifact.id,
              name: r.draft.name,
            });
            // create_artifact と同じ仕組みで responder に tool_result を返してもらう
            if (!respondedIdsThisBatch.has(r.toolUseId)) {
              addPendingCustomToolUse(r.toolUseId, artifact.id);
            }
          }
        }
        // Agent ターン進行状態の追従
        if (e.type === 'session.status_running') setAgentRunning(true);
        if (e.type === 'session.status_terminated') {
          setSessionTerminated(true);
          // terminated は実質「もう動かない」状態なので running も明示的に下げる
          setAgentRunning(false);
        }
        // 進行インジケータ用: 表示対象外 event (session.*/span.*/user.* 等) は null。
        // 進行 event ならローカル変数で上書き → ループ後にまとめて 1 回 setLastEvent。
        const progress = mapEventToProgressKind(e);
        if (progress) lastProgress = progress;
        lastEventIdRef.current = e.id;
        if (isTerminalEvent(e)) sawTerminal = true;
      }
      if (lastProgress) {
        setLastEvent({
          at: Date.now(),
          kind: lastProgress.kind,
          toolName: lastProgress.toolName ?? null,
        });
      }
      // ターン終了 (end_turn / retries_exhausted / max_tokens / error) で running フラグを下げる。
      // (Custom Tool の `requires_action` は terminal ではないので isAgentRunning は維持される)
      if (sawTerminal) setAgentRunning(false);

      // オプティミスティック thinking (ChatPanel が送信時に置いた pending- プレフィックス) は
      // **実際の agent.message** または **ターン終了** にだけ除去する。
      // agent.thinking (中間思考) ではまだ最終応答が出ていないので、その上でも pending を
      // 残すことで「まだ処理中」を示し続ける。user.message のエコーや session.* だけでも消さない。
      if (sawAgentMessage || sawTerminal) {
        const pendingIds = useChatStore
          .getState()
          .messages.filter((m) => m.id.startsWith('pending-'))
          .map((m) => m.id);
        for (const id of pendingIds) removeMessage(id);
      }

      // バックオフ:
      // - ターン終了 (terminal) を見たら最大間隔まで一気に下げる (idle 状態)
      // - 新規イベントがあれば初期値に戻す
      // - それ以外 (進捗なし) は段階延長
      if (sawTerminal) {
        intervalIdxRef.current = POLLING_INTERVAL_MS.steps.length - 1;
      } else if (events.length > 0) {
        intervalIdxRef.current = 0;
      } else {
        intervalIdxRef.current = Math.min(
          intervalIdxRef.current + 1,
          POLLING_INTERVAL_MS.steps.length - 1,
        );
      }
      const delay = POLLING_INTERVAL_MS.steps[intervalIdxRef.current] ?? POLLING_INTERVAL_MS.max;

      timeoutId = setTimeout(() => {
        void poll();
      }, delay);
    };

    // 初回は即座に実行
    void poll();

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [
    sessionId,
    enabled,
    mergeMessage,
    removeMessage,
    updateTool,
    upsertArtifact,
    addPendingCustomToolUse,
    removePendingCustomToolUse,
    setAgentRunning,
    setLastEvent,
    setSessionTerminated,
    setBindingStatus,
    setActiveArtifact,
  ]);
}
