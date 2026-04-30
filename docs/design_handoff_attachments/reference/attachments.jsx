// Attachment UI primitives — Step 1 (Foundation) のチャット側 UI.
// variant-rich の語彙 (cardBorder / cardHi / accentSoft / 角丸 8〜14) を踏襲.
//
// 公開:
//   <AttachmentChip ... />          — Composer 入力欄の上に並ぶチップ
//   <AttachmentChipRow ... />        — チップを横スクロールで並べる行
//   <UserMessageAttachments ... />  — 送信後、user バブルの上に並ぶラベル
//   ATTACHMENT_KIND_META             — kind ごとの アイコン / 表示色 マップ
//   formatAttachmentSize             — bytes -> "12 KB" / "1.4 MB"

// ────────────────────────────────────────────────────────
// utilities
// ────────────────────────────────────────────────────────
function formatAttachmentSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

// kind -> { icon (svg path), label } — image/document/text の3種
const ATTACHMENT_KIND_META = {
  text: {
    label: 'テキスト',
    icon: (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 1.5h4L9.5 4v6.5a1 1 0 01-1 1h-5.5a1 1 0 01-1-1v-8a1 1 0 011-1z"/>
        <path d="M7 1.5V4h2.5"/>
        <path d="M4 6.5h4M4 8.5h3"/>
      </svg>
    ),
  },
  document: {
    label: 'PDF',
    icon: (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 1.5h4L9.5 4v6.5a1 1 0 01-1 1h-5.5a1 1 0 01-1-1v-8a1 1 0 011-1z"/>
        <path d="M7 1.5V4h2.5"/>
        <text x="6" y="9" fontSize="3" textAnchor="middle" stroke="none" fill="currentColor" fontWeight="700" fontFamily="sans-serif">PDF</text>
      </svg>
    ),
  },
  image: {
    label: '画像',
    icon: (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="2" width="9" height="8" rx="1"/>
        <circle cx="4.2" cy="4.7" r="0.8"/>
        <path d="M2 8.5l2.5-2.5 2 2L8 6.5l2.5 2.5"/>
      </svg>
    ),
  },
};

// ────────────────────────────────────────────────────────
// AttachmentChip — Composer の上に出る読込中/ready/error 表示
// ────────────────────────────────────────────────────────
function AttachmentChip({ file, c, accent, onRemove }) {
  const meta = ATTACHMENT_KIND_META[file.kind] || ATTACHMENT_KIND_META.text;
  const isReading = file.status === 'reading';
  const isError = file.status === 'error';
  const isReady = file.status === 'ready';

  // 状態別の配色 — error は warn 系、reading は muted、ready は accent 系
  const tone = isError
    ? { bg: c.warnSoft, border: c.warn + '55', icon: c.warn, text: c.warn, sub: c.warn + 'cc' }
    : isReading
    ? { bg: c.cardHi, border: c.cardBorder, icon: c.muted, text: c.text, sub: c.muted }
    : { bg: c.card, border: c.cardBorder, icon: accent, text: c.text, sub: c.muted };

  return (
    <div
      title={isError ? file.errorText : `${file.filename} (${formatAttachmentSize(file.size)})`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '6px 6px 6px 9px',
        background: tone.bg, border: `1px solid ${tone.border}`,
        borderRadius: 8, maxWidth: 220, minWidth: 0,
        flex: '0 0 auto',
      }}
    >
      {/* kind icon — accentSoft 背景の 18×18 タイル */}
      <span style={{
        width: 18, height: 18, borderRadius: 5,
        background: isError ? '#fff6e8' : c.accentSoft,
        color: tone.icon,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flex: '0 0 18px', position: 'relative',
      }}>
        {isReading ? (
          <span style={{
            width: 11, height: 11, borderRadius: '50%',
            border: `1.5px solid ${c.cardBorder}`, borderTopColor: accent,
            animation: 'attach-spin 0.9s linear infinite',
          }} />
        ) : isError ? (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M6 1l5 9.5H1L6 1z"/>
            <path d="M6 4.5v2.2M6 8.5v.01"/>
          </svg>
        ) : meta.icon}
      </span>

      {/* filename + size/status */}
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
        <div style={{
          fontSize: 11.5, fontWeight: 500, color: tone.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{file.filename}</div>
        <div style={{
          fontSize: 9.5, color: tone.sub, fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {isReading ? '読込中…'
            : isError ? (file.errorText || 'エラー')
            : `${meta.label} · ${formatAttachmentSize(file.size)}`}
        </div>
      </div>

      {/* close button — disabled while reading */}
      {!isReading && (
        <button
          onClick={onRemove}
          title="削除"
          style={{
            width: 18, height: 18, border: 'none', background: 'transparent',
            color: tone.sub, cursor: 'pointer', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flex: '0 0 18px', padding: 0,
          }}
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2.5 2.5l5 5M7.5 2.5l-5 5"/>
          </svg>
        </button>
      )}

      <style>{`@keyframes attach-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// AttachmentChipRow — 横スクロール可能なチップ列 + 合計サイズ警告
// ────────────────────────────────────────────────────────
function AttachmentChipRow({ files, c, accent, onRemove }) {
  if (!files || files.length === 0) return null;
  const totalBytes = files.reduce((a, f) => a + (f.size || 0), 0);
  const WARN = 30 * 1024 * 1024;
  const showWarn = totalBytes >= WARN;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '8px 10px 0',
    }}>
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto',
        paddingBottom: 2, scrollbarWidth: 'thin',
      }}>
        {files.map((f) => (
          <AttachmentChip
            key={f.localId}
            file={f} c={c} accent={accent}
            onRemove={() => onRemove?.(f.localId)}
          />
        ))}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10, color: showWarn ? c.warn : c.subtle,
        paddingLeft: 2,
      }}>
        <span>{files.length}件</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatAttachmentSize(totalBytes)}</span>
        {showWarn && (
          <>
            <span style={{ opacity: 0.5 }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M6 1l5 9.5H1L6 1z"/><path d="M6 4.5v2.2M6 8.5v.01"/>
              </svg>
              合計サイズが大きめです
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// UserMessageAttachments — user バブルの上に並ぶ送信済みファイルラベル
// ────────────────────────────────────────────────────────
function UserMessageAttachments({ attachments, c, accent }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end',
      marginBottom: 5,
    }}>
      {attachments.map((a, i) => {
        const meta = ATTACHMENT_KIND_META[a.kind] || ATTACHMENT_KIND_META.text;
        return (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 8px 3px 6px',
            background: c.card, border: `1px solid ${c.cardBorder}`,
            borderRadius: 6, fontSize: 10.5, color: c.muted,
            maxWidth: 220, minWidth: 0,
          }}>
            <span style={{ color: accent, display: 'flex', flex: '0 0 11px' }}>{meta.icon}</span>
            <span style={{
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              color: c.text, fontWeight: 500,
            }}>{a.filename}</span>
          </span>
        );
      })}
    </div>
  );
}

window.AttachmentChip = AttachmentChip;
window.AttachmentChipRow = AttachmentChipRow;
window.UserMessageAttachments = UserMessageAttachments;
window.ATTACHMENT_KIND_META = ATTACHMENT_KIND_META;
window.formatAttachmentSize = formatAttachmentSize;
