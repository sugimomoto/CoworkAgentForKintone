// Artifact pane — Claude Desktop 風の再利用可能な成果物ビューア
// kind: markdown | html | mermaid | code | svg | kintone-customize-js

// ────────────────────────────────────────────────────────
// Mini markdown renderer (依存追加なし、よく出る要素だけ対応)
// ────────────────────────────────────────────────────────
function renderMarkdown(src) {
  const lines = src.split('\n');
  const out = [];
  let i = 0;
  let key = 0;
  const inline = (text) => {
    // bold + inline code
    const parts = [];
    let rest = text;
    let pk = 0;
    while (rest.length) {
      const mBold = rest.match(/\*\*(.+?)\*\*/);
      const mCode = rest.match(/`([^`]+)`/);
      const mItalic = rest.match(/\*(.+?)\*/);
      const cands = [mBold, mCode, mItalic].filter(Boolean);
      if (!cands.length) { parts.push(rest); break; }
      const m = cands.reduce((a, b) => (a.index <= b.index ? a : b));
      if (m.index > 0) parts.push(rest.slice(0, m.index));
      if (m === mBold) parts.push(<strong key={'i' + pk++}>{m[1]}</strong>);
      else if (m === mCode) parts.push(<code key={'i' + pk++} className="md-code-inline">{m[1]}</code>);
      else parts.push(<em key={'i' + pk++}>{m[1]}</em>);
      rest = rest.slice(m.index + m[0].length);
    }
    return parts;
  };

  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith('# ')) { out.push(<h1 key={key++} className="md-h1">{inline(l.slice(2))}</h1>); i++; continue; }
    if (l.startsWith('## ')) { out.push(<h2 key={key++} className="md-h2">{inline(l.slice(3))}</h2>); i++; continue; }
    if (l.startsWith('### ')) { out.push(<h3 key={key++} className="md-h3">{inline(l.slice(4))}</h3>); i++; continue; }
    if (l.startsWith('> ')) { out.push(<blockquote key={key++} className="md-quote">{inline(l.slice(2))}</blockquote>); i++; continue; }
    if (l.startsWith('---')) { out.push(<hr key={key++} className="md-hr" />); i++; continue; }
    // table
    if (l.includes('|') && lines[i + 1] && /^\|?\s*[-:|\s]+\|/.test(lines[i + 1])) {
      const header = l.split('|').map((s) => s.trim()).filter(Boolean);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').map((s) => s.trim()).filter(Boolean));
        i++;
      }
      out.push(
        <table key={key++} className="md-table">
          <thead><tr>{header.map((h, j) => <th key={j}>{inline(h)}</th>)}</tr></thead>
          <tbody>{rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>)}</tbody>
        </table>
      );
      continue;
    }
    // unordered list
    if (l.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) { items.push(lines[i].slice(2)); i++; }
      out.push(<ul key={key++} className="md-ul">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>);
      continue;
    }
    if (l.trim() === '') { i++; continue; }
    out.push(<p key={key++} className="md-p">{inline(l)}</p>);
    i++;
  }
  return out;
}

// ────────────────────────────────────────────────────────
// Mermaid → 静的 ER 図 (デモ用、依存無しの SVG プレビュー)
// 本実装では mermaid.js を動的 import するが、ここはプロトタイプ表示
// ────────────────────────────────────────────────────────
function MermaidPreview({ accent, c }) {
  // 3エンティティの ER 図を手書きSVGで表現
  const box = (x, y, w, h, title, fields, fillBg, fillHead) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fillBg} stroke={c.cardBorder} strokeWidth="1" />
      <rect x={x} y={y} width={w} height={22} rx={6} fill={fillHead} />
      <rect x={x} y={y + 16} width={w} height={6} fill={fillHead} />
      <text x={x + w / 2} y={y + 15} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700" fill={c.text}>
        {title}
      </text>
      {fields.map((f, i) => (
        <g key={i}>
          <text x={x + 10} y={y + 38 + i * 16} fontFamily="JetBrains Mono, monospace" fontSize="9.5" fill={f.pk ? accent : c.muted} fontWeight={f.pk ? 700 : 400}>
            {f.pk ? '◆ ' : f.fk ? '◇ ' : '  '}{f.name}
          </text>
          <text x={x + w - 10} y={y + 38 + i * 16} textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="9" fill={c.subtle}>
            {f.type}
          </text>
        </g>
      ))}
    </g>
  );

  return (
    <div style={{ background: c.cardHi, padding: 24, borderRadius: 8, display: 'flex', justifyContent: 'center' }}>
      <svg viewBox="0 0 620 360" style={{ width: '100%', maxWidth: 620, height: 'auto' }}>
        <defs>
          <marker id="diamond" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M0 5l5-5 5 5-5 5z" fill={accent} />
          </marker>
          <marker id="crowsfoot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto">
            <path d="M0 5h9M0 0l9 5M0 10l9-5" stroke={accent} strokeWidth="1.4" fill="none" />
          </marker>
        </defs>
        {/* 顧客マスタ */}
        {box(20, 30, 180, 100, '顧客マスタ', [
          { name: '顧客ID', type: 'string', pk: true },
          { name: '会社名', type: 'string' },
          { name: '業種', type: 'string' },
          { name: '担当者', type: 'string' },
        ], c.card, c.accentSoft)}
        {/* 案件管理 */}
        {box(220, 130, 180, 130, '案件管理', [
          { name: '案件ID', type: 'string', pk: true },
          { name: '顧客ID', type: 'string', fk: true },
          { name: '案件名', type: 'string' },
          { name: '受注金額', type: 'number' },
          { name: 'ステータス', type: 'string' },
          { name: '受注日', type: 'date' },
        ], c.card, c.accentSoft)}
        {/* 活動履歴 */}
        {box(420, 30, 180, 130, '活動履歴', [
          { name: '活動ID', type: 'string', pk: true },
          { name: '案件ID', type: 'string', fk: true },
          { name: '顧客ID', type: 'string', fk: true },
          { name: '日時', type: 'date' },
          { name: '種別', type: 'string' },
          { name: '内容', type: 'text' },
        ], c.card, c.accentSoft)}
        {/* relations */}
        <path d="M200 80 L220 145" stroke={accent} strokeWidth="1.4" fill="none" markerStart="url(#diamond)" markerEnd="url(#crowsfoot)" />
        <path d="M400 195 L420 130" stroke={accent} strokeWidth="1.4" fill="none" markerStart="url(#diamond)" markerEnd="url(#crowsfoot)" />
        <path d="M200 90 Q310 0 420 90" stroke={accent} strokeWidth="1.4" fill="none" strokeDasharray="4 3" markerStart="url(#diamond)" markerEnd="url(#crowsfoot)" />
        <text x="310" y="320" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9.5" fill={c.muted}>
          ◆ Primary Key   ◇ Foreign Key   ─── 1:N
        </text>
      </svg>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// kind 別レンダラ
// ────────────────────────────────────────────────────────
function ArtifactBody({ artifact, accent, c }) {
  if (!artifact) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: c.muted, fontSize: 12.5 }}>
        アーティファクトが選択されていません
      </div>
    );
  }
  if (artifact.kind === 'markdown') {
    return (
      <div className="md-body" style={{ padding: '24px 28px', color: c.text, fontSize: 13.5, lineHeight: 1.7 }}>
        {renderMarkdown(artifact.content)}
      </div>
    );
  }
  if (artifact.kind === 'html') {
    return (
      <div style={{ padding: 0, height: '100%', background: '#fafafa' }}>
        <iframe
          srcDoc={artifact.content}
          sandbox="allow-scripts"
          style={{ width: '100%', height: '100%', border: 'none', background: '#fff', display: 'block' }}
          title={artifact.title}
        />
      </div>
    );
  }
  if (artifact.kind === 'mermaid') {
    return (
      <div style={{ padding: 24 }}>
        <MermaidPreview accent={accent} c={c} />
      </div>
    );
  }
  return null;
}

// ────────────────────────────────────────────────────────
// Artifact パネル本体
// ────────────────────────────────────────────────────────
function ArtifactPane({ open, artifacts, currentId, onSelect, onClose, onApply, accent, c }) {
  const [tab, setTab] = React.useState('preview'); // preview | source
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [applyModalOpen, setApplyModalOpen] = React.useState(false);
  const current = artifacts.find((a) => a.id === currentId);

  React.useEffect(() => { setTab('preview'); }, [currentId]);

  if (!open || !current) return null;

  const kindMeta = {
    markdown: { label: 'Markdown', ext: '.md', icon: 'M' },
    html: { label: 'HTML', ext: '.html', icon: '<>' },
    mermaid: { label: 'Mermaid', ext: '.mmd', icon: '◇' },
    code: { label: 'Code', ext: '.txt', icon: '{}' },
    'kintone-customize-js': { label: 'kintone JS', ext: '.js', icon: 'JS' },
  }[current.kind] || { label: 'Artifact', ext: '.txt', icon: '📄' };

  return (
    <div style={{
      flex: 1, minWidth: 0, height: '100%',
      display: 'flex', flexDirection: 'column',
      background: c.bg, borderLeft: `1px solid ${c.border}`,
      position: 'relative',
    }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', borderBottom: `1px solid ${c.border}`,
        background: c.panel, backdropFilter: 'blur(12px)',
        flex: '0 0 auto', position: 'relative', zIndex: 5,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: c.accentSoft, color: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
          flex: '0 0 26px',
        }}>
          {kindMeta.icon}
        </div>
        {/* タイトル + ドロップダウン */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%',
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 0, color: c.text, fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: c.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {current.title}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={c.muted} strokeWidth="1.6" strokeLinecap="round">
                  <path d={menuOpen ? 'M2 6l3-3 3 3' : 'M2 4l3 3 3-3'} />
                </svg>
              </div>
              <div style={{ fontSize: 10.5, color: c.muted, marginTop: 1 }}>
                {kindMeta.label} · 更新 {current.updatedAt}
              </div>
            </div>
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 6,
              background: c.card, border: `1px solid ${c.cardBorder}`,
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              minWidth: 280, zIndex: 100, overflow: 'hidden',
            }}>
              <div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: c.subtle, letterSpacing: 0.5, textTransform: 'uppercase', borderBottom: `1px solid ${c.border}` }}>
                このセッションのアーティファクト · {artifacts.length}
              </div>
              {artifacts.map((a) => {
                const km = ({
                  markdown: { ic: 'M', tone: '#0ea5e9' },
                  html: { ic: '<>', tone: '#a855f7' },
                  mermaid: { ic: '◇', tone: '#10b981' },
                }[a.kind]) || { ic: '·', tone: c.muted };
                return (
                  <button
                    key={a.id}
                    onClick={() => { onSelect(a.id); setMenuOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                      padding: '10px 12px', background: a.id === currentId ? c.cardHi : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'inherit', borderBottom: `1px solid ${c.border}`,
                    }}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: 5, background: km.tone + '22', color: km.tone,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, fontWeight: 700, flex: '0 0 22px',
                    }}>{km.ic}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: c.text, marginBottom: 2 }}>{a.title}</div>
                      <div style={{ fontSize: 10.5, color: c.muted, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.summary}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: c.subtle, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{a.updatedAt}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {/* tabs */}
        <div style={{
          display: 'flex', background: c.cardHi, borderRadius: 7, padding: 2, gap: 1,
          border: `1px solid ${c.cardBorder}`,
        }}>
          {['preview', 'source'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '4px 10px', fontSize: 10.5, fontWeight: 600,
                background: tab === t ? c.card : 'transparent',
                color: tab === t ? c.text : c.muted,
                border: 'none', borderRadius: 5, cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: tab === t ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {t === 'preview' ? 'プレビュー' : 'ソース'}
            </button>
          ))}
        </div>
        {/* actions */}
        <ArtifactIconBtn c={c} title="コピー">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="8" height="8" rx="1.5"/><path d="M2 10V3a1 1 0 011-1h7"/></svg>
        </ArtifactIconBtn>
        <ArtifactIconBtn c={c} title="ダウンロード">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1v9M3 7l4 4 4-4M2 13h10"/></svg>
        </ArtifactIconBtn>
        {current.kind === 'html' && (
          <ArtifactIconBtn c={c} title="新しいタブで開く">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 3H2v9h9V9M8 2h4v4M7 7l5-5"/></svg>
          </ArtifactIconBtn>
        )}
        <ArtifactIconBtn c={c} title="kintoneへ適用" onClick={() => setApplyModalOpen(true)} highlight={accent}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h7M6 4l3 3-3 3M11 2v10"/></svg>
        </ArtifactIconBtn>
        <div style={{ width: 1, height: 18, background: c.border, margin: '0 2px' }} />
        <ArtifactIconBtn c={c} title="閉じる" onClick={onClose}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6"/></svg>
        </ArtifactIconBtn>
      </div>

      {/* ボディ */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: tab === 'preview' && current.kind === 'html' ? '#fafafa' : c.bg }}>
        {tab === 'preview' ? (
          <ArtifactBody artifact={current} accent={accent} c={c} />
        ) : (
          <pre style={{
            margin: 0, padding: '20px 24px', fontSize: 11.5, lineHeight: 1.65,
            fontFamily: 'JetBrains Mono, monospace', color: c.text,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>{current.content}</pre>
        )}
      </div>

      {/* フッター: コメントで Agent に依頼 */}
      <div style={{
        padding: '10px 14px', borderTop: `1px solid ${c.border}`,
        background: c.panel, flex: '0 0 auto',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          border: `1px solid ${c.border}`, borderRadius: 999,
          padding: '6px 6px 6px 14px', background: c.card,
        }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke={c.muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 13px' }}>
            <path d="M2 7a5 5 0 0110 0c0 2.5-2 4.5-5 5l-2 1 .5-2.2A5 5 0 012 7z"/>
          </svg>
          <input
            placeholder="変更を依頼…（例: 「合計を強調して」「3列レイアウトに」）"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              color: c.text, fontSize: 12, fontFamily: 'inherit', padding: '3px 0',
            }}
          />
          <button style={{
            width: 26, height: 26, borderRadius: '50%', border: 'none',
            background: accent, color: c.onAccent || '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flex: '0 0 26px',
          }} title="Agentに送る">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h9M7 3l4 4-4 4"/></svg>
          </button>
        </div>
        <div style={{ fontSize: 10, color: c.subtle, marginTop: 5, textAlign: 'center' }}>
          このアーティファクトに対する変更依頼はチャットに送信されます
        </div>
      </div>

      {applyModalOpen && (
        <ApplyModal artifact={current} accent={accent} c={c} onClose={() => setApplyModalOpen(false)} />
      )}
    </div>
  );
}

function ArtifactIconBtn({ children, c, title, onClick, highlight }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
        background: hover ? (highlight ? highlight + '18' : c.cardHi) : 'transparent',
        color: highlight ? highlight : c.muted,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'inherit', flex: '0 0 28px',
      }}
    >
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────
// kintone 適用モーダル — アプリ選択 + プレビュー + 適用
// ────────────────────────────────────────────────────────
function ApplyModal({ artifact, accent, c, onClose }) {
  const [appId, setAppId] = React.useState('app-142');
  const apps = [
    { id: 'app-142', name: '案件管理', icon: '案', color: '#ffbf00' },
    { id: 'app-87', name: '顧客マスタ', icon: '顧', color: '#0ea5e9' },
    { id: 'app-203', name: '活動履歴', icon: '活', color: '#a855f7' },
  ];
  const target = artifact.kind === 'kintone-customize-js' ? 'カスタマイズJS' : (artifact.kind === 'html' ? 'プレビュー資料' : 'ドキュメント');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, background: 'rgba(20, 14, 5, 0.45)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460, background: c.card,
          borderRadius: 14, border: `1px solid ${c.cardBorder}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', maxHeight: '90%',
        }}
      >
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: c.accentSoft, color: accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 32px',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8h9M7 4l4 4-4 4M13 2v12"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>kintoneへ適用</div>
            <div style={{ fontSize: 11.5, color: c.muted }}>「{artifact.title}」を {target} としてアップロード</div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent',
            color: c.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6"/></svg>
          </button>
        </div>

        <div style={{ padding: '16px 18px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: c.subtle, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
            適用先アプリ
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {apps.map((a) => (
              <button
                key={a.id}
                onClick={() => setAppId(a.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  border: appId === a.id ? `1.5px solid ${accent}` : `1px solid ${c.cardBorder}`,
                  background: appId === a.id ? c.accentSoft : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: a.color + '22', color: a.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 12, flex: '0 0 28px',
                }}>{a.icon}</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: c.text }}>{a.name}</div>
                  <div style={{ fontSize: 10.5, color: c.muted, fontFamily: 'JetBrains Mono, monospace' }}>{a.id}</div>
                </div>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: appId === a.id ? `5px solid ${accent}` : `1.5px solid ${c.border}`,
                  flex: '0 0 16px', transition: 'all .15s',
                }} />
              </button>
            ))}
          </div>

          <div style={{ fontSize: 10.5, fontWeight: 700, color: c.subtle, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
            プレビュー
          </div>
          <div style={{
            border: `1px solid ${c.cardBorder}`, borderRadius: 8, background: c.cardHi,
            padding: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
            color: c.text, maxHeight: 110, overflow: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {artifact.content.slice(0, 240)}{artifact.content.length > 240 ? '\n…' : ''}
          </div>

          <div style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 8,
            background: '#fef9e7', border: '1px solid #fcd34d55',
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#b45309" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 14px', marginTop: 1 }}>
              <path d="M7 1l6 11H1L7 1z"/><path d="M7 5v3M7 10h.01"/>
            </svg>
            <div style={{ fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
              既存のカスタマイズ設定が上書きされます。適用後はアプリの再公開が必要です。
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '12px 18px', borderTop: `1px solid ${c.border}`, background: c.cardHi }}>
          <button onClick={onClose} style={{
            padding: '8px 14px', fontSize: 12.5, fontWeight: 500,
            background: 'transparent', color: c.muted, border: `1px solid ${c.border}`, borderRadius: 8,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>キャンセル</button>
          <div style={{ flex: 1 }} />
          <button style={{
            padding: '8px 18px', fontSize: 12.5, fontWeight: 600,
            background: accent, color: c.onAccent || '#fff', border: 'none', borderRadius: 8,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: `0 2px 8px ${accent}44`,
          }}>適用する</button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// チャット内 artifact 作成カード
// ────────────────────────────────────────────────────────
function ArtifactChatCard({ m, c, accent, onOpen, isOpen }) {
  const km = ({
    markdown: { ic: 'M', tone: '#0ea5e9', label: 'Markdown' },
    html: { ic: '<>', tone: '#a855f7', label: 'HTML' },
    mermaid: { ic: '◇', tone: '#10b981', label: 'Mermaid' },
  }[m.artifactKind]) || { ic: '·', tone: c.muted, label: 'Artifact' };

  return (
    <div className="msg-in" style={{
      border: `1px solid ${isOpen ? accent + '66' : c.cardBorder}`,
      borderRadius: 12, background: c.card, overflow: 'hidden',
      boxShadow: isOpen ? `0 0 0 3px ${accent}15` : '0 1px 3px rgba(0,0,0,0.03)',
      maxWidth: '92%',
    }}>
      <button
        onClick={onOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '11px 13px', background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{
          width: 36, height: 36, borderRadius: 8,
          background: km.tone + '1a', color: km.tone,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
          flex: '0 0 36px',
        }}>{km.ic}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: km.tone, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              📄 Artifact
            </span>
            <span style={{ fontSize: 9, fontWeight: 600, color: c.subtle, letterSpacing: 0.4, textTransform: 'uppercase' }}>· {km.label}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 1 }}>
            {m.artifactTitle}
          </div>
          <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.4 }}>
            {m.artifactSummary}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, color: isOpen ? accent : c.muted,
          padding: '5px 10px', borderRadius: 6,
          background: isOpen ? accent + '18' : c.cardHi,
          flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {isOpen ? '表示中' : '開く'}
          {!isOpen && (
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 5h6M5 2l3 3-3 3"/></svg>
          )}
        </span>
      </button>
    </div>
  );
}

window.ArtifactPane = ArtifactPane;
window.ArtifactChatCard = ArtifactChatCard;
window.ApplyModal = ApplyModal;

// Standalone artifact preview (used by bottom-sheet artboard) — wraps ArtifactPane
// with a single-artifact list so it shows real chrome.
function ArtifactSoloPreview({ artifact, accent, dark }) {
  const c = richColors(dark, accent);
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <ArtifactPane
        open
        artifacts={[artifact]}
        currentId={artifact.id}
        onSelect={() => {}}
        onClose={() => {}}
        accent={accent}
        c={c}
      />
    </div>
  );
}
window.ArtifactSoloPreview = ArtifactSoloPreview;
