// Cowork Agent for kintone — 設定「メモリ」セクションのデータ配線 (#15 Step 2)
//
// MemorySection (純表示) に、Anthropic Memory API 経由の store 解決 / 一覧 / 取得 /
// 保存 (楽観ロック) / 削除 を結線する Bound アダプタ。他 Settings セクションと同じ
// 「純表示 + Bound」二層構成。表示中エージェントは chatStore.currentAgentId から解決する。

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  resolveAgentContextStore,
  resolveUserPreferencesStore,
} from '../../core/bootstrap/resolveMemoryStore';
import {
  resolveSelection,
  type MemoryAsyncState,
  type MemorySelection,
  type MemoryStoreView,
  type MemoryViewMode,
} from '../../core/chat/memoryView';
import { warn } from '../../core/debug';
import { getCurrentSessionContext } from '../../core/kintone/user';
import {
  deleteMemory,
  isPreconditionFailed,
  listMemories,
  retrieveMemory,
  updateMemory,
} from '../../core/managed-agents/memory';
import { useChatStore } from '../../store/chatStore';

import { MemorySection } from './MemorySection';

import type { Memory, MemoryStore } from '../../core/managed-agents/types';

/** API の Memory を UI の MemoryFile へ。 */
function toFile(m: Memory): MemoryStoreView['files'][number] {
  return { id: m.id, path: m.path, sizeBytes: m.content_size_bytes, updatedAt: m.updated_at };
}

async function loadStoreView(
  store: MemoryStore,
  kind: MemoryStoreView['kind'],
  label: string,
): Promise<MemoryStoreView> {
  const list = await listMemories(store.id, { path_prefix: '/', depth: 0, view: 'basic' });
  const files = list.data
    .filter((m): m is Memory => m.type === 'memory')
    .map(toFile)
    .sort((a, b) => a.path.localeCompare(b.path));
  return { kind, label, storeId: store.id, files };
}

export function MemorySectionBound(): JSX.Element {
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const builtInAgents = useChatStore((s) => s.builtInAgents);
  const agentName =
    builtInAgents.find((a) => a.id === currentAgentId)?.name ?? 'このエージェント';

  const [stores, setStores] = useState<MemoryStoreView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<MemorySelection>(null);
  const [mode, setMode] = useState<MemoryViewMode>('view');
  const [asyncState, setAsyncState] = useState<MemoryAsyncState>('idle');
  const [draft, setDraft] = useState('');
  // stores の最新値を非同期処理内で参照するための ref (stale closure 回避)
  const storesRef = useRef<MemoryStoreView[] | null>(null);
  storesRef.current = stores;

  // 初回 (+ エージェント切替時): 2 store を find-or-create + 一覧取得
  useEffect(() => {
    let cancelled = false;
    setStores(null);
    setLoadError(null);
    setSelection(null);
    (async () => {
      try {
        const kctx = getCurrentSessionContext();
        const [prefStore, agentStore] = await Promise.all([
          resolveUserPreferencesStore(kctx),
          resolveAgentContextStore({ ...kctx, agentId: currentAgentId ?? 'default' }),
        ]);
        const [pref, agent] = await Promise.all([
          loadStoreView(prefStore, 'preferences', '個人設定（全エージェント共通）'),
          loadStoreView(agentStore, 'agent-context', `このエージェント（${agentName}）`),
        ]);
        if (!cancelled) setStores([pref, agent]);
      } catch (e) {
        if (!cancelled) {
          warn('Memory', 'load failed', e);
          setLoadError('メモリの読み込みに失敗しました。時間をおいて再度お試しください。');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentAgentId, agentName]);

  // ファイル選択 → content を retrieve(view=full)
  const handleSelect = useCallback(
    (sel: MemorySelection) => {
      setSelection(sel);
      setMode('view');
      if (!sel) return;
      const resolved = resolveSelection(storesRef.current ?? [], sel);
      if (!resolved) return;
      // 既に content 取得済ならスキップ
      if (resolved.file.content !== undefined) {
        setAsyncState('idle');
        return;
      }
      setAsyncState('loading');
      void (async () => {
        try {
          const mem = await retrieveMemory(resolved.store.storeId, sel.fileId, { view: 'full' });
          patchFile(setStores, sel, {
            content: mem.content ?? '',
            contentSha256: mem.content_sha256,
            sizeBytes: mem.content_size_bytes,
            updatedAt: mem.updated_at,
          });
          setAsyncState('idle');
        } catch (e) {
          warn('Memory', 'retrieve failed', e);
          setAsyncState('error');
        }
      })();
    },
    [],
  );

  // 編集モードに入るとき draft を現在 content で初期化
  const handleModeChange = useCallback(
    (next: MemoryViewMode) => {
      if (next === 'edit') {
        const resolved = resolveSelection(storesRef.current ?? [], selection);
        setDraft(resolved?.file.content ?? '');
      }
      setMode(next);
    },
    [selection],
  );

  // 保存 (content_sha256 楽観ロック)
  const handleSave = useCallback(() => {
    const resolved = resolveSelection(storesRef.current ?? [], selection);
    if (!resolved || !selection) return;
    setAsyncState('saving');
    void (async () => {
      try {
        const mem = await updateMemory(resolved.store.storeId, selection.fileId, {
          content: draft,
          ...(resolved.file.contentSha256
            ? {
                precondition: {
                  type: 'content_sha256' as const,
                  content_sha256: resolved.file.contentSha256,
                },
              }
            : {}),
        });
        patchFile(setStores, selection, {
          content: mem.content ?? draft,
          contentSha256: mem.content_sha256,
          sizeBytes: mem.content_size_bytes,
          updatedAt: mem.updated_at,
        });
        setMode('view');
        setAsyncState('idle');
      } catch (e) {
        if (isPreconditionFailed(e)) {
          setAsyncState('conflict');
        } else {
          warn('Memory', 'save failed', e);
          setAsyncState('error');
        }
      }
    })();
  }, [selection, draft]);

  // 競合バナーの「再読込」→ 最新を retrieve して editor に反映
  const handleReload = useCallback(() => {
    const resolved = resolveSelection(storesRef.current ?? [], selection);
    if (!resolved || !selection) return;
    setAsyncState('loading');
    void (async () => {
      try {
        const mem = await retrieveMemory(resolved.store.storeId, selection.fileId, { view: 'full' });
        patchFile(setStores, selection, {
          content: mem.content ?? '',
          contentSha256: mem.content_sha256,
          sizeBytes: mem.content_size_bytes,
          updatedAt: mem.updated_at,
        });
        setDraft(mem.content ?? '');
        setAsyncState('idle');
      } catch (e) {
        warn('Memory', 'reload failed', e);
        setAsyncState('error');
      }
    })();
  }, [selection]);

  // 削除
  const handleDelete = useCallback((sel: NonNullable<MemorySelection>) => {
    const resolved = resolveSelection(storesRef.current ?? [], sel);
    if (!resolved) return;
    void (async () => {
      try {
        await deleteMemory(resolved.store.storeId, sel.fileId);
        setStores((prev) =>
          (prev ?? []).map((s) =>
            s.kind === sel.storeKind
              ? { ...s, files: s.files.filter((f) => f.id !== sel.fileId) }
              : s,
          ),
        );
        setSelection((cur) =>
          cur && cur.storeKind === sel.storeKind && cur.fileId === sel.fileId ? null : cur,
        );
      } catch (e) {
        warn('Memory', 'delete failed', e);
      }
    })();
  }, []);

  if (loadError) {
    return (
      <div className="px-[26px] py-[22px] text-[12px] text-muted" data-testid="memory-section-error">
        {loadError}
      </div>
    );
  }
  if (stores === null) {
    return (
      <div className="px-[26px] py-[22px] text-[12px] text-subtle" data-testid="memory-section-loading">
        メモリを読み込み中…
      </div>
    );
  }

  return (
    <MemorySection
      stores={stores}
      selection={selection}
      onSelect={handleSelect}
      mode={mode}
      onModeChange={handleModeChange}
      asyncState={asyncState}
      draft={draft}
      onDraftChange={setDraft}
      onSave={handleSave}
      onReload={handleReload}
      onDelete={handleDelete}
    />
  );
}

/** stores 内の該当ファイルにパッチを当てる純関数 (setState 用)。 */
function patchFile(
  setStores: React.Dispatch<React.SetStateAction<MemoryStoreView[] | null>>,
  sel: NonNullable<MemorySelection>,
  patch: Partial<MemoryStoreView['files'][number]>,
): void {
  setStores((prev) =>
    (prev ?? []).map((s) =>
      s.kind === sel.storeKind
        ? {
            ...s,
            files: s.files.map((f) => (f.id === sel.fileId ? { ...f, ...patch } : f)),
          }
        : s,
    ),
  );
}

export default MemorySectionBound;
