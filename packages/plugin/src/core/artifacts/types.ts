// Cowork Agent for kintone — Artifact 型定義
//
// Issue #14 Step 1 (Foundation)。Agent が `create_artifact` Custom Tool で生成する
// 「再利用可能な成果物」を表す。chatStore.artifacts に Map<id, Artifact> として保管。

/**
 * Step 1 で実装する kind: markdown / code / json / react
 * Step 2 以降: mermaid / svg / html / csv
 * #20 V2 Phase 1: `kintone-customize-bundle` — kintone カスタマイズの複数ファイル束。
 *   旧 `kintone-customize-js` は legacy として残し (V1 までに生成された artifact 表示用)、
 *   新規生成は bundle を使う。
 */
export type ArtifactKind =
  | 'markdown'
  | 'code'
  | 'json'
  | 'react'
  | 'mermaid'
  | 'svg'
  | 'html'
  | 'kintone-customize-js'        // legacy (V1)、表示のみサポート
  | 'kintone-customize-bundle'    // V2 Phase 1 で導入、多ファイル束
  | 'csv'
  | 'binary';

export const SUPPORTED_ARTIFACT_KINDS: readonly ArtifactKind[] = [
  'markdown',
  'code',
  'json',
  'react',
  'mermaid',
  'svg',
  'html',
  'kintone-customize-js',
  'kintone-customize-bundle',
  'csv',
  'binary',
] as const;

/** 本フェーズで「ちゃんと描画できる」 kind */
export const RENDERABLE_ARTIFACT_KINDS = new Set<ArtifactKind>([
  'markdown',
  'code',
  'json',
  'react',
  'mermaid',
  'svg',
  'html',
  'kintone-customize-bundle',
  'csv',
  'binary',
]);

/**
 * `binary` 以外の create_artifact 用 kind 一覧。Agent が create_artifact で指定できるのはこれだけ。
 * `binary` artifact は plugin が Files API から自動生成するため Agent は呼ばない。
 * V2 Phase 1 以降、Customizer Agent は新規 customize 生成では `kintone-customize-bundle` を使う
 * (`kintone-customize-js` は legacy だが、Agent が誤って指定しないようリストには残す)。
 */
export const AGENT_CREATABLE_ARTIFACT_KINDS: readonly ArtifactKind[] = [
  'markdown',
  'code',
  'json',
  'react',
  'mermaid',
  'svg',
  'html',
  'kintone-customize-js',
  'kintone-customize-bundle',
  'csv',
] as const;

// ─── kintone-customize-bundle 専用型定義 (#20 V2 Phase 1) ───────────────────────

/** customize.json 配下の単一 file path (Phase 1 では desktop.js のみ実用、Phase 2 で 4 path 解禁) */
export type CustomizeFilePath = 'desktop.js' | 'mobile.js' | 'desktop.css' | 'mobile.css';

/** kintone-customize-bundle artifact の content (JSON.stringify して Artifact.content に格納) */
export interface CustomizeBundleContent {
  files: Array<{
    path: CustomizeFilePath;
    content: string;
  }>;
}

/** Phase 1 で Customizer Agent に生成を許可する path (= desktop.js のみ) */
export const PHASE1_ALLOWED_CUSTOMIZE_PATHS: readonly CustomizeFilePath[] = ['desktop.js'];

/** Phase 2 以降で許可される全 path */
export const ALL_CUSTOMIZE_PATHS: readonly CustomizeFilePath[] = [
  'desktop.js',
  'mobile.js',
  'desktop.css',
  'mobile.css',
];

/**
 * Artifact (kind=kintone-customize-bundle) から bundle content を取り出す。
 * 不正な JSON や型不整合の場合は null を返す。
 */
export function getBundleContent(artifact: Artifact): CustomizeBundleContent | null {
  if (artifact.kind !== 'kintone-customize-bundle') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(artifact.content);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const files = (parsed as { files?: unknown }).files;
  if (!Array.isArray(files)) return null;
  const validFiles: CustomizeBundleContent['files'] = [];
  const allowedPaths = new Set<string>(ALL_CUSTOMIZE_PATHS);
  for (const f of files) {
    if (!f || typeof f !== 'object') continue;
    const p = (f as { path?: unknown }).path;
    const c = (f as { content?: unknown }).content;
    if (typeof p !== 'string' || typeof c !== 'string') continue;
    if (!allowedPaths.has(p)) continue;
    validFiles.push({ path: p as CustomizeFilePath, content: c });
  }
  return { files: validFiles };
}

/**
 * bundle content を Artifact.content (JSON 文字列) に直す。
 * Agent から受け取った content のバリデーション / 新規 artifact 作成時に使う。
 */
export function serializeBundleContent(bundle: CustomizeBundleContent): string {
  return JSON.stringify(bundle);
}

export interface Artifact {
  /** 安定識別子。create_artifact 由来は Agent 指定、binary 由来は `file:<file_id>` を使う */
  id: string;
  kind: ArtifactKind;
  title: string;
  /** kind=code 時の言語ヒント (任意) */
  language?: string;
  /** 本文 (kind=binary 以外で使用)。kind=binary では空文字 */
  content: string;
  /** 1 行要約 (任意) */
  summary?: string;
  /** kind=binary 時の Anthropic Files API の file_id (DL に使う) */
  fileId?: string;
  /** kind=binary 時のファイル名 (Anthropic から返ってきた filename) */
  filename?: string;
  /** kind=binary 時の MIME */
  mime?: string;
  /** kind=binary 時のバイト数 (Anthropic から返ってきた size_bytes) */
  sizeBytes?: number;
  /** 初回作成 epoch ms */
  createdAt: number;
  /** 最終更新 epoch ms */
  updatedAt: number;
  /** 同 id で update されるごとに +1 */
  version: number;
}

/** create_artifact ツールの入力 (Agent → plugin)。binary kind は受け付けない。 */
export interface CreateArtifactInput {
  id: string;
  kind: ArtifactKind;
  title: string;
  language?: string;
  content: string;
  summary?: string;
}

/**
 * Agent からの input を検証する。
 * 必須フィールド (id / kind / title / content) のチェックと kind の正規化。
 * binary kind は Agent 経由では作らない (Files API で自動検出する) ため reject する。
 */
export function parseCreateArtifactInput(raw: unknown): CreateArtifactInput | null {
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const kind = typeof o.kind === 'string' ? o.kind : '';
  const title = typeof o.title === 'string' ? o.title : '';
  const content = typeof o.content === 'string' ? o.content : '';
  if (!id || !title || !content) return null;
  if (!(AGENT_CREATABLE_ARTIFACT_KINDS as readonly string[]).includes(kind)) return null;
  const out: CreateArtifactInput = {
    id,
    kind: kind as ArtifactKind,
    title,
    content,
  };
  if (typeof o.language === 'string' && o.language.length > 0) out.language = o.language;
  if (typeof o.summary === 'string' && o.summary.length > 0) out.summary = o.summary;
  return out;
}

/** 既知 file_id から binary artifact ID を組み立てる (artifact map のキーに使う) */
export function binaryArtifactIdFromFileId(fileId: string): string {
  return `file:${fileId}`;
}
