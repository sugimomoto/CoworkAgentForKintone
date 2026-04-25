// Cowork Agent for kintone — プラグイン設定画面
//
// 管理者が Anthropic API Key を入力すると、kintone.plugin.app.setProxyConfig で
// Anthropic API URL に対する固定ヘッダ (x-api-key) として登録される。
// API Key 自体はプラグイン設定領域には保存しない (登録済みマーカーのみ)。
//
// セキュリティ: 登録後、API Key はブラウザ JS から参照不可になる。
// kintone.plugin.app.proxy 呼び出し時に kintone runtime が自動付与する。

import { useState } from 'react';

export interface ConfigScreenProps {
  pluginId: string;
}

const ANTHROPIC_URL_PREFIX = 'https://api.anthropic.com/';
// Managed Agents API で実際に使用するメソッドのみ登録 (kintone の proxy 設定は許可メソッド毎に必要)
// 現状の resources/events モジュールは GET (list/retrieve) と POST (create/event 送信) のみ使用
const PROXY_METHODS = ['GET', 'POST'] as const;
const CONFIG_KEY_CONFIGURED = 'proxyConfigured';

export function ConfigScreen({ pluginId }: ConfigScreenProps): JSX.Element {
  const isConfigured =
    (typeof kintone !== 'undefined' &&
      kintone &&
      kintone.plugin.app.getConfig(pluginId)?.[CONFIG_KEY_CONFIGURED] === 'true') ?? false;

  const [apiKey, setApiKeyInput] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const trimmed = apiKey.trim();
  const canSave = trimmed.length > 0 && !saving;

  function handleSave(): void {
    if (!canSave || typeof kintone === 'undefined' || !kintone) return;
    setSaving(true);

    // Anthropic API URL に対し HTTP メソッドごとに proxy 設定を登録
    // ヘッダ名は Postman で動作確認済の "X-Api-Key" 表記に揃える
    const fixedHeaders = { 'X-Api-Key': trimmed };
    for (const method of PROXY_METHODS) {
      kintone.plugin.app.setProxyConfig(ANTHROPIC_URL_PREFIX, method, fixedHeaders, {});
    }

    // 登録済みマーカーのみ保存。API Key は保存しない
    kintone.plugin.app.setConfig({ [CONFIG_KEY_CONFIGURED]: 'true' }, () => {
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

      <section className="mb-[20px] rounded-[12px] border border-card-border bg-card p-[16px]">
        <label className="mb-[8px] flex items-center gap-[8px] text-[13px] font-semibold text-text">
          Anthropic API Key
          <span className="text-[11px] font-normal text-warn">必須</span>
          {isConfigured && (
            <span className="rounded-[4px] bg-accent-soft px-[6px] py-[1px] text-[10px] font-medium text-accent">
              登録済み
            </span>
          )}
        </label>
        <input
          type="password"
          aria-label="Anthropic API Key"
          value={apiKey}
          onChange={(e) => setApiKeyInput(e.target.value)}
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
          ) で発行した API Key を入力してください。
          値はプラグインのプロキシ設定として登録され、kintone runtime が自動的に
          リクエストヘッダに付与します。ブラウザの JavaScript からは参照できません。
          {isConfigured &&
            '既に登録済みです。再入力すると上書きされます (空欄のまま保存はできません)。'}
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
