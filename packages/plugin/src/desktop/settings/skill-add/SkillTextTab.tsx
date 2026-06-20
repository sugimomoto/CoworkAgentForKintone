// カスタム skill 追加モーダルの「直接入力」タブ。
// #79: name / description の個別入力は廃止。SKILL.md 本文のみを入力させ、
// name / description は frontmatter から解析して表示する (frontmatter が唯一の正)。

export interface SkillTextTabProps {
  body: string;
  setBody: (v: string) => void;
  /** frontmatter から解析した name (識別子)。未設定なら警告を出す */
  parsedName?: string;
  /** frontmatter から解析した description */
  parsedDescription?: string;
  /** 編集モード */
  isEdit?: boolean;
  /** 編集モードで固定される display_title (元のスキル名) */
  lockedName?: string;
  /** 編集モードで frontmatter name が元のスキル名と食い違う */
  nameMismatch?: boolean;
}

export function SkillTextTab({
  body,
  setBody,
  parsedName,
  parsedDescription,
  isEdit,
  lockedName,
  nameMismatch,
}: SkillTextTabProps): JSX.Element {
  const hasName = (parsedName ?? '').length > 0;
  return (
    <div data-testid="text-tab" className="grid grid-cols-1 gap-[10px]">
      {isEdit && (
        <div className="rounded-[6px] border border-border bg-card-hi px-[10px] py-[6px] text-[11px] text-muted">
          name (識別子):{' '}
          <span className="font-mono text-text">{lockedName}</span> — バージョン更新のため固定です
        </div>
      )}

      <label className="flex flex-col gap-[4px]">
        <span className="text-[10.5px] font-semibold text-muted">SKILL.md 本文 (frontmatter 必須)</span>
        <textarea
          data-testid="text-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          placeholder={'---\nname: kintone-my-skill\ndescription: 顧客アプリのレコード集計に特化したスキル\n---\n\n# Skill 本文'}
          className="w-full rounded-[6px] border border-border bg-card px-[10px] py-[6px] font-mono text-[11px] text-text"
        />
      </label>

      {/* frontmatter 解析結果 (name / description は frontmatter が正) */}
      {hasName ? (
        <div
          data-testid="text-parsed"
          className="rounded-[6px] border border-border bg-card-hi px-[10px] py-[8px] text-[11px]"
        >
          <div className="mb-[2px] text-[9.5px] font-bold uppercase tracking-[0.5px] text-subtle">
            frontmatter から解析
          </div>
          <div>
            <span className="text-muted">name:</span>{' '}
            <span className="font-mono text-text" data-testid="text-parsed-name">
              {parsedName}
            </span>
          </div>
          <div>
            <span className="text-muted">description:</span>{' '}
            <span className="text-text">{parsedDescription || '(未設定)'}</span>
          </div>
        </div>
      ) : (
        body.trim().length > 0 && (
          <div className="rounded-[6px] border border-warn/30 bg-warn-soft px-[10px] py-[6px] text-[11px] text-warn">
            frontmatter に <span className="font-mono">name:</span> が見つかりません。SKILL.md
            の先頭に <span className="font-mono">{'---\\nname: ...\\n---'}</span> を記述してください。
          </div>
        )
      )}

      {nameMismatch && (
        <div className="rounded-[6px] border border-warn/30 bg-warn-soft px-[10px] py-[6px] text-[11px] text-warn">
          frontmatter の name (<span className="font-mono">{parsedName}</span>) が元のスキル名 (
          <span className="font-mono">{lockedName}</span>)
          と異なります。バージョン更新は元の名前で行われます。
        </div>
      )}
    </div>
  );
}
