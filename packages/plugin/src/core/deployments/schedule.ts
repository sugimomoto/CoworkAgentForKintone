// cron スケジュールの純ロジック (フレームワーク非依存)。
// Claude Design ハンドオフ (docs/design-handoff/deployments/deployments.ts) の cron 部分を移植。
//
// プリセット (毎日/毎週/毎月) 由来の形をサポート。カスタム cron は人間可読化が
// 不可能なとき null を返し、UI は「カスタム」と表示する。
// nextRuns はローカル時刻ベースの近似 — 保存済みの「次回実行」は API の
// schedule.upcoming_runs_at (真値) を使い、ここは作成/編集モーダルのプレビュー専用。

const WEEKDAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

export type PresetType = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface ScheduleValue {
  presetType: PresetType;
  hour: number; // 0–23
  minute: number; // 0–55 (5 分刻み, MINUTE_OPTIONS)
  weekday: number; // 0(日)–6(土)  ※ weekly のとき
  monthday: number; // 1–28  ※ monthly のとき (29–31 は月により飛ぶため 28 まで)
  customCron: string; // custom のとき
  tz: string; // IANA
}

/** 時刻セレクタの分の選択肢 (5 分刻みの全 12 値)。歯抜けがあると編集時に既存値が化ける。 */
export const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

export interface CronParts {
  mi: string;
  h: string;
  dom: string;
  mon: string;
  dow: string;
}

export const DEFAULT_TZ = 'Asia/Tokyo';

export const TIMEZONES = [
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
] as const;

export function parseCron(expr: string): CronParts {
  const p = (expr || '').trim().split(/\s+/);
  return { mi: p[0] ?? '', h: p[1] ?? '', dom: p[2] ?? '', mon: p[3] ?? '', dow: p[4] ?? '' };
}

/**
 * cron 式を日本語の可読表記に変換。非定形 (範囲・ステップ・複数値など) は null。
 *   "0 9 * * *"  → "毎日 9:00" / "0 8 * * 1" → "毎週 月 8:00" / "0 10 1 * *" → "毎月 1日 10:00"
 */
export function cronHuman(expr: string): string | null {
  const c = parseCron(expr);
  if ([c.mi, c.h].some((x) => x === '' || x === '*' || /[*/,-]/.test(x))) return null;
  if (c.mon !== '*') return null;
  const t = `${+c.h}:${String(+c.mi).padStart(2, '0')}`;
  const domAny = c.dom === '*';
  const dowAny = c.dow === '*';
  if (domAny && dowAny) return `毎日 ${t}`;
  if (domAny && /^[0-6](,[0-6])*$/.test(c.dow)) {
    return `毎週 ${c.dow
      .split(',')
      .map((d) => WEEKDAYS_JP[+d])
      .join('・')} ${t}`;
  }
  if (!domAny && dowAny && /^\d{1,2}$/.test(c.dom)) return `毎月 ${+c.dom}日 ${t}`;
  return null;
}

/**
 * 次回以降の実行時刻を count 件計算 (プレビュー専用)。daily/weekly/monthly を最小サポート。
 * dom と dow が両方指定なら cron 準拠で OR。tz 厳密化は別途 (ローカル近似)。
 */
export function nextRuns(expr: string, from: Date, count: number): Date[] {
  // 5 フィールド揃っていない式は無効扱い (空文字や 'bad cron' を弾く)
  if ((expr || '').trim().split(/\s+/).length !== 5) return [];
  const c = parseCron(expr);
  const mi = +c.mi;
  const h = +c.h;
  if (c.mi === '' || c.h === '' || Number.isNaN(mi) || Number.isNaN(h)) return [];
  const domList = c.dom === '*' ? null : c.dom.split(',').map(Number);
  const dowList = c.dow === '*' ? null : c.dow.split(',').map(Number);
  const res: Date[] = [];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  for (let i = 0; i < 800 && res.length < count; i++) {
    const cand = new Date(day);
    cand.setHours(h, mi, 0, 0);
    if (cand > from) {
      const okDom = !domList || domList.includes(cand.getDate());
      const okDow = !dowList || dowList.includes(cand.getDay());
      const ok = domList && dowList ? okDom || okDow : okDom && okDow;
      if (ok) res.push(new Date(cand));
    }
    day.setDate(day.getDate() + 1);
  }
  return res;
}

export function fmtRun(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} (${WEEKDAYS_JP[d.getDay()]}) ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function relDay(d: Date, from: Date): string {
  const a = new Date(d);
  a.setHours(0, 0, 0, 0);
  const b = new Date(from);
  b.setHours(0, 0, 0, 0);
  const diff = Math.round((+a - +b) / 86_400_000);
  if (diff < 0) return '';
  if (diff === 0) return '今日';
  if (diff === 1) return '明日';
  if (diff === 2) return '明後日';
  return `${diff}日後`;
}

export function buildCron(s: ScheduleValue): string {
  if (s.presetType === 'custom') return s.customCron;
  if (s.presetType === 'daily') return `${s.minute} ${s.hour} * * *`;
  if (s.presetType === 'weekly') return `${s.minute} ${s.hour} * * ${s.weekday}`;
  return `${s.minute} ${s.hour} ${s.monthday} * *`; // monthly
}

/** DST 注意の判定。夏時間のある地域 × 1〜3 時台は境界で実行が飛ぶ/重複しうる。 */
export function dstRisk(s: ScheduleValue): boolean {
  return s.tz !== 'Asia/Tokyo' && s.tz !== 'UTC' && [1, 2, 3].includes(+s.hour);
}

/** 一覧の「スケジュール」列に出す短い可読表記。cronHuman の null は「カスタム」に丸める。 */
export function scheduleSummary(cron: string): string {
  return cronHuman(cron) ?? 'カスタム';
}

/** 既定の ScheduleValue (作成時の初期値: 毎日 9:00 JST)。 */
export function defaultSchedule(): ScheduleValue {
  return {
    presetType: 'daily',
    hour: 9,
    minute: 0,
    weekday: 1,
    monthday: 1,
    customCron: '',
    tz: DEFAULT_TZ,
  };
}

/** 保存済み cron + tz から ScheduleValue を復元 (編集モーダルの初期化)。
 *  daily/weekly/monthly に当てはまらなければ custom 扱い。 */
export function scheduleFromCron(cron: string, tz: string): ScheduleValue {
  const base = { ...defaultSchedule(), tz: tz || DEFAULT_TZ };
  const c = parseCron(cron);
  const mi = +c.mi;
  const h = +c.h;
  const numeric = /^\d+$/;
  const timeOk = numeric.test(c.mi) && numeric.test(c.h);
  if (timeOk && c.mon === '*') {
    if (c.dom === '*' && c.dow === '*') {
      return { ...base, presetType: 'daily', hour: h, minute: mi };
    }
    if (c.dom === '*' && /^[0-6]$/.test(c.dow)) {
      return { ...base, presetType: 'weekly', hour: h, minute: mi, weekday: +c.dow };
    }
    if (c.dow === '*' && /^\d{1,2}$/.test(c.dom) && +c.dom >= 1 && +c.dom <= 28) {
      return { ...base, presetType: 'monthly', hour: h, minute: mi, monthday: +c.dom };
    }
  }
  return { ...base, presetType: 'custom', customCron: cron };
}
