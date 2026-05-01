// Cowork Agent for kintone — ArtifactPane (右側 / オーバーレイの専用ペイン)

import { useState } from 'react';

import { useChatStore } from '../../../store/chatStore';

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

export function ArtifactPane(): JSX.Element | null {
  const artifacts = useChatStore((s) => s.artifacts);
  const activeArtifactId = useChatStore((s) => s.activeArtifactId);
  const setActiveArtifact = useChatStore((s) => s.setActiveArtifact);
  // プレビュー / 原文の切替。Agent が想定外の content を返したときの確認用。
  const [showRaw, setShowRaw] = useState(false);

  if (!activeArtifactId) return null;
  const active = artifacts.get(activeArtifactId);
  if (!active) return null;

  // セレクタには直近更新順 (= updatedAt 降順) で並べる
  const all = Array.from(artifacts.values()).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <aside
      data-artifact-pane
      className="flex h-full w-full flex-col overflow-hidden border-l border-slate-200 bg-white"
    >
      <ArtifactHeader
        artifact={active}
        allArtifacts={all}
        onSelect={setActiveArtifact}
        onClose={() => setActiveArtifact(null)}
      />
      <div className="flex-1 overflow-auto" data-artifact-view={showRaw ? 'raw' : 'preview'}>
        {showRaw ? <RawContent artifact={active} /> : renderBody(active)}
      </div>
      <ArtifactFooter artifact={active} showRaw={showRaw} onToggleRaw={() => setShowRaw((v) => !v)} />
    </aside>
  );
}

function RawContent({ artifact }: { artifact: Artifact }): JSX.Element {
  return (
    <pre className="h-full overflow-auto bg-slate-50 px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-800">
      <code>{artifact.content}</code>
    </pre>
  );
}
