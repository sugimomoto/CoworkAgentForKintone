// Cowork Agent for kintone — 会話ストリームに残す Artifact 参照タイル
//
// Agent が `create_artifact` ツールで成果物を作成 / 更新した際に表示する
// 「📄 アーティファクト作成: <title> [開く]」のタイル。クリックで ArtifactPane を開く。

import type { ArtifactKind } from '../../../core/artifacts/types';

export interface ArtifactRefMessageProps {
  artifactId: string;
  title: string;
  artifactKind: ArtifactKind;
  onOpen?: (artifactId: string) => void;
}

const KIND_LABEL: Record<ArtifactKind, string> = {
  markdown: 'Markdown',
  code: 'コード',
  json: 'JSON',
  react: 'React',
  mermaid: 'Mermaid',
  svg: 'SVG',
  html: 'HTML',
  'kintone-customize-js': 'kintone JS',
  'kintone-customize-bundle': 'kintone カスタマイズ',
  csv: 'CSV',
  binary: 'ファイル',
  'agent-draft': 'エージェント案',
};

const KIND_EMOJI: Partial<Record<ArtifactKind, string>> = {
  binary: '📎',
  'agent-draft': '🧩',
};

export function ArtifactRefMessage({
  artifactId,
  title,
  artifactKind,
  onOpen,
}: ArtifactRefMessageProps): JSX.Element {
  const handleClick = (): void => {
    if (onOpen) onOpen(artifactId);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      data-artifact-ref
      data-artifact-id={artifactId}
      className={
        'group flex w-full items-center gap-3 rounded-lg border border-slate-200 ' +
        'bg-white px-3 py-2.5 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40 ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400'
      }
    >
      <span className="text-xl leading-none" aria-hidden>
        {KIND_EMOJI[artifactKind] ?? '📄'}
      </span>
      <span className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {artifactKind === 'binary' ? '生成ファイル' : 'アーティファクト'}
        </span>
        <span className="truncate text-sm font-medium text-slate-800">{title}</span>
      </span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
        {KIND_LABEL[artifactKind] ?? artifactKind}
      </span>
      <span className="ml-1 text-xs font-medium text-emerald-700 opacity-0 transition group-hover:opacity-100">
        開く →
      </span>
    </button>
  );
}
