// Cowork Agent for kintone — Chat Panel からの skill 同期ヘルパー
//
// kintone.plugin.app.proxy 経由で Worker /skills/sync を呼ぶ。Worker 側で
// display_title 一致なら新 version、無ければ新規作成という「常に最新を push」挙動。
//
// 永続化は Anthropic Workspace に一元化する設計のため、ここでは
// `kintone.plugin.app.setConfig` を呼ばない (record-list 画面では setConfig が
// そもそも動かない — kintone 公式仕様で「各プラグインの設定画面」のみ利用可)。
// 同期完了後は呼出側が `resolveBundledSkillIds` を再 fetch して UI を更新する。

import { SKILL_BUNDLES } from '../../generated/skills-bundle';

import type { CustomSkillInput } from '../../desktop/settings/SkillAddModal';
import type { SkillBundle } from '../../generated/skills-bundle';

/** Worker /skills/sync の応答 (1 件分) */
interface SkillSyncResult {
  name: string;
  skillId: string;
  version: string;
  action?: 'created' | 'updated';
}

export interface SkillSyncResponse {
  results: SkillSyncResult[];
}

/**
 * Plugin 同梱 skill (SKILL_BUNDLES) を全部 Anthropic Workspace に同期する。
 * Worker は常に新 version (display_title 一致なら) または新規作成を行う。
 */
export async function syncBundledSkillsFromChatPanel(args: {
  pluginId: string;
  workerUrl: string;
}): Promise<SkillSyncResponse> {
  const { pluginId, workerUrl } = args;
  if (!pluginId) throw new Error('Plugin ID が未取得です');
  if (!workerUrl) throw new Error('Worker URL が未設定です (Plugin Config で設定してください)');
  if (SKILL_BUNDLES.length === 0) throw new Error('同期する skill がありません');

  return postSkillsSync(pluginId, workerUrl, SKILL_BUNDLES);
}

/**
 * カスタム skill 1 件を Anthropic Workspace に同期する。
 * Worker は display_title マッチで create-or-update する (同名上書きは admin 責任)。
 */
export async function syncCustomSkillFromChatPanel(args: {
  pluginId: string;
  workerUrl: string;
  input: CustomSkillInput;
}): Promise<SkillSyncResponse> {
  const { pluginId, workerUrl, input } = args;
  if (!pluginId) throw new Error('Plugin ID が未取得です');
  if (!workerUrl) throw new Error('Worker URL が未設定です (Plugin Config で設定してください)');

  const bundle: SkillBundle = {
    name: input.name,
    displayTitle: input.name,
    description: '',
    skillMd: input.skillMd,
  };
  return postSkillsSync(pluginId, workerUrl, [bundle]);
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
