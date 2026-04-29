import { useState } from 'react';

import { copyToClipboard, downloadArtifact } from '../../../core/artifacts/download';

import type { Artifact } from '../../../core/artifacts/types';

export interface ArtifactFooterProps {
  artifact: Artifact;
  showRaw: boolean;
  onToggleRaw: () => void;
}

export function ArtifactFooter({ artifact, showRaw, onToggleRaw }: ArtifactFooterProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    const ok = await copyToClipboard(artifact.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleDownload = (): void => {
    downloadArtifact({
      kind: artifact.kind,
      title: artifact.title,
      id: artifact.id,
      content: artifact.content,
      ...(artifact.language ? { language: artifact.language } : {}),
    });
  };

  return (
    <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-3 py-2">
      <button
        type="button"
        onClick={onToggleRaw}
        aria-pressed={showRaw}
        title="プレビューと原文を切替 (描画できないとき確認用)"
        className={
          'rounded border px-3 py-1 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 ' +
          (showRaw
            ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
        }
      >
        {showRaw ? '◀ プレビューに戻す' : '{ } 本文を表示'}
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded border border-slate-200 bg-white px-3 py-1 text-[12px] font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        {copied ? '✓ コピーしました' : '📋 コピー'}
      </button>
      <button
        type="button"
        onClick={handleDownload}
        className="rounded border border-slate-200 bg-white px-3 py-1 text-[12px] font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        ⬇ ダウンロード
      </button>
    </div>
  );
}
