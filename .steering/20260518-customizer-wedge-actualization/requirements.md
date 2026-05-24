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

## 2.5 実機 REST API 検証結果 (2026-05-24)

設計判断の前提を固めるため、`scripts/verify-customize-rest-api.mjs` でテスト用アプリ (`KINTONE_TEST_APP_ID=5`) に対し実機検証を実施。確定事項:

### 2.5.1 認証
- kintone REST API のパスワード認証は **`X-Cybozu-Authorization: Basic <base64(user:pass)>`** ヘッダ (kintone 独自、`Authorization` ではない)。OAuth でも本機能を呼ぶ場合 `Authorization: Bearer ...` でよい

### 2.5.2 customize.json の構造 (実レスポンス)
```json
{
  "scope": "ALL" | "ADMIN" | "NONE",
  "desktop": { "js": [...], "css": [...] },
  "mobile":  { "js": [...], "css": [...] },   // mobile にも css がある
  "revision": "183"                            // 楽観ロック用
}
```
各 entry: `{ "type": "URL" | "FILE", "url"?: string, "file"?: { "fileKey", "name", "contentType", "size" } }`

### 2.5.3 file.json upload
- `POST /k/v1/file.json` (multipart, field 名 `file`) → `{ "fileKey": "<UUID-36>" }`
- UUID 形式: `6b0d0a0f-6aad-43ff-a0d6-5b4f4e2e0cab` (8-4-4-4-12 hex)

### 2.5.4 **fileKey の 2 種類 (重要)**
- **upload 直後の UUID 形式** (`6b0d0a0f-...`, 36 chars) — `file.json` レスポンスで取得、`customize.json` PUT 時にこれを渡す
- **kintone 内部 ID 形式** (`20260524004722FF081EA2DAED41078C20674226A20993017`, 49 chars hex) — `customize.json` を GET したときに返ってくる。**preview と live で別 ID** (= 同じ JS でも kintone 側で別管理)
- → **PUT/deploy 後の cleanup を fileKey で filter するのは難** (name 一致 or 配列インデックスベースで識別する必要)

### 2.5.5 PUT customize.json
- **全置換** (差分更新ではない)、新しい全体を渡す
- `revision` を渡せば楽観ロック (一致しないと 409、`"-1"` で skip)
- 成功時 `revision` が +1

### 2.5.6 deploy.json
- `POST /k/v1/preview/app/deploy.json {apps:[{app, revision?}], revert?}` → 即 `{}` を返す (非同期)
- 進捗は `GET /k/v1/preview/app/deploy.json?apps[0]=<id>` でポーリング
- 状態: `PROCESSING` → `SUCCESS` / `FAIL` / `CANCEL`
- 検証アプリ (空 customize) では 2 秒で SUCCESS

### 2.5.7 **`revert: true` の正確な挙動 (重要 / 既存 #20 spec 誤解の訂正)**
- 公式仕様: 「**preview のアプリの設定を本番環境の設定と同じにする**」 = **preview の編集を破棄して live と同期**
- **「直前 deploy を取消す」ではない**
- 実機確認: deploy 完了後に `revert: true` を呼んでも live は変わらない (live にカスタマイズが残ったまま)
- → **deploy 後の rollback は revert では不可能**。**snapshot を保持して旧 customize を再 PUT + deploy する必要あり**

### 2.5.8 fileKey の cleanup
- file.json upload した fileKey は **削除 API なし** (孤児として残る、容量のみ消費)
- customize.json に登録された fileKey は次の PUT で参照を外せば不要 (内部 ID は GC されるかもしれないが保証なし)

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

**論点**: V1 は in-memory なので Plugin リロードで失われる。**§2.5.7 で確定した通り `revert: true` は deploy 後の rollback には使えない** ため、必ず snapshot が必要。永続化先の選択。

| 案 | 内容 | Pros | Cons |
|---|---|---|---|
| ~~A. revert で snapshot 撤廃~~ | **不可** (§2.5.7) | - | - |
| B. **kintone レコード保存** — 専用アプリ or 既存アプリのレコードに snapshot を JSON で保存 | 永続化、kintone 内完結、他 admin も復元可能 | 専用アプリのスキーマ管理が要る |
| C. **Plugin Config (setConfig) に保存** — `kintone.plugin.app.setConfig` で snapshot JSON を保存 | kintone DB に永続化、Plugin に閉じる | setConfig は **設定画面でしか動かない** (V1 同期問題と同根) — apply 時 (record-list 画面) には呼べないため不適 |
| D. **localStorage** — ブラウザに保存 | 実装最小 | ブラウザ依存、他端末からは復元不可、ストレージサイズ制限 |
| E. **Anthropic Memory Store** — Agent の memory に保存 | session 横断で永続、Plugin 自身で管理不要 | Agent 経由のアクセスが必要 (admin 操作と非対称) |
| F. **Worker KV (or D1)** — Worker に保存して REST 経由で読み書き | 永続、admin 端末非依存 | Worker 側に新エンドポイント、認証経路、データ保管責任 |

**暫定案**: **B (kintone レコード保存)** — admin 自身が管理する kintone データ空間内に閉じるのが運用的に最も clean (Plugin が消えても admin が手動でアクセス可能、データ漏洩リスクが低い)。専用アプリは Plugin 初回 install 時に admin に作成案内 or auto-provision。

**B のスキーマ案** (専用アプリ `cowork-agent-customize-history`):
| フィールド | 型 | 内容 |
|---|---|---|
| `appId` | SINGLE_LINE_TEXT | 対象アプリ ID |
| `appliedAt` | DATETIME | apply 実施時刻 |
| `actor` | USER_SELECT | apply した admin |
| `snapshot` | MULTI_LINE_TEXT | apply 直前の customize.json (JSON 文字列) |
| `appliedJsContent` | MULTI_LINE_TEXT | apply した artifact 内容 (= rollback 対象を識別する用) |
| `status` | DROP_DOWN | `applied` / `rolled-back` |

### 3.6 Customizer Agent prompt の拡張

**論点**: Agent が multi-file 生成できるよう system prompt と skill を拡張する。

- `CUSTOMIZER_WORKFLOW_PROMPT` ([builtInAgents.ts](../../packages/plugin/src/core/bootstrap/builtInAgents.ts) L185-222) を multi-file 対応に
- `kintone-customize-js` skill に「desktop.js / mobile.js / desktop.css の関係性」を追記
- 「特定 file を更新したいときは create_artifact の id を `customize:desktop.js` のように file path にして 1 ファイル 1 artifact」と指示

---

## 4. 影響範囲 (実装ファイル)

### 4.1 修正

- `packages/plugin/src/chat/workflow/FileTree.tsx` — hardcoded を撤廃、props で files を受ける
- `packages/plugin/src/chat/workflow/kintoneCustomizeApi.ts` — `buildCustomizeUpdate` 実装 + file.json upload + 旧 customize の snapshot 保存
- `packages/plugin/src/chat/workflow/useApplyWorkflow.ts` — rollback を **snapshot レコードから再 PUT+deploy** で実装 (§3.5 案 B、`revert: true` は使わない)
- `packages/plugin/src/desktop/components/ArtifactPane/index.tsx` — FileTree state 管理 / active file 切替
- `packages/plugin/src/core/bootstrap/builtInAgents.ts` — `CUSTOMIZER_WORKFLOW_PROMPT` を multi-file 対応
- `packages/plugin/src/skills/kintone-customize-js/SKILL.md` — multi-file 編集の指示追記

### 4.2 新規

- `packages/plugin/src/chat/workflow/useCustomizeFiles.ts` — `GET customize.json` を fetch して FileTree 用 entry に整形する hook
- `packages/plugin/src/chat/workflow/previewSandbox.tsx` — iframe sandbox component
- `packages/plugin/src/chat/workflow/customizeHistoryRepo.ts` — snapshot を kintone レコード (専用アプリ) に保存/取得する repo
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

実機検証 (§2.5) で確定した事項は除外。残る未決:

- [x] **論点 3.1 — ファイル保管方式**: kintone FILE upload (案 A) → ✅ 検証で動作確認、確定
- [ ] **論点 3.2 — multi-file artifact**: 1 artifact = 1 ファイル (案 A) で進めて良いか (B/C も検討余地あり)
- [ ] **論点 3.4 — preview sandbox**: 完全 mock (案 A) で進めるか、実環境プレビュー (`/k/admin/preview/<appId>/` を別タブ) を主軸にするか
- [x] **論点 3.5 — rollback**: ~~revert API で snapshot 撤廃 (案 A)~~ → ✅ §2.5.7 で **不可** 確定。**案 B (kintone 専用アプリレコードに snapshot 保存)** で進めるか確認
- [ ] **専用アプリの provision**: §3.5 案 B の snapshot 保存先アプリ `cowork-agent-customize-history` を Plugin 初回 install 時に自動作成 (REST API で創設) するか、admin に手動作成案内するか
- [ ] **MVP の段階分割**: 全機能を一度にやらず、まず desktop.js のみで実 deploy → 後で multi-file 拡張、という段階的リリースは可能か?
- [ ] **OAuth 再連携 UX**: 既存ユーザに対する追加 scope 取得タイミング (Customizer Agent 初回利用時に prompt? それとも Plugin install 時から)
- [ ] **「適用前に動作テスト環境画面で実機確認」UX**: §3.4 案 A (sandbox mock) を採用したとしても、admin が実 kintone で動作確認したいケースに対応するか (= `/k/admin/preview/<appId>/` を別タブで開くボタンの位置づけ)

---

## 7. 次のステップ

1. **本 requirements.md のユーザーレビュー** — 特に Section 6 の未決事項を確定
2. 確定後 → `design.md` で実装アーキテクチャ詳細 (データフロー / コンポーネント分割 / テスト戦略)
3. design.md 確定後 → `tasklist.md` で Phase 分割
4. 着手
