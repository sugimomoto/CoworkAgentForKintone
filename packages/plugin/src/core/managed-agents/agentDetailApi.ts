// Cowork Agent for kintone — Agent 詳細編集 / Custom Agent 追加 API ラッパ (#40)
//
// AgentDetailModal から呼ばれる 3 種の操作を提供する:
//   - applyAgentEdit: 既存 Agent (built-in / custom) を編集して update
//   - createCustomAgentFrom: 雛形 Agent から派生する新規 Custom Agent を作成
//   - archiveAgentById: Custom Agent をアーカイブ (built-in は UI で呼ばせない)
//
// metadata の構造は resolveAgent.ts のものを踏襲し、Anthropic Workspace 上で
// find filter (purpose / workerUrl / kintoneDomain 等) が壊れないようにする。

import { KINTONE_MCP_SERVER_NAME, buildMcpServers } from '../bootstrap/agentToolDefs';
import {
  META_KEY_ALLOWED_GROUPS,
  META_KEY_ALLOWED_ORGANIZATIONS,
  META_KEY_ALLOWED_USERS,
  META_KEY_QUICK_ACTIONS,
} from '../bootstrap/agentTypes';
import {
  NOTIFY_AGENT_METADATA_KEYS,
  generateNotifyKey,
  notifyKeyForBuiltIn,
  registerNotifyWebhook,
  resolveNotifyKey,
  unregisterNotifyWebhook,
} from '../bootstrap/notifyRegistration';
import { AGENT_TYPE, METADATA_SOURCE } from '../constants';
import {
  META_KEY_MCP_ATTACHMENTS,
  buildAttachedMcpServers,
  buildAttachedMcpToolsets,
  serializeMcpAttachments,
} from '../mcp/attachSpec';

import { buildAgentTools } from './buildAgentTools';
import { ApiError } from './client';
import {
  archiveAgent as archiveAgentResource,
  createAgent,
  retrieveAgent,
  updateAgent,
} from './resources';

import type { Agent } from './types';
import type { AgentColor, AgentGlyph, NotifyPlatform } from '../bootstrap/agentTypes';
import type { KintoneToolName } from '../bootstrap/builtInAgents';
import type { McpAttachment, McpServerDef } from '../mcp/registry';

/**
 * AgentDetailModal の編集状態 (form values)。
 * model / purpose / variantGroup は不変なので含めない (UI からも編集不可)。
 */
export interface AgentEditDraft {
  name: string;
  description: string;
  iconKind: AgentGlyph;
  iconColor: AgentColor;
  visibility: 'public' | 'private';
  isDefault: boolean;
  systemPrompt: string;
  /** 選択された Anthropic 製 skill ID (例: xlsx / docx / pdf / pptx) */
  anthropicSkillIds: readonly string[];
  /** 選択された custom skill ID (Anthropic Workspace の skill_id) */
  customSkillIds: readonly string[];
  /** ON にされた kintone MCP tool 名 */
  enabledTools: readonly KintoneToolName[];
  /**
   * クイックアクション (PresetAgentLanding で並ぶワンクリック実行ボタン)。
   * built-in / custom とも admin が編集可能。保存時に metadata.quickActions へ JSON 配列文字列で永続化し、
   * 読込 (agentRecord.readBuiltInEditableFields) も metadata を優先する (#75)。
   * 空配列なら key 自体を削除 → built-in は spec カタログ値にフォールバックする。
   */
  quickActions: readonly string[];
  /**
   * #47 公開先 ACL — 0 件 = 全員に公開、いずれか指定 = OR 結合。
   * 保存時に metadata.allowedUsers / allowedGroups / allowedOrganizations へ
   * それぞれ JSON 配列文字列として永続化。空配列なら key 自体を削除。
   */
  allowedUsers: readonly string[];
  allowedGroups: readonly string[];
  allowedOrganizations: readonly string[];
  /** #42 追加 MCP サーバーの attach（serverId × enabledTools）。metadata に JSON で永続化。 */
  mcpAttachments: readonly McpAttachment[];
}

/** skill 配列を Anthropic API に渡す形式に変換 */
function buildAgentSkills(
  draft: Pick<AgentEditDraft, 'anthropicSkillIds' | 'customSkillIds'>,
): Array<{ type: 'anthropic' | 'custom'; skill_id: string }> {
  return [
    ...draft.anthropicSkillIds.map((id) => ({ type: 'anthropic' as const, skill_id: id })),
    ...draft.customSkillIds.map((id) => ({ type: 'custom' as const, skill_id: id })),
  ];
}

/**
 * Draft の UI 補助情報を既存 metadata に merge する。
 * 空配列の quickActions は key を含めず、merge 時に削除されたものとして扱う。
 */
function mergeMetadataPatch(
  existing: Record<string, string> | null | undefined,
  draft: AgentEditDraft,
): Record<string, string> {
  const merged: Record<string, string> = {
    ...(existing ?? {}),
    iconKind: draft.iconKind,
    iconColor: draft.iconColor,
    visibility: draft.visibility,
    isDefault: draft.isDefault ? '1' : '0',
  };
  setOrDeleteJsonArrayKey(merged, META_KEY_QUICK_ACTIONS, draft.quickActions);
  setOrDeleteJsonArrayKey(merged, META_KEY_ALLOWED_USERS, draft.allowedUsers);
  setOrDeleteJsonArrayKey(merged, META_KEY_ALLOWED_GROUPS, draft.allowedGroups);
  setOrDeleteJsonArrayKey(merged, META_KEY_ALLOWED_ORGANIZATIONS, draft.allowedOrganizations);
  // #42 attach: 1件以上で JSON 保存 / 0件で key 削除
  if (draft.mcpAttachments.length > 0) {
    merged[META_KEY_MCP_ATTACHMENTS] = serializeMcpAttachments(draft.mcpAttachments);
  } else {
    delete merged[META_KEY_MCP_ATTACHMENTS];
  }
  return merged;
}

/** 値あり → JSON 化して set / 空配列 → key 自体を削除。 */
function setOrDeleteJsonArrayKey(
  merged: Record<string, string>,
  key: string,
  arr: readonly string[],
): void {
  if (arr.length > 0) {
    merged[key] = JSON.stringify(arr);
  } else {
    delete merged[key];
  }
}

/**
 * 既存 Agent (built-in / custom 両方) を編集して update。
 *
 * 動作:
 *   1. retrieveAgent(id) で最新 metadata を取得 (find filter 列の維持に必要)
 *   2. mergeMetadataPatch で UI 補助情報を上書き
 *   3. mcp_servers を tools と整合するよう再構築 (notify toolset は常設なので notify server も必須)
 *   4. updateAgent(id, { name, description, system, tools, skills, mcp_servers, metadata })
 *
 * #13 で send_notification toolset を全 Agent に常設したため、tools だけ更新して mcp_servers を
 * 据え置くと「mcp_toolset references [notify] but no matching entry in mcp_servers」(HTTP 400) になる。
 * notify server を含む mcp_servers を毎回明示的に送って整合を保証する。
 */
export async function applyAgentEdit(
  agentId: string,
  draft: AgentEditDraft,
  /** #42 追加 MCP カタログ（attach の serverId→url 解決 + mcp_servers/toolset 構築に使う）。 */
  mcpCatalog: readonly McpServerDef[] = [],
): Promise<Agent> {
  const existing = await retrieveAgent(agentId);
  const meta = (existing.metadata ?? {}) as Record<string, string>;
  const metadata = mergeMetadataPatch(meta, draft);

  // #42 attach: カタログと突合して mcp_servers / mcp_toolset を生成
  const attachedServers = buildAttachedMcpServers(draft.mcpAttachments, mcpCatalog);
  const attachedToolsets = buildAttachedMcpToolsets(draft.mcpAttachments, mcpCatalog);

  // notify toolset と整合する mcp_servers を組み立てる。
  // workerUrl / kintoneDomain は plugin 製 Agent の metadata に必ず入っている (find filter 列)。
  let mcpServers: unknown[] | undefined;
  if (meta.workerUrl && meta.kintoneDomain) {
    const { notifyKey, generated } = resolveNotifyKey(meta);
    // custom で新規採番した notifyKey は永続化 (次回以降 / Webhook 登録で同じパスを使う)
    if (generated) metadata[NOTIFY_AGENT_METADATA_KEYS.notifyKey] = notifyKey;
    mcpServers = [...buildMcpServers(meta.workerUrl, meta.kintoneDomain, notifyKey), ...attachedServers];
  } else if (attachedServers.length > 0) {
    mcpServers = [...attachedServers];
  }

  return updateAgent(agentId, {
    version: existing.version,
    name: draft.name,
    description: draft.description,
    system: draft.systemPrompt,
    tools: [...buildAgentTools(draft.enabledTools), ...attachedToolsets],
    skills: buildAgentSkills(draft),
    ...(mcpServers ? { mcp_servers: mcpServers } : {}),
    metadata,
  });
}

/**
 * 雛形 Agent をベースに新規 Custom Agent を作成。
 *
 * 動作:
 *   1. retrieveAgent(baseAgentId) で base の model / metadata / mcp_servers を取得
 *   2. metadata は base の find filter 列 (workerUrl / kintoneDomain / promptVersion) を
 *      引き継ぎつつ、purpose='custom' に上書き
 *   3. createAgent({ model: base.model, name: draft.name, ... })
 *
 * 注意: variantGroup は引き継がない (custom は独立 Agent 扱い)。
 */
export async function createCustomAgentFrom(args: {
  baseAgentId: string;
  draft: AgentEditDraft;
  /** #42 追加 MCP カタログ。 */
  mcpCatalog?: readonly McpServerDef[];
}): Promise<Agent> {
  const base = await retrieveAgent(args.baseAgentId);
  const baseMeta = (base.metadata ?? {}) as Record<string, string>;
  const mcpCatalog = args.mcpCatalog ?? [];

  // find filter 列 (再 bootstrap で重複検知させる用) を base から引き継ぎつつ
  // mergeMetadataPatch で UI 補助情報を上書きする (空 quickActions = key 不在)。
  const carriedBase: Record<string, string> = {
    source: METADATA_SOURCE,
    type: AGENT_TYPE.default,
    purpose: 'custom',
    ...(baseMeta.workerUrl ? { workerUrl: baseMeta.workerUrl } : {}),
    ...(baseMeta.kintoneDomain ? { kintoneDomain: baseMeta.kintoneDomain } : {}),
    ...(baseMeta.promptVersion ? { promptVersion: baseMeta.promptVersion } : {}),
  };
  // 通知 (#13): Custom Agent は作成時に notifyKey(UUID) を採番し metadata に固定する。
  // (agent_id 未確定でも /notify/<domain>/<key> を確定できる = chicken-and-egg 回避)
  const notifyKey = generateNotifyKey();

  // Custom は variantGroup なし (built-in 専用) — base からも明示的に拾わない。
  const metadata = {
    ...mergeMetadataPatch(carriedBase, args.draft),
    [NOTIFY_AGENT_METADATA_KEYS.notifyKey]: notifyKey,
  };

  // #42 attach: カタログと突合
  const attachedServers = buildAttachedMcpServers(args.draft.mcpAttachments, mcpCatalog);
  const attachedToolsets = buildAttachedMcpToolsets(args.draft.mcpAttachments, mcpCatalog);

  // workerUrl/kintoneDomain が揃えば notify サーバー込みで mcp_servers を再構築。
  // 揃わない (旧 base 等) 場合は従来通り kintone のみ。+ attach 済みサーバーを足す。
  const baseServers =
    baseMeta.workerUrl && baseMeta.kintoneDomain
      ? buildMcpServers(baseMeta.workerUrl, baseMeta.kintoneDomain, notifyKey)
      : extractMcpServers(base);
  const mcpServers = [...baseServers, ...attachedServers];

  return createAgent({
    model: base.model,
    name: args.draft.name,
    description: args.draft.description,
    system: args.draft.systemPrompt,
    tools: [...buildAgentTools(args.draft.enabledTools), ...attachedToolsets],
    skills: buildAgentSkills(args.draft),
    mcp_servers: mcpServers,
    metadata,
  });
}

/**
 * Custom Agent をアーカイブ (Anthropic 仕様で論理削除)。
 * built-in は UI 側でガード (呼ばれない)。本関数自体は purpose 判定をしないので、
 * 誤って built-in に対して呼ばないこと。
 */
export async function archiveAgentById(agentId: string): Promise<void> {
  await archiveAgentResource(agentId);
}

export interface WebhookInput {
  platform: NotifyPlatform;
  /** 新規/上書き保存時のみ。伏字 (変更なし) のときは undefined。 */
  url?: string;
}

/**
 * AgentDetailModal 保存時に、Agent の Webhook 登録状態を working copy (webhook) に合わせる (#13)。
 *   - webhook=null かつ登録済 → credential を archive し metadata をクリア
 *   - webhook.url あり        → static_bearer を upsert し metadata を更新 (新規/上書き)
 *   - webhook.url 無し (伏字)  → 変更なし (no-op)
 * 戻り値は metadata 更新後の Agent (UI 再描画用)。kintoneDomain / notifyKey は agent.metadata から読む。
 * webhookUrl は registerNotifyWebhook に渡すだけで、この関数も metadata にも一切残さない。
 */
export async function reconcileAgentWebhook(
  agent: Agent,
  webhook: WebhookInput | null,
  ctx: { pluginId: string; workerUrl: string },
): Promise<Agent> {
  const meta = (agent.metadata ?? {}) as Record<string, string>;
  const credentialId = meta[NOTIFY_AGENT_METADATA_KEYS.credentialId];
  const vaultId = meta[NOTIFY_AGENT_METADATA_KEYS.vaultId];

  // 解除
  if (webhook === null) {
    if (!credentialId || !vaultId) return agent; // もともと未登録
    await unregisterNotifyWebhook({ vaultId, credentialId });
    return patchAgentMetadata(agent, {
      [NOTIFY_AGENT_METADATA_KEYS.platform]: null,
      [NOTIFY_AGENT_METADATA_KEYS.credentialId]: null,
      [NOTIFY_AGENT_METADATA_KEYS.vaultId]: null,
    });
  }

  // 伏字のまま (変更なし)
  if (webhook.url === undefined) return agent;

  // 新規/上書き登録。
  // notifyKey: Custom は metadata.notifyKey (作成時に採番)、Built-in は purpose から導出。
  const kintoneDomain = meta.kintoneDomain;
  const purpose = meta.purpose;
  const notifyKey =
    meta[NOTIFY_AGENT_METADATA_KEYS.notifyKey] ??
    (purpose && purpose !== 'custom' ? notifyKeyForBuiltIn(purpose) : undefined);
  if (!kintoneDomain || !notifyKey) {
    throw new Error('この Agent は通知に対応していません (kintoneDomain / notifyKey 未設定)');
  }
  const result = await registerNotifyWebhook({
    pluginId: ctx.pluginId,
    workerUrl: ctx.workerUrl,
    kintoneDomain,
    notifyKey,
    webhookUrl: webhook.url,
    platform: webhook.platform,
    ...(vaultId ? { existingVaultId: vaultId } : {}),
    ...(credentialId ? { existingCredentialId: credentialId } : {}),
  });
  return patchAgentMetadata(agent, {
    [NOTIFY_AGENT_METADATA_KEYS.platform]: result.notifyPlatform,
    [NOTIFY_AGENT_METADATA_KEYS.credentialId]: result.notifyCredentialId,
    [NOTIFY_AGENT_METADATA_KEYS.vaultId]: result.notifyVaultId,
  });
}

/** metadata の指定キーを set (string) / clear (null) して updateAgent。409 は 1 度だけ retry。 */
async function patchAgentMetadata(
  agent: Agent,
  patch: Record<string, string | null>,
): Promise<Agent> {
  const build = (base: Record<string, string>): Record<string, string> => {
    const next = { ...base };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete next[k];
      else next[k] = v;
    }
    return next;
  };
  let version = agent.version;
  let baseMeta = (agent.metadata ?? {}) as Record<string, string>;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await updateAgent(agent.id, { version, metadata: build(baseMeta) });
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 409 || attempt === 1) throw err;
      const fresh = await retrieveAgent(agent.id);
      version = fresh.version;
      baseMeta = (fresh.metadata ?? {}) as Record<string, string>;
    }
  }
  return agent; // 到達しない
}

/**
 * Agent から mcp_servers 設定を取り出す (新 Custom Agent に同じ MCP を attach するため)。
 * Anthropic の Agent.mcp_servers は API レスポンスに含まれない可能性があるので、
 * 取れなければ空配列を返す (= MCP 無し Custom Agent)。
 */
function extractMcpServers(agent: Agent): unknown[] {
  const raw = (agent as unknown as { mcp_servers?: unknown }).mcp_servers;
  if (Array.isArray(raw) && raw.length > 0) return raw as unknown[];
  // フォールバック: metadata から workerUrl / kintoneDomain を読んで再構築
  const meta = (agent.metadata ?? {}) as Record<string, string>;
  if (meta.workerUrl && meta.kintoneDomain) {
    const url = `${meta.workerUrl.replace(/\/$/, '')}/mcp/${meta.kintoneDomain}`;
    return [{ type: 'url', name: KINTONE_MCP_SERVER_NAME, url }];
  }
  return [];
}
