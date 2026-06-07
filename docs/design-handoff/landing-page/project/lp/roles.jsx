// roles.jsx — role-based use cases (役割別). Tabs → representative chat mock + more prompts.
const { useState: rS } = React;

// quote/chat icon for prompt rows
const QChat = (s = 13) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3.5h10v7H7l-3 2.5V10.5H3z"/>
  </svg>
);

// static chat mock: user request → (tool) → result
function RoleMock({ request, tool, result }) {
  return (
    <ChatPanel solo foot="メッセージを入力…">
      <UserMsg>{request}</UserMsg>
      {tool ? <ToolCall tool={tool.tool} label={tool.label} detail={tool.detail} /> : null}
      {result}
    </ChatPanel>
  );
}

// priority / status list result
function ListResult({ title, sub, rows }) {
  return (
    <div className="msg m-result">
      <div className="rh"><div className="t">{title}</div>{sub ? <div className="s">{sub}</div> : null}</div>
      <div className="rows">
        {rows.map((r, i) => (
          <div key={i} className="row">
            <span className={'prio ' + r.tone}>{r.pill}</span>
            <span className="rn">{r.text}</span>
            <span className="rmeta">{r.meta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
// checklist result
function CheckResult({ title, rows }) {
  return (
    <div className="msg m-result">
      <div className="rh"><div className="t">{title}</div></div>
      <div className="rows">
        {rows.map((r, i) => (
          <div key={i} className="row">
            <span className={'chk ' + (r.warn ? 'warn' : 'ok')}>{r.warn ? '!' : I.check(12)}</span>
            <span className="rn">{r.text}</span>
            <span className="rmeta">{r.meta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ROLES = [
  {
    id: 'sales', badge: '営', name: '営業', primary: true,
    tagline: '受注の集計、顧客リストの抽出、活動報告のまとめ。毎週の「あの作業」を話すだけに。',
    request: '今月の受注で500万円超の案件を、担当者ごとにランキングで集計して',
    tool: { tool: 'get_records', label: '案件管理を集計', detail: '受注日=今月 AND 金額≥¥5,000,000 → 9件' },
    result: <ResultCard title="担当者別 受注ランキング · 今月" sub="9件 · 合計 ¥84.2M"
      rows={[
        { ini: '田', name: '1. 田中 美咲', val: 348, disp: '¥34.8M', color: '#0d9488' },
        { ini: '佐', name: '2. 佐藤 健一', val: 274, disp: '¥27.4M', color: '#0a766c' },
        { ini: '山', name: '3. 山田 拓也', val: 216, disp: '¥21.6M', color: '#b45309' },
      ]} followups={['グラフにする', 'Slackで共有']} />,
    examples: [
      '3ヶ月以上連絡していない既存顧客を抽出して、優先連絡リストを作って',
      '先週の新規見込み客で、業種がITの会社を案件アプリに転記して',
      '今月の活動報告を案件別にまとめて、ネクストアクションを抜き出して',
    ],
  },
  {
    id: 'cs', badge: 'CS', name: 'カスタマーサポート', primary: true,
    tagline: '未対応の棚卸し、傾向分析、FAQ づくり。問い合わせの山を、落ち着いてさばく。',
    request: '24時間以上未対応の問い合わせを優先度順に並べて、各件を要約して',
    tool: { tool: 'search_records', label: '問い合わせ管理を検索', detail: 'ステータス=未対応 AND 24時間以上 → 12件' },
    result: <ListResult title="未対応チケット · 優先度順" sub="12件 · 最長 32時間"
      rows={[
        { pill: '高', tone: 'high', text: 'サーバー接続エラー（A社）', meta: '32h 経過' },
        { pill: '高', tone: 'high', text: '請求金額の相違（B社）', meta: '28h 経過' },
        { pill: '中', tone: 'mid', text: 'ログインできない（C社）', meta: '25h 経過' },
      ]} />,
    examples: [
      '先月のクレーム案件を、頻出キーワードで分類して傾向を見せて',
      '「至急」タグが付いた未解決の問い合わせを、対応案件アプリに転記して',
      '対応完了したチケットから、FAQ 候補を10件抽出して',
    ],
  },
  {
    id: 'hr', badge: '人', name: '人事', primary: true,
    tagline: '入社処理の抜け漏れ、勤怠の集計、リマインド文面。細かな確認作業を、まとめて任せる。',
    request: '先月入社した人の社内アカウント発行漏れがないかチェックして',
    tool: { tool: 'cross_app', label: '社員マスタ × アカウント管理を照合', detail: '4月入社 6名を突合' },
    result: <CheckResult title="入社処理チェック · 4月入社 6名"
      rows={[
        { text: '社内アカウント発行', meta: '5 / 6', warn: false },
        { text: '未発行 1名（佐藤 健太さん）', meta: '要対応', warn: true },
        { text: '入社書類の回収', meta: '6 / 6', warn: false },
      ]} />,
    examples: [
      '有給残が5日以下の社員に向けた、リマインド文面のドラフトを作って',
      '内定者アプリと社員マスタを照合して、入社処理のチェックリストを作って',
      '先月の残業時間が45時間超の人を抽出して、上司ごとに集計して',
    ],
  },
  {
    id: 'fin', badge: '経', name: '経理', primary: false,
    tagline: '未入金の照合、経費チェック、締めの集計。',
    request: '請求書アプリと入金管理アプリを照合して、未入金の案件を期日順に並べて',
    tool: { tool: 'cross_app', label: '請求書 × 入金管理を照合', detail: '未入金 → 7件' },
    result: <ListResult title="未入金リスト · 期日順" sub="7件 · 合計 ¥18.6M"
      rows={[
        { pill: '超過', tone: 'over', text: 'C商事 ¥4.2M', meta: '期日 5日超過' },
        { pill: '近日', tone: 'soon', text: 'D工業 ¥3.1M', meta: '期日 明日' },
        { pill: '近日', tone: 'soon', text: 'E社 ¥2.4M', meta: '期日 3日後' },
      ]} />,
    examples: [
      '先月の経費申請で、領収書が添付されていないものをリストアップして',
      '四半期締めの仕訳データを部門別に集計して、CSV に出力して',
    ],
  },
  {
    id: 'ga', badge: '総', name: '総務・情シス', primary: false,
    tagline: '備品の返却管理、申請の督促、社内 FAQ。',
    request: '備品管理アプリで返却期限を過ぎている貸出物を、担当者別にまとめて',
    tool: { tool: 'search_records', label: '備品管理を検索', detail: '返却期限 < 本日 → 8件' },
    result: <ListResult title="返却期限切れ · 担当者別" sub="8件"
      rows={[
        { pill: '超過', tone: 'over', text: 'ノートPC #14（田中）', meta: '12日超過' },
        { pill: '超過', tone: 'over', text: 'プロジェクター（佐藤）', meta: '5日超過' },
        { pill: '中', tone: 'mid', text: '貸出スマホ #3（鈴木）', meta: '2日超過' },
      ]} />,
    examples: [
      '社内申請アプリの未承認案件を、承認者別に集計してリマインドできる状態にして',
      '社内ヘルプデスクへの問い合わせから、よくある質問 Top10 を作って',
    ],
  },
];

function RoleScenes() {
  const [active, setActive] = rS('sales');
  const r = ROLES.find(x => x.id === active);
  const primary = ROLES.filter(x => x.primary);
  const secondary = ROLES.filter(x => !x.primary);
  return (
    <section id="roles" className="roles">
      <div className="container">
        <div className="section-head oneline reveal">
          <span className="eyebrow"><span className="dot"></span>BY ROLE · 役割別</span>
          <h2>あなたの kintone 業務は、<span className="accent">どれ</span>ですか？</h2>
          <p>役割を選ぶと、そのままチャットに送れる「依頼例」が見られます。これ、毎週やっていませんか？</p>
        </div>

        <div className="role-tabs reveal">
          {primary.map(role => (
            <button key={role.id} className={'role-tab' + (active === role.id ? ' on' : '')} onClick={() => setActive(role.id)}>
              <span className="rb">{role.badge}</span>{role.name}
            </button>
          ))}
          <span className="role-divider"></span>
          {secondary.map(role => (
            <button key={role.id} className={'role-tab secondary' + (active === role.id ? ' on' : '')} onClick={() => setActive(role.id)}>
              <span className="rb">{role.badge}</span>{role.name}
            </button>
          ))}
        </div>

        <div className="role-stage" key={r.id}>
          <div className="role-text">
            <div className="role-head">
              <span className="rbadge">{r.badge}</span>
              <h3>{r.name}のあなたへ</h3>
            </div>
            <p className="role-tagline">{r.tagline}</p>
            <div className="role-exlabel">こんな依頼も、ひとことで</div>
            {r.examples.map((ex, i) => (
              <div key={i} className="role-ex">
                <span className="qi">{QChat(12)}</span>
                <span className="qt">{ex}</span>
              </div>
            ))}
          </div>
          <div className="role-mock">
            <RoleMock request={r.request} tool={r.tool} result={r.result} />
          </div>
        </div>

        <div className="role-foot reveal">
          自分の役割が見つからない？ それでも大丈夫。<a href="#usecases">できることの仕組みを見る →</a>
        </div>
      </div>
    </section>
  );
}
window.RoleScenes = RoleScenes;
