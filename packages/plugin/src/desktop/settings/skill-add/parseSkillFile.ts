// カスタム skill ファイルの解析 (React 非依存の純関数群)。
// .md は frontmatter 抽出、.zip / .skill は JSZip 展開して CustomSkillInput を組み立てる。
// バリデーション失敗は Error を throw する (UI 側で catch して表示)。

import JSZip from 'jszip';

import type { CustomSkillInput, SkillFileEntry } from '../../../core/skills/types';

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const ACCEPT_EXT = ['md', 'zip', 'skill'];

/** zip/.skill 展開後に skill 1 件として認める SKILL.md の最大パス深さ */
const MAX_SKILL_MD_DEPTH = 2;

/**
 * zip 内のうち skill 本体として扱う text ファイルの拡張子。これ以外 (.png 等のバイナリ)
 * は無視する。Anthropic Skills API はテキストのみ受け付ける。
 */
const TEXT_FILE_EXT = new Set(['md', 'markdown', 'txt', 'json', 'yaml', 'yml', 'js', 'ts', 'sh', 'py']);

/**
 * 受け取った File を検証して CustomSkillInput に変換する。
 * - サイズ上限 / 拡張子チェック
 * - .md / .markdown: frontmatter から name/description を抽出
 * - .zip / .skill: JSZip でブラウザ展開
 * 検証エラーは Error を throw する。
 */
export async function parseSkillFile(file: File): Promise<CustomSkillInput> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`ファイルサイズが上限 (${MAX_FILE_BYTES / 1024 / 1024} MB) を超えています`);
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ACCEPT_EXT.includes(ext)) {
    throw new Error(
      `サポートされていない拡張子です: .${ext} (受付: ${ACCEPT_EXT.map((e) => '.' + e).join(' / ')})`,
    );
  }
  if (ext === 'md' || ext === 'markdown') {
    const text = await file.text();
    const meta = parseFrontmatter(text);
    if (!meta.name) {
      throw new Error('SKILL.md の frontmatter に name が見つかりません');
    }
    return { name: meta.name, description: meta.description ?? '', skillMd: text };
  }
  // .zip / .skill
  return extractSkillBundle(file);
}

/**
 * 簡易 YAML frontmatter パーサ (js-yaml 依存なし)。
 * `---` ... `---` ブロックから name / description を抽出する。
 * 値はクォート (` " ` または ` ' `) があれば剥がす。
 */
export function parseFrontmatter(text: string): { name?: string; description?: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const body = match[1] ?? '';
  const result: { name?: string; description?: string } = {};
  for (const line of body.split(/\r?\n/)) {
    const m = /^(\w+):\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1];
    let value = m[2] ?? '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key === 'name') result.name = value;
    if (key === 'description') result.description = value;
  }
  return result;
}

/**
 * .zip / .skill ファイルをブラウザ上で展開して CustomSkillInput を組み立てる。
 *
 * 想定構造 (Claude Code 互換):
 *   <name>/SKILL.md           (必須、frontmatter から name/description 抽出)
 *   <name>/references/*.md    (任意)
 *   <name>/scripts/*.sh       (任意)
 *
 * もしくは root flat:
 *   SKILL.md / references/* / scripts/*
 *
 * いずれの形でも `<name>/` prefix に正規化してから返す。
 */
export async function extractSkillBundle(
  file: File | Blob | ArrayBuffer | Uint8Array,
): Promise<CustomSkillInput> {
  const buf =
    file instanceof ArrayBuffer || file instanceof Uint8Array ? file : await blobToArrayBuffer(file);
  const zip = await JSZip.loadAsync(buf);

  // 1. SKILL.md を探す (深さ MAX_SKILL_MD_DEPTH 以内、最浅優先)
  const skillMdEntry = findSkillMd(zip);
  if (!skillMdEntry) {
    throw new Error('zip 内に SKILL.md が見つかりません');
  }

  const skillMdText = await skillMdEntry.async('string');
  const meta = parseFrontmatter(skillMdText);
  if (!meta.name) {
    throw new Error('SKILL.md の frontmatter に name が見つかりません');
  }
  const name = meta.name;

  // 2. SKILL.md が <name>/SKILL.md の形なら rootPrefix を抽出、root flat なら空
  const rootPrefix = skillMdEntry.name.includes('/')
    ? skillMdEntry.name.slice(0, skillMdEntry.name.lastIndexOf('/') + 1)
    : '';

  // 3. zip 内のテキストファイルだけ収集 (バイナリ・空ディレクトリは捨てる)
  const files: SkillFileEntry[] = [];
  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    // rootPrefix の外 (= 同梱の README やメタファイル) はスキップ
    if (rootPrefix && !entry.name.startsWith(rootPrefix)) continue;
    const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
    if (!TEXT_FILE_EXT.has(ext)) continue;
    // macOS の __MACOSX や .DS_Store 等は除外
    if (entry.name.includes('__MACOSX/') || entry.name.endsWith('.DS_Store')) continue;
    const content = await entry.async('string');
    // path は <name>/relative-path の形に正規化
    const relative = rootPrefix ? entry.name.slice(rootPrefix.length) : entry.name;
    files.push({ path: `${name}/${relative}`, content });
  }

  if (files.length === 0 || !files.some((f) => f.path === `${name}/SKILL.md`)) {
    throw new Error('zip 内に SKILL.md が見つかりません (展開後)');
  }

  return { name, description: meta.description ?? '', skillMd: skillMdText, files };
}

/** Blob → ArrayBuffer (JSDOM 環境では blob.arrayBuffer() が無いので FileReader でフォールバック) */
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/** zip 内から最浅の SKILL.md (拡張子大小区別なし) を探す */
function findSkillMd(zip: JSZip): JSZip.JSZipObject | null {
  let best: { entry: JSZip.JSZipObject; depth: number } | null = null;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const base = entry.name.split('/').pop() ?? '';
    if (base.toLowerCase() !== 'skill.md') continue;
    const depth = entry.name.split('/').length - 1;
    if (depth > MAX_SKILL_MD_DEPTH) continue;
    if (!best || depth < best.depth) best = { entry, depth };
  }
  return best?.entry ?? null;
}
