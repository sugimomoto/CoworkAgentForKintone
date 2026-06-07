// Customizer wedge — Apply workflow footer bar
// Customizer Agent が生成した `kintone-customize-js` artifact のフッターに表示される
// ステップ式 workflow バー: プレビュー → 適用 → ロールバック
//
// Plain artifact のフッター (変更を依頼…) と排他で、artifact.kind が customize 系の時のみ出る。

// 状態:
//   ready       — 生成直後。プレビュー可
//   previewed   — プレビュー済。適用 OK
//   applying    — 適用中 (preview→deploy 進行)
//   applied     — 本番反映済。ロールバック可
//   rolled-back — ロールバック完了

const WORKFLOW_STATES = ['ready', 'previewed', 'applying', 'applied', 'rolled-back'];

function WorkflowFooter({ state = 'ready', c, accent, artifactTitle = 'カスタマイズJS', appName = '案件管理' }) {
  const stepDef = [
    { key: 'preview', label: 'プレビュー', desc: '本番に影響なくサンドボックスで実行', icon: 'eye' },
    { key: 'apply',   label: '適用',        desc: 'kintone preview → deploy で本番反映', icon: 'upload' },
    { key: 'rollback',label: 'ロールバック', desc: '直前のカスタマイズ状態に戻す',         icon: 'undo' },
  ];

  // step ごとの状態を計算
  const stepState = {
    preview:  state === 'ready' ? 'current' : 'done',
    apply:    state === 'ready' ? 'locked'
            : state === 'previewed' ? 'current'
            : state === 'applying' ? 'inprogress'
            : 'done',
    rollback: state === 'applied' ? 'current'
            : state === 'rolled-back' ? 'done'
            : 'locked',
  };

  const statusLine = {
    ready:        { label: 'まだ実機で動かしていません', tone: 'neutral' },
    previewed:    { label: 'プレビューで動作確認済 — 本番反映できます', tone: 'ok' },
    applying:     { label: 'kintone preview → deploy を実行中…', tone: 'work' },
    applied:      { label: `「${appName}」に適用済 · ${new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`, tone: 'ok' },
    'rolled-back':{ label: 'ロールバック完了 — 直前のカスタマイズに戻しました', tone: 'warn' },
  }[state];

  return (
    <div style={{
      borderTop: `1px solid ${c.border}`,
      background: c.panel, backdropFilter: 'blur(12px)',
      padding: '10px 14px 12px',
      flex: '0 0 auto',
    }}>
      {/* ステップ列 */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, marginBottom: 9 }}>
        {stepDef.map((s, i) => (
          <React.Fragment key={s.key}>
            <Step
              n={i + 1}
              def={s}
              status={stepState[s.key]}
              c={c} accent={accent}
            />
            {i < stepDef.length - 1 && (
              <StepConnector
                done={stepState[stepDef[i + 1].key] === 'current' || stepState[stepDef[i + 1].key] === 'done' || stepState[stepDef[i + 1].key] === 'inprogress'}
                c={c} accent={accent}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ステータスラインと主アクションボタン */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 12px',
        background: c.card, border: `1px solid ${c.cardBorder}`,
        borderRadius: 10,
      }}>
        <StatusDot tone={statusLine.tone} accent={accent} c={c} />
        <div style={{ flex: 1, fontSize: 11.5, color: c.text, lineHeight: 1.4 }}>
          {statusLine.label}
        </div>
        <WorkflowAction state={state} c={c} accent={accent} />
      </div>

      {/* ヒント行 */}
      <div style={{ fontSize: 10, color: c.subtle, marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 2 }}>
        <span>変更したい場合はチャットに新しい指示を入力してください</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 5h5M5 2.5l2.5 2.5L5 7.5"/></svg>
          GitHub にコミット
        </span>
      </div>
    </div>
  );
}

function Step({ n, def, status, c, accent }) {
  // status: locked | current | inprogress | done
  const isDone = status === 'done';
  const isCurrent = status === 'current';
  const isInProgress = status === 'inprogress';
  const isLocked = status === 'locked';
  const isRollback = def.key === 'rollback';

  const ringBg = isLocked ? c.cardHi : isCurrent ? (isRollback && status === 'current' ? '#fef3c7' : c.accentSoft) : isDone ? accent : c.accentSoft;
  const ringColor = isLocked ? c.subtle : isCurrent ? (isRollback ? '#b45309' : accent) : isDone ? (c.onAccent || '#fff') : accent;
  const labelColor = isLocked ? c.subtle : c.text;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 0 }}>
      <div style={{ position: 'relative', marginBottom: 4 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: ringBg,
          color: ringColor,
          border: isCurrent ? `2px solid ${isRollback ? '#b45309' : accent}` : `1px solid ${isDone ? accent : c.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isCurrent ? `0 0 0 4px ${isRollback ? '#b4530920' : accent + '20'}` : 'none',
        }}>
          {isDone ? (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 7.5l3 3L12 3.5"/></svg>
          ) : isInProgress ? (
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              border: `2px solid ${accent + '40'}`, borderTopColor: accent,
              animation: 'spin 0.9s linear infinite',
            }} />
          ) : (
            <StepGlyph name={def.icon} />
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: labelColor, lineHeight: 1.2 }}>{def.label}</div>
      <div style={{ fontSize: 9.5, color: c.subtle, lineHeight: 1.35, marginTop: 2, paddingInline: 4 }}>{def.desc}</div>
    </div>
  );
}

function StepConnector({ done, c, accent }) {
  return (
    <div style={{
      flex: '0 0 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      paddingBottom: 26, // align with the ring center
    }}>
      <div style={{
        width: '100%', height: 1.5, borderRadius: 1,
        background: done ? accent : c.border,
      }} />
    </div>
  );
}

function StepGlyph({ name }) {
  if (name === 'eye') return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4S1 7 1 7z"/>
      <circle cx="7" cy="7" r="1.6"/>
    </svg>
  );
  if (name === 'upload') return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 9V2M4 5l3-3 3 3"/>
      <path d="M2 10v2h10v-2"/>
    </svg>
  );
  // undo
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5a4 4 0 017 2.5"/>
      <path d="M3 2v3h3"/>
    </svg>
  );
}

function StatusDot({ tone, accent, c }) {
  const colorMap = {
    neutral: c.muted,
    ok: '#22c55e',
    work: accent,
    warn: '#b45309',
  };
  const color = colorMap[tone] || c.muted;
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%', background: color,
      boxShadow: `0 0 0 3px ${color}22`,
      flex: '0 0 8px',
    }} />
  );
}

function WorkflowAction({ state, c, accent }) {
  if (state === 'ready') return (
    <button style={primaryWorkBtn(c, accent)}>
      <PlayIcon /> プレビューを実行
    </button>
  );
  if (state === 'previewed') return (
    <>
      <button style={ghostWorkBtn(c)}>もう一度プレビュー</button>
      <button style={primaryWorkBtn(c, accent)}>
        <UploadIcon /> kintone に適用
      </button>
    </>
  );
  if (state === 'applying') return (
    <button disabled style={{ ...primaryWorkBtn(c, accent), opacity: 0.7, cursor: 'wait' }}>
      適用中…
    </button>
  );
  if (state === 'applied') return (
    <>
      <button style={ghostWorkBtn(c)}>
        <ExtIcon /> 適用先を開く
      </button>
      <button style={warnPrimaryBtn(c)}>
        <UndoIcon /> ロールバック
      </button>
    </>
  );
  // rolled-back
  return (
    <button style={primaryWorkBtn(c, accent)}>もう一度適用</button>
  );
}

function PlayIcon() {
  return <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" style={{ marginRight: 4 }}><path d="M3 2l7 4-7 4z"/></svg>;
}
function UploadIcon() {
  return <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}><path d="M6 8V2M3.5 4.5L6 2l2.5 2.5"/><path d="M2 9v1h8V9"/></svg>;
}
function ExtIcon() {
  return <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}><path d="M6 2h4v4M9 3L5 7M2 5v5h5"/></svg>;
}
function UndoIcon() {
  return <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}><path d="M3 5a4 4 0 017 2.5"/><path d="M3 2v3h3"/></svg>;
}

function primaryWorkBtn(c, accent) {
  return {
    padding: '6px 12px', borderRadius: 7,
    background: accent, color: c.onAccent || '#fff', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 11.5, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center',
    boxShadow: `0 1px 2px ${accent}30`,
  };
}

function ghostWorkBtn(c) {
  return {
    padding: '6px 11px', borderRadius: 7,
    background: 'transparent', color: c.text, border: `1px solid ${c.border}`,
    cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 11.5, fontWeight: 500,
    display: 'inline-flex', alignItems: 'center',
    marginRight: 6,
  };
}

function warnPrimaryBtn(c) {
  return {
    padding: '6px 12px', borderRadius: 7,
    background: '#b45309', color: '#fff', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 11.5, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center',
  };
}

// ────────────────────────────────────────────────────────
// File tree — customize bundle の構成を表示
// ────────────────────────────────────────────────────────
const CUSTOMIZE_FILES = [
  { type: 'folder', name: 'customize', open: true, level: 0 },
  { type: 'file',   name: 'desktop.js', kind: 'js',   path: 'customize/desktop.js',  level: 1, active: true,  status: 'modified', size: '2.3 KB' },
  { type: 'file',   name: 'mobile.js',  kind: 'js',   path: 'customize/mobile.js',   level: 1, status: 'unchanged', size: '1.1 KB' },
  { type: 'file',   name: 'desktop.css', kind: 'css', path: 'customize/desktop.css', level: 1, status: 'modified', size: '0.4 KB' },
  { type: 'folder', name: 'libs',       open: false, level: 1 },
  { type: 'file',   name: 'manifest.json', kind: 'json', path: 'manifest.json',     level: 0, status: 'unchanged', size: '320 B' },
  { type: 'file',   name: 'README.md',    kind: 'md',   path: 'README.md',         level: 0, status: 'new',       size: '1.8 KB' },
];

function FileTree({ c, accent }) {
  return (
    <div style={{
      width: 200, flex: '0 0 200px',
      background: c.cardHi,
      borderRight: `1px solid ${c.border}`,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '9px 12px', borderBottom: `1px solid ${c.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke={c.muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 4h4l1 1.5h6v6.5h-11z"/>
        </svg>
        <span style={{ fontSize: 11, fontWeight: 600, color: c.text, flex: 1 }}>customize</span>
        <span style={{
          fontSize: 9, color: accent, fontWeight: 600,
          background: c.accentSoft, padding: '1px 5px', borderRadius: 3,
        }}>3 変更</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {CUSTOMIZE_FILES.map((f, i) => (
          <FileTreeRow key={i} f={f} c={c} accent={accent} />
        ))}
      </div>
      <div style={{
        padding: '8px 12px', borderTop: `1px solid ${c.border}`,
        fontSize: 9.5, color: c.subtle,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
        プレビュー環境 と同期
      </div>
    </div>
  );
}

function FileTreeRow({ f, c, accent }) {
  if (f.type === 'folder') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 12px', paddingLeft: 8 + f.level * 14,
        fontSize: 11, color: c.text,
      }}>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {f.open ? <path d="M3 5l3 3 3-3"/> : <path d="M4.5 3l3 3-3 3"/>}
        </svg>
        <svg width="11" height="11" viewBox="0 0 12 12" fill={accent + '33'} stroke={accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          {f.open
            ? <path d="M1.5 4h3l1 1h5v5h-9z"/>
            : <path d="M1.5 4h3l1 1h5v5h-9zM1.5 5h9"/>}
        </svg>
        <span style={{ flex: 1, fontWeight: 500 }}>{f.name}</span>
      </div>
    );
  }
  const kindColor = {
    js: '#946c00', css: '#0e7c4a', json: '#9333ea', md: '#6b5f4a',
  }[f.kind] || c.muted;
  const statusColor = {
    new: { dot: '#22c55e', label: 'M' },
    modified: { dot: '#f59e0b', label: 'M' },
    unchanged: null,
  }[f.status];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 12px',
      paddingLeft: 8 + f.level * 14 + 14, // align with folder icon
      fontSize: 11,
      color: c.text,
      background: f.active ? c.card : 'transparent',
      borderLeft: f.active ? `2px solid ${accent}` : '2px solid transparent',
      cursor: 'pointer',
    }}>
      <span style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 8.5,
        fontWeight: 700, color: '#fff',
        background: kindColor, padding: '1px 3px', borderRadius: 2,
        flex: '0 0 auto',
      }}>{f.kind}</span>
      <span style={{ flex: 1, fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, fontWeight: f.active ? 600 : 400 }}>{f.name}</span>
      {statusColor && (
        <span title={f.status} style={{
          fontSize: 8.5, fontWeight: 700, color: statusColor.dot,
          fontFamily: '"JetBrains Mono", monospace',
        }}>{f.status === 'new' ? '+' : '●'}</span>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Customizer 用 Artifact 風プレビュー — JS code をカードで表示
// ────────────────────────────────────────────────────────
function CustomizerArtifactCard({ c, accent, state = 'ready', showTree = true }) {
  const sample = `// 案件管理 — 完了行ハイライト
(() => {
  'use strict';
  const STATUS_FIELD = 'ステータス';
  const TARGET_VALUE = '受注';
  const COLOR = '#e6f4f0';

  kintone.events.on('app.record.index.show', (event) => {
    const rows = document.querySelectorAll(
      '.gaia-mobile-app-listview tr, .recordlist-row-gaia'
    );
    event.records.forEach((rec, i) => {
      if (rec[STATUS_FIELD]?.value === TARGET_VALUE) {
        rows[i]?.style.setProperty('background', COLOR);
      }
    });
    return event;
  });
})();`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Artifact header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderBottom: `1px solid ${c.border}`,
        background: c.panel, flex: '0 0 auto',
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: '#f7df1e22', color: '#946c00',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 800,
        }}>JS</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text, display: 'flex', alignItems: 'center', gap: 5 }}>
            完了行ハイライト
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke={c.muted} strokeWidth="1.6"><path d="M3 5l3 3 3-3"/></svg>
          </div>
          <div style={{ fontSize: 10.5, color: c.muted }}>kintone-customize-js · 案件管理 · 更新 14:32</div>
        </div>
        <div style={{
          display: 'flex', background: c.cardHi, border: `1px solid ${c.border}`,
          borderRadius: 7, padding: 2, fontSize: 10.5, fontWeight: 600,
        }}>
          <span style={{ padding: '3px 8px', background: c.card, borderRadius: 5, color: c.text }}>ソース</span>
          <span style={{ padding: '3px 8px', color: c.muted }}>差分</span>
        </div>
        <button title="コピー" style={iconBtn28(c)}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="8" height="9" rx="1.5"/><path d="M5 3V1.5h6V10"/></svg>
        </button>
        <button title="ダウンロード" style={iconBtn28(c)}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 2v8M4 7l3 3 3-3"/><path d="M2 12h10"/></svg>
        </button>
        <button title="閉じる" style={iconBtn28(c)}>
          <CloseIcon />
        </button>
      </div>

      {/* Body: file tree (任意) + JS source */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {showTree && <FileTree c={c} accent={accent} />}
        <div style={{ flex: 1, overflow: 'auto', background: c.bg, position: 'relative' }}>
          {showTree && (
            <div style={{
              position: 'sticky', top: 0, zIndex: 1,
              background: c.cardHi, borderBottom: `1px solid ${c.border}`,
              padding: '6px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 10.5, color: c.muted,
            }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1.5 6.5h6M5.5 4l2 2.5L5.5 9"/>
              </svg>
              <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>customize / desktop.js</span>
              <span style={{ marginLeft: 'auto', fontSize: 9.5, color: c.subtle }}>JavaScript · 56 行</span>
            </div>
          )}
          <pre style={{
            margin: 0, padding: '16px 18px',
            fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5,
            lineHeight: 1.7, color: c.text,
            whiteSpace: 'pre-wrap',
          }}>{highlightJS(sample, accent, c)}</pre>
        </div>
      </div>

      {/* Workflow footer */}
      <WorkflowFooter state={state} c={c} accent={accent} />
    </div>
  );
}

function highlightJS(src, accent, c) {
  // 雑な構文ハイライト — 完璧でなくてよい、雰囲気だけ
  const tokens = [];
  const lines = src.split('\n');
  return lines.map((line, i) => {
    const parts = [];
    let rest = line;
    let pk = 0;
    const push = (text, style) => {
      if (!text) return;
      parts.push(<span key={pk++} style={style}>{text}</span>);
    };
    while (rest.length) {
      // comments
      const mCom = rest.match(/^(\s*\/\/.*)$/);
      if (mCom) { push(mCom[1], { color: c.subtle, fontStyle: 'italic' }); rest = ''; break; }
      // strings
      const mStr = rest.match(/^(\s*)('[^']*'|"[^"]*"|`[^`]*`)/);
      if (mStr) {
        push(mStr[1]);
        push(mStr[2], { color: '#0e7c4a' });
        rest = rest.slice(mStr[0].length); continue;
      }
      // keyword
      const mKw = rest.match(/^(\s*)\b(const|let|var|if|return|function|forEach|new|true|false|null|undefined|use strict)\b/);
      if (mKw) {
        push(mKw[1]);
        push(mKw[2], { color: '#9333ea', fontWeight: 600 });
        rest = rest.slice(mKw[0].length); continue;
      }
      // chars one at a time
      push(rest[0]);
      rest = rest.slice(1);
    }
    return (
      <div key={i} style={{ display: 'flex' }}>
        <span style={{
          flex: '0 0 28px', color: c.subtle, opacity: 0.5,
          textAlign: 'right', marginRight: 12, userSelect: 'none',
        }}>{i + 1}</span>
        <span style={{ flex: 1 }}>{parts.length ? parts : '\u00A0'}</span>
      </div>
    );
  });
}

function iconBtn28(c) {
  return {
    width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
    background: 'transparent', color: c.muted,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flex: '0 0 28px',
  };
}

Object.assign(window, {
  WorkflowFooter, CustomizerArtifactCard, WORKFLOW_STATES, FileTree, CUSTOMIZE_FILES,
});
