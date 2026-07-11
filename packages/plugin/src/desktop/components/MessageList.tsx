// Cowork Agent for kintone — メッセージ一覧
//
// kind 別に対応するコンポーネントへ振り分ける。
// stick-to-bottom (#133): 最下部にいる限りエージェント応答/ストリーミングに追従し、
// ユーザーが上にスクロールしたら追従を解除、「最新へ」ボタンで復帰する。

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { AgentMessage } from './MessageItem/AgentMessage';
import { ArtifactRefMessage } from './MessageItem/ArtifactRefMessage';
import { ThinkingStatic } from './MessageItem/ThinkingStatic';
import { ToolCardMessage } from './MessageItem/ToolCardMessage';
import { UserMessage } from './MessageItem/UserMessage';
import { ProgressIndicator } from './ProgressIndicator';

import type { ChatMessage } from '../../core/chat/types';
import type { AgentPhase } from '../hooks/useAgentPhase';

// チャットメッセージのデータ型は core/chat/types.ts に移管した (Phase 2: レイヤー是正)。
// 既存の import を壊さないため再エクスポートを残す。
export type {
  ToolStatus,
  ToolMessage,
  ArtifactRefChatMessage,
  ChatMessage,
} from '../../core/chat/types';

export interface MessageListProps {
  messages: ChatMessage[];
  /** 承認ボタン押下 (tool kind, pending-confirmation のみ) */
  onApproveTool?: (toolUseId: string) => void;
  /** 却下ボタン押下 (tool kind, pending-confirmation のみ) */
  onRejectTool?: (toolUseId: string) => void;
  /** 失敗ツールの再試行依頼 (tool kind, error のみ) */
  onRetryTool?: (toolUseId: string) => void;
  /** Artifact 参照タイルのクリック (artifact-ref kind のみ) */
  onOpenArtifact?: (artifactId: string) => void;
  /**
   * 現在のターン局面。`idle` のとき完了 divider を出す / retry ボタンを出す等で参照する。
   * 既存テストとの互換のため省略時は idle 扱い (= retry 可、divider 出る)。
   */
  agentPhase?: AgentPhase;
}

export function MessageList({
  messages,
  onApproveTool,
  onRejectTool,
  onRetryTool,
  onOpenArtifact,
  agentPhase = 'idle',
}: MessageListProps): JSX.Element {
  const isIdle = agentPhase === 'idle';

  // 「もう一度試す」ボタンは履歴の中で **最後の error tool カード** にだけ出す。
  // (複数 error が積み上がってもボタンは 1 つだけ → 連打 / 混乱を防ぐ)
  // ターン進行中は出さない (retry クリック後に Agent が処理している間は連打不可)
  let lastErrorToolId: string | null = null;
  if (isIdle) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && m.kind === 'tool' && m.status === 'error') {
        lastErrorToolId = m.id;
        break;
      }
    }
  }

  // ターン完了 divider: phase===idle かつ Agent が一度でも返答 (agent/tool/artifact-ref) を
  // 返したことがあるときに、メッセージ末尾に「✓ 応答完了」divider を表示。
  // useAgentPhase 側で pending-thinking / pending custom_tool / awaiting-confirm を
  // 既に running / awaiting-confirm 扱いにしているので、ここでは追加チェック不要。
  const showCompletedDivider =
    isIdle &&
    messages.some((m) => m.kind === 'agent' || m.kind === 'tool' || m.kind === 'artifact-ref');

  // ── stick-to-bottom (#133) ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true); // 追従中か（最下部付近にいるか）
  const [showJump, setShowJump] = useState(false);
  const NEAR_BOTTOM_PX = 60; // この距離以内なら「最下部にいる」とみなす

  const scrollToBottom = useCallback((smooth = false): void => {
    const el = scrollRef.current;
    if (!el) return;
    // scrollTo は一部環境(jsdom 等)で未実装のため scrollTop へフォールバック。
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, ...(smooth ? { behavior: 'smooth' } : {}) });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback((): void => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = dist <= NEAR_BOTTOM_PX;
    stickRef.current = atBottom;
    setShowJump(!atBottom);
  }, []);

  // 初回表示は最下部から（履歴復元時も最新が見える）
  useLayoutEffect(() => {
    scrollToBottom();
    // 初回のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 新規メッセージ（配列参照変化）で追従
  useEffect(() => {
    if (stickRef.current) scrollToBottom();
  }, [messages, scrollToBottom]);

  // ストリーミング等で単一メッセージの本文が伸びる（配列参照が変わらない）ケースにも追従。
  // 内容ラッパの高さ変化を ResizeObserver で拾う。
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (stickRef.current) scrollToBottom();
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [scrollToBottom]);

  const jumpToBottom = useCallback((): void => {
    stickRef.current = true;
    setShowJump(false);
    scrollToBottom(true);
  }, [scrollToBottom]);

  return (
    // min-h-0: 親 (ChatPanel) の flex 列内で本要素が flex-1 だけだとコンテンツの自然高さに
    // 押し負けて Composer を画面外へ追いやってしまう。min-h-0 で「親より小さくなれる」状態に
    // して、内側の overflow-y-auto を効かせる (flex+overflow ネストの定石)。
    <div className="relative flex flex-1 flex-col min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-[16px] py-[18px]"
      >
      <div ref={contentRef} className="flex flex-col gap-[14px]">
      {messages.map((m) => {
        const showRetry = m.kind === 'tool' && m.id === lastErrorToolId;
        const rendered = renderMessage(
          m,
          onApproveTool,
          onRejectTool,
          showRetry ? onRetryTool : undefined,
          onOpenArtifact,
        );
        if (!rendered) return null;
        return (
          <div key={m.id} data-msg data-msg-kind={m.kind}>
            {rendered}
          </div>
        );
      })}
      {showCompletedDivider && (
        <div
          data-msg-completed
          className="msg-completed mt-[2px] flex items-center gap-[8px] text-[11px] font-medium text-emerald-700"
        >
          <span className="h-px flex-1 bg-emerald-200" aria-hidden />
          <span className="inline-flex items-center gap-[4px] rounded-full bg-emerald-50 px-[10px] py-[2px]">
            <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden>
              <path
                d="M2 5.2 L4 7 L8 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>応答完了</span>
          </span>
          <span className="h-px flex-1 bg-emerald-200" aria-hidden />
        </div>
      )}
      </div>
      </div>
      {showJump && (
        <button
          type="button"
          data-testid="scroll-to-bottom"
          aria-label="最新のメッセージへ"
          onClick={jumpToBottom}
          className="absolute bottom-[10px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-[4px] rounded-full border border-card-border bg-card px-[11px] py-[5px] text-[11px] font-medium text-muted shadow-md hover:text-accent"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M3 5l3 3 3-3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          最新へ
        </button>
      )}
      <ProgressIndicator />
    </div>
  );
}

function renderMessage(
  m: ChatMessage,
  onApproveTool?: (id: string) => void,
  onRejectTool?: (id: string) => void,
  onRetryTool?: (id: string) => void,
  onOpenArtifact?: (artifactId: string) => void,
): JSX.Element | null {
  switch (m.kind) {
    case 'user':
      return <UserMessage text={m.text} {...(m.attachments ? { attachments: m.attachments } : {})} />;
    case 'agent':
      return <AgentMessage text={m.text} />;
    case 'thinking':
      return <ThinkingStatic />;
    case 'tool':
      return (
        <ToolCardMessage
          message={m}
          {...(onApproveTool ? { onApprove: onApproveTool } : {})}
          {...(onRejectTool ? { onReject: onRejectTool } : {})}
          {...(onRetryTool ? { onRetry: onRetryTool } : {})}
        />
      );
    case 'artifact-ref':
      return (
        <ArtifactRefMessage
          artifactId={m.artifactId}
          title={m.title}
          artifactKind={m.artifactKind}
          {...(onOpenArtifact ? { onOpen: onOpenArtifact } : {})}
        />
      );
    default:
      return null;
  }
}
