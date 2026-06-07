// ─────────────────────────────────────────────────────────────
// access-explore.jsx — 比較用レイアウト案 B/C/D · マイクロ UX ·
//   サマリ フォーマット · エッジケース · 比較表 / 推奨理由
// 依存: access-data.jsx, access-picker.jsx (window 経由)
// ─────────────────────────────────────────────────────────────

// 共通サンプル値
const V_OPEN = { allowedUsers: [], allowedGroups: [], allowedOrganizations: [] };
const V_BALANCED = {
  allowedUsers: ['sato@example.co.jp', 'tanaka@example.co.jp', 'suzuki@example.co.jp', 'takahashi@example.co.jp', 'watanabe@example.co.jp'],
  allowedGroups: ['sales-dept', 'managers'],
  allowedOrganizations: ['org-tokyo-sales'],
};
const V_GROUPS_ONLY = { allowedUsers: [], allowedGroups: ['sales-dept', 'customer-success'], allowedOrganizations: ['org-cs'] };

// ╭───────────────────────────────────────────────────────────╮
// │ 案 B — タブ切替 (1 検索にフォーカス)                         │
// ╰───────────────────────────────────────────────────────────╯
function VariantTabs({ initial }) {
  const [value, setValue] = React.useState(initial || V_BALANCED);
  const [tab, setTab] = React.useState('user');
  const axis = AXIS_BY_KIND[tab];
  const set = (next) => setValue(next);
  const add = (code) => set({ ...value, [axis.key]: [...value[axis.key], code] });
  const remove = (code) => set({ ...value, [axis.key]: value[axis.key].filter((c) => c !== code) });
  const counts = accessCounts(value);
  const entries = value[axis.key].map((c) => resolveEntry(axis.kind, c));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AccessStatus value={value} />
      {/* タブ */}
      <div style={{ display: 'flex', gap: 4, background: AC.cardHi, border: `1px solid ${AC.border}`, borderRadius: 9, padding: 3 }}>
        {AXES.map((a) => {
          const on = a.kind === tab;
          const n = value[a.key].length;
          return (
            <button key={a.key} onClick={() => setTab(a.kind)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '7px 8px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
              border: 'none', background: on ? AC.card : 'transparent',
              boxShadow: on ? '0 1px 3px rgba(35,18,0,0.08)' : 'none',
              color: on ? AC.text : AC.muted, fontSize: 12, fontWeight: on ? 700 : 500,
            }}>
              <AxisIcon kind={a.kind} size={13} color={on ? a.color : AC.subtle} />
              {a.label}
              <span style={{
                fontSize: 10, fontFamily: MONO, fontWeight: 700,
                color: n ? a.color : AC.subtle, background: n ? a.color + '14' : 'transparent',
                padding: n ? '0 5px' : 0, borderRadius: 999,
              }}>{n || ''}</span>
            </button>
          );
        })}
      </div>
      {/* アクティブ軸 */}
      <div style={{ background: AC.card, border: `1px solid ${AC.cardBorder}`, borderRadius: 11, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AxisSearchField axis={axis} codes={value[axis.key]} onAdd={add} onRemove={remove} />
        {entries.length > 0
          ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
              {entries.map((e) => <EntryChip key={e.code} kind={axis.kind} entry={e} color={axis.color} onRemove={remove} />)}
            </div>
          : <div style={{ fontSize: 11, color: AC.subtle, padding: '4px 2px' }}>この軸はまだ指定がありません</div>}
      </div>
    </div>
  );
}

// ╭───────────────────────────────────────────────────────────╮
// │ 案 C — 横 3 カラム (680px に詰め込む)                        │
// ╰───────────────────────────────────────────────────────────╯
function VariantColumns({ initial }) {
  const [value, setValue] = React.useState(initial || V_BALANCED);
  const add = (k) => (code) => setValue({ ...value, [k]: [...value[k], code] });
  const remove = (k) => (code) => setValue({ ...value, [k]: value[k].filter((c) => c !== code) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AccessStatus value={value} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'stretch', gap: 0 }}>
        {AXES.map((axis, i) => (
          <React.Fragment key={axis.key}>
            {i > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                <span style={{ fontSize: 9, fontWeight: 800, fontFamily: MONO, letterSpacing: '.08em', color: AC.subtle, background: AC.cardHi, border: `1px solid ${AC.border}`, padding: '2px 6px', borderRadius: 999 }}>OR</span>
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <AxisCard axis={axis} codes={value[axis.key]} onAdd={add(axis.key)} onRemove={remove(axis.key)} maxChipH={120} />
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ╭───────────────────────────────────────────────────────────╮
// │ 案 D — 統合 1 検索 (種別をまたいで横断検索)                  │
// ╰───────────────────────────────────────────────────────────╯
function VariantUnified({ initial }) {
  const [value, setValue] = React.useState(initial || V_BALANCED);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [res, setRes] = React.useState({ user: [], group: [], org: [] });
  const timer = React.useRef(null);
  const wrapRef = React.useRef(null);

  const excludeFor = (kind) => value[AXIS_BY_KIND[kind].key];
  const run = (q) => {
    setLoading(true);
    Promise.all([
      searchUsers(q, { exclude: excludeFor('user') }),
      searchGroups(q, { exclude: excludeFor('group') }),
      searchOrganizations(q, { exclude: excludeFor('org') }),
    ]).then(([u, g, o]) => {
      setRes({ user: u.slice(0, 4), group: g.slice(0, 3), org: o.slice(0, 3) });
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  const onChange = (q) => { setQuery(q); setOpen(true); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => run(q), 300); };
  const pick = (kind, entry) => {
    const k = AXIS_BY_KIND[kind].key;
    setValue({ ...value, [k]: [...value[k], entry.code] });
    setQuery(''); setTimeout(() => run(''), 0);
  };
  const remove = (kind, code) => { const k = AXIS_BY_KIND[kind].key; setValue({ ...value, [k]: value[k].filter((c) => c !== code) }); };
  React.useEffect(() => {
    function onDoc(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc);
  });
  const total = res.user.length + res.group.length + res.org.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AccessStatus value={value} />
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9,
          background: AC.card, border: `1px solid ${open ? AC.accent : AC.border}`,
          boxShadow: open ? `0 0 0 3px ${AC.accentSoft}` : 'none',
        }}>
          {loading ? <Spinner size={15} /> : <SearchIcon size={15} />}
          <input value={query} onChange={(e) => onChange(e.target.value)} onFocus={() => { setOpen(true); run(query); }}
            placeholder="ユーザー・グループ・組織 をまとめて検索"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: AC.text }} />
        </div>
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 40, background: AC.card, border: `1px solid ${AC.borderStrong}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(35,18,0,0.13)', overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
            {loading && total === 0
              ? <div style={{ padding: '10px 12px', fontSize: 11.5, color: AC.muted, display: 'flex', gap: 8, alignItems: 'center' }}><Spinner size={13} /> 検索中…</div>
              : total === 0
                ? <div style={{ padding: '14px', textAlign: 'center', fontSize: 11.5, color: AC.muted }}>該当なし</div>
                : AXES.map((a) => res[a.kind].length > 0 && (
                  <div key={a.kind}>
                    <div style={{ padding: '6px 11px 3px', fontSize: 9, fontWeight: 700, letterSpacing: '.06em', color: a.color, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <AxisIcon kind={a.kind} size={11} color={a.color} /> {a.label}
                    </div>
                    {res[a.kind].map((entry) => (
                      <ResultRow key={entry.code} kind={a.kind} entry={entry} color={a.color} active={false} onPick={(en) => pick(a.kind, en)} />
                    ))}
                  </div>
                ))}
          </div>
        )}
      </div>
      {/* 選択済み — 軸ごとに色分けして 1 か所に集約 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {AXES.map((a) => value[a.key].length > 0 && (
          <div key={a.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 84px', paddingTop: 4, fontSize: 10.5, fontWeight: 600, color: a.color }}>
              <AxisIcon kind={a.kind} size={12} color={a.color} />{a.label}
            </span>
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {value[a.key].map((c) => <EntryChip key={c} kind={a.kind} entry={resolveEntry(a.kind, c)} color={a.color} onRemove={(code) => remove(a.kind, code)} />)}
            </div>
          </div>
        ))}
        {accessCounts(value).isOpen && <div style={{ fontSize: 11, color: AC.subtle, textAlign: 'center', padding: '6px 0' }}>まだ誰も指定されていません</div>}
      </div>
    </div>
  );
}

// ╭───────────────────────────────────────────────────────────╮
// │ マイクロ UX — 検索フィールド各状態 (静的)                    │
// ╰───────────────────────────────────────────────────────────╯
function FieldShell({ icon, children, focused }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', borderRadius: 8, background: AC.card, border: `1px solid ${focused ? AC.accent : AC.border}`, boxShadow: focused ? `0 0 0 3px ${AC.accentSoft}` : 'none' }}>
      {icon}
      {children}
    </div>
  );
}
function DropShell({ children }) {
  return <div style={{ marginTop: 4, background: AC.card, border: `1px solid ${AC.borderStrong}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(35,18,0,0.13)', overflow: 'hidden' }}>{children}</div>;
}
function MicroFrame({ title, note, children }) {
  return (
    <div style={{ background: AC.card, border: `1px solid ${AC.cardBorder}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: AC.text }}>{title}</div>
        {note && <div style={{ fontSize: 10.5, color: AC.muted, marginTop: 2, lineHeight: 1.5 }}>{note}</div>}
      </div>
      {children}
    </div>
  );
}
function FakeInput({ text, ph }) {
  return <span style={{ flex: 1, fontSize: 12.5, color: text ? AC.text : AC.subtle }}>{text || ph}{text && <span className="ac-caret" style={{ display: 'inline-block', width: 1, height: 14, background: AC.accent, marginLeft: 1, verticalAlign: -2 }} />}</span>;
}

function MicroStates() {
  const u = DIR_USERS;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <MicroFrame title="① フォーカス（入力前）" note="フォーカスで候補を即表示。先頭に「候補」見出し。">
        <FieldShell focused icon={<SearchIcon size={14} />}><FakeInput ph="名前 / ログイン名で検索" /></FieldShell>
        <DropShell>
          <div style={{ padding: '6px 11px 3px', fontSize: 9, fontWeight: 700, letterSpacing: '.06em', color: AC.subtle, textTransform: 'uppercase' }}>候補</div>
          {[u[0], u[1], u[3]].map((e) => <ResultRow key={e.code} kind="user" entry={e} color={AC.axisUser} active={false} onPick={() => {}} />)}
        </DropShell>
      </MicroFrame>

      <MicroFrame title="② 入力中（loading）" note="debounce 300ms。検索アイコンが spinner に差し替わる。">
        <FieldShell focused icon={<Spinner size={14} />}><FakeInput text="さと" /></FieldShell>
        <DropShell><div style={{ padding: '10px 12px', fontSize: 11.5, color: AC.muted, display: 'flex', gap: 8, alignItems: 'center' }}><Spinner size={13} /> 検索中…</div></DropShell>
      </MicroFrame>

      <MicroFrame title="③ 候補表示 + キーボード選択" note="↑↓ で移動・Enter で確定。アクティブ行は accent 淡色。各行に code / 所属。">
        <FieldShell focused icon={<SearchIcon size={14} />}><FakeInput text="さ" /></FieldShell>
        <DropShell>
          <ResultRow kind="user" entry={u[0]} color={AC.axisUser} active onPick={() => {}} />
          <ResultRow kind="user" entry={u[12]} color={AC.axisUser} active={false} onPick={() => {}} />
        </DropShell>
      </MicroFrame>

      <MicroFrame title="④ グループ / 組織の候補" note="user は initial バブル、group / org は角丸タイル + 件数 / 階層パス。">
        <FieldShell focused icon={<SearchIcon size={14} />}><FakeInput text="営業" /></FieldShell>
        <DropShell>
          <div style={{ padding: '6px 11px 3px', fontSize: 9, fontWeight: 700, letterSpacing: '.06em', color: AC.axisGroup, textTransform: 'uppercase' }}>グループ</div>
          <ResultRow kind="group" entry={DIR_GROUPS[0]} color={AC.axisGroup} active={false} onPick={() => {}} />
          <ResultRow kind="org" entry={DIR_ORGS[0]} color={AC.axisOrg} active={false} onPick={() => {}} />
        </DropShell>
      </MicroFrame>

      <MicroFrame title="⑤ 該当なし" note="ゼロ件は短く。選択済みが候補から外れる旨も添える。">
        <FieldShell focused icon={<SearchIcon size={14} />}><FakeInput text="zzzz" /></FieldShell>
        <DropShell>
          <div style={{ padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11.5, color: AC.muted }}>「zzzz」に一致するユーザーはありません</div>
            <div style={{ fontSize: 10, color: AC.subtle, marginTop: 3 }}>選択済みの項目は候補に表示されません</div>
          </div>
        </DropShell>
      </MicroFrame>

      <MicroFrame title="⑥ API エラー → 再試行" note="kintone API 失敗時。入力済みチップは保持し、候補のみ失敗を表示。">
        <FieldShell focused icon={<SearchIcon size={14} />}><FakeInput text="たな" /></FieldShell>
        <DropShell>
          <div style={{ padding: '12px', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <AlertIcon size={15} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: AC.text, fontWeight: 600, marginBottom: 2 }}>候補を取得できませんでした</div>
              <div style={{ fontSize: 10.5, color: AC.muted, lineHeight: 1.5 }}>kintone API への接続を確認してください。</div>
            </div>
            <button style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${AC.border}`, background: AC.card, color: AC.text, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>再試行</button>
          </div>
        </DropShell>
      </MicroFrame>
    </div>
  );
}

// ╭───────────────────────────────────────────────────────────╮
// │ サマリ フォーマット (AgentsListPane 用) 3 案                 │
// ╰───────────────────────────────────────────────────────────╯
const SUMMARY_SAMPLES = [
  { name: '業務エージェント', v: V_OPEN },
  { name: 'カスタマイザー (Opus)', v: { allowedUsers: ['sato', 'tanaka', 'suzuki', 'takahashi', 'watanabe'], allowedGroups: [], allowedOrganizations: [] } },
  { name: '営業レポート Bot', v: V_BALANCED },
  { name: '情シス専用 Agent', v: V_GROUPS_ONLY },
  { name: '採用支援 Agent', v: { allowedUsers: Array.from({ length: 30 }, (_, i) => 'u' + i), allowedGroups: [], allowedOrganizations: [] } },
];
function PartChips({ v }) {
  const { isOpen, parts } = accessSummaryParts(v);
  if (isOpen) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: AC.muted }}><GlobeIcon size={12} color={AC.subtle} /> 全員</span>;
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      {parts.map((p) => (
        <span key={p.kind} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: p.color, fontVariantNumeric: 'tabular-nums' }}>
          <AxisIcon kind={p.kind} size={12} color={p.color} />{p.n}
        </span>
      ))}
    </span>
  );
}
function SummaryTable({ format }) {
  return (
    <div style={{ background: AC.card, border: `1px solid ${AC.cardBorder}`, borderRadius: 11, overflow: 'hidden' }}>
      {SUMMARY_SAMPLES.map((row, i) => {
        const open = accessCounts(row.v).isOpen;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < SUMMARY_SAMPLES.length - 1 ? `1px solid ${AC.border}` : 'none' }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, flex: '0 0 24px', background: AC.accentSoft, color: AC.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="10" height="8" rx="2" /><path d="M8 5V2.5M6 8v.5M10 8v.5" /></svg>
            </span>
            <span style={{ flex: 1, fontSize: 12.5, color: AC.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
            <span style={{ flex: '0 0 116px', textAlign: 'right' }}>
              {format === 1 && <span style={{ fontSize: 11.5, fontWeight: 600, color: open ? AC.muted : AC.text }}>{formatAccessSummary(row.v)}</span>}
              {format === 2 && <span style={{ fontSize: 11, color: open ? AC.muted : AC.text }}>{formatAccessFull(row.v)}</span>}
              {format === 3 && <PartChips v={row.v} />}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ╭───────────────────────────────────────────────────────────╮
// │ エッジ — 1 軸に 30 人                                        │
// ╰───────────────────────────────────────────────────────────╯
function ManyUsers() {
  const entries = Array.from({ length: 30 }, (_, i) => {
    const base = DIR_USERS[i % DIR_USERS.length];
    const handle = base.code.split('@')[0];
    return { code: `${handle}${i}@example.co.jp`, name: base.name, org: base.org };
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AccessStatus value={{ allowedUsers: entries.map((e) => e.code), allowedGroups: [], allowedOrganizations: [] }} />
      <div style={{ background: AC.card, border: `1px solid ${AC.cardBorder}`, borderRadius: 11, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <AxisTile kind="user" color={AC.axisUser} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: AC.text }}>ユーザー</span>
          <span style={{ fontSize: 10.5, fontFamily: MONO, color: AC.axisUser, background: AC.axisUser + '14', padding: '1px 7px', borderRadius: 999, fontWeight: 600, whiteSpace: 'nowrap' }}>30人</span>
          <button style={{ marginLeft: 'auto', fontSize: 10.5, color: AC.muted, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>すべて消去</button>
        </div>
        <FieldShell icon={<SearchIcon size={14} />}><FakeInput ph="名前 / ログイン名で検索" /></FieldShell>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 150, overflowY: 'auto', padding: 2, border: `1px dashed ${AC.border}`, borderRadius: 8 }}>
          {entries.map((e) => <EntryChip key={e.code} kind="user" entry={e} color={AC.axisUser} onRemove={() => {}} />)}
        </div>
        <div style={{ fontSize: 10, color: AC.subtle, textAlign: 'center' }}>チップ領域は max-height + 内部スクロールで高さを固定（モーダルが伸びすぎない）</div>
      </div>
    </div>
  );
}

// ╭───────────────────────────────────────────────────────────╮
// │ 比較表 + 推奨理由                                           │
// ╰───────────────────────────────────────────────────────────╯
function Dot({ tone }) {
  const col = tone === 'good' ? AC.accent : tone === 'bad' ? AC.warn : AC.subtle;
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: col }} />;
}
function ComparisonCard() {
  const cols = ['A 縦カード', 'B タブ', 'C 横3列', 'D 統合検索'];
  const rows = [
    ['3 軸を一望', ['good', 'bad', 'good', 'mid']],
    ['OR 結合の明示', ['good', 'bad', 'mid', 'bad']],
    ['縦の省スペース', ['mid', 'good', 'good', 'good']],
    ['680px での余裕', ['good', 'good', 'bad', 'good']],
    ['大量チップ耐性', ['good', 'good', 'bad', 'mid']],
    ['検索の集中', ['mid', 'good', 'bad', 'good']],
    ['実装コスト', ['good', 'mid', 'mid', 'bad']],
  ];
  return (
    <div style={{ background: AC.card, border: `1px solid ${AC.cardBorder}`, borderRadius: 12, padding: 18, fontFamily: "'Noto Sans JP', sans-serif" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: AC.text, marginBottom: 14 }}>4 案 トレードオフ比較</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', gap: 0, fontSize: 11.5 }}>
        <div style={{ padding: '6px 8px', color: AC.subtle, fontWeight: 600 }}>観点</div>
        {cols.map((c, i) => <div key={i} style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: i === 0 ? AC.accent : AC.text }}>{c}</div>)}
        {rows.map((r, ri) => (
          <React.Fragment key={ri}>
            <div style={{ padding: '8px', color: AC.text, borderTop: `1px solid ${AC.border}` }}>{r[0]}</div>
            {r[1].map((tone, ci) => (
              <div key={ci} style={{ padding: '8px', textAlign: 'center', borderTop: `1px solid ${AC.border}`, background: ci === 0 ? AC.accentSofter : 'transparent' }}><Dot tone={tone} /></div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 10.5, color: AC.muted }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Dot tone="good" /> 強い</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Dot tone="mid" /> 普通</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Dot tone="bad" /> 弱い</span>
      </div>
    </div>
  );
}
function RationaleCard() {
  const Sec = ({ tag, title, children }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'inline-block', fontFamily: MONO, fontSize: 10, fontWeight: 700, color: AC.accent, background: AC.accentSoft, padding: '1px 6px', borderRadius: 3, marginBottom: 7 }}>{tag}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: AC.text, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: AC.muted, lineHeight: 1.7 }}>{children}</div>
    </div>
  );
  return (
    <div style={{ background: AC.card, border: `1px solid ${AC.cardBorder}`, borderRadius: 12, padding: 20, fontFamily: "'Noto Sans JP', sans-serif" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: AC.text, marginBottom: 4 }}>推奨 — 案 A（縦スタック / OR カード）</div>
      <div style={{ fontSize: 11, color: AC.muted, marginBottom: 16 }}>最重要視: ①現状把握の一目性 ②OR 結合の正しい伝達</div>
      <Sec tag="WHY" title="3 軸を独立カードで縦に積む">
        admin が最初に知りたいのは「いま誰に見えているか」。3 軸を同時に見せ、各カードに件数バッジと
        チップを置けば、スクロールせず全体像が掴めます。タブ（案 B）は隠れた軸が生まれ、横3列（案 C）は
        680px では各列が窮屈でチップが折返し崩れします。
      </Sec>
      <Sec tag="OR" title="カード間に OR バッジ・全部空なら『全員』">
        軸を独立カードに分け、間に OR を挟むことで「営業部 OR マネージャー OR …」という
        加算的な結合を構造で表現。3 軸すべて空のときは globe アイコン + 「全員に公開」を最上部に大きく出し、
        絞り込み済みなら accent のサマリへ切り替えます。
      </Sec>
      <Sec tag="SCALE" title="チップ領域は固定高 + 内部スクロール">
        各軸のチップ area は max-height を持ち、30 件でも内部スクロールでモーダル全体は伸びません。
        既存 Settings と同じ <code style={{ fontFamily: MONO, fontSize: 10.5 }}>bg-card / border-card-border</code> トークンに揃え、
        新しい色や派手なカードは持ち込みません。
      </Sec>
      <Sec tag="PICK" title="incremental search の作法">
        debounce 300ms・候補は最大 10 件・user は initial バブル + code/所属、group/org はタイル + 件数/階層。
        選択済みは候補から自動除外（重複防止）、Enter 確定・Esc クローズ・Tab で軸移動。API 失敗時は
        チップを保持したまま候補欄に再試行を出します。
      </Sec>
    </div>
  );
}

Object.assign(window, {
  V_OPEN, V_BALANCED, V_GROUPS_ONLY,
  VariantTabs, VariantColumns, VariantUnified,
  MicroStates, SummaryTable, ManyUsers, ComparisonCard, RationaleCard,
});
