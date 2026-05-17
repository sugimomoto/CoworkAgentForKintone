// Cowork Agent for kintone — ArtifactPane (右側 / オーバーレイの専用ペイン)

import { useMemo, useState } from 'react';

import { useChatStore } from '../../../store/chatStore';

import { FileTree } from '../../../chat/workflow/FileTree';
import { WorkflowFooter } from '../../../chat/workflow/WorkflowFooter';
import { makeKintoneCustomizeWorkflow } from '../../../chat/workflow/kintoneCustomizeApi';
import { isCustomizerPurpose, useCurrentAgentPurpose } from '../../hooks/useCurrentAgentPurpose';

import { ArtifactFooter } from './ArtifactFooter';
import { ArtifactHeader } from './ArtifactHeader';
import { BinaryArtifact } from './renderers/BinaryArtifact';
import { CodeArtifact } from './renderers/CodeArtifact';
import { CsvArtifact } from './renderers/CsvArtifact';
import { HtmlArtifact } from './renderers/HtmlArtifact';
import { JsonArtifact } from './renderers/JsonArtifact';
import { MarkdownArtifact } from './renderers/MarkdownArtifact';
import { MermaidArtifact } from './renderers/MermaidArtifact';
import { PlaceholderArtifact } from './renderers/PlaceholderArtifact';
import { ReactArtifact } from './renderers/ReactArtifact';
import { SvgArtifact } from './renderers/SvgArtifact';

import type { Artifact } from '../../../core/artifacts/types';

function renderBody(artifact: Artifact): JSX.Element {
  // version でキー再生成 → 同じ id の更新でも iframe / state を作り直して安全にリロード
  const key = `${artifact.id}@${artifact.version}`;
  switch (artifact.kind) {
    case 'markdown':
      return <MarkdownArtifact artifact={artifact} />;
    case 'code':
      return <CodeArtifact artifact={artifact} />;
    case 'json':
      return <JsonArtifact artifact={artifact} />;
    case 'react':
      return <ReactArtifact key={key} artifact={artifact} />;
    case 'html':
      return <HtmlArtifact key={key} artifact={artifact} />;
    case 'svg':
      return <SvgArtifact key={key} artifact={artifact} />;
    case 'mermaid':
      return <MermaidArtifact key={key} artifact={artifact} />;
    case 'csv':
      return <CsvArtifact artifact={artifact} />;
    case 'binary':
      return <BinaryArtifact artifact={artifact} />;
    default:
      return <PlaceholderArtifact artifact={artifact} />;
  }
}

/**
 * Customizer wedge: artifact が「カスタマイズ JS」かつ現在の Agent が Customizer なら
 * FileTree + WorkflowFooter を表示する Customizer モードに切替。
 */
function isCustomizerJsArtifact(
  artifact: Artifact,
  purpose: ReturnType<typeof useCurrentAgentPurpose>,
): boolean {
  if (artifact.kind !== 'code') return false;
  const lang = (artifact.language ?? '').toLowerCase();
  if (lang !== 'javascript' && lang !== 'js') return false;
  return isCustomizerPurpose(purpose);
}

export function ArtifactPane(): JSX.Element | null {
  const artifacts = useChatStore((s) => s.artifacts);
  const activeArtifactId = useChatStore((s) => s.activeArtifactId);
  const setActiveArtifact = useChatStore((s) => s.setActiveArtifact);
  const purpose = useCurrentAgentPurpose();
  // プレビュー / 原文の切替。Agent が想定外の content を返したときの確認用。
  const [showRaw, setShowRaw] = useState(false);

  // Customizer Workflow callbacks (V1 では preview の sandbox は no-op、apply/rollback は
  // kintone REST を叩く)。
  const workflowCallbacks = useMemo(() => {
    if (!activeArtifactId) return null;
    const appId = readKintoneAppId();
    if (appId === null) return null;
    return makeKintoneCustomizeWorkflow(activeArtifactId, {
      apiFn: (url, method, params) =>
        // global kintone API。テスト環境では window.kintone が無いので null fallback。
        (window as { kintone?: { api?: typeof kintoneApi } }).kintone?.api?.(url, method, params as Parameters<typeof kintoneApi>[2]) ??
        Promise.reject(new Error('kintone.api is not available')),
      appId,
    });
  }, [activeArtifactId]);

  if (!activeArtifactId) return null;
  const active = artifacts.get(activeArtifactId);
  if (!active) return null;

  // セレクタには直近更新順 (= updatedAt 降順) で並べる
  const all = Array.from(artifacts.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  const customizerMode = isCustomizerJsArtifact(active, purpose);

  return (
    <aside
      data-artifact-pane
      data-customizer-mode={customizerMode ? '1' : '0'}
      className="flex h-full w-full flex-col overflow-hidden border-l border-slate-200 bg-white"
    >
      <ArtifactHeader
        artifact={active}
        allArtifacts={all}
        onSelect={setActiveArtifact}
        onClose={() => setActiveArtifact(null)}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden" data-artifact-view={showRaw ? 'raw' : 'preview'}>
        {customizerMode && <FileTree />}
        <div className="flex-1 overflow-auto">
          {showRaw ? <RawContent artifact={active} /> : renderBody(active)}
        </div>
      </div>
      {customizerMode && workflowCallbacks ? (
        <WorkflowFooter
          artifactId={active.id}
          appName={readKintoneAppName()}
          callbacks={workflowCallbacks}
        />
      ) : null}
      <ArtifactFooter artifact={active} showRaw={showRaw} onToggleRaw={() => setShowRaw((v) => !v)} />
    </aside>
  );
}

// ─── kintone host bridge ────────────────────────────────────────────────

type KintoneApiUrl = string;
type KintoneApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type KintoneApiBody = unknown;
declare function kintoneApi(
  url: KintoneApiUrl,
  method: KintoneApiMethod,
  body: KintoneApiBody,
): Promise<unknown>;

interface KintoneAppGlobals {
  app?: {
    getId?: () => number | null;
    getName?: () => string | null;
  };
}

function readKintoneAppId(): number | null {
  const k = (window as { kintone?: KintoneAppGlobals }).kintone;
  return k?.app?.getId?.() ?? null;
}

function readKintoneAppName(): string {
  // kintone runtime に app 名取得 API は無いので、暫定でデフォルト文字列を返す。
  // 必要なら kintone-get-app MCP 経由で取得して props で渡す形に拡張。
  return 'アプリ';
}

function RawContent({ artifact }: { artifact: Artifact }): JSX.Element {
  return (
    <pre className="h-full overflow-auto bg-slate-50 px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-800">
      <code>{artifact.content}</code>
    </pre>
  );
}
