// 添付関連の共通アセット (アイコン / フォーマッタ)。
// docs/design_handoff_attachments/reference/attachments.jsx から移植。

import type { AttachmentKind } from '../../core/files/types';

/** バイト数を "12 B" / "12 KB" / "1.4 MB" 形式に整形 */
export function formatAttachmentSize(bytes: number | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** kind の日本語ラベル (subline 用) */
export function kindLabel(kind: AttachmentKind): string {
  switch (kind) {
    case 'text': return 'テキスト';
    case 'document': return 'PDF';
    case 'image': return '画像';
  }
}

/** kind 別 SVG アイコン (11×11、currentColor で描画) */
export const KIND_ICON: Record<AttachmentKind, JSX.Element> = {
  text: (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 1.5h4L9.5 4v6.5a1 1 0 01-1 1h-5.5a1 1 0 01-1-1v-8a1 1 0 011-1z" />
      <path d="M7 1.5V4h2.5" />
      <path d="M4 6.5h4M4 8.5h3" />
    </svg>
  ),
  document: (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 1.5h4L9.5 4v6.5a1 1 0 01-1 1h-5.5a1 1 0 01-1-1v-8a1 1 0 011-1z" />
      <path d="M7 1.5V4h2.5" />
      <text
        x="6"
        y="9"
        fontSize="3"
        textAnchor="middle"
        stroke="none"
        fill="currentColor"
        fontWeight="700"
        fontFamily="sans-serif"
      >
        PDF
      </text>
    </svg>
  ),
  image: (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="1.5" y="2" width="9" height="8" rx="1" />
      <circle cx="4.2" cy="4.7" r="0.8" />
      <path d="M2 8.5l2.5-2.5 2 2L8 6.5l2.5 2.5" />
    </svg>
  ),
};

/** 警告 (三角) アイコン - chip footer / chip error 共通 */
export const WARN_ICON = (
  <svg
    width="10"
    height="10"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M6 1l5 9.5H1L6 1z" />
    <path d="M6 4.5v2.2M6 8.5v.01" />
  </svg>
);

/** ペーパークリップ (📎 ボタン用) */
export const PAPERCLIP_ICON = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M11.5 6L6 11.5a2.5 2.5 0 01-3.54-3.54L9 1.5a3.5 3.5 0 014.95 4.95L7 13a4.5 4.5 0 01-6.36-6.36" />
  </svg>
);
