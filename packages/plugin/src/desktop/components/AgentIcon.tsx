// Cowork Agent for kintone — AgentIcon コンポーネント (V1 P1.6)
//
// Built-in / Custom Agent を表示する箇所すべてで共有される SVG glyph レンダラー。
// - Header 下段 Agent pill (22×22)
// - Agent ドロップダウン項目 (26×26)
// - Settings → Agents 一覧カード (32×32)
// - Custom Agent (V3) IconPicker ライブプレビュー (44×44)
//
// 仕様: design-handoff/customizer-wedge/project/wedge-header.jsx:44-62 (AgentGlyph) +
//       wedge-settings.jsx:1414-1437 (ExtendedAgentGlyph)
//
// 9 glyph × 10 color の組み合わせをサポート。色のうち 'accent' / 'accentSoft' は
// Tailwind 設計トークン (テーマに追従)、それ以外は Tailwind 標準パレットの -500/15
// 背景 + -700 文字色を使う。

import type { CSSProperties } from 'react';

import type { AgentColor, AgentGlyph } from '../../core/bootstrap/agentTypes';

export interface AgentIconProps {
  /** glyph 種別 (9 種) */
  kind: AgentGlyph;
  /** 色トークン名 (10 種) */
  color: AgentColor;
  /** 外側 box の一辺 (px)。glyph SVG はその ~55% でレンダーされる */
  size: number;
  /** 外側 box の border-radius (px)。default: size * 0.27 (= 約 7/26) */
  radius?: number;
  /** 追加 className */
  className?: string;
  /** title 属性 (hover tooltip / a11y) */
  title?: string;
}

/**
 * Agent を表す角丸ボックス + 中央 SVG glyph。
 */
export function AgentIcon({
  kind,
  color,
  size,
  radius,
  className,
  title,
}: AgentIconProps): JSX.Element {
  const glyphSize = Math.round(size * 0.55);
  const colorStyle = COLOR_STYLE[color];
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius ?? Math.round(size * 0.27),
    ...colorStyle.box,
  };

  return (
    <span
      data-testid="agent-icon"
      data-agent-glyph={kind}
      data-agent-color={color}
      title={title}
      className={[
        'inline-flex items-center justify-center shrink-0',
        className ?? '',
      ]
        .join(' ')
        .trim()}
      style={style}
    >
      <AgentGlyphSvg kind={kind} size={glyphSize} stroke={colorStyle.glyph} />
    </span>
  );
}

// ─── Glyph SVG レジストリ ──────────────────────────────────────────────────
//
// 全 glyph は viewBox=0 0 20 20 / strokeWidth=1.7 で統一して描く。
// 色は currentColor では渡さず、明示的に stroke prop を受け取る (テスト容易性)。

interface GlyphSvgProps {
  kind: AgentGlyph;
  size: number;
  stroke: string;
}

function AgentGlyphSvg({ kind, size, stroke }: GlyphSvgProps): JSX.Element {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 20 20',
    fill: 'none' as const,
    stroke,
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (kind) {
    case 'biz':
      // 業務系: チェック付きクリップボード
      return (
        <svg {...common} aria-hidden="true">
          <rect x="5" y="3" width="10" height="14" rx="2" />
          <path d="M8 3v-1h4v1" />
          <path d="M7.5 10l2 2 3.5-3.5" />
        </svg>
      );
    case 'cust':
      // 開発系: ブレース { }
      return (
        <svg {...common} aria-hidden="true">
          <path d="M7 3c-1.5 0-2 1-2 2v3c0 1-.7 2-2 2 1.3 0 2 1 2 2v3c0 1 .5 2 2 2" />
          <path d="M13 3c1.5 0 2 1 2 2v3c0 1 .7 2 2 2-1.3 0-2 1-2 2v3c0 1-.5 2-2 2" />
        </svg>
      );
    case 'dev':
      // ターミナル: > _
      return (
        <svg {...common} aria-hidden="true">
          <rect x="2.5" y="4" width="15" height="12" rx="1.5" />
          <path d="M5 8l2.5 2L5 12M10 13h5" />
        </svg>
      );
    case 'analytics':
      // 分析: 棒グラフ
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 17V8M8 17V4M13 17v-6" />
          <path d="M2 17h15" />
        </svg>
      );
    case 'mail':
      // メール: 封筒
      return (
        <svg {...common} aria-hidden="true">
          <rect x="2.5" y="5" width="15" height="10" rx="1.5" />
          <path d="M3 6l7 5 7-5" />
        </svg>
      );
    case 'calendar':
      // 予定: カレンダー
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="4.5" width="14" height="12.5" rx="1.5" />
          <path d="M3 8h14M7 3v3M13 3v3" />
        </svg>
      );
    case 'ops':
      // 運用: 歯車
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="10" cy="10" r="2.6" />
          <path d="M10 2v2M10 16v2M18 10h-2M4 10H2M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4M15.7 15.7l-1.4-1.4M5.7 5.7L4.3 4.3" />
        </svg>
      );
    case 'ai':
      // AI: スパーク (4 方向)
      return (
        <svg {...common} aria-hidden="true">
          <path d="M10 3v2.5M10 14.5V17M3 10h2.5M14.5 10H17M4.6 4.6l1.8 1.8M13.6 13.6l1.8 1.8M4.6 15.4l1.8-1.8M13.6 6.4l1.8-1.8" />
          <circle cx="10" cy="10" r="2.4" />
        </svg>
      );
    case 'doc':
      // 文書: ドキュメント (折れページ)
      return (
        <svg {...common} aria-hidden="true">
          <path d="M5 2h7l3 3v13H5z" />
          <path d="M12 2v3h3M7 9h6M7 12h6M7 15h4" />
        </svg>
      );
  }
}

// ─── Color トークン → CSS ──────────────────────────────────────────────────
//
// box: コンテナ (背景色)
// glyph: SVG の stroke 色
//
// 'accent' / 'accentSoft' は Tailwind カスタムトークン (テーマ追従)、
// それ以外は Tailwind 標準パレットの -500/-700 を hex で固定。

interface ColorStyle {
  box: CSSProperties;
  glyph: string;
}

const COLOR_STYLE: Record<AgentColor, ColorStyle> = {
  accent: {
    box: { background: 'var(--cw-accent)' },
    glyph: '#ffffff',
  },
  accentSoft: {
    box: { background: 'var(--cw-accent-soft)' },
    glyph: 'var(--cw-accent)',
  },
  teal: { box: { background: '#14b8a626' }, glyph: '#0f766e' },
  emerald: { box: { background: '#10b98126' }, glyph: '#047857' },
  amber: { box: { background: '#f59e0b26' }, glyph: '#b45309' },
  rose: { box: { background: '#f43f5e26' }, glyph: '#be123c' },
  indigo: { box: { background: '#6366f126' }, glyph: '#4338ca' },
  slate: { box: { background: '#64748b26' }, glyph: '#334155' },
  sky: { box: { background: '#0ea5e926' }, glyph: '#0369a1' },
  fuchsia: { box: { background: '#d946ef26' }, glyph: '#a21caf' },
};
