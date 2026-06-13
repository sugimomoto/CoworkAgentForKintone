// Cowork Agent for kintone — Anthropic Workspace の custom skill 解決ヘルパー
//
// 永続化は Anthropic Workspace に一元化する設計のため、Plugin 側はバージョンも
// skillsMapping も保持しない。bootstrap / Settings View が必要なときに
// `/v1/skills?source=custom` を 1 回叩いて display_title で照合するだけ。
//
// 経路 (Issue #31): 全 Anthropic API 呼出は Worker `/anthropic/*` 経由が標準。
// managed-agents/client.ts の `apiRequest` を使うことで:
//   - apiBase が `${workerUrl}/anthropic` に切替済 (起動時 setApiBase で注入)
//   - transport が kintone.plugin.app.proxy に切替済 (起動時 setTransport で注入)
//   - apiHeaders が anthropic-version / anthropic-beta を自動付与
//
// 返却値の構造:
//   - bundled: Plugin 同梱 (SKILL_BUNDLES) の各 entry に対する skillId 解決結果
//   - custom : SKILL_BUNDLES に無い (= admin が SkillAddModal から追加した) skill
//
// 同期判定:
//   bundled[].skillId が null = 未同期 / not null = synced
//   custom[]            = 常に skillId あり (Anthropic に存在)

import { SKILL_BUNDLES, type SkillBundle } from '../../generated/skills-bundle';
import { apiRequest } from '../managed-agents/client';

/** Skills API 用 beta (apiHeaders で MANAGED_AGENTS_BETA を上書き) */
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
  /** Plugin 同梱 skill 名 (= bundled では SKILL_BUNDLES.name / custom では display_title) */
  name: string;
  /** Anthropic display_title */
  displayTitle: string;
  /** 一致した Anthropic skill_id。未同期なら null */
  skillId: string | null;
  /** Anthropic 側で観測した latest_version (UI 表示用)。未同期なら null */
  latestVersion: string | null;
}

export interface ResolvedSkillSet {
  /** SKILL_BUNDLES と display_title 一致するもの (未同期は skillId=null) */
  bundled: BundledSkillResolution[];
  /** SKILL_BUNDLES に無い = admin が手動追加した custom skill */
  custom: BundledSkillResolution[];
}

/**
 * Anthropic `/v1/skills?source=custom` をページネーション展開し、
 * 同梱 (bundled) と admin 追加 (custom) を分類して返す。1 リクエスト = 1 fetch。
 */
export async function resolveSkillSet(): Promise<ResolvedSkillSet> {
  const existing = await listAllCustomSkills();
  const byTitle = new Map<string, AnthropicSkillEntry>();
  for (const s of existing) byTitle.set(s.display_title, s);

  const bundledTitles = new Set(SKILL_BUNDLES.map((b) => b.displayTitle));

  const bundled = SKILL_BUNDLES.map((b: SkillBundle): BundledSkillResolution => {
    const matched = byTitle.get(b.displayTitle);
    return {
      name: b.name,
      displayTitle: b.displayTitle,
      skillId: matched?.id ?? null,
      latestVersion: matched?.latest_version ?? null,
    };
  });

  const custom = existing
    .filter((s) => !bundledTitles.has(s.display_title))
    .map(
      (s): BundledSkillResolution => ({
        name: s.display_title,
        displayTitle: s.display_title,
        skillId: s.id,
        latestVersion: s.latest_version,
      }),
    );

  return { bundled, custom };
}

/**
 * bootstrap (useSession) 用 — bundled の skill_id 配列だけが欲しいケース。
 * resolveSkillSet().bundled の skillId を取り出した配列を返す。
 */
export async function resolveBundledSkillIds(): Promise<BundledSkillResolution[]> {
  const { bundled } = await resolveSkillSet();
  return bundled;
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
