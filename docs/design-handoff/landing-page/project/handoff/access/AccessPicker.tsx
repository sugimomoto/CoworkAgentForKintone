// ─────────────────────────────────────────────────────────────
// AccessPicker.tsx — 「公開先」セクション 本体 (推奨案 A: 縦スタック / OR カード)
//
// AgentDetailModal の「クイックアクション」と「Skills」の間に差し込む。
// 3 軸 (ユーザー / グループ / 組織) を独立カードで縦に積み、間に OR バッジ。
// 3 軸すべて空なら「全員に公開」を最上部に明示。
//
// スタイルは既存トークン (bg-card / border-card-border / text-text /
// text-muted / bg-accent / bg-accent-soft 等)。軸の識別色のみ AXES.tint を
// CSS 変数 --axis で渡し、arbitrary value で着色する (ハードコード class なし)。
// ─────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessValue,
  AccessEntry,
  AccessAxisKind,
  AccessSearchFn,
  accessCounts,
  userLabel,
} from './accessControl';

interface AxisDef {
  key: keyof AccessValue;
  kind: AccessAxisKind;
  label: string;
  unit: string;
  placeholder: string;
  /** 軸の識別色。user = accent、group/org は彩度を抑えた業務トーン。 */
  tint: string;
}

const AXES: AxisDef[] = [
  { key: 'allowedUsers',         kind: 'user',  label: 'ユーザー', unit: '人',       placeholder: '名前 / ログイン名で検索', tint: 'var(--color-accent, #0d9488)' },
  { key: 'allowedGroups',        kind: 'group', label: 'グループ', unit: 'グループ', placeholder: 'グループ名で検索',        tint: '#7c6aa8' },
  { key: 'allowedOrganizations', kind: 'org',   label: '組織',     unit: '組織',     placeholder: '組織名で検索',            tint: '#2f6f9f' },
];

export interface AccessPickerProps {
  value: AccessValue;
  onChange: (next: AccessValue) => void;
  searchUsers: AccessSearchFn;
  searchGroups: AccessSearchFn;
  searchOrganizations: AccessSearchFn;
  /** 既存 code → name の解決 (任意)。未指定だと初期チップは code 表示。 */
  resolveEntries?: (kind: AccessAxisKind, codes: string[]) => Promise<AccessEntry[]>;
}

// ── icons ────────────────────────────────────────────────────
const ico = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const UserIcon = ({ c = 'w-3.5 h-3.5' }) => <svg className={c} viewBox="0 0 16 16" strokeWidth={1.7} {...ico}><circle cx="8" cy="5" r="2.6" /><path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" /></svg>;
const GroupIcon = ({ c = 'w-3.5 h-3.5' }) => <svg className={c} viewBox="0 0 18 16" strokeWidth={1.6} {...ico}><circle cx="6.5" cy="5" r="2.3" /><path d="M2 13c0-2.2 2-3.4 4.5-3.4S11 10.8 11 13M12 4.2A2.2 2.2 0 0114.5 7M13 9.8c1.7.2 3 1.3 3 3.2" /></svg>;
const OrgIcon = ({ c = 'w-3.5 h-3.5' }) => <svg className={c} viewBox="0 0 16 16" strokeWidth={1.6} {...ico}><path d="M8 2v3M3.5 13.5V8.5h9v5M8 5v2.5M3.5 8.5h9" /><rect x="2" y="13.5" width="3" height="1" rx=".3" /><rect x="11" y="13.5" width="3" height="1" rx=".3" /><rect x="6.5" y="13.5" width="3" height="1" rx=".3" /></svg>;
const GlobeIcon = ({ c = 'w-4 h-4' }) => <svg className={c} viewBox="0 0 18 18" strokeWidth={1.55} {...ico}><circle cx="9" cy="9" r="6.5" /><path d="M2.5 9h13M9 2.5c2 2 2 11 0 13M9 2.5c-2 2-2 11 0 13" /></svg>;
const SearchIcon = ({ c = 'w-3.5 h-3.5' }) => <svg className={c} viewBox="0 0 14 14" strokeWidth={1.6} {...ico}><circle cx="6" cy="6" r="4" /><path d="M9.2 9.2L12 12" /></svg>;
const Spinner = ({ c = 'w-3.5 h-3.5' }) => <svg className={`${c} animate-spin`} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" className="stroke-border" strokeWidth={2} /><path d="M8 2a6 6 0 016 6" className="stroke-accent" strokeWidth={2} strokeLinecap="round" /></svg>;
const AlertIcon = ({ c = 'w-3.5 h-3.5' }) => <svg className={c} viewBox="0 0 14 14" strokeWidth={1.5} {...ico}><path d="M7 1.5l5.5 9.5h-11z" /><path d="M7 5.5v2.5M7 9.6h.01" /></svg>;
const XIcon = ({ c = 'w-2.5 h-2.5' }) => <svg className={c} viewBox="0 0 12 12" strokeWidth={1.7} {...ico}><path d="M3 3l6 6M9 3l-6 6" /></svg>;
const PlusIcon = ({ c = 'w-3 h-3' }) => <svg className={c} viewBox="0 0 14 14" strokeWidth={1.7} {...ico}><path d="M7 2.5v9M2.5 7h9" /></svg>;
const CheckIcon = ({ c = 'w-4 h-4' }) => <svg className={c} viewBox="0 0 16 16" strokeWidth={1.6} {...ico}><path d="M3 8.5l3 3 7-7.5" /></svg>;

const AxisGlyph = ({ kind, c }: { kind: AccessAxisKind; c?: string }) =>
  kind === 'user' ? <UserIcon c={c} /> : kind === 'group' ? <GroupIcon c={c} /> : <OrgIcon c={c} />;

const initialOf = (name: string) => (name?.trim()?.[0] ?? '?');

// ── 軸タイル / イニシャルバブル ───────────────────────────────
function AxisTile({ kind, size = 26 }: { kind: AccessAxisKind; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[7px] bg-[var(--axis)]/10 text-[color:var(--axis)]"
      style={{ width: size, height: size }}
    >
      <AxisGlyph kind={kind} c="w-3.5 h-3.5" />
    </span>
  );
}
function InitialBubble({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--axis)]/15 font-bold text-[color:var(--axis)]"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initialOf(name)}
    </span>
  );
}

// ── チップ ────────────────────────────────────────────────────
function EntryChip({ kind, entry, onRemove }: { kind: AccessAxisKind; entry: AccessEntry; onRemove: () => void }) {
  return (
    <span
      title={entry.code}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card ${kind === 'user' ? 'py-0.5 pl-0.5 pr-1.5' : 'py-[3px] pl-2 pr-1.5'}`}
    >
      {kind === 'user' ? <InitialBubble name={entry.name} size={18} /> : <AxisGlyph kind={kind} c="w-3 h-3 text-[color:var(--axis)]" />}
      <span className="truncate text-[12px] font-medium text-text" style={{ maxWidth: kind === 'user' ? 230 : 150 }}>{kind === 'user' ? userLabel(entry) : entry.name}</span>
      <button
        type="button"
        aria-label={`${entry.name} を削除`}
        onClick={onRemove}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-subtle transition hover:bg-border hover:text-text"
      >
        <XIcon c="w-[9px] h-[9px]" />
      </button>
    </span>
  );
}

// ── 候補行 ────────────────────────────────────────────────────
function ResultRow({ kind, entry, active, onPick }: { kind: AccessAxisKind; entry: AccessEntry; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onPick(); }}
      className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition ${active ? 'bg-accent-soft' : 'hover:bg-card-hi'}`}
    >
      {kind === 'user' ? <InitialBubble name={entry.name} size={24} /> : <AxisTile kind={kind} size={24} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-text">{kind === 'user' ? userLabel(entry) : entry.name}</span>
        {entry.meta && <span className="block truncate font-mono text-[10px] text-subtle">{entry.meta}</span>}
      </span>
      <span className={active ? 'text-accent' : 'text-subtle opacity-50'}><PlusIcon c="w-3 h-3" /></span>
    </button>
  );
}

// ── debounce 付き 軸検索フック ───────────────────────────────
function useAxisSearch(search: AccessSearchFn, exclude: string[]) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [results, setResults] = useState<AccessEntry[]>([]);
  const [active, setActive] = useState(0);
  const timer = useRef<number | null>(null);
  const reqId = useRef(0);
  const excludeRef = useRef(exclude);
  excludeRef.current = exclude;

  const run = useCallback((q: string) => {
    const id = ++reqId.current;
    setLoading(true); setError(false);
    search(q, { exclude: excludeRef.current })
      .then((res) => { if (id === reqId.current) { setResults(res); setLoading(false); setActive(0); } })
      .catch(() => { if (id === reqId.current) { setError(true); setLoading(false); setResults([]); } });
  }, [search]);

  const onChange = (q: string) => {
    setQuery(q); setOpen(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => run(q), 300);
  };

  return { query, setQuery, open, setOpen, loading, error, results, active, setActive, onChange, run };
}

// ── 軸の検索フィールド + ドロップダウン ──────────────────────
function AxisSearchField({
  axis, exclude, search, onAdd,
}: { axis: AxisDef; exclude: string[]; search: AccessSearchFn; onAdd: (e: AccessEntry) => void }) {
  const s = useAxisSearch(search, exclude);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) s.setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  });

  const pick = (entry: AccessEntry) => { onAdd(entry); s.setQuery(''); window.setTimeout(() => s.run(''), 0); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); s.setActive((i) => Math.min(i + 1, s.results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); s.setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = s.results[s.active]; if (r) pick(r); }
    else if (e.key === 'Escape') { s.setOpen(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className={`flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 transition ${s.open ? 'border-accent ring-[3px] ring-accent/10' : 'border-border'}`}>
        <span className="text-subtle">{s.loading ? <Spinner /> : <SearchIcon />}</span>
        <input
          value={s.query}
          onChange={(e) => s.onChange(e.target.value)}
          onFocus={() => { s.setOpen(true); s.run(s.query); }}
          onKeyDown={onKey}
          placeholder={axis.placeholder}
          aria-label={`${axis.label}を検索`}
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-text placeholder:text-subtle focus:outline-none"
        />
        {s.query && (
          <button type="button" aria-label="クリア" onClick={() => { s.setQuery(''); s.run(''); }} className="flex text-subtle hover:text-text">
            <XIcon />
          </button>
        )}
      </div>

      {s.open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 overflow-hidden rounded-[10px] border border-[color:rgba(35,18,0,0.18)] bg-card shadow-[0_12px_32px_rgba(35,18,0,0.13)]">
          {s.error ? (
            <div className="flex items-start gap-2.5 p-3">
              <span className="text-[color:var(--color-warn,#b45309)]"><AlertIcon /></span>
              <div className="flex-1">
                <div className="mb-0.5 text-[11.5px] font-semibold text-text">候補を取得できませんでした</div>
                <div className="text-[10.5px] leading-relaxed text-muted">kintone API への接続を確認してください。</div>
              </div>
              <button type="button" onClick={() => s.run(s.query)} className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-text">再試行</button>
            </div>
          ) : s.loading && s.results.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2.5 text-[11.5px] text-muted"><Spinner c="w-3 h-3" /> 検索中…</div>
          ) : s.results.length === 0 ? (
            <div className="px-3 py-3.5 text-center">
              <div className="text-[11.5px] text-muted">「{s.query}」に一致する{axis.label}はありません</div>
              <div className="mt-0.5 text-[10px] text-subtle">選択済みの項目は候補に表示されません</div>
            </div>
          ) : (
            <div className="max-h-[232px] overflow-y-auto">
              {s.query === '' && <div className="px-2.5 pb-0.5 pt-1.5 text-[9px] font-bold uppercase tracking-wider text-subtle">候補</div>}
              {s.results.map((entry, i) => (
                <ResultRow key={entry.code} kind={axis.kind} entry={entry} active={i === s.active} onPick={() => pick(entry)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 軸カード ──────────────────────────────────────────────────
function AxisCard({
  axis, codes, entriesByCode, search, onAdd, onRemove,
}: {
  axis: AxisDef;
  codes: string[];
  entriesByCode: Map<string, AccessEntry>;
  search: AccessSearchFn;
  onAdd: (e: AccessEntry) => void;
  onRemove: (code: string) => void;
}) {
  const n = codes.length;
  return (
    <div className="flex flex-col gap-2.5 rounded-[11px] border border-card-border bg-card p-3" style={{ ['--axis' as never]: axis.tint }}>
      <div className="flex items-center gap-2.5">
        <AxisTile kind={axis.kind} />
        <span className="text-[12.5px] font-semibold text-text">{axis.label}</span>
        <span className={`rounded-full font-mono text-[10.5px] font-semibold tabular-nums ${n ? 'bg-[var(--axis)]/10 px-1.5 py-px text-[color:var(--axis)]' : 'text-subtle'}`} style={{ whiteSpace: 'nowrap' }}>
          {n ? `${n}${axis.unit}` : '指定なし'}
        </span>
      </div>

      <AxisSearchField axis={axis} exclude={codes} search={search} onAdd={onAdd} />

      {n > 0 && (
        <div className="flex max-h-[132px] flex-wrap gap-1.5 overflow-y-auto">
          {codes.map((code) => {
            const entry = entriesByCode.get(code) ?? { code, name: code };
            return <EntryChip key={code} kind={axis.kind} entry={entry} onRemove={() => onRemove(code)} />;
          })}
        </div>
      )}
    </div>
  );
}

// ── OR コネクタ ──────────────────────────────────────────────
function OrConnector({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-1 py-0.5">
      <span className="h-px flex-1 bg-border" />
      <span className={`rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-extrabold tracking-widest ${active ? 'border-accent/25 bg-accent-soft text-accent' : 'border-border bg-card-hi text-subtle'}`}>OR</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

// ── ステータス バナー ────────────────────────────────────────
function AccessStatus({ value }: { value: AccessValue }) {
  const { u, g, o, total, isOpen } = accessCounts(value);
  if (isOpen) {
    return (
      <div className="flex items-center gap-3 rounded-[10px] border border-border bg-card-hi px-3.5 py-3">
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted"><GlobeIcon /></span>
        <div className="flex-1">
          <div className="text-[12.5px] font-bold text-text">全員に公開</div>
          <div className="mt-px text-[10.5px] leading-relaxed text-muted">この kintone を使う全ユーザーがこのエージェントを利用できます。絞り込むには下で追加します。</div>
        </div>
      </div>
    );
  }
  const segs = [u && `${u}人`, g && `${g}グループ`, o && `${o}組織`].filter(Boolean);
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-accent/20 bg-accent-soft/60 px-3.5 py-3">
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent"><CheckIcon /></span>
      <div className="flex-1">
        <div className="text-[12.5px] font-bold text-text">指定したメンバーに公開 <span className="text-[11px] font-medium text-muted">· 合計 {total} 件</span></div>
        <div className="mt-px text-[10.5px] text-muted">{segs.join(' ・ ')} のいずれかに該当するユーザーが利用できます（OR 結合）</div>
      </div>
    </div>
  );
}

// ── 本体 ──────────────────────────────────────────────────────
export function AccessPicker({
  value, onChange, searchUsers, searchGroups, searchOrganizations, resolveEntries,
}: AccessPickerProps) {
  const searchByKind: Record<AccessAxisKind, AccessSearchFn> = {
    user: searchUsers, group: searchGroups, org: searchOrganizations,
  };

  // 選択済み code → AccessEntry のキャッシュ (チップ名の解決用)。
  const [cache, setCache] = useState<Map<string, AccessEntry>>(new Map());
  const cacheEntry = (e: AccessEntry) => setCache((m) => new Map(m).set(e.code, e));

  // 初期 value の未知 code を resolveEntries で名前解決 (任意)。
  useEffect(() => {
    if (!resolveEntries) return;
    AXES.forEach((axis) => {
      const missing = value[axis.key].filter((c) => !cache.has(c));
      if (missing.length === 0) return;
      resolveEntries(axis.kind, missing).then((entries) => {
        setCache((m) => { const next = new Map(m); entries.forEach((e) => next.set(e.code, e)); return next; });
      }).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, resolveEntries]);

  const add = (axisKey: keyof AccessValue) => (entry: AccessEntry) => {
    cacheEntry(entry);
    onChange({ ...value, [axisKey]: [...value[axisKey], entry.code] });
  };
  const remove = (axisKey: keyof AccessValue) => (code: string) => {
    onChange({ ...value, [axisKey]: value[axisKey].filter((c) => c !== code) });
  };

  const nonEmpty = AXES.map((a) => value[a.key].length > 0);

  return (
    <div className="flex flex-col gap-3">
      <AccessStatus value={value} />
      <div className="flex flex-col gap-2">
        {AXES.map((axis, i) => (
          <React.Fragment key={axis.key}>
            {i > 0 && <OrConnector active={nonEmpty[i - 1] && nonEmpty.slice(i).some(Boolean)} />}
            <AxisCard
              axis={axis}
              codes={value[axis.key]}
              entriesByCode={cache}
              search={searchByKind[axis.kind]}
              onAdd={add(axis.key)}
              onRemove={remove(axis.key)}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default AccessPicker;
