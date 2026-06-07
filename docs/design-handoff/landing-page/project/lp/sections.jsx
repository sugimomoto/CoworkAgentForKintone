// sections.jsx — Nav, Concept, Wedge, Setup, Differentiation, FAQ, CTA, Footer
const { useState: uS, useEffect: uE, useRef: uR } = React;

// ── Nav ────────────────────────────────────────────────
function Nav({ logoVariant = 'A', accent = '#0d9488' }) {
  const Mark = window['LogoMark' + logoVariant] || window.LogoMarkA;
  return (
    <nav className="nav" id="nav">
      <div className="nav-inner">
        <a href="#top" style={{ textDecoration: 'none' }}><Wordmark Mark={Mark} size={28} accent={accent} ink="#231200" /></a>
        <div className="nav-links">
          <a href="#concept">特徴</a>
          <a href="#roles">使い方</a>
          <a href="#wedge">カスタマイズ</a>
          <a href="#setup">導入</a>
          <a href="#faq">FAQ</a>
          <a href="https://github.com" className="nav-gh" target="_blank" rel="noopener">{I.github(15)} GitHub <span className="star">★ 0</span></a>
        </div>
      </div>
    </nav>
  );
}

// ── Concept (3 cols) ───────────────────────────────────
function Concept() {
  const cards = [
    { n: '01', ic: I.panel(22), t: 'サイドパネルに常駐', d: 'kintone のレコード一覧を開くと、右側にいつでも相談できる AI コワーカーが待機。画面を離れずに、その場で質問・操作できます。' },
    { n: '02', ic: I.async(22), t: '非同期で動く', d: '時間のかかる集計や一括処理はバックグラウンドへ。Cowork Agent for kintone が作業している間も、あなたは別の仕事を進められます。' },
    { n: '03', ic: I.shield(22), t: 'HITL 承認フロー', d: '更新・削除などの破壊的な操作は、必ず人の承認を挟みます。対象と件数を確認してから実行する、安心の設計です。' },
  ];
  return (
    <section id="concept" className="concept">
      <div className="container">
        <div className="section-head oneline reveal">
          <span className="eyebrow"><span className="dot"></span>WHAT IS IT</span>
          <h2>kintone の「隣」で働く、3 つの仕組み</h2>
          <p>難しい設定はなし。常駐し、任せられて、暴走しない。業務で本当に使える形にしました。</p>
        </div>
        <div className="concept-grid">
          {cards.map((c, i) => (
            <div key={i} className="concept-card reveal" style={{ transitionDelay: (i * 70) + 'ms' }}>
              <span className="num mono">{c.n}</span>
              <div className="concept-ic">{c.ic}</div>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Wedge (customizer: generate→preview→apply→rollback) ─
const WEDGE_STEPS = [
  { wn: '01', t: '会話でカスタマイズ JS を生成', d: '「受注ステータスを色分けして」と頼むだけ。Artifact ペインにコードが現れます。', badge: 'source', badgeLabel: 'ソース', tab: 1 },
  { wn: '02', t: 'preview で挙動を確認', d: 'kintone に反映する前に、サンドボックスで動作をプレビュー。安全に確かめられます。', badge: 'preview', badgeLabel: 'プレビュー', tab: 0 },
  { wn: '03', t: 'apply で kintone に反映', d: '納得したらワンクリックで適用。カスタマイズ設定として kintone にアップロードします。', badge: 'apply', badgeLabel: '適用済み', tab: 0 },
  { wn: '04', t: '問題があれば rollback', d: 'おかしければ 1 つ前のバージョンへ即座に巻き戻し。試行錯誤が怖くなくなります。', badge: 'rollback', badgeLabel: 'ロールバック', tab: 1 },
];
function WedgeCode({ removed }) {
  return (
    <div className="wv-code">
      <span className="c">{'// 受注ステータスを行の背景色で可視化'}</span>{'\n'}
      <span className="f">kintone</span>.events.<span className="f">on</span>(<span className="s">'app.record.index.show'</span>, (e) =&gt; {'{'}{'\n'}
      {'  '}<span className="k">const</span> rows = <span className="f">document</span>.<span className="f">querySelectorAll</span>(<span className="s">'.recordlist-row-gaia'</span>);{'\n'}
      {'  '}rows.<span className="f">forEach</span>((row) =&gt; {'{'}{'\n'}
      <span className={removed ? 'removed' : 'added'}>{'    row.style.background = COLOR[row.dataset.status];\n'}</span>
      {'  '}{'}'});{'\n'}
      {'  '}<span className="k">return</span> e;{'\n'}
      {'}'});
    </div>
  );
}
function WedgePreview({ applied }) {
  const rows = [['三井商事 受注案件', 'win'], ['パナソニック 保守更新', 'prop'], ['ソフトバンク SaaS導入', 'new'], ['日立 コンサル契約', 'win']];
  const bg = { win: '#dcfce7', prop: '#fef3c7', new: '#e0f2fe' };
  return (
    <div className="wv-preview-box">
      <div className="pv-title">案件管理 · レコード一覧 {applied ? '✓' : ''}</div>
      <div className="pv-sub">受注ステータスを背景色で可視化</div>
      <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 11px', fontSize: 11.5, background: bg[r[1]], borderBottom: i < 3 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
            <span>{r[0]}</span><span className="mono" style={{ color: 'var(--muted)' }}>{r[1] === 'win' ? '受注' : r[1] === 'prop' ? '提案中' : '新規'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function WedgeStage({ step, setStep }) {
  const s = WEDGE_STEPS[step];
  const showPreview = s.tab === 0;
  return (
    <div className="wedge-stage">
      <div className="wv-head">
        <span className="wv-kind mono">JS</span>
        <div><div className="wv-title">受注ステータス色分け.js</div><div className="wv-sub">kintone-customize-js · 更新 14:32</div></div>
        <span className="wv-spacer"></span>
        <span className={'wv-badge ' + s.badge}>{s.badge === 'source' ? '✎ 生成' : s.badge === 'preview' ? '● プレビュー中' : s.badge === 'apply' ? '✓ 適用済み' : '↺ 巻き戻し'}</span>
      </div>
      <div className="wv-body">
        {showPreview ? <WedgePreview applied={s.badge === 'apply'} /> : <WedgeCode removed={s.badge === 'rollback'} />}
      </div>
      <div className="wv-foot">
        <span className="wv-note">{s.d}</span>
        {step === 1 && <span className="wv-btn go" onClick={() => setStep(2)}>apply</span>}
        {step === 2 && <span className="wv-btn warn" onClick={() => setStep(3)}>rollback</span>}
        {step === 0 && <span className="wv-btn go" onClick={() => setStep(1)}>preview</span>}
        {step === 3 && <span className="wv-btn ghost" onClick={() => setStep(0)}>再生成</span>}
      </div>
    </div>
  );
}
function Wedge() {
  const [step, setStep] = uS(0);
  const ref = uR(null); const live = uR(false);
  uE(() => {
    const io = new IntersectionObserver((es) => { live.current = es[0].isIntersecting; }, { threshold: 0.3 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  uE(() => {
    const id = setInterval(() => { if (live.current) setStep((s) => (s + 1) % 4); }, 3200);
    return () => clearInterval(id);
  }, []);
  return (
    <section id="wedge" className="wedge" ref={ref}>
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow"><span className="dot"></span>FOR CUSTOMIZERS</span>
          <h2>カスタマイズ JS を、<span className="accent">会話で</span>つくる</h2>
          <p>情シス・カスタマイザー向け。生成 → プレビュー → 適用 → ロールバックを、チャットの流れのまま。</p>
        </div>
        <div className="wedge-layout">
          <div className="wedge-steps">
            {WEDGE_STEPS.map((w, i) => (
              <div key={i} className={'wstep' + (i === step ? ' on' : '')} onClick={() => setStep(i)}>
                <span className="wn mono">{w.wn}</span>
                <div><div className="wt">{w.t}</div><div className="wd">{w.d}</div></div>
              </div>
            ))}
          </div>
          <WedgeStage step={step} setStep={setStep} />
        </div>
        <div className="wedge-prompts reveal">
          <div className="wl">情シス・カスタマイザー — こんな依頼から生成できます</div>
          <div className="wp-grid">
            {[
              '案件アプリで受注金額が100万円超のレコードに、行ハイライトを付けるカスタマイズ JS を書いて',
              '在庫数が閾値を下回ったら、画面上部にアラートバナーを表示する JS を作って',
              '申請フォームで日付が休日のとき、保存をブロックする JS を作って',
            ].map((p, i) => (
              <div key={i} className="wp"><span className="qi">{I.bolt(14)}</span><span className="qt">{p}</span></div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Setup (5-step, scroll-driven) ──────────────────────
const SETUP_STEPS = [
  { name: 'STEP 1 · プラグイン', h: 'Plugin をインストール', d: 'GitHub Releases から .zip をダウンロードし、kintone のプラグイン管理画面にアップロードするだけ。', screen: 'plugin' },
  { name: 'STEP 2 · Worker', h: 'Cloudflare Worker をデプロイ', d: 'MCP サーバーとなる Worker を、Plugin 設定画面のボタンからブラウザだけでデプロイ。CLI は不要です。', screen: 'worker' },
  { name: 'STEP 3 · API Key', h: 'Anthropic API Key を登録', d: 'お手持ちの Anthropic API キーを設定画面に貼り付け。キーは Vault に暗号化保存されます。', screen: 'key' },
  { name: 'STEP 4 · OAuth', h: 'kintone OAuth クライアントを登録', d: 'kintone 側で OAuth クライアントを作成し、Client ID / Secret を登録。これで接続準備が完了します。', screen: 'oauth' },
  { name: 'STEP 5 · 完了', h: '業務ユーザーが使い始める', d: 'セットアップ完了。あとはレコード一覧を開けば、チームの誰もがサイドパネルから Cowork Agent for kintone に話しかけられます。', screen: 'done' },
];
function SetupScreen({ i }) {
  const url = ['kintone.com/admin/plugins', 'config / worker-deploy', 'config / anthropic', 'kintone.com/admin/oauth', 'app/records · index'][i];
  return (
    <div className="setup-screen">
      <div className="ss-head"><div className="ss-dots"><i></i><i></i><i></i></div><span className="ss-url mono">{url}</span></div>
      <div className="ss-body">
        <div className="ss-stepname">{SETUP_STEPS[i].name}</div>
        {i === 0 && <>
          <div className="ss-h">プラグインを追加</div>
          <div className="ss-field"><div className="l">アップロードするファイル</div><div className="v">cowork-agent-1.0.0.zip</div></div>
          <div className="ss-field"><div className="l">状態</div><div className="v" style={{ color: 'var(--accent-deep)' }}>✓ 検証済み · 署名 OK</div></div>
          <span className="btn btn-primary btn-block ss-cta">プラグインを追加</span>
        </>}
        {i === 1 && <>
          <div className="ss-h">Worker をデプロイ</div>
          <div className="ss-field"><div className="l">デプロイ先</div><div className="v">cowork-mcp.your-team.workers.dev</div></div>
          <div className="ss-field key"><div className="l">ステータス</div><div className="v">● デプロイ中… 90%</div></div>
          <span className="btn btn-primary btn-block ss-cta">{I.bolt(15)} ブラウザからデプロイ</span>
        </>}
        {i === 2 && <>
          <div className="ss-h">API キーを登録</div>
          <div className="ss-field key"><div className="l">Anthropic API Key</div><div className="v">sk-ant-•••••••••••••••• 4f2a</div></div>
          <div className="ss-field"><div className="l">保存先</div><div className="v">🔒 Vault（暗号化）</div></div>
          <span className="btn btn-primary btn-block ss-cta">{I.lock(14)} キーを安全に保存</span>
        </>}
        {i === 3 && <>
          <div className="ss-h">OAuth クライアント</div>
          <div className="ss-field"><div className="l">Client ID</div><div className="v">kintone-cowork-agent</div></div>
          <div className="ss-field key"><div className="l">Client Secret</div><div className="v">cs_•••••••••••• 8b10</div></div>
          <span className="btn btn-primary btn-block ss-cta">接続をテスト</span>
        </>}
        {i === 4 && <div className="ss-ok"><span className="big">{I.check(18)}</span><div><div style={{ fontWeight: 700, fontSize: 14 }}>セットアップ完了！</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>レコード一覧を開いて Cowork Agent に話しかけましょう。</div></div></div>}
      </div>
    </div>
  );
}
function Setup() {
  const [active, setActive] = uS(0);
  const railRef = uR(null);
  uE(() => {
    const items = railRef.current ? Array.from(railRef.current.querySelectorAll('.setup-item')) : [];
    const onScroll = () => {
      const mid = window.innerHeight * 0.42;
      let best = 0, bestD = Infinity;
      items.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs((r.top + r.height / 2) - mid);
        if (d < bestD) { bestD = d; best = i; }
      });
      setActive(best);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <section id="setup">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow"><span className="dot"></span>SETUP · FOR ADMINS</span>
          <h2>管理者の導入は、<span className="accent">5 ステップ</span></h2>
          <p>追加サーバーの構築も、CLI 操作も不要。すべてブラウザの設定画面だけで完結します。</p>
        </div>
        <div className="setup-layout">
          <div className="setup-rail" ref={railRef}>
            <div className="setup-line"><div className="setup-line-fill" style={{ height: ((active + 1) / SETUP_STEPS.length * 100) + '%' }}></div></div>
            {SETUP_STEPS.map((s, i) => (
              <div key={i} className={'setup-item' + (i === active ? ' on' : i < active ? ' done' : '')}>
                <span className="setup-dot">{i < active ? I.check(16) : i + 1}</span>
                <div className="setup-body">
                  <h3>{s.h}</h3>
                  <p>{s.d}</p>
                  {i === 1 && <div className="badge-row"><span className="chip">CLI 不要</span><span className="chip">ブラウザ完結</span></div>}
                  {i === 2 && <div className="badge-row"><span className="chip">{I.lock(11)} Vault 暗号化</span><span className="chip">キー持ち込み</span></div>}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 18, paddingLeft: 58 }}>
              <a href="help/admin/index.html" className="btn btn-ghost">詳しい管理者ガイドを見る {I.arrow(14)}</a>
            </div>
          </div>
          <div className="setup-visual"><SetupScreen i={active} /></div>
        </div>
      </div>
    </section>
  );
}

// ── Differentiation ────────────────────────────────────
function Differentiation() {
  const cards = [
    { ic: I.async(18), t: 'Claude Managed Agents による非同期実行', d: '長時間タスクをエージェントに任せ、裏側で動かす。完了を待たずに次の仕事へ進めます。' },
    { ic: I.github(18), t: '完全な OSS（MIT License）', d: 'ソースはすべて公開。中身を確認でき、自社の要件に合わせて自由に改変・配布できます。' },
    { ic: I.lock(18), t: 'Vault による secret 管理', d: 'API キーや OAuth Secret は暗号化して保管。Worker はステートレスで認証情報を保持しません。' },
    { ic: I.scale(18), t: 'Anthropic 利用規約に準拠', d: 'データの取り扱いは Anthropic の規約に従い設計。必要なフィールドだけを送信します。' },
  ];
  return (
    <section id="why">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow"><span className="dot"></span>WHY COWORK AGENT</span>
          <h2>なぜ、Cowork Agent なのか</h2>
          <p>「話せる AI」はいくつもあります。業務で本当に任せられるかは、その下の設計で決まります。</p>
        </div>
        <div className="diff-grid">
          {cards.map((c, i) => (
            <div key={i} className="diff-card reveal" style={{ transitionDelay: (i % 2 * 60) + 'ms' }}>
              <span className="diff-ic">{c.ic}</span>
              <div><h3>{c.t}</h3><p>{c.d}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FAQ ────────────────────────────────────────────────
function FAQ() {
  const items = [
    { q: '料金はかかりますか？', a: <>プラグイン本体は OSS（MIT License）で<b>無償</b>です。AI の実行には Anthropic の API キーをお客様自身で用意（持ち込み）いただきます。費用は実際の利用量に応じた Anthropic の API 料金のみです。</> },
    { q: '対応している kintone のプランは？', a: <>プラグインを利用できる<b>スタンダードコース</b>に対応しています。プラグイン機能のないライトコースには現時点で未対応です。</> },
    { q: 'データのセキュリティは大丈夫ですか？', a: <>仲介する Cloudflare Worker は<b>ステートレス</b>で、レコードを保持しません。API キー等の認証情報は <code>Vault</code> に暗号化保存されます。エージェントには必要なフィールドのみを送信します。</> },
    { q: '間違った操作をしてしまわない？', a: <>更新・削除などの破壊的な操作は<b>必ず承認カード</b>を挟みます。対象アプリ・件数・取消可否を確認し、「承認して実行」を押すまで、実際の変更は一切行われません。</> },
    { q: 'プログラミングの知識は必要？', a: <>業務ユーザーには<b>一切不要</b>です。ふだんの言葉で話しかけるだけで使えます。カスタマイズ JS 生成などの高度な機能は、情シス・カスタマイザー向けのオプションです。</> },
    { q: 'ライセンスは？ 商用利用できる？', a: <><code>MIT License</code> です。商用・非商用を問わず、改変・再配布を含めて自由にご利用いただけます。</> },
    { q: '導入にどれくらい時間がかかる？', a: <>管理者のセットアップは <b>5 ステップ</b>。追加サーバーの構築や CLI 操作は不要で、すべてブラウザの設定画面から完結します。</> },
  ];
  return (
    <section id="faq" className="tight">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow"><span className="dot"></span>FAQ</span>
          <h2>よくある質問</h2>
        </div>
        <div className="faq-list reveal">
          {items.map((it, i) => (
            <details key={i} className="faq" open={i === 0}>
              <summary>{it.q}</summary>
              <div className="a">{it.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA band ───────────────────────────────────────────
function CTA() {
  return (
    <section className="cta-band">
      <div className="container">
        <div className="cta-card reveal">
          <h2>あなたの kintone に、Cowork Agent を迎える</h2>
          <p>セットアップは 5 分。GitHub で公開中。スターとフィードバックで開発を応援してください。</p>
          <div className="cta-actions">
            <a href="https://github.com" target="_blank" rel="noopener" className="btn btn-primary btn-lg">{I.github(17)} GitHub で見る</a>
            <a href="help/admin/index.html" className="btn btn-ghost btn-lg">{I.download(16)} インストール手順</a>
          </div>
          <div className="codeblock mono">
            <span className="cmt"># GitHub Releases から最新の .zip を取得</span>{'\n'}
            <span className="gp">$</span> gh release download --repo your-org/cowork-agent-kintone{'\n'}
            <span className="cmt"># kintone のプラグイン管理画面にアップロード → 完了</span>
          </div>
          <div className="legal">kintone は サイボウズ株式会社 の登録商標です。本製品は kintone と連携するサードパーティ製の OSS です。</div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────
function Footer({ logoVariant = 'A', accent = '#0d9488' }) {
  const Mark = window['LogoMark' + logoVariant] || window.LogoMarkA;
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Wordmark Mark={Mark} size={28} accent={accent} ink="#231200" />
            <p className="lead">kintone のサイドに常駐し、仕事を任せられる AI コワーカー。OSS / MIT License。</p>
            <a href="https://github.com" target="_blank" rel="noopener" className="nav-gh ghbtn">{I.github(15)} スターをつける ★</a>
          </div>
          <div>
            <h4>Product</h4>
            <ul>
              <li><a href="#concept">特徴</a></li>
              <li><a href="#usecases">使い方</a></li>
              <li><a href="#wedge">カスタマイズ</a></li>
              <li><a href="#setup">導入</a></li>
            </ul>
          </div>
          <div>
            <h4>Help</h4>
            <ul>
              <li><a href="help/user/index.html">業務ユーザーヘルプ</a></li>
              <li><a href="help/admin/index.html">管理者ヘルプ</a></li>
              <li><a href="help/admin/index.html#install">インストール手順</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </div>
          <div>
            <h4>Open Source</h4>
            <ul>
              <li><a href="https://github.com" target="_blank" rel="noopener">GitHub リポジトリ</a></li>
              <li><a href="https://github.com" target="_blank" rel="noopener">Issues / バグ報告</a></li>
              <li><a href="https://github.com" target="_blank" rel="noopener">Releases</a></li>
              <li><a href="https://github.com" target="_blank" rel="noopener">Contributing</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span className="mit">MIT License · © 2026 Cowork Agent contributors</span>
          <span>Built for kintone · Powered by Claude Managed Agents</span>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Nav, Concept, Wedge, Setup, Differentiation, FAQ, CTA, Footer });
