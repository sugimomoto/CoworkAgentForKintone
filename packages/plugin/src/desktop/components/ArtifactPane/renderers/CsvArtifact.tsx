import { useMemo } from 'react';

import { parseCsv } from '../../../../core/artifacts/csv';

import type { Artifact } from '../../../../core/artifacts/types';

const MAX_DISPLAY_ROWS = 500;

export function CsvArtifact({ artifact }: { artifact: Artifact }): JSX.Element {
  const parsed = useMemo(() => parseCsv(artifact.content), [artifact.content]);
  const totalRows = parsed.rows.length;
  const visibleRows = parsed.rows.slice(0, MAX_DISPLAY_ROWS);
  const truncated = totalRows > MAX_DISPLAY_ROWS;

  if (parsed.headers.length === 0 && totalRows === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-slate-500">
        CSV データが空です。
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-[11px] text-slate-600">
        <span>
          {parsed.headers.length} 列 / {totalRows} 行
          {parsed.hasHeader ? ' (1 行目を見出しとして検出)' : ' (見出し行なし)'}
        </span>
        {truncated && (
          <span className="text-amber-700">
            ⚠️ 上から {MAX_DISPLAY_ROWS} 行のみ表示中。全件はダウンロードしてください。
          </span>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-[12px]">
          <thead className="sticky top-0 z-10 bg-slate-100">
            <tr>
              {parsed.headers.map((h, i) => (
                <th
                  key={i}
                  className="border-b border-slate-200 px-3 py-1.5 text-left font-semibold text-slate-700"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, r) => (
              <tr key={r} className="even:bg-slate-50/50">
                {parsed.headers.map((_, c) => (
                  <td
                    key={c}
                    className="whitespace-nowrap border-b border-slate-100 px-3 py-1 align-top text-slate-800"
                  >
                    {row[c] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
