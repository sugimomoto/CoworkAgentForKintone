// Custom Tool 応答ハンドラ
//
// useEventPoller が `agent.custom_tool_use` を観測すると chatStore の
// pendingCustomToolUseIds に (toolUseId → artifactId) を追加する。
// 本フックはその Map を購読し、未送信のエントリを `user.custom_tool_result` として
// Anthropic に POST する (失敗時は次の tick で再試行)。
// Anthropic が events stream に `user.custom_tool_result` を echo back すると、
// useEventPoller 側でそれを観測して remove する → ここで送り直されることもなくなる。

import { useEffect, useRef } from 'react';

import { debug, warn } from '../../core/debug';
import { postCustomToolResult } from '../../core/managed-agents/events';
import { useChatStore } from '../../store/chatStore';

export interface UseCustomToolResponderProps {
  sessionId: string | null;
  enabled: boolean;
}

const RETRY_INTERVAL_MS = 3000;

export function useCustomToolResponder({ sessionId, enabled }: UseCustomToolResponderProps): void {
  const pendingMap = useChatStore((s) => s.pendingCustomToolUseIds);

  // 「直近 POST 中」の id を記録して同じ id を二重に投げないようにする (失敗→retry の整合)
  const inflightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !sessionId) return;
    if (pendingMap.size === 0) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const sendAll = async (): Promise<void> => {
      // pendingMap は読み取りスナップショット。送信中に追加されたものは次の effect 起動で拾う。
      const entries = Array.from(pendingMap.entries());
      const targets = entries.filter(([toolUseId]) => !inflightRef.current.has(toolUseId));
      if (targets.length === 0) return;

      debug('CustomTool', `responder: posting ${targets.length} pending`, targets);
      for (const [toolUseId, artifactId] of targets) {
        if (cancelled) return;
        inflightRef.current.add(toolUseId);
        try {
          await postCustomToolResult(sessionId, toolUseId, { ok: true, artifactId });
          debug('CustomTool', 'responder: POST OK', { toolUseId, artifactId });
          // 成功しても remove はしない: Anthropic が events に echo back したのを
          // useEventPoller 側で観測して chatStore.removePendingCustomToolUse する。
          // 二重に投げる事故を inflightRef だけで防ぐ。
        } catch (err) {
          warn('CustomTool', 'responder: POST failed, will retry', { toolUseId, err });
          // 失敗したら次の retry 機会で再投。inflight も解放しておく。
        } finally {
          inflightRef.current.delete(toolUseId);
        }
      }

      if (cancelled) return;
      // 失敗が残っている、または echo back を待っているなら再走する。
      // chatStore 側で remove されれば pendingMap.size が変わり effect が再評価される。
      if (useChatStore.getState().pendingCustomToolUseIds.size > 0) {
        retryTimer = setTimeout(() => {
          if (!cancelled) void sendAll();
        }, RETRY_INTERVAL_MS);
      }
    };

    void sendAll();

    return () => {
      cancelled = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
    };
  }, [enabled, sessionId, pendingMap]);
}
