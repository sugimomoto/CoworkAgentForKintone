# Customizer Wedge 実用化 — Requirements (draft)

> **対象 Issue**: [#20](https://github.com/sugimomoto/CoworkAgentForKintone/issues/20)
> **Milestone**: V2 - 拡張フェーズ
> **親**: [#44 V2 umbrella](https://github.com/sugimomoto/CoworkAgentForKintone/issues/44)
> **位置づけ**: V1 で MVP / モック実装した Customizer wedge ループを **本実装**に置換し、admin が実際に kintone アプリのカスタマイズを Agent と協働で完成 → 本番反映 → ロールバックできる状態にする。

---

## 1. 現状の正確な棚卸し

### 1.1 V1 で実装済 (動くもの)

| コンポーネント | 状態 |
|---|---|
| `useApplyWorkflow` (state machine) | ✅ 動く — 5 状態 (`ready` / `previewed` / `applying` / `applied` / `rolled-back`) の遷移ロジックは完成、失敗時の state 戻しもテスト済 |
| `WorkflowFooter` UI | ✅ 動く — 5 状態 × ボタン状態の表示はテスト済 |
| `chatStore.workflowHistory` | ✅ 動く — in-memory な artifactId → snapshot Map |
| `useCurrentAgentPurpose` | ✅ 動く — Customizer Agent 選択時のみ wedge UI を出す判定 |
| Customizer Agent system prompt | ✅ 動く — desktop.js 1 本前提の指示文、`create_artifact(kind:'code', language:'javascript')` を案内 |
| `kintone-customize-js` skill | ✅ 動く — JS カスタマイズの定石集として Agent が参照 |

### 1.2 V1 でモック (動かないもの)

| コンポーネント | モック内容 | コード位置 |
|---|---|---|
| `FileTree` | **hardcoded**。`customize/desktop.js` (active) / `mobile.js` / `desktop.css` / `manifest.json` / `README.md` の 6 行が固定。クリック `onSelect` は `V1 は no-op` と明記 | [packages/plugin/src/chat/workflow/FileTree.tsx](../../packages/plugin/src/chat/workflow/FileTree.tsx) L6-7, L42-86, L106 |
| `kintoneCustomizeApi.apply` の `buildCustomizeUpdate` | **既存 customize.json をそのまま返す**。新 JS は無視され、deploy は実質「現状維持での deploy」になる = 本番 customize は変わらない | [packages/plugin/src/chat/workflow/kintoneCustomizeApi.ts](../../packages/plugin/src/chat/workflow/kintoneCustomizeApi.ts) L155-166 |
| `kintoneCustomizeApi.preview` の sandbox | **default は no-op**。呼出側が `runSandbox` を注入していない限り何も実行しない | 同上 L78-86 |
| `workflowHistory` の snapshot | **in-memory only** — Plugin リロードで失われ rollback 不能 | [packages/plugin/src/store/chatStore.ts](../../packages/plugin/src/store/chatStore.ts) workflowHistory |

### 1.3 V1 で意図的に未対応 (V2 で本対応)

- Customizer Agent が生成するファイルは **desktop.js 1 本のみ**。CSS / mobile.js / 既存 URL+FILE リンクの編集は対象外
- 「カスタマイズ JS を直接 customize.json に書き込む」MCP ツール (`kintone-update-customize-js`) は V3 #24 待ち、V1 では Plugin 側で REST API を叩く想定だが実装が no-op

---

## 2. V2 で達成すべきゴール (definition of done)

> 「admin が **既存 kintone アプリ** に対して、Customizer Agent と会話しながら **複数ファイル (JS + CSS + mobile.js) を編集** → **プレビュー** → **本番反映** → 不具合あれば **ロールバック** までを Plugin だけで完結できる」

### 2.1 機能要件 (must)

- [ ] **FileTree が実 customize 構成を反映** — `GET /k/v1/preview/app/customize.json` を叩き、対象アプリの desktop.js[] / desktop.css[] / mobile.js[] / 各 URL+FILE エントリを列挙
- [ ] **ファイル間ナビゲーション** — FileTree のファイルをクリックで artifact ペインの表示内容が切替
- [ ] **multi-file 編集** — Customizer Agent が複数ファイル (例: `desktop.js` + `desktop.css`) を 1 turn でまとめて生成・更新できる
- [ ] **apply の実 deploy** — 編集された全 file を kintone にアップロードし、customize.json を PUT、deploy.json を POST して本番反映
- [ ] **preview sandbox の実装** — artifact JS を iframe sandbox 内で実行し、admin が動作を試運転できる (host kintone には触れない)
- [ ] **rollback の信頼性向上** — V1 in-memory snapshot を **kintone DB に永続化** (or iframe localStorage 等)、Plugin リロード後も rollback 可能
- [ ] **権限不足時 (admin でない)** — UI で機能を隠す or 適切なエラー表示

### 2.2 機能要件 (should)

- [ ] **未保存変更マーカー** — FileTree の各ファイルに変更ステータス (modified / new / unchanged) を実状態から計算
- [ ] **scope 制御** — `customize.json.scope` (`ALL` / `ADMIN` / `NONE`) の表示と編集
- [ ] **既存 URL タイプエントリの保全** — 外部 CDN リンクや admin が以前手動で登録した JS/CSS は触らずに保持

### 2.3 機能要件 (out of scope, 次フェーズ)

- 外部 CDN URL の新規追加 / 編集 (V2 は FILE タイプのみ admin が編集可)
- libs/ フォルダの third-party JS 管理 (npm install 的な機能)
- カスタマイズの A/B テスト機能
- Customizer Agent からの diff 表示 (旧→新の比較 UI)

---

## 3. 主要設計論点 (要決定)

> 各論点について Plugin・Agent・Worker の役割分担と実装方針を design.md で詰める。**ここでは選択肢と暫定案だけ列挙**。

### 3.1 ファイル保管方式

**論点**: kintone customize.json は `URL` / `FILE` タイプしか受け付けない (inline 文字列 NG)。artifact (Agent が生成した文字列) を kintone customize に登録するには、どこかにアップロードする必要がある。

| 案 | 内容 | Pros | Cons |
|---|---|---|---|
| A. **kintone FILE upload** | `POST /k/v1/file.json` で fileKey 取得 → customize.json の FILE エントリに登録 | kintone 完結、CDN 不要、認証不要 | 古い fileKey の cleanup 運用 (#20 既存 spec で言及) |
| B. **Worker でホスト (URL タイプ)** | Worker が artifact content を static host、customize.json の URL エントリに登録 | バージョン管理が楽 (URL 変えれば revert) | Worker に静的ホスト機能を足す必要 / CSP / 認証 |
| C. **kintone Files API (blob upload)** | `kintone.api(/k/v1/file)` で multipart upload、fileKey 取得 | A と同じ | A と同等、A の方がシンプル |

**暫定案**: **A (kintone FILE upload)**。kintone 完結で外部依存なし。古い fileKey は apply 後の cleanup ステップで削除 (#20 既存仕様)。

### 3.2 multi-file artifact データモデル

**論点**: Customizer Agent が「desktop.js と desktop.css の両方を更新したい」と言ったとき、どう create_artifact するか。

| 案 | 内容 |
|---|---|
| A. **1 artifact = 1 ファイル**、Agent が複数 artifact を 1 turn で生成 | シンプル、既存 artifact 仕組みをそのまま |
| B. **1 artifact = 多ファイル束 (bundle artifact)**、新 kind `kintone-customize-bundle` を導入 | 1 ターン = 1 変更単位として綺麗、apply / rollback の粒度が明確 |
| C. **既存 desktop.js 単一 artifact + FileTree で対象 file を選んで artifact 上書き** | 既存 UI に近い |

**暫定案**: **A (1 artifact = 1 ファイル)**。Agent prompt を「変更が必要なファイル各々を create_artifact で個別生成」と指示。FileTree が複数 artifact をまとめて選択して 1 つの apply 操作にまとめる。

### 3.3 apply の atomic 性

**論点**: multi-file apply で 1 ファイルだけ失敗した場合、どうするか。

- **kintone deploy.json は app 単位で atomic** (deploy 失敗で全 file が反映前に戻る)
- 個別 file の upload (file.json) は単独失敗もあり得る → upload を全部成功させてから customize.json PUT + deploy

**暫定案**: 「全 file の upload を先に試行し、1 つでも失敗したら全 fileKey を delete してエラー表示」。customize.json PUT と deploy は最後に 1 回だけ。

### 3.4 preview sandbox の実装

**論点**: 「プレビュー」ボタンで artifact JS を iframe で実行する際、kintone API はどう扱う?

| 案 | 内容 |
|---|---|
| A. **完全 mock** — sandbox 内で `kintone.api` / `kintone.events` を no-op or 簡易 mock | 安全、コード実行が単独で完結 |
| B. **postMessage 経由で host kintone API を proxy** | リアルな挙動が見える | sandbox の意義が薄れる、複雑 |
| C. **iframe を kintone host 内に貼る (= プレビューモードのレコード一覧画面で実行)** | リアル体験 | sandbox 隔離が崩れる |

**暫定案**: **A (完全 mock)** + 後で「実環境プレビュー」を別ボタンで提供 (= 既に #20 spec に「`https://<subdomain>.cybozu.com/k/admin/preview/<appId>/` を新タブで開く」案がある)

### 3.5 rollback snapshot の永続化

**論点**: V1 は in-memory なので Plugin リロードで失われる。V2 で永続化すべきだが、kintone DB を使うか、Plugin Config か、他の場所か。

| 案 | 内容 |
|---|---|
| A. **kintone 自身の revert 機能を使う** — `POST /k/v1/preview/app/deploy.json {revert: true}` で deploy 前に戻す。snapshot 不要 | kintone 公式機能、最も信頼できる |
| B. **kintone レコード保存** — 専用アプリ or 既存アプリのレコードに snapshot を JSON で保存 | 永続化、kintone 内完結 |
| C. **iframe localStorage / Anthropic Memory Store** | 簡易だが消える可能性あり |

**暫定案**: **A**。`revert: true` の deploy で apply 前の状態に戻せる ([#20 既存 spec で確認済](../../packages/plugin/src/chat/workflow/kintoneCustomizeApi.ts))。snapshot を取らずに済む。

### 3.6 Customizer Agent prompt の拡張

**論点**: Agent が multi-file 生成できるよう system prompt と skill を拡張する。

- `CUSTOMIZER_WORKFLOW_PROMPT` ([builtInAgents.ts](../../packages/plugin/src/core/bootstrap/builtInAgents.ts) L185-222) を multi-file 対応に
- `kintone-customize-js` skill に「desktop.js / mobile.js / desktop.css の関係性」を追記
- 「特定 file を更新したいときは create_artifact の id を `customize:desktop.js` のように file path にして 1 ファイル 1 artifact」と指示

---

## 4. 影響範囲 (実装ファイル)

### 4.1 修正

- `packages/plugin/src/chat/workflow/FileTree.tsx` — hardcoded を撤廃、props で files を受ける
- `packages/plugin/src/chat/workflow/kintoneCustomizeApi.ts` — `buildCustomizeUpdate` 実装 + file.json upload + revert 対応
- `packages/plugin/src/chat/workflow/useApplyWorkflow.ts` — rollback を kintone revert API 経由に変更 (snapshot 撤廃)
- `packages/plugin/src/desktop/components/ArtifactPane/index.tsx` — FileTree state 管理 / active file 切替
- `packages/plugin/src/core/bootstrap/builtInAgents.ts` — `CUSTOMIZER_WORKFLOW_PROMPT` を multi-file 対応
- `packages/plugin/src/skills/kintone-customize-js/SKILL.md` — multi-file 編集の指示追記

### 4.2 新規

- `packages/plugin/src/chat/workflow/useCustomizeFiles.ts` — `GET customize.json` を fetch して FileTree 用 entry に整形する hook
- `packages/plugin/src/chat/workflow/previewSandbox.tsx` — iframe sandbox component
- (任意) `packages/plugin/src/chat/workflow/CustomizeFileUploader.ts` — file.json upload ヘルパー

### 4.3 OAuth scope

- 既存: `k:app_record:*` / `k:app_settings:read` / `k:file:read`
- 追加: **`k:app_settings:write`**, **`k:file:write`** (#20 既存 spec の Step 1 で言及済)

---

## 5. リスク

| Risk | 影響 | 対策 |
|---|---|---|
| R1 | OAuth scope 追加で **既存ユーザの再連携必要** | ConfigScreen の Header に「再連携」誘導ボタン (V1 で既に [Cowork Agent for kintone Plugin Config](../../packages/plugin/src/desktop/Header.tsx) に実装済 #28) |
| R2 | apply で fileKey upload は成功したが customize.json PUT で失敗した場合の **孤児 fileKey** | apply 失敗時の cleanup ステップ。upload した fileKey を memory に保持して revert 時 delete |
| R3 | preview sandbox で artifact JS が **無限ループ / window.* を破壊** | sandbox iframe に CSP / timeout / `sandbox` 属性で隔離 |
| R4 | 複数 admin が同時にプレビュー編集する **競合** (kintone API で「他 admin がプレビュー編集中」エラー) | エラー時に admin 名を表示して退避するよう案内 (#20 既存 spec で言及) |
| R5 | Customizer Agent が **誤った file path** で artifact を生成 (例: `customize:desktop.css.js`) | prompt で file path の規約を厳密に / Plugin 側で validate |

---

## 6. 未決事項 (ユーザー確認待ち)

- [ ] **論点 3.1 — ファイル保管方式**: kintone FILE upload (案 A) で進めて良いか
- [ ] **論点 3.2 — multi-file artifact**: 1 artifact = 1 ファイル (案 A) で進めて良いか
- [ ] **論点 3.4 — preview sandbox**: 完全 mock (案 A) で進めて良いか、それとも実環境プレビュー (kintone admin preview URL を別タブで開く) を主軸にするか
- [ ] **論点 3.5 — rollback**: kintone revert API (案 A) を使うことで snapshot を完全撤廃して良いか
- [ ] **MVP の段階分割**: 全機能を一度にやらず、まず desktop.js のみで実 deploy → 後で multi-file 拡張、という段階的リリースは可能か?
- [ ] **OAuth 再連携 UX**: 既存ユーザに対する追加 scope 取得タイミング (Customizer Agent 初回利用時に prompt? それとも初回 Plugin install 時から)

---

## 7. 次のステップ

1. **本 requirements.md のユーザーレビュー** — 特に Section 6 の未決事項を確定
2. 確定後 → `design.md` で実装アーキテクチャ詳細 (データフロー / コンポーネント分割 / テスト戦略)
3. design.md 確定後 → `tasklist.md` で Phase 分割
4. 着手
