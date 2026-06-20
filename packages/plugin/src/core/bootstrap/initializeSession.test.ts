import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeAgent, makeEnv } from '../../test/fixtures';
import { resolveIsAdmin } from '../admin/useIsAdmin';
import { getPluginConfig } from '../kintone/pluginConfig';
import { getCurrentSessionContext } from '../kintone/user';
import { fetchCurrentUserGroups, fetchCurrentUserOrganizations } from '../kintone/users';
import { resolveBundledSkillIds } from '../skills/resolveBundledSkillIds';

import { initializeSession, selectInitialAgentId } from './initializeSession';
import { resolveDefaultAgent } from './resolveAgent';
import { listCustomAgents, resolveBuiltInAgents } from './resolveBuiltInAgents';
import { resolveBootstrapEnvironment } from './resolveEnvironment';

import type { AgentRecord } from './agentTypes';

vi.mock('../kintone/pluginConfig', () => ({ getPluginConfig: vi.fn() }));
vi.mock('../kintone/user', () => ({ getCurrentSessionContext: vi.fn() }));
vi.mock('../kintone/users', () => ({
  fetchCurrentUserGroups: vi.fn(),
  fetchCurrentUserOrganizations: vi.fn(),
}));
vi.mock('../admin/useIsAdmin', () => ({ resolveIsAdmin: vi.fn() }));
vi.mock('../skills/resolveBundledSkillIds', () => ({ resolveBundledSkillIds: vi.fn() }));
vi.mock('./resolveEnvironment', () => ({ resolveBootstrapEnvironment: vi.fn() }));
vi.mock('./resolveAgent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./resolveAgent')>();
  return { ...actual, resolveDefaultAgent: vi.fn() };
});
vi.mock('./resolveBuiltInAgents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./resolveBuiltInAgents')>();
  return { ...actual, resolveBuiltInAgents: vi.fn(), listCustomAgents: vi.fn() };
});

const mockGetPluginConfig = vi.mocked(getPluginConfig);
const mockGetCtx = vi.mocked(getCurrentSessionContext);
const mockGroups = vi.mocked(fetchCurrentUserGroups);
const mockOrgs = vi.mocked(fetchCurrentUserOrganizations);
const mockIsAdmin = vi.mocked(resolveIsAdmin);
const mockSkills = vi.mocked(resolveBundledSkillIds);
const mockEnv = vi.mocked(resolveBootstrapEnvironment);
const mockBuiltIn = vi.mocked(resolveBuiltInAgents);
const mockListCustom = vi.mocked(listCustomAgents);
const mockDefault = vi.mocked(resolveDefaultAgent);

// built-in 3 variant の Agent (id で識別)。customizer-opus が出荷時 isDefault=true。
const BUILTIN_SET = {
  business: makeAgent({ id: 'a_biz' }),
  customizerOpus: makeAgent({ id: 'a_opus' }),
  customizerSonnet: makeAgent({ id: 'a_sonnet' }),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCtx.mockReturnValue({ kintoneDomain: 'demo.cybozu.com', kintoneUserCode: 'sato' });
  mockSkills.mockResolvedValue([]);
  mockEnv.mockResolvedValue(makeEnv({ id: 'env_1' }));
  mockGroups.mockResolvedValue([]);
  mockOrgs.mockResolvedValue([]);
  mockIsAdmin.mockResolvedValue(true);
  mockBuiltIn.mockResolvedValue(BUILTIN_SET);
  mockListCustom.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('initializeSession — workerUrl あり (rich path)', () => {
  beforeEach(() => {
    mockGetPluginConfig.mockReturnValue({ workerUrl: 'https://worker.example.com', oauthClientId: null });
  });

  it('built-in 3 variant を解決し、isDefault (customizer-opus) を初期選択する', async () => {
    const r = await initializeSession({ pluginId: 'plg_1' });
    expect(r.builtInAgents).not.toBeNull();
    expect(r.builtInAgents!.map((a) => a.id).sort()).toEqual(['a_biz', 'a_opus', 'a_sonnet']);
    expect(r.agentId).toBe('a_opus'); // customizer-opus = 出荷時デフォルト
    expect(r.environmentId).toBe('env_1');
    expect(r.isAdmin).toBe(true);
    expect(r.currentUserAccess).toEqual({ code: 'sato', groups: [], organizations: [] });
  });

  it('built-in の編集済 quickActions (metadata) を bootstrap でも反映する (#75)', async () => {
    mockBuiltIn.mockResolvedValue({
      ...BUILTIN_SET,
      business: makeAgent({
        id: 'a_biz',
        metadata: { purpose: 'business', quickActions: JSON.stringify(['編集後A', '編集後B']) },
      }),
    });
    const r = await initializeSession({ pluginId: 'plg_1' });
    const biz = r.builtInAgents!.find((a) => a.id === 'a_biz')!;
    expect(biz.quickActions).toEqual(['編集後A', '編集後B']);
  });

  it('preferredAgentId が候補に含まれていればそれを初期選択する', async () => {
    const r = await initializeSession({ pluginId: 'plg_1', preferredAgentId: 'a_sonnet' });
    expect(r.agentId).toBe('a_sonnet');
  });

  it('preferredAgentId が候補に無ければデフォルトにフォールバックする', async () => {
    const r = await initializeSession({ pluginId: 'plg_1', preferredAgentId: 'a_unknown' });
    expect(r.agentId).toBe('a_opus');
  });

  it('built-in 解決が失敗すると reject する (hook 側で error 表示)', async () => {
    mockBuiltIn.mockRejectedValue(new Error('Anthropic down'));
    await expect(initializeSession({ pluginId: 'plg_1' })).rejects.toThrow('Anthropic down');
  });

  it('skill 解決が失敗しても bootstrap は続行する', async () => {
    mockSkills.mockRejectedValue(new Error('skill fetch failed'));
    const r = await initializeSession({ pluginId: 'plg_1' });
    expect(r.agentId).toBe('a_opus');
  });
});

describe('initializeSession — workerUrl なし (フォールバック path)', () => {
  it('pluginId=null なら resolveDefaultAgent 経路を通り builtInAgents は null', async () => {
    mockDefault.mockResolvedValue(makeAgent({ id: 'agent_default' }));
    const r = await initializeSession({ pluginId: null });
    expect(r.builtInAgents).toBeNull();
    expect(r.currentUserAccess).toBeNull();
    expect(r.isAdmin).toBeNull();
    expect(r.agentId).toBe('agent_default');
    expect(r.environmentId).toBe('env_1');
    expect(mockBuiltIn).not.toHaveBeenCalled();
  });
});

describe('initializeSession — AbortSignal', () => {
  it('中断済みの signal を渡すと AbortError を throw する', async () => {
    mockGetPluginConfig.mockReturnValue({ workerUrl: 'https://worker.example.com', oauthClientId: null });
    const controller = new AbortController();
    controller.abort();
    await expect(
      initializeSession({ pluginId: 'plg_1' }, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('selectInitialAgentId', () => {
  const rec = (id: string, over: Partial<AgentRecord> = {}): AgentRecord =>
    ({ id, visibility: 'public', isDefault: false, ...over }) as AgentRecord;

  it('空配列なら空文字', () => {
    expect(selectInitialAgentId([])).toBe('');
  });

  it('preferredAgentId が含まれていればそれ', () => {
    expect(selectInitialAgentId([rec('a'), rec('b')], 'b')).toBe('b');
  });

  it('preferredAgentId が無ければ public + isDefault を優先', () => {
    expect(selectInitialAgentId([rec('a'), rec('b', { isDefault: true })], 'x')).toBe('b');
  });

  it('default が無ければ最初の public', () => {
    expect(selectInitialAgentId([rec('a', { visibility: 'private' }), rec('b')])).toBe('b');
  });

  it('public が無ければ records[0]', () => {
    expect(
      selectInitialAgentId([rec('a', { visibility: 'private' }), rec('b', { visibility: 'private' })]),
    ).toBe('a');
  });
});
