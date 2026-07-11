// Cowork Agent for kintone — 設定「メモリ」セクション (#15 Step 2, 純表示)
//
// SettingsView の detail に描画する「メモリ」閲覧/編集 UI。
// 上=2 store のファイルツリー / 下=選択ファイルの閲覧・編集。
// 表示・編集専用で、読み書き (resolve / list / retrieve / update / delete) は
// MemorySectionBound が担う。出所: docs/design-handoff/memory-settings/。

import Markdown from 'markdown-to-jsx';
import { useState } from 'react';

import {
  basename,
  byteLabel,
  relativeTime,
  resolveSelection,
  type MemoryAsyncState,
  type MemoryFile,
  type MemorySelection,
  type MemoryStoreView,
  type MemoryViewMode,
} from '../../core/chat/memoryView';
import { Banner } from '../components/Banner';
import { ConfirmDialog } from '../components/ConfirmDialog';


const MD_OPTIONS = {
  overrides: {
    h1: { props: { className: 'mt-2 mb-1.5 text-[15px] font-semibold text-text' } },
    h2: { props: { className: 'mt-2 mb-1 text-[13px] font-semibold text-text' } },
    h3: { props: { className: 'mt-1.5 mb-0.5 text-[12.5px] font-semibold text-text' } },
    p: { props: { className: 'my-1.5 whitespace-pre-wrap text-[13px] leading-[1.7] text-text' } },
    ul: { props: { className: 'my-1.5 ml-5 list-disc text-[13px] text-text' } },
    ol: { props: { className: 'my-1.5 ml-5 list-decimal text-[13px] text-text' } },
    li: { props: { className: 'my-0.5' } },
    code: { props: { className: 'rounded bg-card-hi px-1 py-0.5 font-mono text-[12px]' } },
  },
  disableParsingRawHTML: true,
} as const;

export interface MemorySectionProps {
  stores: MemoryStoreView[];
  selection: MemorySelection;
  onSelect: (sel: MemorySelection) => void;
  mode: MemoryViewMode;
  onModeChange: (mode: MemoryViewMode) => void;
  asyncState: MemoryAsyncState;
  draft: string;
  onDraftChange: (v: string) => void;
  onSave: () => void;
  onReload: () => void;
  onDelete: (sel: NonNullable<MemorySelection>) => void;
}

export function MemorySection({
  stores,
  selection,
  onSelect,
  mode,
  onModeChange,
  asyncState,
  draft,
  onDraftChange,
  onSave,
  onReload,
  onDelete,
}: MemorySectionProps): JSX.Element {
  const resolved = resolveSelection(stores, selection);
  const [pendingDelete, setPendingDelete] = useState<NonNullable<MemorySelection> | null>(null);
  const pendingFile = pendingDelete ? resolveSelection(stores, pendingDelete)?.file : null;

  return (
    <div className="relative px-[26px] py-[22px] pb-[32px]" data-testid="memory-section">
      <div className="mb-1 text-[18px] font-bold text-text">メモリ</div>
      <div className="mb-[18px] text-[11.5px] text-muted">
        エージェントが会話から覚えた内容を確認・編集できます
      </div>

      {/* ── 2 store のツリー ── */}
      {stores.map((store) => (
        <StoreSection
          key={store.kind}
          store={store}
          selection={selection}
          onSelect={(sel) => {
            onSelect(sel);
            onModeChange('view');
          }}
          onRequestDelete={setPendingDelete}
        />
      ))}

      <div className="mb-[18px] mt-1 h-px bg-border" />

      {/* ── 選択ファイルの閲覧 / 編集 ── */}
      {asyncState === 'loading' ? (
        <>
          <SectionLabel>選択ファイル</SectionLabel>
          <Skeleton />
        </>
      ) : (
        <FileDetail
          file={resolved?.file ?? null}
          mode={mode}
          asyncState={asyncState}
          draft={draft}
          onDraftChange={onDraftChange}
          onEdit={() => onModeChange('edit')}
          onCancel={() => onModeChange('view')}
          onSave={onSave}
          onReload={onReload}
        />
      )}

      {/* ── 削除確認 ── */}
      {pendingDelete && (
        <ConfirmDialog
          testId="memory-delete-confirm"
          title="メモリファイルを削除"
          message={
            <>
              <code className="font-mono text-text">{basename(pendingFile?.path ?? '')}</code>{' '}
              を削除します。エージェントはこの記憶を参照できなくなります。
            </>
          }
          confirmLabel="削除する"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            onDelete(pendingDelete);
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}

// ── store セクション（見出し + カード内ファイル行 / 空プレースホルダ） ──
function StoreSection({
  store,
  selection,
  onSelect,
  onRequestDelete,
}: {
  store: MemoryStoreView;
  selection: MemorySelection;
  onSelect: (sel: NonNullable<MemorySelection>) => void;
  onRequestDelete: (sel: NonNullable<MemorySelection>) => void;
}): JSX.Element {
  const isPref = store.kind === 'preferences';
  return (
    <>
      <SectionLabel
        right={
          <span className="font-mono text-[9.5px] font-medium normal-case tracking-normal text-subtle">
            {store.files.length} ファイル
          </span>
        }
      >
        <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded bg-accent-soft text-accent">
          {isPref ? <PersonIcon /> : <SparkIcon />}
        </span>
        {store.label}
      </SectionLabel>

      {store.files.length === 0 ? (
        <div className="mb-[18px] rounded-xl border border-dashed border-border bg-card-hi px-4 py-[18px] text-center text-[11.5px] leading-relaxed text-subtle">
          まだ記憶がありません。会話を重ねるとエージェントが自動で書き込みます。
        </div>
      ) : (
        <div className="mb-[18px] overflow-hidden rounded-xl border border-card-border bg-card">
          {store.files.map((f, i) => (
            <FileRow
              key={f.id}
              file={f}
              selected={selection?.storeKind === store.kind && selection?.fileId === f.id}
              last={i === store.files.length - 1}
              onSelect={() => onSelect({ storeKind: store.kind, fileId: f.id })}
              onRequestDelete={() => onRequestDelete({ storeKind: store.kind, fileId: f.id })}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ── ファイル 1 行 ──
function FileRow({
  file,
  selected,
  last,
  onSelect,
  onRequestDelete,
}: {
  file: MemoryFile;
  selected: boolean;
  last: boolean;
  onSelect: () => void;
  onRequestDelete: () => void;
}): JSX.Element {
  const empty = file.sizeBytes <= 0;
  return (
    <div
      onClick={onSelect}
      data-testid={`memory-file-${basename(file.path)}`}
      className={[
        'group flex cursor-pointer items-center gap-[11px] px-3.5 py-2.5',
        last ? '' : 'border-b border-border',
        selected
          ? 'bg-accent-soft shadow-[inset_2px_0_0_var(--cw-accent)]'
          : 'hover:bg-card-hi',
      ].join(' ')}
    >
      <span
        className={`grid h-6 w-6 flex-none place-items-center rounded-md ${
          selected ? 'bg-accent text-white' : 'bg-card-hi text-muted'
        }`}
      >
        <FileIcon />
      </span>
      <span
        className={`min-w-0 flex-1 truncate font-mono text-[12px] ${
          selected ? 'font-semibold' : 'font-medium'
        } text-text`}
      >
        {basename(file.path)}
      </span>
      <span
        className={`flex-none font-mono text-[10.5px] tabular-nums ${
          empty ? 'italic text-subtle' : 'text-muted'
        }`}
      >
        {byteLabel(file.sizeBytes)}
      </span>
      <button
        type="button"
        title="削除"
        aria-label="削除"
        onClick={(e) => {
          e.stopPropagation();
          onRequestDelete();
        }}
        className={`grid h-6 w-6 flex-none place-items-center rounded-md text-subtle hover:text-warn ${
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

// ── 選択ファイルの閲覧 / 編集ブロック ──
function FileDetail({
  file,
  mode,
  asyncState,
  draft,
  onDraftChange,
  onEdit,
  onCancel,
  onSave,
  onReload,
}: {
  file: MemoryFile | null;
  mode: MemoryViewMode;
  asyncState: MemoryAsyncState;
  draft: string;
  onDraftChange: (v: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onReload: () => void;
}): JSX.Element {
  if (!file) {
    return (
      <>
        <SectionLabel>選択ファイル</SectionLabel>
        <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-border bg-card-hi px-5 py-[30px] text-center">
          <span className="grid h-[42px] w-[42px] place-items-center rounded-xl border border-border bg-card text-subtle">
            <FileIcon size={19} />
          </span>
          <div className="max-w-[300px] text-[12px] leading-relaxed text-muted">
            上のファイルを選ぶと内容を表示します。エージェントが会話から学んだ記憶を確認・編集できます。
          </div>
        </div>
      </>
    );
  }

  const empty = file.sizeBytes <= 0;
  const editing = mode === 'edit';
  const saving = asyncState === 'saving';

  return (
    <>
      <SectionLabel
        right={
          <span className="font-mono text-[9.5px] font-medium normal-case tracking-normal text-subtle">
            更新 {relativeTime(file.updatedAt)}
          </span>
        }
      >
        選択ファイル
      </SectionLabel>

      {asyncState === 'conflict' && (
        <div className="mb-3">
          <Banner tone="warn" actionLabel="再読込" onAction={onReload} testId="memory-conflict">
            このファイルは他で更新されました。最新の内容を再読込します。
          </Banner>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-card-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-card-hi px-3.5 py-2">
          <span className="flex-none text-muted">
            <FileIcon />
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-semibold text-text">
            {basename(file.path)}
          </span>
          {editing ? (
            <div className="flex flex-none gap-1.5">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border border-border px-3 py-1 text-[11.5px] text-text"
              >
                取消
              </button>
              <button
                type="button"
                data-testid="memory-save"
                onClick={onSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1 text-[11.5px] font-semibold text-white disabled:opacity-60"
              >
                {saving && (
                  <span className="h-[11px] w-[11px] animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {saving ? '保存中' : '保存'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-testid="memory-edit"
              onClick={onEdit}
              className="inline-flex flex-none items-center gap-1.5 rounded-md border border-border px-3 py-1 text-[11.5px] text-text"
            >
              <PencilIcon /> 編集
            </button>
          )}
        </div>

        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            spellCheck={false}
            data-testid="memory-editor"
            className="box-border min-h-[220px] w-full resize-y border-0 bg-bg px-4 py-3.5 text-[13px] leading-[1.7] text-text outline-none"
          />
        ) : empty ? (
          <div className="px-5 py-7 text-center text-[12.5px] leading-relaxed text-subtle">
            このファイルはまだ空です。会話が進むと自動で書き込まれます。
          </div>
        ) : (
          <div className="px-[18px] py-4">
            <Markdown options={MD_OPTIONS}>{file.content ?? ''}</Markdown>
          </div>
        )}
      </div>

      {!editing && !empty && (
        <div className="mt-2 pl-0.5 text-[10px] text-subtle">
          エージェントが自動で更新します。手動の変更もいつでも上書きできます。
        </div>
      )}
    </>
  );
}

// ── SectionLabel（store 見出し / 「選択ファイル」見出し） ──
function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="mb-2 flex items-center gap-2">
      <div className="flex flex-1 items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.5px] text-muted">
        {children}
      </div>
      {right}
    </div>
  );
}

function Skeleton(): JSX.Element {
  const widths = ['34%', '92%', '86%', '70%', '28%', '80%'];
  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card">
      <div className="flex flex-col gap-2.5 px-4 py-[18px]">
        {widths.map((w, i) => (
          <div key={i} className="h-2.5 animate-pulse rounded bg-card-hi" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

// ── inline icons ──
function FileIcon({ size = 13 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 2h5l3 3v9H4z" />
      <path d="M9 2v3h3" />
    </svg>
  );
}
function TrashIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4" />
    </svg>
  );
}
function PencilIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z" />
    </svg>
  );
}
function PersonIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="5" r="2.5" />
      <path d="M3.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
    </svg>
  );
}
function SparkIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2l1.4 3.6L13 7l-3.6 1.4L8 12l-1.4-3.6L3 7l3.6-1.4z" />
    </svg>
  );
}

export default MemorySection;
