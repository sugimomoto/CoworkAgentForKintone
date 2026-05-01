// Cowork Agent for kintone — Composer の hint 行 (⌘K 呼び出し ·) と同じ行右端に出す
// プラグイン version ラベル。
//
// 表示形式: `v<semver> #<build>` — 例: `v0.0.1 #111`
//   - semver: package.json の version (リリース識別子。手動 bump)
//   - build:  manifest.json の version (整数。build ごとに自動 +1)

const SEMVER =
  typeof __PLUGIN_SEMVER__ !== 'undefined' ? __PLUGIN_SEMVER__ : '0.0.0';
const BUILD =
  typeof __PLUGIN_VERSION__ !== 'undefined' ? __PLUGIN_VERSION__ : 'dev';

export function VersionBadge(): JSX.Element {
  return (
    <span
      data-version-badge
      title={`Cowork Agent plugin v${SEMVER} (build #${BUILD})`}
      className="select-none font-mono"
    >
      v{SEMVER} <span className="opacity-70">#{BUILD}</span>
    </span>
  );
}
