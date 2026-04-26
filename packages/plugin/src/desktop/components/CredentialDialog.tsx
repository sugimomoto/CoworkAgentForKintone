// Cowork Agent for kintone — kintone 認証情報入力ダイアログ
//
// 未バインディング状態のときに最初の送信で開く。Vault に保存する 3 値
// (KINTONE_DOMAIN / LOGIN / PASSWORD) を入力させ、onSubmit で useUserBinding.bind
// にハンドオフする。

import { useEffect, useId, useState } from 'react';

export interface CredentialDialogProps {
  /** 開閉状態。true で表示、false で何も描画しない。 */
  open: boolean;
  /** domain 入力欄の既定値 (kintone セッションコンテキストから取得) */
  initialDomain?: string;
  /** 「登録」押下時に呼ばれる。Promise 中はボタン disabled + スピナー表示 */
  onSubmit: (values: { domain: string; login: string; password: string }) => Promise<void>;
  /** キャンセル / ESC / 背景クリック時に呼ばれる */
  onClose: () => void;
}

const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export function CredentialDialog({
  open,
  initialDomain = '',
  onSubmit,
  onClose,
}: CredentialDialogProps): JSX.Element | null {
  const [domain, setDomain] = useState(initialDomain);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleId = useId();
  const domainId = useId();
  const loginId = useId();
  const passwordId = useId();

  // 開いた瞬間に初期値で reset (前回失敗値が残らないように)
  useEffect(() => {
    if (open) {
      setDomain(initialDomain);
      setLogin('');
      setPassword('');
      setShowPassword(false);
      setError(null);
    }
  }, [open, initialDomain]);

  // ESC で閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const domainValid = DOMAIN_RE.test(domain);
  const allFilled = domain.trim() !== '' && login.trim() !== '' && password.trim() !== '';
  const canSubmit = !submitting && allFilled && domainValid;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ domain: domain.trim(), login: login.trim(), password });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      data-testid="credential-dialog"
      className="fixed inset-0 z-[200] flex items-center justify-center"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />
      {/* panel */}
      <div className="relative z-[201] w-[360px] max-w-[90vw] rounded-[14px] bg-panel p-[20px] shadow-xl">
        <h2
          id={titleId}
          className="text-[15px] font-semibold text-text"
        >
          kintone 認証情報の登録
        </h2>
        <p className="mt-[6px] text-[12px] text-muted">
          ヘルパーライブラリが kintone API を叩くために、ログイン名とパスワードを Vault に
          安全に保管します。
        </p>

        <form onSubmit={handleSubmit} className="mt-[14px] flex flex-col gap-[10px]">
          <label className="flex flex-col gap-[4px] text-[12px] text-text" htmlFor={domainId}>
            kintone ドメイン
            <input
              id={domainId}
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={submitting}
              placeholder="example.cybozu.com"
              autoComplete="off"
              spellCheck={false}
              className="rounded-[8px] border border-border bg-card px-[10px] py-[8px] text-[13px] text-text outline-none focus:border-accent disabled:opacity-50"
            />
            {!domainValid && domain.length > 0 && (
              <span className="text-[11px] text-warn">
                ドメイン形式が不正です (例: example.cybozu.com)
              </span>
            )}
          </label>

          <label className="flex flex-col gap-[4px] text-[12px] text-text" htmlFor={loginId}>
            ログイン名
            <input
              id={loginId}
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              disabled={submitting}
              autoComplete="username"
              className="rounded-[8px] border border-border bg-card px-[10px] py-[8px] text-[13px] text-text outline-none focus:border-accent disabled:opacity-50"
            />
          </label>

          <label className="flex flex-col gap-[4px] text-[12px] text-text" htmlFor={passwordId}>
            パスワード
            <div className="relative">
              <input
                id={passwordId}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                autoComplete="current-password"
                className="w-full rounded-[8px] border border-border bg-card px-[10px] py-[8px] pr-[64px] text-[13px] text-text outline-none focus:border-accent disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={submitting}
                className="absolute right-[8px] top-1/2 -translate-y-1/2 rounded-[4px] px-[6px] py-[2px] text-[10px] text-muted hover:text-accent"
              >
                {showPassword ? '隠す' : '表示'}
              </button>
            </div>
          </label>

          {error && (
            <div
              role="alert"
              className="rounded-[8px] border border-warn/40 bg-warn-soft px-[10px] py-[8px] text-[12px] text-warn"
            >
              ⚠ {error}
            </div>
          )}

          <div className="mt-[6px] flex justify-end gap-[6px]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-[8px] border border-border px-[12px] py-[6px] text-[12px] text-text hover:bg-accent-soft disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex items-center gap-[6px] rounded-[8px] bg-accent px-[14px] py-[6px] text-[12px] font-medium text-white shadow-[0_2px_8px_rgba(13,148,136,0.33)] disabled:opacity-50"
            >
              {submitting && <Spinner />}
              登録
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Spinner(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      className="animate-spin"
    >
      <path d="M12 2 a 10 10 0 0 1 0 20" />
    </svg>
  );
}
