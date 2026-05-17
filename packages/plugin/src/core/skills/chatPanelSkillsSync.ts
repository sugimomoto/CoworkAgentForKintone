// Cowork Agent for kintone — Chat Panel からの skill 同期ヘルパー
//
// kintone.plugin.app.proxy 経由で Worker /skills/sync を呼ぶ。proxyConfig 固定ヘッダで
// X-Anthropic-Api-Key が自動付与されるので、Config 画面用の skillsSyncClient (API Key を
// 引数で渡す版) とは別経路。
//
// 仕様: requirements.md §15.4 / design.md §4.6 / tasklist.md P4.5.2

import { SKILL_BUNDLES, SKILLS_VERSION } from '../../generated/skills-bundle';

import type { CustomSkillInput } from '../../desktop/settings/SkillAddModal';
import type { SkillBundle } from '../../generated/skills-bundle';

/** Worker /skills/sync の応答 (1 件分) */
interface SkillSyncResult {
  name: string;
  skillId: string;
  version: string;
}

interface SkillSyncResponse {
  results: SkillSyncResult[];
}

/**
 * Plugin 同梱 skill (SKILL_BUNDLES) を全部 Anthropic Workspace に同期する。
 * 成功時は Plugin Config の skillsMapping + skillsVersion を保存する。
 */
export async function syncBundledSkillsFromChatPanel(args: {
  pluginId: string;
  workerUrl: string;
}): Promise<void> {
  const { pluginId, workerUrl } = args;
  if (!pluginId) throw new Error('Plugin ID が未取得です');
  if (!workerUrl) throw new Error('Worker URL が未設定です (Plugin Config で設定してください)');
  if (SKILL_BUNDLES.length === 0) throw new Error('同期する skill がありません');

  const parsed = await postSkillsSync(pluginId, workerUrl, SKILL_BUNDLES);
  const mapping: Record<string, { skillId: string; version: string }> = {};
  for (const r of parsed.results) {
    mapping[r.name] = { skillId: r.skillId, version: r.version };
  }
  await updatePluginConfig(pluginId, {
    skillsMapping: JSON.stringify(mapping),
    skillsVersion: SKILLS_VERSION,
  });
}

/**
 * カスタム skill 1 件を Anthropic Workspace に同期する。
 * Worker は display_title マッチで create-or-update する (同名上書きは admin 責任)。
 */
export async function syncCustomSkillFromChatPanel(args: {
  pluginId: string;
  workerUrl: string;
  input: CustomSkillInput;
}): Promise<void> {
  const { pluginId, workerUrl, input } = args;
  if (!pluginId) throw new Error('Plugin ID が未取得です');
  if (!workerUrl) throw new Error('Worker URL が未設定です (Plugin Config で設定してください)');

  const bundle: SkillBundle = {
    name: input.name,
    displayTitle: input.name, // SkillAddModal では displayTitle 入力欄を別途持たないため name を流用
    skillMd: input.skillMd,
  };
  const parsed = await postSkillsSync(pluginId, workerUrl, [bundle]);
  const result = parsed.results[0];
  if (!result) {
    throw new Error('skills/sync が結果を返しませんでした');
  }

  // 既存 skillsMapping を読み込んで追記 (既存 entry を破壊しない)
  const currentConfig = kintone.plugin.app.getConfig(pluginId);
  const currentMapping: Record<string, { skillId: string; version: string }> =
    currentConfig['skillsMapping']
      ? (JSON.parse(currentConfig['skillsMapping']) as Record<
          string,
          { skillId: string; version: string }
        >)
      : {};
  currentMapping[result.name] = { skillId: result.skillId, version: result.version };
  await updatePluginConfig(pluginId, { skillsMapping: JSON.stringify(currentMapping) });
}

// ─── 内部ヘルパー ─────────────────────────────────────────────────────────

async function postSkillsSync(
  pluginId: string,
  workerUrl: string,
  bundles: SkillBundle[],
): Promise<SkillSyncResponse> {
  const url = `${workerUrl.replace(/\/$/, '')}/skills/sync`;
  const body = {
    skills: bundles.map((b) => ({
      name: b.name,
      displayTitle: b.displayTitle,
      skillMd: b.skillMd,
    })),
  };
  const [respBody, status] = await kintone.plugin.app.proxy(
    pluginId,
    url,
    'POST',
    { 'Content-Type': 'application/json' },
    JSON.stringify(body),
  );
  if (status < 200 || status >= 300) {
    throw new Error(`skills/sync が ${status} を返しました: ${respBody.slice(0, 200)}`);
  }
  return JSON.parse(respBody) as SkillSyncResponse;
}

/** kintone.plugin.app.setConfig の Promise ラッパー (既存 config を維持して partial update) */
async function updatePluginConfig(pluginId: string, patch: Record<string, string>): Promise<void> {
  const next: Record<string, string> = {
    ...kintone.plugin.app.getConfig(pluginId),
    ...patch,
  };
  await new Promise<void>((resolve) => {
    kintone.plugin.app.setConfig(next, () => resolve());
  });
}
