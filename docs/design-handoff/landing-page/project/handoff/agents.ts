// ─────────────────────────────────────────────────────────────
// agents.ts — プリセットエージェントのカタログと型定義
// 既存スキーマ (iconKind / iconColor / visibility) に準拠。
// 実際の値は admin 設定 API から取得して同じ型に詰める想定。
// ─────────────────────────────────────────────────────────────

export type IconKind =
  | 'biz' | 'cust' | 'dev' | 'analytics'
  | 'mail' | 'calendar' | 'ops' | 'ai' | 'doc';

export type IconColor =
  | 'accent' | 'accentSoft' | 'teal' | 'blue' | 'emerald' | 'sand';

export type AgentModel = 'opus' | 'sonnet';

export type AgentPurpose = 'default' | 'customizer';

export interface PresetAgent {
  id: string;
  name: string;
  desc: string;                 // 1 行・20〜35 文字
  model: AgentModel;
  purpose: AgentPurpose;
  iconKind: IconKind;
  iconColor: IconColor;
  visibility: 'public' | 'private';
  isDefault?: boolean;          // 一覧で初期展開するエージェント
  prompts: string[];            // サンプルプロンプト 0〜5 個
}

const CUSTOMIZER_PROMPTS = [
  '特定フィールドが空のとき保存できないようにする JS を作って',
  '一覧画面でステータスフィールドの色分けをする JS を作って',
  '保存時に別アプリのマスタを参照して値を自動入力する JS を作って',
  'フォーム読込時にカスタムボタンを追加して特定 URL を新規タブで開く JS を作って',
  '現在のアプリの fields 定義からサンプルレコード生成 JS を作って',
];

// Phase 1 — visibility=public の 3 エージェント
export const PRESET_AGENTS: PresetAgent[] = [
  {
    id: 'biz',
    name: '業務エージェント',
    desc: 'レコード操作・集計・ドキュメント生成',
    model: 'opus',
    purpose: 'default',
    iconKind: 'biz',
    iconColor: 'teal',
    visibility: 'public',
    prompts: [
      'kintone アプリ一覧を見せて',
      '先週追加された案件レコードを集計して',
      '未対応の問い合わせを一覧化して、優先度を提案して',
      '今月の売上をアプリから取得して、グラフ付きの Excel レポートにまとめて',
      '議事録の PDF からタスクを抽出して、タスク管理アプリに登録案を作って',
    ],
  },
  {
    id: 'cust-opus',
    name: 'カスタマイザー',
    desc: 'JS カスタマイズ・Plugin 開発（高品質）',
    model: 'opus',
    purpose: 'customizer',
    iconKind: 'cust',
    iconColor: 'blue',
    visibility: 'public',
    isDefault: true,
    prompts: CUSTOMIZER_PROMPTS,
  },
  {
    id: 'cust-sonnet',
    name: 'カスタマイザー',
    desc: 'JS カスタマイズ・Plugin 開発（高速・低コスト）',
    model: 'sonnet',
    purpose: 'customizer',
    iconKind: 'cust',
    iconColor: 'blue',
    visibility: 'public',
    prompts: CUSTOMIZER_PROMPTS,
  },
];

/** 一覧に出すのは公開エージェントのみ。 */
export const publicAgents = (agents: PresetAgent[]) =>
  agents.filter((a) => a.visibility === 'public');

/** 初期展開するエージェント (既定 → 先頭の順)。 */
export const defaultOpenId = (agents: PresetAgent[]) =>
  (agents.find((a) => a.isDefault) ?? agents[0])?.id ?? null;
