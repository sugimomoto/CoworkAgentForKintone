// POST /skills/sync
//
// Plugin が kintone proxy 経由で叩く Anthropic Skills API の中継エンドポイント。
// Plugin は JSON で skill bundle を送り、Worker が multipart/form-data に変換して
// Anthropic に POST する。
//
// kintone.plugin.app.proxy が multipart を直接構築するのは煩雑なので、
// 「JSON で送って Worker で multipart 変換」というパターン (credentials-upsert と同じ思想)。
//
// 動作:
//   1. X-Anthropic-Api-Key (kintone proxy で固定注入) を取得
//   2. body: { skills: [{ name, displayTitle, skillMd }, ...] }
//   3. 各 skill に対し:
//      a. GET /v1/skills?source=custom で既存 skill 一覧を取得
//      b. display_title マッチで既存あり → POST /v1/skills/{id}/versions (新版作成)
//         無し → POST /v1/skills (新規作成)
//   4. 結果として { name → skill_id } マッピングを返却

import { isString, jsonResponse } from './_http';

const ANTHROPIC_BASE = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
const SKILLS_BETA = 'skills-2025-10-02';

interface SkillBundleInput {
  name: string;
  displayTitle: string;
  skillMd: string;
}

interface SyncRequestBody {
  skills: SkillBundleInput[];
}

interface SyncResponseEntry {
  name: string;
  displayTitle: string;
  skillId: string;
  version: string;
  action: 'created' | 'updated';
}

interface SyncResponseBody {
  results: SyncResponseEntry[];
}

interface AnthropicSkillEntry {
  id: string;
  display_title: string;
  latest_version: string;
  source: string;
}

interface AnthropicSkillsListResponse {
  data: AnthropicSkillEntry[];
  has_more?: boolean;
  next_page?: string | null;
}

interface AnthropicSkillCreateResponse {
  id: string;
  display_title: string;
  latest_version: string;
  source: string;
}

interface AnthropicSkillVersionResponse {
  id: string;
  version: string;
  skill_id: string;
}

function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    'X-Api-Key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-beta': SKILLS_BETA,
  };
}

/** Anthropic の custom skill 全件をページネーション展開して取得 */
async function listAllCustomSkills(apiKey: string): Promise<AnthropicSkillEntry[]> {
  const out: AnthropicSkillEntry[] = [];
  let page: string | undefined;
  for (let i = 0; i < 50; i++) {
    // 安全装置: 最大 50 ページ (= 5000 skill)
    const url = new URL(`${ANTHROPIC_BASE}/v1/skills`);
    url.searchParams.set('source', 'custom');
    url.searchParams.set('limit', '100');
    if (page) url.searchParams.set('page', page);
    const res = await fetch(url.toString(), { headers: anthropicHeaders(apiKey) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Anthropic list skills failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as AnthropicSkillsListResponse;
    out.push(...(json.data ?? []));
    if (!json.has_more || !json.next_page) break;
    page = json.next_page;
  }
  return out;
}

/** SKILL.md を 1 ファイル multipart で送信して新 skill を作成 */
async function createSkill(
  apiKey: string,
  bundle: SkillBundleInput,
): Promise<AnthropicSkillCreateResponse> {
  const form = new FormData();
  form.append('display_title', bundle.displayTitle);
  // ファイル名は <name>/SKILL.md とする (Anthropic 側はトップディレクトリを 1 つだけ要求)
  form.append(
    'files[]',
    new Blob([bundle.skillMd], { type: 'text/markdown' }),
    `${bundle.name}/SKILL.md`,
  );
  const res = await fetch(`${ANTHROPIC_BASE}/v1/skills`, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic create skill failed (${res.status}): ${text}`);
  }
  return (await res.json()) as AnthropicSkillCreateResponse;
}

/** 既存 skill に新バージョンをアップロード */
async function createSkillVersion(
  apiKey: string,
  skillId: string,
  bundle: SkillBundleInput,
): Promise<AnthropicSkillVersionResponse> {
  const form = new FormData();
  form.append(
    'files[]',
    new Blob([bundle.skillMd], { type: 'text/markdown' }),
    `${bundle.name}/SKILL.md`,
  );
  const res = await fetch(
    `${ANTHROPIC_BASE}/v1/skills/${encodeURIComponent(skillId)}/versions`,
    {
      method: 'POST',
      headers: anthropicHeaders(apiKey),
      body: form,
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic create skill version failed (${res.status}): ${text}`);
  }
  return (await res.json()) as AnthropicSkillVersionResponse;
}

export async function handleSkillsSync(request: Request): Promise<Response> {
  // 1. 認証
  const apiKey = request.headers.get('X-Anthropic-Api-Key');
  if (!isString(apiKey)) {
    return jsonResponse({ error: 'missing_anthropic_api_key' }, 401);
  }

  // 2. body parse + validate
  let body: SyncRequestBody;
  try {
    body = (await request.json()) as SyncRequestBody;
  } catch {
    return jsonResponse({ error: 'validation_failed', message: 'invalid JSON body' }, 400);
  }
  if (!body || !Array.isArray(body.skills) || body.skills.length === 0) {
    return jsonResponse(
      { error: 'validation_failed', message: 'body.skills must be non-empty array' },
      400,
    );
  }

  // 3. 既存 custom skill を 1 回だけ取得して display_title でマッチング
  let existing: AnthropicSkillEntry[];
  try {
    existing = await listAllCustomSkills(apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: 'anthropic_error', message }, 502);
  }

  const byTitle = new Map<string, AnthropicSkillEntry>();
  for (const s of existing) byTitle.set(s.display_title, s);

  // 4. 各 skill に対し create or new version
  const results: SyncResponseEntry[] = [];
  for (const bundle of body.skills) {
    if (
      !isString(bundle.name) ||
      !isString(bundle.displayTitle) ||
      !isString(bundle.skillMd)
    ) {
      return jsonResponse(
        { error: 'validation_failed', message: 'each skill needs name/displayTitle/skillMd' },
        400,
      );
    }
    const existingSkill = byTitle.get(bundle.displayTitle);
    try {
      if (existingSkill) {
        const v = await createSkillVersion(apiKey, existingSkill.id, bundle);
        results.push({
          name: bundle.name,
          displayTitle: bundle.displayTitle,
          skillId: existingSkill.id,
          version: v.version,
          action: 'updated',
        });
      } else {
        const created = await createSkill(apiKey, bundle);
        results.push({
          name: bundle.name,
          displayTitle: bundle.displayTitle,
          skillId: created.id,
          version: created.latest_version,
          action: 'created',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return jsonResponse(
        { error: 'anthropic_error', message, partialResults: results },
        502,
      );
    }
  }

  const response: SyncResponseBody = { results };
  return jsonResponse(response, 200);
}
