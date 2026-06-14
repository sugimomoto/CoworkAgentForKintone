// エージェントの小さなインライン表示 (アイコン + 名前 + モデルバッジ)。
// 定期実行のモーダル / 一覧行など複数箇所で使う共通表記。

import { AgentIcon } from './AgentIcon';
import { ModelBadge } from './ModelBadge';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';

export interface AgentMiniProps {
  agent: AgentRecord;
  /** アイコンサイズ (既定 20) */
  size?: number;
}

export function AgentMini({ agent, size = 20 }: AgentMiniProps): JSX.Element {
  return (
    <span className="flex min-w-0 items-center gap-[6px]">
      <AgentIcon kind={agent.iconKind} color={agent.iconColor} size={size} />
      <span className="truncate text-[11.5px] font-semibold text-text">{agent.name}</span>
      <ModelBadge model={agent.model} size="sm" />
    </span>
  );
}
