// Cowork Agent for kintone — Customizer wedge FileTree (#20)
//
// Customizer Agent が生成した kintone-customize-js artifact カードの左サイドバーに
// 表示する 200px 幅のファイルツリー。
//
// V1 は **hardcoded ファイル一覧** (customize/ 配下の典型構成)。
// V2 で kintone-get-customize-js MCP ツールから動的取得に置き換える。
//
// 詳細仕様: .steering/20260517-customizer-wedge-design/requirements.md §15.5
//          .steering/20260517-customizer-wedge-design/design.md §6.4

import { useMemo } from 'react';

/** ファイル種別 (バッジ色決定) */
export type FileKind = 'js' | 'css' | 'json' | 'md';

/** 変更ステータス */
export type FileStatus = 'unchanged' | 'modified' | 'new';

export interface FileTreeEntry {
  type: 'folder' | 'file';
  /** 表示名 (basename) */
  name: string;
  /** インデントレベル (0 = 最上層) */
  level: number;
  /** type='file' のとき必須 */
  kind?: FileKind;
  /** type='folder' のとき、開閉状態 */
  open?: boolean;
  /** ファイルパス (active 判定 / クリックハンドラ用) */
  path?: string;
  /** 現在編集中のファイルか (highlight 表示) */
  active?: boolean;
  /** 変更ステータス */
  status?: FileStatus;
}

/**
 * V1 用 hardcoded ファイル構成。Customizer Agent が「kintone JS カスタマイズ」を
 * 生成する典型ケース。
 */
export const DEFAULT_CUSTOMIZE_FILES: readonly FileTreeEntry[] = [
  { type: 'folder', name: 'customize', level: 0, open: true },
  {
    type: 'file',
    name: 'desktop.js',
    kind: 'js',
    level: 1,
    path: 'customize/desktop.js',
    active: true,
    status: 'modified',
  },
  {
    type: 'file',
    name: 'mobile.js',
    kind: 'js',
    level: 1,
    path: 'customize/mobile.js',
    status: 'unchanged',
  },
  {
    type: 'file',
    name: 'desktop.css',
    kind: 'css',
    level: 1,
    path: 'customize/desktop.css',
    status: 'modified',
  },
  { type: 'folder', name: 'libs', level: 1, open: false },
  {
    type: 'file',
    name: 'manifest.json',
    kind: 'json',
    level: 0,
    path: 'manifest.json',
    status: 'unchanged',
  },
  {
    type: 'file',
    name: 'README.md',
    kind: 'md',
    level: 0,
    path: 'README.md',
    status: 'new',
  },
] as const;

/** kind バッジの背景色 (Tailwind class) */
const KIND_COLOR: Record<FileKind, string> = {
  js: 'bg-[#946c00]', // JavaScript yellow
  css: 'bg-[#0e7c4a]', // CSS green
  json: 'bg-[#9333ea]', // JSON purple
  md: 'bg-muted', // Markdown gray
};

/** 変更ステータスのインジケータ (色 + 表示記号) */
const STATUS_INFO: Record<FileStatus, { color: string; symbol: string; title: string } | null> = {
  unchanged: null,
  modified: { color: 'text-[#f59e0b]', symbol: '●', title: '変更あり' },
  new: { color: 'text-[#22c55e]', symbol: '+', title: '新規ファイル' },
};

export interface FileTreeProps {
  /** 表示するファイル一覧 (V1 は DEFAULT_CUSTOMIZE_FILES) */
  files?: readonly FileTreeEntry[];
  /** active ファイルクリックハンドラ (V2 で実装、V1 は no-op) */
  onSelect?: (path: string) => void;
  /** バンドル名 (header に表示)。default: 'customize' */
  bundleName?: string;
}

/**
 * Customizer Artifact 左サイドバーのファイルツリー。
 *
 * - 幅: 200px 固定 (flex: 0 0 200px)
 * - Header: バンドル名 + 変更件数バッジ
 * - Body: ファイル / フォルダ行 (level インデント)
 * - Footer: "プレビュー環境 と同期" インジケータ
 */
export function FileTree({
  files = DEFAULT_CUSTOMIZE_FILES,
  onSelect,
  bundleName = 'customize',
}: FileTreeProps): JSX.Element {
  const changedCount = useMemo(
    () => files.filter((f) => f.type === 'file' && f.status && f.status !== 'unchanged').length,
    [files],
  );

  return (
    <div
      data-testid="filetree"
      className="flex h-full w-[200px] shrink-0 flex-col overflow-hidden border-r border-border bg-card-hi"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-[12px] py-[9px]">
        <FolderIcon className="h-[13px] w-[13px] text-muted" />
        <span className="flex-1 text-[11px] font-semibold text-text">{bundleName}</span>
        {changedCount > 0 && (
          <span
            data-testid="filetree-changed-count"
            className="rounded-[3px] bg-accent-soft px-[5px] py-[1px] text-[9px] font-semibold text-accent"
          >
            {changedCount} 変更
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto py-[4px]">
        {files.map((f, i) => (
          <FileTreeRow key={`${f.type}-${f.path ?? f.name}-${i}`} entry={f} onSelect={onSelect} />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-[5px] border-t border-border px-[12px] py-[8px] text-[9.5px] text-subtle">
        <span className="h-[7px] w-[7px] rounded-full bg-[#22c55e]" />
        プレビュー環境 と同期
      </div>
    </div>
  );
}

interface FileTreeRowProps {
  entry: FileTreeEntry;
  onSelect?: (path: string) => void;
}

function FileTreeRow({ entry, onSelect }: FileTreeRowProps): JSX.Element {
  if (entry.type === 'folder') {
    return (
      <div
        data-testid="filetree-folder"
        className="flex items-center gap-[5px] py-[4px] pr-[12px] text-[11px] text-text"
        style={{ paddingLeft: 8 + entry.level * 14 }}
      >
        <ChevronIcon open={entry.open ?? false} className="h-[9px] w-[9px]" />
        <FolderIcon className="h-[11px] w-[11px] text-accent" />
        <span className="flex-1 font-medium">{entry.name}</span>
      </div>
    );
  }

  const kind = entry.kind ?? 'md';
  const status = entry.status ? STATUS_INFO[entry.status] : null;
  const handleClick = (): void => {
    if (entry.path) onSelect?.(entry.path);
  };

  return (
    <button
      type="button"
      data-testid={`filetree-file-${entry.path ?? entry.name}`}
      onClick={handleClick}
      className={[
        'flex w-full items-center gap-[6px] py-[4px] pr-[12px] text-left text-[11px] text-text',
        entry.active ? 'border-l-2 border-accent bg-card' : 'border-l-2 border-transparent',
      ].join(' ')}
      style={{ paddingLeft: 8 + entry.level * 14 + 14 - 2 /* border-l 分 */ }}
    >
      <span
        className={`shrink-0 rounded-[2px] px-[3px] py-[1px] font-mono text-[8.5px] font-bold text-white ${KIND_COLOR[kind]}`}
      >
        {kind}
      </span>
      <span
        className={`flex-1 truncate font-mono text-[10.5px] ${
          entry.active ? 'font-semibold' : 'font-normal'
        }`}
      >
        {entry.name}
      </span>
      {status && (
        <span
          data-testid="filetree-status"
          title={status.title}
          className={`shrink-0 font-mono text-[8.5px] font-bold ${status.color}`}
        >
          {status.symbol}
        </span>
      )}
    </button>
  );
}

// ─── Icons (inline SVG to avoid extra deps) ──────────────────────────────────

function FolderIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M1.5 4h4l1 1.5h6v6.5h-11z" />
    </svg>
  );
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {open ? <path d="M3 5l3 3 3-3" /> : <path d="M4.5 3l3 3-3 3" />}
    </svg>
  );
}
