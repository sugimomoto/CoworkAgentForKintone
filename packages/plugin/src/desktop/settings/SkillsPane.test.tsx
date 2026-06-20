// SkillsPane + SkillAddModal の統合テスト

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { parseFrontmatter } from './SkillAddModal';
import { SkillsPane } from './SkillsPane';

import type { BundledSkillEntry } from './SkillsPane';

const BUNDLED: BundledSkillEntry[] = [
  {
    name: 'kintone-customize-js',
    displayTitle: 'kintone カスタマイズ JS',
    skillId: 'sk_abc',
    version: '1728000000',
    status: 'synced',
  },
  {
    name: 'kintone-plugin-development',
    displayTitle: 'kintone Plugin 開発',
    skillId: null,
    version: null,
    status: 'pending',
  },
];

describe('SkillsPane', () => {
  it('bundled skill が一覧表示される', () => {
    render(<SkillsPane bundledSkills={BUNDLED} />);
    expect(screen.getByTestId('skill-row-kintone-customize-js')).toBeInTheDocument();
    expect(screen.getByTestId('skill-row-kintone-plugin-development')).toBeInTheDocument();
  });

  it('status バッジが "同期済 / 未同期 / 更新あり" を表示', () => {
    render(<SkillsPane bundledSkills={BUNDLED} />);
    expect(screen.getByTestId('skill-row-kintone-customize-js').textContent).toContain('同期済');
    expect(screen.getByTestId('skill-row-kintone-plugin-development').textContent).toContain('未同期');
  });

  it('同期ボタンクリックで onSyncBundled が発火', async () => {
    const onSync = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SkillsPane bundledSkills={BUNDLED} onSyncBundled={onSync} />);
    await user.click(screen.getByTestId('skills-sync-btn'));
    expect(onSync).toHaveBeenCalledOnce();
  });

  it('onSyncBundled が reject するとエラーが表示される', async () => {
    const onSync = vi.fn().mockRejectedValue(new Error('proxy unreachable'));
    const user = userEvent.setup();
    render(<SkillsPane bundledSkills={BUNDLED} onSyncBundled={onSync} />);
    await user.click(screen.getByTestId('skills-sync-btn'));
    expect(await screen.findByText('proxy unreachable')).toBeInTheDocument();
  });

  it('onAddCustomSkill ハンドラがあれば追加ボタンが enable', () => {
    render(<SkillsPane bundledSkills={BUNDLED} onAddCustomSkill={vi.fn()} />);
    expect(screen.getByTestId('skills-add-btn')).not.toBeDisabled();
  });

  it('追加ボタンクリックで SkillAddModal が開く', async () => {
    const user = userEvent.setup();
    render(<SkillsPane bundledSkills={BUNDLED} onAddCustomSkill={vi.fn().mockResolvedValue(undefined)} />);
    await user.click(screen.getByTestId('skills-add-btn'));
    expect(screen.getByTestId('skill-add-modal')).toBeInTheDocument();
  });

  it('SkillAddModal の text タブで SKILL.md 本文の frontmatter から name を解析して onAddCustomSkill 発火 (#79)', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const skillMd = '---\nname: my-skill\ndescription: 顧客集計\n---\n本文';
    render(<SkillsPane bundledSkills={BUNDLED} onAddCustomSkill={onAdd} />);
    await user.click(screen.getByTestId('skills-add-btn'));
    await user.click(screen.getByTestId('tab-text'));
    // #79: name 個別入力は廃止。本文 frontmatter から name/description を解析する
    expect(screen.queryByTestId('text-name')).toBeNull();
    expect(screen.queryByTestId('text-description')).toBeNull();
    fireEvent.change(screen.getByTestId('text-body'), { target: { value: skillMd } });
    expect(screen.getByTestId('text-parsed-name')).toHaveTextContent('my-skill');
    await user.click(screen.getByTestId('skill-add-submit'));
    await waitFor(() => expect(onAdd).toHaveBeenCalledOnce());
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'my-skill', description: '顧客集計', skillMd }),
    );
  });

  it('frontmatter に name が無いと送信不可 (#79)', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SkillsPane bundledSkills={BUNDLED} onAddCustomSkill={onAdd} />);
    await user.click(screen.getByTestId('skills-add-btn'));
    await user.click(screen.getByTestId('tab-text'));
    fireEvent.change(screen.getByTestId('text-body'), { target: { value: '# 本文だけ' } });
    expect(screen.getByTestId('skill-add-submit')).toBeDisabled();
  });
});

describe('parseFrontmatter', () => {
  it('正常な frontmatter から name / description を抽出', () => {
    const text = `---
name: kintone-test
description: test skill
---
body`;
    expect(parseFrontmatter(text)).toEqual({ name: 'kintone-test', description: 'test skill' });
  });

  it('クォート付き値を剥がす', () => {
    const text = `---
name: "kintone-test"
description: 'test "quoted"'
---`;
    const parsed = parseFrontmatter(text);
    expect(parsed.name).toBe('kintone-test');
    expect(parsed.description).toBe(`test "quoted"`);
  });

  it('frontmatter なしなら空オブジェクト', () => {
    expect(parseFrontmatter('plain markdown')).toEqual({});
  });

  it('name が無いケースは undefined のまま', () => {
    const text = `---
description: only desc
---`;
    expect(parseFrontmatter(text)).toEqual({ description: 'only desc' });
  });
});
