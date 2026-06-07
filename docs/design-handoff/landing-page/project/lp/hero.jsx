// hero.jsx — Hero: neutral window with chat + artifact dashboard (side-by-side).

function HeroPanel() {
  const greet = (
    <Greet key="g"
      hello="どんな作業をお手伝いしましょうか？"
      sub="検索・集計・レポート作成まで。"
      actions={['今月の受注状況を教えて']}
    />
  );
  const user = <UserMsg key="u">今月の受注を担当者別のダッシュボードにして</UserMsg>;
  const think = <Thinking key="t0" />;
  const tool1 = <ToolCall key="t1" tool="get_records" label="案件管理を集計" detail="受注日=今月 → 18件 · 担当者5名" items={['受注金額', '担当者']} />;
  const prog = <ProgressCard key="p" title="ダッシュボードを生成中…" pct={84} />;
  const art = <ArtifactCard key="a" kind="HTML" title="受注ダッシュボード" summary="KPI 3件 + 担当者別グラフ · 表示中 →" />;

  const { msgs, compose, typing, ref } = useChatScene(() => [
    { msgs: [greet], hold: 1100 },
    { type: '今月の受注を担当者別のダッシュボードにして', cps: 40 },
    { clear: true },
    { msgs: [greet, user], hold: 650 },
    { msgs: [greet, user, think], hold: 950 },
    { msgs: [greet, user, tool1], hold: 1000 },
    { msgs: [greet, user, tool1, prog], hold: 1200 },
    { msgs: [greet, user, tool1, art], hold: 4200 },
  ], []);

  return (
    <ChatPanel rootRef={ref} solo={false} bottom foot={compose || 'メッセージを入力…'} footTyping={typing}>
      {msgs}
    </ChatPanel>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <div>
            <span className="hero-eyebrow"><span className="tag">OSS</span>kintone プラグイン · MIT License</span>
            <h1 className="headline">kintone の隣に、<br/>いつでも仕事を<br/>お願いできる<br/><span className="accent">AI コワーカー</span>を。</h1>
            <p className="hero-sub">
              レコードの検索・集計はもちろん、更新・転記やレポート作成、カスタマイズ JS の生成まで。
              サイドパネルに常駐する Cowork Agent for kintone に、ふだんの言葉で頼むだけ。
            </p>
            <div className="hero-cta">
              <a href="https://github.com" target="_blank" rel="noopener" className="btn btn-ink btn-lg">{I.github(17)} GitHub で見る</a>
              <a href="#setup" className="btn btn-ghost btn-lg">{I.download(16)} インストール手順</a>
            </div>
            <div className="hero-meta">
              <div className="hero-meta-item"><span className="ck">{I.check(14)}</span>kintone 標準 API で動作</div>
              <div className="hero-meta-item"><span className="ck">{I.check(14)}</span>破壊的操作は必ず承認</div>
              <div className="hero-meta-item"><span className="ck">{I.check(14)}</span>API キー持ち込みで本体無償</div>
            </div>
          </div>

          <div className="hero-visual">
            <ArtifactWindow>
              <div className="sbs">
                <HeroPanel />
                <ArtifactDashboard />
              </div>
            </ArtifactWindow>
            <div className="hero-float" style={{ top: '-3%', left: '-4%' }}>
              <span className="pulse"></span><span>kintone 接続中 · Cowork Agent</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
window.Hero = Hero;
