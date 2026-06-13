// SVG Artifact: iframe sandbox に SVG を埋め込んで表示する。
//   - DOMPurify を持たなくても sandbox 内で実行されるので script 注入も親に到達しない
//   - viewBox がある SVG は iframe 内で width:100% で center 配置

import { useMemo } from 'react';

import { sanitizeSvgContent } from '../../../../core/artifacts/sanitizeContent';
import { POST_HELPER_SCRIPT, SandboxFrame } from '../SandboxFrame';

import type { Artifact } from '../../../../core/artifacts/types';

function buildSrcdoc(svg: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  html,body{margin:0;padding:0;height:100%;display:flex;align-items:center;justify-content:center;background:#fff}
  svg{max-width:100%;max-height:100%;height:auto;width:auto}
</style>
<script>
${POST_HELPER_SCRIPT}
post('boot', null);
window.addEventListener('load', () => post('rendered', null));
</script>
</head><body>${svg}</body></html>`;
}

export function SvgArtifact({ artifact }: { artifact: Artifact }): JSX.Element {
  const srcdoc = useMemo(
    () => buildSrcdoc(sanitizeSvgContent(artifact.content)),
    [artifact.content],
  );
  return (
    <SandboxFrame
      srcdoc={srcdoc}
      reloadKey={`${artifact.id}@${artifact.version}`}
      title={`svg-artifact-${artifact.id}`}
    />
  );
}
