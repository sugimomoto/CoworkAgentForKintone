// Cowork Agent for kintone — Plugin 同梱 skill の Anthropic 側 skill_id 解決ヘルパー
//
// 永続化は Anthropic Workspace に一元化する設計のため、Plugin 側はバージョンも
// skillsMapping も保持しない。bootstrap / Settings View が必要なときに
// `/v1/skills?source=custom` を 1 回叩いて display_title で match するだけ。
//
// 経路 (Issue #31): 全 Anthropic API 呼出は Worker `/anthropic/*` 経由が標準。
// managed-agents/client.ts の `apiRequest` を使うことで:
//   - apiBase が `${workerUrl}/anthropic` に切替済 (起動時 setApiBase で注入)
//   - transport が kintone.plugin.app.proxy に切替済 (起動時 setTransport で注入)
//   - apiHeaders が anthropic-version / anthropic-beta を自動付与
//
// 仕様:
//   - SKILL_BUNDLES[].displayTitle と Anthropic 側 display_title が一致するものを採用
//   - 一致がなければ skillId=null (= 未同期、SettingsViewBound が UI に反映する)
//   - バージョン比較はしない。最新版がほしいなら admin が「同期」ボタンを押す
//     (Worker /skills/sync が常に新 version を作る)

import { apiRequest } from '../managed-agents/client';
import { SKILL_BUNDLES, type SkillBundle } from '../../generated/skills-bundle';

/** Skills API 用 beta (apiHeaders で managed-agents-* と comma-join される) */
const SKILLS_BETA = 'skills-2025-10-02';

interface AnthropicSkillEntry {
  id: string;
  display_title: string;
  latest_version: string;
  source: string;
}

interface AnthropicSkillsListResponse {
  data?: AnthropicSkillEntry[];
  has_more?: boolean;
  next_page?: string | null;
}

export interface BundledSkillResolution {
  /** Plugin 同梱 skill 名 (例: 'kintone-customize-js') */
  name: string;
  /** Anthropic display_title (現状 name と同じ) */
  displayTitle: string;
  /** 一致した Anthropic skill_id。未同期なら null */
  skillId: string | null;
  /** Anthropic 側で観測した latest_version (UI 表示用)。未同期なら null */
  latestVersion: string | null;
}

/**
 * Anthropic `/v1/skills?source=custom` をページネーション展開して
 * SKILL_BUNDLES と display_title で照合し、結果を返す。
 *
 * 呼出経路は managed-agents/client の apiRequest なので、起動時に
 * setApiBase / setTransport で Worker 経由に切替済の前提。
 */
export async function resolveBundledSkillIds(): Promise<BundledSkillResolution[]> {
  const existing = await listAllCustomSkills();
  const byTitle = new Map<string, AnthropicSkillEntry>();
  for (const s of existing) byTitle.set(s.display_title, s);

  return SKILL_BUNDLES.map((b: SkillBundle): BundledSkillResolution => {
    const matched = byTitle.get(b.displayTitle);
    return {
      name: b.name,
      displayTitle: b.displayTitle,
      skillId: matched?.id ?? null,
      latestVersion: matched?.latest_version ?? null,
    };
  });
}

/** ページネーション全展開 (安全装置: 最大 50 ページ = 5000 skill) */
async function listAllCustomSkills(): Promise<AnthropicSkillEntry[]> {
  const out: AnthropicSkillEntry[] = [];
  let page: string | null = null;
  for (let i = 0; i < 50; i++) {
    const params = new URLSearchParams({ source: 'custom', limit: '100' });
    if (page) params.set('page', page);
    const resp = await apiRequest<AnthropicSkillsListResponse>(
      'GET',
      `/v1/skills?${params.toString()}`,
      undefined,
      { 'anthropic-beta': SKILLS_BETA },
    );
    if (!resp || !Array.isArray(resp.data)) break;
    out.push(...resp.data);
    if (!resp.has_more || !resp.next_page) break;
    page = resp.next_page;
  }
  return out;
}
