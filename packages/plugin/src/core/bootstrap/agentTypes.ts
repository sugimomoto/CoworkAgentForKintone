// Cowork Agent for kintone — Agent カタログ型定義
//
// Built-in (Plugin 同梱、3 variant) と Custom (admin が Settings View で作成) の
// Agent を統一して扱う型。Header / AgentPicker / Settings View / Workflow Footer
// 全箇所でこの AgentRecord を消費する。
//
// 詳細仕様: .steering/20260517-customizer-wedge-design/design.md §2.4

/**
 * Agent のアイコン glyph 種別。
 * Built-in 3 variant では 'biz' (業務、チェックリスト) / 'cust' (開発、ブレース) を使う。
 * その他は V3 Custom Agent 作成時の IconPicker で選択可能 (8 種類)。
 */
export type AgentGlyph =
  | 'biz' // チェックリスト — 業務系
  | 'cust' // ブレース { } — 開発系
  | 'dev' // ターミナル
  | 'analytics' // 棒グラフ
  | 'mail'
  | 'calendar'
  | 'ops' // 歯車 — 運用
  | 'ai' // 星 — AI / 汎用
  | 'doc'; // ドキュメント

/**
 * Agent アイコンの色トークン名。
 * - 'accent' / 'accentSoft' は **Built-in 用**: テーマ accent (ティール等) に追従し、
 *   Customizer 系は塗り (accent)、業務系は塗らない (accentSoft)
 * - その他 8 色は V3 Custom Agent 作成時のプリセット
 */
export type AgentColor =
  | 'accent'
  | 'accentSoft'
  | 'teal'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'indigo'
  | 'slate'
  | 'sky'
  | 'fuchsia';

/**
 * Agent の用途識別子 (metadata.purpose に保存)。
 * - 'business': 業務エージェント (Sonnet 4.6)
 * - 'customizer-opus': カスタマイザーエージェント (Opus 4.7)
 * - 'customizer-sonnet': カスタマイザーエージェント (Sonnet 4.6)
 * - 'custom': admin が作成した Custom Agent (V3)
 */
export type AgentPurpose =
  | 'business'
  | 'customizer-opus'
  | 'customizer-sonnet'
  | 'custom';

/**
 * Agent の model 表記。
 * Anthropic API では 'claude-opus-4-7' / 'claude-sonnet-4-6' のように完全 ID を使うが、
 * UI 表示や variant 判定では短縮形を使う。
 */
export type AgentModelKind = 'opus' | 'sonnet';

export type AgentModelLabel = 'OPUS' | 'SONNET';

/**
 * Agent の出所識別子。Built-in は Plugin 同梱で auto-ensure、Custom は admin が UI で作成。
 */
export type AgentSource = 'builtin' | 'custom';

/**
 * Variant group 識別子。同じ用途 (purpose) で model だけ違う Agent を束ねる。
 * 現状は 'customizer' のみ (Opus / Sonnet ペア)。V3 で Custom Agent も拡張する余地。
 */
export type AgentVariantGroup = 'customizer';

/**
 * Built-in / Custom を統一して扱う Agent レコード。
 * Anthropic Workspace 側の Agent オブジェクトを Plugin が解釈した結果。
 *
 * メタデータ (purpose / iconKind / iconColor / variantGroup / isDefault / visibility) は
 * Anthropic Agent.metadata に保存し、Plugin は再 list 時にここから読み出す。
 */
export interface AgentRecord {
  /** Anthropic Agent ID (例: 'agent_01HX...') */
  id: string;
  /** UI 表示名 (Built-in は固定、Custom は admin 編集可) */
  name: string;
  /** モデル種別 (短縮形) */
  model: AgentModelKind;
  /** MODEL バッジに表示する大文字ラベル */
  modelLabel: AgentModelLabel;
  /** 1 行説明 (Built-in は固定、Custom は admin 編集可) */
  description: string;
  /** Agent 用途カテゴリ */
  purpose: AgentPurpose;
  /** Header / 一覧で表示するアイコン glyph */
  iconKind: AgentGlyph;
  /** アイコンの色トークン名 */
  iconColor: AgentColor;
  /** end user の Header プルダウンに出すか (admin が公開トグルで切替) */
  visibility: 'public' | 'private';
  /** 組織既定フラグ (Header プルダウンの初期選択候補) */
  isDefault: boolean;
  /** Opus/Sonnet 切替で同じ系列に属する識別子 (V2 (B)案で利用) */
  variantGroup?: AgentVariantGroup;
  /** Built-in は Plugin 同梱 spec で固定、Custom は admin が作成 */
  source: AgentSource;
}

/**
 * 全 AgentGlyph の配列 (UI で選択肢として列挙する用)。
 * 順序は IconPicker の表示順を兼ねる。
 */
export const AGENT_GLYPHS: readonly AgentGlyph[] = [
  'biz',
  'cust',
  'dev',
  'analytics',
  'mail',
  'calendar',
  'ops',
  'ai',
  'doc',
] as const;

/**
 * 全 AgentColor の配列 (UI で選択肢として列挙する用)。
 * Built-in 用 'accent' / 'accentSoft' は IconPicker からは除外する想定 (Custom 用は 8 色)。
 */
export const AGENT_COLORS: readonly AgentColor[] = [
  'accent',
  'accentSoft',
  'teal',
  'emerald',
  'amber',
  'rose',
  'indigo',
  'slate',
  'sky',
  'fuchsia',
] as const;

/** Custom Agent 作成 (V3) の IconPicker 用カラーパレット (Built-in 専用色を除く 8 色) */
export const AGENT_PICKER_COLORS: readonly AgentColor[] = [
  'teal',
  'emerald',
  'amber',
  'rose',
  'indigo',
  'slate',
  'sky',
  'fuchsia',
] as const;
