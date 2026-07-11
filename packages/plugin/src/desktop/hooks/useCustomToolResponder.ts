// Custom Tool 応答ハンドラ
//
// useEventPoller が `agent.custom_tool_use` を観測すると chatStore の
// pendingCustomToolUseIds に (toolUseId → artifactId) を追加する。
// 本フックはそれを購読し、各エントリを 1 回だけ `user.custom_tool_result` として
// Anthropic に POST する。
//
// 待ちは 2 種類あり、いずれも無限には続けない (Phase 2 PR-3):
//   1. POST 失敗 → retryWithBackoff で最大 5 回まで指数バックオフ再試行
//   2. POST 成功後の echo back 待ち → 60s でタイムアウト
// どちらも上限/タイムアウト到達時は pending から除去し、ユーザーに見えるエラーを表示する
// (silent drop しない)。echo back (events stream の user.custom_tool_result) を観測すると
// useEventPoller 側で pending から除去され、ここでのタイムアウト監視も解除される。

import { useEffect } from 'react';

import { warn } from '../../core/debug';
import { postCustomToolResult } from '../../core/managed-agents/events';
import { retryWithBackoff } from '../../core/utils/retryWithBackoff';
import { useChatStore } from '../../store/chatStore';

export interface UseCustomToolResponderProps {
  sessionId: string | null;
  enabled: boolean;
}

const MAX_POST_ATTEMPTS = 5;
/** POST 成功後、events stream に echo back されるのを待つ上限 (ms) */
const ECHO_BACK_TIMEOUT_MS = 60_000;

export function useCustomToolResponder({ sessionId, enabled }: UseCustomToolResponderProps): void {
  // pendingMap を deps に入れず、enabled / sessionId のライフタイムで購読する
  // (deps に Map を入れると追加/除去のたびに effect が teardown→再生成され、
  // 進行中の retry が中断されてしまうため)。
  useEffect(() => {
    if (!enabled || !sessionId) return;

    const controller = new AbortController();
    // 既に POST 処理を開始した toolUseId (二重 POST 防止)
    const handled = new Set<string>();
    // POST 成功後の echo back 待ちタイマー
    const echoTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const clearEchoTimer = (toolUseId: string): void => {
      const t = echoTimers.get(toolUseId);
      if (t !== undefined) {
        clearTimeout(t);
        echoTimers.delete(toolUseId);
      }
    };

    const giveUp = (toolUseId: string, reason: string): void => {
      clearEchoTimer(toolUseId);
      const store = useChatStore.getState();
      if (!store.pendingCustomToolUseIds.has(toolUseId)) return; // 既に解決済みなら何もしない
      store.removePendingCustomToolUse(toolUseId);
      store.addMessage({
        id: `custom-tool-error-${toolUseId}`,
        kind: 'agent',
        text: '⚠ ツール結果の送信に失敗しました。もう一度お試しください。',
      });
      warn('CustomTool', `responder: give up ${toolUseId} (${reason})`);
    };

    const startEchoTimeout = (toolUseId: string): void => {
      if (echoTimers.has(toolUseId)) return;
      const t = setTimeout(() => {
        // 60s 経っても pending に残っている = echo back 未着 → 諦め
        giveUp(toolUseId, 'echo-back timeout');
      }, ECHO_BACK_TIMEOUT_MS);
      echoTimers.set(toolUseId, t);
    };

    const handle = async (toolUseId: string, artifactId: string): Promise<void> => {
      try {
        await retryWithBackoff(
          () => postCustomToolResult(sessionId, toolUseId, { ok: true, artifactId }),
          { maxAttempts: MAX_POST_ATTEMPTS, signal: controller.signal },
        );
      } catch (err) {
        if (controller.signal.aborted) return; // unmount: 何もしない
        giveUp(toolUseId, `POST failed after ${MAX_POST_ATTEMPTS} attempts: ${String(err)}`);
        return;
      }
      if (controller.signal.aborted) return;
      // POST 成功 → echo back (useEventPoller が観測して remove) を待つ
      startEchoTimeout(toolUseId);
    };

    const process = (): void => {
      const pending = useChatStore.getState().pendingCustomToolUseIds;
      // 新規 pending を 1 回だけ handle
      for (const [toolUseId, artifactId] of pending) {
        if (handled.has(toolUseId)) continue;
        handled.add(toolUseId);
        void handle(toolUseId, artifactId);
      }
      // echo back 等で pending から消えた entry の echo timer を掃除
      for (const toolUseId of [...echoTimers.keys()]) {
        if (!pending.has(toolUseId)) clearEchoTimer(toolUseId);
      }
    };

    process(); // 初回
    const unsubscribe = useChatStore.subscribe((state, prev) => {
      if (state.pendingCustomToolUseIds !== prev.pendingCustomToolUseIds) process();
    });

    return () => {
      controller.abort();
      for (const t of echoTimers.values()) clearTimeout(t);
      echoTimers.clear();
      unsubscribe();
    };
  }, [enabled, sessionId]);
}
