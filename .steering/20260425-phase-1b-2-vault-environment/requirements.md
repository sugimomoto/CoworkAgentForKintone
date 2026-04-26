# Phase 1b-2 — Vault + ユーザー Environment + CredentialDialog 要求定義

## 背景

Phase 1a は最小 Environment (`Cowork Agent - Bootstrap`) で会話だけを通した。
Phase 1b-1 で Python ヘルパーライブラリ (`cowork-agent-kintone==0.1.0a2`) を GitHub Release に公開した。

本 Phase では、ユーザーごとに**専用 Environment**を構築し、その中で **kintone ヘルパー
ライブラリ + 当該ユーザーの kintone 認証情報** が利用できる状態にする。

具体的には:

1. ユーザー固有の **Vault** に kintone のログイン情報 (Basic 認証用) を保管
2. ユーザー固有の **Environment** にヘルパーライブラリをプリインストールし、
   `allowed_hosts` で当該 kintone ドメインを許可
3. 初回利用時に **CredentialDialog** で ID/PW を入力してもらい、上記 Vault/Env を作成
4. 以降、Session 作成時は当該 Environment と Vault を利用

これにより、Agent は Environment 内で `from cowork_agent_kintone import Client; c = Client()`
を呼べば、Vault から自動注入された環境変数で kintone を操作できる状態になる。

## 公開・配布前提

- ヘルパーライブラリは [helper-v0.1.0a2 Release](https://github.com/sugimomoto/CoworkAgentForKintone/releases/tag/helper-v0.1.0a2) の wheel を `pip install <url>` で取得する
- PyPI 公開はまだ行わない (1.0 安定版時点で再検討)
- alpha 段階なので、Environment 構築時の URL はハードコードまたは `core/constants.ts` で集約

## 受け入れ条件

### AC-1: Vault の解決
- `resolveVault(ctx)` は metadata `source` + `kintoneDomain` + `kintoneUserCode` で
  既存 Vault を検索し、見つかればそれを返す
- 見つからない場合は新規作成する
- Vault 内のキーは `KINTONE_DOMAIN` / `KINTONE_LOGIN` / `KINTONE_PASSWORD` の 3 つ
- 作成時の display_name は `Cowork Agent - <userCode>@<domain>` 形式
- in-flight Promise 保護 (連投時に複数作成しない)

### AC-2: 認証情報の Vault への書込
- `setVaultCredentials(vaultId, { domain, login, password })` で 3 キーを upsert する
- 既存 Vault でも値を更新できる (CredentialDialog の「変更する」操作で再書込)
- API レスポンスでパスワードが echo されないことを期待 (Vault 仕様準拠)

### AC-3: ユーザー Environment の解決
- `ensureUserEnvironment(ctx)` は metadata `source` + `kintoneDomain` + `kintoneUserCode`
  で既存 Environment を検索する
- 既存があればそれを返す
- 無ければ新規作成する:
  - name: `Cowork Agent - <userCode>@<domain>`
  - config:
    - `type: 'cloud'`
    - `networking: { type: 'limited', allow_package_managers: true, allowed_hosts: ['<kintoneDomain>'] }`
    - `packages.pip`: `[<helper wheel URL>]`
  - metadata: `source / kintoneDomain / kintoneUserCode / agentId / helperVersion`
- `helperVersion` (例: `'0.1.0a2'`) を metadata に保持し、後続 Phase でバージョン不一致
  検出に使う (本 Phase では作成のみ、突合は Phase 1c に持ち越し)
- in-flight Promise 保護 + race-deterministic pickOldest (Phase 1a 同様)

### AC-4: bootstrap Environment との分離
- 既存の "Cowork Agent - Bootstrap" Environment は削除しない (他ユーザーが利用中の可能性)
- ユーザー Environment が見つかった場合、Session は **新ユーザー Environment 上で作成**
  される
- 既存の bootstrap 上の Session は履歴として閲覧可能 (履歴画面で listUserSessions)。
  ただし新規送信は新 Environment 側 (= 別 Session) で行う
  → 設計判断: ChatPanel の `ensureSession()` は `ensureUserEnvironment` 完了後に
  そのユーザー Environment を使う

### AC-5: CredentialDialog UI
- 未バインディング状態 (= ユーザー Environment 未作成) で **チャットに送信しようとした時** に
  Modal で開く
  - 起動時に強制で開かない (Welcome を見せたいため)
  - alternatively: 設定画面からも開ける入口がある (Header の歯車アイコンに連動)
- フォーム要素:
  - kintone ドメイン (デフォルト: `getCurrentSessionContext().kintoneDomain`)
  - ログイン名 (空)
  - パスワード (空、type=password)
- バリデーション:
  - 全フィールド必須
  - ドメイン形式: `*.cybozu.com` / `*.kintone.com` / `*.s.cybozu.com` 等を許容 (alpha では緩く正規表現で `[a-z0-9-]+\.([a-z]+\.)+[a-z]+`)
- 「登録」ボタンで:
  1. `resolveVault` → vaultId 取得
  2. `setVaultCredentials` → 認証情報書込
  3. `ensureUserEnvironment` → environmentId 取得
  4. chatStore に environmentId / vaultId を保存
  5. ダイアログを閉じる
- エラー時はダイアログ内に表示 (チャットには戻らない)
- 進捗表示: 各ステップ中はボタンを disabled + スピナー

### AC-6: useUserBinding フック
- 状態: `'unknown' | 'checking' | 'unbound' | 'binding' | 'bound' | 'error'`
- マウント時 (status==='ready' になった後) に既存 Vault/Environment を検索
- 見つかれば即 `'bound'` (vaultId / environmentId を store に保存)
- 見つからなければ `'unbound'`
- `bind(formValues)` 関数を返す: dialog から呼ばれて `'binding'` → `'bound'` or `'error'`
- store: `bindingStatus`, `vaultId`, `environmentId`

### AC-7: ChatPanel の拡張
- `bindingStatus === 'unbound'` のとき、`handleSubmit` 実行で **CredentialDialog を開く**
  - 既存メッセージはオプティミスティック追加 → 認証完了後に postUserMessage
  - 認証キャンセル時はオプティミスティック追加分を削除
- `bindingStatus === 'bound'` のとき、ensureSession は **ユーザー Environment** を使う
  (= `createUserSession` の `environmentId` 引数を bootstrap → ユーザー Env に切替)
- Header 設定アイコンから明示的にダイアログを開けるようにする (既存認証情報の更新用)

### AC-8: chatStore への追加
- `vaultId: string | null`
- `environmentId: string | null` (現在の Session が利用する Env。bootstrap か user か)
- `bindingStatus: BindingStatus`
- `setVaultId` / `setEnvironmentId` / `setBindingStatus`

### AC-9: 既存 Session の取り扱い
- 履歴画面で表示される Session は **bootstrap 環境のものも含む** (metadata は同じ
  `source/userCode/domain` で紐付くため)
- bootstrap Session を選択した場合も復元可能 (= 過去の会話を読むだけなら environmentId
  が違っても問題ない。ただし新規発言を送ると新しい Environment で**新 Session**が作成
  される)
- Session オブジェクトの `environment_id` は固定なので、bootstrap Session に postUserMessage
  しても旧 Environment で実行される。これは仕様上許容 (=「過去会話の続きを bootstrap Env
  で続ける」となる)
- → 簡略化のため: 履歴から復元したときは `selectSession` で sessionId だけ切替え、現在の
  `environmentId` (= ユーザー Env) は保ったまま、新規送信は新 Session で行う方針に統一する
  - つまり「履歴から続きを送る」はできない (現状の Phase 1a と同じ)。発言したら新 Session
  - これは Phase 1c で再検討

### AC-10: 既存仕様の維持
- 単体テスト 190 件 + Session 再設計 + helper 60 件はすべて緑のまま
- 既存 E2E (16 件) を破壊しない
- パネル開閉 / Welcome / 履歴 / 新規会話 / IME ガードの挙動は変えない

## 非機能要件

- NFR-1: Vault と Environment の解決はそれぞれ in-flight 保護で 1 リクエストに集約
- NFR-2: 連続して `bind` が呼ばれても 1 つの Vault / Environment しか作成されない
- NFR-3: ヘルパーライブラリの URL は `core/constants.ts` で 1 箇所集約
- NFR-4: Vault に書き込んだパスワードは UI に echo しない (再表示は禁止)
- NFR-5: CredentialDialog の入力中、ESC キーや背景クリックで閉じても安全 (state リセット)
- NFR-6: ユーザー Environment 作成は `ensureEnvironment` の名前空間で行うが、Phase 1a の
  `resolveBootstrapEnvironment` は触らない (削除しない)

## 想定するユーザーストーリー

> 初めて Cowork Agent を使うユーザーが「最初のメッセージ」を送ると、kintone 認証情報の
> 入力を促されるモーダルが出る。kintone のドメイン (自動入力済) と ID/PW を入れて登録
> すると、しばらくロードして「準備完了」となり、メッセージが送信される。次回以降は
> 入力不要 (Vault に保存済)。kintone REST API を Agent が間接利用できるようになる
> (本 Phase ではまだ system prompt を更新しないので、Agent は実際には叩かない —
> Phase 1b-3 で system prompt + カード UI を入れる)。

## スコープ外

- Plan / Tool / Progress / Result カード UI (Phase 1b-3)
- Agent system prompt の kintone 操作ガイドライン (Phase 1b-3)
- ヘルパーライブラリのバージョン不一致検出による Environment 再作成 (Phase 1c の
  `ensureEnvironment` 拡張で対応予定)
- Vault のローテーション / 削除 UI
- 複数 kintone 環境の切替 (1 ユーザー = 1 Vault/Env)
- API トークン認証 (helper も Basic 認証のみ)
- Custom Tool の自前実装 (helper 経由の bash 実行で代替する方針)

## 影響範囲

### 新規
- `packages/plugin/src/core/bootstrap/resolveVault.ts` + test
- `packages/plugin/src/core/bootstrap/ensureEnvironment.ts` + test
- `packages/plugin/src/desktop/components/CredentialDialog.tsx` + test
- `packages/plugin/src/desktop/hooks/useUserBinding.ts` + test
- `packages/plugin/src/core/managed-agents/resources.ts` に Vault 系 API 追加 (`listVaults` / `createVault` / `setVaultKeys` / etc.)

### 修正
- `packages/plugin/src/core/managed-agents/types.ts` — Vault / Environment / Session の型補完
- `packages/plugin/src/core/bootstrap/resolveSession.ts` — `createUserSession` が `vaultId` を受け取る
- `packages/plugin/src/desktop/hooks/useSession.ts` — ensureSession が environmentId / vaultId を解決済の値で渡す
- `packages/plugin/src/desktop/ChatPanel.tsx` — `useUserBinding` 統合 + 未バインディング時のダイアログ表示
- `packages/plugin/src/desktop/components/Header.tsx` — 設定アイコンから CredentialDialog を開く
- `packages/plugin/src/store/chatStore.ts` — vaultId / environmentId / bindingStatus 追加
- `packages/plugin/src/core/constants.ts` — `HELPER_WHEEL_URL`, `HELPER_VERSION` 定数

### E2E
- 既存テストはなるべく無修正で通す (CredentialDialog の出現条件を満たす実環境では
  既存テストはそのまま通る前提。ただし fresh state では未バインディング扱いになる)
- 新規 `packages/plugin/e2e/credential-binding.spec.ts` — 初回送信で Dialog が出る /
  入力 → 登録 → 送信が完了する / 設定アイコンから再オープン可能

## 依存・前提

- Anthropic Managed Agents Beta API の Vault エンドポイントが利用可能であること
  (skill ドキュメントで確認済)
- ユーザー Environment は **cloud type**。alpha 段階では package install 時間が長い
  (1〜2 分) ことが許容される (UI 上スピナーで通知)

## 完了条件

- AC-1〜10 + NFR-1〜6 が満たされる
- 単体テスト・既存 E2E すべて緑
- 新規 E2E (credential-binding) 緑
- 動作確認: 初回送信 → Dialog → 入力 → 登録 → 送信完了 まで E2E + 手動で確認
