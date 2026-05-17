// MODEL バッジ — OPUS = 塗り / SONNET = 枠線
//
// Header の Agent pill / Agent ドロップダウン / Settings → Agents 一覧で使う。
// 仕様: requirements.md §15.2

import type { AgentModelKind } from '../../core/bootstrap/agentTypes';

export interface ModelBadgeProps {
  model: AgentModelKind;
  /** バッジサイズ。default: 'sm' (Header pill / 一覧用)、'lg' は強調表示 */
  size?: 'sm' | 'lg';
  /** 追加 className */
  className?: string;
}

export function ModelBadge({ model, size = 'sm', className }: ModelBadgeProps): JSX.Element {
  const isOpus = model === 'opus';
  const sizing =
    size === 'lg'
      ? 'text-[9.5px] px-[6px] py-[1.5px]'
      : 'text-[8.5px] px-[5px] py-[1px]';
  return (
    <span
      data-testid="model-badge"
      data-model={model}
      className={[
        'inline-flex shrink-0 items-center rounded-[3px] font-mono font-bold leading-tight whitespace-nowrap',
        'tracking-[0.6px]',
        sizing,
        isOpus
          ? 'bg-accent text-white border border-accent'
          : 'bg-transparent text-accent border border-accent/55',
        className ?? '',
      ]
        .join(' ')
        .trim()}
    >
      {isOpus ? 'OPUS' : 'SONNET'}
    </span>
  );
}
