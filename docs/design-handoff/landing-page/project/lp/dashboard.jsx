// dashboard.jsx — neutral mock window + artifact dashboard with an animated chart.
const { useState: _dS, useEffect: _dE, useRef: _dR } = React;

function ArtifactWindow({ children }) {
  return (
    <div className="mock-win">
      <div className="mock-win-bar">
        <div className="mock-win-dots"><i></i><i></i><i></i></div>
        <span className="mock-win-kind">HTML</span>
        <span className="mock-win-title">受注ダッシュボード</span>
        <span className="sp"></span>
        <div className="mw-tabs"><span className="on">プレビュー</span><span>ソース</span></div>
      </div>
      {children}
    </div>
  );
}

function ArtifactDashboard() {
  const bars = [
    { name: '田中', v: 348, disp: '34.8' },
    { name: '佐藤', v: 274, disp: '27.4' },
    { name: '山田', v: 216, disp: '21.6' },
    { name: '中村', v: 146, disp: '14.6' },
    { name: '鈴木', v: 98, disp: '9.8' },
  ];
  const max = 348, H = 112;

  return (
    <div className="art">
      <div className="art-head">
        <div>
          <div className="art-title">受注ダッシュボード</div>
          <div className="art-sub">今月 · 全社 · 18件の受注</div>
        </div>
        <span className="art-badge">● 自動生成</span>
      </div>
      <div className="art-kpis">
        <div className="kpi"><div className="l">受注合計</div><div className="v">¥98.4<span style={{ fontSize: 11, fontWeight: 600 }}>M</span></div><div className="d">↑ 12% 前月比</div></div>
        <div className="kpi"><div className="l">平均単価</div><div className="v">¥5.5<span style={{ fontSize: 11, fontWeight: 600 }}>M</span></div><div className="d">↑ 4%</div></div>
        <div className="kpi"><div className="l">受注率</div><div className="v">64<span style={{ fontSize: 11, fontWeight: 600 }}>%</span></div><div className="d flat">— 横ばい</div></div>
      </div>
      <div className="art-chartcap">担当者別 受注金額（百万円）</div>
      <div className="chart">
        {bars.map((b, i) => (
          <div key={i} className={'col' + (i === 0 ? ' top' : '')}>
            <div className="cval">{b.disp}</div>
            <div className="bwrap"><div className="bar" style={{ height: Math.round((b.v / max) * H) + 'px', animationDelay: (i * 90) + 'ms' }}></div></div>
            <div className="clab">{b.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.ArtifactWindow = ArtifactWindow;
window.ArtifactDashboard = ArtifactDashboard;
