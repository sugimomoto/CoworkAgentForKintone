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

  describe('customizer-opus エージェント (#48 でエージェントデザイナーに repurpose)', () => {
    const spec = BUILTIN_AGENT_SPECS['customizer-opus'];

    it('model は claude-opus-4-7', () => {
      expect(spec.model).toBe('claude-opus-4-7');
      expect(spec.modelLabel).toBe('OPUS');
      expect(spec.modelKind).toBe('opus');
    });

    it('name は エージェントデザイナー / promptVersion は v23-agent-designer', () => {
      expect(spec.name).toBe('エージェントデザイナー');
      expect(spec.promptVersion).toBe('v23-agent-designer');
    });

    it('Anthropic 製 skill は付けない (アーティファクト出力中心)', () => {
      expect(spec.anthropicSkillIds).toEqual([]);
    });

    it('customSkillFilter は何も attach しない (カスタム skill 不要)', () => {
      expect(spec.customSkillFilter('kintone-customize-js')).toBe(false);
      expect(spec.customSkillFilter('kintone-plugin-development')).toBe(false);
    });

    it('mcpToolFilter は参照系 (get) のみ通し、書込系を弾く', () => {
      expect(spec.mcpToolFilter('kintone-get-apps')).toBe(true);
      expect(spec.mcpToolFilter('kintone-get-app')).toBe(true);
      expect(spec.mcpToolFilter('kintone-get-form-fields')).toBe(true);
      expect(spec.mcpToolFilter('kintone-get-records')).toBe(true);
      expect(spec.mcpToolFilter('kintone-add-record')).toBe(false);
      expect(spec.mcpToolFilter('kintone-update-record')).toBe(false);
      expect(spec.mcpToolFilter('kintone-delete-records')).toBe(false);
    });

    it('UI アイコンは ai / accent / variantGroup なし (Sonnet との pair 解消)', () => {
      expect(spec.iconKind).toBe('ai');
      expect(spec.iconColor).toBe('accent');
      expect(spec.variantGroup).toBeUndefined();
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

    it('systemPrompt は CUSTOMIZER_SYSTEM_PROMPT (JS カスタマイズ専用ペルソナを維持)', () => {
      expect(spec.systemPrompt).toBe(CUSTOMIZER_SYSTEM_PROMPT);
      expect(spec.promptVersion).toBe('v22-customizer');
    });

    it('variantGroup=customizer / isDefault=false', () => {
      // #48 後: customizer-opus は variantGroup を外したので、Sonnet 単独で pair なし
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

describe('quickActions — 3 variant 全てに 4 個以上のクイックアクションがある', () => {
  it.each(['business', 'customizer-opus', 'customizer-sonnet'] as const)(
    '%s には 4〜5 個のクイックアクションが定義されている',
    (purpose) => {
      const spec = BUILTIN_AGENT_SPECS[purpose];
      expect(spec.quickActions.length).toBeGreaterThanOrEqual(4);
      expect(spec.quickActions.length).toBeLessThanOrEqual(5);
      spec.quickActions.forEach((a) => {
        expect(typeof a).toBe('string');
        expect(a.length).toBeGreaterThan(0);
      });
    },
  );

  it('customizer-opus (デザイナー) と customizer-sonnet (Customizer) は別の quickActions を持つ', () => {
    // #48 後: customizer-opus は Agent Designer 専用文言、Sonnet は JS カスタマイズ文言
    expect(BUILTIN_AGENT_SPECS['customizer-opus'].quickActions).not.toEqual(
      BUILTIN_AGENT_SPECS['customizer-sonnet'].quickActions,
    );
  });
});

describe('共有定数', () => {
  it('KINTONE_TOOL_NAMES は 30 個 (CRUD 10 + ワークフロー 2 + 管理 18)', () => {
    expect(KINTONE_TOOL_NAMES).toHaveLength(30);
    expect(KINTONE_TOOL_NAMES).toContain('kintone-get-records');
    expect(KINTONE_TOOL_NAMES).toContain('kintone-delete-records');
    // プロセス管理 (#22)
    expect(KINTONE_TOOL_NAMES).toContain('kintone-update-records-statuses');
    expect(KINTONE_TOOL_NAMES).not.toContain('kintone-update-record-status');
    // 管理系 (#24)
    expect(KINTONE_TOOL_NAMES).toContain('kintone-create-app');
    expect(KINTONE_TOOL_NAMES).toContain('kintone-update-app-acl');
  });

  it('DESTRUCTIVE_TOOL_NAMES = delete-records + deploy-app + delete-form-fields', () => {
    expect(DESTRUCTIVE_TOOL_NAMES.has('kintone-delete-records')).toBe(true);
    expect(DESTRUCTIVE_TOOL_NAMES.has('kintone-deploy-app')).toBe(true);
    expect(DESTRUCTIVE_TOOL_NAMES.has('kintone-delete-form-fields')).toBe(true);
    // プロセス管理 (#22) は承認カードを挟まない (always_allow)
    expect(DESTRUCTIVE_TOOL_NAMES.has('kintone-update-records-statuses')).toBe(false);
    expect(DESTRUCTIVE_TOOL_NAMES.size).toBe(3);
  });

  it('ワークフロー系は業務 Agent のみ (customizer-sonnet / designer には出ない)', () => {
    const wf = 'kintone-update-records-statuses' as const;
    expect(BUILTIN_AGENT_SPECS.business.mcpToolFilter(wf)).toBe(true);
    expect(BUILTIN_AGENT_SPECS['customizer-sonnet'].mcpToolFilter(wf)).toBe(false);
    expect(BUILTIN_AGENT_SPECS['customizer-opus'].mcpToolFilter(wf)).toBe(false);
    // 作業者変更も同様に業務のみ
    const asg = 'kintone-update-record-assignees' as const;
    expect(BUILTIN_AGENT_SPECS.business.mcpToolFilter(asg)).toBe(true);
    expect(BUILTIN_AGENT_SPECS['customizer-sonnet'].mcpToolFilter(asg)).toBe(false);
  });

  it('MANAGEMENT_TOOL_NAMES は管理系 18 (#24)', () => {
    expect(MANAGEMENT_TOOL_NAMES.size).toBe(18);
    expect(MANAGEMENT_TOOL_NAMES.has('kintone-deploy-app')).toBe(true);
    expect(MANAGEMENT_TOOL_NAMES.has('kintone-add-form-fields')).toBe(true);
    expect(MANAGEMENT_TOOL_NAMES.has('kintone-update-app-acl')).toBe(true);
    // CRUD / ワークフロー系は含まれない
    expect(MANAGEMENT_TOOL_NAMES.has('kintone-get-records')).toBe(false);
    expect(MANAGEMENT_TOOL_NAMES.has('kintone-update-records-statuses')).toBe(false);
  });

  it('管理系 (#24) は全 built-in variant に出ない (admin 専用 / custom Agent でのみ選択)', () => {
    const mgmt = 'kintone-update-app-acl' as const;
    // built-in 3 variant いずれも除外
    expect(BUILTIN_AGENT_SPECS.business.mcpToolFilter(mgmt)).toBe(false);
    expect(BUILTIN_AGENT_SPECS['customizer-sonnet'].mcpToolFilter(mgmt)).toBe(false);
    expect(BUILTIN_AGENT_SPECS['customizer-opus'].mcpToolFilter(mgmt)).toBe(false);
    // ただし KINTONE_TOOL_NAMES には含まれ、Custom Agent の picker では選べる
    expect(KINTONE_TOOL_NAMES).toContain(mgmt);
  });
});
