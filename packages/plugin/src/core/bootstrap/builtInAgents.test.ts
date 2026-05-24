// builtInAgents.ts のテスト
//
// 3 variant の spec が purpose ごとに正しい構成を返すか、prompt 分割が機能するか、
// filter がツール / skill を正しく分けるかを検証。

import { describe, expect, it } from 'vitest';

import {
  BUILTIN_AGENT_PURPOSES,
  BUILTIN_AGENT_SPECS,
  BUSINESS_SYSTEM_PROMPT,
  CUSTOMIZER_SYSTEM_PROMPT,
  DESTRUCTIVE_TOOL_NAMES,
  KINTONE_TOOL_NAMES,
  MANAGEMENT_TOOL_NAMES,
} from './builtInAgents';

describe('BUILTIN_AGENT_SPECS — 3 variant', () => {
  it('業務 / Customizer Opus / Customizer Sonnet の 3 entry を持つ', () => {
    expect(Object.keys(BUILTIN_AGENT_SPECS).sort()).toEqual([
      'business',
      'customizer-opus',
      'customizer-sonnet',
    ]);
    expect(BUILTIN_AGENT_PURPOSES).toEqual([
      'business',
      'customizer-opus',
      'customizer-sonnet',
    ]);
  });

  describe('business エージェント', () => {
    const spec = BUILTIN_AGENT_SPECS.business;

    it('model は claude-sonnet-4-6', () => {
      expect(spec.model).toBe('claude-sonnet-4-6');
      expect(spec.modelLabel).toBe('SONNET');
    });

    it('promptVersion v20-business / systemPrompt は BUSINESS_SYSTEM_PROMPT', () => {
      expect(spec.promptVersion).toBe('v20-business');
      expect(spec.systemPrompt).toBe(BUSINESS_SYSTEM_PROMPT);
    });

    it('Anthropic 製 skill (xlsx / docx / pdf / pptx) を attach', () => {
      expect(spec.anthropicSkillIds).toEqual(['xlsx', 'docx', 'pdf', 'pptx']);
    });

    it('customSkillFilter は何も attach しない (customize-js 系は除外)', () => {
      expect(spec.customSkillFilter('kintone-customize-js')).toBe(false);
      expect(spec.customSkillFilter('any-skill')).toBe(false);
    });

    it('mcpToolFilter は管理系 (V3) を除外', () => {
      expect(spec.mcpToolFilter('kintone-get-records')).toBe(true);
      expect(spec.mcpToolFilter('kintone-delete-records')).toBe(true);
      // 管理系は MANAGEMENT_TOOL_NAMES に列挙されている (現状の KINTONE_TOOL_NAMES に無くても将来追加されたら除外)
      for (const t of MANAGEMENT_TOOL_NAMES) {
        // mcpToolFilter は KintoneToolName 型を要求するので型キャスト
        expect(spec.mcpToolFilter(t as never)).toBe(false);
      }
    });

    it('UI アイコンは biz / accentSoft', () => {
      expect(spec.iconKind).toBe('biz');
      expect(spec.iconColor).toBe('accentSoft');
    });

    it('isDefault は false, variantGroup なし', () => {
      expect(spec.isDefault).toBe(false);
      expect(spec.variantGroup).toBeUndefined();
    });
  });

  describe('customizer-opus エージェント', () => {
    const spec = BUILTIN_AGENT_SPECS['customizer-opus'];

    it('model は claude-opus-4-7', () => {
      expect(spec.model).toBe('claude-opus-4-7');
      expect(spec.modelLabel).toBe('OPUS');
      expect(spec.modelKind).toBe('opus');
    });

    it('promptVersion v21-customizer / systemPrompt は CUSTOMIZER_SYSTEM_PROMPT', () => {
      expect(spec.promptVersion).toBe('v21-customizer');
      expect(spec.systemPrompt).toBe(CUSTOMIZER_SYSTEM_PROMPT);
    });

    it('Anthropic 製 skill は付けない (ドキュメント生成系は customizer の用途外)', () => {
      expect(spec.anthropicSkillIds).toEqual([]);
    });

    it('customSkillFilter は全 custom skill を attach', () => {
      expect(spec.customSkillFilter('kintone-customize-js')).toBe(true);
      expect(spec.customSkillFilter('kintone-plugin-development')).toBe(true);
    });

    it('mcpToolFilter は全 kintone MCP ツールを通す (管理系含む)', () => {
      for (const name of KINTONE_TOOL_NAMES) {
        expect(spec.mcpToolFilter(name)).toBe(true);
      }
    });

    it('UI アイコンは cust / accent / variantGroup=customizer', () => {
      expect(spec.iconKind).toBe('cust');
      expect(spec.iconColor).toBe('accent');
      expect(spec.variantGroup).toBe('customizer');
    });

    it('isDefault は true (V1 既定)', () => {
      expect(spec.isDefault).toBe(true);
    });
  });

  describe('customizer-sonnet エージェント', () => {
    const spec = BUILTIN_AGENT_SPECS['customizer-sonnet'];

    it('model は claude-sonnet-4-6 (opus と差別化)', () => {
      expect(spec.model).toBe('claude-sonnet-4-6');
      expect(spec.modelLabel).toBe('SONNET');
    });

    it('customizer-opus と systemPrompt / promptVersion は共通', () => {
      expect(spec.systemPrompt).toBe(BUILTIN_AGENT_SPECS['customizer-opus'].systemPrompt);
      expect(spec.promptVersion).toBe(
        BUILTIN_AGENT_SPECS['customizer-opus'].promptVersion,
      );
    });

    it('variantGroup=customizer / isDefault=false', () => {
      expect(spec.variantGroup).toBe('customizer');
      expect(spec.isDefault).toBe(false);
    });
  });
});

describe('system prompt 分割', () => {
  it('BUSINESS_SYSTEM_PROMPT は kintone データ操作 + Artifact 規約を含む', () => {
    expect(BUSINESS_SYSTEM_PROMPT).toContain('業務エージェント');
    expect(BUSINESS_SYSTEM_PROMPT).toContain('kintone データ操作ツール');
    expect(BUSINESS_SYSTEM_PROMPT).toContain('成果物 (Artifact)');
    // Customizer 専用ブロックは含まれない
    expect(BUSINESS_SYSTEM_PROMPT).not.toContain('kintone カスタマイズ開発');
    expect(BUSINESS_SYSTEM_PROMPT).not.toContain('プレビュー → 適用 → ロールバック');
  });

  it('CUSTOMIZER_SYSTEM_PROMPT は Customizer 専用ブロックも含む', () => {
    expect(CUSTOMIZER_SYSTEM_PROMPT).toContain('カスタマイザーエージェント');
    expect(CUSTOMIZER_SYSTEM_PROMPT).toContain('kintone データ操作ツール');
    expect(CUSTOMIZER_SYSTEM_PROMPT).toContain('成果物 (Artifact)');
    expect(CUSTOMIZER_SYSTEM_PROMPT).toContain('kintone カスタマイズ開発');
    expect(CUSTOMIZER_SYSTEM_PROMPT).toContain('プレビュー → 適用 → ロールバック');
  });

  it('CUSTOMIZER_SYSTEM_PROMPT は BUSINESS_SYSTEM_PROMPT より長い (workflow ブロック分)', () => {
    expect(CUSTOMIZER_SYSTEM_PROMPT.length).toBeGreaterThan(BUSINESS_SYSTEM_PROMPT.length);
  });

  it('両 prompt とも空ではない (削除リスク防止)', () => {
    expect(BUSINESS_SYSTEM_PROMPT.length).toBeGreaterThan(500);
    expect(CUSTOMIZER_SYSTEM_PROMPT.length).toBeGreaterThan(500);
  });
});

describe('共有定数', () => {
  it('KINTONE_TOOL_NAMES は 10 個のツール', () => {
    expect(KINTONE_TOOL_NAMES).toHaveLength(10);
    expect(KINTONE_TOOL_NAMES).toContain('kintone-get-records');
    expect(KINTONE_TOOL_NAMES).toContain('kintone-delete-records');
  });

  it('DESTRUCTIVE_TOOL_NAMES は delete-records のみ', () => {
    expect(DESTRUCTIVE_TOOL_NAMES.has('kintone-delete-records')).toBe(true);
    expect(DESTRUCTIVE_TOOL_NAMES.size).toBe(1);
  });

  it('MANAGEMENT_TOOL_NAMES は V3 で追加される予定のツール集合', () => {
    expect(MANAGEMENT_TOOL_NAMES.has('kintone-deploy-app')).toBe(true);
    expect(MANAGEMENT_TOOL_NAMES.has('kintone-update-customize-js')).toBe(true);
    // 既存ツールは含まれない (= 業務 Agent でも attach される)
    expect(MANAGEMENT_TOOL_NAMES.has('kintone-get-records')).toBe(false);
  });
});
