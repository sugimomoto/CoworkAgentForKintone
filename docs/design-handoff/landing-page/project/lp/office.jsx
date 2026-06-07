// office.jsx — Office document generation section (Excel / Word / PowerPoint / PDF).
const { useState: oS, useEffect: oE, useRef: oR } = React;

function FileIcon({ c, ext, sm }) {
  return <span className={'fileic' + (sm ? ' sm' : '')} style={{ '--c': c }}><span className="ext">{ext}</span></span>;
}

const FORMATS = [
  {
    id: 'xlsx', fmt: 'Excel', ext: '.xlsx', extLabel: 'XLS', c: '#16794a',
    scn: '集計表・ピボット・ランキング',
    req: '今月の受注を担当者ごとに集計して、Excel にまとめて',
    fn: '2026年6月 受注集計.xlsx', fsub: '担当者別シート + サマリ + ピボット',
  },
  {
    id: 'docx', fmt: 'Word', ext: '.docx', extLabel: 'DOC', c: '#2563a8',
    scn: '議事録・提案書・報告書',
    req: '先週の議事録レコードから、共有用の議事録を Word でまとめて',
    fn: '2026-06-05 定例MTG議事録.docx', fsub: '決定事項・ToDo・次回日程を整形',
  },
  {
    id: 'pptx', fmt: 'PowerPoint', ext: '.pptx', extLabel: 'PPT', c: '#c2622a',
    scn: '役員報告・提案資料・サマリ',
    req: '四半期の営業実績を、経営会議用に5枚のスライドにまとめて',
    fn: 'FY2026 Q1 営業レビュー.pptx', fsub: '5スライド：サマリ / 推移 / 担当者別 / 課題 / 方針',
  },
  {
    id: 'pdf', fmt: 'PDF', ext: '.pdf', extLabel: 'PDF', c: '#b3372f',
    scn: '請求書・契約書・送付用レポート',
    req: '未請求アプリのレコードから、請求書を3件 PDF で作って',
    fn: '請求書 3件 をまとめて作成', fsub: '株式会社A / B / C ・ 20260607', dl: 'まとめてDL',
  },
];

function OfficeCard({ f, generating }) {
  return (
    <div className="ocard" style={{ '--c': f.c }}>
      <div className="ocard-head">
        <FileIcon c={f.c} ext={f.extLabel} />
        <div>
          <div className="fmt">{f.fmt} <span className="ext">{f.ext}</span></div>
          <div className="scn">{f.scn}</div>
        </div>
      </div>
      <div className="ocard-req">{f.req}</div>
      <div className="ocard-out">
        {generating ? (
          <div className="ogen"><span className="sp"></span><span className="gt"><b>{f.fmt}</b> を生成中…</span></div>
        ) : (
          <div className="ofile" key="done">
            <FileIcon c={f.c} ext={f.extLabel} sm />
            <div className="meta">
              <div className="fn"><span className="ok">{I.check(13)}</span>{f.fn}</div>
              <div className="fsub">{f.fsub}</div>
            </div>
            <span className="dlbtn">{I.download(13)} {f.dl || 'ダウンロード'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function OfficeDocs() {
  const [gen, setGen] = oS(-1);
  const ref = oR(null); const live = oR(false);
  oE(() => {
    const io = new IntersectionObserver((es) => { live.current = es[0].isIntersecting; }, { threshold: 0.2 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  oE(() => {
    let i = 0;
    const id = setInterval(() => {
      if (!live.current) { setGen(-1); return; }
      // rotate through the 4 cards, with a gap (-1) between each
      i = (i + 1) % 8;
      setGen(i < 4 ? i : -1);
    }, 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="output" className="office" ref={ref}>
      <div className="container">
        <div className="section-head oneline reveal">
          <span className="eyebrow"><span className="dot"></span>OUTPUT · 成果物</span>
          <h2>そのまま、<span className="accent">使い慣れたファイル</span>で受け取れる。</h2>
          <p>Excel に出して、Word にまとめて、PowerPoint で報告。集計のその先まで、会話のまま完結します。</p>
        </div>
        <div className="office-grid">
          {FORMATS.map((f, i) => <div key={f.id} className="reveal" style={{ transitionDelay: (i % 2 * 60) + 'ms' }}><OfficeCard f={f} generating={gen === i} /></div>)}
        </div>
        <p className="office-note">
          Anthropic 公式の Document Skill を搭載。ファイル生成は Anthropic 側の安全なサンドボックスで行われ、kintone の操作ログには残りません。
          いつもの Excel ワークフローを置き換えるのではなく、ラクにします。
        </p>
      </div>
    </section>
  );
}
window.OfficeDocs = OfficeDocs;
