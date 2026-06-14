// 定期実行の実行履歴サブビュー (一覧行 → breadcrumb で潜る)。
// サマリ + 「すべて / 失敗のみ」フィルタ + run 行 (成否 / エラー種別 / セッション導線)。

import { fmtRun } from '../../core/deployments/schedule';
import { mapRunError, RUN_ERRORS } from '../../core/deployments/view';

import type { DeploymentView } from '../../core/deployments/view';
import type { DeploymentRun } from '../../core/managed-agents/types';

export interface DeploymentRunHistoryProps {
  deployment: DeploymentView;
  runs: readonly DeploymentRun[];
  loading: boolean;
  filter: 'all' | 'failed';
  onFilterChange: (f: 'all' | 'failed') => void;
  onBack: () => void;
}

export function DeploymentRunHistory({
  deployment,
  runs,
  loading,
  filter,
  onFilterChange,
  onBack,
}: DeploymentRunHistoryProps): JSX.Element {
  const total = runs.length;
  const failed = runs.filter((r) => r.error).length;
  const success = total - failed;
  const shown = filter === 'failed' ? runs.filter((r) => r.error) : runs;

  return (
    <div className="px-[26px] pb-[36px] pt-[22px]" data-testid="deployment-history">
      <div className="mb-[6px] text-[10.5px] text-subtle">
        定期実行 › <span className="text-muted">{deployment.name}</span> › 実行履歴
      </div>
      <div className="mb-[14px] flex items-start gap-[12px]">
        <div className="flex-1">
          <h2 className="text-[18px] font-bold text-text">実行履歴</h2>
          <p className="mt-[2px] text-[11.5px] text-muted">「{deployment.name}」のトリガー試行記録</p>
        </div>
        <button
          type="button"
          data-testid="deployment-history-back"
          onClick={onBack}
          className="shrink-0 rounded-[7px] border border-border px-[12px] py-[6px] text-[11.5px] text-text hover:bg-card-hi"
        >
          ← 一覧へ
        </button>
      </div>

      {/* サマリ + フィルタ */}
      <div className="mb-[14px] flex items-center gap-[14px]">
        <Stat label="実行回数" value={total} />
        <Stat label="成功" value={success} />
        <Stat label="失敗" value={failed} fail={failed > 0} />
        <div className="ml-auto inline-flex rounded-[8px] border border-border bg-card p-[2px]">
          {(['all', 'failed'] as const).map((f) => (
            <button
              key={f}
              type="button"
              data-testid={`deployment-history-filter-${f}`}
              onClick={() => onFilterChange(f)}
              className={`rounded-[6px] px-[10px] py-[4px] text-[11px] ${
                filter === f
                  ? f === 'failed'
                    ? 'bg-[#fee2e2] font-semibold text-[#dc2626]'
                    : 'bg-accent-soft font-semibold text-accent'
                  : 'text-muted'
              }`}
            >
              {f === 'all' ? 'すべて' : '失敗のみ'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-[12px] text-muted">読み込み中…</div>
      ) : shown.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border bg-card-hi px-[16px] py-[24px] text-center text-[12px] text-muted">
          {filter === 'failed' ? '失敗した実行はありません' : '実行履歴はまだありません'}
        </div>
      ) : (
        <div className="flex flex-col gap-[8px]">
          {shown.map((r) => (
            <RunRow key={r.id} run={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function RunRow({ run }: { run: DeploymentRun }): JSX.Element {
  const ok = !run.error;
  const errKey = run.error ? mapRunError(run.error.type) : null;
  return (
    <div
      data-testid={`run-row-${run.id}`}
      className="flex items-center gap-[12px] rounded-[10px] border border-card-border bg-card px-[14px] py-[10px]"
    >
      <span
        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px]"
        style={{ background: ok ? '#d1fae5' : '#fee2e2', color: ok ? '#047857' : '#dc2626' }}
      >
        {ok ? '✓' : '✕'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[11.5px] text-text">{fmtRun(new Date(run.created_at))}</div>
        <div className={`text-[10.5px] ${ok ? 'text-muted' : 'text-[#dc2626]'}`}>
          {ok
            ? `成功 · ${run.trigger_context.type === 'manual' ? '手動実行' : 'スケジュール'}`
            : `失敗 · ${errKey ? RUN_ERRORS[errKey].label : 'エラー'}${run.error?.message ? ` — ${run.error.message}` : ''}`}
        </div>
      </div>
      {run.session_id && (
        <span className="shrink-0 font-mono text-[10px] text-subtle">{run.session_id}</span>
      )}
    </div>
  );
}

function Stat({ label, value, fail }: { label: string; value: number; fail?: boolean }): JSX.Element {
  return (
    <div className="flex flex-col">
      <span className={`text-[18px] font-bold ${fail ? 'text-[#dc2626]' : 'text-text'}`}>{value}</span>
      <span className="text-[10px] text-subtle">{label}</span>
    </div>
  );
}
