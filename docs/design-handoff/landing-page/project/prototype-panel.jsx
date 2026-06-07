// ─────────────────────────────────────────────────────────────
// prototype-panel.jsx
// 案 A (アコーディオン) の「動く」プロトタイプ。
//   - 空状態ランディング = アコーディオン一覧 (= Agent ピッカー兼用)
//   - プロンプト押下 / 自由入力 → チャット遷移 (即切替 + 軽いフェード)
//   - ツール実行ステップ → タイプライター応答 → 成果物カード
//   - ヘッダーのエージェント名クリックで一覧へ戻る (選び直し)
//   - 「新しい会話」で空状態へ / Composer は常時表示
// 依存 (window): presetColors, PresetGlyph, agentChipStyle, ModelBadge,
//                PRESET_AGENTS, GearIcon, CloseIcon, HeaderIconBtn
// ─────────────────────────────────────────────────────────────

let __mid = 0;
const nextId = () => `m${++__mid}`;

// エージェント purpose 別の応答スクリプト
function buildScript(agent, prompt) {
  if (agent.purpose === 'customizer') {
    return {
      tool: { label: 'コードを生成', detail: `${agent.model === 'opus' ? 'Opus' : 'Sonnet'} で実装中`, tag: 'generate' },
      text: '承知しました。ご要望の kintone カスタマイズ JS です。保存時のバリデーションを追加し、対象フィールドが空の場合はエラーを表示してブロックします。',
      result: {
        kind: 'code', lang: 'JavaScript', name: 'validation.js',
        code: `kintone.events.on('app.record.create.submit', (event) => {\n  const record = event.record;\n  if (!record['顧客名'].value) {\n    event.error = '顧客名は必須項目です';\n  }\n  return event;\n});`,
      },
    };
  }
  // 業務エージェント (default)
  return {
    tool: { label: 'get_records', detail: '案件管理アプリを取得', tag: 'mcp' },
    text: '案件管理アプリから先週（5/26〜6/01）追加されたレコードを取得しました。新規案件は 12 件、合計見込み金額は ¥18,400,000 です。担当者別では田中さんが 5 件で最多でした。集計表を Excel にまとめましたのでご確認ください。',
    result: {
      kind: 'excel', name: '先週の案件集計.xlsx', meta: '12 レコード · 3 シート',
    },
  };
}

function PresetPrototype({ accent = '#0d9488' }) {
  const c = presetColors(accent);
  const agents = PRESET_AGENTS;
  const defaultAgent = agents.find((a) => a.isDefault) || agents[0];

  const [view, setView] = React.useState('list');     // 'list' | 'chat'
  const [openId, setOpenId] = React.useState(defaultAgent.id);
  const [agent, setAgent] = React.useState(null);     // チャット中のエージェント
  const [messages, setMessages] = React.useState([]);
  const scrollRef = React.useRef(null);

  // タイプライター: 未完了の assistant メッセージを 1 つ進める
  React.useEffect(() => {
    const i = messages.findIndex((m) => m.role === 'assistant' && m.shown < m.full.length);
    if (i === -1) {
      // 完了直後の assistant に result があれば 1 度だけ追加
      const done = messages.find((m) => m.role === 'assistant' && m.shown >= m.full.length && m.result && !m.resultDone);
      if (done) {
        const t = setTimeout(() => {
          setMessages((ms) => ms.map((m) => (m.id === done.id ? { ...m, resultDone: true } : m))
            .concat([{ id: nextId(), role: 'result', ...done.result }]));
        }, 280);
        return () => clearTimeout(t);
      }
      return;
    }
    const t = setTimeout(() => {
      setMessages((ms) => ms.map((m, idx) => (idx === i ? { ...m, shown: Math.min(m.full.length, m.shown + 2) } : m)));
    }, 16);
    return () => clearTimeout(t);
  }, [messages]);

  // 末尾へスクロール
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el && view === 'chat') el.scrollTop = el.scrollHeight;
  }, [messages, view]);

  function startChat(a, prompt) {
    if (!prompt || !prompt.trim()) return;
    const script = buildScript(a, prompt);
    setAgent(a);
    setView('chat');
    setMessages([{ id: nextId(), role: 'user', text: prompt }]);
    // ツール実行ステップ → 応答
    setTimeout(() => setMessages((m) => [...m, { id: nextId(), role: 'tool', ...script.tool }]), 480);
    setTimeout(() => setMessages((m) => [...m, { id: nextId(), role: 'assistant', full: script.text, shown: 0, result: script.result }]), 1150);
  }

  function newConversation() {
    setView('list');
    setAgent(null);
    setMessages([]);
    setOpenId(defaultAgent.id);
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: c.bg, color: c.text, fontFamily: "'Noto Sans JP', sans-serif", overflow: 'hidden' }}>
      <ProtoHeader c={c} accent={accent} agent={view === 'chat' ? agent : null} onPickerClick={newConversation} />

      <div ref={scrollRef} className="chat-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        {view === 'list' ? (
          <div key="list" className="view-fade">
            <ListIntro c={c} />
            <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agents.map((a) => (
                <AccordionRow key={a.id} a={a} c={c} accent={accent}
                  open={a.id === openId}
                  onToggle={() => setOpenId((id) => (id === a.id ? null : a.id))}
                  onPrompt={(p) => startChat(a, p)} />
              ))}
            </div>
          </div>
        ) : (
          <div key="chat" className="view-fade" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.map((m) => <ChatMessage key={m.id} m={m} c={c} accent={accent} />)}
          </div>
        )}
      </div>

      <UtilityBar c={c} accent={accent} onNew={newConversation} hasChat={view === 'chat'} />
      <Composer c={c} accent={accent}
        hint={view === 'chat' ? 'フォローアップを入力…' : 'または、自由に入力して相談…'}
        onSend={(text) => startChat(view === 'chat' ? agent : (agents.find((a) => a.id === openId) || defaultAgent), text)}
        chat={view === 'chat'} />
    </div>
  );
}

// ── ヘッダー ──
function ProtoHeader({ c, accent, agent, onPickerClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: `1px solid ${c.border}`, background: c.panel, backdropFilter: 'blur(12px)', flex: '0 0 auto', position: 'relative', zIndex: 3 }}>
      <div style={{ position: 'relative', flex: '0 0 auto' }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: accent, color: c.onAccent || '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, fontWeight: 800, letterSpacing: -0.5 }}>CA</div>
        <span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: `2px solid ${c.bg}` }} />
      </div>
      {agent ? (
        <button onClick={onPickerClick} title="エージェントを選び直す" style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: c.text, textAlign: 'left', padding: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.name}</span>
          <ModelBadge model={agent.model} c={c} accent={accent} />
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={c.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5l3 3 3-3" /></svg>
        </button>
      ) : (
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text, letterSpacing: -0.2, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Cowork Agent</span>
            <span style={{ fontSize: 9, color: accent, background: c.accentSoft, padding: '1px 5px', borderRadius: 3, fontWeight: 600, flex: '0 0 auto' }}>for kintone</span>
          </div>
        </div>
      )}
      <HeaderIconBtn c={c} title="設定" highlight><GearIcon /></HeaderIconBtn>
      <HeaderIconBtn c={c} title="閉じる"><CloseIcon /></HeaderIconBtn>
    </div>
  );
}

function ListIntro({ c }) {
  return (
    <div style={{ padding: '14px 16px 10px' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: c.text, letterSpacing: -0.2, marginBottom: 3 }}>何をお手伝いしましょうか？</div>
      <div style={{ fontSize: 11.5, color: c.muted, lineHeight: 1.5 }}>エージェントを選んで、サンプルからすぐに始められます。</div>
    </div>
  );
}

function AgentChip({ a, c, accent, size = 30, radius = 9 }) {
  const cs = agentChipStyle(a, c, accent);
  return (
    <span style={{ width: size, height: size, borderRadius: radius, background: cs.bg, color: cs.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: `0 0 ${size}px` }}>
      <PresetGlyph kind={a.icon} size={Math.round(size * 0.52)} color="currentColor" />
    </span>
  );
}

// ── アコーディオン行 (開閉 + プロンプト押下) ──
function AccordionRow({ a, c, accent, open, onToggle, onPrompt }) {
  const [pressed, setPressed] = React.useState(null);
  return (
    <div style={{ border: `1px solid ${open ? c.border : c.cardBorder}`, borderRadius: 12, background: open ? c.card : 'transparent', overflow: 'hidden', boxShadow: open ? '0 2px 12px rgba(0,0,0,0.04)' : 'none', transition: 'background .18s, box-shadow .18s' }}>
      <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: c.text }}>
        <AgentChip a={a} c={c} accent={accent} />
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</span>
            <ModelBadge model={a.model} c={c} accent={accent} />
            {a.isDefault && <span style={{ fontSize: 8.5, fontWeight: 600, color: c.muted, border: `1px solid ${c.border}`, padding: '0 4px', borderRadius: 3 }}>既定</span>}
          </div>
          <div style={{ fontSize: 10.5, color: c.muted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.desc}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={c.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 12px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M3 5l3 3 3-3" /></svg>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {a.prompts.length === 0 ? (
            <div style={{ border: `1px dashed ${c.border}`, borderRadius: 10, padding: '14px', textAlign: 'center', background: c.bg }}>
              <div style={{ fontSize: 11.5, color: c.muted, marginBottom: 10 }}>このエージェントにはまだサンプルがありません。</div>
              <button onClick={() => onPrompt('（自由入力で話しかける）')} style={{ padding: '8px 14px', background: accent, color: c.onAccent || '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>自由入力で話しかける</button>
            </div>
          ) : a.prompts.map((p, i) => (
            <button key={i}
              onMouseDown={() => setPressed(i)}
              onMouseUp={() => setPressed(null)}
              onMouseLeave={() => setPressed(null)}
              onClick={() => onPrompt(p)}
              style={{
                textAlign: 'left', width: '100%', padding: '9px 11px',
                background: pressed === i ? accent : c.card,
                border: `1px solid ${pressed === i ? accent : c.cardBorder}`,
                borderRadius: 10, color: pressed === i ? (c.onAccent || '#fff') : c.text,
                fontSize: 12.5, lineHeight: 1.45, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'flex-start', gap: 9,
                boxShadow: pressed === i ? `0 4px 14px ${accent}40` : 'none',
                transform: pressed === i ? 'scale(0.99)' : 'none',
                transition: 'background .12s, transform .1s, box-shadow .12s, border-color .12s',
              }}>
              <span style={{ width: 18, height: 18, borderRadius: 6, marginTop: 1, flex: '0 0 18px', background: pressed === i ? 'rgba(255,255,255,0.22)' : c.accentSoft, color: pressed === i ? (c.onAccent || '#fff') : accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M2 5h6M5 2l3 3-3 3" /></svg>
              </span>
              <span style={{ flex: 1, textWrap: 'pretty' }}>{p}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── チャットメッセージ ──
function ChatMessage({ m, c, accent }) {
  if (m.role === 'user') {
    return (
      <div className="msg-in" style={{ alignSelf: 'flex-end', maxWidth: '85%', background: accent + '14', border: `1px solid ${accent}40`, padding: '10px 14px', borderRadius: '16px 16px 4px 16px', fontSize: 13, lineHeight: 1.55 }}>{m.text}</div>
    );
  }
  if (m.role === 'tool') {
    return (
      <div className="msg-in" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', maxWidth: '92%' }}>
        <div style={{ flex: '0 0 22px', width: 22, height: 22, borderRadius: '50%', background: accent, marginTop: 1 }} />
        <div style={{ background: c.cardHi, border: `1px solid ${c.cardBorder}`, borderRadius: 10, padding: '8px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 20, height: 20, borderRadius: 6, background: '#fff4c9', color: '#8a6400', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 20px' }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6.5l2.5 2.5L10 3.5" /></svg>
          </span>
          <div style={{ lineHeight: 1.3 }}>
            <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: accent, fontWeight: 600 }}>{m.label}</code>
            <span style={{ color: c.text, fontSize: 12, fontWeight: 500, marginLeft: 6 }}>{m.detail}</span>
          </div>
        </div>
      </div>
    );
  }
  if (m.role === 'assistant') {
    const streaming = m.shown < m.full.length;
    return (
      <div className="msg-in" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', maxWidth: '92%' }}>
        <div style={{ flex: '0 0 22px', width: 22, height: 22, borderRadius: '50%', background: accent, marginTop: 1 }} />
        <div style={{ fontSize: 13, lineHeight: 1.65, color: c.text }}>
          {m.full.slice(0, m.shown)}
          {streaming && <span className="caret" style={{ background: accent }} />}
        </div>
      </div>
    );
  }
  if (m.role === 'result' && m.kind === 'excel') {
    return (
      <div className="msg-in" style={{ marginLeft: 30, maxWidth: '92%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', background: c.card, border: `1px solid ${c.cardBorder}`, borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <span style={{ width: 34, height: 34, borderRadius: 8, background: '#107c41', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 34px', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 700 }}>XLS</span>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
            <div style={{ fontSize: 10.5, color: c.muted }}>{m.meta}</div>
          </div>
          <button style={{ flex: '0 0 auto', padding: '6px 12px', background: accent, color: c.onAccent || '#fff', border: 'none', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>開く</button>
        </div>
      </div>
    );
  }
  if (m.role === 'result' && m.kind === 'code') {
    return (
      <div className="msg-in" style={{ marginLeft: 30, maxWidth: '92%' }}>
        <div style={{ border: `1px solid ${c.cardBorder}`, borderRadius: 12, overflow: 'hidden', background: '#1d2127' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: '#15181d', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, background: '#f0db4f', color: '#1d2127', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: 8, fontWeight: 800, flex: '0 0 16px' }}>JS</span>
            <span style={{ fontSize: 11, color: '#c9cdd4', fontFamily: '"JetBrains Mono", monospace', flex: 1 }}>{m.name}</span>
            <button style={{ fontSize: 10.5, color: '#9aa0aa', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>コピー</button>
          </div>
          <pre style={{ margin: 0, padding: '12px 14px', overflowX: 'auto', fontSize: 11, lineHeight: 1.6, fontFamily: '"JetBrains Mono", monospace', color: '#d6dae0' }}>{m.code}</pre>
        </div>
      </div>
    );
  }
  return null;
}

// ── ユーティリティバー ──
function UtilityBar({ c, accent, onNew, hasChat }) {
  const link = { display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, color: c.muted, borderRadius: 6 };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderTop: `1px solid ${c.border}`, background: c.bg, flex: '0 0 auto', position: 'relative', zIndex: 2 }}>
      <button onClick={onNew} style={{ ...link, color: hasChat ? accent : c.muted, fontWeight: hasChat ? 600 : 400 }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 2.5v7M2.5 6h7" /></svg>
        新しい会話
      </button>
      <div style={{ flex: 1 }} />
      <button style={link} title="過去の会話を開く">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="4.5" /><path d="M6 3.6V6l1.8 1.1" /></svg>
        履歴
      </button>
    </div>
  );
}

// ── Composer (常時表示・自由入力) ──
function Composer({ c, accent, hint, onSend, chat }) {
  const [val, setVal] = React.useState('');
  const submit = () => { if (val.trim()) { onSend(val.trim()); setVal(''); } };
  return (
    <div style={{ padding: '8px 12px 12px', borderTop: `1px solid ${c.border}`, background: c.panel, backdropFilter: 'blur(12px)', flex: '0 0 auto', position: 'relative', zIndex: 3 }}>
      <div style={{ border: `1px solid ${c.border}`, borderRadius: 14, background: c.card, boxShadow: `0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px ${c.accentSoft} inset`, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 14px' }}>
        <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder={hint} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: c.text, fontSize: 13, fontFamily: 'inherit', padding: '5px 0' }} />
        <button title="ファイルを添付" style={{ width: 30, height: 30, border: 'none', background: 'transparent', color: c.muted, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 2.5L4.8 8.2a2.4 2.4 0 003.4 3.4l6.1-6.1a1.6 1.6 0 10-2.3-2.3L6.2 8.9a0.8 0.8 0 101.1 1.1l5-5" /></svg>
        </button>
        <button onClick={submit} title="送信" style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: val.trim() ? accent : c.border, color: val.trim() ? (c.onAccent || '#fff') : c.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h9M7 3l4 4-4 4" /></svg>
        </button>
      </div>
      <div style={{ fontSize: 10, color: c.subtle, marginTop: 6, paddingLeft: 2 }}>Claude Managed Agents</div>
    </div>
  );
}

Object.assign(window, { PresetPrototype });
