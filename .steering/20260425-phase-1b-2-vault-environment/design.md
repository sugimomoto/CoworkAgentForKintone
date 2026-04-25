# Phase 1b-2 — Vault + ユーザー Environment + CredentialDialog 設計

要件: [requirements.md](./requirements.md)

## 1. 全体方針

### 1.1 ライフサイクル

```
[起動]
  ChatPanel マウント
    ├─ useSession  : Default Agent + (Bootstrap Environment) を解決して status=ready
    └─ useUserBinding : Vault と User Environment を metadata で検索
        ├─ 両方見つかる → bindingStatus='bound', vaultId/environmentId を store に保存
        └─ 見つからない → bindingStatus='unbound'

[初回送信時]
  bindingStatus === 'unbound':
    - 入力テキストを保留 (pendingText)
    - CredentialDialog を表示
    - ユーザーが ID/PW 入力 → bind(values)
        - Vault 作成 + keys 書込
        - User Environment 作成 (helper wheel URL を pip)
        - bindingStatus='bound', store に id 反映
    - ダイアログ閉じる
    - 保留していた pendingText をそのまま postUserMessage に流す

  bindingStatus === 'bound':
    - 即 ensureSession (User Environment + Vault で新 Session 作成)
    - postUserMessage

[履歴復元時]
  selectSession(id) は変更なし (sessionId 切替 + messages クリア)。
  既存 Session の environment_id / vault_ids は固定なので、復元したセッションは
  作成時の Environment で動作する (= bootstrap で作られた Session を復元すると
  bootstrap Env で続きが動く)。
  alpha 段階ではここは仕様として許容 (= 履歴は read-only に近い扱い)。
  新規発言は常に「現在の bound 状態」で新 Session を作る方が安全。
  → 設計判断: 履歴 Session に postUserMessage を許可する (= 過去 Session 継続)
    だが、新規会話ボタンを押した直後は必ず「ユーザー Env で新 Session」になる。
```

### 1.2 1 ユーザー = 1 (Vault, Environment) ペア

- key: metadata `source` + `kintoneDomain` + `kintoneUserCode`
- 「マルチテナント切替」「helper version 違い」は **alpha スコープ外**
- 異なるドメインに切替えれば自動的に別ペアが作られる (metadata 検索の自然な多重化)

---

## 2. Managed Agents Vault API ラッパ

### 2.1 型 (`core/managed-agents/types.ts`)

既存の `Vault` 型に以下を追加 (skill ドキュメントから補完):

```ts
export interface Vault {
  id: string;
  display_name: string;
  metadata?: Record<string, unknown>;
  keys?: string[];        // 設定済みキー名のみ。値は API レスポンスに出ない
  created_at: string;
  updated_at: string;
  type: 'vault';
}

export interface CreateVaultBody {
  display_name: string;
  metadata?: Record<string, unknown>;
}

export interface SetVaultKeysBody {
  keys: Record<string, string>;   // 1 リクエストで複数 key/value をまとめて設定
}
```

### 2.2 関数 (`core/managed-agents/resources.ts`)

```ts
export async function listVaults(params?: { order?: 'asc'|'desc'; limit?: number; page?: string }): Promise<ListResponse<Vault>>;
export async function createVault(body: CreateVaultBody): Promise<Vault>;
export async function setVaultKeys(vaultId: string, keys: Record<string, string>): Promise<Vault>;
```

エンドポイント (Anthropic Managed Agents Beta):
- `GET /v1/vaults`
- `POST /v1/vaults`
- `POST /v1/vaults/{id}/keys` (skill ドキュメントの想定。実装時に skill / API doc で再確認)

`apiRequest` を経由するので Phase 1a の認証パイプラインがそのまま使える。
`filterByMetadata` も Vault に対して同じく適用可能。

---

## 3. Bootstrap 層

### 3.1 `core/bootstrap/resolveVault.ts`

```ts
import { METADATA_SOURCE } from '../constants';
import { createVault, filterByMetadata, listVaults, setVaultKeys, pickOldest } from '../managed-agents/resources';

import type { Vault } from '../managed-agents/types';

export interface VaultContext {
  kintoneDomain: string;
  kintoneUserCode: string;
}

let inFlightResolve: Promise<Vault> | null = null;

export async function resolveUserVault(ctx: VaultContext): Promise<Vault> {
  if (inFlightResolve) return inFlightResolve;
  inFlightResolve = (async () => {
    try {
      const list = await listVaults({ order: 'desc', limit: 100 });
      const matches = filterByMetadata(list.data, {
        source: METADATA_SOURCE,
        kintoneDomain: ctx.kintoneDomain,
        kintoneUserCode: ctx.kintoneUserCode,
      });
      if (matches.length > 0) return pickOldest(matches);  // race-deterministic

      // 作成
      return await createVault({
        display_name: `Cowork Agent - ${ctx.kintoneUserCode}@${ctx.kintoneDomain}`,
        metadata: {
          source: METADATA_SOURCE,
          kintoneDomain: ctx.kintoneDomain,
          kintoneUserCode: ctx.kintoneUserCode,
        },
      });
    } finally {
      inFlightResolve = null;
    }
  })();
  return inFlightResolve;
}

export async function setVaultCredentials(
  vaultId: string,
  creds: { domain: string; login: string; password: string },
): Promise<void> {
  await setVaultKeys(vaultId, {
    KINTONE_DOMAIN: creds.domain,
    KINTONE_LOGIN: creds.login,
    KINTONE_PASSWORD: creds.password,
  });
}
```

### 3.2 `core/bootstrap/ensureEnvironment.ts`

ユーザー専用 Environment の解決。Phase 1a の `resolveBootstrapEnvironment` とは独立した
新ファイル (resolveEnvironment.ts は触らない)。

```ts
import { HELPER_VERSION, HELPER_WHEEL_URL, METADATA_SOURCE } from '../constants';
import {
  createEnvironment,
  filterByMetadata,
  listEnvironments,
  pickOldest,
} from '../managed-agents/resources';

import type { Environment } from '../managed-agents/types';

export interface UserEnvironmentContext {
  agentId: string;     // Default Agent の id (metadata に保存するためだけ。Session 紐付けではない)
  kintoneDomain: string;
  kintoneUserCode: string;
}

let inFlightResolve: Promise<Environment> | null = null;

export async function ensureUserEnvironment(ctx: UserEnvironmentContext): Promise<Environment> {
  if (inFlightResolve) return inFlightResolve;
  inFlightResolve = (async () => {
    try {
      const list = await listEnvironments({ order: 'desc', limit: 100 });
      const matches = filterByMetadata(list.data, {
        source: METADATA_SOURCE,
        kintoneDomain: ctx.kintoneDomain,
        kintoneUserCode: ctx.kintoneUserCode,
      });
      if (matches.length > 0) return pickOldest(matches);

      return await createEnvironment({
        name: `Cowork Agent - ${ctx.kintoneUserCode}@${ctx.kintoneDomain}`,
        config: {
          type: 'cloud',
          networking: {
            type: 'limited',
            allow_package_managers: true,
            allowed_hosts: [ctx.kintoneDomain],
          },
          packages: { pip: [HELPER_WHEEL_URL] },
        },
        metadata: {
          source: METADATA_SOURCE,
          kintoneDomain: ctx.kintoneDomain,
          kintoneUserCode: ctx.kintoneUserCode,
          agentId: ctx.agentId,
          helperVersion: HELPER_VERSION,
        },
      });
    } finally {
      inFlightResolve = null;
    }
  })();
  return inFlightResolve;
}
```

### 3.3 `core/bootstrap/resolveSession.ts` の拡張

`createUserSession` に `vaultId` を任意で受ける引数を追加。Phase 1a 互換のため `vaultId`
未指定なら従来通り (= bootstrap セッション扱い)。

```ts
export interface SessionContext {
  agentId: string;
  environmentId: string;
  kintoneDomain: string;
  kintoneUserCode: string;
  vaultId?: string;     // 追加 (任意)
}

export async function createUserSession(ctx: SessionContext): Promise<Session> {
  return await createSession({
    agent: ctx.agentId,
    environment_id: ctx.environmentId,
    vault_ids: ctx.vaultId ? [ctx.vaultId] : [],
    title: makeInitialTitle(),
    metadata: {
      source: METADATA_SOURCE,
      kintoneDomain: ctx.kintoneDomain,
      kintoneUserCode: ctx.kintoneUserCode,
      agentId: ctx.agentId,
    },
  });
}
```

---

## 4. Constants

### 4.1 `core/constants.ts` 追加

```ts
/** kintone ヘルパーライブラリ — TestPyPI 経由で取得 */
export const HELPER_PACKAGE_NAME = 'cowork-agent-kintone' as const;
export const HELPER_VERSION = '0.1.0a3' as const;

/** Managed Agents Environment の packages.pip に渡す指定。
 *  TestPyPI を補助インデックスとして使い、依存 (requests など) は PyPI から取得する。
 *  形式は pip の requirement specifier 文字列。 */
export const HELPER_PIP_SPEC =
  `${HELPER_PACKAGE_NAME}==${HELPER_VERSION}` as const;

/** TestPyPI の simple index URL。Environment の packages.pip_extra_index_url に渡す。
 *  alpha 配布期間中のみ使用、stable 後は PyPI 本番に切替予定。 */
export const HELPER_PIP_EXTRA_INDEX = 'https://test.pypi.org/simple/' as const;
```

`ensureUserEnvironment` 内では:

```ts
config: {
  type: 'cloud',
  networking: {
    type: 'limited',
    allow_package_managers: true,
    allowed_hosts: [ctx.kintoneDomain],
  },
  packages: {
    pip: [HELPER_PIP_SPEC],
    pip_extra_index_url: HELPER_PIP_EXTRA_INDEX,
  },
}
```

> Managed Agents Environment の `packages.pip_extra_index_url` フィールド名は
> 実装時に skill / API ドキュメントで再確認 (案: `pip_index_url` / `pip_extra_index_urls` 配列の可能性あり)。

将来 helper を更新するときは `HELPER_VERSION` を上げる。`ensureUserEnvironment` の
metadata `helperVersion` と突合してバージョン違いを検出 → 再作成、は **Phase 1c に持ち越し**。

---

## 5. UI 層

### 5.1 `chatStore` 拡張

```ts
export type BindingStatus =
  | 'unknown'      // 初期状態 (まだ調べていない)
  | 'checking'     // 既存 Vault/Env 検索中
  | 'unbound'      // 未バインド
  | 'binding'      // CredentialDialog 経由でバインド処理中
  | 'bound'        // 完了
  | 'error';       // バインド失敗

interface ChatState {
  // ... 既存
  vaultId: string | null;
  userEnvironmentId: string | null;   // bootstrap とは別変数で持つ
  bindingStatus: BindingStatus;
  bindingError: string | null;

  setVaultId: (id: string | null) => void;
  setUserEnvironmentId: (id: string | null) => void;
  setBindingStatus: (status: BindingStatus, error?: string | null) => void;
}
```

### 5.2 `useUserBinding` フック

```ts
export interface UseUserBindingResult {
  status: BindingStatus;
  bind: (values: { domain: string; login: string; password: string }) => Promise<void>;
}

export function useUserBinding(): UseUserBindingResult {
  // 起動時の bootstrap 完了 (chatStore.status === 'ready') を待ってから検索
  // 1. listVaults / listEnvironments を並行で走らせて metadata 突合
  // 2. 両方ある → 'bound' + state 反映
  // 3. 片方だけ / 両方無し → 'unbound'
  //   (実装方針: 揃ってない場合も 'unbound' でやり直し誘導。中途半端な状態は bind() が再構築)
  // 4. bind(values):
  //   - setBindingStatus('binding')
  //   - Vault 作成/取得 → setVaultKeys
  //   - User Env 作成/取得
  //   - store に反映 → 'bound'
  //   - 失敗時は 'error'
}
```

### 5.3 `CredentialDialog`

```tsx
export interface CredentialDialogProps {
  open: boolean;
  initialDomain: string;       // getCurrentSessionContext().kintoneDomain
  onSubmit: (values: { domain: string; login: string; password: string }) => Promise<void>;
  onClose: () => void;
}
```

UI:
- モーダル overlay (背景クリック / ESC で onClose)
- Domain (text, 既定値: initialDomain)
- ログイン名 (text)
- パスワード (password, 表示切替トグル付き)
- 「キャンセル」「登録」ボタン
- 登録中はスピナー + ボタン disabled
- エラー時は赤帯でメッセージ表示
- バリデーション:
  - 空必須
  - domain は正規表現 `/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i`

### 5.4 ChatPanel 統合

```tsx
const { ensureSession, selectSession, startNewConversation } = useSession();
const { status: bindingStatus, bind } = useUserBinding();

// ChatPanel に新 state: pendingText (送信予約)
const [pendingText, setPendingText] = useState<string | null>(null);

const handleSubmit = useCallback(async (text: string) => {
  // optimistic add (existing)
  addMessage({ id: ..., kind: 'user', text });
  addMessage({ id: pending-thinking-..., kind: 'thinking' });

  if (bindingStatus === 'unbound') {
    setPendingText(text);
    return;   // dialog 表示は描画側で bindingStatus='unbound' && pendingText != null で判定
  }

  try {
    const sid = await ensureSession();
    await postUserMessage(sid, text);
  } catch { /* ... */ }
}, [bindingStatus, ...]);

const handleBindSubmit = async (values) => {
  await bind(values);
  // 成功後、保留テキストを送信
  if (pendingText) {
    const text = pendingText;
    setPendingText(null);
    const sid = await ensureSession();
    await postUserMessage(sid, text);
  }
};

const handleBindCancel = () => {
  // 保留テキストを諦める = optimistic に追加した user message を削除
  setPendingText(null);
  // pending- thinking と user-* を removeMessage
};
```

`useSession.ensureSession` の修正: bound のときは `userEnvironmentId` + `vaultId` を使う。

```ts
const ensureSession = useCallback(async () => {
  const existing = useChatStore.getState().sessionId;
  if (existing) return existing;
  if (inFlightRef.current) return inFlightRef.current;

  const ctx = ctxRef.current;
  if (!ctx) throw new Error('bootstrap が完了していません');

  const { userEnvironmentId, vaultId, bindingStatus } = useChatStore.getState();
  const useUserEnv = bindingStatus === 'bound' && userEnvironmentId && vaultId;
  const environmentId = useUserEnv ? userEnvironmentId! : ctx.environmentId;
  const vaultIdForSession = useUserEnv ? vaultId! : undefined;

  const p = (async (): Promise<string> => {
    try {
      const session = await createUserSession({
        agentId: ctx.agentId,
        environmentId,
        kintoneDomain: ctx.kintoneDomain,
        kintoneUserCode: ctx.kintoneUserCode,
        ...(vaultIdForSession ? { vaultId: vaultIdForSession } : {}),
      });
      setSessionId(session.id);
      return session.id;
    } finally {
      inFlightRef.current = null;
    }
  })();
  inFlightRef.current = p;
  return p;
}, [setSessionId]);
```

### 5.5 Header から CredentialDialog を開く

設定アイコン (歯車) から既存認証情報の更新ができるように:
- Header の `onSettingsClick` を `() => setManualOpen(true)` 相当にする (もしくは新 prop `onCredentialClick`)
- ChatPanel 内で `manualOpen` state を保持してダイアログを再表示
- 既存値はパスワード以外は表示 (パスワードは空で再入力させる)

これは AC-7 の最終条件のひとつだが、UI 余力次第で **Phase 1b-3 への持ち越し** も検討。

---

## 6. テスト戦略

### 6.1 単体テスト (Vitest)

- `resolveVault.test.ts`: 既存 Vault 検索 / 作成 / metadata フィルタ / in-flight 保護 / setVaultCredentials
- `ensureEnvironment.test.ts`: ユーザー Env 検索 / 作成 / config 内容確認 (HELPER_WHEEL_URL / allowed_hosts) / metadata
- `CredentialDialog.test.tsx`: 描画 / バリデーション / 登録ボタン / キャンセル / 進捗中 disabled
- `useUserBinding.test.ts`: 状態遷移 (`checking → bound`, `checking → unbound`, `unbound → binding → bound`, error 遷移)
- `chatStore.test.ts`: vaultId / userEnvironmentId / bindingStatus / setter
- `ChatPanel.test.tsx`: unbound 送信で dialog が出る / bound 後は ensureSession → postUserMessage の順 / cancel で optimistic 削除

fixtures.ts に `makeVault` を追加。

### 6.2 E2E (Playwright)

- `e2e/credential-binding.spec.ts`:
  - 起動 → メッセージ入力 → 送信 → CredentialDialog 出現
  - 入力 → 登録 → ダイアログ閉じる → 通常通り Agent 応答
  - 一度 bind したら次の起動では Dialog 出ない (リロード後 もう一度送信)
  - **テスト用 Vault/Env のクリーンアップ手順** (手動 or テスト spec 末尾で削除) は spec
    冒頭にコメントで明記。alpha では「テスト後のクリーンアップは手動」でも許容

既存の `live.spec.ts` / `session-history.spec.ts` は **fresh state では Dialog が出るため
そのままでは通らない**。対策:
- option A (推奨): spec 内で `localStorage` / Vault を事前に bound 状態にする helper を用意
- option B: 既存の他 spec を実行する前に bind する setup spec を追加 (`e2e/credential-bind.setup.ts`)
- option C: 既存テストを書き換えて Dialog をハンドルする

→ 設計判断: option B (auth.setup と並列に bind setup spec を追加) で一発バインドし、以降の
spec では `binding` state が永続している前提で進める。Vault/Env はサーバ側に残るため、
複数 CI 実行で一貫した状態が得られる。

---

## 7. 段階的な実装順序

1. **Constants**: `HELPER_VERSION` / `HELPER_WHEEL_URL` 追加
2. **Resources 層**: types に `Vault` 完成 + `listVaults` / `createVault` / `setVaultKeys`
3. **resolveVault**: 単体テスト + 実装
4. **ensureUserEnvironment**: 単体テスト + 実装
5. **chatStore**: vaultId / userEnvironmentId / bindingStatus state + setter
6. **useUserBinding**: 単体テスト + 実装
7. **CredentialDialog**: 単体テスト + 実装
8. **resolveSession.createUserSession**: vaultId 受取拡張 + 既存テスト維持 + 新規テスト
9. **useSession.ensureSession**: bound 状態で User Env / Vault を使う分岐 + テスト
10. **ChatPanel**: useUserBinding 統合 + pendingText / cancel ハンドリング + テスト
11. **Header**: 設定アイコンから CredentialDialog (時間あれば。さもなくば 1b-3)
12. **E2E**: bind setup spec + credential-binding spec
13. **動作確認**: deploy + 手動 E2E (Anthropic API 実環境)

各ステップ TDD (Red → Green) で進める。

---

## 8. リスク・未確定事項

| リスク | 対応 |
|---|---|
| Anthropic Managed Agents Vault API のエンドポイント仕様未確定 | skill / API ドキュメントで実装時に確認。fallback として ClaudeManagedAgents skill の references/api を参照 |
| Environment 作成に時間がかかる (pip install で 1〜2 分) | UI スピナー + 「準備中」表示。タイムアウトは長めに (5 分) |
| Vault に保存したパスワードを後から確認できない | 仕様 (UI 側でも echo しない)。再入力は Header → 設定 → CredentialDialog の上書きで対応 |
| 既存 Phase 1a / Session 再設計の単体テストが落ちる | useSession 改修部分を慎重に。bootstrap Env パスを残し、bound 時のみ user Env パスを使う互換実装 |
| E2E が fresh state で Dialog にぶつかる | bind setup spec で先んじてバインド (option B) |
| HELPER_WHEEL_URL の更新で Environment 再作成必要 | Phase 1c 持ち越し (helperVersion メタデータで突合する仕組み) |

---

## 9. 完了の定義

- requirements.md AC-1〜10 + NFR-1〜6 を満たす
- 既存 190+ 単体テストがすべて緑
- 新規追加テストもすべて緑 (目標: +30〜40 件)
- 既存 E2E 16 件を破壊しない
- 新規 E2E (credential-binding) が緑
- 手動: 実 kintone 環境で「初回送信 → Dialog → 入力 → 登録 → 送信完了」シナリオ確認
