// Cowork Agent for kintone — 通知 Webhook の登録/解除 (#13)
//
// Agent ごとに 1 本の Webhook を紐付ける。実体は通知 Vault の static_bearer 認証情報で、
// `/notify/<domain>/<notifyKey>` という MCP URL に対して Webhook URL を Bearer 注入させる。
//
// notifyKey の規約:
//   - Built-in Agent : agent の purpose をそのまま使う (再インストールでも安定)
//   - Custom Agent   : 生成した UUID を Agent metadata に保存して使う
//     (作成時点では agent_id が未確定なため。chicken-and-egg 回避)
//
// セキュリティ: webhookUrl は upsert に渡すだけで JS 側に保持しない。
// metadata には platform / key / credentialId / vaultId のみ (URL は出さない)。

import { archiveVaultCredential } from '../managed-agents/resources';
import { upsertStaticBearerCredential } from '../oauth/credentialsUpsertClient';

import { buildNotifyMcpUrl } from './agentToolDefs';
import { resolveNotifyVault } from './resolveNotifyVault';

/** Agent metadata に保存する通知関連キー。URL は決して入れない。 */
export const NOTIFY_AGENT_METADATA_KEYS = {
  platform: 'notifyPlatform',
  notifyKey: 'notifyKey',
  credentialId: 'notifyCredentialId',
  vaultId: 'notifyVaultId',
} as const;

export interface NotifyMetadata {
  notifyPlatform: string;
  notifyKey: string;
  notifyCredentialId: string;
  notifyVaultId: string;
}

const NOTIFY_KEY_RE = /^[A-Za-z0-9_-]+$/;

/** Built-in Agent の notifyKey。purpose を URL セーフに正規化する。 */
export function notifyKeyForBuiltIn(purpose: string): string {
  const key = purpose.replace(/[^A-Za-z0-9_-]/g, '-');
  if (!key) throw new Error('notifyKeyForBuiltIn: empty purpose');
  return key;
}

/** Custom Agent 用の notifyKey を新規生成する (UUID)。 */
export function generateNotifyKey(): string {
  return crypto.randomUUID();
}

/** notifyKey が Worker のパスパターン (`[A-Za-z0-9_-]+`) に適合するか。 */
export function isValidNotifyKey(key: string): boolean {
  return NOTIFY_KEY_RE.test(key);
}

export interface RegisterNotifyArgs {
  pluginId: string;
  workerUrl: string;
  kintoneDomain: string;
  notifyKey: string;
  webhookUrl: string;
  platform: string;
  /** 既存 credential。同一 Vault にあれば in-place 更新、無ければ作成。 */
  existingVaultId?: string;
  existingCredentialId?: string;
}

/**
 * Webhook を登録 (Vault static_bearer upsert) し、Agent metadata に保存すべき値を返す。
 * 呼び出し側 (T4) が updateAgent でこの metadata を永続化する。
 */
export async function registerNotifyWebhook(args: RegisterNotifyArgs): Promise<NotifyMetadata> {
  if (!isValidNotifyKey(args.notifyKey)) {
    throw new Error(`invalid notifyKey: ${args.notifyKey}`);
  }
  const vault = await resolveNotifyVault(args.kintoneDomain);
  const base = {
    pluginId: args.pluginId,
    workerUrl: args.workerUrl,
    vaultId: vault.id,
    token: args.webhookUrl,
  };
  const canUpdate = Boolean(args.existingCredentialId) && args.existingVaultId === vault.id;
  const result = await upsertStaticBearerCredential(
    canUpdate
      ? { ...base, credentialId: args.existingCredentialId! }
      : { ...base, mcpServerUrl: buildNotifyMcpUrl(args.workerUrl, args.kintoneDomain, args.notifyKey) },
  );
  return {
    notifyPlatform: args.platform,
    notifyKey: args.notifyKey,
    notifyCredentialId: result.credential_id,
    notifyVaultId: result.vault_id,
  };
}

/** Webhook 登録を解除する (credential を archive)。metadata クリアは呼び出し側で行う。 */
export async function unregisterNotifyWebhook(args: {
  vaultId: string;
  credentialId: string;
}): Promise<void> {
  await archiveVaultCredential(args.vaultId, args.credentialId);
}

/**
 * Agent metadata から AgentRecord 用の通知フィールドを読む (#13)。
 * 未登録なら空オブジェクト (exactOptionalPropertyTypes 対応で key 自体を出さない)。
 * URL は metadata に無いので決して漏れない。
 */
export function readNotifyRecordFields(meta: Record<string, string>): {
  notifyPlatform?: 'slack' | 'teams' | 'discord';
  notifyVaultId?: string;
} {
  const out: { notifyPlatform?: 'slack' | 'teams' | 'discord'; notifyVaultId?: string } = {};
  const p = meta[NOTIFY_AGENT_METADATA_KEYS.platform];
  if (p === 'slack' || p === 'teams' || p === 'discord') out.notifyPlatform = p;
  const v = meta[NOTIFY_AGENT_METADATA_KEYS.vaultId];
  if (v) out.notifyVaultId = v;
  return out;
}
