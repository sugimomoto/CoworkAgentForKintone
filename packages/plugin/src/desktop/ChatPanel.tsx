// Cowork Agent for kintone — チャットパネル全体
//
// Header + (MessageList + Composer + ConnectKintoneButton) | HistoryView を view に応じて切替。
// 未バインディング状態 (kintone OAuth 未連携) では Composer の代わりに ConnectKintoneButton を表示。
// connect() 完了後に保留テキストを送信する。

import { useCallback, useState } from 'react';

import { postToolConfirmation, postUserMessage } from '../core/managed-agents/events';
import { useChatStore } from '../store/chatStore';

import { Composer } from './components/Composer';
import { ConnectKintoneButton } from './components/ConnectKintoneButton';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { WelcomeMessage } from './components/WelcomeMessage';
import { HistoryView } from './HistoryView';
import { useEventPoller } from './hooks/useEventPoller';
import { useSession } from './hooks/useSession';
import { useUserBinding } from './hooks/useUserBinding';

export interface ChatPanelProps {
  /** 設定画面を開くハンドラ (任意)。Header の歯車から呼ばれる */
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
  const updateTool = useChatStore((s) => s.updateTool);
  const { ensureSession, selectSession, startNewConversation } = useSession();
  const { status: bindingStatus, error: bindingError, connect } = useUserBinding();

  // 未バインドで送信したテキストの保留先 (連携完了後に再送信する)
  const [pendingText, setPendingText] = useState<string | null>(null);

  useEventPoller({ sessionId, enabled: status === 'ready' && sessionId !== null });

  const handleSubmit = useCallback(
    async (text: string) => {
      const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      addMessage({ id: userId, kind: 'user', text });
      addMessage({ id: `pending-thinking-${Date.now()}`, kind: 'thinking' });

      // 未バインドなら一旦保留して連携ボタンへ誘導
      if (bindingStatus === 'unbound' || bindingStatus === 'error') {
        setPendingText(text);
        return;
      }

      try {
        const sid = await ensureSession();
        await postUserMessage(sid, text);
      } catch {
        // MVP: 失敗しても UI では握りつぶす
      }
    },
    [addMessage, bindingStatus, ensureSession],
  );

  const handleConnect = useCallback(async () => {
    try {
      await connect();
      // connect 成功後、保留テキストを送信
      const text = pendingText;
      setPendingText(null);
      if (text) {
        const sid = await ensureSession();
        await postUserMessage(sid, text);
      }
    } catch {
      // useUserBinding が status='error' に設定するので UI は反映される。
      // 保留テキストは残しておき、再試行時に送信する。
    }
  }, [connect, ensureSession, pendingText]);

  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) onSettingsClick();
  }, [onSettingsClick]);

  const handleHistoryClick = useCallback(() => {
    setView(view === 'history' ? 'chat' : 'history');
  }, [view, setView]);

  const handleNewConversationClick = useCallback(() => {
    startNewConversation();
    setView('chat');
  }, [startNewConversation, setView]);

  const handleApproveTool = useCallback(
    async (toolUseId: string) => {
      const sid = sessionId;
      if (!sid) return;
      updateTool(toolUseId, { status: 'running' });
      try {
        await postToolConfirmation(sid, toolUseId, 'allow');
      } catch {
        updateTool(toolUseId, { status: 'pending-confirmation' });
      }
    },
    [sessionId, updateTool],
  );

  const handleRejectTool = useCallback(
    async (toolUseId: string) => {
      const sid = sessionId;
      if (!sid) return;
      updateTool(toolUseId, { status: 'error', errorText: '却下しました' });
      try {
        await postToolConfirmation(sid, toolUseId, 'deny', 'ユーザが却下しました');
      } catch {
        // 失敗時は pending-confirmation に戻すが、先に書いた errorText もクリアする
        updateTool(toolUseId, { status: 'pending-confirmation', errorText: undefined });
      }
    },
    [sessionId, updateTool],
  );

  const handleHistorySelect = useCallback(
    (id: string) => {
      selectSession(id);
      setView('chat');
    },
    [selectSession, setView],
  );

  const statusLine = ((): string => {
    if (status === 'bootstrapping') return '起動中...';
    if (status === 'error') return 'エラー';
    if (status !== 'ready') return '待機';
    return bindingStatus === 'bound' ? '接続中' : '連携待ち';
  })();

  const showConnectButton =
    status === 'ready' &&
    (bindingStatus === 'unbound' || bindingStatus === 'binding' || bindingStatus === 'error');

  return (
    <div className="cowork-agent-root flex h-full flex-col bg-bg">
      <Header
        agentName="Aoi"
        status={statusLine}
        onHistoryClick={handleHistoryClick}
        onNewConversationClick={handleNewConversationClick}
        onSettingsClick={handleSettingsClick}
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
            <MessageList
              messages={messages}
              onApproveTool={handleApproveTool}
              onRejectTool={handleRejectTool}
            />
          )}
          {showConnectButton ? (
            <ConnectKintoneButton
              status={bindingStatus}
              error={bindingError}
              onConnect={handleConnect}
            />
          ) : (
            <Composer onSubmit={handleSubmit} disabled={status !== 'ready'} />
          )}
        </>
      )}
    </div>
  );
}
