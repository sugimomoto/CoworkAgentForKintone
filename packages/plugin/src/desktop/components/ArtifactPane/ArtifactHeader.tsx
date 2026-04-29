import type { Artifact, ArtifactKind } from '../../../core/artifacts/types';

const KIND_LABEL: Record<ArtifactKind, string> = {
  markdown: 'Markdown',
  code: 'Code',
  json: 'JSON',
  react: 'React',
  mermaid: 'Mermaid',
  svg: 'SVG',
  html: 'HTML',
  'kintone-customize-js': 'kintone JS',
  csv: 'CSV',
};

export interface ArtifactHeaderProps {
  artifact: Artifact;
  /** 切り替え用の全 Artifact 配列 (新しい順) */
  allArtifacts: Artifact[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function ArtifactHeader({
  artifact,
  allArtifacts,
  onSelect,
  onClose,
}: ArtifactHeaderProps): JSX.Element {
  const showSelector = allArtifacts.length > 1;
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        {KIND_LABEL[artifact.kind] ?? artifact.kind}
      </span>
      {showSelector ? (
        <select
          aria-label="アーティファクトを選択"
          className="flex-1 truncate rounded border border-slate-200 bg-white px-2 py-1 text-[13px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          value={artifact.id}
          onChange={(e) => onSelect(e.target.value)}
        >
          {allArtifacts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      ) : (
        <h2 className="flex-1 truncate text-[13px] font-semibold text-slate-800" title={artifact.title}>
          {artifact.title}
        </h2>
      )}
      {artifact.version > 1 && (
        <span className="text-[10px] font-medium text-slate-400">v{artifact.version}</span>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="アーティファクトペインを閉じる"
        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path
            d="M3 3l10 10M13 3L3 13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
