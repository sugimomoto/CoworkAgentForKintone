# 要求: ビルトインエージェントのツールドリフト修復 (#86)

## 背景 / 問題
エージェントデザイナー (`purpose=customizer-opus`) に設計を依頼しても、`agent-draft` アーティファクト
+ 作成モーダルが生成されない。実セッションを Managed Agents API で確認した結果、デプロイ済み
デザイナーエージェントに **`propose_agent` ツールが attach されていない**ことが一次原因と確定 (#86)。

コード上は [resolveBuiltInAgents.ts](../../packages/plugin/src/core/bootstrap/resolveBuiltInAgents.ts) で
`propose_agent` は `customizer-opus` に attach される設計だが、bootstrap の find-or-create が
**`promptVersion` 等の metadata 一致で既存エージェントを再利用するだけで tools を更新しない**ため、
propose_agent 未配線の中間ビルドで作られた既存エージェントが永久に再利用され、ツールが修復されない
(= **ツールドリフト**)。

## ユーザーストーリー
- テナント管理者として、エージェントデザイナーに設計を依頼したら作成アーティファクト + 作成モーダルが
  出てほしい。
- 開発者として、ビルトインの tool 構成を変えたら、既存テナントのエージェントにも自動で反映されてほしい
  (promptVersion の手動 bump 忘れで再発させたくない)。

## 受け入れ条件
- [ ] AC-1: 既存テナントのデザイナーエージェントに `propose_agent` が attach され、設計依頼で
  `agent-draft` アーティファクト + 作成モーダルが生成される。
- [ ] AC-2: ビルトインの tool 構成変更が、`promptVersion` 据え置きでも既存エージェントに反映される
  (手動 bump に依存しない構造的な歯止め)。
- [ ] AC-3 (今回見送り): デザイナーが誤って `create_artifact` をエージェント定義の形で呼んでも
  作成経路に乗る防御的フォールバック。→ 別 Issue 化。

## 制約 / 方針 (承認済み)
- 修復メカニズムは **その場修復 (reconcile)**: 既存エージェントの ID を保持したまま `updateAgent` で
  tools を現行 spec に揃える。再作成 (orphan 発生) は採用しない。
- ドリフト検知は **`toolsVersion` 自動ハッシュ**: tool 構成の意味的シグネチャからハッシュを導出し、
  metadata に保存。tool を変えればハッシュが変わり reconcile が走る (bump 忘れ不可)。
- `create_artifact` はデザイナーが svg / kintone-customize-bundle 出力に正当利用しているため**外さない**。
- 既存の挙動 (3 variant 並行 ensure / レース対策 / kintoneDomain 分離) は不変。
