// Cowork Agent for kintone — プラグイン設定画面 (admin 専用)
//
// 管理者が以下を入力する:
//   1. Anthropic API Key  → setProxyConfig (https://api.anthropic.com/)
//   2. MCP Worker URL     → setConfig (通常 config、URL 自体は秘匿性低)
//   3. MINT_API_KEY       → setProxyConfig (Worker /mint URL 宛 POST の Bearer)
//
// secret 系 (1, 3) は setProxyConfig 経由で kintone runtime に隠蔽。
// end-user JS から `getConfig` / `getProxyConfig` で値を読出不可。

import { useState } from 'react';

export interface ConfigScreenProps {
  pluginId: string;
}

const ANTHROPIC_URL_PREFIX = 'https://api.anthropic.com/';
// Managed Agents API は GET (list/retrieve) と POST (create/event/credential 等) のみ
const PROXY_METHODS = ['GET', 'POST'] as const;

const CONFIG_KEY_CONFIGURED = 'proxyConfigured';
const CONFIG_KEY_WORKER_URL = 'workerUrl';
const CONFIG_KEY_MCP_CONFIGURED = 'mcpConfigured';

const WORKER_URL_RE = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i;

export function ConfigScreen({ pluginId }: ConfigScreenProps): JSX.Element {
  const existing =
    typeof kintone !== 'undefined' && kintone
      ? (kintone.plugin.app.getConfig(pluginId) ?? {})
      : {};

  const isApiKeyConfigured = existing[CONFIG_KEY_CONFIGURED] === 'true';
  const isMcpConfigured = existing[CONFIG_KEY_MCP_CONFIGURED] === 'true';
  const existingWorkerUrl = existing[CONFIG_KEY_WORKER_URL] ?? '';

  const [apiKey, setApiKey] = useState<string>('');
  const [workerUrl, setWorkerUrl] = useState<string>(existingWorkerUrl);
  const [mintApiKey, setMintApiKey] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const apiKeyTrimmed = apiKey.trim();
  const workerUrlTrimmed = workerUrl.trim();
  const mintApiKeyTrimmed = mintApiKey.trim();

  // 個別更新を許可:
  //   - Anthropic API Key は値が入っていれば更新
  //   - Worker URL は値が変わっていれば更新
  //   - MINT_API_KEY は値が入っていれば更新
  const apiKeyDirty = apiKeyTrimmed.length > 0;
  const workerUrlDirty =
    workerUrlTrimmed.length > 0 && workerUrlTrimmed !== existingWorkerUrl;
  const mintApiKeyDirty = mintApiKeyTrimmed.length > 0;

  const workerUrlValid =
    workerUrlTrimmed.length === 0 || WORKER_URL_RE.test(workerUrlTrimmed);

  // 何か 1 つでも更新あり、かつ Worker URL を変える場合は MINT_API_KEY 必須
  // (Worker URL 変更したら mint 認証も再設定する必要があるため)
  const mintRequiredButMissing =
    workerUrlDirty && mintApiKeyTrimmed.length === 0;

  const canSave =
    !saving &&
    workerUrlValid &&
    !mintRequiredButMissing &&
    (apiKeyDirty || workerUrlDirty || mintApiKeyDirty);

  function handleSave(): void {
    if (!canSave || typeof kintone === 'undefined' || !kintone) return;
    setSaving(true);

    const config: Record<string, string> = { ...existing };

    if (apiKeyDirty) {
      const fixedHeaders = { 'X-Api-Key': apiKeyTrimmed };
      for (const method of PROXY_METHODS) {
        kintone.plugin.app.setProxyConfig(ANTHROPIC_URL_PREFIX, method, fixedHeaders, {});
      }
      config[CONFIG_KEY_CONFIGURED] = 'true';
    }

    const finalWorkerUrl = workerUrlDirty ? workerUrlTrimmed : existingWorkerUrl;

    if (workerUrlDirty || mintApiKeyDirty) {
      // Worker URL を変えるなら必ず MINT_API_KEY も更新される (上の必須チェック)
      // MINT_API_KEY だけの更新時は既存 Worker URL に対して登録
      if (finalWorkerUrl) {
        const mintUrl = `${finalWorkerUrl.replace(/\/$/, '')}/mint`;
        if (mintApiKeyDirty) {
          kintone.plugin.app.setProxyConfig(
            mintUrl,
            'POST',
            { Authorization: `Bearer ${mintApiKeyTrimmed}` },
            {},
          );
        }
        config[CONFIG_KEY_WORKER_URL] = finalWorkerUrl;
        if (mintApiKeyDirty || isMcpConfigured) {
          config[CONFIG_KEY_MCP_CONFIGURED] = 'true';
        }
      }
    }

    kintone.plugin.app.setConfig(config, () => {
      alert('Cowork Agent: 設定を保存しました。');
      const appId = kintone?.app.getId() ?? '';
      window.location.href = `../../flow?app=${appId}`;
    });
  }

  function handleCancel(): void {
    history.back();
  }

  return (
    <div className="cowork-agent-root max-w-[640px] p-[24px]">
      <h1 className="mb-[16px] text-[18px] font-semibold">
        Cowork Agent for kintone — 設定
      </h1>

      {/* Anthropic API Key */}
      <section className="mb-[20px] rounded-[12px] border border-card-border bg-card p-[16px]">
        <label className="mb-[8px] flex items-center gap-[8px] text-[13px] font-semibold text-text">
          Anthropic API Key
          <span className="text-[11px] font-normal text-warn">必須</span>
          {isApiKeyConfigured && (
            <span className="rounded-[4px] bg-accent-soft px-[6px] py-[1px] text-[10px] font-medium text-accent">
              登録済み
            </span>
          )}
        </label>
        <input
          type="password"
          aria-label="Anthropic API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-[8px] border border-card-border bg-bg px-[12px] py-[8px] font-mono text-[12px] text-text outline-none focus:border-accent"
        />
        <p className="mt-[8px] text-[11px] leading-[1.6] text-muted">
          Anthropic Console (
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            console.anthropic.com
          </a>
          ) で発行した API Key を入力してください。値はプラグインのプロキシ設定として登録され、
          kintone runtime が自動的にリクエストヘッダに付与します。ブラウザの JavaScript からは
          参照できません。
          {isApiKeyConfigured &&
            ' 既に登録済みです。再入力すると上書きされます (空欄のままでも他項目を保存できます)。'}
        </p>
      </section>

      {/* MCP Worker */}
      <section className="mb-[20px] rounded-[12px] border border-card-border bg-card p-[16px]">
        <label className="mb-[8px] flex items-center gap-[8px] text-[13px] font-semibold text-text">
          kintone MCP Server (Cloudflare Workers)
          <span className="text-[11px] font-normal text-warn">必須</span>
          {isMcpConfigured && (
            <span className="rounded-[4px] bg-accent-soft px-[6px] py-[1px] text-[10px] font-medium text-accent">
              登録済み
            </span>
          )}
        </label>

        <label className="mb-[4px] block text-[12px] text-text" htmlFor="worker-url-input">
          Worker URL
        </label>
        <input
          id="worker-url-input"
          type="text"
          aria-label="MCP Worker URL"
          value={workerUrl}
          onChange={(e) => setWorkerUrl(e.target.value)}
          placeholder="https://cowork-agent-kintone-mcp.your-account.workers.dev"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-[8px] border border-card-border bg-bg px-[12px] py-[8px] font-mono text-[12px] text-text outline-none focus:border-accent"
        />
        {workerUrlTrimmed.length > 0 && !workerUrlValid && (
          <p className="mt-[2px] text-[11px] text-warn">
            URL は https:// で始まる必要があります
          </p>
        )}

        <label className="mt-[10px] mb-[4px] block text-[12px] text-text" htmlFor="mint-api-key-input">
          MINT_API_KEY
        </label>
        <input
          id="mint-api-key-input"
          type="password"
          aria-label="MINT_API_KEY"
          value={mintApiKey}
          onChange={(e) => setMintApiKey(e.target.value)}
          placeholder={isMcpConfigured ? '●●●●●●●● (再入力で更新)' : '32 byte 以上のランダム値'}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-[8px] border border-card-border bg-bg px-[12px] py-[8px] font-mono text-[12px] text-text outline-none focus:border-accent"
        />
        {mintRequiredButMissing && (
          <p className="mt-[2px] text-[11px] text-warn">
            Worker URL を変更する場合は MINT_API_KEY も入力してください
          </p>
        )}

        <p className="mt-[8px] text-[11px] leading-[1.6] text-muted">
          Cloudflare Worker をデプロイした後、ダッシュボードで生成した値を入力してください。
          MINT_API_KEY は kintone のプロキシ設定経由でのみ使用され、ブラウザ JavaScript からは
          参照できません。
        </p>
      </section>

      <div className="flex gap-[8px]">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="rounded-[8px] bg-accent px-[14px] py-[8px] text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(13,148,136,0.33)] disabled:opacity-50"
        >
          保存
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-[8px] border border-card-border bg-card px-[14px] py-[8px] text-[13px] text-muted"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
