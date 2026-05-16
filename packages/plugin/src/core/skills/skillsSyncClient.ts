// Cowork Agent for kintone — Skills 同期クライアント
//
// kintone proxy 経由で Worker /skills/sync を叩き、リポジトリ内 skill bundle を
// Anthropic Skills API にアップロードする。返却された skill_id マッピングを
// plugin config に保存し、resolveAgent.ts が次回 Agent 作成時に attach できる
// ようにする。
//
// kintone setProxyConfig に以下が固定登録されている前提:
//   X-Anthropic-Api-Key: <ANTHROPIC_API_KEY>
//   Content-Type: application/json

import type { SkillBundle } from '../../generated/skills-bundle';

export interface SkillSyncResultEntry {
  /** リポジトリ内の skill 名 (= SKILL.md frontmatter の name) */
  name: string;
  displayTitle: string;
  /** Anthropic から払い出された skill_id (workspace スコープ) */
  skillId: string;
  /** Anthropic 側のバージョン (Unix epoch timestamp) */
  version: string;
  action: 'created' | 'updated';
}

export interface SkillSyncResult {
  results: SkillSyncResultEntry[];
}

export class SkillSyncError extends Error {
  status: number;
  responseBody: string;
  constructor(status: number, responseBody: string) {
    super(`skills/sync failed (${status}): ${responseBody}`);
    this.name = 'SkillSyncError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export interface SyncSkillsArgs {
  pluginId: string;
  workerUrl: string;
  bundles: SkillBundle[];
}

/**
 * Worker /skills/sync に bundle 一覧を送信して Anthropic にアップロード。
 * 返却値の skillId マッピングを呼出側で plugin config に保存する。
 */
export async function syncSkills(args: SyncSkillsArgs): Promise<SkillSyncResult> {
  if (typeof kintone === 'undefined' || !kintone?.plugin?.app?.proxy) {
    throw new Error('kintone JavaScript API is not available');
  }
  if (args.bundles.length === 0) {
    return { results: [] };
  }

  const url = `${args.workerUrl.replace(/\/$/, '')}/skills/sync`;
  const body = {
    skills: args.bundles.map((b) => ({
      name: b.name,
      displayTitle: b.displayTitle,
      skillMd: b.skillMd,
    })),
  };

  const [respBody, status] = await kintone.plugin.app.proxy(
    args.pluginId,
    url,
    'POST',
    {}, // X-Anthropic-Api-Key は setProxyConfig 経由
    JSON.stringify(body),
  );

  if (status < 200 || status >= 300) {
    throw new SkillSyncError(status, respBody);
  }

  let parsed: SkillSyncResult;
  try {
    parsed = JSON.parse(respBody) as SkillSyncResult;
  } catch {
    throw new Error(`skills/sync returned invalid JSON: ${respBody.slice(0, 200)}`);
  }
  if (!parsed || !Array.isArray(parsed.results)) {
    throw new Error('skills/sync response missing results array');
  }
  return parsed;
}
