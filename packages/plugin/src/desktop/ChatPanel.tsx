// Cowork Agent for kintone — チャットパネル全体
//
// Header + (MessageList + Composer + ConnectKintoneButton) | HistoryView を view に応じて切替。
// 未バインディング状態 (kintone OAuth 未連携) では Composer の代わりに ConnectKintoneButton を表示。
// connect() 完了後に保留テキストを送信する。

import { useCallback, useState } from 'react';

import { postToolConfirmation, postUserInterrupt, postUserMessage } from '../core/managed-agents/events';
import { useChatStore } from '../store/chatStore';

import { Banner } from './components/Banner';
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
  const isAgentRunning = useChatStore((s) => s.isAgentRunning);
  const setAgentRunning = useChatStore((s) => s.setAgentRunning);
  const sessionTerminated = useChatStore((s) => s.sessionTerminated);
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
      updateTool(toolUseId, { status: 'rejected', errorText: undefined });
      try {
        await postToolConfirmation(
          sid,
          toolUseId,
          'deny',
          'ユーザがこのツール呼び出しを却下しました。再試行はせず、次の指示を待ってください。',
        );
      } catch {
        updateTool(toolUseId, { status: 'pending-confirmation', errorText: undefined });
      }
    },
    [sessionId, updateTool],
  );

  const handleRetryTool = useCallback(
    async (_toolUseId: string) => {
      const sid = sessionId;
      if (!sid) return;
      // 楽観的に「Agent ターン進行中」へ — UI は thinking + ボタン消滅 で即フィードバック
      addMessage({ id: `pending-thinking-${Date.now()}`, kind: 'thinking' });
      setAgentRunning(true);
      try {
        await postUserMessage(sid, '前回失敗したツール呼び出しをもう一度試してください。');
      } catch {
        // 失敗時はフラグを下げる (本物の status_running が来ないため自動復帰しない)
        setAgentRunning(false);
      }
    },
    [sessionId, addMessage, setAgentRunning],
  );

  const handleCancel = useCallback(async () => {
    const sid = sessionId;
    if (!sid) return;
    // 楽観的に running フラグを下げる (続いて来る session.status_idle で確定する)
    setAgentRunning(false);
    try {
      await postUserInterrupt(sid);
    } catch {
      // 失敗しても fall through。実際に止まらなかった場合 status_running が再来して true に戻る
    }
  }, [sessionId, setAgentRunning]);

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

  /**
   * 初期未バインド時は ConnectKintoneButton で大きく誘導する。
   * 一度でも会話を始めたあとに失効した場合は、Composer は維持して上部に
   * 軽い再連携バナーを出す (= 履歴を保ったまま復帰できる UX)。
   */
  const isMidSession = sessionId !== null || messages.length > 0;
  const showConnectButton =
    status === 'ready' &&
    !isMidSession &&
    (bindingStatus === 'unbound' || bindingStatus === 'binding' || bindingStatus === 'error');

  return (
    <div className="cowork-agent-root flex h-full flex-col bg-bg">
      <Header
        agentName="Cowork Agent for kintone"
        status={statusLine}
        onHistoryClick={handleHistoryClick}
        onNewConversationClick={handleNewConversationClick}
        onSettingsClick={handleSettingsClick}
        {...(onClose ? { onClose } : {})}
      />

      {status === 'error' && error && (
        <Banner
          tone="warn"
          {...(looksLikeAuthError(error) && onSettingsClick
            ? { actionLabel: 'プラグイン設定を開く', onAction: handleSettingsClick }
            : {})}
        >
          ⚠ {error}
        </Banner>
      )}

      {sessionTerminated && (
        <Banner
          testId="session-terminated"
          actionLabel="新しいセッションを開始"
          onAction={handleNewConversationClick}
        >
          このセッションは終了しています。
        </Banner>
      )}

      {/*
        OAuth 失効バナー: 初期未バインドは ConnectKintoneButton 側で表示されるので、
        会話途中で失効した場合 (mid-session) のみ出す。
      */}
      {status === 'ready' && bindingStatus === 'error' && isMidSession && (
        <Banner testId="oauth-rebind" actionLabel="再連携" onAction={handleConnect}>
          kintone の連携が切れています。{bindingError ? `(${bindingError})` : ''}
        </Banner>
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
              onRetryTool={handleRetryTool}
              agentRunning={isAgentRunning}
            />
          )}
          {showConnectButton ? (
            <ConnectKintoneButton
              status={bindingStatus}
              error={bindingError}
              onConnect={handleConnect}
            />
          ) : (
            <Composer
              onSubmit={handleSubmit}
              disabled={status !== 'ready' || sessionTerminated}
              running={isAgentRunning}
              onCancel={handleCancel}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * bootstrap エラー文言から「Anthropic API Key の問題」と推定できるか判定する。
 * `401` / `403` は他の文脈の数字と衝突しないよう **HTTP \[401] のように接頭がある形** で照合。
 */
function looksLikeAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('authentication') ||
    lower.includes('api key') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid_api_key') ||
    /\bhttp[\s\[]+40[13]\b/.test(lower)
  );
}
