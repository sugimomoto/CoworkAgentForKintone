// ─────────────────────────────────────────────────────────────
// access-data.jsx — 公開先 (ACL) ピッカーの土台
//   - 配色トークン (richColors light / 既存 Settings と同じ暖色ペーパー)
//   - kintone ディレクトリのモックデータ (users / groups / organizations)
//   - incremental search のモック非同期 API (debounce 前提・遅延・エラー注入)
//   - formatAccessSummary 系ヘルパー (AgentsListPane 用サマリ 3 フォーマット)
//   - 小アイコン / 共通プリミティブ
// すべて window にエクスポートして他 babel script から参照する。
// ─────────────────────────────────────────────────────────────

// ── 配色 (既存 Settings = richColors light をそのまま採用) ──
const AC = {
  bg: '#faf8f3',
  panel: 'rgba(255,255,255,0.85)',
  border: 'rgba(35,18,0,0.10)',
  borderStrong: 'rgba(35,18,0,0.18)',
  text: '#231200',
  muted: '#6b5f4a',
  subtle: '#a89d85',
  card: '#ffffff',
  cardBorder: 'rgba(35,18,0,0.08)',
  cardHi: 'rgba(255,191,0,0.06)',
  accent: '#0d9488',
  accentSoft: 'rgba(13,148,136,0.10)',
  accentSofter: 'rgba(13,148,136,0.06)',
  onAccent: '#ffffff',
  warn: '#b45309',
  warnSoft: '#fef3c7',
  // 軸ごとのアイデンティティ色 (彩度を抑えた業務トーン)
  axisUser: '#0d9488',   // teal  = accent
  axisGroup: '#7c6aa8',  // muted violet
  axisOrg: '#2f6f9f',    // muted blue
};

const MONO = '"JetBrains Mono", ui-monospace, monospace';

// ── 軸メタ ──
const AXES = [
  { key: 'allowedUsers',         kind: 'user',  label: 'ユーザー', unit: '人',       color: AC.axisUser,  ph: '名前 / ログイン名で検索' },
  { key: 'allowedGroups',        kind: 'group', label: 'グループ', unit: 'グループ', color: AC.axisGroup, ph: 'グループ名で検索' },
  { key: 'allowedOrganizations', kind: 'org',   label: '組織',     unit: '組織',     color: AC.axisOrg,   ph: '組織名で検索' },
];
const AXIS_BY_KIND = Object.fromEntries(AXES.map((a) => [a.kind, a]));

// ── アイコン ──
function UserIcon({ size = 14, color = 'currentColor', sw = 1.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="5" r="2.6" /><path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" />
    </svg>
  );
}
function GroupIcon({ size = 14, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 16" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="5" r="2.3" /><path d="M2 13c0-2.2 2-3.4 4.5-3.4S11 10.8 11 13" />
      <path d="M12 4.2A2.2 2.2 0 0114.5 7M13 9.8c1.7.2 3 1.3 3 3.2" />
    </svg>
  );
}
function OrgIcon({ size = 14, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v3M3.5 13.5V8.5h9v5M8 5v2.5M3.5 8.5h9" />
      <rect x="2" y="13.5" width="3" height="1" rx=".3" /><rect x="11" y="13.5" width="3" height="1" rx=".3" /><rect x="6.5" y="13.5" width="3" height="1" rx=".3" />
    </svg>
  );
}
function GlobeIcon({ size = 16, color = 'currentColor', sw = 1.55 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="6.5" /><path d="M2.5 9h13M9 2.5c2 2 2 11 0 13M9 2.5c-2 2-2 11 0 13" />
    </svg>
  );
}
function AxisIcon({ kind, size, color, sw }) {
  if (kind === 'user') return <UserIcon size={size} color={color} sw={sw} />;
  if (kind === 'group') return <GroupIcon size={size} color={color} sw={sw} />;
  return <OrgIcon size={size} color={color} sw={sw} />;
}
function SearchIcon({ size = 14, color = AC.subtle }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
      <circle cx="6" cy="6" r="4" /><path d="M9.2 9.2L12 12" />
    </svg>
  );
}
function Spinner({ size = 14, color = AC.accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="ac-spin">
      <circle cx="8" cy="8" r="6" stroke={AC.border} strokeWidth="2" />
      <path d="M8 2a6 6 0 016 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function CloseX({ size = 11, color = 'currentColor', sw = 1.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round">
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
  );
}
function AlertIcon({ size = 14, color = AC.warn }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1.5l5.5 9.5h-11z" /><path d="M7 5.5v2.5M7 9.6h.01" />
    </svg>
  );
}
function CheckIcon({ size = 12, color = AC.onAccent, sw = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6.2l2.2 2.3L9.5 3.5" />
    </svg>
  );
}

// ── kintone ディレクトリ (モック) ──
// kintone の users/groups/orgs は code(ID) + name(表示名) を持つ。
// kintone ではログイン名 = メールアドレス。code にメアドを保持し、表示は「名前（メアド）」。
const DIR_USERS = [
  { code: 'sato@example.co.jp',      name: '佐藤 健',    org: '東京営業部' },
  { code: 'tanaka@example.co.jp',    name: '田中 美咲',  org: '東京営業部' },
  { code: 'suzuki@example.co.jp',    name: '鈴木 大輔',  org: '大阪営業部' },
  { code: 'takahashi@example.co.jp', name: '高橋 由紀',  org: '東京営業部' },
  { code: 'watanabe@example.co.jp',  name: '渡辺 翔',    org: 'CS 本部' },
  { code: 'ito@example.co.jp',       name: '伊藤 彩',    org: 'CS 本部' },
  { code: 'yamamoto@example.co.jp',  name: '山本 直樹',  org: '開発本部' },
  { code: 'nakamura@example.co.jp',  name: '中村 優子',  org: '経理部' },
  { code: 'kobayashi@example.co.jp', name: '小林 拓海',  org: '開発本部' },
  { code: 'kato@example.co.jp',      name: '加藤 さくら', org: '人事部' },
  { code: 'yoshida@example.co.jp',   name: '吉田 蓮',    org: '大阪営業部' },
  { code: 'yamada@example.co.jp',    name: '山田 花子',  org: '東京営業部' },
  { code: 'sasaki@example.co.jp',    name: '佐々木 涼',  org: '情報システム部' },
  { code: 'matsumoto@example.co.jp', name: '松本 結衣',  org: '情報システム部' },
];
const DIR_GROUPS = [
  { code: 'sales-dept',      name: '営業部',             members: 24 },
  { code: 'sales-1',         name: '営業1部',            members: 11 },
  { code: 'managers',        name: 'マネージャー',        members: 8 },
  { code: 'it-support',      name: '情シス担当',          members: 5 },
  { code: 'keiri',           name: '経理担当',            members: 6 },
  { code: 'customer-success', name: 'カスタマーサクセス',  members: 9 },
  { code: 'dev-team',        name: '開発チーム',          members: 14 },
];
const DIR_ORGS = [
  { code: 'org-tokyo-sales', name: '東京営業部',     path: '営業統括 / 東京営業部',     members: 18 },
  { code: 'org-osaka-sales', name: '大阪営業部',     path: '営業統括 / 大阪営業部',     members: 12 },
  { code: 'org-accounting',  name: '経理部',         path: '管理本部 / 経理部',         members: 7 },
  { code: 'org-hr',          name: '人事部',         path: '管理本部 / 人事部',         members: 6 },
  { code: 'org-dev',         name: '開発本部',       path: '開発本部',                 members: 26 },
  { code: 'org-cs',          name: 'CS 本部',        path: 'CS 本部',                  members: 15 },
  { code: 'org-it',          name: '情報システム部', path: '管理本部 / 情報システム部', members: 4 },
];
const DIR = { user: DIR_USERS, group: DIR_GROUPS, org: DIR_ORGS };

// code → entry の解決 (チップ表示で name を引くため)
function resolveEntry(kind, code) {
  const hit = DIR[kind].find((e) => e.code === code);
  return hit || { code, name: code, _missing: true };
}

// ── モック非同期 search (debounce は呼び出し側で 300ms 想定) ──
// __ACCESS_FORCE_ERROR を true にすると reject → エラー UI を確認できる
window.__ACCESS_FORCE_ERROR = false;
function mockSearch(kind, query, { exclude = [] } = {}) {
  return new Promise((resolve, reject) => {
    const latency = 240 + Math.random() * 260;
    setTimeout(() => {
      if (window.__ACCESS_FORCE_ERROR) {
        reject(new Error('kintone API error'));
        return;
      }
      const q = (query || '').trim().toLowerCase();
      const pool = DIR[kind];
      const matched = pool.filter((e) => {
        const inName = e.name.toLowerCase().includes(q);
        const inCode = e.code.toLowerCase().includes(q);
        return q === '' ? true : inName || inCode;
      });
      // 既に選択済みは候補から除外 (重複防止) — exclude は code[]
      const filtered = matched.filter((e) => !exclude.includes(e.code));
      resolve(filtered.slice(0, 10));
    }, latency);
  });
}
const searchUsers = (q, opt) => mockSearch('user', q, opt);
const searchGroups = (q, opt) => mockSearch('group', q, opt);
const searchOrganizations = (q, opt) => mockSearch('org', q, opt);

// ── サマリ計算 ──
function accessCounts(v) {
  const u = (v.allowedUsers || []).length;
  const g = (v.allowedGroups || []).length;
  const o = (v.allowedOrganizations || []).length;
  const total = u + g + o;
  return { u, g, o, total, isOpen: total === 0 };
}

// AgentsListPane サマリ — フォーマット案 1 (推奨): 最大軸 + 余りを +N
//   全員 / 5人 / 5人 +2 / 2グループ +1
function formatAccessSummary(v) {
  const { u, g, o, total, isOpen } = accessCounts(v);
  if (isOpen) return '全員';
  const parts = [
    { unit: '人', n: u, ord: 0 },
    { unit: 'グループ', n: g, ord: 1 },
    { unit: '組織', n: o, ord: 2 },
  ].filter((p) => p.n > 0).sort((a, b) => (b.n - a.n) || (a.ord - b.ord));
  const primary = parts[0];
  const rest = total - primary.n;
  return rest > 0 ? `${primary.n}${primary.unit} +${rest}` : `${primary.n}${primary.unit}`;
}

// フォーマット案 2: 全軸を併記 (・区切り) — 折返し前提
function formatAccessFull(v) {
  const { u, g, o, isOpen } = accessCounts(v);
  if (isOpen) return '全員に公開';
  const segs = [];
  if (u) segs.push(`${u}人`);
  if (g) segs.push(`${g}グループ`);
  if (o) segs.push(`${o}組織`);
  return segs.join('・');
}

// フォーマット案 3: アイコン + 数字の配列 (チップ描画用)
function accessSummaryParts(v) {
  const { u, g, o, isOpen } = accessCounts(v);
  if (isOpen) return { isOpen: true, parts: [] };
  const parts = [];
  if (u) parts.push({ kind: 'user', n: u, color: AC.axisUser });
  if (g) parts.push({ kind: 'group', n: g, color: AC.axisGroup });
  if (o) parts.push({ kind: 'org', n: o, color: AC.axisOrg });
  return { isOpen: false, parts };
}

// 名前から initial を生成 (姓の頭文字)
function initialOf(name) {
  const ch = (name || '?').trim()[0] || '?';
  return ch;
}

// ユーザー表示ラベル: 名前（メールアドレス=ログイン名）
function userLabel(entry) {
  if (!entry) return '';
  return entry.code ? `${entry.name}（${entry.code}）` : entry.name;
}

Object.assign(window, {
  AC, MONO, AXES, AXIS_BY_KIND, DIR, DIR_USERS, DIR_GROUPS, DIR_ORGS,
  resolveEntry, searchUsers, searchGroups, searchOrganizations,
  UserIcon, GroupIcon, OrgIcon, GlobeIcon, AxisIcon, SearchIcon, Spinner, CloseX, AlertIcon, CheckIcon,
  accessCounts, formatAccessSummary, formatAccessFull, accessSummaryParts, initialOf, userLabel,
});
