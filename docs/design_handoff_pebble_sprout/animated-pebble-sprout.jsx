// Animated Pebble Sprout — SVG + CSS animations only.
// Self-contained component: takes a `state` prop and animates accordingly.

const PS_PALETTE = {
  amber:    '#ffbf00',
  charcoal: '#231200',
  teal:     '#0d9488',
  tealDeep: '#0a7a70',
  cream:    '#faf2dc',
  paper:    '#faf6ea',
  muted:    '#6b5f4a',
};

// One-time injected stylesheet for keyframes (idempotent)
(function injectPSAnim() {
  if (document.getElementById('ps-anim-style')) return;
  const css = `
  /* ── idle ── */
  @keyframes ps-breathe {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-2px); }
  }
  @keyframes ps-leaf-sway-l {
    0%, 100% { transform: translate(50px, 28px) rotate(-14deg); }
    50%      { transform: translate(50px, 28px) rotate(-20deg); }
  }
  @keyframes ps-leaf-sway-r {
    0%, 100% { transform: translate(50px, 28px) rotate(14deg); }
    50%      { transform: translate(50px, 28px) rotate(20deg); }
  }
  @keyframes ps-blink {
    0%, 92%, 100% { transform: scaleY(1); }
    95%, 97%      { transform: scaleY(0.05); }
  }

  /* ── thinking ── */
  @keyframes ps-leaf-jitter-l {
    0%, 100% { transform: translate(50px, 28px) rotate(-12deg); }
    25%      { transform: translate(50px, 28px) rotate(-22deg); }
    75%      { transform: translate(50px, 28px) rotate(-8deg); }
  }
  @keyframes ps-leaf-jitter-r {
    0%, 100% { transform: translate(50px, 28px) rotate(12deg); }
    25%      { transform: translate(50px, 28px) rotate(8deg); }
    75%      { transform: translate(50px, 28px) rotate(22deg); }
  }
  @keyframes ps-bubble-1 {
    0%, 100% { opacity: 0; transform: translate(0, 4px) scale(0.5); }
    30%, 60% { opacity: 1; transform: translate(0, 0) scale(1); }
  }
  @keyframes ps-bubble-2 {
    0%, 25%, 100% { opacity: 0; transform: translate(0, 4px) scale(0.5); }
    50%, 80%      { opacity: 1; transform: translate(0, 0) scale(1); }
  }
  @keyframes ps-bubble-3 {
    0%, 50%, 100% { opacity: 0; transform: translate(0, 4px) scale(0.5); }
    75%, 95%      { opacity: 1; transform: translate(0, 0) scale(1); }
  }

  /* ── working ── */
  @keyframes ps-toddle {
    0%, 100% { transform: translateX(0) rotate(0); }
    25%      { transform: translateX(-1.5px) rotate(-2deg); }
    75%      { transform: translateX(1.5px) rotate(2deg); }
  }
  @keyframes ps-scan {
    0%   { opacity: 0.3; }
    50%  { opacity: 1; }
    100% { opacity: 0.3; }
  }
  @keyframes ps-scan-bar {
    0%   { transform: translateX(-12px); opacity: 0; }
    20%  { opacity: 1; }
    80%  { opacity: 1; }
    100% { transform: translateX(12px); opacity: 0; }
  }

  /* ── waiting ── */
  @keyframes ps-pulse {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.03); }
  }
  @keyframes ps-alert-blink {
    0%, 100% { opacity: 0.4; }
    50%      { opacity: 1; }
  }

  /* ── done ── */
  @keyframes ps-hop {
    0%   { transform: translateY(0) scaleY(1); }
    20%  { transform: translateY(2px) scaleY(0.92); }
    50%  { transform: translateY(-8px) scaleY(1.05); }
    80%  { transform: translateY(0) scaleY(0.96); }
    100% { transform: translateY(0) scaleY(1); }
  }
  @keyframes ps-leaf-spread-l {
    0%   { transform: translate(50px, 28px) rotate(-16deg); }
    50%  { transform: translate(50px, 28px) rotate(-32deg); }
    100% { transform: translate(50px, 28px) rotate(-22deg); }
  }
  @keyframes ps-leaf-spread-r {
    0%   { transform: translate(50px, 28px) rotate(16deg); }
    50%  { transform: translate(50px, 28px) rotate(32deg); }
    100% { transform: translate(50px, 28px) rotate(22deg); }
  }
  @keyframes ps-sparkle {
    0%, 100% { opacity: 0; transform: scale(0.4); }
    50%      { opacity: 1; transform: scale(1); }
  }
  `;
  const el = document.createElement('style');
  el.id = 'ps-anim-style';
  el.textContent = css;
  document.head.appendChild(el);
})();

function AnimatedPebbleSprout({ state = 'idle', size = 120 }) {
  const bg = PS_PALETTE.teal;
  const fg = PS_PALETTE.cream;
  const accent = PS_PALETTE.amber;

  // ── animation styles per state ──
  // body wrapper animation
  const bodyAnim = {
    idle:     'ps-breathe 3.6s ease-in-out infinite',
    thinking: 'ps-breathe 2.4s ease-in-out infinite',
    working:  'ps-toddle 0.7s ease-in-out infinite',
    waiting:  'ps-pulse 1.4s ease-in-out infinite',
    done:     'ps-hop 1s ease-out infinite',
  }[state];

  const leftLeafAnim = {
    idle:     'ps-leaf-sway-l 4s ease-in-out infinite',
    thinking: 'ps-leaf-jitter-l 1.4s ease-in-out infinite',
    working:  'ps-leaf-sway-l 2s ease-in-out infinite',
    waiting:  'ps-leaf-sway-l 5s ease-in-out infinite',
    done:     'ps-leaf-spread-l 1s ease-out infinite',
  }[state];

  const rightLeafAnim = {
    idle:     'ps-leaf-sway-r 4s ease-in-out infinite',
    thinking: 'ps-leaf-jitter-r 1.4s ease-in-out infinite',
    working:  'ps-leaf-sway-r 2s ease-in-out infinite',
    waiting:  'ps-leaf-sway-r 5s ease-in-out infinite',
    done:     'ps-leaf-spread-r 1s ease-out infinite',
  }[state];

  // ── face per state ──
  const renderFace = () => {
    if (state === 'idle') {
      return (
        <g>
          <g style={{ transformOrigin: '37px 61px', animation: 'ps-blink 4s ease-in-out infinite' }}>
            <rect x="34" y="56" width="6" height="10" rx="3" fill={fg}/>
          </g>
          <g style={{ transformOrigin: '63px 61px', animation: 'ps-blink 4s ease-in-out infinite' }}>
            <rect x="60" y="56" width="6" height="10" rx="3" fill={fg}/>
          </g>
          <path d="M44 72 Q50 76 56 72" stroke={fg} strokeWidth="2" strokeLinecap="round" fill="none"/>
        </g>
      );
    }
    if (state === 'thinking') {
      return (
        <g>
          <rect x="34" y="60" width="6" height="2" rx="1" fill={fg}/>
          <rect x="60" y="60" width="6" height="2" rx="1" fill={fg}/>
          <g style={{ transformOrigin: '76px 44px', animation: 'ps-bubble-1 1.8s ease-in-out infinite' }}>
            <circle cx="76" cy="44" r="2" fill={accent}/>
          </g>
          <g style={{ transformOrigin: '82px 36px', animation: 'ps-bubble-2 1.8s ease-in-out infinite' }}>
            <circle cx="82" cy="36" r="2.6" fill={accent}/>
          </g>
          <g style={{ transformOrigin: '90px 26px', animation: 'ps-bubble-3 1.8s ease-in-out infinite' }}>
            <circle cx="90" cy="26" r="3.4" fill={accent}/>
          </g>
        </g>
      );
    }
    if (state === 'working') {
      return (
        <g>
          <rect x="32" y="58" width="10" height="6" rx="1" fill={fg}/>
          <rect x="58" y="58" width="10" height="6" rx="1" fill={fg}/>
          {/* scanning bars inside the eyes */}
          <g style={{ animation: 'ps-scan-bar 1.2s linear infinite' }}>
            <rect x="34" y="60" width="2" height="2" fill={accent}/>
          </g>
          <g style={{ animation: 'ps-scan-bar 1.2s linear infinite', animationDelay: '0.1s' }}>
            <rect x="60" y="60" width="2" height="2" fill={accent}/>
          </g>
          {/* tongue/loader bar under mouth */}
          <rect x="42" y="72" width="16" height="2" rx="1" fill={fg} opacity="0.5"/>
          <g style={{ animation: 'ps-scan 1.2s ease-in-out infinite' }}>
            <rect x="42" y="72" width="6" height="2" rx="1" fill={accent}/>
          </g>
        </g>
      );
    }
    if (state === 'waiting') {
      return (
        <g>
          <rect x="34" y="56" width="6" height="10" rx="3" fill={fg}/>
          <rect x="60" y="56" width="6" height="10" rx="3" fill={fg}/>
          {/* exclamation rectangle blinking */}
          <g style={{ animation: 'ps-alert-blink 1s ease-in-out infinite' }}>
            <rect x="48" y="72" width="4" height="6" rx="1" fill={accent}/>
            <rect x="48" y="80" width="4" height="2" rx="1" fill={accent}/>
          </g>
        </g>
      );
    }
    if (state === 'done') {
      return (
        <g>
          <path d="M32 60 Q37 65 42 60" stroke={fg} strokeWidth="2.4" strokeLinecap="round" fill="none"/>
          <path d="M58 60 Q63 65 68 60" stroke={fg} strokeWidth="2.4" strokeLinecap="round" fill="none"/>
          <path d="M42 74 Q50 80 58 74" stroke={fg} strokeWidth="2" strokeLinecap="round" fill="none"/>
        </g>
      );
    }
  };

  // sparkles: only on done
  const sparkles = state === 'done' ? (
    <g>
      <g style={{ transformOrigin: '86px 22px', animation: 'ps-sparkle 1s ease-in-out infinite' }}>
        <path d="M86 18 L86 26 M82 22 L90 22" stroke={accent} strokeWidth="1.6" strokeLinecap="round"/>
      </g>
      <g style={{ transformOrigin: '78px 12px', animation: 'ps-sparkle 1s ease-in-out infinite', animationDelay: '0.3s' }}>
        <circle cx="78" cy="12" r="1.8" fill={accent}/>
      </g>
      <g style={{ transformOrigin: '14px 18px', animation: 'ps-sparkle 1s ease-in-out infinite', animationDelay: '0.5s' }}>
        <path d="M14 14 L14 22 M10 18 L18 18" stroke={accent} strokeWidth="1.4" strokeLinecap="round"/>
      </g>
    </g>
  ) : null;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
      {/* whole-body wrapper */}
      <g style={{ transformOrigin: '50px 60px', animation: bodyAnim }}>
        {/* leaves */}
        <g style={{ animation: leftLeafAnim, transformBox: 'fill-box' }}>
          <ellipse cx="-9" cy="-4" rx="9" ry="14" fill={bg}/>
          <path d="M-9 -16 L-9 6" stroke={PS_PALETTE.cream} strokeWidth="0.8" opacity="0.35"/>
        </g>
        <g style={{ animation: rightLeafAnim, transformBox: 'fill-box' }}>
          <ellipse cx="9" cy="-4" rx="9" ry="14" fill={bg}/>
          <path d="M9 -16 L9 6" stroke={PS_PALETTE.cream} strokeWidth="0.8" opacity="0.35"/>
        </g>
        {/* stem */}
        <rect x="48.5" y="22" width="3" height="12" rx="1" fill={bg}/>
        {/* body */}
        <rect x="14" y="32" width="72" height="58" rx="22" fill={bg}/>
        {/* cheek dots */}
        <circle cx="26" cy="68" r="3" fill={accent} opacity="0.55"/>
        <circle cx="74" cy="68" r="3" fill={accent} opacity="0.55"/>
        {/* face */}
        {renderFace()}
      </g>
      {sparkles}
    </svg>
  );
}

window.AnimatedPebbleSprout = AnimatedPebbleSprout;
window.PS_PALETTE = PS_PALETTE;
