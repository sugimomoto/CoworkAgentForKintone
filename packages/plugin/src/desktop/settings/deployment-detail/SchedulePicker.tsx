// スケジュール入力 (controlled)。プリセット (毎日/毎週/毎月/カスタム) + 時刻 + tz で cron を
// 組み立て、生成 cron・次回3回プレビュー・DST 注記を表示する。
// Claude Design ハンドオフ (docs/design-handoff/deployments/SchedulePicker.tsx) を移植し、
// クラスをプロジェクトの意味クラスへ置換 (fail/success は専用トークンが無いため literal hex)。

import {
  buildCron,
  cronHuman,
  dstRisk,
  fmtRun,
  nextRuns,
  relDay,
  TIMEZONES,
  type ScheduleValue,
} from '../../../core/deployments/schedule';

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const PRESETS: { id: ScheduleValue['presetType']; label: string }[] = [
  { id: 'daily', label: '毎日' },
  { id: 'weekly', label: '毎週' },
  { id: 'monthly', label: '毎月' },
  { id: 'custom', label: 'カスタム' },
];

interface Props {
  value: ScheduleValue;
  onChange: (next: ScheduleValue) => void;
  /** プレビューの基準時刻。既定 = 現在時刻。 */
  now?: Date;
}

export function SchedulePicker({ value: s, onChange, now = new Date() }: Props): JSX.Element {
  const set = (patch: Partial<ScheduleValue>): void => onChange({ ...s, ...patch });
  const cron = buildCron(s);
  const human = cronHuman(cron);
  const runs = nextRuns(cron, now, 3);
  const cronValid = runs.length > 0;
  const risk = dstRisk(s);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = [0, 5, 10, 15, 20, 30, 45];

  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-card-hi">
      {/* プリセット セグメント */}
      <div className="flex gap-0.5 border-b border-border bg-card p-2">
        {PRESETS.map((p) => {
          const on = s.presetType === p.id;
          return (
            <button
              key={p.id}
              type="button"
              data-testid={`schedule-preset-${p.id}`}
              onClick={() => set({ presetType: p.id })}
              className={`flex-1 rounded-[7px] px-1.5 py-2 text-xs ${
                on ? 'bg-accent font-semibold text-white' : 'font-medium text-muted'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="px-3.5 pb-1 pt-3.5">
        {s.presetType === 'weekly' && (
          <FieldRow label="曜日">
            <div className="flex gap-1">
              {WD.map((w, i) => {
                const on = s.weekday === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => set({ weekday: i })}
                    className={`h-[30px] w-[30px] rounded-[7px] border text-xs ${
                      on
                        ? 'border-accent bg-accent-soft font-bold text-accent'
                        : 'border-border bg-card font-medium'
                    } ${!on && i === 0 ? 'text-[#dc2626]' : ''} ${!on && i === 6 ? 'text-accent' : ''} ${
                      !on && i > 0 && i < 6 ? 'text-muted' : ''
                    }`}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          </FieldRow>
        )}

        {s.presetType === 'monthly' && (
          <FieldRow label="日">
            <div className="flex items-center gap-2">
              <select
                value={s.monthday}
                onChange={(e) => set({ monthday: +e.target.value })}
                className="min-w-[86px] rounded-[7px] border border-border bg-card px-2.5 py-[7px] text-[12.5px] text-text outline-none"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}日
                  </option>
                ))}
              </select>
              <span className="text-[10.5px] text-subtle">
                29〜31日は月により実行されないため 28日まで
              </span>
            </div>
          </FieldRow>
        )}

        {s.presetType === 'custom' && (
          <FieldRow label="cron 式">
            <div className="flex-1">
              <input
                value={s.customCron}
                onChange={(e) => set({ customCron: e.target.value })}
                data-testid="schedule-custom-cron"
                className={`w-full rounded-[7px] border bg-card px-2.5 py-[7px] font-mono text-[13px] tracking-wide text-text outline-none ${
                  cronValid ? 'border-border' : 'border-[#dc2626]'
                }`}
              />
              <div className="mt-1 flex gap-3 pl-0.5 font-mono text-[9.5px] text-subtle">
                <span>分</span>
                <span>時</span>
                <span>日</span>
                <span>月</span>
                <span>曜日</span>
              </div>
            </div>
          </FieldRow>
        )}

        {s.presetType !== 'custom' && (
          <FieldRow label="時刻">
            <div className="flex items-center gap-1.5">
              <NumSelect value={s.hour} onChange={(v) => set({ hour: v })}>
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}時
                  </option>
                ))}
              </NumSelect>
              <span className="text-subtle">:</span>
              <NumSelect value={s.minute} onChange={(v) => set({ minute: v })}>
                {mins.map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}分
                  </option>
                ))}
              </NumSelect>
            </div>
          </FieldRow>
        )}

        <FieldRow label="タイムゾーン" last>
          <select
            value={s.tz}
            onChange={(e) => set({ tz: e.target.value })}
            className="min-w-[180px] rounded-[7px] border border-border bg-card px-2.5 py-[7px] text-[12.5px] text-text outline-none"
          >
            {TIMEZONES.map((t) => (
              <option key={t} value={t}>
                {t}
                {t === 'Asia/Tokyo' ? ' (既定)' : ''}
              </option>
            ))}
          </select>
        </FieldRow>
      </div>

      {/* 生成された cron + 次回プレビュー */}
      <div className="border-t border-border bg-card px-3.5 py-3">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-subtle">
            生成された cron
          </span>
          <span
            data-testid="schedule-cron-out"
            className={`rounded border border-border bg-card-hi px-2 py-0.5 font-mono text-[12.5px] font-semibold tracking-wide ${
              cronValid ? 'text-text' : 'text-[#dc2626]'
            }`}
          >
            {cron || '— — — — —'}
          </span>
          {human && <span className="text-[11px] font-medium text-accent">= {human}</span>}
          {!cronValid && <span className="text-[10.5px] text-[#dc2626]">式を確認してください</span>}
        </div>

        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-subtle">
          次回の実行予定（直近3回）
        </div>
        <div className="flex flex-col gap-1">
          {cronValid ? (
            runs.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[11.5px]">
                <span
                  className={`flex h-4 w-4 flex-none items-center justify-center rounded-full text-[9px] font-bold ${
                    i === 0 ? 'bg-accent text-white' : 'bg-accent-soft text-accent'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="font-mono text-text">{fmtRun(r)}</span>
                <span className="text-[10px] text-accent">{relDay(r, now)}</span>
              </div>
            ))
          ) : (
            <div className="pl-0.5 text-[11.5px] text-subtle">
              有効な cron 式を入力すると予定が表示されます
            </div>
          )}
        </div>

        {/* DST 注記 — リスク時のみ warn 強調 */}
        <div
          className={`mt-3 flex gap-2 rounded-lg p-2.5 ${
            risk ? 'border border-[#f0c98a] bg-warn-soft' : 'border border-dashed border-border bg-card-hi'
          }`}
        >
          <span className={`mt-px flex-none ${risk ? 'text-warn' : 'text-subtle'}`}>
            {risk ? <AlertSvg /> : <InfoSvg />}
          </span>
          <div className={`text-[10.5px] leading-[1.55] ${risk ? 'text-warn' : 'text-muted'}`}>
            {risk ? (
              <>
                <strong>夏時間（DST）に注意：</strong>
                選択中の地域では 1〜3 時台はDST境界で実行が飛ぶ／重複する場合があります。時刻をずらすか
                UTC を推奨します。
              </>
            ) : (
              <>
                夏時間のある地域では 1〜3
                時台の実行が境界日に飛ぶ／重複することがあります。確実に動かすなら UTC か 0〜1
                時を避けた時刻を選んでください。
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}): JSX.Element {
  return (
    <div className={`flex items-start gap-3.5 ${last ? 'pb-1.5' : 'pb-3.5'}`}>
      <div className="w-[84px] flex-none pt-[7px] text-[11.5px] font-semibold text-text">{label}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function NumSelect({
  value,
  onChange,
  children,
}: {
  value: number;
  onChange: (v: number) => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(+e.target.value)}
      className="min-w-[64px] rounded-[7px] border border-border bg-card px-2.5 py-[7px] text-[12.5px] text-text outline-none"
    >
      {children}
    </select>
  );
}

function AlertSvg(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2l6 11H2z" />
      <path d="M8 6.5v3.2M8 11.4h.01" />
    </svg>
  );
}

function InfoSvg(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.2v4M8 5h.01" />
    </svg>
  );
}
