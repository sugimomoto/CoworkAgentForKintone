// Customizer wedge — Header refresh
// 3 探索案 + Admin/非Admin の対比 + Memory トグル placement (V1: OFF) を扱う。

// ────────────────────────────────────────────────────────
// 共通: Agent カタログ (Built-in 3 variant)
// ────────────────────────────────────────────────────────
const BUILTIN_AGENTS = [
  {
    id: 'biz',
    purpose: 'default',
    name: '業務エージェント',
    model: 'sonnet',
    modelLabel: 'SONNET',
    desc: 'レコード操作 / 集計 / ドキュメント生成',
    icon: 'biz',
    published: true,
    isDefault: false,
  },
  {
    id: 'cust-opus',
    purpose: 'customizer',
    name: 'カスタマイザーエージェント',
    model: 'opus',
    modelLabel: 'OPUS',
    desc: 'JS カスタマイズ / Plugin 開発 — 高品質',
    icon: 'cust',
    published: true,
    isDefault: true,
  },
  {
    id: 'cust-sonnet',
    purpose: 'customizer',
    name: 'カスタマイザーエージェント',
    model: 'sonnet',
    modelLabel: 'SONNET',
    desc: 'JS カスタマイズ / Plugin 開発 — 速度・低コスト',
    icon: 'cust',
    published: true,
    isDefault: false,
  },
];

// Agent アイコン (16〜34px で使用)
function AgentGlyph({ kind, size, color }) {
  if (kind === 'cust') {
    // 開発系: ブレース { }
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3c-1.5 0-2 1-2 2v3c0 1-.7 2-2 2 1.3 0 2 1 2 2v3c0 1 .5 2 2 2"/>
        <path d="M13 3c1.5 0 2 1 2 2v3c0 1 .7 2 2 2-1.3 0-2 1-2 2v3c0 1-.5 2-2 2"/>
      </svg>
    );
  }
  // 業務系: チェック付きクリップボード
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="10" height="14" rx="2"/>
      <path d="M8 3v-1h4v1"/>
      <path d="M7.5 10l2 2 3.5-3.5"/>
    </svg>
  );
}

// MODEL バッジ — Opus は塗り、Sonnet は枠線
function ModelBadge({ model, c, accent, size = 'sm' }) {
  const isOpus = model === 'opus';
  const px = size === 'lg' ? { padX: 6, padY: 1.5, fs: 9.5 } : { padX: 5, padY: 1, fs: 8.5 };
  return (
    <span style={{
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: px.fs,
      fontWeight: 700,
      letterSpacing: 0.6,
      padding: `${px.padY}px ${px.padX}px`,
      borderRadius: 3,
      background: isOpus ? accent : 'transparent',
      color: isOpus ? (c.onAccent || '#fff') : accent,
      border: isOpus ? `1px solid ${accent}` : `1px solid ${accent}88`,
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
    }}>
      {model === 'opus' ? 'OPUS' : 'SONNET'}
    </span>
  );
}

// Memory トグル (V1 は OFF / disabled 寄りの控えめ表示)
function MemoryToggle({ c, accent, enabled = false, on = false }) {
  return (
    <button
      title={enabled ? 'メモリ' : 'メモリ機能は V2 で有効化されます'}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 8px 4px 7px',
        borderRadius: 999,
        border: `1px solid ${c.border}`,
        background: on ? c.accentSoft : 'transparent',
        color: enabled ? (on ? accent : c.muted) : c.subtle,
        fontFamily: 'inherit', fontSize: 10.5, fontWeight: 500,
        cursor: enabled ? 'pointer' : 'default',
        opacity: enabled ? 1 : 0.6,
        height: 24,
      }}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="2.5" width="9" height="7" rx="1.5"/>
        <path d="M4 5.2v1.6M6 4.5v2.6M8 5.5v0.6"/>
      </svg>
      <span>メモリ</span>
      <span style={{
        fontSize: 8.5, fontWeight: 700, letterSpacing: 0.6,
        color: on ? accent : c.subtle,
        padding: '0 3px',
      }}>{on ? 'ON' : 'OFF'}</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────
// Agent dropdown panel — 3 案で見た目はほぼ共通、trigger だけ違う
// ────────────────────────────────────────────────────────
function AgentDropdownPanel({ c, accent, agents = BUILTIN_AGENTS, currentId, onSelect = () => {}, width = 320, anchorRight }) {
  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 6px)',
      left: anchorRight ? 'auto' : 0,
      right: anchorRight ? 0 : 'auto',
      width,
      background: c.card,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      boxShadow: '0 12px 36px rgba(0,0,0,0.14)',
      zIndex: 20,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 12px 6px',
        fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
        color: c.subtle,
      }}>エージェントを選択</div>
      {agents.filter((a) => a.published).map((a) => {
        const active = a.id === currentId;
        return (
          <button key={a.id} onClick={() => onSelect(a.id)} style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px',
            background: active ? c.cardHi : 'transparent',
            border: 'none', borderTop: `1px solid ${c.border}`,
            fontFamily: 'inherit', color: c.text,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: a.purpose === 'customizer' ? accent : c.accentSoft,
              color: a.purpose === 'customizer' ? (c.onAccent || '#fff') : accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flex: '0 0 26px',
            }}>
              <AgentGlyph kind={a.icon} size={14} color="currentColor" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.2 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: c.text }}>{a.name}</span>
                <ModelBadge model={a.model} c={c} accent={accent} size="sm" />
                {a.isDefault && (
                  <span style={{
                    fontSize: 8.5, fontWeight: 600, letterSpacing: 0.4,
                    color: c.muted, border: `1px solid ${c.border}`,
                    padding: '0 4px', borderRadius: 3,
                  }}>既定</span>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: c.muted, marginTop: 2, lineHeight: 1.35 }}>{a.desc}</div>
            </div>
            {active && (
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 13px' }}>
                <path d="M2 7.5l3 3L12 3.5"/>
              </svg>
            )}
          </button>
        );
      })}
      <div style={{
        padding: '7px 12px', borderTop: `1px solid ${c.border}`,
        background: c.cardHi, fontSize: 10.5, color: c.muted,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="6" cy="6" r="4.5"/><path d="M6 3.5v3M6 8h.01"/></svg>
        切替時は新規会話が開始されます
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 案 A — Avatar + name 全体が 1 つのクリッカブル pill
//   Header 左側を「[アバター] カスタマイザー OPUS ▾」の単一インタラクション領域に。
// ────────────────────────────────────────────────────────
function HeaderVariantA({ c, accent, currentId = 'cust-opus', open = false, isAdmin = true, memoryOn = false, agents = BUILTIN_AGENTS }) {
  const current = agents.find((a) => a.id === currentId) || agents[0];
  return (
    <div style={headerShell(c)}>
      <div style={{ position: 'relative' }}>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '4px 10px 4px 4px',
          background: open ? c.cardHi : 'transparent',
          border: `1px solid ${open ? c.border : 'transparent'}`,
          borderRadius: 999,
          cursor: 'pointer', fontFamily: 'inherit',
          color: c.text,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: current.purpose === 'customizer' ? accent : c.accentSoft,
            color: current.purpose === 'customizer' ? (c.onAccent || '#fff') : accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <AgentGlyph kind={current.icon} size={16} color="currentColor" />
            <span style={{
              position: 'absolute', bottom: -1, right: -1,
              width: 9, height: 9, borderRadius: '50%',
              background: '#22c55e', border: `2px solid ${c.bg}`,
            }} />
          </div>
          <div style={{ lineHeight: 1.2, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{current.name}</span>
              <ModelBadge model={current.model} c={c} accent={accent} />
            </div>
            <div style={{ fontSize: 10, color: c.muted, marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
              kintone接続
            </div>
          </div>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={c.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2 }}>
            <path d="M3 5l3 3 3-3"/>
          </svg>
        </button>
        {open && <AgentDropdownPanel c={c} accent={accent} currentId={currentId} agents={agents} />}
      </div>
      <div style={{ flex: 1 }} />
      <MemoryToggle c={c} accent={accent} on={memoryOn} />
      {isAdmin && <HeaderIconBtn c={c} title="設定" highlight><GearIcon /></HeaderIconBtn>}
      <HeaderIconBtn c={c} title="閉じる"><CloseIcon /></HeaderIconBtn>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 案 B — Avatar はそのまま。名前の右に小さな ▾。
//   最小変更。現状を一番踏襲。
// ────────────────────────────────────────────────────────
function HeaderVariantB({ c, accent, currentId = 'cust-opus', open = false, isAdmin = true, memoryOn = false, agents = BUILTIN_AGENTS }) {
  const current = agents.find((a) => a.id === currentId) || agents[0];
  return (
    <div style={headerShell(c)}>
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: current.purpose === 'customizer' ? accent : c.accentSoft,
          color: current.purpose === 'customizer' ? (c.onAccent || '#fff') : accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AgentGlyph kind={current.icon} size={18} color="currentColor" />
        </div>
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 11, height: 11, borderRadius: '50%',
          background: '#22c55e', border: `2px solid ${c.bg}`,
        }} />
      </div>
      <div style={{ flex: 1, lineHeight: 1.25, position: 'relative' }}>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', padding: '2px 4px 2px 0',
          cursor: 'pointer', fontFamily: 'inherit', color: c.text,
          borderRadius: 6,
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{current.name}</span>
          <ModelBadge model={current.model} c={c} accent={accent} size="lg" />
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={c.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5l3 3 3-3"/>
          </svg>
        </button>
        <div style={{ fontSize: 11, color: c.muted, display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 0 }}>
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="5" cy="5" r="3.5"/><path d="M5 3v2l1.5 1"/></svg>
          作業中 · kintone接続
        </div>
        {open && <AgentDropdownPanel c={c} accent={accent} currentId={currentId} agents={agents} />}
      </div>
      <MemoryToggle c={c} accent={accent} on={memoryOn} />
      {isAdmin && <HeaderIconBtn c={c} title="設定" highlight><GearIcon /></HeaderIconBtn>}
      <HeaderIconBtn c={c} title="閉じる"><CloseIcon /></HeaderIconBtn>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 案 C — 2 段構成
//   上段: CA brand + 製品名 + Memory + ⚙ + ×
//   下段: Agent pill (フル幅で確実に読める)
// ────────────────────────────────────────────────────────
function HeaderVariantC({ c, accent, currentId = 'cust-opus', open = false, isAdmin = true, memoryOn = false, agents = BUILTIN_AGENTS }) {
  const current = agents.find((a) => a.id === currentId) || agents[0];
  return (
    <div style={{
      borderBottom: `1px solid ${c.border}`,
      background: c.panel, backdropFilter: 'blur(12px)',
      position: 'relative', zIndex: 2,
    }}>
      {/* ─── 上段: brand + utility ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px 8px',
      }}>
        <div style={{ position: 'relative', flex: '0 0 auto' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: accent,
            color: c.onAccent || '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, fontWeight: 800,
            letterSpacing: -0.5,
          }}>CA</div>
          <span style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 10, height: 10, borderRadius: '50%',
            background: '#22c55e', border: `2px solid ${c.bg}`,
          }} />
        </div>
        <div style={{ flex: 1, lineHeight: 1.25, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: c.text, letterSpacing: -0.2,
            display: 'flex', alignItems: 'center', gap: 6,
            whiteSpace: 'nowrap', overflow: 'hidden',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Cowork Agent</span>
            <span style={{
              fontSize: 9, color: accent, background: c.accentSoft,
              padding: '1px 5px', borderRadius: 3, fontWeight: 600, letterSpacing: 0.2,
              flex: '0 0 auto',
            }}>for kintone</span>
          </div>
        </div>
        <MemoryToggle c={c} accent={accent} on={memoryOn} />
        {isAdmin && <HeaderIconBtn c={c} title="設定" highlight><GearIcon /></HeaderIconBtn>}
        <HeaderIconBtn c={c} title="閉じる"><CloseIcon /></HeaderIconBtn>
      </div>

      {/* ─── 下段: Agent selector (フル幅) ─── */}
      <div style={{ padding: '0 14px 10px' }}>
        <div style={{ position: 'relative' }}>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 9,
            width: '100%', boxSizing: 'border-box',
            padding: '6px 12px 6px 8px',
            background: open ? c.card : c.cardHi,
            border: `1px solid ${c.border}`,
            borderRadius: 10,
            cursor: 'pointer', fontFamily: 'inherit', color: c.text,
            textAlign: 'left',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: 7,
              background: current.purpose === 'customizer' ? accent : c.accentSoft,
              color: current.purpose === 'customizer' ? (c.onAccent || '#fff') : accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flex: '0 0 22px',
            }}>
              <AgentGlyph kind={current.icon} size={13} color="currentColor" />
            </span>
            <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.name}</span>
                <ModelBadge model={current.model} c={c} accent={accent} size="lg" />
              </div>
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={c.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 12px' }}>
              <path d="M3 5l3 3 3-3"/>
            </svg>
          </button>
          {open && <AgentDropdownPanel c={c} accent={accent} currentId={currentId} agents={agents} width="100%" />}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 共通: Header shell / アイコンボタン
// ────────────────────────────────────────────────────────
function headerShell(c) {
  return {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 14px', borderBottom: `1px solid ${c.border}`,
    background: c.panel, backdropFilter: 'blur(12px)',
    position: 'relative', zIndex: 2,
  };
}

function HeaderIconBtn({ children, c, title, highlight }) {
  return (
    <button title={title} style={{
      width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
      background: highlight ? c.cardHi : 'transparent',
      color: c.muted,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'inherit', flex: '0 0 28px',
    }}>{children}</button>
  );
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.2"/>
      <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6"/></svg>
  );
}

Object.assign(window, {
  BUILTIN_AGENTS, AgentGlyph, ModelBadge, MemoryToggle, AgentDropdownPanel,
  HeaderVariantA, HeaderVariantB, HeaderVariantC,
  HeaderIconBtn, GearIcon, CloseIcon, headerShell,
});
