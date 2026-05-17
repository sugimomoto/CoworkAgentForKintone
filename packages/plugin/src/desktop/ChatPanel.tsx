// Cowork Agent for kintone — チャットパネル全体
//
// Header + (MessageList + Composer + ConnectKintoneButton) | HistoryView を view に応じて切替。
// 未バインディング状態 (kintone OAuth 未連携) では Composer の代わりに ConnectKintoneButton を表示。
// connect() 完了後に保留テキストを送信する。

import { useCallback, useEffect, useState } from 'react';

import { postToolConfirmation, postUserInterrupt, postUserMessage } from '../core/managed-agents/events';
import { useChatStore } from '../store/chatStore';

import { ArtifactPane } from './components/ArtifactPane';
import { Banner } from './components/Banner';
import { Composer } from './components/Composer';
import { ConnectKintoneButton } from './components/ConnectKintoneButton';
import { ConversationUtilityBar } from './components/ConversationUtilityBar';
import { Header } from './Header';
import { MessageList } from './components/MessageList';
import { WelcomeMessage } from './components/WelcomeMessage';
import { HistoryView } from './HistoryView';
import { SettingsViewBound } from './settings/SettingsViewBound';
import { useIsAdmin } from '../core/admin/useIsAdmin';
import { selectAgent } from './hooks/useSession';
import { getCurrentSessionContext } from '../core/kintone/user';
import { buildUserMessageContent } from '../core/files/messageContent';

import { useAgentPhase } from './hooks/useAgentPhase';
import { useCustomToolResponder } from './hooks/useCustomToolResponder';
import { useElapsedSeconds } from './hooks/useElapsedSeconds';
import { useEventPoller } from './hooks/useEventPoller';
import { useFileAttacher } from './hooks/useFileAttacher';
import { useSession } from './hooks/useSession';
import { useSessionFiles } from './hooks/useSessionFiles';
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
  const builtInAgents = useChatStore((s) => s.builtInAgents);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const memoryEnabled = useChatStore((s) => s.memoryEnabled);
  const isAdmin = useIsAdmin();
  const activeArtifactId = useChatStore((s) => s.activeArtifactId);
  const setActiveArtifact = useChatStore((s) => s.setActiveArtifact);
  const attachedFiles = useChatStore((s) => s.attachedFiles);
  const removeAttachedFile = useChatStore((s) => s.removeAttachedFile);
  const clearAttachedFiles = useChatStore((s) => s.clearAttachedFiles);
  const { attach } = useFileAttacher();
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
  useCustomToolResponder({ sessionId, enabled: status === 'ready' && sessionId !== null });
  useSessionFiles({ sessionId, enabled: status === 'ready' && sessionId !== null });
  const agentPhase = useAgentPhase();

  // Agent ターン進行中の経過秒数。30 秒以上で「応答が遅い」バナーを出す目印。
  const elapsedSeconds = useElapsedSeconds(isAgentRunning);
  const SLOW_THRESHOLD_S = 30;
  const isSlow = isAgentRunning && elapsedSeconds >= SLOW_THRESHOLD_S;

  const handleSubmit = useCallback(
    async (text: string) => {
      const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // 添付スナップショット (ready のみ送信に乗せる)
      const filesSnapshot = useChatStore
        .getState()
        .attachedFiles.filter((f) => f.status === 'ready');

      // UI 用に user メッセージへ添付ラベル情報を残す
      addMessage({
        id: userId,
        kind: 'user',
        text,
        ...(filesSnapshot.length > 0
          ? {
              attachments: filesSnapshot.map((f) => ({
                filename: f.filename,
                kind: f.kind,
              })),
            }
          : {}),
      });
      addMessage({ id: `pending-thinking-${Date.now()}`, kind: 'thinking' });
      setAgentRunning(true);

      // 送信完了前に attachedFiles をクリア (再送信防止)
      clearAttachedFiles();

      if (bindingStatus === 'unbound' || bindingStatus === 'error') {
        setPendingText(text);
        return;
      }

      try {
        const sid = await ensureSession();
        // 添付があれば content block 配列、なければ string を送信
        if (filesSnapshot.length > 0) {
          const content = buildUserMessageContent(text, filesSnapshot);
          await postUserMessage(sid, content);
        } else {
          await postUserMessage(sid, text);
        }
      } catch {
        // MVP: 失敗しても UI では握りつぶす
      }
    },
    [addMessage, bindingStatus, ensureSession, setAgentRunning, clearAttachedFiles],
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

  /**
   * 旧 Plugin Config (kintone admin) を開くハンドラ。SettingsView nav 下部の
   * 「Plugin Config →」リンクから呼ばれる。
   */
  const handlePluginConfigClick = useCallback(() => {
    if (onSettingsClick) onSettingsClick();
  }, [onSettingsClick]);

  /**
   * Header ⚙ ボタンから Chat Panel 内の Settings View を開く (admin のみ表示)。
   */
  const handleSettingsClick = useCallback(() => {
    if (isAdmin) setView('settings');
  }, [isAdmin, setView]);

  const handleSettingsClose = useCallback(() => {
    setView('chat');
  }, [setView]);

  /**
   * Header の Agent プルダウン選択で呼ばれる。
   * localStorage 保存 + chatStore 更新 + 新規会話開始 を selectAgent ヘルパーで実行。
   */
  const handleSelectAgent = useCallback(
    (id: string) => {
      const ctx = getCurrentSessionContext();
      selectAgent(id, ctx);
      setView('chat'); // settings / history から chat に戻す
    },
    [setView],
  );

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

  const agentState = ((): 'idle' | 'thinking' | 'working' | 'waiting' => {
    const hasPendingTool = messages.some(
      (m) => m.kind === 'tool' && m.status === 'pending-confirmation',
    );
    if (hasPendingTool) return 'waiting';
    const hasRunningTool = messages.some((m) => m.kind === 'tool' && m.status === 'running');
    if (hasRunningTool) return 'working';
    if (isAgentRunning) {
      const hasThinking = messages.some((m) => m.kind === 'thinking');
      return hasThinking ? 'thinking' : 'working';
    }
    return 'idle';
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
        agents={builtInAgents}
        currentAgentId={currentAgentId}
        onSelectAgent={handleSelectAgent}
        isAdmin={isAdmin}
        memoryEnabled={false}
        memoryOn={memoryEnabled}
        {...(isAdmin ? { onSettingsClick: handleSettingsClick } : {})}
        {...(onClose ? { onClose } : {})}
      />
      {/*
        旧 Header の handleHistoryClick / handleNewConversationClick / handleConnect /
        agentState / statusLine は 2 段構成 Header (案 C) には統合しなかった。
        - 履歴 / 新規会話 / 再連携は将来 Conversation View 内のヘッダー二次行や
          メッセージ間のアフォーダンスで提供する想定 (V2)。
        - 暫定: status 系イベントは下の Banner 群でカバー (error / sessionTerminated /
          oauth-rebind / slow-response)。
      */}

      {status === 'error' && error && (
        <Banner
          tone="warn"
          {...(looksLikeAuthError(error) && onSettingsClick
            ? { actionLabel: 'プラグイン設定を開く', onAction: handlePluginConfigClick }
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

      {/*
        応答遅延バナー: Agent ターンが 30 秒以上続いているときに表示。
        Anthropic 側の処理が長い (e.g. 大きな SVG 生成) ことがあるので、
        ユーザーが「フリーズしたのか待つべきか」を判断できるようにする。
      */}
      {isSlow && (
        <Banner
          testId="slow-response"
          actionLabel="中断"
          onAction={handleCancel}
        >
          応答に時間がかかっています ({elapsedSeconds}秒経過)。
          そのまま待つか、中断して新しいセッションで試してください。
        </Banner>
      )}

      {view === 'settings' && isAdmin ? (
        <SettingsViewBound
          onClose={handleSettingsClose}
          {...(onSettingsClick ? { onPluginConfigClick: handlePluginConfigClick } : {})}
        />
      ) : view === 'settings' && !isAdmin ? (
        // 安全策: 非 admin が誤って settings に到達したら chat に戻す
        <ChatViewRedirect onRedirect={() => setView('chat')} />
      ) : view === 'history' && agentId ? (
        <HistoryView agentId={agentId} onSelect={handleHistorySelect} />
      ) : (
        <div className="relative flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-hidden lg:min-w-[360px]">
            {messages.length === 0 && sessionId === null ? (
              <WelcomeMessage />
            ) : (
              <MessageList
                messages={messages}
                onApproveTool={handleApproveTool}
                onRejectTool={handleRejectTool}
                onRetryTool={handleRetryTool}
                onOpenArtifact={setActiveArtifact}
                agentPhase={agentPhase}
              />
            )}
            {showConnectButton ? (
              <ConnectKintoneButton
                status={bindingStatus}
                error={bindingError}
                onConnect={handleConnect}
              />
            ) : (
              <>
                <ConversationUtilityBar
                  onHistoryClick={handleHistoryClick}
                  onNewConversationClick={handleNewConversationClick}
                  onReconnectKintone={handleConnect}
                  bindingStatus={bindingStatus}
                />
                <Composer
                  onSubmit={handleSubmit}
                  disabled={status !== 'ready' || sessionTerminated}
                  running={isAgentRunning}
                  onCancel={handleCancel}
                  attachedFiles={attachedFiles}
                  onAttach={attach}
                  onRemoveAttachment={removeAttachedFile}
                />
              </>
            )}
          </div>
          {activeArtifactId && (
            // 広い時 (≥1024px): 横並び (チャットと artifact が flex-1 で 50/50 + min 幅保証)
            // 狭い時: オーバーレイ表示
            <div
              data-artifact-pane-wrap
              className="absolute inset-0 z-10 bg-white lg:static lg:z-auto lg:flex-1 lg:basis-[480px] lg:min-w-[480px]"
            >
              <ArtifactPane />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 非 admin が誤って view='settings' に到達した時の安全策。
 * mount 時に onRedirect で 'chat' に戻す。
 */
function ChatViewRedirect({ onRedirect }: { onRedirect: () => void }): JSX.Element {
  // mount 直後に redirect (useEffect で副作用化)
  // setState を render 中に呼ばないようにする
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    onRedirect();
  }, [onRedirect]);
  return <></>;
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
