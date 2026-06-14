// Cloudflare Workers デプロイの状態機械 + バージョンポーリングを担うフック。
// ConfigScreen から切り出した (Phase 3 PR-E)。
//
// AC-4: ポーリング中にアンマウントされたら以降の setState を行わない (cancelledRef)。

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CloudflareApiError,
  deployWorker,
  fetchDeployedWorkerVersion,
} from '../../core/cloudflare/cfDeploy';
import { CLOUDFLARE_WORKER_SCRIPT_NAME } from '../../core/constants';
import { sleep, toErrorMessage } from '../../core/utils';
import { WORKER_BUNDLE_JS, WORKER_BUNDLE_VERSION } from '../../generated/worker-bundle';

const VERSION_POLL_RETRIES = 5;
const VERSION_POLL_INTERVAL_MS = 1000;

export interface CloudflareDeployment {
  deploying: boolean;
  message: string | null;
  error: string | null;
  /** デプロイを実行する。成功で workerUrl が確定したら onWorkerUrl が呼ばれる。 */
  deploy: (apiToken: string, accountId: string) => Promise<void>;
}

export function useCloudflareDeployment(
  onWorkerUrl: (url: string) => void,
): CloudflareDeployment {
  const [deploying, setDeploying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // アンマウント後の setState を防ぐ (ポーリングが長く回る可能性があるため)
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const deploy = useCallback(
    async (apiToken: string, accountId: string): Promise<void> => {
      setDeploying(true);
      setMessage(
        'Worker をデプロイ中… (subdomain 取得 → script アップロード → workers.dev 有効化)',
      );
      setError(null);

      try {
        const result = await deployWorker({
          apiToken,
          accountId,
          scriptName: CLOUDFLARE_WORKER_SCRIPT_NAME,
          workerJsContent: WORKER_BUNDLE_JS,
        });
        if (cancelledRef.current) return;

        onWorkerUrl(result.workerUrl);
        setMessage(`デプロイ成功: ${result.workerUrl}\nWorker /version を照合中…`);

        // Cloudflare のエッジ反映に若干ラグがあるので retry。
        let info = null;
        for (let i = 0; i < VERSION_POLL_RETRIES; i++) {
          info = await fetchDeployedWorkerVersion(result.workerUrl);
          if (cancelledRef.current) return;
          if (info && info.version === WORKER_BUNDLE_VERSION) break;
          await sleep(VERSION_POLL_INTERVAL_MS);
          if (cancelledRef.current) return;
        }

        if (!info) {
          setError(
            `デプロイは成功しましたが /version エンドポイントが応答しません。\nWorker URL: ${result.workerUrl}\n手動で ${result.workerUrl}/version を開いて確認してください。`,
          );
          setMessage(null);
        } else if (info.version !== WORKER_BUNDLE_VERSION) {
          setError(
            `デプロイ後のバージョン照合に失敗:\n  期待: ${WORKER_BUNDLE_VERSION}\n  実測: ${info.version}\nブラウザキャッシュ or プロキシキャッシュの可能性。${result.workerUrl}/version を開いて確認してください。`,
          );
          setMessage(null);
        } else {
          setMessage(
            `✓ デプロイ成功\n  URL: ${result.workerUrl}\n  Version: ${info.version}\n  Built At: ${info.builtAt}`,
          );
        }
      } catch (err) {
        if (cancelledRef.current) return;
        const msg =
          err instanceof CloudflareApiError
            ? `Cloudflare API エラー (${err.status}): ${err.message}\n${err.responseBody.slice(0, 300)}`
            : toErrorMessage(err);
        setError(msg);
        setMessage(null);
      } finally {
        if (!cancelledRef.current) setDeploying(false);
      }
    },
    [onWorkerUrl],
  );

  return { deploying, message, error, deploy };
}
