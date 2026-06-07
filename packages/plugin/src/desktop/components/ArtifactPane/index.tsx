// Cowork Agent for kintone — ArtifactPane (右側 / オーバーレイの専用ペイン)

import { useMemo, useState } from 'react';

import { useChatStore } from '../../../store/chatStore';

import { isCustomizerPurpose, useCurrentAgentPurpose } from '../../hooks/useCurrentAgentPurpose';

import { ArtifactFooter } from './ArtifactFooter';
import { ArtifactHeader } from './ArtifactHeader';
import { CustomizerBundleView } from './CustomizerBundleView';
import { AgentDraftArtifact } from './renderers/AgentDraftArtifact';
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
import type { KintoneApiFn } from '../../../chat/workflow/kintoneCustomizeApi';

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
    case 'agent-draft':
      return <AgentDraftArtifact artifact={artifact} />;
    default:
      return <PlaceholderArtifact artifact={artifact} />;
  }
}

/**
 * Customizer wedge V2 Phase 1: artifact が kind='kintone-customize-bundle' かつ
 * 現在の Agent が Customizer なら CustomizerBundleView で表示 (FileTree + Workflow)。
 */
function isCustomizerBundleArtifact(
  artifact: Artifact,
  purpose: ReturnType<typeof useCurrentAgentPurpose>,
): boolean {
  if (artifact.kind !== 'kintone-customize-bundle') return false;
  return isCustomizerPurpose(purpose);
}

export function ArtifactPane(): JSX.Element | null {
  const artifacts = useChatStore((s) => s.artifacts);
  const activeArtifactId = useChatStore((s) => s.activeArtifactId);
  const setActiveArtifact = useChatStore((s) => s.setActiveArtifact);
  const purpose = useCurrentAgentPurpose();
  // プレビュー / 原文の切替。Agent が想定外の content を返したときの確認用。
  const [showRaw, setShowRaw] = useState(false);

  // 現在の kintone アプリ ID と REST API 関数 (Customizer モードで使う)
  const kintoneContext = useMemo(() => {
    const appId = readKintoneAppId();
    if (appId === null) return null;
    return {
      appId,
      apiFn: kintoneApiFn,
    };
  }, []);

  if (!activeArtifactId) return null;
  const active = artifacts.get(activeArtifactId);
  if (!active) return null;

  // セレクタには直近更新順 (= updatedAt 降順) で並べる
  const all = Array.from(artifacts.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  const customizerMode = isCustomizerBundleArtifact(active, purpose);

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
      <div
        className="flex flex-1 min-h-0 overflow-hidden"
        data-artifact-view={showRaw ? 'raw' : 'preview'}
      >
        {customizerMode && kintoneContext && !showRaw ? (
          <CustomizerBundleView
            artifact={active}
            appId={kintoneContext.appId}
            apiFn={kintoneContext.apiFn}
          />
        ) : (
          <div className="flex-1 overflow-auto">
            {showRaw ? <RawContent artifact={active} /> : renderBody(active)}
          </div>
        )}
      </div>
      <ArtifactFooter
        artifact={active}
        showRaw={showRaw}
        onToggleRaw={() => setShowRaw((v) => !v)}
      />
    </aside>
  );
}

// ─── kintone host bridge ────────────────────────────────────────────────

interface KintoneGlobals {
  app?: {
    getId?: () => number | null;
  };
  api?: (url: string, method: string, params: unknown) => Promise<unknown>;
}

function readKintoneAppId(): number | null {
  const k = (window as { kintone?: KintoneGlobals }).kintone;
  return k?.app?.getId?.() ?? null;
}

const kintoneApiFn: KintoneApiFn = async (url, method, params) => {
  const k = (window as { kintone?: KintoneGlobals }).kintone;
  if (!k?.api) {
    throw new Error('kintone.api is not available (Plugin context 外)');
  }
  return k.api(url, method, params);
};

function RawContent({ artifact }: { artifact: Artifact }): JSX.Element {
  return (
    <pre className="h-full overflow-auto bg-slate-50 px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-800">
      <code>{artifact.content}</code>
    </pre>
  );
}
