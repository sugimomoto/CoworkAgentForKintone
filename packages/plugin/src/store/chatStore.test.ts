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

  describe('setAgentRunning / setSessionTerminated', () => {
    it('初期値は false', () => {
      expect(useChatStore.getState().isAgentRunning).toBe(false);
      expect(useChatStore.getState().sessionTerminated).toBe(false);
    });

    it('setAgentRunning で更新できる', () => {
      useChatStore.getState().setAgentRunning(true);
      expect(useChatStore.getState().isAgentRunning).toBe(true);
      useChatStore.getState().setAgentRunning(false);
      expect(useChatStore.getState().isAgentRunning).toBe(false);
    });

    it('setSessionTerminated で更新できる', () => {
      useChatStore.getState().setSessionTerminated(true);
      expect(useChatStore.getState().sessionTerminated).toBe(true);
    });

    it('startNewConversation で両フラグが false にリセットされる', () => {
      useChatStore.getState().setAgentRunning(true);
      useChatStore.getState().setSessionTerminated(true);
      useChatStore.getState().startNewConversation();
      expect(useChatStore.getState().isAgentRunning).toBe(false);
      expect(useChatStore.getState().sessionTerminated).toBe(false);
    });
  });

  describe('updateTool', () => {
    it('既存 tool message を id で部分更新する', () => {
      useChatStore.getState().addMessage({
        id: 'tu_1',
        kind: 'tool',
        name: 'kintone-add-record',
        input: { app: '1' },
        status: 'running',
      });

      useChatStore.getState().updateTool('tu_1', { status: 'success', result: { id: '42' } });

      const m = useChatStore.getState().messages[0]!;
      expect(m.kind).toBe('tool');
      if (m.kind === 'tool') {
        expect(m.status).toBe('success');
        expect(m.result).toEqual({ id: '42' });
        expect(m.name).toBe('kintone-add-record'); // patch 外のフィールドは保持
      }
    });

    it('該当 ID が無いときは no-op', () => {
      useChatStore.getState().addMessage({ id: 'm1', kind: 'agent', text: 'x' });
      useChatStore.getState().updateTool('tu_unknown', { status: 'success' });
      expect(useChatStore.getState().messages).toHaveLength(1);
    });

    it('同じ ID でも kind !== tool なら no-op', () => {
      useChatStore.getState().addMessage({ id: 'tu_1', kind: 'agent', text: 'x' });
      useChatStore.getState().updateTool('tu_1', { status: 'success' });
      const m = useChatStore.getState().messages[0]!;
      expect(m.kind).toBe('agent');
    });
  });

  describe('artifacts', () => {
    it('初期値は空 Map / activeArtifactId=null', () => {
      const s = useChatStore.getState();
      expect(s.artifacts.size).toBe(0);
      expect(s.activeArtifactId).toBeNull();
    });

    it('upsertArtifact で新規追加され version=1, createdAt/updatedAt が設定される', () => {
      const a = useChatStore.getState().upsertArtifact({
        id: 'a1',
        kind: 'markdown',
        title: 'T',
        content: '# Hello',
      });
      expect(a.version).toBe(1);
      expect(a.createdAt).toBeGreaterThan(0);
      expect(a.updatedAt).toBe(a.createdAt);
      expect(useChatStore.getState().artifacts.get('a1')?.content).toBe('# Hello');
    });

    it('同じ id で再 upsert すると content が更新され version が +1、createdAt は維持', () => {
      const first = useChatStore.getState().upsertArtifact({
        id: 'a1', kind: 'markdown', title: 'T', content: 'v1',
      });
      const second = useChatStore.getState().upsertArtifact({
        id: 'a1', kind: 'markdown', title: 'T2', content: 'v2',
      });
      expect(second.version).toBe(2);
      expect(second.createdAt).toBe(first.createdAt);
      expect(second.title).toBe('T2');
      expect(useChatStore.getState().artifacts.get('a1')?.content).toBe('v2');
    });

    it('upsertArtifact は毎回 Map インスタンスを再生成する (Zustand 等値判定対策)', () => {
      const before = useChatStore.getState().artifacts;
      useChatStore.getState().upsertArtifact({ id: 'a1', kind: 'json', title: 'T', content: '{}' });
      const after = useChatStore.getState().artifacts;
      expect(after).not.toBe(before);
    });

    it('removeArtifact で削除される。activeArtifactId が一致すれば null に戻す', () => {
      useChatStore.getState().upsertArtifact({ id: 'a1', kind: 'markdown', title: 'T', content: 'x' });
      useChatStore.getState().setActiveArtifact('a1');
      useChatStore.getState().removeArtifact('a1');
      const s = useChatStore.getState();
      expect(s.artifacts.has('a1')).toBe(false);
      expect(s.activeArtifactId).toBeNull();
    });

    it('removeArtifact で activeArtifactId が別の id ならそのまま', () => {
      useChatStore.getState().upsertArtifact({ id: 'a1', kind: 'markdown', title: 'T', content: 'x' });
      useChatStore.getState().upsertArtifact({ id: 'a2', kind: 'markdown', title: 'T', content: 'y' });
      useChatStore.getState().setActiveArtifact('a2');
      useChatStore.getState().removeArtifact('a1');
      expect(useChatStore.getState().activeArtifactId).toBe('a2');
    });

    it('clearArtifacts で全削除 + activeArtifactId=null', () => {
      useChatStore.getState().upsertArtifact({ id: 'a1', kind: 'markdown', title: 'T', content: 'x' });
      useChatStore.getState().setActiveArtifact('a1');
      useChatStore.getState().clearArtifacts();
      const s = useChatStore.getState();
      expect(s.artifacts.size).toBe(0);
      expect(s.activeArtifactId).toBeNull();
    });

    it('startNewConversation で artifacts もクリアされる', () => {
      useChatStore.getState().upsertArtifact({ id: 'a1', kind: 'markdown', title: 'T', content: 'x' });
      useChatStore.getState().setActiveArtifact('a1');
      useChatStore.getState().startNewConversation();
      const s = useChatStore.getState();
      expect(s.artifacts.size).toBe(0);
      expect(s.activeArtifactId).toBeNull();
    });

    it('reset で artifacts もクリアされる', () => {
      useChatStore.getState().upsertArtifact({ id: 'a1', kind: 'markdown', title: 'T', content: 'x' });
      useChatStore.getState().setActiveArtifact('a1');
      useChatStore.getState().reset();
      const s = useChatStore.getState();
      expect(s.artifacts.size).toBe(0);
      expect(s.activeArtifactId).toBeNull();
    });
  });

  describe('attachedFiles', () => {
    it('初期値は空配列', () => {
      expect(useChatStore.getState().attachedFiles).toEqual([]);
    });

    it('addAttachedFile で末尾に追加される', () => {
      useChatStore.getState().addAttachedFile({
        localId: 'f1',
        filename: 'a.csv',
        size: 100,
        mimeType: 'text/csv',
        kind: 'text',
        status: 'reading',
      });
      const list = useChatStore.getState().attachedFiles;
      expect(list).toHaveLength(1);
      expect(list[0]?.localId).toBe('f1');
    });

    it('updateAttachedFile で部分更新される', () => {
      useChatStore.getState().addAttachedFile({
        localId: 'f1',
        filename: 'a.csv',
        size: 100,
        mimeType: 'text/csv',
        kind: 'text',
        status: 'reading',
      });
      useChatStore.getState().updateAttachedFile('f1', {
        status: 'ready',
        content: 'a,b\n1,2',
      });
      const f = useChatStore.getState().attachedFiles[0]!;
      expect(f.status).toBe('ready');
      expect(f.content).toBe('a,b\n1,2');
      expect(f.filename).toBe('a.csv'); // 未指定フィールドは保持
    });

    it('updateAttachedFile で該当無し → no-op', () => {
      useChatStore.getState().addAttachedFile({
        localId: 'f1',
        filename: 'a.csv',
        size: 1,
        mimeType: 'text/csv',
        kind: 'text',
        status: 'reading',
      });
      useChatStore.getState().updateAttachedFile('ghost', { status: 'ready' });
      expect(useChatStore.getState().attachedFiles).toHaveLength(1);
      expect(useChatStore.getState().attachedFiles[0]?.status).toBe('reading');
    });

    it('removeAttachedFile で削除される', () => {
      useChatStore.getState().addAttachedFile({
        localId: 'f1', filename: 'a', size: 1, mimeType: 't', kind: 'text', status: 'ready',
      });
      useChatStore.getState().addAttachedFile({
        localId: 'f2', filename: 'b', size: 1, mimeType: 't', kind: 'text', status: 'ready',
      });
      useChatStore.getState().removeAttachedFile('f1');
      const list = useChatStore.getState().attachedFiles;
      expect(list).toHaveLength(1);
      expect(list[0]?.localId).toBe('f2');
    });

    it('clearAttachedFiles で空に戻る', () => {
      useChatStore.getState().addAttachedFile({
        localId: 'f1', filename: 'a', size: 1, mimeType: 't', kind: 'text', status: 'ready',
      });
      useChatStore.getState().clearAttachedFiles();
      expect(useChatStore.getState().attachedFiles).toEqual([]);
    });

    it('startNewConversation で attachedFiles もクリアされる', () => {
      useChatStore.getState().addAttachedFile({
        localId: 'f1', filename: 'a', size: 1, mimeType: 't', kind: 'text', status: 'ready',
      });
      useChatStore.getState().startNewConversation();
      expect(useChatStore.getState().attachedFiles).toEqual([]);
    });

    it('reset で attachedFiles もクリアされる', () => {
      useChatStore.getState().addAttachedFile({
        localId: 'f1', filename: 'a', size: 1, mimeType: 't', kind: 'text', status: 'ready',
      });
      useChatStore.getState().reset();
      expect(useChatStore.getState().attachedFiles).toEqual([]);
    });
  });
});
