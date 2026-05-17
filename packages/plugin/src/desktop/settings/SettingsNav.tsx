// Cowork Agent for kintone — Settings View 左ナビ (V1 P2.2)
//
// 192px 幅 / 縦並び / Agents / Skills / MCP の 3 項目 + 下部に Plugin Config リンク。
// MCP は V1 では disabled 表示 (P2 まで機能化されない)。
//
// 仕様: requirements.md §15.4 / design.md §4.3

export type SettingsSection = 'agents' | 'skills' | 'mcp';

export interface SettingsNavProps {
  /** 現在選択中のセクション */
  section: SettingsSection;
  /** セクション切替ハンドラ */
  onSection: (section: SettingsSection) => void;
  /** 各セクションのアイテム件数バッジ (任意) */
  counts?: Partial<Record<SettingsSection, number>>;
  /** Plugin Config (kintone admin 画面) へのリンクをクリック */
  onPluginConfigClick?: () => void;
}

interface NavItemDef {
  id: SettingsSection;
  label: string;
  iconName: 'bot' | 'brain' | 'plug';
  /** V1 で disabled 表示するか */
  disabled?: boolean;
}

const NAV_ITEMS: readonly NavItemDef[] = [
  { id: 'agents', label: 'エージェント', iconName: 'bot' },
  { id: 'skills', label: 'スキル', iconName: 'brain' },
  { id: 'mcp', label: 'MCP サーバー', iconName: 'plug', disabled: true },
];

export function SettingsNav({
  section,
  onSection,
  counts,
  onPluginConfigClick,
}: SettingsNavProps): JSX.Element {
  return (
    <nav
      data-testid="settings-nav"
      className="flex w-[192px] shrink-0 flex-col gap-[2px] border-r border-border bg-card-hi px-[8px] py-[12px]"
    >
      {NAV_ITEMS.map((item) => {
        const active = section === item.id && !item.disabled;
        const count = counts?.[item.id];
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`settings-nav-${item.id}`}
            disabled={item.disabled}
            aria-current={active ? 'page' : undefined}
            onClick={() => !item.disabled && onSection(item.id)}
            className={[
              'flex items-center gap-[8px] rounded-[8px] px-[10px] py-[7px] text-left',
              'text-[12.5px]',
              active
                ? 'border border-border bg-card font-semibold text-text'
                : 'border border-transparent text-muted',
              item.disabled
                ? 'cursor-not-allowed opacity-60'
                : 'cursor-pointer hover:bg-card hover:text-text',
            ].join(' ')}
          >
            <NavIcon name={item.iconName} active={active} />
            <span className="flex-1">{item.label}</span>
            {item.disabled ? (
              <span className="text-[9px] font-semibold tracking-[0.5px] text-subtle">V2</span>
            ) : count !== undefined ? (
              <span className="font-mono text-[10px] tabular-nums text-subtle">{count}</span>
            ) : null}
          </button>
        );
      })}

      <div className="my-[8px] mx-[6px] h-px bg-border" />
      <div className="px-[10px] py-[4px] text-[9px] font-bold uppercase tracking-[0.6px] text-subtle">
        外部接続
      </div>
      <button
        type="button"
        data-testid="settings-nav-plugin-config"
        onClick={onPluginConfigClick}
        disabled={!onPluginConfigClick}
        className={[
          'flex items-center gap-[7px] rounded-[6px] px-[10px] py-[6px] text-left text-[11px] text-subtle',
          onPluginConfigClick ? 'cursor-pointer hover:bg-card hover:text-text' : 'cursor-not-allowed opacity-60',
        ].join(' ')}
      >
        <ExternalIcon />
        <span className="flex-1">Plugin Config →</span>
      </button>
    </nav>
  );
}

// ─── icons ────────────────────────────────────────────────────────────────

function NavIcon({ name, active }: { name: 'bot' | 'brain' | 'plug'; active: boolean }): JSX.Element {
  const stroke = active ? 'var(--cw-accent)' : 'currentColor';
  if (name === 'bot') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="10" height="8" rx="2" />
        <path d="M8 5V2.5M6 8v.5M10 8v.5M2 9h1M13 9h1" />
      </svg>
    );
  }
  if (name === 'brain') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 3a2.5 2.5 0 00-5 0v7a2.5 2.5 0 005 0M8 3a2.5 2.5 0 015 0v7a2.5 2.5 0 01-5 0" />
        <path d="M5 6h2M9 6h2M5 9h2M9 9h2" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2v3M10 2v3" />
      <rect x="4" y="5" width="8" height="4" rx="1" />
      <path d="M8 9v2a2 2 0 002 2h1" />
    </svg>
  );
}

function ExternalIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M2 4h8v6H2zM2 4l4 3 4-3" />
    </svg>
  );
}
