// Cowork Agent for kintone — Artifact 型定義
//
// Issue #14 Step 1 (Foundation)。Agent が `create_artifact` Custom Tool で生成する
// 「再利用可能な成果物」を表す。chatStore.artifacts に Map<id, Artifact> として保管。

/**
 * Step 1 で実装する kind: markdown / code / json / react
 * Step 2 以降向けの kind: mermaid / svg / html / kintone-customize-js / csv
 *   (受け取ったら PlaceholderArtifact で raw 表示する)
 */
export type ArtifactKind =
  | 'markdown'
  | 'code'
  | 'json'
  | 'react'
  | 'mermaid'
  | 'svg'
  | 'html'
  | 'kintone-customize-js'
  | 'csv';

export const SUPPORTED_ARTIFACT_KINDS: readonly ArtifactKind[] = [
  'markdown',
  'code',
  'json',
  'react',
  'mermaid',
  'svg',
  'html',
  'kintone-customize-js',
  'csv',
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
  'csv',
]);

export interface Artifact {
  /** Agent が指定する安定識別子 (同じ id で再呼出 = 更新) */
  id: string;
  kind: ArtifactKind;
  title: string;
  /** kind=code 時の言語ヒント (任意) */
  language?: string;
  /** 本文 */
  content: string;
  /** 1 行要約 (任意) */
  summary?: string;
  /** 初回作成 epoch ms */
  createdAt: number;
  /** 最終更新 epoch ms */
  updatedAt: number;
  /** 同 id で update されるごとに +1 */
  version: number;
}

/** create_artifact ツールの入力 (Agent → plugin) */
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
 * 不正なら null を返す (呼び出し側で error result を返す)。
 */
export function parseCreateArtifactInput(raw: unknown): CreateArtifactInput | null {
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const kind = typeof o.kind === 'string' ? o.kind : '';
  const title = typeof o.title === 'string' ? o.title : '';
  const content = typeof o.content === 'string' ? o.content : '';
  if (!id || !title || !content) return null;
  if (!(SUPPORTED_ARTIFACT_KINDS as readonly string[]).includes(kind)) return null;
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
