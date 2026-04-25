// Variant B — Rich
// Card-based with depth. Avatar + status. Gradient aura. More visual
// treatment for HITL plans and results. Feels "AI-native" but still
// business-appropriate.

function VariantRich({ accent = '#6366f1', dark = false, density = 'comfortable' }) {
  const [messages, setMessages] = React.useState([
    { kind: 'greeting' },
    SCENARIO.script[0],
    SCENARIO.script[1],
  ]);
  const [approved, setApproved] = React.useState(false);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    const remaining = SCENARIO.script.slice(2);
    const timers = [];
    let delay = 600;
    remaining.forEach((m, i) => {
      const t = setTimeout(() => {
        setMessages((prev) => {
          if (i === 0 && prev[prev.length - 1]?.kind === 'thinking') {
            return [...prev.slice(0, -1), m];
          }
          return [...prev, m];
        });
      }, delay);
      timers.push(t);
      delay += m.kind === 'tool' ? 650 : m.kind === 'plan' ? 950 : m.kind === 'progress' ? 1200 : 800;
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const c = richColors(dark, accent);
  const pad = density === 'compact' ? 10 : density === 'airy' ? 18 : 14;

  return (
    <div className="panel" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: c.bg, color: c.text, fontSize: 13,
      position: 'relative',
    }}>
      <div className="aura" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <RichHeader c={c} accent={accent} />
      <div ref={scrollRef} className="chat-scroll" style={{
        flex: 1, overflowY: 'auto', padding: `${pad + 4}px 16px`,
        display: 'flex', flexDirection: 'column', gap: pad,
        position: 'relative', zIndex: 1,
      }}>
        {messages.map((m, i) => (
          <RichMessage key={i} m={m} c={c} accent={accent} onApprove={() => setApproved(true)} approved={approved} />
        ))}
      </div>
      <RichComposer c={c} accent={accent} />
    </div>
  );
}

function richColors(dark, accent) {
  if (dark) return {
    bg: '#1a160f', panel: 'rgba(34,28,19,0.75)', border: 'rgba(255,191,0,0.12)',
    text: '#ede4d0', muted: '#a89d85', subtle: '#6b6353',
    card: 'rgba(42,34,23,0.85)', cardBorder: 'rgba(255,191,0,0.12)',
    cardHi: 'rgba(255,191,0,0.05)', accent, accentSoft: accent + '28',
    user: accent + '22', userBorder: accent + '44',
    warn: '#f59e0b', warnSoft: '#f59e0b22',
    ok: '#ffbf00', okSoft: '#ffbf0022',
    onAccent: isLight(accent) ? '#231200' : '#fff',
  };
  return {
    bg: '#faf8f3', panel: 'rgba(255,255,255,0.85)', border: 'rgba(35,18,0,0.10)',
    text: '#231200', muted: '#6b5f4a', subtle: '#a89d85',
    card: '#ffffff', cardBorder: 'rgba(35,18,0,0.08)',
    cardHi: 'rgba(255,191,0,0.06)', accent, accentSoft: accent + '1a',
    user: accent + '14', userBorder: accent + '40',
    warn: '#b45309', warnSoft: '#fef3c7',
    ok: '#8a6400', okSoft: '#fff4c9',
    onAccent: isLight(accent) ? '#231200' : '#fff',
  };
}

function isLight(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0,2), 16);
  const g = parseInt(h.substr(2,2), 16);
  const b = parseInt(h.substr(4,2), 16);
  return (0.299*r + 0.587*g + 0.114*b) > 170;
}

function RichHeader({ c, accent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11,
      padding: '12px 16px', borderBottom: `1px solid ${c.border}`,
      background: c.panel, backdropFilter: 'blur(12px)', position: 'relative', zIndex: 2,
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: `linear-gradient(135deg, ${accent}, ${shift(accent, 40)})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: c.onAccent || '#fff', fontWeight: 700, fontSize: 14,
          boxShadow: `0 4px 14px ${accent}40`,
        }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2v3M10 15v3M3 10h3M14 10h3M5 5l2 2M13 13l2 2M5 15l2-2M13 7l2-2"/>
            <circle cx="10" cy="10" r="3"/>
          </svg>
        </div>
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 11, height: 11, borderRadius: '50%',
          background: '#22c55e', border: `2px solid ${c.bg}`,
        }} />
      </div>
      <div style={{ flex: 1, lineHeight: 1.25 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: c.text, display: 'flex', alignItems: 'center', gap: 6 }}>
          Aoi
          <span style={{ fontSize: 10, fontWeight: 500, color: accent, background: c.accentSoft, padding: '1px 6px', borderRadius: 4 }}>
            AGENT
          </span>
        </div>
        <div style={{ fontSize: 11, color: c.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="5" cy="5" r="3.5"/><path d="M5 3v2l1.5 1"/></svg>
          作業中 · kintone接続
        </div>
      </div>
      <button style={richIconBtn(c)} title="タスク">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="2"/><path d="M5 6h6M5 9h4"/></svg>
      </button>
      <button style={richIconBtn(c)} title="設定">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2M4 4l1.4 1.4M10.6 10.6L12 12M4 12l1.4-1.4M10.6 5.4L12 4"/></svg>
      </button>
      <button style={richIconBtn(c)} title="閉じる">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6"/></svg>
      </button>
    </div>
  );
}

function richIconBtn(c) {
  return {
    width: 30, height: 30, border: 'none', background: 'transparent',
    color: c.muted, cursor: 'pointer', borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

// quick color helper — lighten accent for gradient
function shift(hex, amt) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 0xff) + amt, b = (n & 0xff) + amt;
  r = Math.min(255, Math.max(0, r)); g = Math.min(255, Math.max(0, g)); b = Math.min(255, Math.max(0, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function RichMessage({ m, c, accent, onApprove, approved }) {
  if (m.kind === 'greeting') return <RichGreeting c={c} accent={accent} />;
  if (m.kind === 'user') return (
    <div className="msg-in" style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
      <div style={{
        background: c.user, color: c.text, padding: '10px 14px',
        border: `1px solid ${c.userBorder}`,
        borderRadius: '16px 16px 4px 16px', fontSize: 13, lineHeight: 1.5,
      }}>{m.text}</div>
    </div>
  );
  if (m.kind === 'thinking') return (
    <AgentBubble c={c} accent={accent}>
      <span className="thinking-text" style={{ color: c.muted, fontSize: 12 }}>{m.text}</span>
      <span style={{ marginLeft: 6, color: accent }}>
        <span className="dot"/><span className="dot"/><span className="dot"/>
      </span>
    </AgentBubble>
  );
  if (m.kind === 'agent') return (
    <AgentBubble c={c} accent={accent}>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: c.text }}>{m.text}</div>
    </AgentBubble>
  );
  if (m.kind === 'tool') return <RichToolCall m={m} c={c} accent={accent} />;
  if (m.kind === 'plan') return <RichPlan m={m} c={c} accent={accent} onApprove={onApprove} approved={approved} />;
  if (m.kind === 'progress') return <RichProgress m={m} c={c} accent={accent} />;
  if (m.kind === 'result') return <RichResult m={m} c={c} accent={accent} />;
  return null;
}

function AgentBubble({ c, accent, children }) {
  return (
    <div className="msg-in" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', maxWidth: '92%' }}>
      <div style={{
        flex: '0 0 22px', width: 22, height: 22, borderRadius: '50%',
        background: `linear-gradient(135deg, ${accent}, ${shift(accent, 40)})`,
        marginTop: 1,
      }} />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function RichGreeting({ c, accent }) {
  return (
    <div className="msg-in" style={{ padding: '12px 2px 6px' }}>
      <div style={{
        fontSize: 16, fontWeight: 600, color: c.text, marginBottom: 4,
        letterSpacing: -0.3, lineHeight: 1.4,
      }}>
        {SCENARIO.greeting.hello}
      </div>
      <div style={{ fontSize: 12, color: c.muted, marginBottom: 12, lineHeight: 1.5 }}>
        アプリ検索、集計、レコード操作まで。思いついたことを話しかけてください。
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {SCENARIO.greeting.suggestions.map((s, i) => (
          <button key={i} style={{
            textAlign: 'left', padding: '10px 12px',
            background: c.card, border: `1px solid ${c.cardBorder}`,
            borderRadius: 10, color: c.text, fontSize: 12.5, cursor: 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: 6, background: c.accentSoft,
              color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 20px',
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 5h6M5 2l3 3-3 3"/></svg>
            </span>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function RichToolCall({ m, c, accent }) {
  return (
    <div className="msg-in" style={{
      background: c.cardHi, border: `1px solid ${c.cardBorder}`, borderRadius: 10,
      padding: '8px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 9,
      maxWidth: '92%',
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 6,
        background: c.okSoft, color: c.ok,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 20px',
      }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6.5l2.5 2.5L10 3.5"/></svg>
      </span>
      <div style={{ flex: 1, lineHeight: 1.3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: accent, fontWeight: 600 }}>{m.name}</code>
          <span style={{ color: c.text, fontSize: 12, fontWeight: 500 }}>{m.label}</span>
        </div>
        <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>
          {m.detail}
          {m.items && (
            <span style={{ marginLeft: 6 }}>
              {m.items.map((it, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 4,
                  background: c.accentSoft, color: accent, marginRight: 3,
                }}>{it}</span>
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function RichPlan({ m, c, accent, onApprove, approved }) {
  const destructive = m.destructive;
  const glow = destructive ? c.warn : accent;
  return (
    <div className="msg-in" style={{
      border: `1px solid ${destructive ? c.warn + '55' : c.cardBorder}`,
      borderRadius: 14,
      background: c.card,
      boxShadow: destructive ? `0 0 0 4px ${c.warn}15, 0 4px 20px ${c.warn}20` : `0 2px 12px rgba(0,0,0,0.04)`,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        background: destructive ? c.warnSoft : c.accentSoft,
        borderBottom: `1px solid ${destructive ? c.warn + '33' : c.border}`,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={glow} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {destructive
            ? <><path d="M7 1l6 11H1L7 1z"/><path d="M7 5v3M7 10h.01"/></>
            : <><path d="M2 3h10M2 7h10M2 11h6"/></>}
        </svg>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: destructive ? c.warn : accent }}>{m.title}</div>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: destructive ? c.warn : accent, letterSpacing: 0.5 }}>
          {destructive ? '要承認' : '読取'}
        </span>
      </div>
      <div style={{ padding: 14 }}>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {m.steps.map((s, i) => (
            <li key={i} style={{
              display: 'flex', gap: 10, padding: '6px 0', fontSize: 12.5, color: c.text, lineHeight: 1.5,
              alignItems: 'flex-start',
            }}>
              <span style={{
                flex: '0 0 22px', height: 22, borderRadius: 6,
                background: c.accentSoft, color: accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 600,
              }}>{i + 1}</span>
              <div style={{ flex: 1, paddingTop: 3 }}>
                <div style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6,
                  color: c.muted, textTransform: 'uppercase', marginBottom: 1,
                }}>{s.op}</div>
                <div>{s.text}</div>
              </div>
            </li>
          ))}
        </ol>
        <div style={{
          marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${c.border}`,
          fontSize: 11, color: c.muted, display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="6" r="4.5"/><path d="M6 3.5v2.5l1.5 1.5"/></svg>
          {m.estimate}
        </div>
        {destructive && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <button style={{
              flex: 1, padding: '9px 12px', fontSize: 12.5, fontWeight: 600,
              background: c.warn, color: '#fff', border: 'none', borderRadius: 8,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>承認して実行</button>
            <button style={{
              padding: '9px 12px', fontSize: 12.5, fontWeight: 500,
              background: 'transparent', color: c.muted, border: `1px solid ${c.border}`, borderRadius: 8,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>修正</button>
            <button style={{
              padding: '9px 12px', fontSize: 12.5, fontWeight: 500,
              background: 'transparent', color: c.muted, border: `1px solid ${c.border}`, borderRadius: 8,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>キャンセル</button>
          </div>
        )}
      </div>
    </div>
  );
}

function RichProgress({ m, c, accent }) {
  const pct = Math.round((m.done / m.total) * 100);
  return (
    <div className="msg-in" style={{
      border: `1px solid ${c.cardBorder}`, borderRadius: 12,
      background: c.card, padding: 13, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          border: `2px solid ${c.accentSoft}`, borderTopColor: accent,
          animation: 'spin 0.9s linear infinite',
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: c.text }}>{m.title}</div>
          <div style={{ fontSize: 10.5, color: c.muted }}>バックグラウンド実行中</div>
        </div>
        <div style={{ fontSize: 16, color: accent, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {pct}%
        </div>
      </div>
      <div style={{
        height: 6, borderRadius: 3, background: c.accentSoft, overflow: 'hidden',
        marginBottom: 11, position: 'relative',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${accent}, ${shift(accent, 40)})`, transition: 'width .3s', position: 'relative' }}>
          <div className="shimmer" style={{ position: 'absolute', inset: 0 }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {m.substeps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: s.done ? c.muted : c.text }}>
            <span style={{
              width: 13, height: 13, borderRadius: '50%',
              background: s.done ? c.ok : 'transparent',
              border: s.done ? 'none' : `1.5px solid ${c.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {s.done && <svg width="7" height="7" viewBox="0 0 7 7" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"><path d="M1 3.5l1.5 1.5L6 2"/></svg>}
            </span>
            {s.label}
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function RichResult({ m, c, accent }) {
  const max = Math.max(...m.rows.map((r) => r.total));
  return (
    <div className="msg-in" style={{
      border: `1px solid ${c.cardBorder}`, borderRadius: 14,
      background: c.card, overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        padding: '12px 14px',
        background: `linear-gradient(135deg, ${c.accentSoft}, transparent)`,
        borderBottom: `1px solid ${c.border}`,
      }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: c.text, letterSpacing: -0.2 }}>{m.title}</div>
        <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{m.subtitle}</div>
      </div>
      <div style={{ padding: '10px 14px' }}>
        {m.rows.map((r, i) => (
          <div key={i} style={{ padding: '7px 0', borderBottom: i < m.rows.length - 1 ? `1px solid ${c.border}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: `hsl(${(i * 62) % 360}, 55%, ${dark ? 30 : 85}%)`,
                color: `hsl(${(i * 62) % 360}, 70%, 35%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 600,
              }}>{r.name.charAt(0)}</span>
              <span style={{ fontSize: 12.5, color: c.text, fontWeight: 500, flex: 1 }}>{r.name}</span>
              <span style={{ fontSize: 10.5, color: c.subtle }}>{r.count}件</span>
              <span style={{ fontSize: 12.5, color: c.text, fontVariantNumeric: 'tabular-nums', fontWeight: 600, minWidth: 64, textAlign: 'right' }}>
                ¥{(r.total / 10000).toLocaleString()}<span style={{ fontSize: 10, color: c.muted }}>万</span>
              </span>
            </div>
            <div style={{ height: 3, background: c.border, borderRadius: 2, overflow: 'hidden', marginLeft: 28 }}>
              <div style={{ width: `${(r.total / max) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${accent}, ${shift(accent, 30)})` }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 14px', background: c.cardHi, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {m.followups.map((f, i) => (
          <button key={i} style={{
            border: `1px solid ${c.border}`, background: c.card, color: c.text,
            padding: '5px 11px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 5h6M5 2l3 3-3 3"/></svg>
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

const dark = false; // avatar color calc fallback

function RichComposer({ c, accent }) {
  return (
    <div style={{
      padding: '10px 14px 14px', borderTop: `1px solid ${c.border}`,
      background: c.panel, backdropFilter: 'blur(12px)', position: 'relative', zIndex: 2,
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8,
        border: `1px solid ${c.border}`, borderRadius: 14,
        padding: '8px 8px 8px 14px', background: c.card,
        boxShadow: `0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px ${c.accentSoft} inset`,
      }}>
        <input
          placeholder="このアプリについて聞く / レコードを操作..."
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            color: c.text, fontSize: 13, fontFamily: 'inherit', padding: '5px 0',
          }}
        />
        <button style={richIconBtn(c)} title="添付">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 2L4 8a3 3 0 004 4l6-6a2 2 0 10-3-3L5 9a1 1 0 001 1l5-5"/></svg>
        </button>
        <button style={{
          width: 32, height: 32, borderRadius: 10, border: 'none',
          background: `linear-gradient(135deg, ${accent}, ${shift(accent, 30)})`,
          color: c.onAccent || '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 2px 8px ${accent}55`,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h9M7 3l4 4-4 4"/></svg>
        </button>
      </div>
      <div style={{ fontSize: 10, color: c.subtle, marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <kbd style={kbdStyle(c)}>⌘</kbd><kbd style={kbdStyle(c)}>K</kbd> 呼び出し
        </span>
        <span>·</span>
        <span>Claude Managed Agents</span>
      </div>
    </div>
  );
}

function kbdStyle(c) {
  return {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 9, padding: '1px 4px', borderRadius: 3,
    background: c.border, color: c.muted, border: 'none',
  };
}

window.VariantRich = VariantRich;
