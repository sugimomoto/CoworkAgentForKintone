import type { Artifact } from '../../../../core/artifacts/types';

export function CodeArtifact({ artifact }: { artifact: Artifact }): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      {artifact.language && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          {artifact.language}
        </div>
      )}
      <pre className="flex-1 overflow-auto bg-slate-900 px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-100">
        <code>{artifact.content}</code>
      </pre>
    </div>
  );
}
