// ─────────────────────────────────────────────────────────────
// AgentGlyph.tsx — iconKind ごとのラインアイコン (Tailwind サイズ指定)
// 既存スキーマの iconKind を網羅。currentColor で着色。
// ─────────────────────────────────────────────────────────────
import React from 'react';
import type { IconKind } from './agents';

interface Props {
  kind: IconKind;
  className?: string;   // 例: "w-4 h-4"
}

export function AgentGlyph({ kind, className = 'w-4 h-4' }: Props) {
  const common = {
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  };

  switch (kind) {
    case 'cust':
    case 'dev':
      return (
        <svg {...common}>
          <path d="M7 3c-1.5 0-2 1-2 2v3c0 1-.7 2-2 2 1.3 0 2 1 2 2v3c0 1 .5 2 2 2" />
          <path d="M13 3c1.5 0 2 1 2 2v3c0 1 .7 2 2 2-1.3 0-2 1-2 2v3c0 1-.5 2-2 2" />
        </svg>
      );
    case 'analytics':
      return (
        <svg {...common}>
          <path d="M3 17V3" /><path d="M3 17h14" />
          <rect x="6" y="11" width="2.6" height="4" rx="0.4" />
          <rect x="10.5" y="8" width="2.6" height="7" rx="0.4" />
          <rect x="15" y="5" width="2.6" height="10" rx="0.4" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="14" height="10" rx="2" />
          <path d="M3.5 6l6.5 5 6.5-5" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="13" height="12" rx="2" />
          <path d="M3.5 8h13M7 3v3M13 3v3" />
        </svg>
      );
    case 'ops':
      return (
        <svg {...common}>
          <path d="M10 3l6 3.3v7L10 17l-6-3.7v-7L10 3z" />
          <path d="M4 6.5l6 3.3 6-3.3M10 9.8V17" />
        </svg>
      );
    case 'ai':
      return (
        <svg {...common}>
          <path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6L10 3z" />
        </svg>
      );
    case 'doc':
      return (
        <svg {...common}>
          <path d="M5 3h6l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
          <path d="M11 3v4h4M7 11h6M7 14h4" />
        </svg>
      );
    case 'biz':
    default:
      return (
        <svg {...common}>
          <rect x="5" y="3" width="10" height="14" rx="2" />
          <path d="M8 3v-1h4v1" />
          <path d="M7.5 10l2 2 3.5-3.5" />
        </svg>
      );
  }
}
