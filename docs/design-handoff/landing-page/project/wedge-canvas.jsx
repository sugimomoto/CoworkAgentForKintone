// Customizer wedge — Design Canvas sections
// 仕様追加分の全 artboard を一箇所に集約。

// ────────────────────────────────────────────────────────
// パネル frame 共通: 380×720 で投影
// ────────────────────────────────────────────────────────
function StandalonePanel({ children, width = 380, height }) {
  // height を指定しない場合はアートボードに合わせて伸縮 (上下に 24px 余白)
  return (
    <div style={{
      width: '100%', height: '100%', background: '#f0eee9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 0', boxSizing: 'border-box',
    }}>
      <div style={{
        width,
        height: height || '100%',
        maxHeight: '100%',
        overflow: 'hidden', borderRadius: 12,
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column',
        background: '#faf8f3',
      }}>
        {children}
      </div>
    </div>
  );
}

// Chat 部分のダミー (Header のすぐ下を埋めるための簡易プレースホルダー)
function ChatBodyStub({ c, accent }) {
  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative', padding: 18 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: c.text, marginBottom: 4 }}>
        こんにちは。何をお手伝いしましょうか？
      </div>
      <div style={{ fontSize: 12, color: c.muted, marginBottom: 14 }}>
        JS カスタマイズの作成、Plugin 開発、レビューまで対応します。
      </div>
      {['案件管理アプリに完了行ハイライトを追加',
        'ステータス変更時に Slack 通知する Plugin',
        '現状のカスタマイズ JS をレビュー'].map((s, i) => (
        <button key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', textAlign: 'left', marginBottom: 6,
          padding: '9px 12px', background: c.card, border: `1px solid ${c.cardBorder}`,
          borderRadius: 10, color: c.text, fontSize: 12.5, cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: 6, background: c.accentSoft,
            color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 20px',
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 5h6M5 2l3 3-3 3"/></svg>
          </span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5 }}>{s}</span>
        </button>
      ))}
    </div>
  );
}

// 共通: panel + header + chat stub
function PanelWithHeader({ HeaderComp, c, accent, props = {} }) {
  return (
    <StandalonePanel>
      <HeaderComp c={c} accent={accent} {...props} />
      <ChatBodyStub c={c} accent={accent} />
    </StandalonePanel>
  );
}

// ────────────────────────────────────────────────────────
// Settings View プレビュー (Side-by-Side)
// ────────────────────────────────────────────────────────
function HostWithSettings({ accent, dark, headerVariant = 'C', section = 'agents', detail = null }) {
  const c = richColors(dark, accent);
  const HeaderComp = headerVariant === 'A' ? HeaderVariantA : headerVariant === 'B' ? HeaderVariantB : HeaderVariantC;
  return (
    <MockKintoneHost compact>
      <div className="host-sidepanel" style={{ width: 880, flex: '0 0 880px', display: 'flex', flexDirection: 'row' }}>
        <div style={{
          width: 380, flex: '0 0 380px', display: 'flex', flexDirection: 'column',
          background: c.bg, borderRight: `1px solid ${c.border}`,
        }}>
          <HeaderComp c={c} accent={accent} isAdmin currentId="cust-opus" />
          <ChatBodyStub c={c} accent={accent} />
        </div>
        <SettingsView c={c} accent={accent} section={section} detail={detail} />
      </div>
    </MockKintoneHost>
  );
}

// ────────────────────────────────────────────────────────
// 「採用 / 不採用」注釈 — Header section の参考カード用
// ────────────────────────────────────────────────────────
function RejectedNote({ label, cons, pros, final }) {
  return (
    <div style={{
      background: final ? '#fff' : 'rgba(255,255,255,0.5)',
      border: final ? '1px solid rgba(13,148,136,0.4)' : '1px dashed rgba(35,18,0,0.20)',
      borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#231200',
      alignSelf: 'stretch',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
          color: final ? '#0d9488' : '#b45309',
          background: final ? '#0d948822' : '#fef3c7',
          padding: '1px 6px', borderRadius: 3,
        }}>{final ? '採用' : '不採用'}</span>
        <span style={{ fontWeight: 600 }}>{label}</span>
      </div>
      {cons && <div style={{ marginTop: 4, color: '#6b5f4a' }}>− {cons}</div>}
      {pros && <div style={{ marginTop: 4, color: '#047857' }}>+ {pros}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Admin vs User 対比カード — 同条件・同サイズで横に並べて差分強調
// ────────────────────────────────────────────────────────
function AdminVsUserCompare({ c, accent }) {
  const bizOnlyAgents = BUILTIN_AGENTS.map(a => a.id === 'biz' ? a : { ...a, published: false });
  return (
    <div style={{
      width: '100%', height: '100%', background: '#f0eee9',
      display: 'flex', gap: 18, padding: 24, boxSizing: 'border-box',
      alignItems: 'stretch', justifyContent: 'center',
    }}>
      <ComparePane label="Admin (cybozu 共通管理者)" tone="admin" details={[
        { k: '⚙ 設定アイコン', v: '表示', good: true },
        { k: 'Agent プルダウン', v: '3 件すべて', good: true },
        { k: '組織デフォルト指定', v: '可能', good: true },
        { k: '公開トグル変更', v: '可能', good: true },
      ]} c={c}>
        <HeaderVariantC c={c} accent={accent} currentId="cust-opus" isAdmin={true} />
        <ChatBodyStub c={c} accent={accent} />
      </ComparePane>

      {/* arrow / diff strip */}
      <div style={{
        flex: '0 0 28px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          color: '#6b5f4a', writingMode: 'vertical-rl', letterSpacing: 1,
        }}>差分</div>
      </div>

      <ComparePane label="業務ユーザー (非 admin)" tone="user" details={[
        { k: '⚙ 設定アイコン', v: '非表示', diff: true },
        { k: 'Agent プルダウン', v: '1 件のみ (公開済)', diff: true },
        { k: '組織デフォルト指定', v: '不可', diff: true },
        { k: 'Memory トグル', v: '操作可 (個人スコープ)', good: true },
      ]} c={c}>
        <HeaderVariantC c={c} accent={accent} currentId="biz" isAdmin={false} agents={bizOnlyAgents} />
        <ChatBodyStub c={c} accent={accent} />
      </ComparePane>
    </div>
  );
}

function ComparePane({ children, label, tone, details, c }) {
  const toneColor = tone === 'admin' ? '#0d9488' : '#b45309';
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
        color: toneColor, textTransform: 'uppercase',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: toneColor }} />
        {label}
      </div>
      <div style={{
        width: 380, height: 380, alignSelf: 'center',
        overflow: 'hidden', borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
        border: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column',
        background: '#faf8f3',
      }}>
        {children}
      </div>
      <div style={{
        background: '#fff', borderRadius: 10, border: '1px solid rgba(35,18,0,0.08)',
        padding: '10px 12px', fontSize: 11, color: '#231200',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {details.map((d, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 0',
            borderBottom: i < details.length - 1 ? '1px dashed rgba(35,18,0,0.10)' : 'none',
          }}>
            <span style={{ flex: '0 0 130px', color: '#6b5f4a' }}>{d.k}</span>
            <span style={{
              flex: 1, fontWeight: 500,
              color: d.diff ? '#b45309' : d.good ? '#047857' : '#231200',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {d.diff && <span style={{ fontSize: 9, padding: '0 4px', background: '#fef3c7', borderRadius: 3, fontWeight: 700, letterSpacing: 0.4 }}>DIFF</span>}
              {d.v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Workflow ステート別 — Customizer artifact
// ────────────────────────────────────────────────────────
function WorkflowArtboard({ state, accent, dark }) {
  const c = richColors(dark, accent);
  return (
    <StandalonePanel width={760} height={780}>
      <CustomizerArtifactCard c={c} accent={accent} state={state} />
    </StandalonePanel>
  );
}

// ────────────────────────────────────────────────────────
// Customizer Agent — JS生成→workflow までのフル会話 (Side-by-Side)
// ────────────────────────────────────────────────────────
function CustomizerFullFlow({ accent, dark, density }) {
  const c = richColors(dark, accent);
  return (
    <MockKintoneHost compact>
      <div className="host-sidepanel" style={{ width: 1080, flex: '0 0 1080px', display: 'flex', flexDirection: 'row' }}>
        <div style={{
          width: 380, flex: '0 0 380px', display: 'flex', flexDirection: 'column',
          background: c.bg,
        }}>
          <HeaderVariantC c={c} accent={accent} isAdmin currentId="cust-opus" />
          <CustomizerChatStub c={c} accent={accent} density={density} />
        </div>
        <div style={{ flex: 1, borderLeft: `1px solid ${c.border}`, background: c.bg, display: 'flex' }}>
          <CustomizerArtifactCard c={c} accent={accent} state="previewed" />
        </div>
      </div>
    </MockKintoneHost>
  );
}

function CustomizerChatStub({ c, accent, density }) {
  const pad = density === 'compact' ? 10 : density === 'airy' ? 18 : 14;
  return (
    <div style={{
      flex: 1, overflowY: 'auto', padding: `${pad + 4}px 16px`,
      display: 'flex', flexDirection: 'column', gap: pad,
    }}>
      <div style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
        <div style={{
          background: c.user, color: c.text, padding: '10px 14px',
          border: `1px solid ${c.userBorder}`,
          borderRadius: '16px 16px 4px 16px', fontSize: 13, lineHeight: 1.5,
        }}>案件管理アプリで「ステータス = 受注」の行を緑にハイライトする JS を書いて</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: accent }} />
        <div style={{ fontSize: 13, color: c.text, lineHeight: 1.5 }}>
          まずアプリのスキーマを確認します。
        </div>
      </div>
      {/* tool call card */}
      <div style={{
        background: c.cardHi, border: `1px solid ${c.cardBorder}`, borderRadius: 10,
        padding: '8px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 9,
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: 6, background: c.okSoft, color: c.ok,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 20px',
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6.5l2.5 2.5L10 3.5"/></svg>
        </span>
        <div style={{ flex: 1, lineHeight: 1.3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: accent, fontWeight: 600 }}>kintone-get-form-fields</code>
            <span style={{ color: c.text, fontSize: 12, fontWeight: 500 }}>案件管理 のフィールド</span>
          </div>
          <div style={{ fontSize: 11, color: c.muted }}>24 フィールド · ステータス を確認</div>
        </div>
      </div>
      {/* skill load */}
      <div style={{
        background: c.cardHi, border: `1px solid ${c.cardBorder}`, borderRadius: 10,
        padding: '8px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 9,
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: 6, background: c.accentSoft, color: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 20px',
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 6a4 4 0 008 0 4 4 0 00-8 0"/></svg>
        </span>
        <div style={{ flex: 1, lineHeight: 1.3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: accent, fontWeight: 600 }}>kintone-customize-js</code>
            <span style={{ color: c.text, fontSize: 12, fontWeight: 500 }}>スキルをロード</span>
          </div>
          <div style={{ fontSize: 11, color: c.muted }}>app.record.index.show ハンドラのパターンを参照</div>
        </div>
      </div>
      {/* artifact card */}
      <div style={{
        background: c.card, border: `1px solid ${accent}66`, borderRadius: 12, padding: 12,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: '#f7df1e22', color: '#946c00',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 800,
          flex: '0 0 36px',
        }}>JS</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, color: c.subtle, textTransform: 'uppercase', marginBottom: 2 }}>
            📄 ARTIFACT · kintone JS
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>完了行ハイライト</div>
          <div style={{ fontSize: 11, color: c.muted }}>3 状態のスタイルを切替、index.show のみ実行</div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 999,
          background: c.accentSoft, color: accent,
        }}>表示中</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: accent }} />
        <div style={{ fontSize: 13, color: c.text, lineHeight: 1.5 }}>
          完成しました。右側でプレビューを実行してから本番に反映してください。
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Compare card — design intent を vocalize
// ────────────────────────────────────────────────────────
function CompareNotes({ title, items, accent }) {
  return (
    <div style={{
      background: '#faf8f3', padding: '24px 26px', overflow: 'auto',
      color: '#231200', fontSize: 12, lineHeight: 1.7,
      height: '100%', boxSizing: 'border-box',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, letterSpacing: -0.3 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#6b5f4a', marginBottom: 18 }}>3 案のトレードオフ</div>
      {items.map((it, i) => (
        <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px dashed rgba(35,18,0,0.12)' }}>
          <div style={{
            display: 'inline-block', fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10, fontWeight: 700, color: accent,
            background: accent + '1a', padding: '1px 6px', borderRadius: 3,
            marginBottom: 6,
          }}>{it.tag}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#231200', marginBottom: 4 }}>{it.title}</div>
          <div style={{ fontSize: 11.5, color: '#444', marginBottom: 5 }}>{it.summary}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, color: '#047857', textTransform: 'uppercase', marginBottom: 2 }}>+ pros</div>
              <div style={{ fontSize: 11, color: '#444', lineHeight: 1.5 }}>{it.pros}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, color: '#b45309', textTransform: 'uppercase', marginBottom: 2 }}>− cons</div>
              <div style={{ fontSize: 11, color: '#444', lineHeight: 1.5 }}>{it.cons}</div>
            </div>
          </div>
        </div>
      ))}
      <div style={{
        background: '#fff', border: '1px solid rgba(35,18,0,0.10)', borderRadius: 8,
        padding: '10px 12px', marginTop: 4,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: '#6b5f4a', textTransform: 'uppercase', marginBottom: 4 }}>推奨</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#231200', marginBottom: 3 }}>案 B — 名前 + ▾</div>
        <div style={{ fontSize: 11, color: '#444', lineHeight: 1.5 }}>
          既存 Header の語彙を最小変更で活かせる。Avatar / ステータスドット / モデルバッジが両立し、Header に余白が残るので Memory トグルと ⚙ も並べやすい。
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 全 wedge セクションを 1 つのコンポーネントにまとめる
// ────────────────────────────────────────────────────────
function WedgeSections({ accent, dark, density }) {
  const c = richColors(dark, accent);

  return (
    <>
      {/* ─── Section 1: 採用案 C — 独立 Agent Pill ─── */}
      <DCSection
        id="wedge-header"
        title="Header · 採用案 C — 独立 Agent Pill"
        subtitle="Avatar は brand mark に固定、Agent 切替は別の Pill で。検討案 A/B は最後に比較参考として残置。"
      >
        <DCArtboard id="header-c-host" label="ホスト統合 · Customizer Opus 選択" width={1280} height={780}>
          <MockKintoneHost>
            <div className="host-sidepanel">
              <PanelWithHeader HeaderComp={HeaderVariantC} c={c} accent={accent} props={{ currentId: 'cust-opus' }} />
            </div>
          </MockKintoneHost>
        </DCArtboard>
        <DCArtboard id="header-c-customizer" label="案 C · Customizer Opus 選択中" width={420} height={560}>
          <PanelWithHeader HeaderComp={HeaderVariantC} c={c} accent={accent} props={{ currentId: 'cust-opus' }} />
        </DCArtboard>
        <DCArtboard id="header-c-biz" label="案 C · 業務ユーザー選択中" width={420} height={560}>
          <PanelWithHeader HeaderComp={HeaderVariantC} c={c} accent={accent} props={{ currentId: 'biz' }} />
        </DCArtboard>
        <DCArtboard id="header-c-open" label="案 C · ドロップダウン展開 (3 Agent)" width={420} height={640}>
          <PanelWithHeader HeaderComp={HeaderVariantC} c={c} accent={accent} props={{ currentId: 'cust-opus', open: true }} />
        </DCArtboard>
        <DCArtboard id="header-c-sonnet" label="案 C · Customizer Sonnet 選択中" width={420} height={560}>
          <PanelWithHeader HeaderComp={HeaderVariantC} c={c} accent={accent} props={{ currentId: 'cust-sonnet' }} />
        </DCArtboard>
        <DCArtboard id="header-rejected" label="検討案 A / B (参考)" width={420} height={780}>
          <div style={{ width: '100%', height: '100%', background: '#f0eee9', padding: 16, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
            <RejectedNote label="案 A · インライン Pill" cons="Avatar の brand 感が薄れる" />
            <div style={{ width: 380, height: 70, overflow: 'hidden', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)', alignSelf: 'center' }}>
              <HeaderVariantA c={c} accent={accent} currentId="cust-opus" />
            </div>
            <RejectedNote label="案 B · 名前 + ▾" cons="既存と差が小さく、切替対象である意図が弱い" />
            <div style={{ width: 380, height: 70, overflow: 'hidden', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)', alignSelf: 'center' }}>
              <HeaderVariantB c={c} accent={accent} currentId="cust-opus" />
            </div>
            <RejectedNote label="採用 · 案 C" pros="Agent が独立した UI = 切替対象だと一目で分かる。Avatar は brand mark に。" final />
            <div style={{ width: 380, height: 70, overflow: 'hidden', borderRadius: 10, border: `2px solid ${accent}`, alignSelf: 'center' }}>
              <HeaderVariantC c={c} accent={accent} currentId="cust-opus" />
            </div>
          </div>
        </DCArtboard>
        <DCPostIt top={40} left={-200} rotate={-3} width={180}>
          MODEL バッジ: Opus は塗りで上位感、Sonnet は枠線で軽量感。
        </DCPostIt>
        <DCPostIt top={420} left={-200} rotate={2} width={180}>
          ドロップダウン下部に「切替時は新規会話」の注意を明示。
        </DCPostIt>
      </DCSection>

      {/* ─── Section 2: Admin vs 業務ユーザー — 違いを明示 ─── */}
      <DCSection
        id="wedge-admin-vs-user"
        title="Admin vs 業務ユーザー · 違いを明示"
        subtitle="admin が Customizer Agent を非公開設定にした組織を想定。⚙ アイコンの有無、プルダウン項目数、Memory トグル可否が変わる。"
      >
        <DCArtboard id="adminvsuser-compare" label="対比 · 同条件 / 同サイズで並べる" width={1100} height={760}>
          <AdminVsUserCompare c={c} accent={accent} />
        </DCArtboard>
        <DCArtboard id="admin-dropdown" label="Admin · プルダウン展開" width={420} height={640}>
          <PanelWithHeader HeaderComp={HeaderVariantC} c={c} accent={accent}
            props={{ currentId: 'cust-opus', isAdmin: true, open: true }} />
        </DCArtboard>
        <DCArtboard id="biz-dropdown" label="業務ユーザー · プルダウン展開 (1 件のみ)" width={420} height={560}>
          <PanelWithHeader HeaderComp={HeaderVariantC} c={c} accent={accent}
            props={{
              currentId: 'biz', isAdmin: false, open: true,
              agents: BUILTIN_AGENTS.map(a => a.id === 'biz' ? a : { ...a, published: false }),
            }} />
        </DCArtboard>
        <DCPostIt top={40} left={-200} rotate={-2} width={180}>
          非 admin の表示は admin の公開トグル次第。組織が Customizer を全部非公開にすれば 1 Agent だけになる。
        </DCPostIt>
      </DCSection>

      {/* ─── Section 3: Settings View — Agents (V1) ─── */}
      <DCSection
        id="wedge-settings-agents"
        title="Settings View · エージェント (V1)"
        subtitle="Header の ⚙ から開く。Artifact ペインの位置を置き換えて Side-by-Side で開く。"
      >
        <DCArtboard id="settings-agents-host" label="ホスト統合 · 一覧" width={1600} height={840}>
          <HostWithSettings accent={accent} dark={dark} section="agents" />
        </DCArtboard>
        <DCArtboard id="settings-agents-solo" label="Settings View 単体 · 一覧" width={680} height={780}>
          <div style={{ width: '100%', height: '100%', background: c.bg, display: 'flex' }}>
            <SettingsView c={c} accent={accent} section="agents" />
          </div>
        </DCArtboard>
        <DCPostIt top={40} left={-200} rotate={-3} width={180}>
          公開トグルを切ると end user の Header プルダウンから消える。組織のデフォルトもここで切替。
        </DCPostIt>
      </DCSection>

      {/* ─── Section 4: Settings View — Skills (V1) ─── */}
      <DCSection
        id="wedge-settings-skills"
        title="Settings View · スキル (V1)"
        subtitle="Plugin 同梱 skill の同期、カスタム skill 追加、Workspace 全体一覧"
      >
        <DCArtboard id="settings-skills-solo" label="Skills 単体" width={680} height={840}>
          <div style={{ width: '100%', height: '100%', background: c.bg, display: 'flex' }}>
            <SettingsView c={c} accent={accent} section="skills" />
          </div>
        </DCArtboard>
        <DCArtboard id="settings-skills-host" label="ホスト統合 · Skills" width={1600} height={860}>
          <HostWithSettings accent={accent} dark={dark} section="skills" />
        </DCArtboard>
        <DCArtboard id="settings-skills-add" label="追加モーダル · ① ファイル選択前" width={680} height={840}>
          <div style={{ width: '100%', height: '100%', background: c.bg, display: 'flex' }}>
            <SettingsView c={c} accent={accent} section="skills" detail="add-file" />
          </div>
        </DCArtboard>
        <DCArtboard id="settings-skills-uploaded" label="追加モーダル · ② ファイル選択後 (プレビュー)" width={680} height={920}>
          <div style={{ width: '100%', height: '100%', background: c.bg, display: 'flex' }}>
            <SettingsView c={c} accent={accent} section="skills" detail="add-uploaded" />
          </div>
        </DCArtboard>
        <DCArtboard id="settings-skills-text" label="追加モーダル · 直接入力タブ" width={680} height={920}>
          <div style={{ width: '100%', height: '100%', background: c.bg, display: 'flex' }}>
            <SettingsView c={c} accent={accent} section="skills" detail="add-text" />
          </div>
        </DCArtboard>
        <DCPostIt top={40} left={-200} rotate={-2} width={180}>
          ファイルを drop すると frontmatter から name / description を自動抽出 → 編集 → アップロード。
        </DCPostIt>
      </DCSection>

      {/* ─── Section 5: Settings View — Agent 詳細編集 (V2) ─── */}
      <DCSection
        id="wedge-settings-agent-detail"
        title="Settings View · エージェント編集 (V2)"
        subtitle="ワークスペース skill / MCP tool を Agent 単位で ON / OFF。MCP Server header は cascade。"
      >
        <DCArtboard id="settings-agent-detail" label="Agent 詳細編集 · 全体" width={680} height={1640}>
          <div style={{ width: '100%', height: '100%', background: c.bg, display: 'flex' }}>
            <SettingsView c={c} accent={accent} section="agents" detail="edit" />
          </div>
        </DCArtboard>
        <DCArtboard id="settings-agent-detail-host" label="ホスト統合 · 編集中" width={1600} height={1680}>
          <HostWithSettings accent={accent} dark={dark} section="agents" detail="edit" />
        </DCArtboard>
        <DCPostIt top={40} left={-200} rotate={-2} width={180}>
          Kintone MCP のカテゴリ (参照系 / 書込系 / 管理系) は目視グルーピングのみで折りたたみ無し。
        </DCPostIt>
        <DCPostIt top={420} left={-200} rotate={2} width={180}>
          `⚠ ask` は per-tool で実行前承認が必要なツール。クリックで切替可。
        </DCPostIt>
      </DCSection>

      {/* ─── Section 6: Settings View — MCP (V2) ─── */}
      <DCSection
        id="wedge-settings-mcp"
        title="Settings View · MCP サーバー (V2)"
        subtitle="GitHub / Slack 等の追加 MCP server の接続管理。secret 登録は Plugin Config (Step 4) に分担。"
      >
        <DCArtboard id="settings-mcp-solo" label="MCP 一覧" width={680} height={780}>
          <div style={{ width: '100%', height: '100%', background: c.bg, display: 'flex' }}>
            <SettingsView c={c} accent={accent} section="mcp" />
          </div>
        </DCArtboard>
        <DCArtboard id="settings-mcp-modal" label="新規 MCP · 3 ステップ案内モーダル" width={680} height={780}>
          <div style={{ width: '100%', height: '100%', background: c.bg, display: 'flex' }}>
            <SettingsView c={c} accent={accent} section="mcp" detail="add-modal" />
          </div>
        </DCArtboard>
        <DCArtboard id="settings-mcp-tools" label="Tools 詳細 (「Tools」ボタンクリック後)" width={680} height={1080}>
          <div style={{ width: '100%', height: '100%', background: c.bg, display: 'flex' }}>
            <SettingsView c={c} accent={accent} section="mcp" detail="tools" />
          </div>
        </DCArtboard>
        <DCArtboard id="settings-mcp-tools-host" label="ホスト統合 · Tools 詳細" width={1600} height={1100}>
          <HostWithSettings accent={accent} dark={dark} section="mcp" detail="tools" />
        </DCArtboard>
        <DCPostIt top={40} left={-200} rotate={-2} width={180}>
          client_secret は setProxyConfig 必須 → Plugin Config に置く。Chat Panel 側は OAuth flow と Vault 管理のみ。
        </DCPostIt>
      </DCSection>

      {/* ─── Section 7: Settings View — Custom Agent 新規作成 (V3) ─── */}
      <DCSection
        id="wedge-settings-create"
        title="Settings View · カスタムエージェント作成 (V3)"
        subtitle="system prompt 編集 + skill / tool 構成を 1 画面で。"
      >
        <DCArtboard id="settings-create" label="新規 Agent 作成" width={680} height={1440}>
          <div style={{ width: '100%', height: '100%', background: c.bg, display: 'flex' }}>
            <SettingsView c={c} accent={accent} section="agents" detail="create" />
          </div>
        </DCArtboard>
        <DCPostIt top={40} left={-200} rotate={-3} width={180}>
          system prompt は Anthropic に保存される本体。トークン数表示で肥大化を防ぐ。
        </DCPostIt>
      </DCSection>

      {/* ─── Section 8: Customizer wedge — Apply Workflow Footer (V1, #20) ─── */}
      <DCSection
        id="wedge-workflow"
        title="Customizer · プレビュー → 適用 → ロールバック (V1 · #20)"
        subtitle="kintone-customize-js artifact のフッターに Step バー。状態に応じて主アクション (ボタン) と Status line が変わる。"
      >
        <DCArtboard id="wf-ready" label="① 生成直後 · プレビュー可" width={800} height={800}>
          <WorkflowArtboard state="ready" accent={accent} dark={dark} />
        </DCArtboard>
        <DCArtboard id="wf-previewed" label="② プレビュー済 · 適用 OK" width={800} height={800}>
          <WorkflowArtboard state="previewed" accent={accent} dark={dark} />
        </DCArtboard>
        <DCArtboard id="wf-applying" label="③ 適用中 · spinner" width={800} height={800}>
          <WorkflowArtboard state="applying" accent={accent} dark={dark} />
        </DCArtboard>
        <DCArtboard id="wf-applied" label="④ 本番反映済 · ロールバック可" width={800} height={800}>
          <WorkflowArtboard state="applied" accent={accent} dark={dark} />
        </DCArtboard>
        <DCArtboard id="wf-rolledback" label="⑤ ロールバック完了" width={800} height={800}>
          <WorkflowArtboard state="rolled-back" accent={accent} dark={dark} />
        </DCArtboard>
        <DCArtboard id="wf-fullflow" label="ホスト統合 · 会話 + Artifact + Workflow + ファイルツリー" width={1800} height={860}>
          <CustomizerFullFlow accent={accent} dark={dark} density={density} />
        </DCArtboard>
        <DCPostIt top={40} left={-200} rotate={-3} width={180}>
          適用は破壊的操作扱い。Step 2 は強調色、Step 3 (ロールバック) はワーニング色で別レイヤー感を出す。
        </DCPostIt>
        <DCPostIt top={500} left={-200} rotate={2} width={180}>
          「変更を依頼」の入力欄は Workflow バーの下に小さく置く想定 (再依頼導線を残す)。
        </DCPostIt>
      </DCSection>
    </>
  );
}

window.WedgeSections = WedgeSections;
