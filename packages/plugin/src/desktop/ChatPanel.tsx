// Cowork Agent for kintone — チャットパネル全体
//
// Header + (MessageList + Composer) | HistoryView を view に応じて切替。
// 未バインディング状態 (Vault/Environment 未作成) で送信されたら CredentialDialog を出し、
// bind 完了後に保留テキストを送信する。

import { useCallback, useState } from 'react';

import { postUserMessage } from '../core/managed-agents/events';
import { getCurrentSessionContext } from '../core/kintone/user';
import { useChatStore } from '../store/chatStore';

import { Composer } from './components/Composer';
import { CredentialDialog } from './components/CredentialDialog';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { WelcomeMessage } from './components/WelcomeMessage';
import { HistoryView } from './HistoryView';
import { useEventPoller } from './hooks/useEventPoller';
import { useSession } from './hooks/useSession';
import { useUserBinding } from './hooks/useUserBinding';

export interface ChatPanelProps {
  /** 設定画面を開くハンドラ (任意)。指定すると Header の歯車から CredentialDialog を再表示する */
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
  const removeMessage = useChatStore((s) => s.removeMessage);

  const { ensureSession, selectSession, startNewConversation } = useSession();
  const { status: bindingStatus, bind } = useUserBinding();

  // 未バインドで送信した場合の保留テキストとオプティミスティック ID
  // (Dialog cancel 時に楽観追加分を巻き戻すために id も覚えておく)
  const [pending, setPending] = useState<{
    text: string;
    userId: string;
    pendingThinkingId: string;
  } | null>(null);
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);

  useEventPoller({ sessionId, enabled: status === 'ready' && sessionId !== null });

  const handleSubmit = useCallback(
    async (text: string) => {
      const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      addMessage({ id: userId, kind: 'user', text });
      const pendingThinkingId = `pending-thinking-${Date.now()}`;
      addMessage({ id: pendingThinkingId, kind: 'thinking' });

      // 未バインドなら CredentialDialog を出して保留
      if (bindingStatus === 'unbound' || bindingStatus === 'error') {
        setPending({ text, userId, pendingThinkingId });
        setCredentialDialogOpen(true);
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

  const handleBindSubmit = useCallback(
    async (values: { domain: string; login: string; password: string }) => {
      await bind(values);
      // bind 成功 → ダイアログ閉じる + 保留テキストを送信
      setCredentialDialogOpen(false);
      const p = pending;
      setPending(null);
      if (p) {
        try {
          const sid = await ensureSession();
          await postUserMessage(sid, p.text);
        } catch {
          // 握りつぶし
        }
      }
    },
    [bind, ensureSession, pending],
  );

  const handleBindCancel = useCallback(() => {
    setCredentialDialogOpen(false);
    // オプティミスティック追加した user message と thinking を巻き戻す
    if (pending) {
      removeMessage(pending.userId);
      removeMessage(pending.pendingThinkingId);
      setPending(null);
    }
  }, [pending, removeMessage]);

  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) onSettingsClick();
    // 設定アイコンから明示的に CredentialDialog を再表示する
    setCredentialDialogOpen(true);
  }, [onSettingsClick]);

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

  // CredentialDialog の domain 既定値は kintone セッションコンテキストから
  const initialDomain = (() => {
    try {
      return getCurrentSessionContext().kintoneDomain;
    } catch {
      return '';
    }
  })();

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
            <MessageList messages={messages} />
          )}
          <Composer onSubmit={handleSubmit} disabled={status !== 'ready'} />
        </>
      )}

      <CredentialDialog
        open={credentialDialogOpen}
        initialDomain={initialDomain}
        onSubmit={handleBindSubmit}
        onClose={handleBindCancel}
      />
    </div>
  );
}
