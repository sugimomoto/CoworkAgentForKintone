// ─────────────────────────────────────────────────────────────
// preset-agents.jsx
// プリセットエージェント一覧（空状態ランディング）の共通基盤:
//   - カラートークン (variant-rich の light と同一語彙)
//   - エージェントカタログ (Phase 1 = 3個 / Scale = 10個)
//   - アイコングリフ (schema の iconKind を網羅)
//   - 共通クローム (Header / UtilityBar / Composer)
//   - プロンプト系プリミティブ
// 4案レイアウトは preset-layouts.jsx 側で組み立てる。
// ─────────────────────────────────────────────────────────────

function pIsLight(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 170;
}

function presetColors(accent) {
  return {
    bg: '#faf8f3', panel: 'rgba(255,255,255,0.85)', border: 'rgba(35,18,0,0.10)',
    text: '#231200', muted: '#6b5f4a', subtle: '#a89d85',
    card: '#ffffff', cardBorder: 'rgba(35,18,0,0.08)',
    cardHi: 'rgba(255,191,0,0.06)', accent, accentSoft: accent + '1a',
    onAccent: pIsLight(accent) ? '#231200' : '#fff',
  };
}

// 抑えた青系 / サンドベージュ系 — トーン参考に合わせた低彩度の小パレット
const PRESET_TINTS = {
  teal:    { fg: '#0d9488', soft: 'rgba(13,148,136,0.10)' },
  blue:    { fg: '#2563eb', soft: 'rgba(37,99,235,0.10)' },
  emerald: { fg: '#059669', soft: 'rgba(5,150,105,0.10)' },
  sand:    { fg: '#b45309', soft: 'rgba(180,83,9,0.10)' },
};

// ─────────────────────────────────────────────────────────────
// エージェントカタログ
// ─────────────────────────────────────────────────────────────
const CUSTOMIZER_PROMPTS = [
  '特定フィールドが空のとき保存できないようにする JS を作って',
  '一覧画面でステータスフィールドの色分けをする JS を作って',
  '保存時に別アプリのマスタを参照して値を自動入力する JS を作って',
  'フォーム読込時にカスタムボタンを追加して特定 URL を新規タブで開く JS を作って',
  '現在のアプリの fields 定義からサンプルレコード生成 JS を作って',
];

// Phase 1 — 公開設定 (visibility=public) の 3 エージェント
const PRESET_AGENTS = [
  {
    id: 'biz', purpose: 'default', name: '業務エージェント', model: 'opus',
    desc: 'レコード操作・集計・ドキュメント生成', icon: 'biz', tint: 'teal',
    prompts: [
      'kintone アプリ一覧を見せて',
      '先週追加された案件レコードを集計して',
      '未対応の問い合わせを一覧化して、優先度を提案して',
      '今月の売上をアプリから取得して、グラフ付きの Excel レポートにまとめて',
      '議事録の PDF からタスクを抽出して、タスク管理アプリに登録案を作って',
    ],
  },
  {
    id: 'cust-opus', purpose: 'customizer', name: 'カスタマイザー', model: 'opus',
    desc: 'JS カスタマイズ・Plugin 開発（高品質）', icon: 'cust', tint: 'blue', isDefault: true,
    prompts: CUSTOMIZER_PROMPTS,
  },
  {
    id: 'cust-sonnet', purpose: 'customizer', name: 'カスタマイザー', model: 'sonnet',
    desc: 'JS カスタマイズ・Plugin 開発（高速・低コスト）', icon: 'cust', tint: 'blue',
    prompts: CUSTOMIZER_PROMPTS,
  },
];

// Scale — #46 マーケットプレイス後を想定した 10 エージェント
const PRESET_AGENTS_10 = [
  ...PRESET_AGENTS,
  { id: 'analytics', purpose: 'default', name: '営業分析エージェント', model: 'sonnet', desc: 'KPI 集計・ダッシュボード生成', icon: 'analytics', tint: 'blue',
    prompts: ['今月の受注をKPIダッシュボードにまとめて', '担当者別の達成率を可視化して'] },
  { id: 'doc', purpose: 'default', name: 'ドキュメント作成', model: 'sonnet', desc: '議事録・報告書の自動作成', icon: 'doc', tint: 'sand',
    prompts: ['今週の活動履歴から週報を作って', '商談メモを議事録に整形して'] },
  { id: 'mail', purpose: 'default', name: 'メール下書き', model: 'sonnet', desc: '顧客メール・通知文の作成', icon: 'mail', tint: 'emerald',
    prompts: ['失注した顧客へのフォローメールを書いて', '見積もり送付の案内文を作って'] },
  { id: 'ops', purpose: 'default', name: '受発注オペレーション', model: 'sonnet', desc: '在庫・発注レコードの整理', icon: 'ops', tint: 'teal',
    prompts: ['在庫が閾値を下回った品目を一覧化して', '今週の発注予定をまとめて'] },
  { id: 'calendar', purpose: 'default', name: 'スケジュール調整', model: 'sonnet', desc: '予定の集約・リマインド', icon: 'calendar', tint: 'blue',
    prompts: ['今週の訪問予定を一覧にして', '期限切れのタスクをリマインドして'] },
  { id: 'knowledge', purpose: 'default', name: 'ナレッジ検索', model: 'sonnet', desc: '社内ドキュメントの横断検索', icon: 'ai', tint: 'emerald',
    prompts: ['提案書テンプレートの最新版を探して', '値引き規程について教えて'] },
  { id: 'integration', purpose: 'customizer', name: 'データ連携', model: 'opus', desc: 'API・ETL の自動化 JS', icon: 'dev', tint: 'sand',
    prompts: ['別アプリへ夜間バッチで同期する JS を作って', 'Webhook で外部通知する JS を作って'] },
];

// ─────────────────────────────────────────────────────────────
// アイコングリフ — schema の iconKind を網羅 (16〜34px)
// ─────────────────────────────────────────────────────────────
function PresetGlyph({ kind, size = 16, color = 'currentColor' }) {
  const sw = 1.7;
  const common = { width: size, height: size, viewBox: '0 0 20 20', fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (kind) {
    case 'cust':
    case 'dev':
      return (
        <svg {...common}>
          <path d="M7 3c-1.5 0-2 1-2 2v3c0 1-.7 2-2 2 1.3 0 2 1 2 2v3c0 1 .5 2 2 2" />
          <path d="M13 3c1.5 0 2 1 2 2v3c0 1 .7 2 2 2-1.3 0-2 1-2 2v3c0 1-.5 2-2 2" />
        </svg>
      );
    case 'analytics':
      return (
        <svg {...common}>
          <path d="M3 17V3" /><path d="M3 17h14" />
          <rect x="6" y="11" width="2.6" height="4" rx="0.4" />
          <rect x="10.5" y="8" width="2.6" height="7" rx="0.4" />
          <rect x="15" y="5" width="2.6" height="10" rx="0.4" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="14" height="10" rx="2" />
          <path d="M3.5 6l6.5 5 6.5-5" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="13" height="12" rx="2" />
          <path d="M3.5 8h13M7 3v3M13 3v3" />
        </svg>
      );
    case 'ops':
      return (
        <svg {...common}>
          <path d="M10 3l6 3.3v7L10 17l-6-3.7v-7L10 3z" />
          <path d="M4 6.5l6 3.3 6-3.3M10 9.8V17" />
        </svg>
      );
    case 'ai':
      return (
        <svg {...common}>
          <path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6L10 3z" />
        </svg>
      );
    case 'doc':
      return (
        <svg {...common}>
          <path d="M5 3h6l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
          <path d="M11 3v4h4M7 11h6M7 14h4" />
        </svg>
      );
    case 'biz':
    default:
      return (
        <svg {...common}>
          <rect x="5" y="3" width="10" height="14" rx="2" />
          <path d="M8 3v-1h4v1" />
          <path d="M7.5 10l2 2 3.5-3.5" />
        </svg>
      );
  }
}

// エージェント → アイコンチップの色 (purpose と tint で決定)
function agentChipStyle(a, c, accent) {
  if (a.purpose === 'customizer') {
    return { bg: accent, fg: c.onAccent || '#fff' };
  }
  const t = PRESET_TINTS[a.tint] || PRESET_TINTS.teal;
  return { bg: t.soft, fg: t.fg };
}

// ─────────────────────────────────────────────────────────────
// 共通クローム
// ─────────────────────────────────────────────────────────────
function brandShell(c) {
  return {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 14px', borderBottom: `1px solid ${c.border}`,
    background: c.panel, backdropFilter: 'blur(12px)',
    position: 'relative', zIndex: 3, flex: '0 0 auto',
  };
}

// 空状態のヘッダー。picker:
//   'none'    — リスト自体がピッカーなのでブランドのみ (推奨)
//   'idle'    — 「エージェント未選択」の控えめ pill (役割整理の比較用)
//   <agent>   — 選択後 (チャット遷移後) の表示
function PresetHeader({ c, accent, picker = 'none', agent = null, title = 'Cowork Agent' }) {
  return (
    <div style={brandShell(c)}>
      <div style={{ position: 'relative', flex: '0 0 auto' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, background: accent,
          color: c.onAccent || '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, fontWeight: 800, letterSpacing: -0.5,
        }}>CA</div>
        <span style={{
          position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%',
          background: '#22c55e', border: `2px solid ${c.bg}`,
        }} />
      </div>

      {agent ? (
        // 選択後 — ヘッダーに現在のエージェントを表示 (ピッカーが意味を持つ)
        <button style={{
          display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0,
          background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          color: c.text, textAlign: 'left', padding: 0,
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.name}</span>
          <ModelBadge model={agent.model} c={c} accent={accent} />
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={c.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5l3 3 3-3" /></svg>
        </button>
      ) : (
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text, letterSpacing: -0.2, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
            <span style={{ fontSize: 9, color: accent, background: c.accentSoft, padding: '1px 5px', borderRadius: 3, fontWeight: 600, flex: '0 0 auto' }}>for kintone</span>
          </div>
        </div>
      )}

      {picker === 'idle' && (
        <button style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px 4px 6px',
          borderRadius: 999, border: `1px dashed ${c.border}`, background: 'transparent',
          color: c.subtle, fontFamily: 'inherit', fontSize: 10.5, cursor: 'pointer', height: 24, flex: '0 0 auto',
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 5l3 3 3-3" /></svg>
          未選択
        </button>
      )}

      <HeaderIconBtn c={c} title="設定" highlight><GearIcon /></HeaderIconBtn>
      <HeaderIconBtn c={c} title="閉じる"><CloseIcon /></HeaderIconBtn>
    </div>
  );
}

// 細い会話ユーティリティバー — 履歴/新規会話 (既存ユーザー向けの逃げ道)
function PresetUtilityBar({ c, accent }) {
  const link = {
    display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px',
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 11, color: c.muted, borderRadius: 6,
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '5px 10px', borderTop: `1px solid ${c.border}`,
      background: c.bg, flex: '0 0 auto', position: 'relative', zIndex: 2,
    }}>
      <button style={{ ...link, color: accent, fontWeight: 600 }}>
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

// 常時表示の自由入力 Composer (プロンプトを書ける層を排除しない)
function PresetComposer({ c, accent, hint }) {
  return (
    <div style={{
      padding: '8px 12px 12px', borderTop: `1px solid ${c.border}`,
      background: c.panel, backdropFilter: 'blur(12px)', position: 'relative', zIndex: 3, flex: '0 0 auto',
    }}>
      <div style={{
        border: `1px solid ${c.border}`, borderRadius: 14, background: c.card,
        boxShadow: `0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px ${c.accentSoft} inset`,
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 14px',
      }}>
        <input
          placeholder={hint || 'または、自由に入力して相談…'}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: c.text, fontSize: 13, fontFamily: 'inherit', padding: '5px 0' }}
        />
        <button style={{ width: 30, height: 30, border: 'none', background: 'transparent', color: c.muted, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="ファイルを添付">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 2.5L4.8 8.2a2.4 2.4 0 003.4 3.4l6.1-6.1a1.6 1.6 0 10-2.3-2.3L6.2 8.9a0.8 0.8 0 101.1 1.1l5-5" /></svg>
        </button>
        <button style={{
          width: 32, height: 32, borderRadius: 10, border: 'none',
          background: c.border, color: c.muted, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} title="送信">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h9M7 3l4 4-4 4" /></svg>
        </button>
      </div>
      <div style={{ fontSize: 10, color: c.subtle, marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 }}>
        <span>Claude Managed Agents</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// プロンプト系プリミティブ
// ─────────────────────────────────────────────────────────────
// 縦リスト用のプロンプトボタン
function PromptListButton({ text, c, accent, pressed = false }) {
  return (
    <button style={{
      textAlign: 'left', width: '100%', padding: '9px 11px',
      background: pressed ? accent : c.card,
      border: `1px solid ${pressed ? accent : c.cardBorder}`,
      borderRadius: 10, color: pressed ? (c.onAccent || '#fff') : c.text,
      fontSize: 12.5, lineHeight: 1.45, cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', alignItems: 'flex-start', gap: 9,
      boxShadow: pressed ? `0 4px 14px ${accent}40` : 'none',
      transform: pressed ? 'scale(0.99)' : 'none',
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: 6, marginTop: 1, flex: '0 0 18px',
        background: pressed ? 'rgba(255,255,255,0.22)' : c.accentSoft,
        color: pressed ? (c.onAccent || '#fff') : accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M2 5h6M5 2l3 3-3 3" /></svg>
      </span>
      <span style={{ flex: 1, textWrap: 'pretty' }}>{text}</span>
    </button>
  );
}

// 2列グリッド用のコンパクトなプロンプトカード
function PromptGridCard({ text, c, accent }) {
  return (
    <button style={{
      textAlign: 'left', padding: '10px 11px', background: c.card,
      border: `1px solid ${c.cardBorder}`, borderRadius: 10, color: c.text,
      fontSize: 11.5, lineHeight: 1.4, cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', flexDirection: 'column', gap: 7, minHeight: 62,
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: 6, background: c.accentSoft, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 18px',
      }}>
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M2 5h6M5 2l3 3-3 3" /></svg>
      </span>
      <span style={{ textWrap: 'pretty' }}>{text}</span>
    </button>
  );
}

// 横スクロール用のチップ (長文は省略)
function PromptChip({ text, c, accent }) {
  return (
    <button style={{
      flex: '0 0 auto', maxWidth: 210, padding: '7px 12px', background: c.card,
      border: `1px solid ${c.cardBorder}`, borderRadius: 999, color: c.text,
      fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', gap: 6,
      whiteSpace: 'nowrap', overflow: 'hidden',
    }}>
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke={accent} strokeWidth="1.7" strokeLinecap="round" style={{ flex: '0 0 9px' }}><path d="M2 5h6M5 2l3 3-3 3" /></svg>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
    </button>
  );
}

Object.assign(window, {
  pIsLight, presetColors, PRESET_TINTS,
  PRESET_AGENTS, PRESET_AGENTS_10, CUSTOMIZER_PROMPTS,
  PresetGlyph, agentChipStyle,
  PresetHeader, PresetUtilityBar, PresetComposer,
  PromptListButton, PromptGridCard, PromptChip,
});
