// SkillAddModal の extractSkillBundle / parseFrontmatter 単体テスト (#30 V2)

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { extractSkillBundle, parseFrontmatter } from './SkillAddModal';

const SKILL_MD = `---
name: my-test-skill
description: テスト用スキル
---

# Hello
本文。
`;

function zipToBytes(zip: JSZip): Promise<Uint8Array> {
  return zip.generateAsync({ type: 'uint8array' });
}

describe('parseFrontmatter', () => {
  it('name / description を抽出する', () => {
    const meta = parseFrontmatter(SKILL_MD);
    expect(meta.name).toBe('my-test-skill');
    expect(meta.description).toBe('テスト用スキル');
  });

  it('frontmatter が無ければ空オブジェクト', () => {
    expect(parseFrontmatter('# Just markdown')).toEqual({});
  });
});

describe('extractSkillBundle (#30 V2 zip 展開)', () => {
  it('<name>/SKILL.md + references/* を保持して files[] に展開', async () => {
    const zip = new JSZip();
    zip.file('my-test-skill/SKILL.md', SKILL_MD);
    zip.file('my-test-skill/references/api.md', '# API ref');
    zip.file('my-test-skill/scripts/helper.sh', 'echo hi');
    const buf = await zipToBytes(zip);

    const input = await extractSkillBundle(buf);

    expect(input.name).toBe('my-test-skill');
    expect(input.description).toBe('テスト用スキル');
    expect(input.skillMd).toContain('# Hello');
    expect(input.files).toBeDefined();
    const paths = input.files!.map((f) => f.path).sort();
    expect(paths).toEqual([
      'my-test-skill/SKILL.md',
      'my-test-skill/references/api.md',
      'my-test-skill/scripts/helper.sh',
    ]);
  });

  it('root flat (SKILL.md がトップ直下) の zip も <name>/ prefix を付けて正規化', async () => {
    const zip = new JSZip();
    zip.file('SKILL.md', SKILL_MD);
    zip.file('references/note.md', 'note');
    const buf = await zipToBytes(zip);

    const input = await extractSkillBundle(buf);
    expect(input.name).toBe('my-test-skill');
    const paths = input.files!.map((f) => f.path).sort();
    expect(paths).toEqual(['my-test-skill/SKILL.md', 'my-test-skill/references/note.md']);
  });

  it('__MACOSX や .DS_Store はスキップ', async () => {
    const zip = new JSZip();
    zip.file('my-test-skill/SKILL.md', SKILL_MD);
    zip.file('__MACOSX/my-test-skill/._SKILL.md', 'junk');
    zip.file('my-test-skill/.DS_Store', 'junk');
    const buf = await zipToBytes(zip);

    const input = await extractSkillBundle(buf);
    const paths = input.files!.map((f) => f.path);
    expect(paths).toEqual(['my-test-skill/SKILL.md']);
  });

  it('バイナリ (.png) は除外する', async () => {
    const zip = new JSZip();
    zip.file('my-test-skill/SKILL.md', SKILL_MD);
    zip.file('my-test-skill/assets/logo.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    const buf = await zipToBytes(zip);

    const input = await extractSkillBundle(buf);
    const paths = input.files!.map((f) => f.path);
    expect(paths).toEqual(['my-test-skill/SKILL.md']);
  });

  it('SKILL.md が無いと throw', async () => {
    const zip = new JSZip();
    zip.file('my-test-skill/README.md', '# nope');
    const buf = await zipToBytes(zip);

    await expect(extractSkillBundle(buf)).rejects.toThrow(/SKILL\.md/);
  });

  it('SKILL.md に name frontmatter が無いと throw', async () => {
    const zip = new JSZip();
    zip.file('my-test-skill/SKILL.md', '# no frontmatter');
    const buf = await zipToBytes(zip);

    await expect(extractSkillBundle(buf)).rejects.toThrow(/name/);
  });
});
