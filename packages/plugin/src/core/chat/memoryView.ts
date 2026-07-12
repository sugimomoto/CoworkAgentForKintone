// memoryView.ts — メモリ閲覧/編集 UI (#15 Step 2) のビューモデル + 派生ヘルパー
//
// managed-agents/memory.ts が扱う API 型 (MemoryStore / Memory) とは別に、UI が扱う
// 「2 store × ファイル一覧」の view model を定義する。フレームワーク非依存。
// 出所: docs/design-handoff/memory-settings/memoryStore.ts（Claude Design ハンドオフ）。

export type MemoryStoreKind = 'preferences' | 'agent-context';

export interface MemoryFile {
  id: string; // 'mem_...'
  path: string; // '/preferences/general.md'（表示は basename）
  sizeBytes: number;
  updatedAt: string; // ISO 文字列
  /** content は選択時に retrieve(view=full) で取得。一覧段階では未取得。 */
  content?: string;
  /** 楽観ロック用。保存リクエストに載せ 409 判定に使う。 */
  contentSha256?: string;
}

export interface MemoryStoreView {
  kind: MemoryStoreKind;
  label: string; // 「個人設定（全エージェント共通）」/「このエージェント（○○）」
  storeId: string; // 'memstore_...'
  files: MemoryFile[];
}

/** 選択中ファイルを storeKind + fileId で指す。 */
export type MemorySelection = { storeKind: MemoryStoreKind; fileId: string } | null;

/** ビューアの編集モード。 */
export type MemoryViewMode = 'view' | 'edit';

/** 非同期状態。 */
export type MemoryAsyncState = 'idle' | 'loading' | 'saving' | 'conflict' | 'error';

// ── 派生ヘルパー ─────────────────────────────────────

/** '/preferences/general.md' → 'general.md' */
export function basename(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

/** 1234 → '1.2 KB' / 0 → '空'。 */
export function byteLabel(sizeBytes: number): string {
  if (sizeBytes <= 0) return '空';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const kb = sizeBytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** ISO → '5分前' / '3時間前' / '4/18' の軽量相対表記。 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}日前`;
  return `${then.getMonth() + 1}/${then.getDate()}`;
}

/** store が空（ファイル無し / 全ファイル 0 バイト）か。 */
export function isStoreEmpty(store: MemoryStoreView): boolean {
  return store.files.length === 0 || store.files.every((f) => f.sizeBytes <= 0);
}

/** selection から対象 store / file を引く。 */
export function resolveSelection(
  stores: MemoryStoreView[],
  sel: MemorySelection,
): { store: MemoryStoreView; file: MemoryFile } | null {
  if (!sel) return null;
  const store = stores.find((s) => s.kind === sel.storeKind);
  if (!store) return null;
  const file = store.files.find((f) => f.id === sel.fileId);
  if (!file) return null;
  return { store, file };
}
