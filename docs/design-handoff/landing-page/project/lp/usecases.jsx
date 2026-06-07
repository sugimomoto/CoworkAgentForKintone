// usecases.jsx — ★ business-user use cases, each an animated mini chat mock.

// fixed-height solo panels that anchor newest message to the bottom
function UCPanel({ build, status }) {
  const { msgs, compose, typing, ref } = useChatScene(build, []);
  return <ChatPanel rootRef={ref} bottom status={status} foot={compose || 'メッセージを入力…'} footTyping={typing}>{msgs}</ChatPanel>;
}

// ── UC1: 自然言語で検索・集計 ──────────────────────────
function Mock1() {
  const u = <UserMsg key="u">未対応の問い合わせを、カテゴリ別に件数を出して</UserMsg>;
  const th = <Thinking key="th" />;
  const t = <ToolCall key="t" tool="search_records" label="問い合わせ管理を検索" detail="ステータス=未対応 → 86件 ヒット" />;
  const r = (
    <ResultCard key="r" title="カテゴリ別 未対応件数" sub="86件 · 4カテゴリ"
      rows={[
        { ini: '請', name: '請求・支払い', val: 34, disp: '34件', color: '#0d9488' },
        { ini: '技', name: '技術サポート', val: 27, disp: '27件', color: '#0a766c' },
        { ini: '契', name: '契約・更新', val: 15, disp: '15件', color: '#b45309' },
        { ini: '他', name: 'その他', val: 10, disp: '10件', color: '#6b5f4a' },
      ]}
      followups={['担当者を割り当て', 'グラフにする']} />
  );
  return <UCPanel build={() => [
    { msgs: [u], hold: 1 }, { type: '未対応の問い合わせを、カテゴリ別に件数を出して', cps: 40 }, { clear: true },
    { msgs: [u], hold: 600 }, { msgs: [u, th], hold: 950 }, { msgs: [u, t], hold: 900 },
    { msgs: [u, t, r], hold: 4200 },
  ]} />;
}

// ── UC2: クイックアクションのワンクリック実行 ──────────────
function QuickActions({ active }) {
  const acts = [
    { ic: '◷', t: '今日の新着' }, { ic: '⚑', t: '未対応を集計' },
    { ic: '◰', t: '週次レポート' }, { ic: '⟳', t: '重複を検出' },
  ];
  return (
    <div className="msg">
      <div className="qa-label">クイックアクション</div>
      <div className="qa-grid">
        {acts.map((a, i) => (
          <div key={i} className={'qa-btn' + (i === active ? ' on' : '')}>
            <span className="qi mono">{a.ic}</span>{a.t}
          </div>
        ))}
      </div>
    </div>
  );
}
function Mock2() {
  const qa0 = <QuickActions key="qa" active={0} />;
  const qa1 = <QuickActions key="qa" active={1} />;
  const u = <UserMsg key="u">⚑ 未対応を集計</UserMsg>;
  const p = <ProgressCard key="p" title="週次レポートを生成中…" pct={64} />;
  const a = <ArtifactCard key="a" kind="MARKDOWN" title="週次サポートレポート" summary="未対応86件・平均応答 4.2h・SLA超過 3件" />;
  return <UCPanel status="プリセット待機中" build={() => [
    { msgs: [qa0], hold: 1400 }, { msgs: [qa1], hold: 900 },
    { msgs: [qa1, u], hold: 700 }, { msgs: [qa1, u, p], hold: 1300 },
    { msgs: [qa1, u, a], hold: 4200 },
  ]} />;
}

// ── UC3: アプリ横断データ転記 ──────────────────────────
function Xfer() {
  return (
    <div className="msg xfer">
      <div className="app"><div className="an"><span className="dot" style={{ background: '#0d9488' }}>問</span>問い合わせ管理</div><div className="ad">#1042 · 三井商事</div></div>
      <span className="arrow">{I.swap(18)}</span>
      <div className="app"><div className="an"><span className="dot" style={{ background: '#b45309' }}>案</span>案件管理</div><div className="ad">新規レコード</div></div>
    </div>
  );
}
function Mock3() {
  const u = <UserMsg key="u">この問い合わせ #1042 を案件アプリに転記して</UserMsg>;
  const th = <Thinking key="th" />;
  const t = <ToolCall key="t" tool="get_record" label="問い合わせ #1042 を取得" detail="会社名・担当者・要望をフィールドに対応付け" items={['会社名→顧客', '要望→案件概要']} />;
  const x = <Xfer key="x" />;
  const p = (
    <PlanCard key="p" title="案件レコードを1件作成" primaryLabel="作成する"
      steps={[
        { op: 'create', txt: '案件管理に「三井商事 受注案件」を新規作成' },
        { op: 'link', txt: '問い合わせ #1042 を関連レコードとして紐付け' },
      ]} />
  );
  return <UCPanel build={() => [
    { msgs: [u], hold: 1 }, { type: 'この問い合わせ #1042 を案件アプリに転記して', cps: 36 }, { clear: true },
    { msgs: [u], hold: 600 }, { msgs: [u, th], hold: 850 }, { msgs: [u, t], hold: 1000 },
    { msgs: [u, t, x], hold: 1100 }, { msgs: [u, t, x, p], hold: 4200 },
  ]} />;
}

// ── UC4: 破壊的操作の安全な承認フロー ──────────────────
function Mock4() {
  const u = <UserMsg key="u">ステータスが「完了」の問い合わせを一括でアーカイブして</UserMsg>;
  const th = <Thinking key="th" />;
  const t = <ToolCall key="t" tool="search_records" label="対象レコードを確認" detail="ステータス=完了 AND 30日以上経過 → 23件" />;
  const p = (
    <PlanCard key="p" danger title="一括アーカイブ（更新）"
      steps={[
        { op: 'update', txt: '23件のステータスを「アーカイブ」に変更' },
        { op: 'note', txt: '対象アプリ: 問い合わせ管理 · 取消可（30日以内）' },
      ]} />
  );
  return <UCPanel status="承認待ち" build={() => [
    { msgs: [u], hold: 1 }, { type: 'ステータスが「完了」の問い合わせを一括でアーカイブして', cps: 34 }, { clear: true },
    { msgs: [u], hold: 600 }, { msgs: [u, th], hold: 900 }, { msgs: [u, t], hold: 1000 },
    { msgs: [u, t, p], hold: 4600 },
  ]} />;
}

// ── Row layout ─────────────────────────────────────────
function UCRow({ n, kicker, title, desc, feats, mock, reverse }) {
  return (
    <div className={'uc reveal' + (reverse ? ' reverse' : '')}>
      <div className="uc-text">
        <span className="uc-kicker"><span className="n">{n}</span>{kicker}</span>
        <h3>{title}</h3>
        <p>{desc}</p>
        <div className="uc-feats">
          {feats.map((f, i) => (
            <div key={i} className="uc-feat"><span className="ck">{I.check(14)}</span><span><b>{f.b}</b>{f.t}</span></div>
          ))}
        </div>
      </div>
      <div className="uc-mock">{mock}</div>
    </div>
  );
}

function UseCases() {
  return (
    <section id="usecases">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow"><span className="dot"></span>CAPABILITIES · 機能</span>
          <h2>役割は違っても、<span className="accent">やることは同じ</span>。</h2>
          <p>検索・集計から成果物づくり、kintone への反映まで。どんな依頼も、この 4 つの流れで安全に進みます。</p>
        </div>
        <div className="uc-list">
          <UCRow n="1" kicker="検索・集計" title="自然言語で、レコードを検索して集計する"
            desc="「未対応の問い合わせをカテゴリ別に」——条件を組み立てる必要も、CSV を落とす必要もありません。話した内容をそのまま集計してカードで返します。"
            feats={[{ b: '複合条件', t: 'も日本語のまま指定' }, { b: 'その場で集計', t: '件数・金額・カテゴリ別に' }, { b: 'フォローアップ', t: 'グラフ化や比較もワンタップ' }]}
            mock={<Mock1 />} />
          <UCRow n="2" kicker="クイックアクション" title="よく使う操作は、ワンクリックのプリセットに" reverse
            desc="チャット下のプリセットボタンから、定型業務をワンクリック実行。週次レポートや集計など、毎回同じ依頼を打ち込む手間がなくなります。"
            feats={[{ b: 'プリセット', t: 'を管理者がチームに配布' }, { b: '成果物を自動生成', t: 'レポートは Artifact に' }, { b: 'ゼロ学習', t: 'ボタンを押すだけ' }]}
            mock={<Mock2 />} />
          <UCRow n="3" kicker="アプリ横断" title="アプリをまたいだ転記も、お願いひとつ"
            desc="問い合わせから案件へ。フィールドの対応付けは Cowork Agent が判断し、作成前に内容を提示します。コピペ作業から解放されます。"
            feats={[{ b: 'フィールド対応', t: 'を自動でマッピング' }, { b: '関連レコード', t: 'として自動で紐付け' }, { b: '作成前に確認', t: 'できるから安心' }]}
            mock={<Mock3 />} />
          <UCRow n="4" kicker="安全な承認" title="更新・削除は、必ず「確認してから」" reverse
            desc="影響のある操作は、対象アプリ・件数・取消可否を提示してから承認を求めます。勝手に動く AI にはなりません。現場で安心して任せられる設計です。"
            feats={[{ b: '影響範囲', t: 'を実行前にプレビュー' }, { b: '承認するまで', t: '実際の変更はゼロ' }, { b: '取消可', t: 'な操作は明示' }]}
            mock={<Mock4 />} />
        </div>
      </div>
    </section>
  );
}
window.UseCases = UseCases;
