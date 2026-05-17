// Flat character explorations for Cowork Agent
// Each character: 5 states (idle / thinking / working / waiting / done)
// Constraints: 2–3 colors, geometric shapes only, no outline-heavy detail.

const PALETTE = {
  amber:    '#ffbf00',
  charcoal: '#231200',
  teal:     '#0d9488',
  cream:    '#faf2dc',
  paper:    '#faf6ea',
  muted:    '#6b5f4a',
  amberSoft:'#ffe9a8',
  tealSoft: '#cfeae6',
};

// ─── Tiny helpers ────────────────────────────────────────
const SVG = ({ children, size = 96, vb = 100, style }) => (
  <svg viewBox={`0 0 ${vb} ${vb}`} width={size} height={size} style={style}>
    {children}
  </svg>
);

// ─── 1. Cloud Bot — kintoneの雲ロゴから着想 ──────────────
// 横長のもくもくした雲シルエット + 真ん中に表情。amber地に charcoal の表情。
function CloudBot({ state = 'idle', size = 96 }) {
  const eyes = {
    idle:    <g><circle cx="38" cy="50" r="3.2" fill={PALETTE.charcoal}/><circle cx="62" cy="50" r="3.2" fill={PALETTE.charcoal}/></g>,
    thinking:<g><circle cx="34" cy="50" r="2" fill={PALETTE.charcoal}/><circle cx="42" cy="50" r="2" fill={PALETTE.charcoal}/><circle cx="50" cy="50" r="2" fill={PALETTE.charcoal}/></g>,
    working: <g><rect x="34" y="47" width="10" height="6" rx="1" fill={PALETTE.charcoal}/><rect x="56" y="47" width="10" height="6" rx="1" fill={PALETTE.charcoal}/><rect x="36" y="49" width="2" height="2" fill={PALETTE.amber}/><rect x="58" y="49" width="2" height="2" fill={PALETTE.amber}/></g>,
    waiting: <g><circle cx="38" cy="50" r="3.2" fill={PALETTE.charcoal}/><circle cx="62" cy="50" r="3.2" fill={PALETTE.charcoal}/><path d="M48 60 Q50 58 52 60" stroke={PALETTE.charcoal} strokeWidth="1.6" strokeLinecap="round" fill="none"/></g>,
    done:    <g><path d="M34 50 Q38 56 42 50" stroke={PALETTE.charcoal} strokeWidth="2.4" strokeLinecap="round" fill="none"/><path d="M58 50 Q62 56 66 50" stroke={PALETTE.charcoal} strokeWidth="2.4" strokeLinecap="round" fill="none"/></g>,
  }[state];
  return (
    <SVG size={size}>
      {/* cloud silhouette */}
      <g>
        <circle cx="28" cy="55" r="18" fill={PALETTE.amber}/>
        <circle cx="50" cy="42" r="22" fill={PALETTE.amber}/>
        <circle cx="72" cy="55" r="18" fill={PALETTE.amber}/>
        <rect x="24" y="50" width="52" height="22" rx="11" fill={PALETTE.amber}/>
      </g>
      {eyes}
    </SVG>
  );
}

// ─── 2. Stamp — 印鑑モチーフ。日本のオフィス文化に寄せた一番フラット ─────
function StampBot({ state = 'idle', size = 96 }) {
  const face = {
    idle:    <g><circle cx="42" cy="48" r="2.6" fill={PALETTE.cream}/><circle cx="58" cy="48" r="2.6" fill={PALETTE.cream}/></g>,
    thinking:<g><circle cx="42" cy="48" r="2.6" fill={PALETTE.cream}/><circle cx="58" cy="48" r="2.6" fill={PALETTE.cream}/><circle cx="68" cy="38" r="1.8" fill={PALETTE.cream} opacity="0.5"/><circle cx="73" cy="32" r="2.4" fill={PALETTE.cream} opacity="0.8"/></g>,
    working: <g><rect x="38" y="45" width="8" height="6" rx="1" fill={PALETTE.cream}/><rect x="54" y="45" width="8" height="6" rx="1" fill={PALETTE.cream}/></g>,
    waiting: <g><circle cx="42" cy="48" r="2.6" fill={PALETTE.cream}/><circle cx="58" cy="48" r="2.6" fill={PALETTE.cream}/><rect x="48" y="58" width="4" height="6" rx="1" fill={PALETTE.amber}/></g>,
    done:    <g><path d="M38 48 Q42 53 46 48" stroke={PALETTE.cream} strokeWidth="2.2" strokeLinecap="round" fill="none"/><path d="M54 48 Q58 53 62 48" stroke={PALETTE.cream} strokeWidth="2.2" strokeLinecap="round" fill="none"/></g>,
  }[state];
  return (
    <SVG size={size}>
      {/* handle */}
      <rect x="42" y="12" width="16" height="14" rx="3" fill={PALETTE.charcoal}/>
      {/* shaft */}
      <rect x="38" y="24" width="24" height="10" rx="2" fill={PALETTE.charcoal}/>
      {/* body */}
      <circle cx="50" cy="58" r="28" fill={PALETTE.charcoal}/>
      {face}
      {/* base shadow line */}
      <rect x="22" y="88" width="56" height="3" rx="1.5" fill={PALETTE.charcoal} opacity="0.15"/>
    </SVG>
  );
}

// ─── 3. Bean — 一筆書きのソラマメ型。すごく素朴 ─────────────
function BeanBot({ state = 'idle', size = 96 }) {
  const face = {
    idle:    <g><circle cx="40" cy="50" r="2.6" fill={PALETTE.charcoal}/><circle cx="60" cy="50" r="2.6" fill={PALETTE.charcoal}/></g>,
    thinking:<g><circle cx="38" cy="50" r="1.8" fill={PALETTE.charcoal}/><circle cx="46" cy="50" r="1.8" fill={PALETTE.charcoal}/><circle cx="54" cy="50" r="1.8" fill={PALETTE.charcoal}/></g>,
    working: <g><circle cx="40" cy="50" r="2.6" fill={PALETTE.teal}/><circle cx="60" cy="50" r="2.6" fill={PALETTE.teal}/></g>,
    waiting: <g><path d="M38 47 L42 53 M42 47 L38 53" stroke={PALETTE.charcoal} strokeWidth="1.8" strokeLinecap="round"/><path d="M58 47 L62 53 M62 47 L58 53" stroke={PALETTE.charcoal} strokeWidth="1.8" strokeLinecap="round"/></g>,
    done:    <g><path d="M36 48 L40 52 L46 46" stroke={PALETTE.charcoal} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M56 48 L60 52 L66 46" stroke={PALETTE.charcoal} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></g>,
  }[state];
  return (
    <SVG size={size}>
      <path
        d="M30 42 C 28 22, 72 22, 70 42 C 78 50, 78 70, 65 78 C 50 86, 30 80, 22 70 C 16 60, 22 48, 30 42 Z"
        fill={PALETTE.amber}
      />
      {face}
      {/* mouth (idle/done) */}
      {state === 'idle' && <path d="M44 60 Q50 64 56 60" stroke={PALETTE.charcoal} strokeWidth="1.6" strokeLinecap="round" fill="none"/>}
    </SVG>
  );
}

// ─── 4. Pin — 付箋・しおりモチーフ ────────────────────────
function PinBot({ state = 'idle', size = 96 }) {
  const face = {
    idle:    <g><circle cx="40" cy="42" r="2.2" fill={PALETTE.charcoal}/><circle cx="60" cy="42" r="2.2" fill={PALETTE.charcoal}/></g>,
    thinking:<g><circle cx="40" cy="42" r="2.2" fill={PALETTE.charcoal}/><circle cx="60" cy="42" r="2.2" fill={PALETTE.charcoal}/><text x="68" y="32" fontSize="10" fill={PALETTE.charcoal} fontFamily="monospace">…</text></g>,
    working: <g><rect x="36" y="40" width="8" height="4" rx="1" fill={PALETTE.charcoal}/><rect x="56" y="40" width="8" height="4" rx="1" fill={PALETTE.charcoal}/></g>,
    waiting: <g><circle cx="40" cy="42" r="2.2" fill={PALETTE.charcoal}/><circle cx="60" cy="42" r="2.2" fill={PALETTE.charcoal}/><circle cx="50" cy="56" r="2.2" fill={PALETTE.charcoal}/></g>,
    done:    <g><path d="M36 40 Q40 46 44 40" stroke={PALETTE.charcoal} strokeWidth="2" strokeLinecap="round" fill="none"/><path d="M56 40 Q60 46 64 40" stroke={PALETTE.charcoal} strokeWidth="2" strokeLinecap="round" fill="none"/></g>,
  }[state];
  return (
    <SVG size={size}>
      {/* paper note body */}
      <path d="M22 18 L78 18 L78 70 L50 86 L22 70 Z" fill={PALETTE.amber}/>
      {/* tape on top */}
      <rect x="34" y="10" width="32" height="10" rx="1" fill={PALETTE.cream} opacity="0.7"/>
      {face}
      {/* horizontal "lines" — paper feel */}
      <rect x="32" y="60" width="36" height="2" rx="1" fill={PALETTE.charcoal} opacity="0.2"/>
    </SVG>
  );
}

// ─── 5. Pebble — 角丸正方形のミニマル顔。一番Slack/Discord系 ─
function PebbleBot({ state = 'idle', size = 96, palette = ['amber','charcoal'] }) {
  const [bg, fg] = palette.map((k) => PALETTE[k]);
  const face = {
    idle:    <g><rect x="34" y="46" width="6" height="10" rx="3" fill={fg}/><rect x="60" y="46" width="6" height="10" rx="3" fill={fg}/></g>,
    thinking:<g><rect x="34" y="50" width="6" height="2" rx="1" fill={fg}/><rect x="60" y="50" width="6" height="2" rx="1" fill={fg}/><circle cx="76" cy="32" r="3" fill={fg}/></g>,
    working: <g><rect x="32" y="48" width="10" height="6" rx="1" fill={fg}/><rect x="58" y="48" width="10" height="6" rx="1" fill={fg}/><rect x="34" y="50" width="2" height="2" fill={bg}/><rect x="60" y="50" width="2" height="2" fill={bg}/></g>,
    waiting: <g><rect x="34" y="46" width="6" height="10" rx="3" fill={fg}/><rect x="60" y="46" width="6" height="10" rx="3" fill={fg}/><rect x="48" y="62" width="4" height="6" rx="1" fill={fg}/></g>,
    done:    <g><path d="M32 50 Q37 55 42 50" stroke={fg} strokeWidth="2.4" strokeLinecap="round" fill="none"/><path d="M58 50 Q63 55 68 50" stroke={fg} strokeWidth="2.4" strokeLinecap="round" fill="none"/></g>,
  }[state];
  return (
    <SVG size={size}>
      <rect x="14" y="18" width="72" height="68" rx="22" fill={bg}/>
      {face}
    </SVG>
  );
}

// ─── 6. Origami — 折り紙の鶴/船シルエット。日本ぽさ ─────────
function OrigamiBot({ state = 'idle', size = 96 }) {
  const eye = {
    idle:    <circle cx="58" cy="42" r="2.4" fill={PALETTE.charcoal}/>,
    thinking:<g><circle cx="58" cy="42" r="2.4" fill={PALETTE.charcoal}/><circle cx="68" cy="34" r="1.6" fill={PALETTE.charcoal} opacity="0.5"/><circle cx="74" cy="28" r="2.2" fill={PALETTE.charcoal}/></g>,
    working: <rect x="55" y="40" width="8" height="4" rx="1" fill={PALETTE.charcoal}/>,
    waiting: <g><circle cx="58" cy="42" r="2.4" fill={PALETTE.charcoal}/><rect x="56" y="50" width="4" height="6" rx="1" fill={PALETTE.charcoal}/></g>,
    done:    <path d="M53 40 Q58 46 63 40" stroke={PALETTE.charcoal} strokeWidth="2" strokeLinecap="round" fill="none"/>,
  }[state];
  return (
    <SVG size={size}>
      {/* paper crane: body triangle + wing + tail */}
      <polygon points="20,70 80,70 50,30" fill={PALETTE.amber}/>
      <polygon points="50,30 80,70 50,55" fill={PALETTE.amber} stroke={PALETTE.charcoal} strokeWidth="0.6" opacity="0.9"/>
      {/* head — small triangle pointing left */}
      <polygon points="14,50 28,46 28,54" fill={PALETTE.amber}/>
      {/* fold line */}
      <line x1="50" y1="30" x2="50" y2="70" stroke={PALETTE.charcoal} strokeWidth="0.6" opacity="0.25"/>
      {eye}
    </SVG>
  );
}

// ─── 7. Sprout — クローバー / 新芽。"成長を支える" メタファ ──
function SproutBot({ state = 'idle', size = 96 }) {
  const face = {
    idle:    <g><circle cx="42" cy="60" r="2.4" fill={PALETTE.cream}/><circle cx="58" cy="60" r="2.4" fill={PALETTE.cream}/></g>,
    thinking:<g><circle cx="38" cy="60" r="1.8" fill={PALETTE.cream}/><circle cx="46" cy="60" r="1.8" fill={PALETTE.cream}/><circle cx="54" cy="60" r="1.8" fill={PALETTE.cream}/></g>,
    working: <g><rect x="38" y="58" width="8" height="4" rx="1" fill={PALETTE.cream}/><rect x="54" y="58" width="8" height="4" rx="1" fill={PALETTE.cream}/></g>,
    waiting: <g><circle cx="42" cy="60" r="2.4" fill={PALETTE.cream}/><circle cx="58" cy="60" r="2.4" fill={PALETTE.cream}/><rect x="48" y="70" width="4" height="6" rx="1" fill={PALETTE.amber}/></g>,
    done:    <g><path d="M38 58 Q42 64 46 58" stroke={PALETTE.cream} strokeWidth="2" strokeLinecap="round" fill="none"/><path d="M54 58 Q58 64 62 58" stroke={PALETTE.cream} strokeWidth="2" strokeLinecap="round" fill="none"/></g>,
  }[state];
  return (
    <SVG size={size}>
      {/* two leaves */}
      <ellipse cx="34" cy="36" rx="14" ry="20" transform="rotate(-30 34 36)" fill={PALETTE.teal}/>
      <ellipse cx="66" cy="36" rx="14" ry="20" transform="rotate(30 66 36)" fill={PALETTE.teal}/>
      {/* round face/stem base */}
      <circle cx="50" cy="62" r="22" fill={PALETTE.teal}/>
      {face}
    </SVG>
  );
}

// ─── 8. Drop — 雫。考え中の吹き出しとも兼用できるシルエット ──
function DropBot({ state = 'idle', size = 96 }) {
  const face = {
    idle:    <g><circle cx="42" cy="58" r="2.6" fill={PALETTE.cream}/><circle cx="58" cy="58" r="2.6" fill={PALETTE.cream}/></g>,
    thinking:<g><circle cx="38" cy="58" r="1.8" fill={PALETTE.cream}/><circle cx="46" cy="58" r="1.8" fill={PALETTE.cream}/><circle cx="54" cy="58" r="1.8" fill={PALETTE.cream}/></g>,
    working: <g><rect x="38" y="56" width="8" height="4" rx="1" fill={PALETTE.cream}/><rect x="54" y="56" width="8" height="4" rx="1" fill={PALETTE.cream}/></g>,
    waiting: <g><circle cx="42" cy="58" r="2.6" fill={PALETTE.cream}/><circle cx="58" cy="58" r="2.6" fill={PALETTE.cream}/><rect x="48" y="68" width="4" height="6" rx="1" fill={PALETTE.amber}/></g>,
    done:    <g><path d="M38 56 Q42 62 46 56" stroke={PALETTE.cream} strokeWidth="2.2" strokeLinecap="round" fill="none"/><path d="M54 56 Q58 62 62 56" stroke={PALETTE.cream} strokeWidth="2.2" strokeLinecap="round" fill="none"/></g>,
  }[state];
  return (
    <SVG size={size}>
      <path d="M50 12 C 30 38, 22 56, 22 66 A 28 28 0 0 0 78 66 C 78 56, 70 38, 50 12 Z" fill={PALETTE.charcoal}/>
      {/* highlight crescent */}
      <path d="M36 40 Q32 52 36 64" stroke={PALETTE.amber} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.9"/>
      {face}
    </SVG>
  );
}

// ─── 9. Pebble Sprout — Pebble × Sprout (teal主役) ─────────
// 角丸スクエアの安定感 + 頭に二葉。 teal/cream/amber accent。
function PebbleSproutBot({ state = 'idle', size = 96 }) {
  const bg = PALETTE.teal;
  const fg = PALETTE.cream;
  const accent = PALETTE.amber;
  const face = {
    idle: (
      <g>
        <rect x="34" y="56" width="6" height="10" rx="3" fill={fg}/>
        <rect x="60" y="56" width="6" height="10" rx="3" fill={fg}/>
        <path d="M44 72 Q50 76 56 72" stroke={fg} strokeWidth="2" strokeLinecap="round" fill="none"/>
      </g>
    ),
    thinking: (
      <g>
        <rect x="34" y="60" width="6" height="2" rx="1" fill={fg}/>
        <rect x="60" y="60" width="6" height="2" rx="1" fill={fg}/>
        <circle cx="76" cy="44" r="2" fill={fg} opacity="0.5"/>
        <circle cx="82" cy="38" r="3" fill={fg}/>
      </g>
    ),
    working: (
      <g>
        <rect x="32" y="58" width="10" height="6" rx="1" fill={fg}/>
        <rect x="58" y="58" width="10" height="6" rx="1" fill={fg}/>
        <rect x="34" y="60" width="2" height="2" fill={accent}/>
        <rect x="60" y="60" width="2" height="2" fill={accent}/>
      </g>
    ),
    waiting: (
      <g>
        <rect x="34" y="56" width="6" height="10" rx="3" fill={fg}/>
        <rect x="60" y="56" width="6" height="10" rx="3" fill={fg}/>
        <rect x="48" y="72" width="4" height="6" rx="1" fill={accent}/>
      </g>
    ),
    done: (
      <g>
        <path d="M32 60 Q37 65 42 60" stroke={fg} strokeWidth="2.4" strokeLinecap="round" fill="none"/>
        <path d="M58 60 Q63 65 68 60" stroke={fg} strokeWidth="2.4" strokeLinecap="round" fill="none"/>
        <path d="M42 74 Q50 80 58 74" stroke={fg} strokeWidth="2" strokeLinecap="round" fill="none"/>
      </g>
    ),
  }[state];
  // leaves animate slightly per state — waiting tilts, done bounces (visual via static change)
  const leftLeafTilt = state === 'waiting' ? -10 : state === 'done' ? -22 : -16;
  const rightLeafTilt = state === 'waiting' ? 10 : state === 'done' ? 22 : 16;
  // Sparkle on done
  const sparkle = state === 'done' ? (
    <g>
      <circle cx="84" cy="22" r="2.4" fill={accent}/>
      <circle cx="78" cy="14" r="1.4" fill={accent}/>
    </g>
  ) : null;
  return (
    <SVG size={size}>
      {/* leaves behind body */}
      <g transform={`translate(50 28) rotate(${leftLeafTilt})`}>
        <ellipse cx="-9" cy="-4" rx="9" ry="14" fill={bg}/>
        <path d="M-9 -16 L-9 6" stroke={PALETTE.cream} strokeWidth="0.8" opacity="0.35"/>
      </g>
      <g transform={`translate(50 28) rotate(${rightLeafTilt})`}>
        <ellipse cx="9" cy="-4" rx="9" ry="14" fill={bg}/>
        <path d="M9 -16 L9 6" stroke={PALETTE.cream} strokeWidth="0.8" opacity="0.35"/>
      </g>
      {/* tiny stem connecting leaves to body */}
      <rect x="48.5" y="22" width="3" height="12" rx="1" fill={bg}/>
      {/* rounded body */}
      <rect x="14" y="32" width="72" height="58" rx="22" fill={bg}/>
      {/* small amber cheek dots — connect to amber palette without overwhelming */}
      <circle cx="26" cy="68" r="3" fill={accent} opacity="0.55"/>
      <circle cx="74" cy="68" r="3" fill={accent} opacity="0.55"/>
      {face}
      {sparkle}
    </SVG>
  );
}

const STATES = [
  { id: 'idle',     label: '待機' },
  { id: 'thinking', label: '思考中' },
  { id: 'working',  label: '実行中' },
  { id: 'waiting',  label: '承認待ち' },
  { id: 'done',     label: '完了' },
];

// ─── Layout: state row used inside artboards ────────────
function StateRow({ Component, label, blurb, palette, size = 88, dark = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 24 }}>
      <div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 13, color: dark ? PALETTE.cream : PALETTE.charcoal, marginBottom: 6 }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: PALETTE.muted, lineHeight: 1.6, maxWidth: 320 }}>
          {blurb}
        </div>
        {palette && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {palette.map((c) => (
              <span key={c} style={{ width: 16, height: 16, borderRadius: 4, background: c, border: '1px solid rgba(35,18,0,0.10)' }} />
            ))}
          </div>
        )}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8,
        background: dark ? '#1a0d00' : '#fdfaf0',
        border: `1px solid ${dark ? 'rgba(255,191,0,0.15)' : 'rgba(35,18,0,0.08)'}`,
        borderRadius: 12, padding: 14,
      }}>
        {STATES.map((s) => (
          <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Component state={s.id} size={size} />
            <div style={{ fontSize: 10.5, color: dark ? '#a89d85' : PALETTE.muted, fontFamily: "'JetBrains Mono', monospace" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── In-chat preview chip used at the bottom of each artboard ──
function ChatChip({ Component, name, line, palette = ['amber','charcoal'] }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', background: '#fff',
      border: '1px solid rgba(35,18,0,0.08)',
      borderRadius: 12, margin: '0 24px 24px',
    }}>
      <Component state="idle" size={42} palette={palette} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: PALETTE.charcoal }}>{name}</div>
        <div style={{ fontSize: 11.5, color: PALETTE.muted, lineHeight: 1.55, marginTop: 2 }}>{line}</div>
      </div>
    </div>
  );
}

// ─── Artboard wrapper used by the canvas ────────────────
function CharCard({ Component, label, blurb, paletteChips, line, dark = false, palette }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: dark ? '#0f0700' : PALETTE.paper,
      display: 'flex', flexDirection: 'column',
    }}>
      <StateRow
        Component={Component} label={label} blurb={blurb}
        palette={paletteChips} dark={dark}
      />
      <div style={{ flex: 1 }} />
      <ChatChip Component={Component} name={label} line={line} palette={palette} />
    </div>
  );
}

window.PebbleSproutBot = PebbleSproutBot;
window.CharCard = CharCard;
window.CloudBot = CloudBot;
window.StampBot = StampBot;
window.BeanBot  = BeanBot;
window.PinBot   = PinBot;
window.PebbleBot= PebbleBot;
window.OrigamiBot=OrigamiBot;
window.SproutBot= SproutBot;
window.DropBot  = DropBot;
