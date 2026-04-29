// Cowork Agent for kintone — Artifact のクリップボード / ダウンロード処理

import type { ArtifactKind } from './types';

interface ExtMime {
  ext: string;
  mime: string;
}

const KIND_EXT: Record<ArtifactKind, ExtMime> = {
  markdown: { ext: 'md', mime: 'text/markdown' },
  code: { ext: 'txt', mime: 'text/plain' },
  json: { ext: 'json', mime: 'application/json' },
  react: { ext: 'jsx', mime: 'text/plain' },
  mermaid: { ext: 'mmd', mime: 'text/plain' },
  svg: { ext: 'svg', mime: 'image/svg+xml' },
  html: { ext: 'html', mime: 'text/html' },
  'kintone-customize-js': { ext: 'js', mime: 'application/javascript' },
  csv: { ext: 'csv', mime: 'text/csv' },
};

/** language ヒントからの拡張子マッピング (kind=code 用)。落ちたら .txt */
const LANG_EXT: Record<string, string> = {
  javascript: 'js',
  js: 'js',
  typescript: 'ts',
  ts: 'ts',
  jsx: 'jsx',
  tsx: 'tsx',
  python: 'py',
  py: 'py',
  ruby: 'rb',
  go: 'go',
  rust: 'rs',
  java: 'java',
  kotlin: 'kt',
  swift: 'swift',
  shell: 'sh',
  bash: 'sh',
  sh: 'sh',
  sql: 'sql',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  html: 'html',
  css: 'css',
  json: 'json',
};

export function extensionFor(kind: ArtifactKind, language?: string): string {
  if (kind === 'code' && language) {
    const lower = language.toLowerCase();
    if (LANG_EXT[lower]) return LANG_EXT[lower];
  }
  return KIND_EXT[kind]?.ext ?? 'txt';
}

export function mimeFor(kind: ArtifactKind): string {
  return KIND_EXT[kind]?.mime ?? 'text/plain';
}

/** ファイル名に使える文字に正規化 (英数 / ハイフン / アンダースコア / 日本語をそのまま許容) */
function sanitizeFileName(title: string, fallbackId: string): string {
  const base = (title || fallbackId).trim().replace(/[\\/:*?"<>|]+/g, '_');
  return base.slice(0, 80) || 'artifact';
}

export interface DownloadParams {
  kind: ArtifactKind;
  title: string;
  id: string;
  language?: string;
  content: string;
}

export function buildDownloadFileName(params: DownloadParams): string {
  return `${sanitizeFileName(params.title, params.id)}.${extensionFor(params.kind, params.language)}`;
}

/** Blob を生成して `<a download>` で保存ダイアログを発火する。SSR 環境では何もしない */
export function downloadArtifact(params: DownloadParams): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob = new Blob([params.content], { type: mimeFor(params.kind) });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildDownloadFileName(params);
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 次のタイミングで revoke (即座に呼ぶと一部ブラウザで保存に失敗する)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** クリップボードへコピー。失敗したら false */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallthrough
  }
  return false;
}
