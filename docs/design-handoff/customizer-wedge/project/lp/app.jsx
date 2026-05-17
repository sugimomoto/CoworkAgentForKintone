// Cowork Agent LP — main app
// Composes hero, problem, steps, features, demo, faq, CTA sections.

const { useState, useEffect } = React;

// ── Reusable section header
function SectionHead({ eyebrow, title, sub }) {
  return (
    <div className="section-head">
      {eyebrow ? <span className="eyebrow"><span className="dot"></span>{eyebrow}</span> : null}
      <h2>{title}</h2>
      {sub ? <p>{sub}</p> : null}
    </div>
  );
}

// ── Tiny inline icons (stroke 1.8)
const Icon = {
  search: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="4.5"/><path d="m13.5 13.5-3-3"/>
    </svg>
  ),
  shield: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5 2.5 4v4.5C2.5 12 5.2 14 8 14.5c2.8-.5 5.5-2.5 5.5-6V4L8 1.5z"/>
      <path d="m6 8 1.5 1.5L10.5 6.5"/>
    </svg>
  ),
  doc: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2h6l4 4v8H3z"/><path d="M9 2v4h4"/><path d="M5.5 9h5M5.5 11.5h3"/>
    </svg>
  ),
  bolt: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1 3 9h4l-1 6 6-8H8z"/>
    </svg>
  ),
  thread: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h10M3 8h7M3 12h10"/><circle cx="13" cy="8" r="1.2" fill="currentColor"/>
    </svg>
  ),
  plug: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 1v3M10 1v3M4.5 4h7v4a3.5 3.5 0 0 1-7 0z"/><path d="M8 11.5V15"/>
    </svg>
  ),
  arrow: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7h10M8 3l4 4-4 4"/>
    </svg>
  ),
};

// ── Nav
function Nav({ logoVariant, accent, ink }) {
  const Mark = window['LogoMark' + logoVariant];
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Wordmark Mark={Mark} size={28} accent={accent} ink={ink} />
        <div className="nav-links">
          <a href="#features">機能</a>
          <a href="#how">使い方</a>
          <a href="#demo">デモ</a>
          <a href="#faq">FAQ</a>
          <a href="#cta" className="btn btn-primary">無料で試す</a>
        </div>
      </div>
    </nav>
  );
}

// ── Hero
const HERO_TONES = {
  friendly: {
    eyebrow: 'kintone プラグイン · MVP リリース',
    headline: <>kintone のサイドに、<br/><span className="accent">話せる同僚</span>を。</>,
    sub: <>レコードの検索・集計・更新を、自然言語ひとつで。<br/>Cowork Agent for kintone は、現場の業務を一緒に進める AI コワーカーです。</>,
  },
  business: {
    eyebrow: 'FOR KINTONE TEAMS',
    headline: <>kintone の集計作業を、<br/><span className="accent">月20時間</span>削る。</>,
    sub: <>「先月の田中さんの受注合計は？」と聞くだけ。CSV ダウンロードも Excel 集計も、もう要りません。</>,
  },
  bold: {
    eyebrow: 'NEXT-GEN KINTONE WORKFLOW',
    headline: <>クリック、もう<br/><span className="accent">いらない</span>。</>,
    sub: <>kintone のレコード一覧で話しかけるだけ。検索、集計、レポート生成、更新まで、Aoi が一緒に進めます。</>,
  },
};

function Hero({ accent, heroTone }) {
  const t = HERO_TONES[heroTone] || HERO_TONES.friendly;
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <div>
            <span className="eyebrow"><span className="dot"></span>{t.eyebrow}</span>
            <h1 className="headline">{t.headline}</h1>
            <p className="hero-sub">{t.sub}</p>
            <div className="hero-cta">
              <a href="#cta" className="btn btn-primary btn-lg">
                無料トライアルを始める {Icon.arrow(14)}
              </a>
              <a href="#demo" className="btn btn-ghost btn-lg">デモを見る</a>
            </div>
            <div className="hero-meta">
              <div className="hero-meta-item">
                <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--ok)' }}></span>
                kintone 標準APIで動作
              </div>
              <div className="hero-meta-item">
                <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--ok)' }}></span>
                破壊的操作は必ず承認
              </div>
              <div className="hero-meta-item">
                <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--ok)' }}></span>
                データは外部送信しない設計
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-visual-frame">
              <img src="img/panel-solo.png" alt="Cowork Agent チャットパネル" />
            </div>
            <div className="hero-float" style={{ top: '8%', left: '-10%' }}>
              <span className="pulse"></span>
              <span>kintone 接続中 · Aoi</span>
            </div>
            <div className="hero-float" style={{ bottom: '12%', right: '-12%', maxWidth: 200 }}>
              <span style={{ color: 'var(--accent-deep)' }} className="mono">⌘K</span>
              <span>どこでも呼び出し</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Logo bar (used as)
function LogoBar() {
  return (
    <div className="logobar">
      <div className="container logobar-inner">
        <span className="logobar-label">VALIDATED FOR</span>
        <div className="logobar-items">
          <span>kintone</span>
          <span>Claude Managed Agents</span>
          <span>JavaScript Customize</span>
          <span>HTTPS / OAuth 2.0</span>
        </div>
      </div>
    </div>
  );
}

// ── Problem
function Problem() {
  const quotes = [
    { q: '「先月の田中さんの受注合計、いくらだっけ？」を聞かれるたびに、絞り込み条件を組み直す。', who: '営業マネージャー' },
    { q: 'CSV をダウンロードして Excel で集計、レポートに貼り付け。毎週同じ作業に半日。', who: '営業企画' },
    { q: 'kintone の検索は便利だけど、複雑な条件は結局カスタマイズ依頼。情シスが詰まる。', who: '情シス担当' },
  ];
  return (
    <section className="problem">
      <div className="container">
        <SectionHead
          eyebrow="現場のあるある"
          title="kintone は便利。でも、毎回の集計がしんどい。"
          sub="検索条件、CSV ダウンロード、Excel 集計、コピペ。同じ作業が積み重なる。"
        />
        <div className="problem-grid">
          {quotes.map((q, i) => (
            <div key={i} className="problem-card">
              <div className="quote-mark">"</div>
              <p>{q.q}</p>
              <div className="who">— {q.who}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Steps
function Steps() {
  return (
    <section id="how">
      <div className="container">
        <SectionHead
          eyebrow="HOW IT WORKS"
          title="3ステップで、業務がそのまま動き出す"
          sub="kintone のレコード一覧を開くだけ。サイドパネルにエージェントが常駐します。"
        />
        <div className="steps">
          <div className="step">
            <div className="step-num">01</div>
            <h3>聞く</h3>
            <p>「今月の田中さんの受注合計は？」のように、普通に話しかけるだけ。</p>
            <div className="step-mock">
              <div className="you">&gt; 今月の田中さんの受注合計は？</div>
            </div>
          </div>
          <div className="step">
            <div className="step-num">02</div>
            <h3>確認する</h3>
            <p>エージェントが kintone に問い合わせ、件数や金額を集計してカードで返答。</p>
            <div className="step-mock">
              <div className="agent">✓ 12件 · ¥48,200,000</div>
              <div className="agent">▮▮▮▮▮▮▮▮░░ 80%</div>
            </div>
          </div>
          <div className="step">
            <div className="step-num">03</div>
            <h3>承認して反映</h3>
            <p>更新が必要なら、影響範囲を確認してから「承認」ボタンで kintone に反映。</p>
            <div className="step-mock">
              <div style={{ color: 'var(--warn)' }}>⚠ 12件を更新します</div>
              <div className="agent">[ 承認して実行 ]</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Features
function Features() {
  return (
    <section id="features" style={{ background: 'var(--bg-alt)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div className="container">
        <SectionHead
          eyebrow="FEATURES"
          title="話せるだけじゃない、任せられる。"
          sub="検索から成果物の生成、kintone への反映までワンストップ。"
        />
        <div className="features">
          {/* large feature: HITL */}
          <div className="feature large">
            <div className="feature-text">
              <div className="feature-icon">{Icon.shield(20)}</div>
              <h3>HITL 承認 · 破壊的操作には必ず確認</h3>
              <p>
                更新・削除など影響のある操作は、対象アプリ・件数・取消可否を提示してから承認を求めます。<br/>
                "勝手に動く AI" にならない、現場で使える設計。
              </p>
              <div className="feature-tags">
                <span className="feature-tag">承認フロー</span>
                <span className="feature-tag">影響範囲プレビュー</span>
                <span className="feature-tag">取消可</span>
              </div>
            </div>
            <div className="feature-img">
              <img src="img/panel-hitl.png" alt="HITL 承認画面" />
            </div>
          </div>

          {/* large feature: Artifact */}
          <div className="feature large reverse">
            <div className="feature-img">
              <img src="img/artifact-md.png" alt="Artifact ペイン" />
            </div>
            <div className="feature-text">
              <div className="feature-icon">{Icon.doc(20)}</div>
              <h3>Artifact ペイン · 成果物をそのまま生成</h3>
              <p>
                月次レポート、ER 図、ダッシュボード HTML を会話の流れで作って右ペインで確認。
                内容に納得したら kintone のスペースやアプリにそのまま適用できます。
              </p>
              <div className="feature-tags">
                <span className="feature-tag">Markdown</span>
                <span className="feature-tag">HTML プレビュー</span>
                <span className="feature-tag">Mermaid</span>
                <span className="feature-tag">kintone 適用</span>
              </div>
            </div>
          </div>

          <div className="feature">
            <div className="feature-icon">{Icon.search(20)}</div>
            <h3>自然言語クエリ</h3>
            <p>「今月の」「田中さんの」「未対応の」など、人が話す言葉のままレコードを絞り込めます。</p>
            <div className="feature-tags">
              <span className="feature-tag">日本語ネイティブ</span>
              <span className="feature-tag">複合条件</span>
            </div>
          </div>

          <div className="feature">
            <div className="feature-icon">{Icon.bolt(20)}</div>
            <h3>非同期ジョブ進捗</h3>
            <p>大量レコードの集計や一括更新は進捗バーで状態を表示。途中キャンセルも可能。</p>
            <div className="feature-tags">
              <span className="feature-tag">並列処理</span>
              <span className="feature-tag">キャンセル対応</span>
            </div>
          </div>

          <div className="feature">
            <div className="feature-icon">{Icon.thread(20)}</div>
            <h3>セッション継続</h3>
            <p>ページをリロードしても会話は復元。担当者の引き継ぎもログから追えます。</p>
            <div className="feature-tags">
              <span className="feature-tag">ログ保存</span>
              <span className="feature-tag">監査対応</span>
            </div>
          </div>

          <div className="feature">
            <div className="feature-icon">{Icon.plug(20)}</div>
            <h3>かんたん導入</h3>
            <p>kintone プラグインとして配布。管理者がアップロードするだけで全ユーザーが使えます。</p>
            <div className="feature-tags">
              <span className="feature-tag">追加サーバー不要</span>
              <span className="feature-tag">5分でセットアップ</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Demo (tabbed screenshots)
function Demo() {
  const [tab, setTab] = useState('chat');
  const tabs = [
    { id: 'chat', label: 'チャット集計', img: 'img/panel-inhost.png', cap: 'kintone レコード一覧の隣で、自然言語でレコードを集計' },
    { id: 'artifact', label: 'Artifact 生成', img: 'img/artifact-host.png', cap: '会話の流れで月次レポートやダッシュボードを生成' },
    { id: 'mermaid', label: 'ER 図', img: 'img/artifact-mermaid.png', cap: 'アプリ間のリレーションを Mermaid 図で可視化' },
    { id: 'apply', label: 'kintone 適用', img: 'img/artifact-apply.png', cap: '生成した成果物を kintone にそのままアップロード' },
  ];
  const cur = tabs.find(t => t.id === tab);
  return (
    <section id="demo">
      <div className="container">
        <SectionHead
          eyebrow="LIVE DEMO"
          title="実際の画面で見てみる"
          sub="MVP プロトタイプから抜粋。どのシーンも実装可能な動作です。"
        />
        <div className="demo-tabs">
          {tabs.map(t => (
            <button key={t.id} className={'demo-tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="demo-stage">
          <img className="demo-img" src={cur.img} alt={cur.label} />
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13.5, marginTop: 16, marginBottom: 0 }}>
            {cur.cap}
          </p>
        </div>
      </div>
    </section>
  );
}

// ── FAQ
function FAQ() {
  const items = [
    { q: 'データはどこに送られますか？', a: 'Anthropic の Claude Managed Agents API へ送信されます。kintone のレコード本体は必要なフィールドのみ抽出され、エージェントが読み取った後はサーバー側に保持されません。詳細はセキュリティページをご覧ください。' },
    { q: 'kintone のどのプランで使えますか？', a: 'スタンダードコース以上で利用可能です。プラグイン機能をお使いいただける環境であればすぐに導入できます。' },
    { q: '間違った操作をしてしまわないか心配です', a: '更新・削除などの破壊的な操作は必ず承認カードを経由します。対象アプリ・件数・取消可否を確認した上で「承認して実行」を押すまで実際の変更は行われません。' },
    { q: 'カスタマイズアプリでも動きますか？', a: 'はい。kintone のレコード一覧画面に常駐するため、標準のアプリでもカスタマイズアプリでも追加実装なしで動作します。' },
    { q: '料金はいくらですか？', a: 'MVP 期間中は無料でお試しいただけます。正式版の料金体系は導入規模に応じて個別ご相談となります。' },
    { q: 'GitHub Pages でホスティングできますか？', a: 'はい、本サイトも GitHub Pages で配信されています。プラグイン本体は別途 kintone 環境にアップロードしてご利用ください。' },
  ];
  return (
    <section id="faq">
      <div className="container">
        <SectionHead
          eyebrow="FAQ"
          title="よくある質問"
        />
        <div className="faq-list">
          {items.map((it, i) => (
            <details key={i} className="faq" open={i === 0}>
              <summary>{it.q}</summary>
              <p>{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA
function CTA() {
  return (
    <section id="cta">
      <div className="container">
        <div className="cta-section">
          <h2>あなたの kintone に、Aoi を迎えてみませんか？</h2>
          <p>セットアップは 5 分。今ある業務はそのままに、面倒な集計だけが消えていきます。</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <a href="mailto:hello@example.com" className="btn btn-primary btn-lg" style={{ background: '#fff', color: 'var(--ink)' }}>
              無料トライアルを申し込む {Icon.arrow(14)}
            </a>
            <a href="#" className="btn btn-ghost btn-lg" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }}>
              資料をダウンロード
            </a>
          </div>
          <div style={{ marginTop: 24, fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>
            kintone は サイボウズ株式会社 の登録商標です。本製品は kintone と連携するサードパーティ製品です。
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer
function Footer({ logoVariant, accent, ink }) {
  const Mark = window['LogoMark' + logoVariant];
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Wordmark Mark={Mark} size={28} accent={accent} ink={ink} />
            <p style={{ marginTop: 14, maxWidth: 280 }}>
              kintone のサイドに常駐する、話せる AI コワーカー。
            </p>
          </div>
          <div>
            <h4>Product</h4>
            <ul>
              <li><a href="#features">機能</a></li>
              <li><a href="#how">使い方</a></li>
              <li><a href="#demo">デモ</a></li>
              <li><a href="#cta">料金</a></li>
            </ul>
          </div>
          <div>
            <h4>Resources</h4>
            <ul>
              <li><a href="#">ドキュメント</a></li>
              <li><a href="#">セキュリティ</a></li>
              <li><a href="#">変更履歴</a></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li><a href="#">お問い合わせ</a></li>
              <li><a href="#">プライバシー</a></li>
              <li><a href="#">利用規約</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Cowork Agent. All rights reserved.</span>
          <span>Built for kintone · Powered by Claude</span>
        </div>
      </div>
    </footer>
  );
}

// ── Logo Lab section (showcase + selector)
function LogoLab({ logoVariant, setLogoVariant, accent }) {
  const variants = [
    { id: 'A', name: 'A · Stacked Squares', desc: '2つの角丸スクエアが重なり、交差点に星 (= エージェント)。安定感とコラボのメタファ。' },
    { id: 'B', name: 'B · Venn Lens', desc: '人と AI が重なる円。重なりの濃い部分にエージェントが宿るコンセプト。' },
    { id: 'C', name: 'C · CA Monogram', desc: 'Cowork Agent の C をモノグラム化。きちんと感重視のエンタープライズ向け。' },
  ];
  return (
    <section id="logo-lab" className="tight">
      <div className="container">
        <SectionHead
          eyebrow="LOGO EXPLORATION"
          title="ロゴ案 · クリックで切替"
          sub="一案に絞り込む前に、3 方向のマークを並べました。気になるものをクリックするとサイト全体に反映されます。"
        />
        <div className="logo-lab">
          {variants.map(v => {
            const Mark = window['LogoMark' + v.id];
            return (
              <div key={v.id} className={'logo-card' + (logoVariant === v.id ? ' active' : '')} onClick={() => setLogoVariant(v.id)}>
                <div className="logo-mark"><Mark size={56} accent={accent} ink="#231200" /></div>
                <h4>{v.name}</h4>
                <p>{v.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Tweaks panel
function Tweaks({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="ブランド">
        <TweakColor label="アクセント色" value={tweaks.accent}
          onChange={(v) => setTweak('accent', v)}
          presets={['#0d9488', '#059669', '#d97706', '#ffbf00', '#231200', '#0ea5e9']} />
        <TweakRadio label="ロゴ案" value={tweaks.logoVariant}
          options={[{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }]}
          onChange={(v) => setTweak('logoVariant', v)} />
      </TweakSection>
      <TweakSection title="ヒーロー">
        <TweakRadio label="見出しトーン" value={tweaks.heroTone}
          options={[
            { value: 'friendly', label: '親しみ' },
            { value: 'business', label: '実務' },
            { value: 'bold', label: '主張強め' },
          ]}
          onChange={(v) => setTweak('heroTone', v)} />
      </TweakSection>
    </TweaksPanel>
  );
}

// ── Apply CSS variable for accent color globally
function ApplyAccent({ accent }) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', accent);
    // derive soft variant
    root.style.setProperty('--accent-soft', accent + '1a');
    // simple deep — nudge brightness down by reusing the same hue (kept static for simplicity)
    root.style.setProperty('--accent-deep', accent);
  }, [accent]);
  return null;
}

// ── App
function App() {
  const defaults = /*EDITMODE-BEGIN*/{
    "accent": "#0d9488",
    "logoVariant": "A",
    "heroTone": "friendly"
  }/*EDITMODE-END*/;
  const [tweaks, setTweak] = useTweaks(defaults);

  return (
    <>
      <ApplyAccent accent={tweaks.accent} />
      <Nav logoVariant={tweaks.logoVariant} accent={tweaks.accent} ink="#231200" />
      <Hero accent={tweaks.accent} heroTone={tweaks.heroTone} />
      <LogoBar />
      <Problem />
      <Steps />
      <Features />
      <Demo />
      <LogoLab logoVariant={tweaks.logoVariant} setLogoVariant={(v) => setTweak('logoVariant', v)} accent={tweaks.accent} />
      <FAQ />
      <CTA />
      <Footer logoVariant={tweaks.logoVariant} accent={tweaks.accent} ink="#231200" />
      <Tweaks tweaks={tweaks} setTweak={setTweak} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
