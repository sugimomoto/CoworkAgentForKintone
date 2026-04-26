// 認証種別に応じたツールの除外フィルタ。kintone 公式 MCP の tool-filters.ts を踏襲。
//
// kintone API は API トークン認証では "アプリ一覧取得" などが利用不可なため、
// 該当ツールを `tools/list` レスポンスから除外する。

export interface FilterCondition {
  /** API トークン認証で動作中なら true (Basic 認証なら false) */
  isApiTokenAuth: boolean;
}

interface FilterRule {
  predicate: (cond: FilterCondition) => boolean;
  excludeTools: string[];
}

const RULES: FilterRule[] = [
  {
    predicate: (cond) => cond.isApiTokenAuth,
    excludeTools: ['kintone-get-apps'],
    // 将来の書込ツール (kintone-add-app) を追加した時点でここにも入れる
  },
];

export function shouldEnableTool(toolName: string, cond: FilterCondition): boolean {
  for (const rule of RULES) {
    if (rule.predicate(cond) && rule.excludeTools.includes(toolName)) return false;
  }
  return true;
}
