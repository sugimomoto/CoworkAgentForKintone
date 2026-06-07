// ui-kit.jsx — reusable chat UI primitives + kintone host mock
// Exposed on window for use by hero / usecases / wedge sections.

const { useState, useEffect, useRef } = React;

// ── Icons (stroke 1.8, currentColor) ───────────────────────────
const I = {
  search: (s = 16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="m13.5 13.5-3-3"/></svg>,
  check: (s = 14) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 8.5 3 3 6-7"/></svg>,
  arrow: (s = 14) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h9M8 4l4 4-4 4"/></svg>,
  arrowR: (s = 14) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h9M8 4l4 4-4 4"/></svg>,
  send: (s = 15) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2 7 9M14 2l-4.5 12-2.5-5-5-2.5L14 2z"/></svg>,
  shield: (s = 20) => <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2 3.5 4.5v5C3.5 14 6.5 16.5 10 17.5c3.5-1 6.5-3.5 6.5-8v-5L10 2z"/><path d="m7.2 9.8 2 2 3.6-4.2"/></svg>,
  panel: (s = 20) => <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="3.5" width="15" height="13" rx="2.5"/><path d="M12.5 3.5v13"/><path d="M14.5 7.5h1M14.5 10h1"/></svg>,
  async: (s = 20) => <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 6.5A7 7 0 1 0 17 10"/><path d="M16.5 3v3.5H13"/><path d="M10 6.5V10l2.3 2.3"/></svg>,
  clock: (s = 12) => <svg width={s} height={s} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="5.2"/><path d="M7 4.3V7l1.8 1.1"/></svg>,
  bolt: (s = 16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 1.5 3.5 9H7l-.5 5.5L12.5 7H9z"/></svg>,
  doc: (s = 16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 2h5l4 4v8h-9z"/><path d="M8.5 2v4h4"/><path d="M5.5 9h5M5.5 11.5h3"/></svg>,
  swap: (s = 16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h8M9 3l2 2-2 2"/><path d="M13 11H5m2-2-2 2 2 2"/></svg>,
  github: (s = 16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="currentColor"><path d="M8 .2a8 8 0 0 0-2.5 15.6c.4.07.55-.17.55-.38v-1.3c-2.2.48-2.67-1.07-2.67-1.07-.36-.92-.88-1.16-.88-1.16-.72-.5.05-.48.05-.48.8.05 1.22.82 1.22.82.71 1.2 1.86.86 2.32.66.07-.52.28-.86.5-1.06-1.76-.2-3.6-.88-3.6-3.9 0-.86.3-1.57.82-2.12-.08-.2-.36-1 .08-2.1 0 0 .67-.21 2.2.81a7.6 7.6 0 0 1 4 0c1.53-1.02 2.2-.8 2.2-.8.44 1.1.16 1.89.08 2.09.5.55.82 1.26.82 2.12 0 3.03-1.85 3.7-3.61 3.89.28.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 .2z"/></svg>,
  download: (s = 16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8M5 7l3 3 3-3"/><path d="M3 13h10"/></svg>,
  lock: (s = 16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>,
  scale: (s = 16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v12M3 5h10M4.5 5 3 9h3zM11.5 5 10 9h3z"/></svg>,
  spark: (s = 16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4.2 4.2l2 2M9.8 9.8l2 2M11.8 4.2l-2 2M6.2 9.8l-2 2"/></svg>,
  star: (s = 18) => <svg width={s} height={s} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L9 12.3l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/></svg>,
};
window.I = I;

// star glyph used in the avatar
function AvatarStar({ s = 18 }) {
  return <svg width={s} height={s} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2.4l1.9 3.95 4.35.6-3.15 3.05.74 4.3L9 12.27l-3.88 2.03.74-4.3L2.7 6.95l4.35-.6z"/></svg>;
}

// ── Chat panel shell ───────────────────────────────────────────
function ChatPanel({ children, solo = true, name = 'Cowork Agent', status = '作業中 · kintone接続', foot, footTyping, bottom = false, rootRef }) {
  return (
    <div className={'cp' + (solo ? ' solo' : '')} ref={rootRef}>
      <div className="cp-head">
        <div className="cp-avatar"><AvatarStar /><span className="status"></span></div>
        <div className="cp-id">
          <div className="name">{name}<span className="badge">for kintone</span></div>
          <div className="stat"><span className="ring"></span>{status}</div>
        </div>
        <div className="cp-head ic" style={{ display: 'inline-flex' }}>{I.clock(13)}</div>
      </div>
      <div className={'cp-scroll' + (bottom ? ' anchor-bottom' : '')}>{children}</div>
      <div className="cp-foot">
        <div className="cp-input">
          <span className="ph">{foot || 'メッセージを入力…'}{footTyping ? <span className="caret"></span> : null}</span>
          <span className="cp-send">{I.send(14)}</span>
        </div>
        <div className="cp-hint"><span className="mono">⌘K</span> 呼び出し · Claude Managed Agents</div>
      </div>
    </div>
  );
}
window.ChatPanel = ChatPanel;

// ── Message blocks ─────────────────────────────────────────────
const Greet = ({ hello, sub, actions }) => (
  <div className="msg m-greet">
    <div className="hello">{hello}</div>
    {sub ? <div className="sub">{sub}</div> : null}
    {actions ? <div className="m-actions">{actions.map((a, i) => (
      <div key={i} className="m-action"><span className="arr">{I.arrowR(12)}</span>{a}</div>
    ))}</div> : null}
  </div>
);
const UserMsg = ({ children }) => <div className="msg m-user">{children}</div>;
const AgentMsg = ({ children }) => (
  <div className="msg m-agent"><span className="av"><AvatarStar s={13} /></span><div className="bubble">{children}</div></div>
);
const Thinking = () => (
  <div className="msg m-agent"><span className="av"><AvatarStar s={13} /></span><div className="m-think"><i></i><i></i><i></i></div></div>
);
const ToolCall = ({ tool, label, detail, items }) => (
  <div className="msg m-tool">
    <span className="ck">{I.check(12)}</span>
    <div className="body">
      <div className="top"><span className="tname">{tool}</span><span className="tlabel">{label}</span></div>
      {detail ? <div className="tdetail">{detail}</div> : null}
      {items ? <div className="items">{items.map((it, i) => <span key={i} className="it">{it}</span>)}</div> : null}
    </div>
  </div>
);
const PlanCard = ({ title, danger, steps, footNote, primaryLabel = '承認して実行' }) => (
  <div className={'msg m-plan' + (danger ? ' danger' : '')}>
    <div className="ph">
      <span className="t">{danger ? '⚠️ ' : ''}{title}</span>
      {danger ? <span className="need">要承認</span> : null}
    </div>
    <div className="steps">
      {steps.map((s, i) => (
        <div key={i} className="pstep">
          <span className="pnum">{i + 1}</span>
          <div><div className="op">{s.op}</div><div className="txt">{s.txt}</div></div>
        </div>
      ))}
    </div>
    <div className="pfoot">
      <span className={'pbtn' + (danger ? ' go' : '')} style={!danger ? { background: 'var(--accent)', color: '#fff', borderColor: 'transparent' } : null}>{primaryLabel}</span>
      <span className="pbtn">キャンセル</span>
    </div>
  </div>
);
const ResultCard = ({ title, sub, rows, followups }) => {
  const max = Math.max(...rows.map(r => r.val));
  return (
    <div className="msg m-result">
      <div className="rh"><div className="t">{title}</div>{sub ? <div className="s">{sub}</div> : null}</div>
      <div className="rows">
        {rows.map((r, i) => (
          <div key={i} className="row">
            <span className="ini" style={{ background: r.color }}>{r.ini}</span>
            <span className="rn">{r.name}</span>
            <span className="rbartrack"><span className="rbar" style={{ width: Math.round((r.val / max) * 100) + '%' }}></span></span>
            <span className="rv">{r.disp}</span>
          </div>
        ))}
      </div>
      {followups ? <div className="followups">{followups.map((f, i) => <span key={i} className="fu">{f}</span>)}</div> : null}
    </div>
  );
};
const ProgressCard = ({ title, pct }) => (
  <div className="msg m-prog">
    <div className="top"><span className="spin"></span><span className="pt">{title}</span><span className="pct">{pct}%</span></div>
    <div className="track"><span className="fill" style={{ width: pct + '%' }}></span></div>
  </div>
);
const ArtifactCard = ({ kind, title, summary }) => (
  <div className="msg m-artifact">
    <span className="ai">{I.doc(16)}</span>
    <div className="ab"><div className="ak">ARTIFACT · {kind}</div><div className="at">{title}</div><div className="asum">{summary}</div></div>
    <span className="aopen">開く {I.arrow(11)}</span>
  </div>
);

Object.assign(window, { Greet, UserMsg, AgentMsg, Thinking, ToolCall, PlanCard, ResultCard, ProgressCard, ArtifactCard, AvatarStar });

// ── kintone host mock (table) ──────────────────────────────────
const KT_ROWS = [
  { no: 'REC-0421', name: '三井商事 受注案件', who: '田中 美咲', amt: '¥12,400,000', date: '04-18', st: ['win', '受注'] },
  { no: 'REC-0420', name: 'パナソニック 保守更新', who: '佐藤 健一', amt: '¥8,900,000', date: '04-18', st: ['prop', '提案中'] },
  { no: 'REC-0419', name: 'ソフトバンク SaaS導入', who: '鈴木 葵', amt: '¥6,200,000', date: '04-17', st: ['new', '新規'] },
  { no: 'REC-0418', name: '楽天 追加開発案件', who: '山田 拓也', amt: '¥15,800,000', date: '04-17', st: ['prop', '提案中'] },
  { no: 'REC-0417', name: '日立 コンサル契約', who: '田中 美咲', amt: '¥22,400,000', date: '04-16', st: ['win', '受注'] },
  { no: 'REC-0416', name: 'NTT 保守対応', who: '中村 玲奈', amt: '¥4,100,000', date: '04-16', st: ['new', '新規'] },
  { no: 'REC-0415', name: 'キヤノン システム更改', who: '佐藤 健一', amt: '¥18,200,000', date: '04-15', st: ['prop', '提案中'] },
];
function KintoneHost({ children }) {
  return (
    <div className="kt">
      <div className="kt-topbar">
        <span className="kt-logo">k</span>
        <span className="kt-crumb">営業部 · CRM スペース · <b>案件管理</b></span>
        <span className="kt-spacer"></span>
        <span className="kt-user"></span>
      </div>
      <div className="kt-appbar">
        <span className="kt-appicon">案</span>
        <div><div className="kt-appname">案件管理</div><div className="kt-appsub">レコード一覧 · 248件</div></div>
        <span className="kt-spacer"></span>
        <span className="kt-btn">絞り込み</span>
        <span className="kt-btn">CSV</span>
        <span className="kt-btn amber">+ レコード追加</span>
      </div>
      <div className="kt-body">
        <div className="kt-table-wrap">
          <div className="kt-tabs"><span className="on">すべて</span><span>自分の担当</span><span>今月</span><span>未対応</span></div>
          <table className="kt-table">
            <thead><tr><th>レコードNo.</th><th>案件名</th><th>担当者</th><th>受注金額</th><th>受注日</th><th>状態</th></tr></thead>
            <tbody>
              {KT_ROWS.map((r, i) => (
                <tr key={i}>
                  <td className="mono" style={{ color: 'var(--subtle)' }}>{r.no}</td>
                  <td>{r.name}</td>
                  <td>{r.who}</td>
                  <td className="num">{r.amt}</td>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{r.date}</td>
                  <td><span className={'kt-pill ' + r.st[0]}>{r.st[1]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {children}
      </div>
    </div>
  );
}
window.KintoneHost = KintoneHost;
