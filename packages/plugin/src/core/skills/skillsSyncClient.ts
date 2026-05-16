// Cowork Agent for kintone — Skills 同期クライアント
//
// kintone proxy 経由で Worker /skills/sync を叩き、リポジトリ内 skill bundle を
// Anthropic Skills API にアップロードする。返却された skill_id マッピングを
// plugin config に保存し、resolveAgent.ts が次回 Agent 作成時に attach できる
// ようにする。
//
// 重要: 本クライアントは **Plugin の Config 画面 (admin) から** 呼ばれる前提。
//   - `kintone.plugin.app.proxy` は end-user JS (desktop.js) でしか使えない
//     (config 画面では $PLUGIN_ID が未確定なため undefined)
//   - 代わりに `kintone.proxy()` を使う (cfDeploy と同じパターン)
//   - `kintone.proxy()` は setProxyConfig 固定ヘッダを使わないので、
//     X-Anthropic-Api-Key を引数で受け取って明示的にヘッダに付与する

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
  workerUrl: string;
  /** Anthropic API Key (Config 画面 form input から渡す) */
  anthropicApiKey: string;
  bundles: SkillBundle[];
}

/**
 * Worker /skills/sync に bundle 一覧を送信して Anthropic にアップロード。
 * 返却値の skillId マッピングを呼出側で plugin config に保存する。
 *
 * Config 画面の `kintone.proxy()` を使うので、API Key は引数で明示的に渡す。
 */
export async function syncSkills(args: SyncSkillsArgs): Promise<SkillSyncResult> {
  if (typeof kintone === 'undefined' || typeof kintone.proxy !== 'function') {
    throw new Error('kintone.proxy is not available (Plugin 設定画面以外では使えません)');
  }
  if (!args.anthropicApiKey) {
    throw new Error('Anthropic API Key が未入力です');
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

  const [respBody, status] = await kintone.proxy(
    url,
    'POST',
    {
      'X-Anthropic-Api-Key': args.anthropicApiKey,
      'Content-Type': 'application/json',
    },
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
