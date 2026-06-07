// ─────────────────────────────────────────────────────────────
// access-picker.jsx — 公開先 ピッカー 本体 (推奨案 A) + 共通プリミティブ
//   incremental search · チップ · OR 結合カード · 全員公開ステータス
// 依存: access-data.jsx (window 経由)
// ─────────────────────────────────────────────────────────────

// ╭───────────────────────────────────────────────────────────╮
// │ 共通プリミティブ                                            │
// ╰───────────────────────────────────────────────────────────╯

// 軸アイコンの角丸タイル
function AxisTile({ kind, color, size = 26, glyph = 14 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 7, flex: `0 0 ${size}px`,
      background: color + '14', color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <AxisIcon kind={kind} size={glyph} color="currentColor" />
    </span>
  );
}

// user 用イニシャルバブル
function InitialBubble({ name, color = AC.axisUser, size = 22 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flex: `0 0 ${size}px`,
      background: color + '1c', color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, letterSpacing: '-.02em',
    }}>{initialOf(name)}</span>
  );
}

// 選択済みチップ — name メイン / code は title(tooltip)
function EntryChip({ kind, entry, color, onRemove }) {
  return (
    <span
      title={entry.code}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: kind === 'user' ? '2px 6px 2px 2px' : '3px 7px 3px 8px',
        background: AC.card, border: `1px solid ${AC.border}`,
        borderRadius: 999, maxWidth: '100%',
      }}
    >
      {kind === 'user'
        ? <InitialBubble name={entry.name} color={color} size={18} />
        : <AxisIcon kind={kind} size={12} color={color} />}
      <span style={{
        fontSize: 12, color: entry._missing ? AC.warn : AC.text, fontWeight: 500,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: kind === 'user' ? 230 : 150,
      }}>{kind === 'user' ? userLabel(entry) : entry.name}</span>
      {onRemove && (
        <button
          aria-label={`${entry.name} を削除`}
          onClick={(e) => { e.stopPropagation(); onRemove(entry.code); }}
          style={{
            width: 16, height: 16, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'transparent', color: AC.subtle, flex: '0 0 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = AC.border; e.currentTarget.style.color = AC.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = AC.subtle; }}
        >
          <CloseX size={9} />
        </button>
      )}
    </span>
  );
}

// 候補ドロップダウンの 1 行
function ResultRow({ kind, entry, color, active, onPick }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onPick(entry); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
        padding: '7px 10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        background: active ? AC.accentSofter : 'transparent',
      }}
    >
      {kind === 'user'
        ? <InitialBubble name={entry.name} color={color} size={24} />
        : <AxisTile kind={kind} color={color} size={24} glyph={13} />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, color: AC.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {kind === 'user' ? userLabel(entry) : entry.name}
        </span>
        <span style={{ display: 'block', fontSize: 10, color: AC.subtle, fontFamily: MONO, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {kind === 'user' && entry.org}
          {kind === 'group' && `${entry.code} · ${entry.members}人`}
          {kind === 'org' && entry.path}
        </span>
      </span>
      <span style={{ flex: '0 0 auto', color: active ? AC.accent : AC.subtle, opacity: active ? 1 : 0.5 }}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2.5v9M2.5 7h9" /></svg>
      </span>
    </button>
  );
}

// ── debounce + async を内包した軸検索フック ──
const SEARCH_FN = { user: () => window.searchUsers, group: () => window.searchGroups, org: () => window.searchOrganizations };
function useAxisSearch(kind, excludeCodes) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [results, setResults] = React.useState([]);
  const [active, setActive] = React.useState(0);
  const timer = React.useRef(null);
  const reqId = React.useRef(0);
  const excludeRef = React.useRef(excludeCodes);
  excludeRef.current = excludeCodes;

  const run = React.useCallback((q) => {
    const id = ++reqId.current;
    setLoading(true); setError(false);
    SEARCH_FN[kind]()(q, { exclude: excludeRef.current })
      .then((res) => { if (id === reqId.current) { setResults(res); setLoading(false); setActive(0); } })
      .catch(() => { if (id === reqId.current) { setError(true); setLoading(false); setResults([]); } });
  }, [kind]);

  const onChange = (q) => {
    setQuery(q); setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(q), 300);
  };
  const focus = () => { setOpen(true); run(query); };
  const close = () => { setOpen(false); };
  const retry = () => run(query);

  return { query, setQuery, open, setOpen, loading, error, results, active, setActive, onChange, focus, close, retry };
}

// ── 1 軸ぶんの検索フィールド + ドロップダウン ──
function AxisSearchField({ axis, codes, onAdd, onRemove }) {
  const s = useAxisSearch(axis.kind, codes);
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    function onDoc(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) s.close(); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  });

  const pick = (entry) => {
    onAdd(entry.code);          // 親が codes を更新 → excludeRef も更新される
    s.setQuery('');
    // 追加直後に候補を引き直し、選択済みを候補から外す (重複防止)
    setTimeout(() => s.run(''), 0);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); s.setActive((i) => Math.min(i + 1, s.results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); s.setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = s.results[s.active]; if (r) pick(r); }
    else if (e.key === 'Escape') { s.close(); }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '6px 10px', borderRadius: 8,
        background: AC.card, border: `1px solid ${s.open ? AC.accent : AC.border}`,
        boxShadow: s.open ? `0 0 0 3px ${AC.accentSoft}` : 'none', transition: 'box-shadow .12s, border-color .12s',
      }}>
        {s.loading ? <Spinner size={14} /> : <SearchIcon size={14} />}
        <input
          value={s.query}
          onChange={(e) => s.onChange(e.target.value)}
          onFocus={s.focus}
          onKeyDown={onKey}
          placeholder={axis.ph}
          aria-label={`${axis.label}を検索`}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'inherit', fontSize: 12.5, color: AC.text,
          }}
        />
        {s.query && (
          <button aria-label="クリア" onClick={() => { s.setQuery(''); s.run(''); }} style={{
            border: 'none', background: 'transparent', cursor: 'pointer', color: AC.subtle, padding: 2, display: 'flex',
          }}><CloseX size={10} /></button>
        )}
      </div>

      {s.open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 40,
          background: AC.card, border: `1px solid ${AC.borderStrong}`, borderRadius: 10,
          boxShadow: '0 12px 32px rgba(35,18,0,0.13)', overflow: 'hidden',
        }}>
          {s.error ? (
            <div style={{ padding: '12px 12px', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <AlertIcon size={15} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11.5, color: AC.text, fontWeight: 600, marginBottom: 2 }}>候補を取得できませんでした</div>
                <div style={{ fontSize: 10.5, color: AC.muted, lineHeight: 1.5 }}>kintone API への接続を確認してください。</div>
              </div>
              <button onClick={s.retry} style={{
                padding: '4px 10px', borderRadius: 6, border: `1px solid ${AC.border}`,
                background: AC.card, color: AC.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>再試行</button>
            </div>
          ) : s.loading && s.results.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 11.5, color: AC.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Spinner size={13} /> 検索中…
            </div>
          ) : s.results.length === 0 ? (
            <div style={{ padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 11.5, color: AC.muted }}>「{s.query}」に一致する{axis.label}はありません</div>
              <div style={{ fontSize: 10, color: AC.subtle, marginTop: 3 }}>選択済みの項目は候補に表示されません</div>
            </div>
          ) : (
            <div style={{ maxHeight: 232, overflowY: 'auto' }}>
              {s.query === '' && (
                <div style={{ padding: '6px 11px 3px', fontSize: 9, fontWeight: 700, letterSpacing: '.06em', color: AC.subtle, textTransform: 'uppercase' }}>
                  候補
                </div>
              )}
              {s.results.map((entry, i) => (
                <ResultRow key={entry.code} kind={axis.kind} entry={entry} color={axis.color}
                  active={i === s.active} onPick={pick} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 1 軸カード (ヘッダ + 検索 + チップ群) ──
function AxisCard({ axis, codes, onAdd, onRemove, maxChipH = 132 }) {
  const entries = codes.map((code) => resolveEntry(axis.kind, code));
  return (
    <div style={{
      background: AC.card, border: `1px solid ${AC.cardBorder}`, borderRadius: 11,
      padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <AxisTile kind={axis.kind} color={axis.color} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: AC.text }}>{axis.label}</span>
        <span style={{
          fontSize: 10.5, fontFamily: MONO, fontVariantNumeric: 'tabular-nums',
          color: codes.length ? axis.color : AC.subtle,
          background: codes.length ? axis.color + '14' : 'transparent',
          padding: codes.length ? '1px 7px' : 0, borderRadius: 999, fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>{codes.length ? `${codes.length}${axis.unit}` : '指定なし'}</span>
      </div>

      <AxisSearchField axis={axis} codes={codes} onAdd={onAdd} onRemove={onRemove} />

      {entries.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: maxChipH, overflowY: 'auto' }}>
          {entries.map((entry) => (
            <EntryChip key={entry.code} kind={axis.kind} entry={entry} color={axis.color} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── OR コネクタ (カード間) ──
function OrConnector({ active }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 4px' }}>
      <span style={{ flex: 1, height: 1, background: AC.border }} />
      <span style={{
        fontSize: 9.5, fontWeight: 800, letterSpacing: '.1em', fontFamily: MONO,
        padding: '2px 9px', borderRadius: 999,
        color: active ? AC.accent : AC.subtle,
        background: active ? AC.accentSoft : AC.cardHi,
        border: `1px solid ${active ? AC.accent + '40' : AC.border}`,
      }}>OR</span>
      <span style={{ flex: 1, height: 1, background: AC.border }} />
    </div>
  );
}

// ── 公開先ステータス バナー ──
function AccessStatus({ value }) {
  const { u, g, o, total, isOpen } = accessCounts(value);
  if (isOpen) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '11px 13px', borderRadius: 10,
        background: AC.cardHi, border: `1px solid ${AC.border}`,
      }}>
        <span style={{
          width: 30, height: 30, borderRadius: 8, flex: '0 0 30px',
          background: AC.card, border: `1px solid ${AC.border}`, color: AC.muted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><GlobeIcon size={16} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: AC.text }}>全員に公開</div>
          <div style={{ fontSize: 10.5, color: AC.muted, marginTop: 1, lineHeight: 1.5 }}>
            この kintone を使う全ユーザーがこのエージェントを利用できます。絞り込むには下で追加します。
          </div>
        </div>
      </div>
    );
  }
  const segs = [u && `${u}人`, g && `${g}グループ`, o && `${o}組織`].filter(Boolean);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11,
      padding: '11px 13px', borderRadius: 10,
      background: AC.accentSofter, border: `1px solid ${AC.accent}33`,
    }}>
      <span style={{
        width: 30, height: 30, borderRadius: 8, flex: '0 0 30px',
        background: AC.accent, color: AC.onAccent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3 3 7-7.5" /></svg>
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: AC.text }}>
          指定したメンバーに公開 <span style={{ color: AC.muted, fontWeight: 500, fontSize: 11 }}>· 合計 {total} 件</span>
        </div>
        <div style={{ fontSize: 10.5, color: AC.muted, marginTop: 1 }}>
          {segs.join(' ・ ')} のいずれかに該当するユーザーが利用できます（OR 結合）
        </div>
      </div>
    </div>
  );
}

// ╭───────────────────────────────────────────────────────────╮
// │ 推奨案 A — 縦スタック / OR カード                           │
// ╰───────────────────────────────────────────────────────────╯
function AccessPicker({ initial, onChange }) {
  const [value, setValue] = React.useState(initial || { allowedUsers: [], allowedGroups: [], allowedOrganizations: [] });
  const set = (next) => { setValue(next); onChange && onChange(next); };
  const add = (axisKey) => (code) => set({ ...value, [axisKey]: [...value[axisKey], code] });
  const remove = (axisKey) => (code) => set({ ...value, [axisKey]: value[axisKey].filter((c) => c !== code) });

  const nonEmpty = AXES.map((a) => value[a.key].length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AccessStatus value={value} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {AXES.map((axis, i) => (
          <React.Fragment key={axis.key}>
            {i > 0 && <OrConnector active={nonEmpty[i - 1] && nonEmpty.slice(i).some(Boolean)} />}
            <AxisCard axis={axis} codes={value[axis.key]} onAdd={add(axis.key)} onRemove={remove(axis.key)} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  AxisTile, InitialBubble, EntryChip, ResultRow, useAxisSearch, AxisSearchField,
  AxisCard, OrConnector, AccessStatus, AccessPicker,
});
