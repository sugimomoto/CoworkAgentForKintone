// Mermaid Artifact: iframe sandbox 内で esm.sh から mermaid をロードして render。
//   - 親バンドルには mermaid を含めない (~600KB の節約)
//   - mermaid.render は SVG 文字列を返すので innerHTML で挿入

import { useMemo } from 'react';

import { sanitizeMermaidContent } from '../../../../core/artifacts/sanitizeContent';
import { POST_HELPER_SCRIPT, SandboxFrame, safeStringLiteral } from '../SandboxFrame';

import type { Artifact } from '../../../../core/artifacts/types';

// v11 系。v10.9.1 の erDiagram パーサは CJK(日本語) のエンティティ名/属性名を弾き parseError に
// なる (#137)。11.16.0 で CJK 識別子が parse できることを確認済み。render/initialize API は v10.9+ と互換。
const MERMAID_VERSION = '11.16.0';

function buildSrcdoc(graph: string): string {
  const safeGraph = safeStringLiteral(graph);
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  html,body{margin:0;padding:12px;height:100%;box-sizing:border-box;background:#fff;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif}
  #out{max-width:100%;max-height:100%;overflow:auto}
  #out svg{max-width:100%;height:auto}
  .err{padding:12px;background:#fef2f2;color:#991b1b;font-family:ui-monospace,monospace;font-size:12px;white-space:pre-wrap}
</style>
</head><body>
<div id="out"></div>
<script type="module">
${POST_HELPER_SCRIPT}
try {
  post('boot', null);
  const m = (await import('https://esm.sh/mermaid@${MERMAID_VERSION}')).default;
  m.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });
  const graph = ${safeGraph};
  const { svg } = await m.render('mmd-' + Date.now(), graph);
  document.getElementById('out').innerHTML = svg;
  post('rendered', null);
} catch (err) {
  const msg = fmtErr(err, 'mermaid render failed');
  document.getElementById('out').innerHTML = '<div class="err"></div>';
  document.querySelector('.err').textContent = msg;
  post('error', msg);
}
</script>
</body></html>`;
}

export function MermaidArtifact({ artifact }: { artifact: Artifact }): JSX.Element {
  const srcdoc = useMemo(
    () => buildSrcdoc(sanitizeMermaidContent(artifact.content)),
    [artifact.content],
  );
  return (
    <SandboxFrame
      srcdoc={srcdoc}
      reloadKey={`${artifact.id}@${artifact.version}`}
      title={`mermaid-artifact-${artifact.id}`}
    />
  );
}
