import { describe, it, expect, beforeEach } from 'vitest';

import { useChatStore } from './chatStore';

beforeEach(() => {
  useChatStore.getState().reset();
});

describe('chatStore', () => {
  it('初期状態は messages が空、sessionId は null、status は idle', () => {
    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.sessionId).toBeNull();
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
  });

  it('addMessage でメッセージを末尾に追加する', () => {
    useChatStore.getState().addMessage({ id: 'm1', kind: 'user', text: 'hi' });
    useChatStore.getState().addMessage({ id: 'm2', kind: 'agent', text: 'hello' });

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0]!.id).toBe('m1');
    expect(state.messages[1]!.id).toBe('m2');
  });

  it('replaceMessage で指定 id のメッセージを差し替える', () => {
    useChatStore.getState().addMessage({ id: 'm1', kind: 'thinking' });
    useChatStore.getState().replaceMessage('m1', { id: 'm1', kind: 'agent', text: 'done' });

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]!.kind).toBe('agent');
  });

  it('replaceMessage で該当 id が存在しない場合は何もしない', () => {
    useChatStore.getState().addMessage({ id: 'm1', kind: 'user', text: 'x' });
    useChatStore.getState().replaceMessage('ghost', { id: 'ghost', kind: 'agent', text: 'y' });

    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0]!.id).toBe('m1');
  });

  it('removeMessage で指定 id を削除する', () => {
    useChatStore.getState().addMessage({ id: 'm1', kind: 'thinking' });
    useChatStore.getState().addMessage({ id: 'm2', kind: 'agent', text: 'x' });
    useChatStore.getState().removeMessage('m1');

    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0]!.id).toBe('m2');
  });

  it('setSessionId で sessionId を更新できる', () => {
    useChatStore.getState().setSessionId('sess_1');
    expect(useChatStore.getState().sessionId).toBe('sess_1');
  });

  it('setStatus で status を更新できる', () => {
    useChatStore.getState().setStatus('bootstrapping');
    expect(useChatStore.getState().status).toBe('bootstrapping');

    useChatStore.getState().setStatus('error', '接続に失敗しました');
    expect(useChatStore.getState().status).toBe('error');
    expect(useChatStore.getState().error).toBe('接続に失敗しました');
  });

  it('reset は messages / sessionId / status / error を初期化する', () => {
    useChatStore.getState().addMessage({ id: 'm1', kind: 'user', text: 'x' });
    useChatStore.getState().setSessionId('sess_1');
    useChatStore.getState().setStatus('error', 'oops');

    useChatStore.getState().reset();

    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.sessionId).toBeNull();
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
  });

  describe('binding', () => {
    it('初期値は bindingStatus="unknown" / vaultId=null / credentialId=null / bindingError=null', () => {
      const s = useChatStore.getState();
      expect(s.bindingStatus).toBe('unknown');
      expect(s.vaultId).toBeNull();
      expect(s.credentialId).toBeNull();
      expect(s.bindingError).toBeNull();
    });

    it('setVaultId / setCredentialId で値を設定できる', () => {
      useChatStore.getState().setVaultId('vault_x');
      useChatStore.getState().setCredentialId('env_x');
      const s = useChatStore.getState();
      expect(s.vaultId).toBe('vault_x');
      expect(s.credentialId).toBe('env_x');
    });

    it('setBindingStatus("error", msg) でエラーメッセージが保持される', () => {
      useChatStore.getState().setBindingStatus('error', 'failed to bind');
      const s = useChatStore.getState();
      expect(s.bindingStatus).toBe('error');
      expect(s.bindingError).toBe('failed to bind');
    });

    it('setBindingStatus("bound") では bindingError が null にクリアされる', () => {
      useChatStore.getState().setBindingStatus('error', 'oops');
      useChatStore.getState().setBindingStatus('bound');
      expect(useChatStore.getState().bindingError).toBeNull();
    });

    it('reset() で binding 状態も初期化される', () => {
      useChatStore.getState().setVaultId('v1');
      useChatStore.getState().setCredentialId('e1');
      useChatStore.getState().setBindingStatus('bound');
      useChatStore.getState().reset();
      const s = useChatStore.getState();
      expect(s.vaultId).toBeNull();
      expect(s.credentialId).toBeNull();
      expect(s.bindingStatus).toBe('unknown');
    });
  });

  describe('view', () => {
    it('初期値は chat', () => {
      expect(useChatStore.getState().view).toBe('chat');
    });

    it('setView で history に切り替えられる', () => {
      useChatStore.getState().setView('history');
      expect(useChatStore.getState().view).toBe('history');
    });
  });

  describe('startNewConversation', () => {
    it('messages を空に、sessionId を null にする (view は維持)', () => {
      useChatStore.getState().addMessage({ id: 'm1', kind: 'user', text: 'x' });
      useChatStore.getState().setSessionId('sess_1');
      useChatStore.getState().setView('history');

      useChatStore.getState().startNewConversation();

      const s = useChatStore.getState();
      expect(s.messages).toEqual([]);
      expect(s.sessionId).toBeNull();
      expect(s.view).toBe('history');
    });
  });

  describe('mergeMessage', () => {
    it('同一 id があれば no-op (重複追加しない)', () => {
      useChatStore.getState().addMessage({ id: 'evt_1', kind: 'agent', text: 'a' });
      useChatStore.getState().mergeMessage({ id: 'evt_1', kind: 'agent', text: 'a' });
      expect(useChatStore.getState().messages).toHaveLength(1);
    });

    it('user 発言のオプティミスティック (id プレフィックス user-) は API 由来 id で置換する', () => {
      useChatStore.getState().addMessage({ id: 'user-local-1', kind: 'user', text: 'hi' });
      useChatStore.getState().mergeMessage({ id: 'evt_42', kind: 'user', text: 'hi' });
      const msgs = useChatStore.getState().messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0]!.id).toBe('evt_42');
    });

    it('user 発言でも本文が違えば置換せず追加する', () => {
      useChatStore.getState().addMessage({ id: 'user-local-1', kind: 'user', text: 'hi' });
      useChatStore.getState().mergeMessage({ id: 'evt_42', kind: 'user', text: 'bye' });
      expect(useChatStore.getState().messages).toHaveLength(2);
    });

    it('agent 発言は通常追加 (置換ロジックは user 限定)', () => {
      useChatStore.getState().mergeMessage({ id: 'evt_1', kind: 'agent', text: 'a' });
      useChatStore.getState().mergeMessage({ id: 'evt_2', kind: 'agent', text: 'b' });
      expect(useChatStore.getState().messages).toHaveLength(2);
    });
  });

  it('resetConversation は messages だけクリアして session は保つ', () => {
    useChatStore.getState().addMessage({ id: 'm1', kind: 'user', text: 'x' });
    useChatStore.getState().setSessionId('sess_1');

    useChatStore.getState().resetConversation();

    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.sessionId).toBe('sess_1'); // 呼び出し側で切り替える
  });
});
