// カスタム skill 追加モーダルの「直接入力」タブ。

import { FormField } from '../../components/ui/FormField';

export interface SkillTextTabProps {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
  /** 編集モードで name を変更不可にする (display_title 一致で skill version up するため) */
  nameReadOnly?: boolean;
}

export function SkillTextTab({
  name,
  setName,
  description,
  setDescription,
  body,
  setBody,
  nameReadOnly,
}: SkillTextTabProps): JSX.Element {
  return (
    <div data-testid="text-tab" className="grid grid-cols-1 gap-[10px]">
      <FormField label={nameReadOnly ? 'name (識別子 — 編集不可)' : 'name (識別子)'}>
        <input
          type="text"
          data-testid="text-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="kintone-my-skill"
          readOnly={nameReadOnly}
          className={`w-full rounded-[6px] border border-border px-[10px] py-[6px] font-mono text-[12px] text-text ${
            nameReadOnly ? 'cursor-not-allowed bg-card-hi text-muted' : 'bg-card'
          }`}
        />
      </FormField>
      <FormField label="description (1 行説明)">
        <input
          type="text"
          data-testid="text-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例: 顧客アプリのレコード集計に特化したスキル"
          className="w-full rounded-[6px] border border-border bg-card px-[10px] py-[6px] text-[12px] text-text"
        />
      </FormField>
      <FormField label="SKILL.md 本文 (frontmatter 含む)">
        <textarea
          data-testid="text-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder={'---\nname: kintone-my-skill\ndescription: ...\n---\n\n# Skill 本文'}
          className="w-full rounded-[6px] border border-border bg-card px-[10px] py-[6px] font-mono text-[11px] text-text"
        />
      </FormField>
    </div>
  );
}
