// Cowork Agent for kintone — Managed Agents イベント → UI 操作 の変換
//
// useEventPoller から呼ばれる pure な変換ロジック。
// 戻り値は副作用の配列 (1 イベントから複数の効果が出る場合に対応):
//   - { kind: 'add', message }                      — 新規 ChatMessage を追加
//   - { kind: 'update-tool', toolUseId, patch }     — 既存 tool message を id で部分更新
//   - { kind: 'upsert-artifact', toolUseId, input } — Artifact を新規/更新 + custom_tool_result の返却対象として記録
//   - 表示に関係しないイベントは空配列を返す

import { parseCreateArtifactInput } from '../artifacts/types';
import { PROPOSE_AGENT_TOOL_NAME } from '../bootstrap/agentToolDefs';
import { KINTONE_TOOL_NAMES } from '../bootstrap/builtInAgents';
import { HIDDEN_BLOCK_MARKER } from '../files/messageContent';

import type { AgentEditDraft } from './agentDetailApi';
import type { SessionEvent } from './types';
import type { ArtifactKind, CreateArtifactInput } from '../artifacts/types';
import type { AgentColor, AgentGlyph } from '../bootstrap/agentTypes';
import type { KintoneToolName } from '../bootstrap/builtInAgents';
import type { ChatMessage, ToolMessage } from '../chat/types';

export type InterpretedEffect =
  | { kind: 'add'; message: ChatMessage }
  | { kind: 'update-tool'; toolUseId: string; patch: Partial<Omit<ToolMessage, 'id' | 'kind'>> }
  | {
      kind: 'upsert-artifact';
      /** custom_tool_use の tool_use_id (= 結果返却用の識別子)。無ければ event.id を使う */
      toolUseId: string;
      input: CreateArtifactInput;
    }
  | {
      // #48 エージェントデザイナーの propose_agent 受信。
      // useEventPoller がこの effect を見たら:
      //  1. agent-draft アーティファクトを upsert (content に { draft, rationale, model })
      //  2. chatStore.setPendingAgentProposal で modal を起動
      //  3. pendingCustomToolUseIds に追加 (responder が tool_result を返す)
      kind: 'propose-agent';
      toolUseId: string;
      draft: AgentEditDraft;
      rationale: string;
      /** 提案された model。createCustomAgentFrom の base 選定に使う (AgentEditDraft には載せない)。 */
      model: 'opus' | 'sonnet';
    };

export function interpretEvent(event: SessionEvent): InterpretedEffect[] {
  switch (event.type) {
    case 'user.message': {
      const content = (event as { content?: unknown }).content;
      return [{ kind: 'add', message: { id: event.id, kind: 'user', text: extractText(content) } }];
    }
    case 'agent.message': {
      const content = (event as { content?: unknown }).content;
      return [{ kind: 'add', message: { id: event.id, kind: 'agent', text: extractText(content) } }];
    }
    case 'agent.thinking':
      return [{ kind: 'add', message: { id: event.id, kind: 'thinking' } }];
    // 組み込みツール (agent_toolset_20260401: bash/read/write 等) と
    // MCP ツール (kintone-* 等) は別イベント名で来るが、payload は同型なので同じ扱い。
    case 'agent.tool_use':
    case 'agent.mcp_tool_use': {
      const e = event as Extract<SessionEvent, { type: 'agent.tool_use' | 'agent.mcp_tool_use' }>;
      return [
        {
          kind: 'add',
          message: {
            id: e.id,
            kind: 'tool',
            name: e.name,
            input: e.input,
            status: 'running',
          },
        },
      ];
    }
    case 'agent.tool_result':
    case 'agent.mcp_tool_result': {
      const e = event as Extract<
        SessionEvent,
        { type: 'agent.tool_result' | 'agent.mcp_tool_result' }
      >;
      // 組み込みツールは tool_use_id、MCP ツールは mcp_tool_use_id にリンク id が入る
      const toolUseId =
        e.type === 'agent.mcp_tool_result' ? e.mcp_tool_use_id : e.tool_use_id;
      const isError = e.is_error === true;
      return [
        {
          kind: 'update-tool',
          toolUseId,
          patch: {
            status: isError ? 'error' : 'success',
            result: e.content,
            ...(isError ? { errorText: extractText(e.content) } : {}),
          },
        },
      ];
    }
    case 'agent.custom_tool_use': {
      const e = event as Extract<SessionEvent, { type: 'agent.custom_tool_use' }>;
      // event.id がそのまま custom_tool_use_id として user.custom_tool_result の
      // 参照キーに使われる (Anthropic Managed Agents 仕様)
      const toolUseId = e.id;
      if (e.name === 'create_artifact') {
        const input = parseCreateArtifactInput(e.input);
        if (!input) {
          return [
            {
              kind: 'add',
              message: {
                id: e.id,
                kind: 'agent',
                text: '⚠️ アーティファクト作成に失敗しました (入力不正)',
              },
            },
          ];
        }
        return [
          { kind: 'upsert-artifact', toolUseId, input },
          {
            kind: 'add',
            message: {
              id: e.id,
              kind: 'artifact-ref',
              artifactId: input.id,
              title: input.title,
              artifactKind: input.kind as ArtifactKind,
            },
          },
        ];
      }
      if (e.name === PROPOSE_AGENT_TOOL_NAME) {
        const parsed = parseProposeAgentInput(e.input);
        if (!parsed) {
          return [
            {
              kind: 'add',
              message: {
                id: e.id,
                kind: 'agent',
                text: '⚠️ エージェント設計案の取込に失敗しました (入力不正)',
              },
            },
          ];
        }
        return [{ kind: 'propose-agent', toolUseId, ...parsed }];
      }
      return [];
    }
    case 'session.status_idle': {
      const e = event as Extract<SessionEvent, { type: 'session.status_idle' }>;
      // 承認待ちの stop_reason は実 API では `requires_action` で来る (docs の
      // `tool_confirmation_required` は記載通りの名前ではなかった)。両方を許容して
      // 将来 API が揃った場合にも対応できるようにする。
      const stopType = e.stop_reason.type;
      if (stopType !== 'requires_action' && stopType !== 'tool_confirmation_required') return [];
      const ids = e.stop_reason.event_ids;
      if (!Array.isArray(ids) || ids.length === 0) return [];
      // 複数 pending は events stream 上通常 1 件のため最初の 1 件のみ処理。
      return [
        {
          kind: 'update-tool',
          toolUseId: ids[0]!,
          patch: { status: 'pending-confirmation' },
        },
      ];
    }
    default:
      return [];
  }
}

/**
 * Session のターン終了を示すイベントか判定する。
 *
 * `session.status_idle` の `stop_reason.type` 別に分類:
 *   - terminal (= Agent が作業を終えた / これ以上動かない):
 *       end_turn / retries_exhausted / max_tokens / error
 *   - 非 terminal (= ユーザー応答 / ツール完了待ちなので進行中扱い):
 *       requires_action / tool_confirmation_required / tool_use / custom_tool_use
 */
export function isTerminalEvent(event: SessionEvent): boolean {
  if (event.type !== 'session.status_idle') return false;
  const reason = (event as { stop_reason?: { type?: string } }).stop_reason;
  const t = reason?.type;
  return (
    t === 'end_turn' ||
    t === 'retries_exhausted' ||
    t === 'max_tokens' ||
    t === 'error'
  );
}

// ─── propose_agent 入力 parser (#48) ───────────────────────────────────────

const ICON_KINDS: readonly AgentGlyph[] = [
  'biz',
  'cust',
  'dev',
  'analytics',
  'mail',
  'calendar',
  'ops',
  'ai',
  'doc',
];
const ICON_COLORS: readonly AgentColor[] = [
  'teal',
  'emerald',
  'amber',
  'rose',
  'indigo',
  'slate',
  'sky',
  'fuchsia',
];
const ANTHROPIC_SKILL_IDS = new Set(['xlsx', 'docx', 'pdf', 'pptx']);
const KNOWN_KINTONE_TOOL_NAMES = new Set<string>(KINTONE_TOOL_NAMES);

const QUICK_ACTIONS_MAX = 5;

/**
 * `propose_agent` Custom Tool の input を `AgentEditDraft` + `rationale` に正規化する。
 * 不正なフィールドは silent fallback (enum 外 → 既定値、未知ツール名 → 除外、超過 → slice)。
 * 必須フィールドが完全に欠けている場合のみ null を返す (= 解釈不能)。
 */
export function parseProposeAgentInput(
  raw: unknown,
): { draft: AgentEditDraft; rationale: string; model: 'opus' | 'sonnet' } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const name = typeof o.name === 'string' ? o.name.trim() : '';
  const description = typeof o.description === 'string' ? o.description.trim() : '';
  const systemPrompt = typeof o.systemPrompt === 'string' ? o.systemPrompt : '';
  if (!name || !systemPrompt) return null;

  const iconKind: AgentGlyph =
    typeof o.iconKind === 'string' && (ICON_KINDS as readonly string[]).includes(o.iconKind)
      ? (o.iconKind as AgentGlyph)
      : 'ai';
  const iconColor: AgentColor =
    typeof o.iconColor === 'string' && (ICON_COLORS as readonly string[]).includes(o.iconColor)
      ? (o.iconColor as AgentColor)
      : 'teal';
  const model: 'opus' | 'sonnet' = o.model === 'opus' ? 'opus' : 'sonnet';

  const quickActionsRaw = Array.isArray(o.quickActions) ? o.quickActions : [];
  const quickActions = quickActionsRaw
    .map((q) => (typeof q === 'string' ? q.trim() : ''))
    .filter((q) => q.length > 0)
    .slice(0, QUICK_ACTIONS_MAX);

  const enabledToolsRaw = Array.isArray(o.enabledTools) ? o.enabledTools : [];
  const enabledTools = enabledToolsRaw.filter(
    (t): t is KintoneToolName => typeof t === 'string' && KNOWN_KINTONE_TOOL_NAMES.has(t),
  );

  const skillIdsRaw = Array.isArray(o.anthropicSkillIds) ? o.anthropicSkillIds : [];
  const anthropicSkillIds = skillIdsRaw.filter(
    (s): s is string => typeof s === 'string' && ANTHROPIC_SKILL_IDS.has(s),
  );

  const rationale = typeof o.rationale === 'string' ? o.rationale.trim() : '';

  const draft: AgentEditDraft = {
    name,
    description,
    iconKind,
    iconColor,
    visibility: 'public',
    isDefault: false,
    systemPrompt,
    anthropicSkillIds,
    customSkillIds: [],
    enabledTools,
    quickActions,
    // Designer 経由の Custom Agent は全員公開で start (admin が AccessPicker で後から絞る)
    allowedUsers: [],
    allowedGroups: [],
    allowedOrganizations: [],
    mcpAttachments: [],
  };
  return { draft, rationale, model };
}

/**
 * Anthropic 形式の content を表示用テキストに正規化する。
 * - string → そのまま
 * - Array<{type:'text', text}> → text を連結 (text 以外のブロックは無視)
 * - undefined/null → ''
 */
function extractText(content: unknown): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (b && typeof b === 'object' && 'type' in b && (b as { type: string }).type === 'text') {
          const text = (b as { text?: unknown }).text;
          if (typeof text !== 'string') return '';
          // UI 非表示マーカー (cowork-agent:hidden) で始まる block は内部メタ情報
          // (fileKey 一覧など) なのでチャットに表示しない。LLM には届いている。
          if (text.startsWith(HIDDEN_BLOCK_MARKER)) return '';
          return text;
        }
        return '';
      })
      .join('');
  }
  return '';
}
