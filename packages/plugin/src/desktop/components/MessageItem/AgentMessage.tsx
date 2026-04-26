// Cowork Agent for kintone — Agent 発話バブル
//
// markdown-to-jsx で見出し / リスト / コード / 表 / リンクをレンダリング。
// 不完全な Markdown (ストリーミング途中) でも壊れない (= "streaming markdown")。
// デザイン仕様: docs/functional-design.md §5.6.3

import Markdown from 'markdown-to-jsx';

import { AgentAvatar } from './AgentAvatar';

export interface AgentMessageProps {
  text: string;
}

const MARKDOWN_OPTIONS = {
  // 不明タグや HTML を勝手に埋め込まれないよう、許可タグを既定 (string | TextNode) に絞る方向で。
  // markdown-to-jsx は raw HTML を default で string 扱いにせずパースするので、
  // 危険なタグは overrides で握りつぶすか forceBlock を控える。
  // 個別 element に Tailwind を当てて kintone UI に馴染ませる。
  overrides: {
    h1: { props: { className: 'mt-[6px] mb-[2px] text-[15px] font-semibold' } },
    h2: { props: { className: 'mt-[6px] mb-[2px] text-[14px] font-semibold' } },
    h3: { props: { className: 'mt-[4px] mb-[2px] text-[13px] font-semibold' } },
    h4: { props: { className: 'mt-[4px] mb-[1px] text-[13px] font-semibold' } },
    h5: { props: { className: 'mt-[4px] mb-[1px] text-[12px] font-semibold' } },
    h6: { props: { className: 'mt-[4px] mb-[1px] text-[12px] font-semibold' } },
    p: { props: { className: 'my-[4px] whitespace-pre-wrap' } },
    ul: { props: { className: 'my-[4px] ml-[18px] list-disc' } },
    ol: { props: { className: 'my-[4px] ml-[18px] list-decimal' } },
    li: { props: { className: 'my-[1px]' } },
    strong: { props: { className: 'font-semibold' } },
    em: { props: { className: 'italic' } },
    code: {
      props: {
        className: 'rounded bg-surface-2 px-[4px] py-[1px] font-mono text-[12px]',
      },
    },
    pre: {
      props: {
        className:
          'my-[6px] overflow-x-auto rounded bg-surface-2 px-[8px] py-[6px] font-mono text-[12px]',
      },
    },
    blockquote: {
      props: {
        className: 'my-[4px] border-l-2 border-border pl-[8px] text-text-muted',
      },
    },
    a: {
      props: {
        className: 'text-accent underline',
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    },
    table: {
      props: {
        className: 'my-[6px] border-collapse text-[12px]',
      },
    },
    th: {
      props: {
        className: 'border border-border bg-surface-2 px-[6px] py-[2px] text-left font-semibold',
      },
    },
    td: {
      props: {
        className: 'border border-border px-[6px] py-[2px] align-top',
      },
    },
    hr: { props: { className: 'my-[8px] border-border' } },
  },
  // disableParsingRawHTML: 任意の raw <script> 等を埋め込めなくする。
  // LLM 出力の Markdown レンダリングなので XSS 防御として有効化。
  disableParsingRawHTML: true,
} as const;

export function AgentMessage({ text }: AgentMessageProps): JSX.Element {
  return (
    <div className="msg-in flex items-start gap-[8px]">
      <AgentAvatar />
      <div className="pt-[1px] text-[13px] leading-[1.5] text-text [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <Markdown options={MARKDOWN_OPTIONS}>{text}</Markdown>
      </div>
    </div>
  );
}
