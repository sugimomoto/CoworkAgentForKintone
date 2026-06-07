// Sandbox iframe ラッパ (allow-scripts のみ。allow-same-origin は付けない)。
//
// 子フレームは postMessage で `{ source: 'artifact', type: 'boot'|'rendered'|'error', payload }`
// を親に通知する。親側はそれを受け取って data-artifact-state を出し、エラーをバナー表示。

import { useEffect, useRef, useState } from 'react';

export type ArtifactState = 'boot' | 'rendered' | 'error';

export interface SandboxFrameProps {
  /** iframe の srcdoc。子側で window.parent.postMessage を発行する想定 */
  srcdoc: string;
  /** key 用 (artifact id + version 等)。これが変わると iframe を再生成 */
  reloadKey: string;
  /** デバッグ / a11y 用 title */
  title: string;
}

export function SandboxFrame({ srcdoc, reloadKey, title }: SandboxFrameProps): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ArtifactState>('boot');
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setError(null);
    setState('boot');
  }, [reloadKey]);

  useEffect(() => {
    const handler = (ev: MessageEvent): void => {
      const data = ev.data as { source?: string; type?: string; payload?: unknown } | null;
      if (!data || data.source !== 'artifact') return;
      // sandbox iframe (allow-same-origin 無し) は origin が 'null'
      if (ev.origin !== 'null' && ev.origin !== '') return;
      if (frameRef.current && ev.source !== frameRef.current.contentWindow) return;
      if (data.type === 'boot') {
        setError(null);
        setState('boot');
      } else if (data.type === 'rendered') {
        setError(null);
        setState('rendered');
      } else if (data.type === 'error') {
        setError(typeof data.payload === 'string' ? data.payload : String(data.payload));
        setState('error');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div className="flex h-full flex-col" data-artifact-state={state}>
      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-[11px] text-rose-800">
          <div className="font-semibold">⚠️ 実行エラー</div>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px]">
            {error}
          </pre>
        </div>
      )}
      <iframe
        ref={frameRef}
        key={reloadKey}
        title={title}
        sandbox="allow-scripts"
        srcDoc={srcdoc}
        referrerPolicy="no-referrer"
        className="h-full w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}

/** srcdoc に user 由来の文字列を JSON リテラルとして埋め込む際の安全エスケープ */
export function safeStringLiteral(content: string): string {
  return JSON.stringify(content).replace(/<\//g, '<\\/');
}

/** HTML 中のテキストノード用エスケープ (< > & 等を実体参照化) */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** sandbox iframe 子側で使う共通スクリプト (boot/post/error ハンドリング) */
export const POST_HELPER_SCRIPT = `
const post = (type, payload) => parent.postMessage({ source: 'artifact', type, payload }, '*');
const fmtErr = (err, fallback) => {
  if (err && typeof err === 'object') {
    const msg = err.message ? String(err.message) : '';
    const stack = err.stack ? String(err.stack) : '';
    return msg && stack && !stack.includes(msg) ? msg + '\\n' + stack : (stack || msg || String(err));
  }
  return String(err ?? fallback ?? 'unknown error');
};
window.addEventListener('error', (e) => post('error', fmtErr(e.error, e.message)));
window.addEventListener('unhandledrejection', (e) => post('error', fmtErr(e.reason, 'unhandled rejection')));
`.trim();
