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
import { interpretEvent, isTerminalEvent } from '../../core/managed-agents/eventInterpreter';
import { fetchAllEventsSince } from '../../core/managed-agents/events';
import { retrieveSession } from '../../core/managed-agents/resources';
import { useChatStore } from '../../store/chatStore';

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
  const setAgentRunning = useChatStore((s) => s.setAgentRunning);
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
      } catch {
        // エラーは無視して次のインターバルで再試行 (今はログもしない)
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
          }
        } catch {
          // 取得失敗は次のインターバルで再試行
        }
        if (cancelled) return;
      }

      let sawTerminal = false;
      let sawAgentMessage = false;
      for (const e of events) {
        const r = interpretEvent(e);
        if (r) {
          if (r.kind === 'add') {
            mergeMessage(r.message);
            if (r.message.kind === 'agent') sawAgentMessage = true;
          } else {
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
          }
        }
        // Agent ターン進行状態の追従
        if (e.type === 'session.status_running') setAgentRunning(true);
        if (e.type === 'session.status_terminated') {
          setSessionTerminated(true);
          // terminated は実質「もう動かない」状態なので running も明示的に下げる
          setAgentRunning(false);
        }
        lastEventIdRef.current = e.id;
        if (isTerminalEvent(e)) sawTerminal = true;
      }
      // ターン終了 (end_turn / retries_exhausted) で running フラグを下げる
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
  }, [sessionId, enabled, mergeMessage, removeMessage, updateTool, setAgentRunning, setSessionTerminated, setBindingStatus]);
}
