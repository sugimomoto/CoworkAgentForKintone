// agentDetailApi の単体テスト (#40)
//
// fetch を stub して applyAgentEdit / createCustomAgentFrom / archiveAgentById の
// リクエスト形 (URL / method / body) を検証する。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyAgentEdit,
  archiveAgentById,
  createCustomAgentFrom,
  type AgentEditDraft,
} from './agentDetailApi';

import type { Agent } from './types';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const EXISTING_BUSINESS: Agent = {
  id: 'agent_biz_1',
  name: '業務エージェント',
  description: '...',
  model: { id: 'claude-sonnet-4-6' },
  metadata: {
    source: 'cowork-agent-for-kintone',
    type: 'default',
    purpose: 'business',
    promptVersion: 'v20-business',
    workerUrl: 'https://w.example.com',
    kintoneDomain: 'tenant.cybozu.com',
    iconKind: 'biz',
    iconColor: 'accentSoft',
    visibility: 'public',
    isDefault: '0',
  },
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-30T00:00:00Z',
  version: 1,
  type: 'agent',
};

const DRAFT: AgentEditDraft = {
  name: '業務 (編集後)',
  description: '編集済み説明',
  iconKind: 'biz',
  iconColor: 'teal',
  visibility: 'public',
  isDefault: true,
  systemPrompt: '新しい system prompt',
  anthropicSkillIds: ['xlsx', 'docx'],
  customSkillIds: ['sk_custom_1'],
  enabledTools: ['kintone-get-records', 'kintone-add-record'],
  quickActions: [],
  allowedUsers: [],
  allowedGroups: [],
  allowedOrganizations: [],
  mcpAttachments: [],
};

describe('applyAgentEdit (#40)', () => {
  it('retrieveAgent → updateAgent の順で呼び、metadata を merge する', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(EXISTING_BUSINESS)) // retrieve
      .mockResolvedValueOnce(jsonResponse({ ...EXISTING_BUSINESS, version: 2 })); // update

    const result = await applyAgentEdit('agent_biz_1', DRAFT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [getUrl, getInit] = fetchMock.mock.calls[0]!;
    expect(getUrl).toContain('/v1/agents/agent_biz_1');
    expect((getInit as RequestInit).method ?? 'GET').toBe('GET');

    const [postUrl, postInit] = fetchMock.mock.calls[1]!;
    expect(postUrl).toContain('/v1/agents/agent_biz_1');
    expect((postInit as RequestInit).method).toBe('POST');
    const body = JSON.parse((postInit as RequestInit).body as string);
    expect(body.name).toBe('業務 (編集後)');
    expect(body.system).toBe('新しい system prompt');
    // version は retrieve した既存値が乗る (optimistic concurrency)
    expect(body.version).toBe(1);
    // metadata は既存 + patch (find filter 列が残る)
    expect(body.metadata.purpose).toBe('business');
    expect(body.metadata.workerUrl).toBe('https://w.example.com');
    expect(body.metadata.iconColor).toBe('teal');
    expect(body.metadata.isDefault).toBe('1');
    expect(body.metadata.visibility).toBe('public');
    // skills
    expect(body.skills).toEqual([
      { type: 'anthropic', skill_id: 'xlsx' },
      { type: 'anthropic', skill_id: 'docx' },
      { type: 'custom', skill_id: 'sk_custom_1' },
    ]);
    // tools: agent_toolset + create_artifact + mcp_toolset(kintone) + mcp_toolset(notify, #13)
    expect(body.tools).toHaveLength(4);
    expect(body.tools[2].type).toBe('mcp_toolset');
    expect(body.tools[3]).toMatchObject({ type: 'mcp_toolset', mcp_server_name: 'notify' });
    // mcp_servers を notify toolset と整合させて必ず送る (kintone + notify)。
    // 送らないと「mcp_toolset references [notify] but no matching entry in mcp_servers」で 400。
    const servers = body.mcp_servers as Array<{ name: string }>;
    expect(servers.map((s) => s.name).sort()).toEqual(['kintone', 'notify']);
    expect(result.version).toBe(2);
  });

  it('mcp_servers を送らず notify toolset だけ参照する不整合を起こさない (#13 回帰)', async () => {
    // notify server を持たない (旧) Agent を編集しても、mcp_servers に notify を含めて送る
    const legacyAgent = {
      ...EXISTING_BUSINESS,
      metadata: { ...EXISTING_BUSINESS.metadata, purpose: 'custom' }, // notifyKey 無し custom
      mcp_servers: [{ type: 'url', name: 'kintone', url: 'https://w.example.com/mcp/tenant.cybozu.com' }],
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(legacyAgent))
      .mockResolvedValueOnce(jsonResponse({ ...legacyAgent, version: 2 }));

    await applyAgentEdit('agent_legacy', DRAFT);

    const body = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    const servers = body.mcp_servers as Array<{ name: string; url: string }>;
    expect(servers.map((s) => s.name).sort()).toEqual(['kintone', 'notify']);
    // custom で notifyKey 未採番 → 新規生成して metadata に永続化し、同じ key を notify URL に使う
    expect(typeof body.metadata.notifyKey).toBe('string');
    expect(body.metadata.notifyKey.length).toBeGreaterThan(0);
    expect(servers.find((s) => s.name === 'notify')!.url).toContain(body.metadata.notifyKey);
  });
});

describe('createCustomAgentFrom (#40)', () => {
  it('base Agent の model / workerUrl を引き継ぎ、purpose=custom で createAgent', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(EXISTING_BUSINESS)) // retrieve base
      .mockResolvedValueOnce(
        jsonResponse({
          ...EXISTING_BUSINESS,
          id: 'agent_new_custom',
          metadata: { ...EXISTING_BUSINESS.metadata, purpose: 'custom' },
        }),
      );

    const result = await createCustomAgentFrom({
      baseAgentId: 'agent_biz_1',
      draft: { ...DRAFT, name: '業務 のコピー' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [postUrl, postInit] = fetchMock.mock.calls[1]!;
    expect(postUrl).toContain('/v1/agents');
    expect(postUrl).not.toContain('/v1/agents/agent_biz_1');
    expect((postInit as RequestInit).method).toBe('POST');
    const body = JSON.parse((postInit as RequestInit).body as string);
    expect(body.model).toEqual({ id: 'claude-sonnet-4-6' });
    expect(body.name).toBe('業務 のコピー');
    expect(body.metadata.purpose).toBe('custom');
    expect(body.metadata.source).toBe('cowork-agent-for-kintone');
    expect(body.metadata.workerUrl).toBe('https://w.example.com');
    expect(body.metadata.kintoneDomain).toBe('tenant.cybozu.com');
    // 通知 (#13): notifyKey が採番され、mcp_servers は kintone + notify の 2 本
    expect(typeof body.metadata.notifyKey).toBe('string');
    expect(body.metadata.notifyKey.length).toBeGreaterThan(0);
    const servers = body.mcp_servers as Array<{ name: string; url: string }>;
    expect(servers).toHaveLength(2);
    expect(servers.find((s) => s.name === 'kintone')!.url).toContain('/mcp/tenant.cybozu.com');
    const notifyUrl = servers.find((s) => s.name === 'notify')!.url;
    expect(notifyUrl).toContain('/notify/tenant.cybozu.com/');
    expect(notifyUrl).toContain(body.metadata.notifyKey);
    expect(result.id).toBe('agent_new_custom');
  });
});

describe('archiveAgentById (#40)', () => {
  it('POST /v1/agents/{id}/archive を呼ぶ', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 200));
    await archiveAgentById('agent_to_kill');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/v1/agents/agent_to_kill/archive');
    expect((init as RequestInit).method).toBe('POST');
  });
});
