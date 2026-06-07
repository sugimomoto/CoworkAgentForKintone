// Customizer wedge — Settings View
// 右側 Artifact ペインを置換する形で開く 2-pane 設定画面。
// admin (=cybozu 共通管理者) だけが触れる。
//
// セクション: 🤖 Agents / 🧠 Skills / 🔌 MCP
// V2: Agents 編集 (skill / tool ON-OFF), MCP 接続
// V3: Custom Agent 新規作成 (system prompt 編集)

// ────────────────────────────────────────────────────────
// Settings shell — Side-by-Side で右に出る
// ────────────────────────────────────────────────────────
function SettingsView({ c, accent, section = 'agents', detail = null, onClose = () => {}, onSection = () => {} }) {
  const navItems = [
    { id: 'agents', label: 'エージェント', icon: 'bot', count: 3 },
    { id: 'skills', label: 'スキル', icon: 'brain', count: 6 },
    { id: 'mcp', label: 'MCP サーバー', icon: 'plug', count: 2 },
  ];

  return (
    <div style={{
      flex: 1, height: '100%', display: 'flex', flexDirection: 'column',
      background: c.bg, color: c.text,
      borderLeft: `1px solid ${c.border}`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 18px', borderBottom: `1px solid ${c.border}`,
        background: c.panel, backdropFilter: 'blur(12px)',
        flex: '0 0 auto',
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: c.accentSoft, color: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <GearIcon />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>設定</div>
          <div style={{ fontSize: 10.5, color: c.muted }}>管理者専用 · 変更は新規セッションから反映</div>
        </div>
        <button title="閉じる" onClick={onClose} style={{
          width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
          background: 'transparent', color: c.muted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CloseIcon />
        </button>
      </div>

      {/* Body: 2 pane (左 nav / 右 detail) */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left nav */}
        <div style={{
          width: 192, flex: '0 0 192px',
          borderRight: `1px solid ${c.border}`,
          padding: '12px 8px',
          display: 'flex', flexDirection: 'column', gap: 2,
          background: c.cardHi,
        }}>
          {navItems.map((n) => {
            const active = n.id === section;
            return (
              <button key={n.id} onClick={() => onSection(n.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 8,
                background: active ? c.card : 'transparent',
                border: active ? `1px solid ${c.border}` : '1px solid transparent',
                color: active ? c.text : c.muted,
                cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: active ? 600 : 500,
                textAlign: 'left',
              }}>
                <NavIcon name={n.icon} active={active} accent={accent} c={c} />
                <span style={{ flex: 1 }}>{n.label}</span>
                <span style={{
                  fontSize: 10, color: c.subtle, fontFamily: '"JetBrains Mono", monospace',
                  fontVariantNumeric: 'tabular-nums',
                }}>{n.count}</span>
              </button>
            );
          })}

          <div style={{ height: 1, background: c.border, margin: '8px 6px 6px' }} />
          <div style={{ padding: '4px 10px', fontSize: 9, fontWeight: 700, letterSpacing: 0.6, color: c.subtle, textTransform: 'uppercase' }}>
            外部接続
          </div>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 10px', borderRadius: 6,
            background: 'transparent', border: '1px solid transparent',
            color: c.subtle, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 11, textAlign: 'left',
          }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h8v6H2zM2 4l4 3 4-3"/></svg>
            <span style={{ flex: 1 }}>Plugin Config →</span>
          </button>
        </div>

        {/* Right detail */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {section === 'agents' && (detail === 'edit'
            ? <AgentDetailPane c={c} accent={accent} />
            : detail === 'create'
              ? <CustomAgentCreatePane c={c} accent={accent} />
              : <AgentsListPane c={c} accent={accent} />)}
          {section === 'skills' && (detail === 'add-file'
            ? <SkillsPane c={c} accent={accent} showAddModal addMode="file" />
            : detail === 'add-uploaded'
              ? <SkillsPane c={c} accent={accent} showAddModal addMode="file-uploaded" />
              : detail === 'add-text'
                ? <SkillsPane c={c} accent={accent} showAddModal addMode="text" />
                : detail === 'add-custom'
                  ? <SkillsPane c={c} accent={accent} showAddModal addMode="file" />
                  : <SkillsPane c={c} accent={accent} />)}
          {section === 'mcp' && (detail === 'add-modal'
            ? <MCPPane c={c} accent={accent} showAddModal />
            : detail === 'tools'
              ? <MCPToolsPane c={c} accent={accent} />
              : <MCPPane c={c} accent={accent} />)}
        </div>
      </div>
    </div>
  );
}

function NavIcon({ name, active, accent, c }) {
  const col = active ? accent : c.muted;
  if (name === 'bot') return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={col} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="10" height="8" rx="2"/><path d="M8 5V2.5M6 8v.5M10 8v.5"/><path d="M2 9h1M13 9h1"/>
    </svg>
  );
  if (name === 'brain') return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3a2.5 2.5 0 00-5 0v7a2.5 2.5 0 005 0M8 3a2.5 2.5 0 015 0v7a2.5 2.5 0 01-5 0"/>
      <path d="M5 6h2M9 6h2M5 9h2M9 9h2"/>
    </svg>
  );
  return ( // plug
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={col} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2v3M10 2v3"/><rect x="4" y="5" width="8" height="4" rx="1"/><path d="M8 9v2a2 2 0 002 2h1"/>
    </svg>
  );
}

// ────────────────────────────────────────────────────────
// Agents 一覧 (V1)
// ────────────────────────────────────────────────────────
function AgentsListPane({ c, accent }) {
  return (
    <div style={panePadding}>
      <PaneHeading title="エージェント" sub="ユーザーが Header から選択できるエージェントの一覧と公開設定" c={c} />

      {/* Built-in */}
      <SectionLabel c={c}>Built-in (Plugin 同梱)</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {BUILTIN_AGENTS.map((a) => (
          <AgentListRow key={a.id} a={a} c={c} accent={accent} />
        ))}
      </div>

      {/* Custom Agents */}
      <SectionLabel c={c}>カスタム エージェント</SectionLabel>
      <div style={{
        border: `1px dashed ${c.border}`, borderRadius: 12,
        padding: '22px 18px', textAlign: 'center', background: c.cardHi,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 12.5, color: c.muted, marginBottom: 8 }}>カスタムエージェントはまだありません</div>
        <button style={primaryBtn(c, accent)}>+ 新規エージェント作成</button>
      </div>
    </div>
  );
}

function AgentListRow({ a, c, accent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      background: c.card,
      border: `1px solid ${c.cardBorder}`, borderRadius: 10,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9,
        background: a.purpose === 'customizer' ? accent : c.accentSoft,
        color: a.purpose === 'customizer' ? (c.onAccent || '#fff') : accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flex: '0 0 36px',
      }}>
        <AgentGlyph kind={a.icon} size={18} color="currentColor" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{a.name}</span>
          <ModelBadge model={a.model} c={c} accent={accent} size="lg" />
          {a.isDefault && (
            <span style={{
              fontSize: 9, fontWeight: 600, letterSpacing: 0.4,
              color: accent, background: c.accentSoft,
              padding: '1px 5px', borderRadius: 3,
            }}>既定</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.4 }}>{a.desc}</div>
        <div style={{ fontSize: 10, color: c.subtle, marginTop: 4, display: 'flex', gap: 10 }}>
          <span>スキル 4</span>
          <span>ツール 12</span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>v_{a.id.slice(0, 4)}_xxx</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PublishToggle on={a.published} c={c} accent={accent} />
        <button style={{
          padding: '6px 10px', borderRadius: 7,
          background: 'transparent', border: `1px solid ${c.border}`,
          color: c.text, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 11.5, fontWeight: 500,
        }}>編集 →</button>
      </div>
    </div>
  );
}

function PublishToggle({ on, c, accent }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }}>
      <span style={{
        width: 30, height: 17, borderRadius: 9, position: 'relative',
        background: on ? accent : c.border, transition: 'background .2s',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 15 : 2,
          width: 13, height: 13, borderRadius: '50%', background: '#fff',
          transition: 'left .15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }} />
      </span>
      <span style={{ fontSize: 10.5, color: on ? c.text : c.muted, fontWeight: 500 }}>
        {on ? '公開' : '非公開'}
      </span>
    </label>
  );
}

// ────────────────────────────────────────────────────────
// Agent 詳細編集 (V2)
// ────────────────────────────────────────────────────────
function AgentDetailPane({ c, accent }) {
  return (
    <div style={panePadding}>
      <Breadcrumb c={c} items={[{ label: 'エージェント' }, { label: 'カスタマイザーエージェント (Opus)' }]} />
      <PaneHeading
        title="カスタマイザーエージェント (Opus)"
        sub="Built-in · 編集はワークスペースに新しいバージョンとして保存されます"
        c={c}
        right={<ModelBadge model="opus" c={c} accent={accent} size="lg" />}
      />

      <SectionCard c={c}>
        <SectionRow c={c} label="名前">
          <input defaultValue="カスタマイザーエージェント" style={inputStyle(c)} />
        </SectionRow>
        <SectionRow c={c} label="アイコン">
          <IconPicker c={c} accent={accent} selectedGlyph="cust" selectedColor={accent} />
        </SectionRow>
        <SectionRow c={c} label="公開">
          <PublishToggle on c={c} accent={accent} />
        </SectionRow>
        <SectionRow c={c} label="モデル" last>
          <select style={inputStyle(c)} defaultValue="opus">
            <option value="opus">Claude Opus 4.7 — 高品質</option>
            <option value="sonnet">Claude Sonnet 4.6 — 速度・低コスト</option>
            <option value="haiku">Claude Haiku 4.5 — 最速・最安</option>
          </select>
        </SectionRow>
      </SectionCard>

      <SectionLabel c={c}>
        説明
        <span style={countTag(c)}>end user の Header プルダウンに表示される一行</span>
      </SectionLabel>
      <SectionCard c={c}>
        <div style={{ padding: '10px 14px' }}>
          <textarea
            defaultValue="JS カスタマイズ / Plugin 開発 — 高品質"
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'none',
              minHeight: 40, padding: '6px 8px',
              background: c.card, color: c.text,
              fontFamily: 'inherit', fontSize: 12, lineHeight: 1.5,
              border: `1px solid ${c.border}`, borderRadius: 7, outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 9.5, color: c.subtle, marginTop: 3, fontFamily: '"JetBrains Mono", monospace' }}>
            18 / 80 文字
          </div>
        </div>
      </SectionCard>

      <SectionLabel c={c}>
        システムプロンプト
        <span style={countTag(c)}>このエージェントのペルソナ / ガードレール</span>
        <span style={{
          marginLeft: 'auto', fontSize: 9.5, fontWeight: 600, letterSpacing: 0.4,
          color: c.muted, background: c.cardHi,
          border: `1px solid ${c.border}`,
          padding: '1px 6px', borderRadius: 3,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="4.5" width="6" height="4.5" rx="1"/><path d="M3.5 4.5V3a1.5 1.5 0 113 0v1.5"/></svg>
          Built-in · Plugin が管理
        </span>
      </SectionLabel>
      <div style={{
        background: c.card, border: `1px solid ${c.cardBorder}`, borderRadius: 10,
        marginBottom: 18, overflow: 'hidden', opacity: 0.95,
      }}>
        <div style={{
          padding: '8px 12px', background: c.cardHi, borderBottom: `1px solid ${c.border}`,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: c.muted,
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 2h8v8H2z"/><path d="M4 5h4M4 7h3"/></svg>
          <span style={{ flex: 1, fontFamily: '"JetBrains Mono", monospace' }}>customizer.system.md</span>
          <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace' }}>1,284 tokens</span>
        </div>
        <pre style={{
          margin: 0, padding: '12px 14px',
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5,
          lineHeight: 1.6, color: c.text,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 200, overflow: 'auto',
        }}>{`あなたは kintone カスタマイズの co-pilot Agent です。

# できること
- JavaScript カスタマイズの新規作成 / 既存改修
- Plugin の設計・実装 (manifest.json / desktop.js / mobile.js)
- kintone REST API / JS API の最適な呼び出しパターン提案
- preview → deploy → rollback の安全な適用フローガイド

# トーン
- 技術者目線の co-pilot として、根拠と代替案を併記する
- "完成しました" と即断せず、影響範囲を必ず提示する

# ガードレール
- 本番アプリへの直接書込前に必ずプレビューを案内する
- 削除系 API は permission_policy=ask で必ず確認する
...`}</pre>
        <div style={{
          padding: '8px 14px', background: c.cardHi, borderTop: `1px solid ${c.border}`,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: c.muted,
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="6" r="4.5"/><path d="M6 3.5v3M6 8h.01"/></svg>
          Built-in の system prompt は次回 Plugin 更新で上書きされます。カスタマイズしたい場合は Custom Agent を新規作成してください。
        </div>
      </div>

      <SectionLabel c={c}>スキル <span style={countTag(c)}>ワークスペース skill を個別に ON/OFF</span></SectionLabel>
      <SectionCard c={c} pad>
        <SkillRow label="kintone-customize-js"      ver="v_a1b_xxx" on c={c} accent={accent} />
        <SkillRow label="kintone-plugin-development" ver="v_c2d_xxx" on c={c} accent={accent} />
        <SkillRow label="kintone-query"             unsynced c={c} accent={accent} />
        <SkillRow label="kintone-error-recovery"    unsynced c={c} accent={accent} />
        <SkillRow label="xlsx"                      ver="anthropic" c={c} accent={accent} />
        <SkillRow label="docx"                      ver="anthropic" c={c} accent={accent} last />
      </SectionCard>

      <SectionLabel c={c}>ツール <span style={countTag(c)}>MCP サーバー / Tool 単位で ON/OFF</span></SectionLabel>
      <SectionCard c={c}>
        <MCPGroup
          label="Agent Toolset (組込)"
          color="#6b7280"
          state="all"
          c={c} accent={accent}
          tools={[
            { name: 'bash', on: true },
            { name: 'read / write / edit', on: true },
            { name: 'glob / grep', on: true },
            { name: 'web_fetch', on: false },
            { name: 'web_search', on: false },
          ]}
        />
        <MCPGroup
          label="Kintone MCP Server"
          color="#0ea5e9"
          state="partial"
          expanded
          c={c} accent={accent}
          groups={[
            { label: '参照系', tools: [
              { name: 'kintone-get-apps', on: true },
              { name: 'kintone-get-app', on: true },
              { name: 'kintone-get-form-fields', on: true },
              { name: 'kintone-get-records', on: true },
            ]},
            { label: '書込系', tools: [
              { name: 'kintone-add-record', on: true },
              { name: 'kintone-add-records', on: true },
              { name: 'kintone-update-record', on: true },
              { name: 'kintone-update-records', on: true },
              { name: 'kintone-delete-records', on: true, ask: true },
            ]},
            { label: '管理系 (#24 完了後)', tools: [
              { name: 'kintone-add-fields', on: false },
              { name: 'kintone-deploy-app', on: false },
            ]},
          ]}
        />
        <MCPGroup
          label="GitHub MCP Server"
          color="#a855f7"
          state="none"
          c={c} accent={accent}
          tools={[]}
          notConnected
        />
        <MCPGroup
          label="Custom Tools (Plugin 内蔵)"
          color={accent}
          state="all" locked
          c={c} accent={accent}
          tools={[
            { name: 'create_artifact', on: true, locked: true },
            { name: 'preview-apply-rollback', on: true, locked: true, customizerOnly: true },
          ]}
        />
      </SectionCard>

      {/* Save bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginTop: 18, padding: '12px 16px', background: c.cardHi,
        border: `1px solid ${c.border}`, borderRadius: 10,
      }}>
        <div style={{ flex: 1, fontSize: 11, color: c.muted }}>
          <strong style={{ color: c.text, fontWeight: 600 }}>未保存の変更:</strong> kintone-deploy-app を ON
        </div>
        <button style={ghostBtn(c)}>破棄</button>
        <button style={primaryBtn(c, accent)}>保存</button>
      </div>
    </div>
  );
}

function SkillRow({ label, ver, on, unsynced, last, c, accent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px',
      borderBottom: last ? 'none' : `1px solid ${c.border}`,
      opacity: unsynced ? 0.55 : 1,
    }}>
      <Checkbox state={on ? 'on' : 'off'} disabled={unsynced} c={c} accent={accent} />
      <span style={{
        flex: 1, fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11.5, color: c.text,
      }}>{label}</span>
      {unsynced
        ? <span style={{ fontSize: 10, color: c.warn || '#b45309', background: c.warnSoft, padding: '1px 6px', borderRadius: 3 }}>未同期</span>
        : <span style={{ fontSize: 10, color: c.subtle, fontFamily: '"JetBrains Mono", monospace' }}>{ver}</span>}
    </div>
  );
}

function Checkbox({ state, disabled, c, accent }) {
  // state: on | off | indeterminate
  const bg = state === 'on' ? accent : state === 'indeterminate' ? accent : c.card;
  const border = state === 'off' ? c.border : accent;
  return (
    <span style={{
      width: 14, height: 14, borderRadius: 3,
      background: bg, border: `1.5px solid ${border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flex: '0 0 14px', opacity: disabled ? 0.4 : 1,
    }}>
      {state === 'on' && (
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke={c.onAccent || '#fff'} strokeWidth="2" strokeLinecap="round"><path d="M1.5 4.5l2 2L7.5 2"/></svg>
      )}
      {state === 'indeterminate' && (
        <span style={{ width: 7, height: 1.6, background: c.onAccent || '#fff' }} />
      )}
    </span>
  );
}

function MCPGroup({ label, color, state, expanded, c, accent, tools = [], groups = null, notConnected, locked }) {
  const cbState = state === 'all' ? 'on' : state === 'partial' ? 'indeterminate' : 'off';
  return (
    <div style={{ borderBottom: `1px solid ${c.border}`, padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={c.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {expanded ? <path d="M3 5l3 3 3-3"/> : <path d="M4.5 3l3 3-3 3"/>}
        </svg>
        <span style={{
          width: 9, height: 9, borderRadius: 2, background: color, flex: '0 0 9px',
        }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: c.text, flex: 1 }}>{label}</span>
        {locked && <span style={{ fontSize: 9, color: c.subtle, fontWeight: 600, letterSpacing: 0.4 }}>固定</span>}
        {notConnected && <span style={{ fontSize: 10, color: c.muted, background: c.cardHi, padding: '1px 6px', borderRadius: 3 }}>未接続</span>}
        <Checkbox state={cbState} disabled={locked || notConnected} c={c} accent={accent} />
      </div>
      {expanded && (
        <div style={{ marginTop: 8, marginLeft: 20 }}>
          {groups ? groups.map((g) => (
            <div key={g.label} style={{ marginBottom: 8 }}>
              <div style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
                color: c.subtle, textTransform: 'uppercase', marginBottom: 4,
              }}>{g.label}</div>
              {g.tools.map((t) => <ToolRow key={t.name} t={t} c={c} accent={accent} />)}
            </div>
          )) : tools.map((t) => <ToolRow key={t.name} t={t} c={c} accent={accent} />)}
        </div>
      )}
    </div>
  );
}

function ToolRow({ t, c, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
      <Checkbox state={t.on ? 'on' : 'off'} disabled={t.locked} c={c} accent={accent} />
      <span style={{ flex: 1, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: c.text }}>
        {t.name}
      </span>
      {t.ask && (
        <span title="実行前に承認" style={{
          fontSize: 9, color: '#b45309', background: '#fef3c7',
          padding: '1px 5px', borderRadius: 3, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 1l4 8H1z"/><path d="M5 4v2M5 7h.01"/></svg>
          ask
        </span>
      )}
      {t.customizerOnly && (
        <span style={{ fontSize: 9, color: c.subtle, fontWeight: 500 }}>Customizer のみ</span>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Skills (V1)
// ────────────────────────────────────────────────────────
function SkillsPane({ c, accent, showAddModal, addMode = 'file' }) {
  return (
    <div style={{ ...panePadding, position: 'relative' }}>
      <PaneHeading title="スキル" sub="ワークスペースにアップロードされた SKILL.md の一覧と同期" c={c} />

      {/* 同梱 skill */}
      <SectionLabel c={c}>
        Plugin 同梱
        <span style={countTag(c)}>2 件 · 自動更新</span>
      </SectionLabel>
      <SectionCard c={c}>
        <PluginSkillRow name="kintone-customize-js"      ver="v_a1b_xxx" date="2026-05-12 同期" c={c} accent={accent} />
        <PluginSkillRow name="kintone-plugin-development" ver="v_c2d_xxx" date="2026-05-12 同期" c={c} accent={accent} last />
      </SectionCard>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: c.cardHi, border: `1px solid ${c.border}`, borderRadius: 10,
        padding: '10px 14px', marginBottom: 22,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.text, marginBottom: 2 }}>Plugin バージョン v0.4.1</div>
          <div style={{ fontSize: 10.5, color: c.muted }}>新しい同梱 skill があれば再同期で更新されます</div>
        </div>
        <button style={primaryBtn(c, accent)}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: -1 }}><path d="M2 6a4 4 0 017-2.5M10 6a4 4 0 01-7 2.5M9 1v3h-3M3 11V8h3"/></svg>
          同期
        </button>
      </div>

      {/* Custom skills */}
      <SectionLabel c={c}>
        カスタム スキル
        <span style={countTag(c)}>0 件</span>
      </SectionLabel>
      <div style={{
        border: `1px dashed ${c.border}`, borderRadius: 12,
        padding: '20px 18px', textAlign: 'center', background: c.cardHi,
        marginBottom: 22,
      }}>
        <div style={{ fontSize: 12.5, color: c.muted, marginBottom: 4 }}>独自の SKILL.md を Anthropic にアップロード</div>
        <div style={{ fontSize: 10.5, color: c.subtle, marginBottom: 10 }}>自社規約 / 命名規則 / 特殊シナリオなど</div>
        <button style={primaryBtn(c, accent)}>+ カスタムスキル追加</button>
      </div>

      {/* Workspace 全体 */}
      <SectionLabel c={c}>
        ワークスペース 全 スキル
        <span style={countTag(c)}>Anthropic から取得</span>
      </SectionLabel>
      <SectionCard c={c}>
        <WorkspaceSkillRow name="kintone-customize-js"      source="custom"     used={2} c={c} accent={accent} />
        <WorkspaceSkillRow name="kintone-plugin-development" source="custom"     used={2} c={c} accent={accent} />
        <WorkspaceSkillRow name="xlsx"                      source="anthropic" used={1} c={c} accent={accent} />
        <WorkspaceSkillRow name="docx"                      source="anthropic" used={1} c={c} accent={accent} />
        <WorkspaceSkillRow name="pdf"                       source="anthropic" used={1} c={c} accent={accent} />
        <WorkspaceSkillRow name="pptx"                      source="anthropic" used={1} c={c} accent={accent} last />
      </SectionCard>

      {showAddModal && <SkillAddModal c={c} accent={accent} mode={addMode} />}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// カスタムスキル追加モーダル
// ────────────────────────────────────────────────────────
function SkillAddModal({ c, accent, mode = 'file' }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(20, 14, 5, 0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30,
      padding: 24, boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%', maxWidth: 540,
        background: c.card, borderRadius: 14,
        border: `1px solid ${c.border}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${c.border}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: c.accentSoft, color: accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3a2.5 2.5 0 00-5 0v7a2.5 2.5 0 005 0M8 3a2.5 2.5 0 015 0v7a2.5 2.5 0 01-5 0"/><path d="M5 6h2M9 6h2M5 9h2M9 9h2"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>カスタムスキルを追加</div>
            <div style={{ fontSize: 11, color: c.muted }}>SKILL.md または ZIP をアップロード / 直接入力</div>
          </div>
          <button title="閉じる" style={{
            width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
            background: 'transparent', color: c.muted,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><CloseIcon /></button>
        </div>

        {/* Tab toggle: ファイル / 直接入力 */}
        <div style={{
          display: 'flex', gap: 4, padding: '10px 20px 0',
          borderBottom: `1px solid ${c.border}`,
        }}>
          <TabPill active={mode === 'file' || mode === 'file-uploaded'} c={c} accent={accent}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
              <path d="M7 9V2M4 5l3-3 3 3"/><path d="M2 10v2h10v-2"/>
            </svg>
            ファイル
          </TabPill>
          <TabPill active={mode === 'text'} c={c} accent={accent}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
              <path d="M3 3h8v8H3z"/><path d="M5 6h4M5 8h3"/>
            </svg>
            直接入力
          </TabPill>
        </div>

        {/* Form */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
          {mode === 'file' && <SkillFileDropzone c={c} accent={accent} />}
          {mode === 'file-uploaded' && <SkillFileUploaded c={c} accent={accent} />}
          {mode === 'text' && <SkillTextEntry c={c} accent={accent} />}

          <div style={{
            display: 'flex', gap: 10, padding: '10px 12px',
            background: c.cardHi, border: `1px dashed ${c.border}`, borderRadius: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={c.muted} strokeWidth="1.5" style={{ flex: '0 0 14px', marginTop: 1 }}>
              <circle cx="7" cy="7" r="5.5"/><path d="M7 4v3.5M7 9.5h.01"/>
            </svg>
            <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.55 }}>
              アップロード後、<strong style={{ color: c.text }}>エージェント編集画面</strong>でこのスキルを ON にすると Agent が利用できます。
              Anthropic 側ではワークスペース共通として保存されます。
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: `1px solid ${c.border}`,
          background: c.cardHi, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ flex: 1, fontSize: 11, color: c.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
            {(mode === 'file-uploaded' || mode === 'text') && (
              <>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 6.5l2 2L9 4"/></svg>
                <span>バリデーション OK</span>
              </>
            )}
            {mode === 'file' && <span>ファイルを選択してください</span>}
          </div>
          <button style={ghostBtn(c)}>キャンセル</button>
          <button style={{
            ...primaryBtn(c, accent),
            opacity: mode === 'file' ? 0.5 : 1,
            cursor: mode === 'file' ? 'not-allowed' : 'pointer',
          }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: -1 }}>
              <path d="M6 9V2M3.5 4.5L6 2l2.5 2.5"/><path d="M2 9v1h8V9"/>
            </svg>
            Anthropic にアップロード
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ children, label, hint, c, right }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: c.text }}>{label}</span>
        {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
      </div>
      {children}
      {hint && <div style={{ fontSize: 10.5, color: c.muted, marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

// ─── Tab pill (ファイル / 直接入力) ───
function TabPill({ active, children, c, accent }) {
  return (
    <button style={{
      padding: '8px 14px',
      background: 'transparent',
      border: 'none', borderBottom: `2px solid ${active ? accent : 'transparent'}`,
      color: active ? c.text : c.muted,
      cursor: 'pointer', fontFamily: 'inherit',
      fontSize: 12, fontWeight: active ? 600 : 500,
      marginBottom: -1,
      display: 'inline-flex', alignItems: 'center',
    }}>{children}</button>
  );
}

// ─── ファイルアップロード · ドロップゾーン (empty state) ───
function SkillFileDropzone({ c, accent }) {
  return (
    <div style={{
      border: `2px dashed ${c.border}`, borderRadius: 12,
      background: c.cardHi, padding: '32px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      textAlign: 'center',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: c.accentSoft, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 19V5M8 11l6-6 6 6"/><path d="M4 19v3h20v-3"/>
        </svg>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: c.text }}>
        ファイルをドロップ <span style={{ color: c.muted, fontWeight: 400 }}>または</span>
      </div>
      <button style={{
        padding: '8px 16px', borderRadius: 8,
        background: accent, color: c.onAccent || '#fff', border: 'none',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 9v2h10V9M7 2v8M4 5l3-3 3 3"/>
        </svg>
        ファイルを選択
      </button>
      <div style={{ fontSize: 10.5, color: c.subtle, marginTop: 4, lineHeight: 1.5 }}>
        <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>SKILL.md</span> / <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>.md</span> / <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>.zip</span> (skill bundle)<br />
        最大 8 MB · name / description は frontmatter から自動抽出
      </div>
    </div>
  );
}

// ─── ファイルアップロード · プレビュー (uploaded state) ───
function SkillFileUploaded({ c, accent }) {
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: c.card, border: `1px solid ${accent}55`, borderRadius: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: c.accentSoft, color: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 800,
          flex: '0 0 36px',
        }}>md</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: c.text, fontFamily: '"JetBrains Mono", monospace' }}>
            my-org-coding-style.md
          </div>
          <div style={{ fontSize: 10.5, color: c.muted, display: 'flex', gap: 8, marginTop: 2 }}>
            <span>1.2 KB</span>
            <span>·</span>
            <span style={{ color: '#047857', display: 'flex', alignItems: 'center', gap: 3 }}>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1.5 5l2 2L8.5 2"/></svg>
              バリデーション通過
            </span>
          </div>
        </div>
        <button title="差し替え" style={ghostBtn(c)}>差し替え</button>
        <button title="削除" style={{
          width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
          background: 'transparent', color: c.subtle,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 5h8M5 5V3.5h4V5M4 5l.5 7h5l.5-7"/></svg>
        </button>
      </div>

      <FormField label="スキル名" hint="frontmatter から自動抽出 (編集可)" c={c}>
        <input
          defaultValue="my-org-coding-style"
          style={{
            ...inputStyle(c), width: '100%', boxSizing: 'border-box',
            fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
          }}
        />
      </FormField>

      <FormField label="説明" hint="frontmatter から自動抽出 (編集可)" c={c}>
        <input
          defaultValue="自社の TypeScript 命名規則とコーディング規約を適用したい時に使用"
          style={{ ...inputStyle(c), width: '100%', boxSizing: 'border-box' }}
        />
      </FormField>

      <FormField
        label="プレビュー"
        hint="アップロード前に内容を確認"
        c={c}
        right={<span style={{ fontSize: 9.5, color: c.subtle, fontFamily: '"JetBrains Mono", monospace' }}>1,243 文字</span>}
      >
        <div style={{
          border: `1px solid ${c.border}`, borderRadius: 8,
          background: c.cardHi, overflow: 'hidden',
          maxHeight: 200, overflowY: 'auto',
        }}>
          <pre style={{
            margin: 0, padding: '10px 14px',
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
            lineHeight: 1.55, color: c.text,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>{`---
name: my-org-coding-style
description: 自社の TypeScript 命名規則とコーディング規約を適用したい時に使用
---

# 自社 TypeScript コーディング規約

## 命名規則
- 変数: camelCase
- 型: PascalCase + suffix \`T\`
- 定数: SCREAMING_SNAKE_CASE
- ファイル名: kebab-case.ts
...`}</pre>
        </div>
      </FormField>
    </>
  );
}

// ─── 直接入力 (manual paste) ───
function SkillTextEntry({ c, accent }) {
  return (
    <>
      <FormField label="スキル名" hint="kebab-case / 半角英数のみ / 重複不可" c={c}>
        <input
          placeholder="my-org-coding-style"
          style={{
            ...inputStyle(c), width: '100%', boxSizing: 'border-box',
            fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
          }}
        />
      </FormField>

      <FormField label="説明" hint="Agent がいつこの skill をロードすべきかを示す一行" c={c}>
        <input
          placeholder="自社の TypeScript 命名規則とコーディング規約を適用したい時に使用"
          style={{ ...inputStyle(c), width: '100%', boxSizing: 'border-box' }}
        />
      </FormField>

      <FormField
        label="SKILL.md"
        hint="Markdown 本文。最大 8,000 文字 / 推奨 ~1,500 文字"
        c={c}
        right={<span style={{ fontSize: 9.5, color: c.subtle, fontFamily: '"JetBrains Mono", monospace' }}>1,243 / 8,000 文字</span>}
      >
        <div style={{
          border: `1px solid ${c.border}`, borderRadius: 8, overflow: 'hidden',
          background: c.card,
        }}>
          <div style={{
            padding: '6px 10px', background: c.cardHi, borderBottom: `1px solid ${c.border}`,
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: c.muted,
          }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 2h8v8H2z"/><path d="M4 5h4M4 7h3"/></svg>
            <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>SKILL.md</span>
          </div>
          <textarea
            defaultValue={`---
name: my-org-coding-style
description: 自社の TypeScript 命名規則とコーディング規約を適用したい時に使用
---

# 自社 TypeScript コーディング規約

## 命名規則
- 変数: camelCase
- 型: PascalCase + suffix \`T\` を付ける (例: \`UserT\`)
- 定数: SCREAMING_SNAKE_CASE
- ファイル名: kebab-case.ts

## kintone カスタマイズ固有
- イベント関数は \`onXxx\` で命名
- API 呼び出しは util/kintone-client.ts 経由
- never use kintone.api.url() / kintone.api.urlForGet()`}
            style={{
              width: '100%', boxSizing: 'border-box',
              resize: 'vertical', minHeight: 200,
              padding: '10px 12px', border: 'none', outline: 'none',
              background: c.card, color: c.text,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5,
              lineHeight: 1.6,
            }}
          />
        </div>
      </FormField>
    </>
  );
}

function PluginSkillRow({ name, ver, date, last, c, accent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px',
      borderBottom: last ? 'none' : `1px solid ${c.border}`,
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 6,
        background: c.accentSoft, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flex: '0 0 22px',
      }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6a4 4 0 008 0 4 4 0 00-8 0"/><path d="M4.5 6l1 1 2-2"/></svg>
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, fontWeight: 500, color: c.text }}>{name}</div>
        <div style={{ fontSize: 10, color: c.subtle, fontFamily: '"JetBrains Mono", monospace' }}>{ver} · {date}</div>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 0.4,
        color: '#047857', background: '#d1fae5',
        padding: '2px 7px', borderRadius: 3,
      }}>同期済</span>
    </div>
  );
}

function WorkspaceSkillRow({ name, source, used, last, c, accent }) {
  const isCustom = source === 'custom';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px',
      borderBottom: last ? 'none' : `1px solid ${c.border}`,
    }}>
      <span style={{ flex: 1, fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, color: c.text }}>{name}</span>
      <span style={{
        fontSize: 9.5, fontWeight: 600, letterSpacing: 0.4,
        color: isCustom ? accent : c.subtle,
        background: isCustom ? c.accentSoft : c.cardHi,
        padding: '1px 6px', borderRadius: 3,
      }}>{isCustom ? 'custom' : 'anthropic'}</span>
      <span style={{ fontSize: 10.5, color: c.muted }}>{used} エージェント使用中</span>
      <button title="削除" style={{
        width: 22, height: 22, borderRadius: 5, border: 'none',
        background: 'transparent', color: c.subtle, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 4h8M4.5 4V2.5h3V4M3 4l.5 6.5h5L9 4"/></svg>
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// MCP Servers (V2)
// ────────────────────────────────────────────────────────
function MCPPane({ c, accent, showAddModal }) {
  return (
    <div style={{ ...panePadding, position: 'relative' }}>
      <PaneHeading
        title="MCP サーバー"
        sub="エージェントが呼べる外部ツール群の接続管理"
        c={c}
      />

      <SectionLabel c={c}>
        Built-in
        <span style={countTag(c)}>Plugin 標準</span>
      </SectionLabel>
      <SectionCard c={c}>
        <MCPRow
          name="kintone" url="${workerUrl}/mcp/kintone"
          status="connected" user="admin@example.com" toolCount={11} builtin
          color="#0ea5e9" c={c} accent={accent} last
        />
      </SectionCard>

      <SectionLabel c={c}>
        追加 MCP サーバー
        <span style={countTag(c)}>Plugin Config Step 4 で登録</span>
      </SectionLabel>
      <SectionCard c={c}>
        <MCPRow
          name="GitHub" url="https://api.github.com/mcp"
          status="not-connected" toolCount={0}
          color="#24292e" c={c} accent={accent}
        />
        <MCPRow
          name="Slack" url="https://slack.com/api/mcp"
          status="connected" user="admin@example.com" toolCount={18}
          color="#611f69" c={c} accent={accent} last
        />
      </SectionCard>

      <div style={{
        background: c.cardHi, border: `1px solid ${c.border}`, borderRadius: 10,
        padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
        marginBottom: 18,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={c.muted} strokeWidth="1.5" style={{ flex: '0 0 14px', marginTop: 1 }}>
          <circle cx="7" cy="7" r="5.5"/><path d="M7 4v3.5M7 9.5h.01"/>
        </svg>
        <div style={{ flex: 1, fontSize: 11.5, color: c.muted, lineHeight: 1.55 }}>
          新しい MCP サーバーを追加するには：<br />
          <strong style={{ color: c.text }}>1.</strong> kintone 管理画面の Plugin Config → Step 4 で接続情報を登録 →
          <strong style={{ color: c.text }}> 2.</strong> ここで「接続」ボタンを押す
          → <strong style={{ color: c.text }}>3.</strong> エージェント編集画面で Tool を選んで紐付け
        </div>
      </div>

      {showAddModal && <MCPAddInstruction c={c} accent={accent} />}
    </div>
  );
}

function MCPRow({ name, url, status, user, toolCount, builtin, color, c, accent, last }) {
  const connected = status === 'connected';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${c.border}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 7,
        background: color + '22', color: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 13,
        flex: '0 0 32px',
      }}>
        {name.charAt(0)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: c.text }}>{name}</span>
          {builtin && <span style={{ fontSize: 9, color: c.subtle, fontWeight: 600, letterSpacing: 0.4 }}>BUILT-IN</span>}
        </div>
        <div style={{ fontSize: 10.5, color: c.muted, fontFamily: '"JetBrains Mono", monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{url}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {connected ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
              <span style={{ fontSize: 11, color: c.text, fontWeight: 500 }}>接続済</span>
            </div>
            <div style={{ fontSize: 10, color: c.muted, marginTop: 1 }}>{user} · Tools {toolCount}</div>
          </>
        ) : (
          <span style={{ fontSize: 11, color: c.subtle, fontWeight: 500 }}>未接続</span>
        )}
      </div>
      {connected ? (
        <>
          <button style={ghostBtn(c)}>Tools</button>
          <button style={dangerGhostBtn(c)}>切断</button>
        </>
      ) : (
        <button style={primaryBtn(c, accent)}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ marginRight: 4, verticalAlign: -1 }}><path d="M3.5 6h5M6 3.5l2.5 2.5L6 8.5"/></svg>
          接続
        </button>
      )}
    </div>
  );
}

function MCPAddInstruction({ c, accent }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(20, 14, 5, 0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30,
    }}>
      <div style={{
        width: 420, background: c.card, borderRadius: 14,
        border: `1px solid ${c.border}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${c.border}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: c.accentSoft, color: accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2v3M10 2v3"/><rect x="4" y="5" width="8" height="4" rx="1"/><path d="M8 9v2a2 2 0 002 2h1"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>新しい MCP サーバーを追加</div>
            <div style={{ fontSize: 11, color: c.muted }}>3 ステップで完了します</div>
          </div>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <StepLine n={1} title="Plugin Config で接続情報を登録" sub="Name / URL / OAuth client_id / client_secret" current c={c} accent={accent} />
          <StepLine n={2} title="OAuth 認可" sub="ポップアップで認可 → access_token を Anthropic Vault に保管" c={c} accent={accent} />
          <StepLine n={3} title="エージェントに紐付け" sub="エージェント編集画面で Tool を ON にする" c={c} accent={accent} last />
        </div>
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${c.border}`, background: c.cardHi, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button style={ghostBtn(c)}>あとで</button>
          <button style={primaryBtn(c, accent)}>Plugin Config を開く →</button>
        </div>
      </div>
    </div>
  );
}

function StepLine({ n, title, sub, current, last, c, accent }) {
  return (
    <div style={{ display: 'flex', gap: 12, paddingBottom: last ? 0 : 14 }}>
      <div style={{ position: 'relative', flex: '0 0 24px' }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: current ? accent : c.cardHi,
          color: current ? (c.onAccent || '#fff') : c.muted,
          border: current ? 'none' : `1px solid ${c.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
        }}>{n}</div>
        {!last && <div style={{ position: 'absolute', left: 11, top: 26, bottom: -2, width: 2, background: c.border }} />}
      </div>
      <div style={{ flex: 1, paddingTop: 2 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: c.text }}>{title}</div>
        <div style={{ fontSize: 11, color: c.muted, marginTop: 2, lineHeight: 1.45 }}>{sub}</div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Custom Agent 新規作成 (V3)
// ────────────────────────────────────────────────────────
function CustomAgentCreatePane({ c, accent }) {
  return (
    <div style={panePadding}>
      <Breadcrumb c={c} items={[{ label: 'エージェント' }, { label: '新規作成' }]} />
      <PaneHeading
        title="新しいエージェント"
        sub="ペルソナを絞った専用エージェントを作成"
        c={c}
      />

      <SectionLabel c={c}>基本情報</SectionLabel>
      <SectionCard c={c}>
        <SectionRow c={c} label="名前">
          <input placeholder="営業 Agent" style={inputStyle(c)} />
        </SectionRow>
        <SectionRow c={c} label="アイコン" sub="glyph と背景色を選択">
          <IconPicker c={c} accent={accent} selectedGlyph="biz" selectedColor="#0d9488" expanded />
        </SectionRow>
        <SectionRow c={c} label="モデル" last>
          <select style={inputStyle(c)} defaultValue="sonnet">
            <option value="opus">Claude Opus 4.7 — 高品質</option>
            <option value="sonnet">Claude Sonnet 4.6 — バランス</option>
            <option value="haiku">Claude Haiku 4.5 — 最速・最安</option>
          </select>
        </SectionRow>
      </SectionCard>

      <SectionLabel c={c}>
        システムプロンプト
        <span style={countTag(c)}>このエージェントのペルソナ / ガードレール</span>
      </SectionLabel>
      <div style={{
        background: c.card, border: `1px solid ${c.cardBorder}`, borderRadius: 10,
        marginBottom: 22, overflow: 'hidden',
      }}>
        <div style={{
          padding: '8px 12px', background: c.cardHi, borderBottom: `1px solid ${c.border}`,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: c.muted,
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 2h8v8H2z"/><path d="M4 5h4M4 7h3"/></svg>
          <span style={{ flex: 1, fontFamily: '"JetBrains Mono", monospace' }}>system.md</span>
          <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace' }}>342 / 8000 文字</span>
        </div>
        <textarea
          defaultValue={`あなたは営業部の業務サポート Agent です。

# できること
- 案件管理アプリでのレコード検索 / 集計
- 月次レポート (xlsx, pdf) の生成
- 商談メモの自動要約

# トーン
- 親しみやすく簡潔に
- 専門用語は使わず、業務担当者目線で説明する

# ガードレール
- レコード削除を提案しない (admin 経由のみ)
- 顧客個人情報を出力に含めない`}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical',
            minHeight: 200, padding: '12px 14px',
            background: c.card, color: c.text,
            fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5,
            lineHeight: 1.6, border: 'none', outline: 'none',
          }}
        />
      </div>

      <SectionLabel c={c}>スキル <span style={countTag(c)}>ワークスペースから選択</span></SectionLabel>
      <SectionCard c={c} pad>
        <SkillRow label="kintone-customize-js"      ver="v_a1b_xxx" c={c} accent={accent} />
        <SkillRow label="kintone-plugin-development" ver="v_c2d_xxx" c={c} accent={accent} />
        <SkillRow label="xlsx"                      ver="anthropic" on c={c} accent={accent} />
        <SkillRow label="docx"                      ver="anthropic" on c={c} accent={accent} />
        <SkillRow label="pdf"                       ver="anthropic" c={c} accent={accent} last />
      </SectionCard>

      <SectionLabel c={c}>ツール</SectionLabel>
      <SectionCard c={c}>
        <MCPGroup label="Agent Toolset (組込)" color="#6b7280" state="partial" c={c} accent={accent} tools={[]} />
        <MCPGroup label="Kintone MCP Server" color="#0ea5e9" state="all" c={c} accent={accent} tools={[]} />
        <MCPGroup label="GitHub MCP Server" color="#a855f7" state="none" c={c} accent={accent} tools={[]} notConnected />
      </SectionCard>

      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8,
        marginTop: 18,
      }}>
        <button style={ghostBtn(c)}>キャンセル</button>
        <button style={primaryBtn(c, accent)}>エージェントを作成</button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 共通プリミティブ
// ────────────────────────────────────────────────────────
const panePadding = { padding: '22px 26px 36px' };

function PaneHeading({ title, sub, c, right }) {
  return (
    <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: c.text, letterSpacing: -0.3 }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: c.muted, marginTop: 4 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function Breadcrumb({ items, c }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, fontSize: 11, color: c.muted }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ opacity: 0.5 }}>›</span>}
          <span style={{ color: i === items.length - 1 ? c.text : c.muted, fontWeight: i === items.length - 1 ? 500 : 400 }}>{it.label}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function SectionLabel({ children, c }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
      color: c.muted, textTransform: 'uppercase',
      margin: '0 0 9px 2px',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {children}
    </div>
  );
}

function SectionCard({ children, c, pad }) {
  return (
    <div style={{
      background: c.card, border: `1px solid ${c.cardBorder}`, borderRadius: 12,
      marginBottom: 18, overflow: 'hidden',
      padding: pad ? '4px 0' : 0,
    }}>
      {children}
    </div>
  );
}

function SectionRow({ children, c, label, sub, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '11px 16px',
      borderBottom: last ? 'none' : `1px solid ${c.border}`,
    }}>
      <div style={{ flex: '0 0 130px' }}>
        <div style={{ fontSize: 12, color: c.text, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 10.5, color: c.muted, marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{children}</div>
    </div>
  );
}

function inputStyle(c) {
  return {
    background: c.card, color: c.text, border: `1px solid ${c.border}`,
    borderRadius: 7, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit',
    outline: 'none', minWidth: 180,
  };
}

function primaryBtn(c, accent) {
  return {
    padding: '7px 14px', borderRadius: 7,
    background: accent, color: c.onAccent || '#fff', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center',
  };
}

function ghostBtn(c) {
  return {
    padding: '7px 12px', borderRadius: 7,
    background: 'transparent', color: c.text, border: `1px solid ${c.border}`,
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
  };
}

function dangerGhostBtn(c) {
  return {
    padding: '7px 12px', borderRadius: 7,
    background: 'transparent', color: '#b45309', border: `1px solid ${c.border}`,
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
  };
}

function countTag(c) {
  return {
    fontSize: 9, color: c.subtle, fontWeight: 500,
    textTransform: 'none', letterSpacing: 0,
    fontStyle: 'normal',
  };
}

// ────────────────────────────────────────────────────────
// IconPicker — glyph (8 種) × color (8 種) のマトリクス
// ────────────────────────────────────────────────────────
const ICON_GLYPHS = [
  { id: 'biz',    label: '業務' },
  { id: 'cust',   label: '開発' },
  { id: 'chart',  label: '分析' },
  { id: 'mail',   label: 'メール' },
  { id: 'cal',    label: '予定' },
  { id: 'cog',    label: '運用' },
  { id: 'spark',  label: 'AI' },
  { id: 'doc',    label: '文書' },
];

const ICON_COLORS = [
  '#0d9488', '#0ea5e9', '#a855f7', '#ec4899',
  '#f59e0b', '#22c55e', '#ef4444', '#231200',
];

function ExtendedAgentGlyph({ kind, size, color }) {
  // biz / cust は既存の AgentGlyph を利用
  if (kind === 'biz' || kind === 'cust') return <AgentGlyph kind={kind} size={size} color={color} />;
  const props = { width: size, height: size, viewBox: '0 0 20 20', fill: 'none', stroke: color, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'chart') return (
    <svg {...props}><path d="M3 17V8M8 17V4M13 17v-6"/><path d="M2 17h15"/></svg>
  );
  if (kind === 'mail') return (
    <svg {...props}><rect x="2.5" y="5" width="15" height="10" rx="1.5"/><path d="M3 6l7 5 7-5"/></svg>
  );
  if (kind === 'cal') return (
    <svg {...props}><rect x="3" y="4.5" width="14" height="12.5" rx="1.5"/><path d="M3 8h14M7 3v3M13 3v3"/></svg>
  );
  if (kind === 'cog') return (
    <svg {...props}><circle cx="10" cy="10" r="2.6"/><path d="M10 2v2M10 16v2M18 10h-2M4 10H2M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4M15.7 15.7l-1.4-1.4M5.7 5.7L4.3 4.3"/></svg>
  );
  if (kind === 'spark') return (
    <svg {...props}><path d="M10 3v2.5M10 14.5V17M3 10h2.5M14.5 10H17M4.6 4.6l1.8 1.8M13.6 13.6l1.8 1.8M4.6 15.4l1.8-1.8M13.6 6.4l1.8-1.8"/><circle cx="10" cy="10" r="2.4"/></svg>
  );
  // doc
  return (
    <svg {...props}><path d="M5 2h7l3 3v13H5z"/><path d="M12 2v3h3M7 9h6M7 12h6M7 15h4"/></svg>
  );
}

function IconPicker({ c, accent, selectedGlyph = 'biz', selectedColor = '#0d9488', expanded }) {
  const G = expanded ? ICON_GLYPHS : ICON_GLYPHS.slice(0, 6);
  const C = expanded ? ICON_COLORS : ICON_COLORS.slice(0, 6);
  return (
    <div style={{
      display: 'flex', gap: 14, alignItems: 'center',
      width: expanded ? '100%' : 'auto', justifyContent: expanded ? 'flex-end' : 'flex-end',
    }}>
      {/* live preview (large) */}
      <div style={{
        width: 44, height: 44, borderRadius: 11,
        background: selectedColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flex: '0 0 44px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <ExtendedAgentGlyph kind={selectedGlyph} size={22} color="#fff" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
        {/* glyph row */}
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 0.4, color: c.subtle, textTransform: 'uppercase', marginBottom: 3 }}>Glyph</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {G.map((g) => (
              <div key={g.id} title={g.label} style={{
                width: 24, height: 24, borderRadius: 6,
                background: g.id === selectedGlyph ? c.text : c.cardHi,
                color: g.id === selectedGlyph ? (c.bg) : c.muted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                border: `1px solid ${g.id === selectedGlyph ? c.text : c.border}`,
              }}>
                <ExtendedAgentGlyph kind={g.id} size={13} color="currentColor" />
              </div>
            ))}
          </div>
        </div>
        {/* color row */}
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 0.4, color: c.subtle, textTransform: 'uppercase', marginBottom: 3 }}>Color</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {C.map((col) => (
              <div key={col} style={{
                width: 22, height: 22, borderRadius: '50%',
                background: col, cursor: 'pointer',
                border: col === selectedColor ? `2px solid ${c.text}` : `2px solid transparent`,
                boxSizing: 'border-box',
              }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// MCP Tools 詳細 (Tools クリック時)
// ────────────────────────────────────────────────────────
function MCPToolsPane({ c, accent }) {
  // MCP server から返るのは name + description + ask 程度。カテゴリ情報は持たない。
  const tools = [
    { name: 'kintone-get-apps',         desc: 'ワークスペースの全アプリ一覧を取得',                ask: false, usedBy: 2 },
    { name: 'kintone-get-app',          desc: 'アプリ単体の基本情報を取得',                          ask: false, usedBy: 2 },
    { name: 'kintone-get-form-fields',  desc: 'アプリのフィールド定義を取得',                        ask: false, usedBy: 3 },
    { name: 'kintone-get-records',      desc: 'クエリでレコード一覧を取得 (最大 500)',               ask: false, usedBy: 3 },
    { name: 'kintone-get-record',       desc: 'レコード ID 単体取得',                                ask: false, usedBy: 2 },
    { name: 'kintone-add-record',       desc: 'レコードを 1 件追加',                                 ask: false, usedBy: 2 },
    { name: 'kintone-add-records',      desc: 'レコードをバルクで追加 (最大 100)',                    ask: true,  usedBy: 1 },
    { name: 'kintone-update-record',    desc: 'レコードを 1 件更新',                                 ask: false, usedBy: 2 },
    { name: 'kintone-update-records',   desc: 'レコードをバルクで更新',                              ask: true,  usedBy: 1 },
    { name: 'kintone-add-record-comment', desc: 'レコードにコメント追加',                            ask: false, usedBy: 2 },
    { name: 'kintone-delete-records',   desc: 'レコードを物理削除',                                  ask: true,  usedBy: 1 },
    { name: 'kintone-upload-file',      desc: '添付ファイルをアップロード',                          ask: false, usedBy: 2 },
    { name: 'kintone-download-file',    desc: 'ファイルキーから DL',                                 ask: false, usedBy: 2 },
  ];

  return (
    <div style={panePadding}>
      <Breadcrumb c={c} items={[{ label: 'MCP サーバー' }, { label: 'kintone' }, { label: 'Tools' }]} />

      {/* Header: server identity */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: '#0ea5e922', color: '#0ea5e9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 17,
          flex: '0 0 44px',
        }}>k</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: c.text, letterSpacing: -0.3 }}>kintone</span>
            <span style={{ fontSize: 9, color: c.subtle, fontWeight: 600, letterSpacing: 0.4 }}>BUILT-IN</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10.5, color: c.text, marginLeft: 8,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
              接続済 · admin@example.com
            </span>
          </div>
          <div style={{ fontSize: 11, color: c.muted, fontFamily: '"JetBrains Mono", monospace', marginTop: 3 }}>
            ${'{'}workerUrl{'}'}/mcp/kintone
          </div>
        </div>
        <button style={ghostBtn(c)}>tools/list 再取得</button>
      </div>

      {/* Tool count summary */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 16,
        background: c.card, border: `1px solid ${c.cardBorder}`,
        borderRadius: 10, overflow: 'hidden',
      }}>
        {[
          { label: '合計 Tools', value: tools.length, color: accent },
          { label: '実行前承認', value: tools.filter(t => t.ask).length, color: '#b45309' },
          { label: 'エージェント使用中', value: 3, color: c.muted },
        ].map((stat, i) => (
          <div key={i} style={{
            flex: 1, padding: '10px 14px',
            borderLeft: i > 0 ? `1px solid ${c.border}` : 'none',
          }}>
            <div style={{ fontSize: 10, color: c.muted, fontWeight: 500, letterSpacing: 0.3, textTransform: 'uppercase' }}>{stat.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: stat.color, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Search + sort */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke={c.muted} strokeWidth="1.6" style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          }}><circle cx="6" cy="6" r="4"/><path d="M9 9l3 3"/></svg>
          <input placeholder="ツール名 / 説明で検索…" style={{
            width: '100%', boxSizing: 'border-box',
            padding: '7px 12px 7px 30px',
            background: c.card, color: c.text, border: `1px solid ${c.border}`,
            borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none',
          }} />
        </div>
        <select style={{ ...inputStyle(c), minWidth: 0 }} defaultValue="name">
          <option value="name">名前順</option>
          <option value="usage">使用頻度順</option>
          <option value="ask">要承認を上に</option>
        </select>
      </div>

      <div style={{ fontSize: 10, color: c.subtle, marginBottom: 6, paddingLeft: 4 }}>
        {tools.length} ツール · MCP サーバーから tools/list で取得
      </div>

      {/* Tool list — flat */}
      <div style={{
        background: c.card, border: `1px solid ${c.cardBorder}`, borderRadius: 10,
        overflow: 'hidden',
      }}>
        {tools.map((t, i) => (
          <div key={t.name} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px',
            borderBottom: i < tools.length - 1 ? `1px solid ${c.border}` : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <code style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5,
                  color: c.text, fontWeight: 600,
                }}>{t.name}</code>
                {t.ask && (
                  <span style={{
                    fontSize: 9, color: '#b45309', background: '#fef3c7',
                    padding: '1px 5px', borderRadius: 3, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 1l4 8H1z"/></svg>
                    ask
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{t.desc}</div>
            </div>
            <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
              <div style={{ fontSize: 10.5, color: c.text }}>{t.usedBy} エージェント</div>
              <div style={{ fontSize: 9.5, color: c.subtle }}>使用中</div>
            </div>
            <button title="承認ポリシーを編集" style={{
              width: 26, height: 26, borderRadius: 6, border: 'none',
              background: 'transparent', color: c.subtle, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flex: '0 0 26px',
            }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="1.2"/><circle cx="7" cy="2.6" r="1.2"/><circle cx="7" cy="11.4" r="1.2"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  SettingsView, AgentsListPane, AgentDetailPane, SkillsPane, MCPPane, CustomAgentCreatePane,
  MCPToolsPane, IconPicker, ExtendedAgentGlyph,
});
