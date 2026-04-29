import type { Artifact } from '../../../../core/artifacts/types';

function tryFormat(content: string): { ok: true; pretty: string } | { ok: false; raw: string } {
  try {
    const parsed = JSON.parse(content);
    return { ok: true, pretty: JSON.stringify(parsed, null, 2) };
  } catch {
    return { ok: false, raw: content };
  }
}

export function JsonArtifact({ artifact }: { artifact: Artifact }): JSX.Element {
  const result = tryFormat(artifact.content);
  return (
    <div className="flex h-full flex-col">
      {!result.ok && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] text-amber-800">
          ⚠️ JSON として解析できません。原文を表示しています。
        </div>
      )}
      <pre className="flex-1 overflow-auto bg-slate-50 px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-800">
        <code>{result.ok ? result.pretty : result.raw}</code>
      </pre>
    </div>
  );
}
