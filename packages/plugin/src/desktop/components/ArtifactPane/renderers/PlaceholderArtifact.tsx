import type { Artifact } from '../../../../core/artifacts/types';

export function PlaceholderArtifact({ artifact }: { artifact: Artifact }): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-800">
        この種類 (<span className="font-semibold">{artifact.kind}</span>) は専用レンダラ未対応のため原文を表示しています。
      </div>
      <pre className="flex-1 overflow-auto bg-slate-50 px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-800">
        <code>{artifact.content}</code>
      </pre>
    </div>
  );
}
