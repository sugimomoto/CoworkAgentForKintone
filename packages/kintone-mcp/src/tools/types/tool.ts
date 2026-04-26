// Tool 型定義 (公式 MCP のパターンを踏襲、ただし依存ライブラリを最小化するため
// Zod の代わりにシンプルなスキーマ表現を使う)。

import type { KintoneCreds } from '../../kintone';

/** MCP CallToolResult の最小サブセット */
export interface CallToolResult {
  /** 構造化データ (programmatic 利用) */
  structuredContent?: unknown;
  /** human-readable コンテンツ (LLM 応答に利用) */
  content: Array<{ type: 'text'; text: string }>;
  /** ツール実行が失敗したことを示す (任意) */
  isError?: boolean;
}

/** Tool 実行コールバックに渡されるオプション */
export interface ToolCallbackOptions {
  /** kintone 認証情報 (JWT payload から復元したもの) */
  creds: KintoneCreds;
}

/**
 * Tool config。MCP の input/output schema は JSON Schema で表現。
 * 公式 MCP は Zod を使うが、ここでは JSON Schema raw を使い依存を減らす。
 */
export interface ToolConfig {
  title: string;
  description: string;
  /** JSON Schema (object 型のプロパティ群) */
  inputSchema: Record<string, unknown>;
  /** JSON Schema (任意) */
  outputSchema?: Record<string, unknown>;
}

/**
 * Tool 実行コールバック。
 * args: input schema 経由で validation 済の引数
 * options: 実行コンテキスト (creds など)
 */
export type ToolCallback<TArgs = Record<string, unknown>> = (
  args: TArgs,
  options: ToolCallbackOptions,
) => Promise<CallToolResult>;

export interface Tool<TArgs = Record<string, unknown>> {
  name: string;
  config: ToolConfig;
  callback: ToolCallback<TArgs>;
}
