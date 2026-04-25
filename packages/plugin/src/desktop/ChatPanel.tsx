// Cowork Agent for kintone — チャットパネル全体
//
// Header + (MessageList + Composer) | HistoryView を view に応じて切替。
// 初送信時に ensureSession で Session を新規作成し、履歴復元では selectSession で切替える。

import { useCallback } from 'react';

import { postUserMessage } from '../core/managed-agents/events';
import { useChatStore } from '../store/chatStore';

import { Composer } from './components/Composer';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { WelcomeMessage } from './components/WelcomeMessage';
import { HistoryView } from './HistoryView';
import { useEventPoller } from './hooks/useEventPoller';
import { useSession } from './hooks/useSession';

export interface ChatPanelProps {
  /** 設定画面を開くハンドラ (任意) */
  onSettingsClick?: () => void;
  /** パネルを閉じるハンドラ (任意) */
  onClose?: () => void;
}

export function ChatPanel({ onSettingsClick, onClose }: ChatPanelProps): JSX.Element {
  const messages = useChatStore((s) => s.messages);
  const sessionId = useChatStore((s) => s.sessionId);
  const agentId = useChatStore((s) => s.agentId);
  const status = useChatStore((s) => s.status);
  const error = useChatStore((s) => s.error);
  const view = useChatStore((s) => s.view);
  const setView = useChatStore((s) => s.setView);
  const addMessage = useChatStore((s) => s.addMessage);

  const { ensureSession, selectSession, startNewConversation } = useSession();

  useEventPoller({ sessionId, enabled: status === 'ready' && sessionId !== null });

  const handleSubmit = useCallback(
    async (text: string) => {
      const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      addMessage({ id: userId, kind: 'user', text });
      // オプティミスティック thinking — ポーラーが初回イベントを取り込むまでの間 (最大 2s)
      // 入力が "agent に届いた" ことを視覚的にフィードバックする。
      // useEventPoller が events を受け取ると pending- プレフィックスを除去して上書きする。
      const pendingId = `pending-thinking-${Date.now()}`;
      addMessage({ id: pendingId, kind: 'thinking' });
      try {
        const sid = await ensureSession();
        await postUserMessage(sid, text);
      } catch {
        // MVP: 失敗しても UI では握りつぶす (後続 Phase でエラー表示を追加予定)
      }
    },
    [addMessage, ensureSession],
  );

  const handleHistoryClick = useCallback(() => {
    setView(view === 'history' ? 'chat' : 'history');
  }, [view, setView]);

  const handleNewConversationClick = useCallback(() => {
    startNewConversation();
    setView('chat');
  }, [startNewConversation, setView]);

  const handleHistorySelect = useCallback(
    (id: string) => {
      selectSession(id);
      setView('chat');
    },
    [selectSession, setView],
  );

  const statusLine =
    status === 'ready'
      ? '接続中'
      : status === 'bootstrapping'
        ? '起動中...'
        : status === 'error'
          ? 'エラー'
          : '待機';

  return (
    <div className="cowork-agent-root flex h-full flex-col bg-bg">
      <Header
        agentName="Aoi"
        status={statusLine}
        onHistoryClick={handleHistoryClick}
        onNewConversationClick={handleNewConversationClick}
        {...(onSettingsClick ? { onSettingsClick } : {})}
        {...(onClose ? { onClose } : {})}
      />

      {status === 'error' && error && (
        <div className="border-b border-border bg-warn-soft px-[14px] py-[10px] text-[12px] text-warn">
          ⚠ {error}
        </div>
      )}

      {view === 'history' && agentId ? (
        <HistoryView agentId={agentId} onSelect={handleHistorySelect} />
      ) : (
        <>
          {messages.length === 0 && sessionId === null ? (
            <WelcomeMessage />
          ) : (
            <MessageList messages={messages} />
          )}
          <Composer onSubmit={handleSubmit} disabled={status !== 'ready'} />
        </>
      )}
    </div>
  );
}
