// ─────────────────────────────────────────────────────────────
// preset-layouts.jsx
// 4 レイアウト案 + エッジケース + 遷移ストーリーボード + 分析カード。
// すべて preset-agents.jsx のトークン/プリミティブを利用。
// ─────────────────────────────────────────────────────────────

// 共通パネルシェル — Header / main(scroll) / UtilityBar / Composer
function PresetPanel({ c, accent, picker = 'none', composerHint, children }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: c.bg, color: c.text, fontFamily: "'Noto Sans JP', sans-serif" }}>
      <PresetHeader c={c} accent={accent} picker={picker} />
      <div className="chat-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {children}
      </div>
      <PresetUtilityBar c={c} accent={accent} />
      <PresetComposer c={c} accent={accent} hint={composerHint} />
    </div>
  );
}

// メインエリア冒頭の小見出し
function MainIntro({ c, accent, text = 'エージェントを選んで、サンプルからすぐに始められます。' }) {
  return (
    <div style={{ padding: '14px 16px 10px' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: c.text, letterSpacing: -0.2, marginBottom: 3 }}>
        何をお手伝いしましょうか？
      </div>
      <div style={{ fontSize: 11.5, color: c.muted, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

function AgentIconChip({ a, c, accent, size = 30, radius = 9 }) {
  const cs = agentChipStyle(a, c, accent);
  return (
    <span style={{
      width: size, height: size, borderRadius: radius, background: cs.bg, color: cs.fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flex: `0 0 ${size}px`,
    }}>
      <PresetGlyph kind={a.icon} size={Math.round(size * 0.52)} color="currentColor" />
    </span>
  );
}

// ═════════════════════════════════════════════════════════════
// 案 A — アコーディオン (1エージェント展開 / プロンプトは縦リスト)
// ═════════════════════════════════════════════════════════════
function LayoutAccordion({ c, accent, agents = PRESET_AGENTS, openId, search = false }) {
  const open = openId || agents[0].id;
  return (
    <PresetPanel c={c} accent={accent}>
      <MainIntro c={c} accent={accent} />
      {search && (
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px', background: c.card, border: `1px solid ${c.cardBorder}`, borderRadius: 10, color: c.subtle, fontSize: 12 }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="6" cy="6" r="4" /><path d="M9 9l2.5 2.5" /></svg>
            エージェントを検索
          </div>
        </div>
      )}
      <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {agents.map((a) => {
          const isOpen = a.id === open;
          return (
            <div key={a.id} style={{
              border: `1px solid ${isOpen ? c.border : c.cardBorder}`, borderRadius: 12,
              background: isOpen ? c.card : 'transparent', overflow: 'hidden',
              boxShadow: isOpen ? '0 2px 12px rgba(0,0,0,0.04)' : 'none',
            }}>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: c.text,
              }}>
                <AgentIconChip a={a} c={c} accent={accent} />
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</span>
                    <ModelBadge model={a.model} c={c} accent={accent} />
                    {a.isDefault && <span style={{ fontSize: 8.5, fontWeight: 600, color: c.muted, border: `1px solid ${c.border}`, padding: '0 4px', borderRadius: 3 }}>既定</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: c.muted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.desc}</div>
                </div>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={c.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 12px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M3 5l3 3 3-3" /></svg>
              </button>
              {isOpen && (
                <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {a.prompts.map((p, i) => <PromptListButton key={i} text={p} c={c} accent={accent} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PresetPanel>
  );
}

// ═════════════════════════════════════════════════════════════
// 案 B — タブ切替 (上部セグメント / プロンプトは2列グリッド)
// ═════════════════════════════════════════════════════════════
function LayoutTabs({ c, accent, agents = PRESET_AGENTS, activeId }) {
  const active = agents.find((a) => a.id === (activeId || agents[0].id)) || agents[0];
  return (
    <PresetPanel c={c} accent={accent}>
      <MainIntro c={c} accent={accent} text="エージェントを切り替えて、できることを確認できます。" />
      {/* タブストリップ (横スクロール対応) */}
      <div className="chat-scroll" style={{ display: 'flex', gap: 6, padding: '0 14px 12px', overflowX: 'auto' }}>
        {agents.map((a) => {
          const on = a.id === active.id;
          return (
            <button key={a.id} style={{
              flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: on ? 600 : 500,
              background: on ? accent : c.card, color: on ? (c.onAccent || '#fff') : c.muted,
              border: `1px solid ${on ? accent : c.cardBorder}`, whiteSpace: 'nowrap',
            }}>
              <PresetGlyph kind={a.icon} size={13} color="currentColor" />
              {a.name}
              {a.purpose === 'customizer' && <span style={{ fontSize: 8.5, fontFamily: '"JetBrains Mono", monospace', opacity: 0.85 }}>{a.model === 'opus' ? 'OPUS' : 'SONNET'}</span>}
            </button>
          );
        })}
      </div>
      {/* 選択エージェントの説明 */}
      <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <AgentIconChip a={active} c={c} accent={accent} size={34} radius={10} />
        <div style={{ lineHeight: 1.3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{active.name}</span>
            <ModelBadge model={active.model} c={c} accent={accent} size="lg" />
          </div>
          <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{active.desc}</div>
        </div>
      </div>
      {/* プロンプト 2列グリッド */}
      <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {active.prompts.map((p, i) => <PromptGridCard key={i} text={p} c={c} accent={accent} />)}
      </div>
    </PresetPanel>
  );
}

// ═════════════════════════════════════════════════════════════
// 案 C — 全件カードスタック (全プロンプト表示 / 横スクロールチップ)
// ═════════════════════════════════════════════════════════════
function LayoutStack({ c, accent, agents = PRESET_AGENTS }) {
  return (
    <PresetPanel c={c} accent={accent}>
      <MainIntro c={c} accent={accent} text="すべてのエージェントとサンプルを一覧。チップを押すとすぐ実行します。" />
      <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {agents.map((a) => (
          <div key={a.id} style={{ border: `1px solid ${c.cardBorder}`, borderRadius: 12, background: c.card, padding: '12px 0 12px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 13px 10px' }}>
              <AgentIconChip a={a} c={c} accent={accent} />
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</span>
                  <ModelBadge model={a.model} c={c} accent={accent} />
                </div>
                <div style={{ fontSize: 10.5, color: c.muted, marginTop: 1 }}>{a.desc}</div>
              </div>
            </div>
            <div className="chat-scroll" style={{ display: 'flex', gap: 7, padding: '0 13px', overflowX: 'auto' }}>
              {a.prompts.map((p, i) => <PromptChip key={i} text={p} c={c} accent={accent} />)}
            </div>
          </div>
        ))}
      </div>
    </PresetPanel>
  );
}

// ═════════════════════════════════════════════════════════════
// 案 D — カルーセル (1エージェント1ページ / 横スワイプ + ドット)
// ═════════════════════════════════════════════════════════════
function LayoutCarousel({ c, accent, agents = PRESET_AGENTS, pageIndex = 0 }) {
  const a = agents[pageIndex];
  const navBtn = {
    width: 28, height: 28, borderRadius: 999, border: `1px solid ${c.cardBorder}`,
    background: c.card, color: c.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 28px',
  };
  return (
    <PresetPanel c={c} accent={accent}>
      <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: c.muted, flex: 1 }}>エージェント {pageIndex + 1} / {agents.length}</span>
        <button style={navBtn}><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 2.5L4 6l3.5 3.5" /></svg></button>
        <button style={navBtn}><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 2.5L8 6l-3.5 3.5" /></svg></button>
      </div>
      <div style={{ padding: '4px 18px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <AgentIconChip a={a} c={c} accent={accent} size={52} radius={15} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>{a.name}</span>
          <ModelBadge model={a.model} c={c} accent={accent} size="lg" />
        </div>
        <div style={{ fontSize: 12, color: c.muted, marginTop: 4, lineHeight: 1.5 }}>{a.desc}</div>
      </div>
      <div style={{ padding: '16px 16px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {a.prompts.map((p, i) => <PromptListButton key={i} text={p} c={c} accent={accent} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '4px 0 14px' }}>
        {agents.map((_, i) => (
          <span key={i} style={{ width: i === pageIndex ? 18 : 6, height: 6, borderRadius: 3, background: i === pageIndex ? accent : c.border, transition: 'width .2s' }} />
        ))}
      </div>
    </PresetPanel>
  );
}

// ═════════════════════════════════════════════════════════════
// エッジケース
// ═════════════════════════════════════════════════════════════
// サンプルプロンプト 0 個
function EdgeNoPrompts({ c, accent }) {
  const agents = [
    { ...PRESET_AGENTS[0] },
    { id: 'newbie', purpose: 'default', name: '新規エージェント', model: 'sonnet', desc: 'サンプル未設定', icon: 'ai', tint: 'emerald', prompts: [] },
  ];
  return (
    <PresetPanel c={c} accent={accent}>
      <MainIntro c={c} accent={accent} />
      <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 通常エージェント (折りたたみ) */}
        <div style={{ border: `1px solid ${c.cardBorder}`, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AgentIconChip a={agents[0]} c={c} accent={accent} />
          <div style={{ flex: 1, lineHeight: 1.25 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{agents[0].name}</div>
            <div style={{ fontSize: 10.5, color: c.muted }}>{agents[0].desc}</div>
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={c.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5l3 3 3-3" /></svg>
        </div>
        {/* プロンプト0個のエージェント (展開) */}
        <div style={{ border: `1px solid ${c.border}`, borderRadius: 12, background: c.card, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
            <AgentIconChip a={agents[1]} c={c} accent={accent} />
            <div style={{ flex: 1, lineHeight: 1.25 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{agents[1].name}</span><ModelBadge model={agents[1].model} c={c} accent={accent} /></div>
              <div style={{ fontSize: 10.5, color: c.muted }}>{agents[1].desc}</div>
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={c.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}><path d="M3 5l3 3 3-3" /></svg>
          </div>
          <div style={{ padding: '0 12px 14px' }}>
            <div style={{ border: `1px dashed ${c.border}`, borderRadius: 10, padding: '16px 14px', textAlign: 'center', background: c.bg }}>
              <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.6, marginBottom: 12 }}>
                このエージェントにはまだ<br />サンプルがありません。
              </div>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px',
                background: accent, color: c.onAccent || '#fff', border: 'none', borderRadius: 10,
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                自由入力で話しかける
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6h7M6 3l3 3-3 3" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </PresetPanel>
  );
}

// エージェントが 1 個のみ — リスト不要、即プロンプト提示
function EdgeSingleAgent({ c, accent }) {
  const a = PRESET_AGENTS[0];
  return (
    <PresetPanel c={c} accent={accent}>
      <div style={{ padding: '20px 18px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <AgentIconChip a={a} c={c} accent={accent} size={48} radius={14} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>{a.name}</span>
          <ModelBadge model={a.model} c={c} accent={accent} size="lg" />
        </div>
        <div style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>{a.desc}</div>
      </div>
      <div style={{ padding: '8px 16px 6px', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: c.subtle, textTransform: 'uppercase' }}>サンプルから始める</div>
      <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {a.prompts.map((p, i) => <PromptListButton key={i} text={p} c={c} accent={accent} />)}
      </div>
    </PresetPanel>
  );
}

// ═════════════════════════════════════════════════════════════
// 遷移ストーリーボード (3 フレーム)
// ═════════════════════════════════════════════════════════════
// ① プロンプト押下 (pressed 状態)
function StoryPress({ c, accent }) {
  const a = PRESET_AGENTS[0];
  return (
    <PresetPanel c={c} accent={accent}>
      <MainIntro c={c} accent={accent} />
      <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ border: `1px solid ${c.border}`, borderRadius: 12, background: c.card, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
            <AgentIconChip a={a} c={c} accent={accent} />
            <div style={{ flex: 1, lineHeight: 1.25 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</span><ModelBadge model={a.model} c={c} accent={accent} /></div>
              <div style={{ fontSize: 10.5, color: c.muted }}>{a.desc}</div>
            </div>
          </div>
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <PromptListButton text={a.prompts[0]} c={c} accent={accent} />
            <PromptListButton text={a.prompts[1]} c={c} accent={accent} pressed />
            <PromptListButton text={a.prompts[2]} c={c} accent={accent} />
          </div>
        </div>
      </div>
    </PresetPanel>
  );
}

// ② カードが沈み込み、選んだプロンプトが user バブルへ
function StoryMorph({ c, accent }) {
  const a = PRESET_AGENTS[0];
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: c.bg, color: c.text, position: 'relative', fontFamily: "'Noto Sans JP', sans-serif" }}>
      <PresetHeader c={c} accent={accent} agent={a} />
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {/* 沈み込むリスト (フェード) */}
        <div style={{ position: 'absolute', inset: 0, padding: '14px 16px', opacity: 0.18, transform: 'translateY(10px) scale(0.98)', filter: 'blur(0.5px)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>何をお手伝いしましょうか？</div>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ height: 38, borderRadius: 10, background: c.card, border: `1px solid ${c.cardBorder}`, marginBottom: 6 }} />
          ))}
        </div>
        {/* 立ち上がる user バブル */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 16, display: 'flex', justifyContent: 'flex-end', padding: '0 16px' }}>
          <div style={{
            maxWidth: '85%', background: accent + '14', color: c.text, padding: '10px 14px',
            border: `1px solid ${accent}40`, borderRadius: '16px 16px 4px 16px', fontSize: 12.5, lineHeight: 1.5,
            boxShadow: `0 8px 24px ${accent}22`,
          }}>{a.prompts[1]}</div>
        </div>
        {/* モーション軌跡 */}
        <svg style={{ position: 'absolute', left: '20%', top: 70, opacity: 0.5 }} width="40" height="60" viewBox="0 0 40 60" fill="none" stroke={accent} strokeWidth="1.4" strokeLinecap="round" strokeDasharray="3 4"><path d="M30 55 C 10 40, 30 25, 14 8" /><path d="M14 8l-3 5M14 8l5 2" /></svg>
      </div>
      <PresetComposer c={c} accent={accent} />
    </div>
  );
}

// ③ チャットへ — 選択エージェントが応答ストリーミング
function StoryChat({ c, accent }) {
  const a = PRESET_AGENTS[0];
  const bubbleIn = { display: 'flex', gap: 8, alignItems: 'flex-start', maxWidth: '92%' };
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: c.bg, color: c.text, fontFamily: "'Noto Sans JP', sans-serif" }}>
      <PresetHeader c={c} accent={accent} agent={a} />
      <div className="chat-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ alignSelf: 'flex-end', maxWidth: '85%', background: accent + '14', border: `1px solid ${accent}40`, padding: '10px 14px', borderRadius: '16px 16px 4px 16px', fontSize: 13, lineHeight: 1.5 }}>
          {a.prompts[1]}
        </div>
        <div style={bubbleIn}>
          <div style={{ flex: '0 0 22px', width: 22, height: 22, borderRadius: '50%', background: accent, marginTop: 1 }} />
          <div style={{ background: c.cardHi, border: `1px solid ${c.cardBorder}`, borderRadius: 10, padding: '8px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 20, height: 20, borderRadius: 6, background: '#fff4c9', color: '#8a6400', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 20px' }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6.5l2.5 2.5L10 3.5" /></svg>
            </span>
            <div style={{ lineHeight: 1.3 }}>
              <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: accent, fontWeight: 600 }}>get_records</code>
              <span style={{ color: c.text, fontSize: 12, fontWeight: 500, marginLeft: 6 }}>案件管理を取得</span>
            </div>
          </div>
        </div>
        <div style={bubbleIn}>
          <div style={{ flex: '0 0 22px', width: 22, height: 22, borderRadius: '50%', background: accent, marginTop: 1 }} />
          <div style={{ fontSize: 13, lineHeight: 1.6, color: c.text }}>
            先週追加された案件は 12 件でした。集計しています
            <span style={{ marginLeft: 4, color: accent }}><span className="dot" /><span className="dot" /><span className="dot" /></span>
          </div>
        </div>
      </div>
      <PresetComposer c={c} accent={accent} hint="フォローアップを入力…" />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// 分析カード — 比較表
// ═════════════════════════════════════════════════════════════
function ComparisonCard({ accent }) {
  const c = presetColors(accent);
  const cols = ['A アコーディオン', 'B タブ', 'C 全件スタック', 'D カルーセル'];
  const rows = [
    ['一覧性 (何ができるか)', ['○', '△', '◎', '△']],
    ['縦スクロール量', ['◎', '◎', '△', '◎']],
    ['拡張性 (10個以上)', ['◎', '○', '△', '◎']],
    ['認知負荷の低さ', ['◎', '○', '△', '◎']],
    ['2クリック達成', ['◎', '◎', '◎ (1)', '○']],
    ['幅360pxでの成立', ['◎', '○', '○', '◎']],
    ['実装コスト', ['◎', '○', '◎', '△']],
  ];
  const mark = (m) => {
    const col = m.startsWith('◎') ? accent : m.startsWith('○') ? c.muted : c.subtle;
    return <span style={{ color: col, fontWeight: m.startsWith('◎') ? 700 : 500, fontSize: 13 }}>{m}</span>;
  };
  return (
    <div style={{ width: '100%', height: '100%', background: '#faf8f3', padding: '30px 32px', overflow: 'auto', boxSizing: 'border-box', color: '#231200' }}>
      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3, marginBottom: 3 }}>4 案の比較</div>
      <div style={{ fontSize: 12, color: '#6b5f4a', marginBottom: 20 }}>◎ 優れる / ○ 普通 / △ 弱い</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 8px', borderBottom: `1.5px solid ${c.border}`, color: '#6b5f4a', fontWeight: 600, fontSize: 11 }}>評価軸</th>
            {cols.map((h, i) => (
              <th key={i} style={{ textAlign: 'center', padding: '8px 6px', borderBottom: `1.5px solid ${c.border}`, color: i === 0 ? accent : '#6b5f4a', fontWeight: 600, fontSize: 10.5, width: 90 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, marks], ri) => (
            <tr key={ri} style={{ background: ri % 2 ? 'rgba(35,18,0,0.015)' : 'transparent' }}>
              <td style={{ padding: '9px 8px', borderBottom: `1px solid ${c.border}`, color: '#231200' }}>{label}</td>
              {marks.map((m, ci) => (
                <td key={ci} style={{ textAlign: 'center', padding: '9px 6px', borderBottom: `1px solid ${c.border}`, background: ci === 0 ? c.accentSoft : 'transparent' }}>{mark(m)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 18, padding: '14px 16px', background: c.accentSoft, borderRadius: 12, border: `1px solid ${accent}33` }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: accent, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1l1.8 3.9L13 5.4l-3 3 0.8 4.2L7 10.7 3.2 12.6 4 8.4l-3-3 4.2-0.5z" /></svg>
          推奨 — 案 A アコーディオン
        </div>
        <div style={{ fontSize: 11.5, color: '#231200', lineHeight: 1.65 }}>
          全制約 (狭幅360px / 10個以上の拡張 / 低認知負荷 / 2クリック) を唯一すべて満たす。既定エージェントを開いた状態にすれば<strong>初回1クリックで実行</strong>でき、折りたたみ行は増えても縦に積めるためマーケットプレイス後も破綻しない。
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// 分析カード — 推奨理由 + マイクロインタラクション + 論点整理
// ═════════════════════════════════════════════════════════════
function RationaleCard({ accent }) {
  const c = presetColors(accent);
  const sec = { marginBottom: 20 };
  const h = { fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: '#6b5f4a', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 6 };
  const li = { display: 'flex', gap: 9, padding: '5px 0', fontSize: 12, lineHeight: 1.6, color: '#231200' };
  const num = (n) => (<span style={{ flex: '0 0 18px', width: 18, height: 18, borderRadius: 5, background: c.accentSoft, color: accent, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, fontFamily: '"JetBrains Mono", monospace' }}>{n}</span>);
  return (
    <div style={{ width: '100%', height: '100%', background: '#faf8f3', padding: '30px 32px', overflow: 'auto', boxSizing: 'border-box', color: '#231200', fontSize: 12 }}>
      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3, marginBottom: 3 }}>推奨と設計メモ</div>
      <div style={{ fontSize: 12, color: '#6b5f4a', marginBottom: 22 }}>業務ユーザーの「2クリックで成果物」を成立させる</div>

      <div style={sec}>
        <div style={h}>マイクロインタラクション (一覧 → チャット)</div>
        <div style={li}>{num('1')}<span><strong>押下:</strong> プロンプトボタンが accent で塗りつぶされ、わずかに沈む (scale 0.99 + 影)。</span></div>
        <div style={li}>{num('2')}<span><strong>変形:</strong> 一覧カードは下方向にフェード・縮小して退場、選んだプロンプトが <strong>user バブルへモーフ</strong>して上がる (240ms)。即切替よりも「自分の操作が送信になった」因果が伝わる。</span></div>
        <div style={li}>{num('3')}<span><strong>遷移:</strong> 同じエージェントが応答をストリーミング。ヘッダーのピッカーに選択エージェントが入り、以降は通常チャット。</span></div>
      </div>

      <div style={sec}>
        <div style={h}>ヘッダー Agent ピッカーとの役割整理</div>
        <div style={{ ...li, paddingLeft: 0 }}><span style={{ lineHeight: 1.65 }}>空状態では<strong>一覧がピッカーを兼ねる</strong>ため、ヘッダーはブランドのみ（選択 UI を二重に出さない）。プロンプト押下でエージェントが確定し、ヘッダーピッカーが点灯。以降の<strong>切替はヘッダー</strong>に一本化し、履歴が空に戻れば再び一覧へ。</span></div>
      </div>

      <div style={sec}>
        <div style={h}>自由チャットへの逃げ道</div>
        <div style={{ ...li, paddingLeft: 0 }}><span style={{ lineHeight: 1.65 }}>① <strong>下部 Composer は常時表示</strong>（主たる逃げ道）。② 細い UtilityBar に「新しい会話 / 履歴」。プロンプトを書ける層を一切排除しない。</span></div>
      </div>

      <div style={{ ...sec, marginBottom: 0 }}>
        <div style={h}>エッジケース方針</div>
        <div style={li}>{num('0')}<span><strong>プロンプト0個:</strong> 空状態カード＋「自由入力で話しかける」CTA。</span></div>
        <div style={li}>{num('1')}<span><strong>1エージェントのみ:</strong> リスト chrome を省き、そのエージェントのプロンプトを直接提示。</span></div>
        <div style={li}>{num('N')}<span><strong>10個以上:</strong> 上部に検索を追加、折りたたみ行で縦に積む。既定のみ展開。</span></div>
        <div style={li}>{num('▸')}<span><strong>幅360px:</strong> 1カラム固定・余白を 12px に詰めて成立（本案で確認済み）。</span></div>
      </div>
    </div>
  );
}

Object.assign(window, {
  PresetPanel, MainIntro, AgentIconChip,
  LayoutAccordion, LayoutTabs, LayoutStack, LayoutCarousel,
  EdgeNoPrompts, EdgeSingleAgent,
  StoryPress, StoryMorph, StoryChat,
  ComparisonCard, RationaleCard,
});
