import { describe, expect, it } from 'vitest';

import { buildCron, cronHuman, dstRisk, nextRuns, scheduleSummary, type ScheduleValue } from './schedule';

describe('buildCron', () => {
  const base: ScheduleValue = {
    presetType: 'daily',
    hour: 9,
    minute: 0,
    weekday: 1,
    monthday: 1,
    customCron: '',
    tz: 'Asia/Tokyo',
  };
  it('daily', () => expect(buildCron({ ...base, presetType: 'daily' })).toBe('0 9 * * *'));
  it('weekly', () =>
    expect(buildCron({ ...base, presetType: 'weekly', weekday: 1, hour: 8 })).toBe('0 8 * * 1'));
  it('monthly', () =>
    expect(buildCron({ ...base, presetType: 'monthly', monthday: 1, hour: 10 })).toBe('0 10 1 * *'));
  it('custom はそのまま', () =>
    expect(buildCron({ ...base, presetType: 'custom', customCron: '*/5 * * * *' })).toBe('*/5 * * * *'));
});

describe('cronHuman', () => {
  it('毎日', () => expect(cronHuman('0 9 * * *')).toBe('毎日 9:00'));
  it('毎週単一曜日', () => expect(cronHuman('0 8 * * 1')).toBe('毎週 月 8:00'));
  it('毎週複数曜日', () => expect(cronHuman('30 7 * * 1,3,5')).toBe('毎週 月・水・金 7:30'));
  it('毎月', () => expect(cronHuman('0 10 1 * *')).toBe('毎月 1日 10:00'));
  it('非定形は null', () => {
    expect(cronHuman('*/5 * * * *')).toBeNull();
    expect(cronHuman('0 9-17 * * *')).toBeNull();
    expect(cronHuman('0 9 1 6 *')).toBeNull(); // 月指定はサポート外
  });
});

describe('scheduleSummary', () => {
  it('可読は人間表記', () => expect(scheduleSummary('0 9 * * *')).toBe('毎日 9:00'));
  it('非定形はカスタム', () => expect(scheduleSummary('*/5 * * * *')).toBe('カスタム'));
});

describe('nextRuns', () => {
  const from = new Date('2026-06-14T00:00:00'); // ローカル基準

  it('毎日は count 件返る', () => {
    const runs = nextRuns('0 9 * * *', from, 3);
    expect(runs).toHaveLength(3);
    expect(runs[0]!.getHours()).toBe(9);
  });

  it('無効 cron は空配列', () => {
    expect(nextRuns('bad cron', from, 3)).toEqual([]);
    expect(nextRuns('', from, 3)).toEqual([]);
  });

  it('dom と dow 両指定は OR 結合', () => {
    // 毎月15日 OR 毎週月曜
    const runs = nextRuns('0 9 15 * 1', from, 5);
    expect(runs.length).toBe(5);
    runs.forEach((r) => {
      expect(r.getDate() === 15 || r.getDay() === 1).toBe(true);
    });
  });
});

describe('dstRisk', () => {
  const base: ScheduleValue = {
    presetType: 'daily',
    hour: 2,
    minute: 0,
    weekday: 1,
    monthday: 1,
    customCron: '',
    tz: 'America/New_York',
  };
  it('夏時間地域 × 1-3時台は true', () => expect(dstRisk(base)).toBe(true));
  it('Asia/Tokyo は false', () => expect(dstRisk({ ...base, tz: 'Asia/Tokyo' })).toBe(false));
  it('UTC は false', () => expect(dstRisk({ ...base, tz: 'UTC' })).toBe(false));
  it('夏時間地域でも 4時台は false', () => expect(dstRisk({ ...base, hour: 4 })).toBe(false));
});
