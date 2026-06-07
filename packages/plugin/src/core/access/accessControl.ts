// ─────────────────────────────────────────────────────────────
// accessControl.ts — 公開先 (ACL) のデータモデル / サマリヘルパー
//
// エージェントは 3 つの並列な配列を持つ。すべて kintone の code(ID) を保持する。
//   - allowedUsers:          ユーザーコード   (例: 'sato')
//   - allowedGroups:         グループコード   (例: 'sales-dept')
//   - allowedOrganizations:  組織コード       (例: 'org-tokyo-sales')
//
// 結合ロジック:
//   3 配列すべて空           → 全員に公開
//   いずれかに値あり         → OR 結合 (どれかに該当すれば利用可)
// ─────────────────────────────────────────────────────────────

export type AccessAxisKind = 'user' | 'group' | 'org';

/** ピッカーが扱う正規化済みディレクトリ項目。
 *  kintone の user / group / organization を共通形に寄せる。
 *  meta は候補行の 2 段目 (所属 / 件数 / 階層パス) に出す任意の補助文字列。 */
export interface AccessEntry {
  code: string;
  name: string;
  meta?: string;
}

export interface AccessValue {
  allowedUsers: string[];
  allowedGroups: string[];
  allowedOrganizations: string[];
}

/** 各軸の検索関数。debounce 済みクエリを受け取り候補を返す (最大 10 件想定)。
 *  exclude には既に選択済みの code[] が渡るので、候補から除外して返すこと。 */
export type AccessSearchFn = (
  query: string,
  opts: { exclude: string[] }
) => Promise<AccessEntry[]>;

export const EMPTY_ACCESS: AccessValue = {
  allowedUsers: [],
  allowedGroups: [],
  allowedOrganizations: [],
};

/**
 * `AgentRecord` / `AgentEditDraft` などの「3 軸 ACL 配列を持つオブジェクト」から
 * `AccessValue` (= 可変 string[][3]) を抽出する。`readonly` を剥がすため shallow copy する。
 */
export function accessValueOf(src: {
  allowedUsers: readonly string[];
  allowedGroups: readonly string[];
  allowedOrganizations: readonly string[];
}): AccessValue {
  return {
    allowedUsers: [...src.allowedUsers],
    allowedGroups: [...src.allowedGroups],
    allowedOrganizations: [...src.allowedOrganizations],
  };
}

export interface AccessCounts {
  u: number;
  g: number;
  o: number;
  total: number;
  isOpen: boolean;
}

export function accessCounts(v: AccessValue): AccessCounts {
  const u = v.allowedUsers?.length ?? 0;
  const g = v.allowedGroups?.length ?? 0;
  const o = v.allowedOrganizations?.length ?? 0;
  const total = u + g + o;
  return { u, g, o, total, isOpen: total === 0 };
}

/** ユーザーの表示ラベル。kintone ではログイン名 = メールアドレスなので
 *  code(ログイン名=メアド) を括弧付きで添えて「名前（メアド）」として出す。 */
export const userLabel = (e: AccessEntry): string =>
  e?.code ? `${e.name}（${e.code}）` : e?.name ?? '';

// ── AgentsListPane 用サマリ ───────────────────────────────────
// フォーマット案 1 (推奨): 最大軸 + 余りを +N。狭い列でも 1 行に収まる。
//   全員 / 5人 / 5人 +2 / 2グループ +1
export function formatAccessSummary(v: AccessValue): string {
  const { u, g, o, total, isOpen } = accessCounts(v);
  if (isOpen) return '全員';
  const parts = [
    { unit: '人', n: u, ord: 0 },
    { unit: 'グループ', n: g, ord: 1 },
    { unit: '組織', n: o, ord: 2 },
  ]
    .filter((p) => p.n > 0)
    .sort((a, b) => b.n - a.n || a.ord - b.ord);
  const primary = parts[0];
  if (!primary) return '全員'; // 理論上 isOpen=true で先行返却されるが型ガード
  const rest = total - primary.n;
  return rest > 0 ? `${primary.n}${primary.unit} +${rest}` : `${primary.n}${primary.unit}`;
}

// フォーマット案 2: 全軸を併記。列幅に余裕がある / 折返し可のとき。
//   全員に公開 / 5人・2グループ・1組織
export function formatAccessFull(v: AccessValue): string {
  const { u, g, o, isOpen } = accessCounts(v);
  if (isOpen) return '全員に公開';
  return [u && `${u}人`, g && `${g}グループ`, o && `${o}組織`]
    .filter(Boolean)
    .join('・');
}

