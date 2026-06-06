// Cowork Agent for kintone — Chat Panel からの skill 同期ヘルパー
//
// kintone.plugin.app.proxy 経由で Worker /skills/sync を呼ぶ。Worker 側で
// display_title 一致なら新 version、無ければ新規作成という「常に最新を push」挙動。
//
// 永続化は Anthropic Workspace に一元化する設計のため、ここでは
// `kintone.plugin.app.setConfig` を呼ばない (record-list 画面では setConfig が
// そもそも動かない — kintone 公式仕様で「各プラグインの設定画面」のみ利用可)。
// 同期完了後は呼出側が `resolveBundledSkillIds` を再 fetch して UI を更新する。

import { apiRequest } from '../managed-agents/client';
import { SKILL_BUNDLES } from '../../generated/skills-bundle';

import type { CustomSkillInput } from '../../desktop/settings/SkillAddModal';
import type { SkillBundle } from '../../generated/skills-bundle';

/** Skills API 用 beta (apiHeaders で MANAGED_AGENTS_BETA を上書き) */
const SKILLS_BETA = 'skills-2025-10-02';

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
  return postSkillsSync(pluginId, workerUrl, [bundle], input.files);
}

/**
 * カスタム skill を編集する (#30 V2)。既存の syncCustomSkillFromChatPanel をそのまま
 * 流用する — Worker /skills/sync が **display_title 一致なら新 version 作成** という
 * 動作をするため、name 同一のまま skillMd だけ更新すれば自動的に edit になる。
 *
 * 別名 export を提供しているのは呼出側 (SettingsViewBound の onEditCustomSkill) の
 * 意図が読みやすくなるため。実装は同じ。
 */
export async function editCustomSkillFromChatPanel(args: {
  pluginId: string;
  workerUrl: string;
  input: CustomSkillInput;
}): Promise<SkillSyncResponse> {
  return syncCustomSkillFromChatPanel(args);
}

/**
 * カスタム skill を完全削除する (#30 V2)。
 * `DELETE /v1/skills/{id}` を Worker `/anthropic/*` passthrough 経由で叩く。
 *
 * 注意: skill を attach している既存 Agent がいる場合、Agent 側の skills 配列に
 * dangling reference が残る可能性がある。呼出側で admin に警告ダイアログを出すこと。
 */
export async function deleteCustomSkillFromChatPanel(args: {
  skillId: string;
}): Promise<void> {
  if (!args.skillId) throw new Error('skillId が空です');
  await apiRequest('DELETE', `/v1/skills/${encodeURIComponent(args.skillId)}`, undefined, {
    'anthropic-beta': SKILLS_BETA,
  });
}

// ─── 内部ヘルパー ─────────────────────────────────────────────────────────

async function postSkillsSync(
  pluginId: string,
  workerUrl: string,
  bundles: SkillBundle[],
  /**
   * V2 #30: zip/.skill 展開で得られた多ファイル bundle。指定時は最初の bundle に紐付ける
   * (= カスタム skill 投入は常に 1 bundle 想定なので問題ない)。
   */
  files?: Array<{ path: string; content: string }>,
): Promise<SkillSyncResponse> {
  const url = `${workerUrl.replace(/\/$/, '')}/skills/sync`;
  const body = {
    skills: bundles.map((b, idx) => {
      const entry: { name: string; displayTitle: string; skillMd?: string; files?: typeof files } = {
        name: b.name,
        displayTitle: b.displayTitle,
      };
      // files[] があり、かつ最初の bundle (custom skill 投入時) のみ
      if (idx === 0 && Array.isArray(files) && files.length > 0) {
        entry.files = files;
      } else {
        entry.skillMd = b.skillMd;
      }
      return entry;
    }),
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
