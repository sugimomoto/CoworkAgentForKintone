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

**前提**: FileTree が存在する = 「1 編集セッション = 多ファイル」を扱うのが本来の設計意図。1 artifact = 1 ファイルだと FileTree が複数 artifact を統合する責任を持つことになり、active file 切替時に「どの artifact を表示しているか」「全体として 1 つの編集セッションなのか」が曖昧になる。

| 案 | 内容 |
|---|---|
| A. ~~1 artifact = 1 ファイル~~ | FileTree との対応関係が不安定、却下 |
| **B. 1 artifact = 多ファイル束 (bundle artifact)** ⭐ | 1 turn = 1 編集セッション = 1 bundle artifact。内部に複数 file を持ち、apply / rollback が atomic |
| C. 既存 desktop.js 単一 artifact + FileTree で上書き | Agent が複数 file 同時更新を表現できない、却下 |

**確定案: B (bundle artifact)**。

**新 artifact 種別 `kintone-customize-bundle`**:
```ts
type CustomizeBundleArtifact = {
  kind: 'kintone-customize-bundle';
  id: string;                     // artifact id (例: 'customize-deal-color-v1')
  title: string;                  // 'カスタマイズ案件 v1' などの表示用タイトル
  content: {
    files: Array<{
      path: 'desktop.js' | 'mobile.js' | 'desktop.css' | 'mobile.css';
      content: string;            // 各ファイルの本文
    }>;
  };
  // 既存 Artifact 共通: createdAt, updatedAt, version, ...
};
```

**ArtifactPane の Customizer モード**:
- 上記 bundle artifact を 1 つ受け取り、FileTree は `bundle.content.files` を表示
- 内部 state で `activeFilePath` を管理 (どの file の content を表示するか)
- Agent が「desktop.js を更新して」と言うと、**同じ bundle artifact id を更新** (= files 配列の該当 path の content を差し替え、ArtifactVersion +1)
- 「新しい customize を作る」場合は別 id の bundle を生成

**apply 動作**:
- bundle.content.files を順次 `POST /k/v1/file.json` で upload → 各 fileKey 取得
- bundle 内に存在しない既存 customize.json エントリ (URL タイプ / 別 FILE) は **そのまま保持**
- bundle 内のファイルパスに対応する既存エントリは置換 (= 同じ path で再 upload)
- 最後に `PUT customize.json` で全 entry をまとめて反映、`POST deploy.json`

**Agent prompt 拡張**:
- system prompt に「kintone カスタマイズは `kind: 'kintone-customize-bundle'` で **1 つの bundle に複数 file をまとめる**」と明記
- 「同じ customize を更新する場合は同じ artifact id で create_artifact (新規版になる)」
- 「path は `desktop.js` / `mobile.js` / `desktop.css` / `mobile.css` のいずれか」

### 3.3 apply の atomic 性

**論点**: multi-file apply で 1 ファイルだけ失敗した場合、どうするか。

- **kintone deploy.json は app 単位で atomic** (deploy 失敗で全 file が反映前に戻る)
- 個別 file の upload (file.json) は単独失敗もあり得る → upload を全部成功させてから customize.json PUT + deploy

**暫定案**: 「全 file の upload を先に試行し、1 つでも失敗したら全 fileKey を delete してエラー表示」。customize.json PUT と deploy は最後に 1 回だけ。

### 3.4 preview sandbox の実装

**論点**: 「プレビュー」ボタンで生成された JS をどうやって live に影響させずに動作確認できるようにするか。

**実機検証 (2026-05-24) で確定**: kintone 公式の **動作テスト環境** (`/k/admin/preview/<appId>/`) が既に preview-only deploy 機能と組み合わさって "サンドボックス" として機能している。

| 案 | 内容 | 評価 |
|---|---|---|
| A. **iframe + mock** — sandbox 内で `kintone.api` / `kintone.events` を no-op or 簡易 mock | 安全、コード実行が単独で完結。**ただし kintone API が呼べない = mock では限界**。fetch / DOM 操作だけのカスタマイズなら確認できるが、`kintone.api()` を呼ぶ JS は事実上テスト不能 |
| B. **postMessage 経由で host kintone API を proxy** | リアルな挙動が見える | sandbox の意義が薄れる、実装複雑 |
| **C. kintone 動作テスト環境 URL を新タブで開く** ⭐ | `PUT customize.json (preview)` だけ実行 → `/k/admin/preview/<appId>/` を新タブで開く。admin がそこで実 kintone で動作確認 → OK なら「適用」ボタンで deploy / NG なら「キャンセル」で revert | **kintone 公式機能、フル機能の実機確認可、iframe sandbox の実装不要** |

**確定案**: **C (kintone 動作テスト環境 URL)**。

- `useApplyWorkflow` の `previewed` 状態に遷移したら `PUT customize.json (preview)` を実行 + 動作テスト環境 URL のリンク or 自動 open
- WorkflowFooter の「プレビュー」ボタンは `PUT preview` だけ実行、admin はリンクから動作テスト環境に飛んで実機確認
- iframe sandbox / mock は**実装しない** (V1 で no-op だった preview sandbox は完全に廃止)

**フロー (新)**:
```
[編集] → artifact 生成
   ↓
[プレビュー] → file.json upload + PUT customize.json (preview のみ)
            → 「動作テスト環境を開く」ボタン or 自動オープン
            → admin が /k/admin/preview/<appId>/ で実機確認
   ↓
[適用] → POST deploy.json (live 反映)
   or
[キャンセル] → POST deploy.json {revert: true} (preview を live と同期、編集破棄)
```

### 3.5 rollback snapshot の永続化

**論点**: V1 は in-memory なので Plugin リロードで失われる。**§2.5.7 で確定した通り `revert: true` は deploy 後の rollback には使えない** ため、必ず snapshot が必要。

**確定方針: 2 段階リリース**

| Phase | 条件 | snapshot 保存先 | rollback の範囲 |
|---|---|---|---|
| **Phase 1 (B' 単独、本 requirements の対象)** | GitHub 連携の有無に関わらず | **chatStore (in-memory)** — V1 の `workflowHistory` Map を継承 | **同じ Plugin セッション内のみ** (Plugin リロードで snapshot が失われ rollback 不能) |
| **Phase 2 (#17 GitHub 連携と統合)** | GitHub 連携済 | **git repo にコミット** (`customize/<appId>/desktop.js` 等の file + `customize.json` を新 commit で push) | **永続** (git commit log から任意の過去版を選んで PUT + deploy で復元) |

**Phase 1 で in-memory に留める根拠:**
- 別途 kintone 専用アプリを provision するのは、admin の信頼を損なう (Plugin が勝手にアプリを増やす)、スキーマ管理コスト、その他選択肢 (Plugin Config setConfig / localStorage / Worker KV) はそれぞれ別の制約があり、**いずれも次フェーズ #17 GitHub 連携完了で解決する** ため Phase 1 で複雑な永続化に投資しない判断
- 実用上 admin の典型ユースケースは「適用 → 即動作確認 → ダメなら即ロールバック」なので、**同じセッション内に閉じる rollback で十分**
- Phase 2 で GitHub 連携が入ったタイミングで「永続的なロールバック履歴管理は GitHub repo で」と自然に誘導

**Phase 1 admin への説明文 (UI 上で表示する想定):**
> 「適用後にロールバックしたい場合、**同じセッション** (= Plugin を閉じる前) なら戻せます。Plugin をリロードするとロールバック履歴が失われるため、ロールバックが必要な可能性があれば作業中に実行してください。永続的なロールバック履歴管理は今後の GitHub 連携 (#17) で提供予定です」

**実装方針 (Phase 1):**
- 既存 V1 の `chatStore.workflowHistory` (artifactId → snapshot Map) をそのまま継承
- `kintoneCustomizeApi.apply()` 内で apply 直前に `GET /k/v1/preview/app/customize.json` を呼び snapshot を Map に保存
- `kintoneCustomizeApi.rollback()` で snapshot を取り出し `PUT customize.json` + `POST deploy.json` で復元
- `revert: true` は **使わない** (deploy 後の rollback には機能しないため)

### 3.6 Customizer Agent prompt の拡張

**論点**: Agent が multi-file 生成できるよう system prompt と skill を拡張する。

- `CUSTOMIZER_WORKFLOW_PROMPT` ([builtInAgents.ts](../../packages/plugin/src/core/bootstrap/builtInAgents.ts) L185-222) を multi-file 対応に
- `kintone-customize-js` skill に「desktop.js / mobile.js / desktop.css の関係性」を追記
- 「特定 file を更新したいときは create_artifact の id を `customize:desktop.js` のように file path にして 1 ファイル 1 artifact」と指示

---

## 4. 影響範囲 (実装ファイル)

### 4.1 修正

- `packages/plugin/src/core/artifacts/types.ts` — 新 kind `kintone-customize-bundle` を ArtifactKind 列挙に追加、bundle content の型 (`{files: [{path, content}]}`) を定義
- `packages/plugin/src/chat/workflow/FileTree.tsx` — hardcoded を撤廃、`bundle.content.files` から動的構築 + activeFilePath ハイライト
- `packages/plugin/src/chat/workflow/kintoneCustomizeApi.ts` — `buildCustomizeUpdate` を bundle ベースで実装 (bundle.files を upload + customize.json PUT、既存 entry は path 一致で置換 / それ以外は保持) + apply 直前に旧 customize を chatStore.workflowHistory (in-memory) に snapshot 保存
- `packages/plugin/src/chat/workflow/useApplyWorkflow.ts` — rollback を **chatStore.workflowHistory の snapshot から再 PUT+deploy** で実装 (§3.5 Phase 1、`revert: true` は使わない、永続化は Phase 2 で対応)
- `packages/plugin/src/desktop/components/ArtifactPane/index.tsx` — kind=bundle の Customizer モード分岐、activeFilePath state、選択 file の content を内部エディタ/表示に渡す
- `packages/plugin/src/core/bootstrap/builtInAgents.ts` — `CUSTOMIZER_WORKFLOW_PROMPT` を bundle artifact 対応に書き換え (`create_artifact({kind:'kintone-customize-bundle', content:{files:[...]}})` の規約)
- `packages/plugin/src/skills/kintone-customize-js/SKILL.md` — bundle 構造の説明 + multi-file (desktop.js/mobile.js/desktop.css/mobile.css) の関係性追記
- `packages/plugin/src/core/artifacts/download.ts` — bundle artifact の zip ダウンロード (任意、各 file を 1 zip にまとめ)

### 4.2 新規

- `packages/plugin/src/chat/workflow/useCustomizeFiles.ts` — `GET customize.json` を fetch して FileTree 用 entry に整形する hook
- ~~`packages/plugin/src/chat/workflow/previewSandbox.tsx`~~ — **§3.4 確定により不要** (動作テスト環境 URL に飛ばす方式に変更)
- (任意) `packages/plugin/src/chat/workflow/CustomizeFileUploader.ts` — file.json upload ヘルパー

> ※ §3.5 確定により **snapshot 用の専用 kintone アプリ / customizeHistoryRepo は作らない**。Phase 1 は chatStore.workflowHistory (in-memory) のみ、永続化は Phase 2 (#17 GitHub 連携統合時) で対応。

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
- [x] **論点 3.2 — multi-file artifact**: ~~1 artifact = 1 ファイル (案 A)~~ → ✅ FileTree 前提と合致しないため **案 B (bundle artifact、新 kind `kintone-customize-bundle`)** に確定
- [x] **論点 3.4 — preview sandbox**: ~~完全 mock (案 A)~~ → ✅ 実機検証で **案 C (kintone 動作テスト環境 URL を新タブで開く)** に確定。iframe sandbox / mock は実装不要
- [x] **論点 3.5 — rollback**: ~~revert API で snapshot 撤廃 (案 A)~~ → ✅ §2.5.7 で **不可** 確定 → ~~kintone 専用アプリ案 (案 B)~~ → ✅ **2 段階リリース確定** (Phase 1: chatStore in-memory、Phase 2 で #17 GitHub 連携統合時に git repo へ永続化)
- [x] ~~専用アプリの provision~~ → ✅ **論点ごと消滅** (kintone 専用アプリ案を廃止し、永続化は Phase 2 で GitHub 連携と統合する方針)
- [ ] **MVP の段階分割**: bundle artifact 採用後の修正版 — Phase 1 は bundle 構造で実装するが、Agent prompt で desktop.js 1 件だけ生成するよう制約、Phase 2 で multi-file (CSS / mobile.js) 解禁、という段階で進めて良いか
- [ ] **OAuth 再連携 UX**: 既存ユーザに対する追加 scope 取得タイミング (Customizer Agent 初回利用時に prompt? それとも Plugin install 時から)
- [ ] **「キャンセル」ボタンの UX**: 「適用」前に admin が動作テスト環境を見て「やめる」と判断したケースで `POST deploy.json {revert: true}` を呼んで preview を live と同期 (= 編集破棄) するボタンを置くか

---

## 7. 次のステップ

1. **本 requirements.md のユーザーレビュー** — 特に Section 6 の未決事項を確定
2. 確定後 → `design.md` で実装アーキテクチャ詳細 (データフロー / コンポーネント分割 / テスト戦略)
3. design.md 確定後 → `tasklist.md` で Phase 分割
4. 着手
