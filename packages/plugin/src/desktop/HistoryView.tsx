// Cowork Agent for kintone — 履歴一覧 (HistoryView)
//
// パネル内 "history" ビュー。listUserSessions で当該ユーザーの過去 Session を取得して表示。
// エントリクリックで onSelect(sessionId) を呼ぶ。

import { useCallback, useEffect, useState } from 'react';

import { listUserSessions } from '../core/bootstrap/resolveSession';
import { formatRelative } from '../core/format';
import { getCurrentSessionContext } from '../core/kintone/user';

import type { Session } from '../core/managed-agents/types';

export interface HistoryViewProps {
  /** Agent ID。useSession で解決済みの id を渡す */
  agentId: string;
  onSelect: (sessionId: string) => void;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; sessions: Session[] }
  | { status: 'error'; message: string };

export function HistoryView({ agentId, onSelect }: HistoryViewProps): JSX.Element {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const kctx = getCurrentSessionContext();
        const sessions = await listUserSessions({
          agentId,
          kintoneDomain: kctx.kintoneDomain,
          kintoneUserCode: kctx.kintoneUserCode,
        });
        if (cancelled) return;
        setState({ status: 'ready', sessions });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-bg">
      <h2 className="border-b border-border px-[16px] py-[12px] text-[13px] font-semibold text-text">
        過去の会話
      </h2>
      <div className="flex-1 px-[8px] py-[8px]">
        {state.status === 'loading' && (
          <div className="px-[8px] py-[16px] text-[12px] text-muted">読み込み中...</div>
        )}
        {state.status === 'error' && (
          <div className="px-[8px] py-[16px] text-[12px] text-warn">
            <p>履歴の取得に失敗しました ({state.message})</p>
            <button
              type="button"
              onClick={retry}
              className="mt-[6px] rounded-[6px] border border-border px-[8px] py-[4px] text-[12px] text-text hover:bg-accent-soft"
            >
              再試行
            </button>
          </div>
        )}
        {state.status === 'ready' && state.sessions.length === 0 && (
          <div className="px-[8px] py-[16px] text-[12px] text-muted">まだ会話がありません</div>
        )}
        {state.status === 'ready' && state.sessions.length > 0 && (
          <ul className="flex flex-col gap-[2px]">
            {state.sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  data-testid="history-entry"
                  data-session-id={s.id}
                  onClick={() => onSelect(s.id)}
                  className="flex w-full flex-col items-start gap-[2px] rounded-[8px] px-[10px] py-[8px] text-left hover:bg-accent-soft"
                >
                  <span className="text-[13px] text-text">{labelOf(s)}</span>
                  <span className="text-[11px] text-muted">{formatRelative(s.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function labelOf(s: Session): string {
  return s.title && s.title.length > 0 ? s.title : '(無題)';
}
