# ドキュメント同期ポリシー (Sync Docs & Landing)

`scripts/docs-sync-check.sh`（PreToolUse フック / `gh pr create` 検知）が参照する、機能変更に対する
**ドキュメント / ランディングページの同期ルール**。フックは決定的な判定（git diff のパス）のみを行い、
plugin/mcp 変更があって docs/landing 未更新のとき、セッション内の Claude にソフトリマインドを出す。
Claude はこのポリシーに従い、**必要なときだけ**最小限の更新を行う（不要なら更新しない）。

> 旧 `.github/workflows/sync-docs.yml`（GitHub Action）は CI 認証の煩雑さのため廃止し、ローカル
> フックに一本化した。

## 大原則
1. **既定は no-op**。ユーザー向けの挙動・機能・設定・UI が変わっていない PR では何もしない。
2. **機能コードは変更しない**。`packages/plugin/**` / `packages/kintone-mcp/**` は読むだけ。編集対象は
   `docs/**` と `packages/landing/**` のみ。
3. **最小差分**。同期に必要な箇所だけをピンポイントで直す。リライトや体裁の一括変更はしない。
4. **迷ったら控える**。更新が必要か判断がつかないときは編集せず、PR コメントで「要確認: ○○」と指摘する。

## 更新する条件（いずれか該当時）
- **ユーザー向け機能の追加・変更・削除**（新画面、新操作、エージェント/スキル/定期実行などの能力変更）。
- **セットアップ / 設定手順の変更**（Plugin Config、OAuth、Worker デプロイ、必要な権限など）。
- **用語・名称の変更**（UI ラベルやドメイン用語が変わり、ドキュメント/LP の表記と食い違う）。
- **制約・前提の変更**（対応バージョン、上限値、既知の制限）。

### 同期先の対応表
| 変更の種類 | 更新先 |
|---|---|
| プロダクトの機能一覧・要求 | `docs/product-requirements.md` |
| 機能のアーキテクチャ・データモデル・画面遷移 | `docs/functional-design.md` |
| 技術スタック・制約・非機能要件 | `docs/architecture.md` |
| 用語の追加・変更 | `docs/glossary.md` |
| エンドユーザー向けの訴求・説明・ヘルプ文言 | `packages/landing/**`（Astro のコピー / Markdown） |

## やらないこと
- **スクリーンショット・画像の差し替え・生成**は行わない。kintone 実画面のキャプチャが必要な箇所は、
  PR コメントで「要スクショ更新: {対象ページ}」と指摘するに留める。
- **機能コード・テスト・ビルド設定・依存の変更**はしない（これらが対象の PR は基本 no-op）。
- **リファクタ / chore / 内部実装のみの PR** では更新しない（ユーザーから見て何も変わらないため）。
- **`.steering/**` は履歴用なので参照のみ**、編集しない。

## 出力の形式
- **更新が必要な場合**: 該当ファイルを編集し、`docs: sync docs/landing with PR #<番号>` のコミットメッセージで
  PR ブランチにコミットする。何をなぜ更新したかを1〜3行で PR にコメントする。
- **更新が不要な場合**: コミットを一切作らず、PR に `✓ ドキュメント更新は不要（理由: …）` とコメントする。

## 補足
- 文章は既存ドキュメントのトーン・日本語・見出し構造に合わせる。
- LP（`packages/landing`）は Astro。コンポーネント構造を壊さず、テキスト/コピー部分を中心に最小修正する。
- 大きな設計変更で複数ファイルにまたがる場合は、全部を完璧に直そうとせず、確実な箇所を更新し、
  残りは PR コメントで「追加更新候補」として列挙する。

## 有効化（各自ローカル）
`.claude/` は Git 管理外（`.gitignore`）のため、フック登録は各自のローカル設定に入れる
（共有されるのはスクリプト `scripts/docs-sync-check.sh` とこのポリシーのみ。auto-deploy フックと同じ流儀）。
`.claude/settings.json`（または `.claude/settings.local.json`）に以下を追加する:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/scripts/docs-sync-check.sh", "timeout": 10 }
        ]
      }
    ]
  }
}
```

これで `gh pr create` 時に、plugin/mcp 変更があって docs/landing 未更新なら Claude にソフトリマインドが出る。
