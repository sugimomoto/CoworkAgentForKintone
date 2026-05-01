import { useState } from 'react';

import { triggerBrowserDownload } from '../../../../core/artifacts/download';
import { warn } from '../../../../core/debug';
import { getPluginConfig } from '../../../../core/kintone/pluginConfig';
import { downloadSessionFile } from '../../../../core/managed-agents/files';
import { useChatStore } from '../../../../store/chatStore';

import type { Artifact } from '../../../../core/artifacts/types';

const FILE_EMOJI_BY_MIME_PREFIX: Array<[RegExp, string]> = [
  [/^application\/pdf/, '📄'],
  [/^application\/vnd\.openxmlformats-officedocument\.wordprocessingml/, '📝'],
  [/^application\/vnd\.openxmlformats-officedocument\.spreadsheetml/, '📊'],
  [/^application\/vnd\.openxmlformats-officedocument\.presentationml/, '📽️'],
  [/^application\/zip/, '📦'],
  [/^image\//, '🖼️'],
  [/^video\//, '🎬'],
  [/^audio\//, '🎵'],
  [/^text\//, '📃'],
];

function pickEmoji(mime: string): string {
  for (const [re, emoji] of FILE_EMOJI_BY_MIME_PREFIX) {
    if (re.test(mime)) return emoji;
  }
  return '📁';
}

function formatBytes(n: number | undefined): string {
  if (n === undefined) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function BinaryArtifact({ artifact }: { artifact: Artifact }): JSX.Element {
  const filename = artifact.filename ?? artifact.title;
  const mime = artifact.mime ?? 'application/octet-stream';
  const fileId = artifact.fileId;
  const emoji = pickEmoji(mime);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pluginId = useChatStore((s) => s.pluginId);

  const handleDownload = async (): Promise<void> => {
    if (!fileId || downloading) return;
    if (!pluginId) {
      setError('Plugin ID が未設定のためダウンロードできません');
      return;
    }
    const cfg = getPluginConfig(pluginId);
    if (!cfg.workerUrl) {
      setError('Worker URL が未設定のためダウンロードできません (プラグイン設定)');
      return;
    }
    setError(null);
    setDownloading(true);
    try {
      const blob = await downloadSessionFile({
        pluginId,
        workerUrl: cfg.workerUrl,
        fileId,
      });
      triggerBrowserDownload(blob, filename);
    } catch (err) {
      warn('BinaryArtifact', 'download failed', err);
      setError(err instanceof Error ? err.message : 'ダウンロードに失敗しました');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-50 px-6 py-10">
      <div className="text-[64px] leading-none">{emoji}</div>
      <div className="text-center">
        <div className="break-all text-[15px] font-semibold text-slate-800">{filename}</div>
        <div className="mt-1 font-mono text-[11px] text-slate-500">{mime}</div>
        <div className="mt-1 text-[12px] text-slate-600">{formatBytes(artifact.sizeBytes)}</div>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={!fileId || downloading}
        className="rounded-md bg-emerald-600 px-4 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {downloading ? '⏳ ダウンロード中…' : '⬇ ダウンロード'}
      </button>
      {error && (
        <p className="max-w-md rounded border border-rose-300 bg-rose-50 px-3 py-2 text-center text-[11px] leading-relaxed text-rose-800">
          ⚠ {error}
        </p>
      )}
      <p className="max-w-md text-center text-[11px] leading-relaxed text-slate-500">
        このファイルは Anthropic Files API のセッションスコープに保存されています。
        セッション期間中はいつでも再ダウンロードできます。
      </p>
    </div>
  );
}
