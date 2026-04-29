import Markdown from 'markdown-to-jsx';

import type { Artifact } from '../../../../core/artifacts/types';

const OPTIONS = {
  overrides: {
    h1: { props: { className: 'mt-3 mb-2 text-lg font-semibold text-slate-900' } },
    h2: { props: { className: 'mt-3 mb-2 text-base font-semibold text-slate-900' } },
    h3: { props: { className: 'mt-2 mb-1 text-sm font-semibold text-slate-900' } },
    p: { props: { className: 'my-2 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800' } },
    ul: { props: { className: 'my-2 ml-5 list-disc text-[13px] text-slate-800' } },
    ol: { props: { className: 'my-2 ml-5 list-decimal text-[13px] text-slate-800' } },
    li: { props: { className: 'my-0.5' } },
    strong: { props: { className: 'font-semibold' } },
    em: { props: { className: 'italic' } },
    code: { props: { className: 'rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px]' } },
    pre: {
      props: {
        className:
          'my-2 overflow-x-auto rounded bg-slate-50 px-3 py-2 font-mono text-[12px] text-slate-800',
      },
    },
    blockquote: {
      props: { className: 'my-2 border-l-2 border-slate-300 pl-3 text-slate-600' },
    },
    a: {
      props: {
        className: 'text-emerald-700 underline',
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    },
    table: { props: { className: 'my-2 border-collapse text-[12px]' } },
    th: {
      props: {
        className: 'border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold',
      },
    },
    td: { props: { className: 'border border-slate-200 px-2 py-1 align-top' } },
    hr: { props: { className: 'my-3 border-slate-200' } },
  },
  disableParsingRawHTML: true,
} as const;

export function MarkdownArtifact({ artifact }: { artifact: Artifact }): JSX.Element {
  return (
    <div className="px-4 py-3">
      <Markdown options={OPTIONS}>{artifact.content}</Markdown>
    </div>
  );
}
