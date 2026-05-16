// Cowork Agent for kintone — プラグイン設定画面 (admin 専用)
//
// 4 ステップウィザード:
//   Step 0: Cloudflare Workers デプロイ (任意)
//   Step 1: Worker URL + ANTHROPIC_API_KEY
//   Step 2: cybozu OAuth クライアント登録の案内
//   Step 3: kintone OAuth client_id / client_secret → 保存 (scope は固定)

import { useMemo, useState } from 'react';

import {
  CloudflareApiError,
  deployWorker,
  fetchDeployedWorkerVersion,
} from '../core/cloudflare/cfDeploy';
import {
  ANTHROPIC_VERSION,
  CLOUDFLARE_WORKER_SCRIPT_NAME,
  DEFAULT_KINTONE_OAUTH_SCOPE,
  MANAGED_AGENTS_BETA,
} from '../core/constants';
import { setProxyConfigAsync } from '../core/kintone/setProxyConfigAsync';
import { syncSkills, SkillSyncError } from '../core/skills/skillsSyncClient';
import { joinUrl, sleep, toErrorMessage } from '../core/utils';
import { SKILL_BUNDLES, SKILLS_VERSION } from '../generated/skills-bundle';
import { WORKER_BUNDLE_JS, WORKER_BUNDLE_VERSION } from '../generated/worker-bundle';

export interface ConfigScreenProps {
  pluginId: string;
}


const CONFIG_KEY_SAVED = 'saved';
const CONFIG_KEY_WORKER_URL = 'workerUrl';
const CONFIG_KEY_OAUTH_CLIENT_ID = 'oauthClientId';
const CONFIG_KEY_OAUTH_SCOPE = 'oauthScope';
const CONFIG_KEY_SKILLS_MAPPING = 'skillsMapping';
const CONFIG_KEY_SKILLS_VERSION = 'skillsVersion';

const WORKER_URL_RE = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i;

/** kintone DB ロック競合を避けるための setProxyConfig 間の遅延 (500ms 以上が安全) */
const PROXY_STEP_DELAY_MS = 700;
const VERSION_POLL_RETRIES = 5;
const VERSION_POLL_INTERVAL_MS = 1000;

function getCybozuOAuthAdminUrl(): string {
  if (typeof window === 'undefined') return '';
  return `https://${window.location.hostname}/admin/integrations/oauth/list`;
}

export function ConfigScreen({ pluginId }: ConfigScreenProps): JSX.Element {
  // 既存設定はマウント時に 1 回だけ getConfig (毎レンダリングしない)
  const [existing] = useState<Record<string, string>>(() =>
    typeof kintone !== 'undefined' && kintone
      ? (kintone.plugin.app.getConfig(pluginId) ?? {})
      : {},
  );

  const isSaved = existing[CONFIG_KEY_SAVED] === 'true';
  const existingWorkerUrl = existing[CONFIG_KEY_WORKER_URL] ?? '';
  const existingClientId = existing[CONFIG_KEY_OAUTH_CLIENT_ID] ?? '';
  const [workerUrl, setWorkerUrl] = useState<string>(existingWorkerUrl);
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [clientId, setClientId] = useState<string>(existingClientId);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ----- Step 0: Cloudflare Workers デプロイ -----
  const [cfApiToken, setCfApiToken] = useState<string>('');
  const [showCfToken, setShowCfToken] = useState(false);
  const [cfAccountId, setCfAccountId] = useState<string>('');
  const [cfDeploying, setCfDeploying] = useState(false);
  const [cfDeployMessage, setCfDeployMessage] = useState<string | null>(null);
  const [cfDeployError, setCfDeployError] = useState<string | null>(null);

  // Issue #30: Skills 同期
  const existingSkillsVersion = existing[CONFIG_KEY_SKILLS_VERSION] ?? null;
  const skillsSynced = existingSkillsVersion === SKILLS_VERSION;
  const [skillsSyncing, setSkillsSyncing] = useState(false);
  const [skillsSyncMessage, setSkillsSyncMessage] = useState<string | null>(null);
  const [skillsSyncError, setSkillsSyncError] = useState<string | null>(null);

  const cfTokenTrimmed = cfApiToken.trim();
  const cfAccountIdTrimmed = cfAccountId.trim();
  const canDeployCf = !cfDeploying && cfTokenTrimmed.length > 0 && cfAccountIdTrimmed.length > 0;

  const workerUrlTrimmed = workerUrl.trim();
  const workerUrlValid = workerUrlTrimmed.length > 0 && WORKER_URL_RE.test(workerUrlTrimmed);

  const callbackUrl = useMemo(
    () => (workerUrlValid ? joinUrl(workerUrlTrimmed, 'oauth/callback') : ''),
    [workerUrlTrimmed, workerUrlValid],
  );

  const cybozuAdminUrl = useMemo(() => getCybozuOAuthAdminUrl(), []);

  const apiKeyTrimmed = anthropicApiKey.trim();
  const clientIdTrimmed = clientId.trim();
  const clientSecretTrimmed = clientSecret.trim();

  // 初回保存時は全 secret 必須。再保存時 (isSaved=true) は **secret 系の入力** が
  // 1 つでもあれば該当 proxy step だけ更新する形で保存可能。
  // clientId は公開可能な識別子で plugin config に永続化されるため secret 判定からは外す
  // (空欄でも自動的にプリフィルされてしまうため、これで save 有効になると意図しない)。
  const hasAnyNewSecret =
    apiKeyTrimmed.length > 0 || clientSecretTrimmed.length > 0;
  const hasAllSecrets =
    apiKeyTrimmed.length > 0 &&
    clientIdTrimmed.length > 0 &&
    clientSecretTrimmed.length > 0;
  const canSave =
    !saving && workerUrlValid && (isSaved ? hasAnyNewSecret : hasAllSecrets);

  function copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {
      // ignore
    });
  }

  async function handleCloudflareDeploy(): Promise<void> {
    if (!canDeployCf) return;
    setCfDeploying(true);
    setCfDeployMessage('Worker をデプロイ中… (subdomain 取得 → script アップロード → workers.dev 有効化)');
    setCfDeployError(null);

    try {
      const result = await deployWorker({
        apiToken: cfTokenTrimmed,
        accountId: cfAccountIdTrimmed,
        scriptName: CLOUDFLARE_WORKER_SCRIPT_NAME,
        workerJsContent: WORKER_BUNDLE_JS,
      });

      setWorkerUrl(result.workerUrl);
      setCfDeployMessage(`デプロイ成功: ${result.workerUrl}\nWorker /version を照合中…`);

      // Cloudflare のエッジ反映に若干ラグがあるので retry。
      let info = null;
      for (let i = 0; i < VERSION_POLL_RETRIES; i++) {
        info = await fetchDeployedWorkerVersion(result.workerUrl);
        if (info && info.version === WORKER_BUNDLE_VERSION) break;
        await sleep(VERSION_POLL_INTERVAL_MS);
      }

      if (!info) {
        setCfDeployError(
          `デプロイは成功しましたが /version エンドポイントが応答しません。\nWorker URL: ${result.workerUrl}\n手動で ${result.workerUrl}/version を開いて確認してください。`,
        );
        setCfDeployMessage(null);
      } else if (info.version !== WORKER_BUNDLE_VERSION) {
        setCfDeployError(
          `デプロイ後のバージョン照合に失敗:\n  期待: ${WORKER_BUNDLE_VERSION}\n  実測: ${info.version}\nブラウザキャッシュ or プロキシキャッシュの可能性。${result.workerUrl}/version を開いて確認してください。`,
        );
        setCfDeployMessage(null);
      } else {
        setCfDeployMessage(
          `✓ デプロイ成功\n  URL: ${result.workerUrl}\n  Version: ${info.version}\n  Built At: ${info.builtAt}`,
        );
      }
    } catch (err) {
      const message =
        err instanceof CloudflareApiError
          ? `Cloudflare API エラー (${err.status}): ${err.message}\n${err.responseBody.slice(0, 300)}`
          : toErrorMessage(err);
      setCfDeployError(message);
      setCfDeployMessage(null);
    } finally {
      setCfDeploying(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (!canSave || typeof kintone === 'undefined' || !kintone) return;
    setSaving(true);
    setErrorMessage(null);

    try {
      const finalWorkerUrl = workerUrlTrimmed.replace(/\/$/, '');
      const tokenEndpoint = `https://${window.location.hostname}/oauth2/token`;
      const credentialsUpsertUrl = joinUrl(finalWorkerUrl, 'credentials/upsert');
      const anthropicHeaders = {
        'X-Api-Key': apiKeyTrimmed,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-beta': MANAGED_AGENTS_BETA,
      };

      // setProxyConfig 経路を直列に登録する。並行だと kintone 内部 DB の
      // ロック競合 (update.json 400) が起きるため必ず逐次 + 待ち時間。
      // 再保存時 (isSaved=true) は空欄 secret に依存する step を skip する。
      const hasOAuth = clientIdTrimmed.length > 0 && clientSecretTrimmed.length > 0;
      const hasApiKey = apiKeyTrimmed.length > 0;
      const proxySteps: Array<{
        url: string;
        method: 'GET' | 'POST';
        headers: Record<string, string>;
      }> = [];
      // /oauth2/token (token 交換 + Anthropic 自動 refresh) — clientId + clientSecret 必要
      if (hasOAuth) {
        proxySteps.push({
          url: tokenEndpoint,
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${clientIdTrimmed}:${clientSecretTrimmed}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
      }
      // Worker /credentials/upsert (X-Anthropic-Api-Key + OAuth client headers) — 全 secret 必要
      if (hasApiKey && hasOAuth) {
        proxySteps.push({
          url: credentialsUpsertUrl,
          method: 'POST',
          headers: {
            'X-Anthropic-Api-Key': apiKeyTrimmed,
            'X-Kintone-OAuth-Client-Id': clientIdTrimmed,
            'X-Kintone-OAuth-Client-Secret': clientSecretTrimmed,
            'Content-Type': 'application/json',
          },
        });
      }
      // Worker /files/<fileId>/content (binary DL の base64 中継) — apiKey のみ必要
      if (hasApiKey) {
        proxySteps.push({
          url: joinUrl(finalWorkerUrl, 'files/'),
          method: 'GET',
          headers: { 'X-Anthropic-Api-Key': apiKeyTrimmed },
        });
      }
      // Worker /skills/sync (Issue #30: 同期ボタンが叩く) — apiKey + JSON
      if (hasApiKey) {
        proxySteps.push({
          url: joinUrl(finalWorkerUrl, 'skills/sync'),
          method: 'POST',
          headers: {
            'X-Anthropic-Api-Key': apiKeyTrimmed,
            'Content-Type': 'application/json',
          },
        });
      }
      // Issue #31: Anthropic API は Worker /anthropic/* 経由で叩く。
      // 旧 `https://api.anthropic.com/` への直接 proxy 登録は廃止。
      if (hasApiKey) {
        const anthropicPassthroughUrl = joinUrl(finalWorkerUrl, 'anthropic/');
        proxySteps.push(
          {
            url: anthropicPassthroughUrl,
            method: 'POST',
            headers: {
              'X-Anthropic-Api-Key': apiKeyTrimmed,
              ...anthropicHeaders,
              'Content-Type': 'application/json',
            },
          },
          {
            url: anthropicPassthroughUrl,
            method: 'GET',
            headers: { 'X-Anthropic-Api-Key': apiKeyTrimmed, ...anthropicHeaders },
          },
        );
      }
      for (const step of proxySteps) {
        await setProxyConfigAsync(step.url, step.method, step.headers, {});
        await sleep(PROXY_STEP_DELAY_MS);
      }

      // setConfig (secret は保存しない / scope は plugin 内固定なので保存しない)
      const config: Record<string, string> = {
        ...existing,
        [CONFIG_KEY_WORKER_URL]: finalWorkerUrl,
        [CONFIG_KEY_OAUTH_CLIENT_ID]: clientIdTrimmed,
        [CONFIG_KEY_SAVED]: 'true',
      };
      // 旧バージョンが書き込んだ scope 値が残っていれば掃除する
      delete config[CONFIG_KEY_OAUTH_SCOPE];

      kintone.plugin.app.setConfig(config, () => {
        alert('Cowork Agent: 設定を保存しました。');
        const appId = kintone?.app.getId() ?? '';
        window.location.href = `../../flow?app=${appId}`;
      });
    } catch (err) {
      setErrorMessage(toErrorMessage(err));
      setSaving(false);
    }
  }

  function handleCancel(): void {
    history.back();
  }

  /**
   * Issue #30: 「Skills 同期」ボタンのハンドラ。
   * 同梱されている SKILL_BUNDLES を Worker /skills/sync 経由で Anthropic にアップロード、
   * 返ってきた skill_id mapping を plugin config に保存する。
   * (proxy 登録 = `${workerUrl}/skills/sync` POST は保存時に登録済の前提)
   */
  async function handleSyncSkills(): Promise<void> {
    if (skillsSyncing) return;
    if (!workerUrlValid) {
      setSkillsSyncError('Worker URL が未設定です');
      return;
    }
    if (SKILL_BUNDLES.length === 0) {
      setSkillsSyncError('同期する skill がありません');
      return;
    }
    setSkillsSyncing(true);
    setSkillsSyncMessage(null);
    setSkillsSyncError(null);
    try {
      const finalWorkerUrl = workerUrlTrimmed.replace(/\/$/, '');
      const result = await syncSkills({
        pluginId,
        workerUrl: finalWorkerUrl,
        bundles: SKILL_BUNDLES,
      });
      const mapping: Record<string, { skillId: string; version: string }> = {};
      for (const r of result.results) {
        mapping[r.name] = { skillId: r.skillId, version: r.version };
      }
      // setConfig: 既存 config + skill mapping + skillsVersion を保存
      const next: Record<string, string> = {
        ...existing,
        [CONFIG_KEY_SKILLS_MAPPING]: JSON.stringify(mapping),
        [CONFIG_KEY_SKILLS_VERSION]: SKILLS_VERSION,
      };
      await new Promise<void>((resolve) => {
        kintone.plugin.app.setConfig(next, () => resolve());
      });
      const summary = result.results
        .map((r) => `${r.name} (${r.action})`)
        .join(', ');
      setSkillsSyncMessage(`✓ ${result.results.length} skill を同期: ${summary}`);
    } catch (err) {
      if (err instanceof SkillSyncError) {
        setSkillsSyncError(`Worker /skills/sync が ${err.status} を返しました: ${err.responseBody.slice(0, 200)}`);
      } else {
        setSkillsSyncError(toErrorMessage(err));
      }
    } finally {
      setSkillsSyncing(false);
    }
  }

  return (
    <div className="cowork-agent-root max-w-[720px] p-[24px]">
      <h1 className="mb-[16px] text-[18px] font-semibold">
        Cowork Agent for kintone — 設定
      </h1>
      {isSaved && (
        <p className="mb-[12px] rounded-[8px] bg-accent-soft px-[12px] py-[8px] text-[12px] leading-[1.6] text-accent">
          登録済み。再保存時は <strong>入力済みの secret に対応する proxy 設定だけ</strong> が
          上書きされます (空欄の項目は変更されません)。proxy 経路の追加だけ反映したい場合は、
          Anthropic API Key を再入力して保存してください。
        </p>
      )}

      {/* Step 0: Cloudflare Workers デプロイ (任意) */}
      <section className="mb-[20px] rounded-[12px] border border-card-border bg-card p-[16px]">
        <h2 className="mb-[4px] text-[14px] font-semibold">
          Step 0. Cloudflare Workers をデプロイ <span className="text-[11px] font-normal text-muted">(任意)</span>
        </h2>
        <p className="mb-[10px] text-[11px] leading-[1.6] text-muted">
          すでに Worker URL を持っている場合は飛ばして Step 1 へ。Cloudflare アカウントを
          持っていれば、API Token + Account ID を入力するだけでこの画面から Worker をデプロイ
          できます。
        </p>

        <label className="mb-[4px] block text-[12px] text-text" htmlFor="cf-account-id-input">
          Cloudflare Account ID
        </label>
        <input
          id="cf-account-id-input"
          type="text"
          value={cfAccountId}
          onChange={(e) => setCfAccountId(e.target.value)}
          placeholder="32 文字の 16 進文字列"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-[8px] border border-card-border bg-bg px-[12px] py-[8px] font-mono text-[12px] text-text outline-none focus:border-accent"
        />

        <label className="mt-[10px] mb-[4px] block text-[12px] text-text" htmlFor="cf-api-token-input">
          Cloudflare API Token
        </label>
        <div className="relative">
          <input
            id="cf-api-token-input"
            type={showCfToken ? 'text' : 'password'}
            value={cfApiToken}
            onChange={(e) => setCfApiToken(e.target.value)}
            placeholder="Edit Cloudflare Workers テンプレートで作成"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-[8px] border border-card-border bg-bg px-[12px] py-[8px] pr-[64px] font-mono text-[12px] text-text outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setShowCfToken((v) => !v)}
            className="absolute right-[8px] top-1/2 -translate-y-1/2 rounded-[4px] px-[6px] py-[2px] text-[10px] text-muted hover:text-accent"
          >
            {showCfToken ? '隠す' : '表示'}
          </button>
        </div>
        <p className="mt-[4px] text-[11px] text-subtle">
          Token は Cloudflare Dashboard{' '}
          <a
            href="https://dash.cloudflare.com/profile/api-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            プロファイル → API Tokens
          </a>
          {' '}で「Edit Cloudflare Workers」テンプレートを使うと最小権限で発行できます。
        </p>

        <button
          type="button"
          onClick={() => void handleCloudflareDeploy()}
          disabled={!canDeployCf}
          data-testid="cf-deploy-button"
          className="mt-[12px] rounded-[8px] bg-accent px-[14px] py-[8px] text-[12px] font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] disabled:opacity-50"
        >
          {cfDeploying ? 'デプロイ中…' : `Worker (${CLOUDFLARE_WORKER_SCRIPT_NAME}) をデプロイ`}
        </button>

        {cfDeployMessage && (
          <p
            data-testid="cf-deploy-message"
            className="mt-[8px] rounded-[8px] bg-accent-soft px-[10px] py-[8px] text-[11px] leading-[1.6] text-accent"
          >
            {cfDeployMessage}
          </p>
        )}
        {cfDeployError && (
          <p
            data-testid="cf-deploy-error"
            role="alert"
            className="mt-[8px] whitespace-pre-wrap rounded-[8px] border border-warn/40 bg-warn-soft px-[10px] py-[8px] text-[11px] leading-[1.6] text-warn"
          >
            ⚠ {cfDeployError}
          </p>
        )}
      </section>

      {/* Step 1 */}
      <section className="mb-[20px] rounded-[12px] border border-card-border bg-card p-[16px]">
        <h2 className="mb-[12px] text-[14px] font-semibold">Step 1. Worker URL と Anthropic API Key</h2>

        <label className="mb-[4px] block text-[12px] text-text" htmlFor="worker-url-input">
          Worker URL
        </label>
        <input
          id="worker-url-input"
          type="text"
          value={workerUrl}
          onChange={(e) => setWorkerUrl(e.target.value)}
          placeholder="https://cowork-agent-kintone-mcp.your-account.workers.dev"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-[8px] border border-card-border bg-bg px-[12px] py-[8px] font-mono text-[12px] text-text outline-none focus:border-accent"
        />
        {workerUrlTrimmed.length > 0 && !workerUrlValid && (
          <p className="mt-[2px] text-[11px] text-warn">URL は https:// で始まる必要があります</p>
        )}

        <label className="mt-[12px] mb-[4px] block text-[12px] text-text" htmlFor="anthropic-api-key-input">
          Anthropic API Key
        </label>
        <div className="relative">
          <input
            id="anthropic-api-key-input"
            type={showApiKey ? 'text' : 'password'}
            value={anthropicApiKey}
            onChange={(e) => setAnthropicApiKey(e.target.value)}
            placeholder={isSaved ? '●●●●●●●● (再入力で更新)' : 'sk-ant-xxxxxxxx'}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-[8px] border border-card-border bg-bg px-[12px] py-[8px] pr-[64px] font-mono text-[12px] text-text outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setShowApiKey((v) => !v)}
            className="absolute right-[8px] top-1/2 -translate-y-1/2 rounded-[4px] px-[6px] py-[2px] text-[10px] text-muted hover:text-accent"
          >
            {showApiKey ? '隠す' : '表示'}
          </button>
        </div>
      </section>

      {/* Step 2 */}
      <section
        className={`mb-[20px] rounded-[12px] border border-card-border bg-card p-[16px] ${
          workerUrlValid ? '' : 'pointer-events-none opacity-50'
        }`}
        aria-disabled={!workerUrlValid}
      >
        <h2 className="mb-[12px] text-[14px] font-semibold">
          Step 2. cybozu.com に OAuth クライアントを登録
        </h2>

        <p className="mb-[8px] text-[12px] text-muted">
          以下の値を控えて、cybozu.com 共通管理 → OAuth クライアントの追加画面に貼り付けてください。
        </p>

        <div className="mb-[8px]">
          <p className="mb-[2px] text-[11px] text-text">リダイレクト URI</p>
          <div className="flex items-center gap-[6px]">
            <code
              data-testid="callback-url"
              className="flex-1 truncate rounded-[6px] bg-bg px-[8px] py-[6px] font-mono text-[11px]"
            >
              {callbackUrl || '(Worker URL を入力してください)'}
            </code>
            <button
              type="button"
              disabled={!callbackUrl}
              onClick={() => copyToClipboard(callbackUrl)}
              className="rounded-[6px] border border-card-border px-[8px] py-[4px] text-[11px] text-muted hover:text-accent disabled:opacity-50"
            >
              コピー
            </button>
          </div>
        </div>

        <a
          data-testid="cybozu-admin-link"
          href={cybozuAdminUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-[6px] inline-block rounded-[8px] bg-accent px-[12px] py-[6px] text-[12px] font-medium text-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
            workerUrlValid ? '' : 'pointer-events-none opacity-50'
          }`}
        >
          cybozu.com 共通管理 → OAuth クライアント追加画面を開く ↗
        </a>

        <details className="mt-[12px] text-[11px] text-muted">
          <summary className="cursor-pointer">手順詳細を表示</summary>
          <ol className="mt-[6px] list-decimal pl-[20px] leading-[1.7]">
            <li>上のリンクから OAuth クライアント追加画面を開く</li>
            <li>クライアント名は任意 (例: "Cowork Agent for kintone")</li>
            <li>リダイレクト URI に上のコールバック URL を貼り付ける</li>
            <li>「追加」を押すと client_id / client_secret が表示される</li>
            <li>表示された 2 つを Step 3 に貼り付ける</li>
          </ol>
        </details>
      </section>

      {/* Step 3 */}
      <section
        className={`mb-[20px] rounded-[12px] border border-card-border bg-card p-[16px] ${
          workerUrlValid ? '' : 'pointer-events-none opacity-50'
        }`}
        aria-disabled={!workerUrlValid}
      >
        <h2 className="mb-[12px] text-[14px] font-semibold">
          Step 3. OAuth クライアント情報
        </h2>

        <label className="mb-[4px] block text-[12px] text-text" htmlFor="client-id-input">
          client_id
        </label>
        <input
          id="client-id-input"
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-[8px] border border-card-border bg-bg px-[12px] py-[8px] font-mono text-[12px] text-text outline-none focus:border-accent"
        />

        <label className="mt-[12px] mb-[4px] block text-[12px] text-text" htmlFor="client-secret-input">
          client_secret
        </label>
        <div className="relative">
          <input
            id="client-secret-input"
            type={showSecret ? 'text' : 'password'}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={isSaved ? '●●●●●●●● (再入力で更新)' : ''}
            className="w-full rounded-[8px] border border-card-border bg-bg px-[12px] py-[8px] pr-[64px] font-mono text-[12px] text-text outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            className="absolute right-[8px] top-1/2 -translate-y-1/2 rounded-[4px] px-[6px] py-[2px] text-[10px] text-muted hover:text-accent"
          >
            {showSecret ? '隠す' : '表示'}
          </button>
        </div>

      </section>

      {/* Step 4: kintone 固有 custom skill の Anthropic workspace への同期 (Issue #30) */}
      <section
        className={`mb-[20px] rounded-[12px] border border-card-border bg-card p-[16px] ${
          isSaved ? '' : 'pointer-events-none opacity-50'
        }`}
        aria-disabled={!isSaved}
      >
        <h2 className="mb-[4px] text-[14px] font-semibold">
          Step 4. kintone 固有 Skills を Anthropic workspace に同期 <span className="text-[11px] font-normal text-muted">(任意)</span>
        </h2>
        <p className="mb-[10px] text-[11px] leading-[1.6] text-muted">
          kintone カスタマイズ / Plugin 開発の定石をまとめた skill (<code>kintone-customize-js</code> / <code>kintone-plugin-development</code> 等) を Anthropic workspace にアップロードします。Agent がタスクに応じて自動ロードし、より kintone 固有の精度で回答できるようになります。Plugin 設定保存後に実行してください。
        </p>
        <div className="mb-[8px] flex items-center gap-[6px] text-[11px] text-muted">
          <span>同梱 skill:</span>
          {SKILL_BUNDLES.map((b) => (
            <code
              key={b.name}
              className="rounded-[6px] bg-bg px-[6px] py-[2px] font-mono text-[10px]"
            >
              {b.name}
            </code>
          ))}
          <span className="ml-[6px] opacity-70">version: {SKILLS_VERSION}</span>
          {skillsSynced && (
            <span className="ml-[6px] rounded-[6px] bg-accent-soft px-[6px] py-[1px] text-[10px] text-accent">
              ✓ 最新版が同期済
            </span>
          )}
        </div>
        <button
          type="button"
          data-testid="skills-sync-button"
          onClick={() => void handleSyncSkills()}
          disabled={!isSaved || skillsSyncing}
          className="rounded-[8px] border border-card-border bg-bg px-[12px] py-[6px] text-[12px] font-medium text-text shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-accent disabled:opacity-50"
        >
          {skillsSyncing ? '同期中…' : 'Skills を同期'}
        </button>
        {skillsSyncMessage && (
          <p
            data-testid="skills-sync-message"
            className="mt-[8px] rounded-[8px] bg-accent-soft px-[12px] py-[8px] text-[11px] leading-[1.6] text-accent"
          >
            {skillsSyncMessage}
          </p>
        )}
        {skillsSyncError && (
          <p
            data-testid="skills-sync-error"
            className="mt-[8px] rounded-[8px] border border-warn/40 bg-warn-soft px-[12px] py-[8px] text-[11px] leading-[1.6] text-warn"
          >
            ⚠ {skillsSyncError}
          </p>
        )}
      </section>

      {errorMessage && (
        <div role="alert" className="mb-[12px] rounded-[8px] border border-warn/40 bg-warn-soft px-[12px] py-[8px] text-[12px] text-warn">
          ⚠ {errorMessage}
        </div>
      )}

      <div className="flex gap-[8px]">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className="rounded-[8px] bg-accent px-[14px] py-[8px] text-[13px] font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] disabled:opacity-50"
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
