// Cowork Agent ロゴ — 3 variants
// すべて inline SVG、currentColor 対応

window.LogoMarkA = function LogoMarkA({ size = 36, accent = '#0d9488', ink = '#231200' }) {
  // 2つの重なる角丸スクエア (co + worker) + 中央に星(agent)
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Cowork Agent">
      <rect x="2" y="6" width="22" height="22" rx="6" fill={ink} />
      <rect x="12" y="8" width="22" height="22" rx="6" fill={accent} />
      {/* star pinned at intersection */}
      <path d="M23 17 L24.4 19.6 L27.2 20 L25.1 22.0 L25.6 24.8 L23 23.4 L20.4 24.8 L20.9 22.0 L18.8 20 L21.6 19.6 Z"
        fill="#fff" />
    </svg>
  );
};

window.LogoMarkB = function LogoMarkB({ size = 36, accent = '#0d9488', ink = '#231200' }) {
  // 円の交差 (Venn) + 中央 star — co-working metaphor
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 40 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Cowork Agent">
      <circle cx="14" cy="18" r="12" fill={ink} />
      <circle cx="26" cy="18" r="12" fill={accent} />
      {/* lens / overlap region — slightly desaturated to suggest blend */}
      <path d="M20 7.5 a12 12 0 0 1 0 21 a12 12 0 0 1 0 -21 z" fill={ink} opacity="0.55" />
      <path d="M19.0 14 L20.4 16.7 L23.4 17.1 L21.2 19.2 L21.7 22.2 L19.0 20.8 L16.3 22.2 L16.8 19.2 L14.6 17.1 L17.6 16.7 Z"
        fill="#fff" />
    </svg>
  );
};

window.LogoMarkC = function LogoMarkC({ size = 36, accent = '#0d9488', ink = '#231200' }) {
  // モノグラム CA — square ink + accent corner + star cutout
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Cowork Agent">
      <rect x="3" y="3" width="30" height="30" rx="8" fill={ink} />
      <path d="M33 11 L33 3 L25 3 A8 8 0 0 1 33 11 Z" fill={accent} />
      {/* C glyph */}
      <path d="M22 12 a7 7 0 1 0 0 12" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {/* small star top-right of C */}
      <path d="M25 9 L25.7 10.4 L27.2 10.6 L26.1 11.7 L26.4 13.2 L25 12.5 L23.6 13.2 L23.9 11.7 L22.8 10.6 L24.3 10.4 Z"
        fill={accent} />
    </svg>
  );
};

window.Wordmark = function Wordmark({ Mark, size = 32, accent = '#0d9488', ink = '#231200', kintoneInk = '#231200' }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <Mark size={size} accent={accent} ink={ink} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.0, gap: 3 }}>
        <div style={{ fontSize: size * 0.46, fontWeight: 700, letterSpacing: '-0.01em', color: ink }}>
          Cowork <span style={{ color: accent }}>Agent</span>
        </div>
        <div style={{ fontSize: size * 0.27, color: '#6b5f4a', letterSpacing: '0.04em', fontWeight: 500 }}>
          for kintone
        </div>
      </div>
    </div>
  );
};
