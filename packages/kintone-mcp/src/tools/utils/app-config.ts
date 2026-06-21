// アプリ管理系ツール (Phase C, #24) の共通部品。
// get 系 ({app, preview?} → GET) はファクトリで生成し、各ツールは name/title/description だけ渡す。

import { kintoneRequest } from '../../kintone';
import { createTool, toolResult } from '../factory';

import { appConfigPath, appIdSchema, previewSchema } from './schemas';

import type { Tool } from '../types/tool';

/** app(必須) を検証する。管理系ツール共通。 */
export function requireApp(tool: string, app: string): void {
  if (!app) throw new Error(`${tool}: app is required`);
}

/**
 * `{ app, preview? }` を受けてアプリ設定を取得する GET ツールを生成する。
 * (get-customize / get-views / get-form-layout / get-process-management / get-app-acl / get-app-plugins)
 * preview=true で運用前 (preview)、既定は運用環境 (live)。
 */
export function makeAppConfigGetTool(
  name: string,
  title: string,
  description: string,
  segment: string,
): Tool<{ app: string; preview?: boolean }> {
  return createTool<{ app: string; preview?: boolean }>(
    name,
    { title, description, inputSchema: { app: appIdSchema, preview: previewSchema } },
    async (args, { creds }) => {
      requireApp(name, args.app);
      return toolResult(
        await kintoneRequest(creds, 'GET', appConfigPath(segment, args.preview ?? false), {
          params: { app: args.app },
        }),
      );
    },
  );
}
