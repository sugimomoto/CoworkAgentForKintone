// chatPanelSkillsSync.ts の編集 / 削除ヘルパーの単体テスト (#30 V2)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetApiBase, resetTransport, setApiBase, setTransport } from '../managed-agents/client';

import { deleteCustomSkillFromChatPanel } from './chatPanelSkillsSync';

let transportMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  transportMock = vi.fn();
  setTransport(transportMock);
  setApiBase('https://worker.example.com/anthropic');
});

afterEach(() => {
  resetTransport();
  resetApiBase();
});

describe('deleteCustomSkillFromChatPanel (#30 V2)', () => {
  it('DELETE /v1/skills/{id} を Skills beta ヘッダ付きで呼ぶ', async () => {
    transportMock.mockResolvedValue(new Response(null, { status: 204 }));

    await deleteCustomSkillFromChatPanel({ skillId: 'skill_abc' });

    expect(transportMock).toHaveBeenCalledOnce();
    const [url, init] = transportMock.mock.calls[0]!;
    expect(url).toBe('https://worker.example.com/anthropic/v1/skills/skill_abc');
    expect((init as RequestInit).method).toBe('DELETE');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['anthropic-beta']).toBe('skills-2025-10-02');
  });

  it('skillId が url-encode 必要な文字を含んでもエスケープされる', async () => {
    transportMock.mockResolvedValue(new Response(null, { status: 204 }));
    await deleteCustomSkillFromChatPanel({ skillId: 'skill/with slash' });
    const [url] = transportMock.mock.calls[0]!;
    expect(url).toContain('skill%2Fwith%20slash');
  });

  it('skillId が空なら throw (= API を呼ばない)', async () => {
    await expect(deleteCustomSkillFromChatPanel({ skillId: '' })).rejects.toThrow(
      /skillId が空です/,
    );
    expect(transportMock).not.toHaveBeenCalled();
  });

  it('Anthropic 側エラー (HTTP 5xx) は ApiError を throw する', async () => {
    transportMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'boom' } }), { status: 500 }),
    );
    await expect(deleteCustomSkillFromChatPanel({ skillId: 'skill_x' })).rejects.toThrow(/HTTP 500/);
  });
});
