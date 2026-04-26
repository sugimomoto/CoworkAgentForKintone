import { useEffect, useState } from 'react';

import type { ToolMessage } from '../MessageList';

export interface ToolCardMessageProps {
  message: ToolMessage;
  /** 承認ボタン押下 (pending-confirmation のみ) */
  onApprove?: (toolUseId: string) => void;
  /** 却下ボタン押下 (pending-confirmation のみ) */
  onReject?: (toolUseId: string) => void;
  /** 失敗時の再試行依頼 (error のみ) */
  onRetry?: (toolUseId: string) => void;
}

/** running 状態の経過秒数を 1s 刻みで返すフック */
function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

const STATUS_STYLES: Record<ToolMessage['status'], { wrap: string; label: string; icon: string }> = {
  running: {
    wrap: 'border-border bg-surface-2',
    label: 'text-text-muted',
    icon: '⏳',
  },
  success: {
    wrap: 'border-emerald-300 bg-emerald-50',
    label: 'text-emerald-800',
    icon: '✓',
  },
  error: {
    wrap: 'border-red-300 bg-red-50',
    label: 'text-red-800',
    icon: '⚠',
  },
  'pending-confirmation': {
    wrap: 'border-amber-400 bg-amber-50',
    label: 'text-amber-900',
    icon: '?',
  },
};

const STATUS_TEXT: Record<ToolMessage['status'], string> = {
  running: '実行中…',
  success: '完了',
  error: '失敗',
  'pending-confirmation': '承認が必要',
};

export function ToolCardMessage({
  message,
  onApprove,
  onReject,
  onRetry,
}: ToolCardMessageProps): JSX.Element {
  const style = STATUS_STYLES[message.status];
  const summary = summarize(message.name, message.input);
  const elapsed = useElapsedSeconds(message.status === 'running');
  const statusText =
    message.status === 'running' && elapsed > 0
      ? `実行中… (${elapsed}s)`
      : STATUS_TEXT[message.status];

  return (
    <div
      data-tool-status={message.status}
      className={`flex flex-col gap-[6px] rounded-[6px] border px-[10px] py-[8px] text-[12px] ${style.wrap}`}
    >
      <div className="flex items-center gap-[6px]">
        {message.status === 'running' ? (
          <span
            aria-hidden
            className="inline-block h-[10px] w-[10px] animate-spin rounded-full border-2 border-text-muted/40 border-t-text-muted"
          />
        ) : (
          <span aria-hidden className={`text-[13px] ${style.label}`}>
            {style.icon}
          </span>
        )}
        <span className={`font-mono text-[12px] ${style.label}`}>{message.name}</span>
        <span className={`ml-auto text-[11px] ${style.label}`}>{statusText}</span>
      </div>

      {summary && <div className="text-[12px] text-text">{summary}</div>}

      {message.status === 'error' && message.errorText && (
        <div className="text-[11px] text-red-700">{truncate(message.errorText, 200)}</div>
      )}

      {(message.input !== undefined || message.result !== undefined) && (
        <details className="text-[11px] text-text-muted">
          <summary className="cursor-pointer select-none">詳細</summary>
          <pre className="mt-[4px] overflow-x-auto rounded bg-white/60 p-[6px] text-[11px]">
            {JSON.stringify(message.input, null, 2)}
          </pre>
          {message.result !== undefined && (
            <pre className="mt-[4px] overflow-x-auto rounded bg-white/60 p-[6px] text-[11px]">
              {JSON.stringify(message.result, null, 2)}
            </pre>
          )}
        </details>
      )}

      {message.status === 'pending-confirmation' && (
        <div className="mt-[2px] flex gap-[6px]">
          <button
            type="button"
            onClick={() => onApprove?.(message.id)}
            className="rounded bg-amber-600 px-[10px] py-[4px] text-[12px] text-white hover:bg-amber-700"
          >
            承認
          </button>
          <button
            type="button"
            onClick={() => onReject?.(message.id)}
            className="rounded border border-amber-600 px-[10px] py-[4px] text-[12px] text-amber-800 hover:bg-amber-100"
          >
            却下
          </button>
        </div>
      )}

      {message.status === 'error' && onRetry && (
        <div className="mt-[2px]">
          <button
            type="button"
            onClick={() => onRetry(message.id)}
            className="rounded border border-red-300 px-[10px] py-[4px] text-[12px] text-red-700 hover:bg-red-100"
          >
            もう一度試す
          </button>
        </div>
      )}
    </div>
  );
}

/** 引数の人間向けサマリを生成する。既知の kintone ツールは個別整形、それ以外は JSON 切り詰め */
function summarize(name: string, input: unknown): string {
  if (input === undefined || input === null) return '';
  const obj = input as Record<string, unknown>;
  switch (name) {
    case 'kintone-add-record':
      return formatAddRecord(obj);
    case 'kintone-add-records':
      return `app=${obj['app'] ?? '?'}, records=${arrLen(obj['records'])} 件`;
    case 'kintone-update-record':
      return formatUpdateRecord(obj);
    case 'kintone-update-records':
      return `app=${obj['app'] ?? '?'}, records=${arrLen(obj['records'])} 件`;
    case 'kintone-delete-records': {
      const ids = obj['ids'];
      const idList = Array.isArray(ids) ? (ids as unknown[]).map(String) : [];
      const head = idList.slice(0, 5).join(', ');
      const tail = idList.length > 5 ? ` …他 ${idList.length - 5} 件` : '';
      return `app=${obj['app'] ?? '?'}, ids=[${head}]${tail} (${idList.length} 件)`;
    }
    case 'kintone-add-record-comment': {
      const comment = obj['comment'] as { text?: string } | undefined;
      const text = comment?.text ?? '';
      return `record=${obj['record'] ?? '?'}, text="${truncate(text, 30)}"`;
    }
    case 'kintone-get-apps':
    case 'kintone-get-app':
    case 'kintone-get-form-fields':
    case 'kintone-get-records':
      return formatGetArgs(obj);
    default:
      return truncate(JSON.stringify(input), 80);
  }
}

function formatAddRecord(obj: Record<string, unknown>): string {
  const record = obj['record'] as Record<string, unknown> | undefined;
  const fields = record ? Object.keys(record).join(', ') : '';
  return `app=${obj['app'] ?? '?'}, fields=[${fields}]`;
}

function formatUpdateRecord(obj: Record<string, unknown>): string {
  const id = obj['id'];
  const updateKey = obj['updateKey'] as { field?: string; value?: unknown } | undefined;
  const key = id !== undefined ? `id=${id}` : updateKey ? `updateKey.${updateKey.field}=${updateKey.value}` : '?';
  const record = obj['record'] as Record<string, unknown> | undefined;
  const fields = record ? Object.keys(record).join(', ') : '';
  return `app=${obj['app'] ?? '?'}, ${key}, fields=[${fields}]`;
}

function formatGetArgs(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  if (obj['app'] !== undefined) parts.push(`app=${obj['app']}`);
  if (obj['name'] !== undefined) parts.push(`name=${obj['name']}`);
  if (obj['filters'] !== undefined) parts.push(`filters=${arrLen(obj['filters'])} 個`);
  if (obj['limit'] !== undefined) parts.push(`limit=${obj['limit']}`);
  return parts.join(', ');
}

function arrLen(v: unknown): number {
  return Array.isArray(v) ? (v as unknown[]).length : 0;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
