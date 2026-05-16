// kintone.plugin.app.getConfig からプラグイン設定値を読み取るヘルパ。
// admin が ConfigScreen で保存した値を end-user 側 JS から参照する用途。
//
// secret 値 (Anthropic API Key / OAuth client_secret) は setProxyConfig 側に
// 固定ヘッダで保管され、Plugin JS からは getConfig で読み出せない。
// ここから取れるのは「URL や client_id など公開しても問題ない設定」のみ。

const CONFIG_KEY_WORKER_URL = 'workerUrl';
const CONFIG_KEY_OAUTH_CLIENT_ID = 'oauthClientId';
const CONFIG_KEY_SKILLS_MAPPING = 'skillsMapping';
const CONFIG_KEY_SKILLS_VERSION = 'skillsVersion';

/**
 * Skill 同期で得た mapping: skill name → Anthropic 側の skill_id。
 * 値は workspace スコープなので、ConfigScreen で API Key (= workspace) が変わったら
 * 同期し直す必要がある。
 */
export type SkillsMapping = Record<string, { skillId: string; version: string }>;

export interface PluginConfig {
  workerUrl: string | null;
  oauthClientId: string | null;
  /** kintone 固有 custom skill の skill_id mapping (Issue #30) */
  skillsMapping: SkillsMapping;
  /**
   * 同期済 skill bundle の SKILLS_VERSION (sha256 short hash)。
   * resolveAgent.ts が metadata.skillsVersion に含めて、内容変化で別 Agent 扱いにする。
   */
  skillsVersion: string | null;
}

const EMPTY_CONFIG: PluginConfig = {
  workerUrl: null,
  oauthClientId: null,
  skillsMapping: {},
  skillsVersion: null,
};

/**
 * Plugin ID 配下の通常 config を取得する。
 */
export function getPluginConfig(pluginId: string): PluginConfig {
  if (typeof kintone === 'undefined' || !kintone) {
    return { ...EMPTY_CONFIG };
  }
  const raw = kintone.plugin.app.getConfig(pluginId) ?? {};
  const pickStr = (key: string): string | null => {
    const v = raw[key];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };
  const skillsRaw = pickStr(CONFIG_KEY_SKILLS_MAPPING);
  let skillsMapping: SkillsMapping = {};
  if (skillsRaw) {
    try {
      const parsed = JSON.parse(skillsRaw) as unknown;
      if (parsed && typeof parsed === 'object') {
        // 軽い shape チェック
        const out: SkillsMapping = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (
            v &&
            typeof v === 'object' &&
            typeof (v as { skillId?: unknown }).skillId === 'string' &&
            typeof (v as { version?: unknown }).version === 'string'
          ) {
            out[k] = {
              skillId: (v as { skillId: string }).skillId,
              version: (v as { version: string }).version,
            };
          }
        }
        skillsMapping = out;
      }
    } catch {
      // 不正な JSON は無視
    }
  }
  return {
    workerUrl: pickStr(CONFIG_KEY_WORKER_URL),
    oauthClientId: pickStr(CONFIG_KEY_OAUTH_CLIENT_ID),
    skillsMapping,
    skillsVersion: pickStr(CONFIG_KEY_SKILLS_VERSION),
  };
}

export const PLUGIN_CONFIG_KEYS = {
  WORKER_URL: CONFIG_KEY_WORKER_URL,
  OAUTH_CLIENT_ID: CONFIG_KEY_OAUTH_CLIENT_ID,
  SKILLS_MAPPING: CONFIG_KEY_SKILLS_MAPPING,
  SKILLS_VERSION: CONFIG_KEY_SKILLS_VERSION,
} as const;
