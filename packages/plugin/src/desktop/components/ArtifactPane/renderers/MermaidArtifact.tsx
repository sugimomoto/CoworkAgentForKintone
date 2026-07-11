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
  // ズーム/パンは iframe 内で自己完結（外部ライブラリ不要）。SVG をラッパー(#layer)に入れ transform で
  // scale+translate する。ホイール=カーソル中心ズーム / ドラッグ=パン / ボタン=＋・−・全体表示(フィット)。
  // iframe 内 JS はテンプレートリテラルを使わず文字列連結で書く（外側テンプレートの ${} 衝突回避）。
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:#fff;font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif}
  #viewport{position:absolute;inset:0;overflow:hidden;cursor:grab;touch-action:none}
  #viewport.grabbing{cursor:grabbing}
  #layer{position:absolute;top:0;left:0;transform-origin:0 0;will-change:transform}
  #layer svg{display:block}
  #controls{position:absolute;right:10px;bottom:10px;display:none;gap:6px;z-index:10}
  #controls button{width:30px;height:30px;padding:0;border:1px solid #d1d5db;background:#fff;color:#374151;border-radius:8px;cursor:pointer;font-size:16px;line-height:1;box-shadow:0 1px 2px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;user-select:none}
  #controls button:hover{background:#f3f4f6}
  .err{padding:12px;background:#fef2f2;color:#991b1b;font-family:ui-monospace,monospace;font-size:12px;white-space:pre-wrap}
</style>
</head><body>
<div id="viewport"><div id="layer"></div></div>
<div id="controls">
  <button id="zin" title="拡大" aria-label="拡大">+</button>
  <button id="zout" title="縮小" aria-label="縮小">−</button>
  <button id="zfit" title="全体表示" aria-label="全体表示">⤢</button>
</div>
<script type="module">
${POST_HELPER_SCRIPT}
const layer = document.getElementById('layer');
const viewport = document.getElementById('viewport');
const controls = document.getElementById('controls');
let scale = 1, tx = 0, ty = 0, natW = 0, natH = 0, interacted = false;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function apply(){ layer.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'; }
function fit(){
  const r = viewport.getBoundingClientRect();
  if (!natW || !natH || !r.width || !r.height) return;
  const pad = 24;
  scale = Math.min((r.width - pad) / natW, (r.height - pad) / natH, 1);
  if (!isFinite(scale) || scale <= 0) scale = 1;
  tx = (r.width - natW * scale) / 2;
  ty = (r.height - natH * scale) / 2;
  apply();
}
function zoomAt(cx, cy, factor){
  interacted = true;
  const ns = clamp(scale * factor, 0.05, 12);
  tx = cx - (cx - tx) * (ns / scale);
  ty = cy - (cy - ty) * (ns / scale);
  scale = ns; apply();
}
function zoomCenter(factor){ const r = viewport.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, factor); }
viewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = viewport.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.1 : 1 / 1.1);
}, { passive: false });
let drag = false, ox = 0, oy = 0;
viewport.addEventListener('pointerdown', (e) => { drag = true; interacted = true; ox = e.clientX - tx; oy = e.clientY - ty; viewport.setPointerCapture(e.pointerId); viewport.classList.add('grabbing'); });
viewport.addEventListener('pointermove', (e) => { if (!drag) return; tx = e.clientX - ox; ty = e.clientY - oy; apply(); });
const endDrag = () => { drag = false; viewport.classList.remove('grabbing'); };
viewport.addEventListener('pointerup', endDrag);
viewport.addEventListener('pointercancel', endDrag);
document.getElementById('zin').addEventListener('click', () => zoomCenter(1.25));
document.getElementById('zout').addEventListener('click', () => zoomCenter(0.8));
document.getElementById('zfit').addEventListener('click', () => { interacted = false; fit(); });
// iframe のサイズが確定/変化した時に自動フィット（ユーザーが操作するまで）。
// 初回描画時にペインがまだ 0/過渡サイズだと fit が効かず図が原点固定で見切れるため。
try { new ResizeObserver(() => { if (!interacted) fit(); }).observe(viewport); } catch { /* ResizeObserver 非対応環境は初回 fit のみ */ }
// mermaid は依存が多く esm.sh から個別 import すると芋づるのどれかが落ちて
// "Importing a module script failed" になりやすい。?bundle で全依存を1ファイルに集約し、
// 失敗時はキャッシュ回避しつつ数回リトライする（間欠的な CDN/ネットワーク障害対策）。
async function loadMermaid(){
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const url = 'https://esm.sh/mermaid@${MERMAID_VERSION}?bundle' + (i ? '&_r=' + i : '');
      return (await import(url)).default;
    } catch (e) {
      err = e;
      await new Promise((res) => setTimeout(res, 500 * (i + 1)));
    }
  }
  throw new Error('mermaid の読み込みに失敗しました（CDN/ネットワーク）。再試行してください: ' + ((err && err.message) || err));
}
try {
  post('boot', null);
  const m = await loadMermaid();
  m.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });
  const graph = ${safeGraph};
  const { svg } = await m.render('mmd-' + Date.now(), graph);
  layer.innerHTML = svg;
  const el = layer.querySelector('svg');
  if (el) {
    el.removeAttribute('style'); // max-width 制約を外して自然サイズで描き、transform で拡縮する
    const vb = el.viewBox && el.viewBox.baseVal;
    natW = (vb && vb.width) || el.getBoundingClientRect().width || 800;
    natH = (vb && vb.height) || el.getBoundingClientRect().height || 600;
    el.setAttribute('width', String(natW));
    el.setAttribute('height', String(natH));
  }
  controls.style.display = 'flex';
  requestAnimationFrame(fit);
  post('rendered', null);
} catch (err) {
  const msg = fmtErr(err, 'mermaid render failed');
  layer.innerHTML = '<div class="err"></div>';
  layer.querySelector('.err').textContent = msg;
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
