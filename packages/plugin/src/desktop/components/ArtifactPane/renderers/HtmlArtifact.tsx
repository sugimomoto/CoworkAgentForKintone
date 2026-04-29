// HTML Artifact: iframe sandbox に srcdoc としてそのまま埋め込む。
//   - allow-scripts のみ (親 DOM / kintone セッションには触れない)
//   - <html> ラッパが無くても iframe が補完してくれる
//   - 親に boot/rendered を通知するための極小スクリプトを <head> に注入

import { useMemo } from 'react';

import { sanitizeHtmlContent } from '../../../../core/artifacts/sanitizeContent';

import { POST_HELPER_SCRIPT, SandboxFrame } from '../SandboxFrame';

import type { Artifact } from '../../../../core/artifacts/types';

function buildSrcdoc(userHtml: string): string {
  // user 側に <html> や <head> が含まれていてもおおよそ動くよう、
  // notify スクリプトは独立した <script> で先頭に注入する。
  // window.onload で 'rendered' を post (画像読み込み等の完了後)
  return `<!doctype html><html><head><meta charset="utf-8" />
<script>
${POST_HELPER_SCRIPT}
post('boot', null);
window.addEventListener('load', () => post('rendered', null));
</script>
</head><body>${userHtml}</body></html>`;
}

export function HtmlArtifact({ artifact }: { artifact: Artifact }): JSX.Element {
  const srcdoc = useMemo(
    () => buildSrcdoc(sanitizeHtmlContent(artifact.content)),
    [artifact.content],
  );
  return (
    <SandboxFrame
      srcdoc={srcdoc}
      reloadKey={`${artifact.id}@${artifact.version}`}
      title={`html-artifact-${artifact.id}`}
    />
  );
}
