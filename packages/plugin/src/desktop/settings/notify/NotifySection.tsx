// NotifySection.tsx — 「通知先 Webhook」セクション (#13)
//
// AgentDetailModal 本文に挿入する controlled component。Agent ごとに1本の
// Slack / Teams Incoming Webhook を登録する。送信ポリシー (いつ送るか) は
// 扱わない＝「宛先の登録」だけ。
//
// 配色は CSS 変数トークン (--cw-*) を Tailwind の arbitrary value で参照。
//
// ── 状態 ──
//   value === null                   → 未設定 (空の入力)
//   value === { platform, url }      → 入力中の下書き (url あり＝編集継続)
//   value === { platform }(url 省略)  → 登録済み・伏字 (生 URL は再表示しない)
//
// セキュリティ: 生 URL は保存後に二度と表示しない (パスワード入力と同じ扱い)。
import { useEffect, useState, type ReactNode, type SVGProps } from 'react';

import {
  type WebhookConfig,
  type WebhookPlatform,
  detectPlatform,
  isSupportedPlatform,
  PLATFORM_META,
  maskedSecret,
} from './webhookPlatform';

interface Props {
  /** 親が保持する working copy。null=未設定、{platform}(url 無し)=登録済み伏字。 */
  value: WebhookConfig | null;
  /** 値が変わるたびに呼ばれる (typing 中も)。null=解除。親はフッタ保存で永続化。 */
  onChange: (next: WebhookConfig | null) => void;
  /** フッタ「保存」ボタンの活性制御に使う (有効な新 URL が入っているか)。 */
  onValidityChange?: (canSave: boolean) => void;
  /** 接続テスト。未指定ならテスト UI を出さない。true=成功 / false=失敗。 */
  onTest?: () => Promise<boolean>;
  /** ポップオーバー等で見出しを省きたいとき。 */
  hideHeader?: boolean;
}

type TestState = 'idle' | 'sending' | 'success' | 'fail';

export function NotifySection({ value, onChange, onValidityChange, onTest, hideHeader }: Props) {
  const persisted = value != null && value.url === undefined; // 伏字表示の対象
  const [editing, setEditing] = useState(false); // 伏字を上書き編集中
  const [draft, setDraft] = useState(''); // 入力テキスト
  const [show, setShow] = useState(true); // 表示/隠す トグル
  const [confirm, setConfirm] = useState(false); // 解除確認
  const [test, setTest] = useState<TestState>('idle');

  const inEdit = !persisted || editing;
  const det = detectPlatform(draft);
  const valid = isSupportedPlatform(det.kind);
  const canSave = inEdit && valid;

  useEffect(() => {
    onValidityChange?.(canSave);
  }, [canSave]); // eslint-disable-line react-hooks/exhaustive-deps

  // typing → 親の working copy を更新。未設定からの入力は無効中 null、上書き編集中は
  // 有効になるまで既存値を維持 (誤って解除しない)。
  useEffect(() => {
    if (!inEdit) return;
    if (valid) onChange({ platform: det.kind as WebhookPlatform, url: draft.trim() });
    else if (!persisted) onChange(null);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = () => {
    setEditing(true);
    setDraft('');
    setShow(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
  };
  const unlink = () => {
    setConfirm(false);
    setEditing(false);
    setDraft('');
    setTest('idle');
    onChange(null);
  };
  const runTest = async () => {
    if (!onTest) return;
    setTest('sending');
    try {
      setTest((await onTest()) ? 'success' : 'fail');
    } catch {
      setTest('fail');
    }
  };

  const header = !hideHeader && (
    <SectionLabel>
      <BellIcon className="text-[var(--cw-accent)]" />
      通知
      <span className="font-normal normal-case tracking-normal text-[10px] text-[var(--cw-subtle)]">
        処理結果を Slack / Teams / Discord に送信
      </span>
      <span className="ml-auto inline-flex items-center gap-1 rounded-[3px] border border-[var(--cw-border)] bg-[var(--cw-card-hi)] px-1.5 py-px text-[9px] font-semibold tracking-normal text-[var(--cw-muted)]">
        <LockIcon className="h-2.5 w-2.5" /> 宛先1本 / Agent
      </span>
    </SectionLabel>
  );

  // ── 登録済み (伏字) ──
  if (persisted && !editing) {
    const meta = PLATFORM_META[value.platform];
    return (
      <div>
        {header}
        <div className="rounded-[12px] border border-[var(--cw-card-border)] bg-[var(--cw-card)] p-[14px_16px]">
          <FieldHead
            label="通知先 Webhook URL"
            right={
              <span className="inline-flex items-center gap-1 text-[9.5px] text-[var(--cw-subtle)]">
                <LockIcon className="h-2.5 w-2.5" />
                保存済み
              </span>
            }
          />
          {/* 伏字フィールド (生 URL は二度と表示しない) */}
          <div className="flex items-center gap-2.5 rounded-[7px] border border-[var(--cw-border)] bg-[var(--cw-card-hi)] px-[11px] py-2">
            <LockIcon className="text-[var(--cw-subtle)]" />
            <span className="flex-1 select-none font-mono text-xs tracking-[2px] text-[var(--cw-muted)]">
              {maskedSecret()}
            </span>
            <PlatformBadge platform={value.platform} />
          </div>

          {!confirm ? (
            <>
              <div className="mt-[11px] flex items-center gap-2">
                <span className="h-[7px] w-[7px] flex-none rounded-full bg-[#22c55e]" />
                <span className="text-xs font-medium text-[var(--cw-text)]">
                  {meta.label} に設定済み
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={startEdit}
                  className="text-[11px] font-semibold text-[var(--cw-accent)]"
                >
                  再入力で更新
                </button>
                <span className="h-[11px] w-px bg-[var(--cw-border)]" />
                <button
                  type="button"
                  onClick={() => setConfirm(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--cw-warn)]"
                >
                  <UnlinkIcon className="h-3 w-3" />
                  解除
                </button>
              </div>

              {onTest && (
                <div className="mt-3 flex items-center gap-2.5 border-t border-[var(--cw-border)] pt-3">
                  <button
                    type="button"
                    onClick={runTest}
                    disabled={test === 'sending'}
                    className="inline-flex items-center gap-1.5 rounded-[7px] border border-[var(--cw-accent)]/20 bg-[var(--cw-accent-soft)] px-[11px] py-1.5 text-[11.5px] font-semibold text-[var(--cw-accent)] disabled:cursor-default"
                  >
                    {test === 'sending' ? <SpinnerIcon /> : <SendIcon />}
                    テスト送信
                  </button>
                  {test === 'sending' && (
                    <span className="text-[11px] text-[var(--cw-muted)]">送信中…</span>
                  )}
                  {test === 'success' && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--cw-success)]">
                      <CheckIcon />
                      テスト通知を送信しました
                    </span>
                  )}
                  {test === 'fail' && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--cw-danger)]">
                      <AlertIcon />
                      送信に失敗 — URL を確認してください
                    </span>
                  )}
                </div>
              )}

              <div className="mt-2.5 flex gap-1.5 text-[10.5px] leading-[1.5] text-[var(--cw-subtle)]">
                <ShieldIcon className="mt-px flex-none" />
                <span>保存後の URL は表示されません。変更するには再入力してください。</span>
              </div>
            </>
          ) : (
            // ── 解除確認 (インライン) ──
            <div className="mt-[11px] rounded-[9px] border border-[#f0c98a] bg-[var(--cw-warn-soft)] p-[11px_13px]">
              <div className="flex gap-2">
                <UnlinkIcon className="mt-px flex-none text-[var(--cw-warn)]" />
                <div>
                  <div className="text-[12.5px] font-bold text-[var(--cw-text)]">
                    この Agent の通知先を解除しますか？
                  </div>
                  <div className="mt-0.5 text-[11px] leading-[1.55] text-[var(--cw-warn)]">
                    このエージェントは結果を通知しなくなります。Webhook URL の登録は削除されます。
                  </div>
                </div>
              </div>
              <div className="mt-[11px] flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirm(false)}
                  className="rounded-[7px] border border-[var(--cw-border)] px-3 py-1.5 text-xs font-medium text-[var(--cw-text)]"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={unlink}
                  className="inline-flex items-center gap-1 rounded-[7px] bg-[var(--cw-warn)] px-3.5 py-1.5 text-xs font-semibold text-white"
                >
                  <UnlinkIcon className="h-3 w-3" />
                  解除する
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 未設定 / 入力中 / 上書き編集 ──
  let hint: string;
  let tone: 'muted' | 'subtle' | 'warn' | 'accent';
  if (det.kind === 'empty') {
    hint =
      'Slack / Teams / Discord の Incoming Webhook URL を貼り付けると、このエージェントが結果を通知できます。';
    tone = 'muted';
  } else if (det.kind === 'slack') {
    hint = 'Slack の Incoming Webhook を検出しました。';
    tone = 'accent';
  } else if (det.kind === 'teams') {
    hint = 'Microsoft Teams の Incoming Webhook を検出しました。';
    tone = 'accent';
  } else if (det.kind === 'discord') {
    hint = 'Discord の Webhook を検出しました。';
    tone = 'accent';
  } else if (det.kind === 'unsupported') {
    hint = '対応していない Webhook です (Slack / Teams / Discord のみ対応)。';
    tone = 'warn';
  } else {
    hint = 'URL の形式を確認してください。';
    tone = 'subtle';
  }

  const toneClass = {
    muted: 'text-[var(--cw-muted)]',
    subtle: 'text-[var(--cw-subtle)]',
    warn: 'text-[var(--cw-warn)]',
    accent: 'text-[var(--cw-accent)]',
  }[tone];
  const borderClass =
    det.kind === 'unsupported'
      ? 'border-[var(--cw-warn)]'
      : valid
        ? 'border-[var(--cw-accent)]'
        : 'border-[var(--cw-border)]';

  return (
    <div>
      {header}
      <div className="rounded-[12px] border border-[var(--cw-card-border)] bg-[var(--cw-card)] p-[14px_16px]">
        <FieldHead
          label="通知先 Webhook URL"
          right={
            editing ? (
              <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-[var(--cw-warn)]">
                <AlertIcon className="h-2.5 w-2.5" />
                現在の設定を上書き
              </span>
            ) : null
          }
        />

        <div className="relative flex items-center">
          <input
            type={show ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://hooks.slack.com/services/T000/B000/XXXXXXXX"
            spellCheck={false}
            autoComplete="off"
            className={`w-full rounded-[7px] border ${borderClass} bg-[var(--cw-card)] px-[11px] py-2 font-mono text-xs text-[var(--cw-text)] outline-none ${valid ? 'pr-[116px]' : 'pr-[42px]'}`}
          />
          <span className="absolute right-2 flex items-center gap-[7px]">
            {valid && <PlatformBadge platform={det.kind as WebhookPlatform} />}
            <button
              type="button"
              title={show ? '隠す' : '表示'}
              onClick={() => setShow((v) => !v)}
              className="flex text-[var(--cw-subtle)]"
            >
              {show ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </span>
        </div>

        <div className={`mt-1.5 flex gap-1.5 text-[10.5px] leading-[1.55] ${toneClass}`}>
          {tone === 'warn' && <AlertIcon className="mt-px flex-none" />}
          {tone === 'accent' && <CheckIcon className="mt-px flex-none" />}
          <span>{hint}</span>
        </div>

        {editing && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={cancelEdit}
              className="text-[11px] font-medium text-[var(--cw-muted)]"
            >
              上書きをやめる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── プラットフォーム バッジ (モデルバッジと同トーンの小 pill) ──
export function PlatformBadge({ platform, lg }: { platform: WebhookPlatform; lg?: boolean }) {
  const m = PLATFORM_META[platform];
  const Glyph =
    platform === 'slack' ? SlackGlyph : platform === 'discord' ? DiscordGlyph : TeamsGlyph;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-[3px] border font-mono font-bold leading-tight ${lg ? 'gap-1.5 px-2 py-[2.5px] text-[11px]' : 'gap-1 px-1.5 py-px text-[9.5px]'}`}
      style={{ color: m.color, background: m.soft, borderColor: `${m.color}44` }}
    >
      <Glyph style={{ color: m.color }} /> {m.label}
    </span>
  );
}

// ── 通知インジケータ (一覧行) ──
export function NotifyIndicator({ platform, mini }: { platform: WebhookPlatform; mini?: boolean }) {
  const m = PLATFORM_META[platform];
  if (mini) {
    return (
      <span
        title={`${m.label} に通知`}
        className="inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px]"
        style={{ color: m.color, background: m.soft }}
      >
        <BellIcon className="h-[11px] w-[11px]" />
      </span>
    );
  }
  return (
    <span
      title={`${m.label} に通知`}
      className="inline-flex items-center gap-1 rounded-full py-px pl-1.5 pr-[7px] text-[9.5px] font-semibold"
      style={{ color: m.color, background: m.soft }}
    >
      <BellIcon className="h-2.5 w-2.5" /> 通知
      <span className="h-[5px] w-[5px] rounded-full" style={{ background: m.color }} />
    </span>
  );
}

// ── 小コンポーネント ──
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="m-[0_0_9px_2px] flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.6px] text-[var(--cw-muted)]">
      {children}
    </div>
  );
}
function FieldHead({ label, right }: { label: string; right?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span className="text-[11.5px] font-semibold text-[var(--cw-text)]">{label}</span>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

// ── アイコン (インライン SVG・currentColor) ──
type IcoProps = Omit<SVGProps<SVGSVGElement>, 'd'>;
const Ico = ({
  d,
  sw = 1.6,
  fill = 'none',
  className,
  ...p
}: IcoProps & { d: ReactNode; sw?: number }) => (
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill={fill}
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...p}
  >
    {d}
  </svg>
);
const BellIcon = (p: IcoProps) => (
  <Ico
    {...p}
    d={
      <>
        <path d="M4 7a4 4 0 018 0c0 3 1 4 1 4H3s1-1 1-4z" />
        <path d="M6.6 13.2a1.6 1.6 0 002.8 0" />
      </>
    }
  />
);
const LockIcon = (p: IcoProps) => (
  <Ico
    {...p}
    d={
      <>
        <rect x="3.5" y="7" width="9" height="6" rx="1.4" />
        <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
      </>
    }
  />
);
const ShieldIcon = (p: IcoProps) => (
  <Ico
    {...p}
    d={
      <>
        <path d="M8 1.8l5 2v3.4c0 3.2-2.1 5.4-5 6.4-2.9-1-5-3.2-5-6.4V3.8z" />
        <path d="M5.8 8l1.6 1.6L10.4 6.6" />
      </>
    }
  />
);
const EyeIcon = (p: IcoProps) => (
  <Ico
    {...p}
    d={
      <>
        <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4S1.5 8 1.5 8z" />
        <circle cx="8" cy="8" r="1.8" />
      </>
    }
  />
);
const EyeOffIcon = (p: IcoProps) => (
  <Ico
    {...p}
    d={
      <>
        <path d="M6.2 4.3A6.7 6.7 0 018 4c4.1 0 6.5 4 6.5 4a11 11 0 01-1.9 2.2M3.4 5.4A11 11 0 001.5 8s2.4 4 6.5 4a6.6 6.6 0 002-.3" />
        <path d="M2 2l12 12" />
      </>
    }
  />
);
const SendIcon = (p: IcoProps) => (
  <Ico
    {...p}
    d={
      <>
        <path d="M14 2L2 7l4.5 1.8L8 13l2-4.5z" />
        <path d="M14 2L6.5 8.8" />
      </>
    }
  />
);
const CheckIcon = (p: IcoProps) => <Ico {...p} sw={2} d={<path d="M3 8.2l2.6 2.6L13 4" />} />;
const AlertIcon = (p: IcoProps) => (
  <Ico
    {...p}
    d={
      <>
        <path d="M8 2l6 11H2z" />
        <path d="M8 6.5v3.2M8 11.4h.01" />
      </>
    }
  />
);
const UnlinkIcon = (p: IcoProps) => (
  <Ico
    {...p}
    d={
      <>
        <path d="M6.5 9.5L9.5 6.5" />
        <path d="M5 7l-1.3 1.3a2.3 2.3 0 003.3 3.3L8.3 11M11 9l1.3-1.3a2.3 2.3 0 00-3.3-3.3L7.7 5" />
        <path d="M2 2l1.5 1.5M14 14l-1.5-1.5" />
      </>
    }
  />
);
const SlackGlyph = (p: IcoProps) => (
  <Ico {...p} width="11" height="11" sw={1.7} d={<path d="M6 3L5 13M11 3l-1 10M3 6h10M2.5 10.5h10" />} />
);
const TeamsGlyph = (p: IcoProps) => (
  <Ico
    {...p}
    width="11"
    height="11"
    sw={1.5}
    d={
      <path d="M2.5 4.5a1.5 1.5 0 011.5-1.5h8a1.5 1.5 0 011.5 1.5v4A1.5 1.5 0 0112 10H7l-3 2.5V10a1.5 1.5 0 01-1.5-1.5z" />
    }
  />
);
const DiscordGlyph = (p: IcoProps) => (
  <Ico
    {...p}
    width="11"
    height="11"
    sw={1.4}
    d={
      <>
        <path d="M5 4.5a9 9 0 016 0M5.5 11.5a9 9 0 005 0" />
        <path d="M5.5 4.2C3.8 4.6 2.7 6 2.4 8.2c-.2 1.4 0 2.4.3 3 .6.6 1.4 1 2.3 1.2l.6-1M10.5 4.2c1.7.4 2.8 1.8 3.1 4 .2 1.4 0 2.4-.3 3-.6.6-1.4 1-2.3 1.2l-.6-1" />
        <path d="M6.3 8.6h.01M9.7 8.6h.01" />
      </>
    }
  />
);
const SpinnerIcon = (p: IcoProps) => (
  <Ico
    {...p}
    width="13"
    height="13"
    sw={1.8}
    className={`animate-spin ${p.className ?? ''}`}
    d={<path d="M8 2a6 6 0 106 6" />}
  />
);
