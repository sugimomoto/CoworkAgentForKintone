// Pebble Sprout — Cowork Agent マスコット
//
// 状態 (idle / thinking / working / waiting / done) に応じてアニメだけ切替える
// 軽量な SVG コンポーネント。design handoff:
//   docs/design_handoff_pebble_sprout/README.md
// keyframes は global.css で定義。

export type PebbleSproutState =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'waiting'
  | 'done';

export interface PebbleSproutProps {
  state?: PebbleSproutState;
  /** SVG の幅・高さ (px)。推奨 24 / 32 / 40 / 64 / 96 / 120 / 160 */
  size?: number;
  /** スクリーンリーダ向け代替テキスト。指定なしなら state からデフォルト生成 */
  label?: string;
}

const PALETTE = {
  teal: '#0d9488',
  cream: '#faf2dc',
  amber: '#ffbf00',
} as const;

const BODY_ANIM: Record<PebbleSproutState, string> = {
  idle: 'ps-breathe 3.6s ease-in-out infinite',
  thinking: 'ps-breathe 2.4s ease-in-out infinite',
  working: 'ps-toddle 0.7s ease-in-out infinite',
  waiting: 'ps-pulse 1.4s ease-in-out infinite',
  done: 'ps-hop 1s ease-out infinite',
};

const LEFT_LEAF_ANIM: Record<PebbleSproutState, string> = {
  idle: 'ps-leaf-sway-l 4s ease-in-out infinite',
  thinking: 'ps-leaf-jitter-l 1.4s ease-in-out infinite',
  working: 'ps-leaf-sway-l 2s ease-in-out infinite',
  waiting: 'ps-leaf-sway-l 5s ease-in-out infinite',
  done: 'ps-leaf-spread-l 1s ease-out infinite',
};

const RIGHT_LEAF_ANIM: Record<PebbleSproutState, string> = {
  idle: 'ps-leaf-sway-r 4s ease-in-out infinite',
  thinking: 'ps-leaf-jitter-r 1.4s ease-in-out infinite',
  working: 'ps-leaf-sway-r 2s ease-in-out infinite',
  waiting: 'ps-leaf-sway-r 5s ease-in-out infinite',
  done: 'ps-leaf-spread-r 1s ease-out infinite',
};

const STATE_LABEL_JA: Record<PebbleSproutState, string> = {
  idle: '待機中',
  thinking: '思考中',
  working: '実行中',
  waiting: '承認待ち',
  done: '完了',
};

export function PebbleSprout({
  state = 'idle',
  size = 120,
  label,
}: PebbleSproutProps): JSX.Element {
  const bg = PALETTE.teal;
  const fg = PALETTE.cream;
  const accent = PALETTE.amber;
  const ariaLabel = label ?? `Cowork Agent — ${STATE_LABEL_JA[state]}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={ariaLabel}
      style={{ overflow: 'visible' }}
    >
      <g
        data-ps-anim
        style={{ transformOrigin: '50px 60px', animation: BODY_ANIM[state] }}
      >
        {/* leaves */}
        <g
          data-ps-anim
          style={{ animation: LEFT_LEAF_ANIM[state], transformBox: 'fill-box' }}
        >
          <ellipse cx="-9" cy="-4" rx="9" ry="14" fill={bg} />
          <path
            d="M-9 -16 L-9 6"
            stroke={PALETTE.cream}
            strokeWidth="0.8"
            opacity="0.35"
          />
        </g>
        <g
          data-ps-anim
          style={{ animation: RIGHT_LEAF_ANIM[state], transformBox: 'fill-box' }}
        >
          <ellipse cx="9" cy="-4" rx="9" ry="14" fill={bg} />
          <path
            d="M9 -16 L9 6"
            stroke={PALETTE.cream}
            strokeWidth="0.8"
            opacity="0.35"
          />
        </g>

        {/* stem */}
        <rect x="48.5" y="22" width="3" height="12" rx="1" fill={bg} />

        {/* body */}
        <rect x="14" y="32" width="72" height="58" rx="22" fill={bg} />

        {/* cheek dots */}
        <circle cx="26" cy="68" r="3" fill={accent} opacity="0.55" />
        <circle cx="74" cy="68" r="3" fill={accent} opacity="0.55" />

        {/* face per state */}
        {renderFace(state, fg, accent)}
      </g>

      {/* sparkles only on done */}
      {state === 'done' && (
        <g>
          <g
            data-ps-anim
            style={{
              transformOrigin: '86px 22px',
              animation: 'ps-sparkle 1s ease-in-out infinite',
            }}
          >
            <path
              d="M86 18 L86 26 M82 22 L90 22"
              stroke={accent}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>
          <g
            data-ps-anim
            style={{
              transformOrigin: '78px 12px',
              animation: 'ps-sparkle 1s ease-in-out infinite',
              animationDelay: '0.3s',
            }}
          >
            <circle cx="78" cy="12" r="1.8" fill={accent} />
          </g>
          <g
            data-ps-anim
            style={{
              transformOrigin: '14px 18px',
              animation: 'ps-sparkle 1s ease-in-out infinite',
              animationDelay: '0.5s',
            }}
          >
            <path
              d="M14 14 L14 22 M10 18 L18 18"
              stroke={accent}
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>
        </g>
      )}
    </svg>
  );
}

function renderFace(
  state: PebbleSproutState,
  fg: string,
  accent: string,
): JSX.Element {
  if (state === 'idle') {
    return (
      <g>
        <g
          data-ps-anim
          style={{
            transformOrigin: '37px 61px',
            animation: 'ps-blink 4s ease-in-out infinite',
          }}
        >
          <rect x="34" y="56" width="6" height="10" rx="3" fill={fg} />
        </g>
        <g
          data-ps-anim
          style={{
            transformOrigin: '63px 61px',
            animation: 'ps-blink 4s ease-in-out infinite',
          }}
        >
          <rect x="60" y="56" width="6" height="10" rx="3" fill={fg} />
        </g>
        <path
          d="M44 72 Q50 76 56 72"
          stroke={fg}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    );
  }
  if (state === 'thinking') {
    return (
      <g>
        <rect x="34" y="60" width="6" height="2" rx="1" fill={fg} />
        <rect x="60" y="60" width="6" height="2" rx="1" fill={fg} />
        <g
          data-ps-anim
          style={{
            transformOrigin: '76px 44px',
            animation: 'ps-bubble-1 1.8s ease-in-out infinite',
          }}
        >
          <circle cx="76" cy="44" r="2" fill={accent} />
        </g>
        <g
          data-ps-anim
          style={{
            transformOrigin: '82px 36px',
            animation: 'ps-bubble-2 1.8s ease-in-out infinite',
          }}
        >
          <circle cx="82" cy="36" r="2.6" fill={accent} />
        </g>
        <g
          data-ps-anim
          style={{
            transformOrigin: '90px 26px',
            animation: 'ps-bubble-3 1.8s ease-in-out infinite',
          }}
        >
          <circle cx="90" cy="26" r="3.4" fill={accent} />
        </g>
      </g>
    );
  }
  if (state === 'working') {
    return (
      <g>
        <rect x="32" y="58" width="10" height="6" rx="1" fill={fg} />
        <rect x="58" y="58" width="10" height="6" rx="1" fill={fg} />
        <g data-ps-anim style={{ animation: 'ps-scan-bar 1.2s linear infinite' }}>
          <rect x="34" y="60" width="2" height="2" fill={accent} />
        </g>
        <g
          data-ps-anim
          style={{
            animation: 'ps-scan-bar 1.2s linear infinite',
            animationDelay: '0.1s',
          }}
        >
          <rect x="60" y="60" width="2" height="2" fill={accent} />
        </g>
        <rect x="42" y="72" width="16" height="2" rx="1" fill={fg} opacity="0.5" />
        <g
          data-ps-anim
          style={{ animation: 'ps-scan 1.2s ease-in-out infinite' }}
        >
          <rect x="42" y="72" width="6" height="2" rx="1" fill={accent} />
        </g>
      </g>
    );
  }
  if (state === 'waiting') {
    return (
      <g>
        <rect x="34" y="56" width="6" height="10" rx="3" fill={fg} />
        <rect x="60" y="56" width="6" height="10" rx="3" fill={fg} />
        <g
          data-ps-anim
          style={{ animation: 'ps-alert-blink 1s ease-in-out infinite' }}
        >
          <rect x="48" y="72" width="4" height="6" rx="1" fill={accent} />
          <rect x="48" y="80" width="4" height="2" rx="1" fill={accent} />
        </g>
      </g>
    );
  }
  // done
  return (
    <g>
      <path
        d="M32 60 Q37 65 42 60"
        stroke={fg}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M58 60 Q63 65 68 60"
        stroke={fg}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M42 74 Q50 80 58 74"
        stroke={fg}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}
