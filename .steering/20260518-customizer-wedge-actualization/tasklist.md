# Customizer Wedge 実用化 — Tasklist (Phase 1)

> 対応 design: [design.md](./design.md) / requirements: [requirements.md](./requirements.md)
> 各タスクは 1 PR 単位を目安に、関連テストを同 PR に含める。

---

## タスク一覧 (Phase 1)

| # | タスク | サイズ | 依存 | 状態 |
|---|---|---|---|---|
| T1 | ArtifactKind に `kintone-customize-bundle` 追加 + 型定義 | S | — | ✅ `9cee691` |
| T2 | `kintoneCustomizeApi.ts` 本実装 (file.json upload + customize.json PUT + deploy.json + snapshot) + `OAuthScopeError` 定義 | M | T1 | ✅ `1954f0f` |
| T3 | `FileTree.tsx` を hardcoded → props ベースに動的化 | S | T1 | ✅ `3eb8a6f` |
| T4 | `WorkflowFooter.tsx` に [キャンセル] + [動作テスト環境を開く] ボタン追加 | S | — | ✅ `5f12866` |
| T5 | `useApplyWorkflow.ts` に `cancel` callback 追加 + rollback の実 API 化 | S | T2, T4 | ✅ `5f12866` |
| T6 | `ArtifactPane/index.tsx` に kind=bundle 分岐 (CustomizerArtifactView 新規) | M | T1, T3, T4, T5 | ✅ `5118c33` |
| T7 | `builtInAgents.ts` の `CUSTOMIZER_WORKFLOW_PROMPT` を bundle 規約に書き換え (Phase 1 制約含む) | S | T1 | ✅ `a1c95c1` |
| T8 | OAuth scope (`k:app_settings:write` / `k:file:write`) 追加 + 不足検出時の再連携トリガー (V1 #28 再利用) | S | T2 | ✅ `b0d594f` |
| T9 | E2E spec 新規追加 (`e2e/customizer-wedge.spec.ts`) | M | T1〜T8 | ✅ `a35fefb` |
| T10 | リリース確認 (実機 deploy + admin マニュアル更新) | S | T9 | ✅ build 167 |

### 実機テストで判明し追加修正したもの (T1〜T10 と並行)
- `defaultFileUpload` に `X-Requested-With: XMLHttpRequest` ヘッダ追加 (CB_JH01 認証エラー対応) — `532ebb6`
- `bundle.appId` フィールドを追加し host appId と異なる場合の警告バナー対応 — `76f8a4c`
- rollback を「snapshot 書き戻し」から「`cowork-agent-*` FILE entry を除去する逆操作」に再設計 (kintone GC で fileKey 失効する仕様への対応) — `5eb28c7`

---

## 着手順序 (実装計画)

```
ステージ A (基盤): 
  T1 (型) → T7 (prompt) は並列可

ステージ B (API + UI 部品): 
  T2 (kintoneCustomizeApi), T3 (FileTree), T4 (WorkflowFooter) を並列着手可能 (T1 後)

ステージ C (state + 統合): 
  T5 (workflow) → T6 (ArtifactPane)

ステージ D (OAuth + E2E): 
  T8 (OAuth) → T9 (E2E)

ステージ E (リリース):
  T10
```

---

## タスク詳細

### T1: ArtifactKind に `kintone-customize-bundle` 追加

**変更ファイル:**
- `packages/plugin/src/core/artifacts/types.ts`
  - `ArtifactKind` 列挙に `'kintone-customize-bundle'` 追加
  - `CustomizeFilePath` 型 (`'desktop.js' | 'mobile.js' | 'desktop.css' | 'mobile.css'`)
  - `CustomizeBundleContent` 型 (`{ files: Array<{ path, content }> }`)
  - bundle artifact の `getBundleContent` / `setBundleContent` ヘルパー (JSON 文字列 ↔ オブジェクト変換)
- `core/artifacts/download.ts` — bundle artifact の zip ダウンロード追加 (任意、Phase 1 では skip して S サイズ維持)

**テスト:**
- `types.test.ts` で bundle 型の serialize/parse ラウンドトリップ

**受入条件:**
- typecheck pass
- 既存 Artifact 型を壊さない

---

### T2: `kintoneCustomizeApi.ts` 本実装

**変更ファイル:**
- `packages/plugin/src/chat/workflow/kintoneCustomizeApi.ts`
  - V1 の no-op な `buildCustomizeUpdate` を撤廃
  - `previewBundle(args)` / `applyBundle(args)` / `rollback(args)` / `cancelPreview(args)` / `getPreviewUrl(appId)` を実装
  - apply 直前に `GET customize.json` で snapshot を取得し `chatStore.workflowHistory` に保存
  - deploy.json status ポーリング (PROCESSING → SUCCESS/FAIL/CANCEL)
- `packages/plugin/src/chat/workflow/customizeApi/` (新規ディレクトリ) に分割:
  - `fileUpload.ts` — file.json upload ヘルパー
  - `customizeGet.ts` — customize.json GET
  - `customizePut.ts` — customize.json PUT (merge + revision 楽観ロック)
  - `deploy.ts` — deploy.json POST + status ポーリング
- `packages/plugin/src/chat/workflow/OAuthScopeError.ts` 新規 (scope 不足検出用)

**テスト:**
- `kintoneCustomizeApi.test.ts` を mock fetch でフルフロー (preview/apply/rollback/cancel) 網羅
- merge ロジックのテスト (bundle に含まれない既存 entry を保持、置換、追加)
- 楽観ロック失敗 (revision 不一致) で error 返すケース
- OAuthScopeError throw (HTTP 403 + body に scope 不足メッセージ)

**受入条件:**
- vitest pass
- 検証スクリプト `pnpm verify:customize` と同じ REST 経路で動作

---

### T3: `FileTree.tsx` 動的化

**変更ファイル:**
- `packages/plugin/src/chat/workflow/FileTree.tsx`
  - `DEFAULT_CUSTOMIZE_FILES` 撤廃
  - `files` props 必須化、`activeFilePath` props + `onSelect` callback
  - kind バッジ色は既存維持 (js / css / json / md)
  - 変更ステータス計算は `bundle.files` 内 path をすべて `modified` 扱い (Phase 1 単純化)

**テスト:**
- `FileTree.test.tsx` を props ベースに書き換え
- 1 件 file → 1 行表示、activeFilePath ハイライト、onSelect 発火

**受入条件:**
- vitest pass
- 既存 ArtifactPane 表示の hardcoded ダミーモック表示が壊れる前提 (T6 で復旧)

---

### T4: `WorkflowFooter.tsx` ボタン追加

**変更ファイル:**
- `packages/plugin/src/chat/workflow/WorkflowFooter.tsx`
  - [キャンセル] ボタンを `previewed` 状態に追加
  - [動作テスト環境を開く] ボタン (anchor tag) を `previewed` 状態に追加
  - [キャンセル] 押下時の確認ダイアログ (`window.confirm` で十分)

**テスト:**
- `WorkflowFooter.test.tsx` で各 state でボタン表示が正しいか網羅

**受入条件:**
- vitest pass
- 動作テスト環境 URL は props で受ける (Footer は URL を知らない、ArtifactPane が渡す)

---

### T5: `useApplyWorkflow.ts` 拡張

**変更ファイル:**
- `packages/plugin/src/chat/workflow/useApplyWorkflow.ts`
  - `WorkflowCallbacks` に `cancel: () => Promise<void>` 追加
  - state 遷移: `previewed` → `cancel` → `ready` のパス追加 (ALLOWED_TRANSITIONS 拡張)
  - `cancel()` API を public に追加

**テスト:**
- `useApplyWorkflow.test.ts` に cancel テスト追加
- 遷移制限のテスト (cancel が ready / previewed 以外で no-op)

**受入条件:**
- vitest pass

---

### T6: `ArtifactPane/index.tsx` Customizer モード

**変更ファイル:**
- `packages/plugin/src/desktop/components/ArtifactPane/index.tsx`
  - kind=bundle 分岐
- `packages/plugin/src/chat/workflow/CustomizerArtifactView.tsx` (新規)
  - bundle 解析 → FileTree + CodeViewer + WorkflowFooter の 3 ペイン構成
  - activeFilePath state + onSelect で切替
  - kintone appId は `kintone.app.getId()` で取得
  - apiFn は `kintone.api()` を transport 経由でラップ
  - WorkflowCallbacks を `makeKintoneCustomizeWorkflow` で生成

**テスト:**
- `CustomizerArtifactView.test.tsx` 新規: bundle props を渡して FileTree + Editor + Footer の 3 要素が描画される
- ファイル切替で表示 content が変わる
- workflow ボタンクリックで callbacks 発火

**受入条件:**
- vitest pass
- 実機 (Customizer Agent で bundle 生成 → ArtifactPane 表示) で目視確認

---

### T7: Customizer Agent prompt 書き換え

**変更ファイル:**
- `packages/plugin/src/core/bootstrap/builtInAgents.ts`
  - `CUSTOMIZER_WORKFLOW_PROMPT` を bundle 規約 + Phase 1 制約 (desktop.js のみ) に書き換え
  - `promptVersion` を bump (`v20-customizer` → `v21-customizer`) — Agent metadata 変更で新 Agent ensure される

**テスト:**
- `resolveAgent.test.ts` で promptVersion bump → 新 Agent 作成 が走るケース (既存テストで足りるはず)

**受入条件:**
- vitest pass
- 既存 Customizer Agent (v20) は無効化される (新 v21 が ensure される)

---

### T8: OAuth scope 追加 + 再連携トリガー

**変更ファイル:**
- `packages/plugin/src/core/oauth/scope.ts` (or 既存場所) — scope 列挙に `k:app_settings:write` / `k:file:write` 追加
- `packages/plugin/src/chat/workflow/CustomizerArtifactView.tsx` (or useApplyWorkflow 呼出側)
  - `OAuthScopeError` catch → V1 #28 既存の再連携 UX をトリガー
- `Header.tsx` の OAuth 再認可ボタンに Customizer 用 scope を含める (or 別ボタン併設)

**テスト:**
- 既存 OAuth テストに追加 scope のケース
- `CustomizerArtifactView.test.tsx` で `OAuthScopeError` 時の挙動

**受入条件:**
- vitest pass
- 実機で scope 不足エラー → 再連携誘導 → 再連携完了後にプレビュー成功 のフローが動く (テストアプリで検証)

---

### T9: E2E spec

**変更ファイル:**
- `packages/plugin/e2e/customizer-wedge.spec.ts` 新規
  - テストアプリ (KINTONE_TEST_APP_ID) に対して preview → apply → rollback / cancel を実行
  - Agent との会話は **mock** (実 LLM 呼出は避け、bundle artifact を直接 chatStore に注入)
  - 最後に customize.json を空に戻す cleanup

**テスト:**
- E2E pass

**受入条件:**
- `pnpm verify:customize` と同じレベルの実機検証が CI で自動化される

---

### T10: リリース確認

**作業:**
- Plugin Config の OAuth scope 設定確認 (`k:app_settings:write` / `k:file:write` を default scope に追加)
- README / admin マニュアルに Phase 1 制約 (desktop.js のみ / in-memory rollback) を明記
- CHANGELOG 更新
- 実機 deploy (本人環境で動作確認)
- #20 Issue body に「Phase 1 完了」追記

---

## 完了基準 (Phase 1 受け入れ)

- [x] T1〜T8 全 PR がマージ
- [x] vitest 全 pass (758 tests)
- [x] T9 E2E pass (customizer-wedge.spec.ts 5 件)
- [x] 実機で「商談フェーズ=受注 を黄色に」のようなカスタマイズを Agent との会話で生成 → プレビュー → 適用 → ロールバック が動く
- [x] CSS / mobile.js を依頼されると Agent が「Phase 2 で対応予定」と案内する (system prompt v22-customizer で制約)
- [x] OAuth scope 不足の admin が初回利用時に再連携誘導される (withScopeRecovery)

**Phase 1 完了 (2026-05-30、Plugin build 167)**

---

## Phase 2 (本 tasklist の対象外、別 requirements で扱う)

- Customizer Agent prompt の制約解除 (4 path 全て生成可)
- `kintone-customize-js` skill の CSS / mobile.js 指針追加
- #17 GitHub MCP 統合 (snapshot を git commit に永続化)
- rollback を git commit log から復元
