// React Artifact: iframe sandbox 内で React + Recharts + Babel standalone を esm.sh から
// ロードし、ユーザーコード (JSX 文字列) を transpile → render する。
//
// セキュリティ:
//   - sandbox="allow-scripts" のみ (allow-same-origin は付けない)
//     → 親 DOM / cookie / kintone セッションへ一切アクセス不可 (origin が unique opaque)
//   - 親 → iframe への通信は無し。iframe → 親は postMessage で boot/rendered/error のみ。
//
// バージョン固定:
//   - react@18.3.1, react-dom@18.3.1, recharts@2.12.7, @babel/standalone@7.25.6
//   - ?deps= で内部依存を共有させ、React singleton 衝突を回避 (verify-esm-sandbox.html で検証済み)

import { useMemo } from 'react';

import { POST_HELPER_SCRIPT, SandboxFrame, safeStringLiteral } from '../SandboxFrame';

import type { Artifact } from '../../../../core/artifacts/types';

const REACT_VERSION = '18.3.1';
const RECHARTS_VERSION = '2.12.7';
const BABEL_VERSION = '7.25.6';

function buildSrcdoc(userCode: string): string {
  const safeCode = safeStringLiteral(userCode);
  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  html,body{margin:0;padding:0;height:100%;font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;color:#0f172a;background:#fff}
  #root{height:100%;padding:12px;box-sizing:border-box;overflow:auto}
  .err{padding:12px;background:#fef2f2;color:#991b1b;font-family:ui-monospace,monospace;font-size:12px;white-space:pre-wrap}
</style>
</head>
<body>
<div id="root"></div>
<script type="module">
${POST_HELPER_SCRIPT}
const showErr = (msg) => {
  const root = document.getElementById('root');
  if (root) root.innerHTML = '<div class="err"></div>';
  const el = document.querySelector('.err');
  if (el) el.textContent = msg;
};
try {
  post('boot', null);
  const [ReactNS, ReactDOMNS, RechartsNS, BabelNS] = await Promise.all([
    import('https://esm.sh/react@${REACT_VERSION}'),
    import('https://esm.sh/react-dom@${REACT_VERSION}/client?deps=react@${REACT_VERSION}'),
    // bundle-deps で recharts の transitive deps (lodash 等) を 1 ファイルに同梱する。
    // 分割 bundle だと lodash@^4.17.21/isBoolean 等の個別 fetch が走り、CDN 解決失敗で
    // 一時的に「サーバに接続できませんでした」エラーが出てから render される現象が起きる。
    import('https://esm.sh/recharts@${RECHARTS_VERSION}?deps=react@${REACT_VERSION},react-dom@${REACT_VERSION}&bundle-deps'),
    import('https://esm.sh/@babel/standalone@${BABEL_VERSION}'),
  ]);
  const React = Object.assign({}, ReactNS, ReactNS.default || {});
  if (!React.createElement && ReactNS.default) Object.assign(React, ReactNS.default);
  window.React = React;
  window.Recharts = RechartsNS;

  const userCode = ${safeCode};
  const transformed = BabelNS.transform(userCode, {
    presets: [['env', { modules: 'cjs' }], 'react'],
    filename: 'artifact.jsx',
  }).code;

  const module = { exports: {} };
  const runtimeExports = module.exports;
  // Babel の modules: 'cjs' 変換で生成される require(...) を解決するシム。
  // LLM が import { useState } from "react" 等を書いても動かせる。
  const requireShim = (name) => {
    if (name === 'react') return React;
    if (name === 'react-dom' || name === 'react-dom/client') return ReactDOMNS;
    if (name === 'recharts') return RechartsNS;
    throw new Error('module not available in sandbox: ' + name);
  };
  new Function('React', 'Recharts', 'module', 'exports', 'require', transformed)
    (React, RechartsNS, module, runtimeExports, requireShim);
  const Component = (module.exports && (module.exports.default || module.exports));
  if (typeof Component !== 'function') {
    throw new Error('default export が関数コンポーネントではありません。\\n例: export default function App() { return ... }');
  }
  const root = (ReactDOMNS.createRoot || ReactDOMNS.default?.createRoot)(document.getElementById('root'));
  root.render(React.createElement(Component));
  post('rendered', null);
} catch (err) {
  const msg = fmtErr(err, 'render failed');
  showErr(msg);
  post('error', msg);
}
</script>
</body></html>`;
}

export function ReactArtifact({ artifact }: { artifact: Artifact }): JSX.Element {
  const srcdoc = useMemo(() => buildSrcdoc(artifact.content), [artifact.content]);
  return (
    <SandboxFrame
      srcdoc={srcdoc}
      reloadKey={`${artifact.id}@${artifact.version}`}
      title={`react-artifact-${artifact.id}`}
    />
  );
}
