# 設計: ツールドリフト修復 (#86)

## 変更対象
- `packages/plugin/src/core/bootstrap/resolveBuiltInAgents.ts` (中心)
- `packages/plugin/src/core/bootstrap/resolveBuiltInAgents.test.ts` (テスト更新 + 追加)

## アプローチ

### 1. `toolsVersion` の自動導出
tool 構成の**意味的シグネチャ**からハッシュを導出する純関数を追加する。env 依存値 (workerUrl /
kintoneDomain) は filter 側に既にあるため含めない。

```ts
function computeToolsVersion(purpose, spec): string {
  // agent_toolset / create_artifact / (customizer-opus のみ propose_agent) /
  // mcp ツール名 (sorted, 破壊的ツールは "!" 付き) を | 連結してハッシュ
}
function builtInToolsVersion(purpose): string  // = computeToolsVersion(purpose, SPECS[purpose]) — テスト/参照用に export
```

ハッシュは 32bit djb2 → base36 の短い決定的文字列 (`ts_xxxx`)。`Math.random`/`Date` は使わない。

> 意味的シグネチャにしている理由: `buildBuiltInAgentTools` の生 JSON をハッシュすると、出力の
> キー順など見た目だけの変更でも別バージョン扱いになる。tool の**有無と権限ポリシー**だけを捉える。

### 2. 既存エージェントの reconcile
`doResolveBuiltIn` の再利用パスを変更:

```ts
const existing = await findDefaultAgents(filter);
if (existing.length > 0) {
  return reconcileBuiltInAgentTools(pickOldest(existing), purpose, spec, options, toolsVersion);
}
```

`reconcileBuiltInAgentTools`:
- `agent.metadata.toolsVersion === toolsVersion` → 最新。そのまま返す (updateAgent 呼ばない)。
- 不一致 (旧 or 未設定) → `updateAgent(id, { version, tools: buildBuiltInAgentTools(...),
  metadata: { ...agent.metadata, toolsVersion } })` で **tools を上書きパッチ** (ID 保持)。
- 楽観ロック: 409 (`ApiError.status === 409`) なら `retrieveAgent` で取り直し、
  - 既に最新 toolsVersion なら別タブが修復済みとみなしてそれを返す
  - そうでなければ fresh.version で再試行 (最大 3 回)。

`updateAgent` は `tools` と `metadata` のみ送る (system / skills / mcp_servers は据え置き = 部分更新)。
mcp_toolset が参照する mcp server は既存エージェントに既にあるため再送不要。

### 3. 新規作成パス
`fullMetadata` に `toolsVersion` を追加するだけ。新規エージェントは最初から最新の toolsVersion を持つ。

## 影響範囲
- 初回 bootstrap (デプロイ後 1 回) で、既存エージェントの toolsVersion 不一致分だけ updateAgent が走る
  (テナントあたり最大 3 回)。以降は一致するので no-op。
- エージェント ID は変わらない → 過去セッション参照・UI 表示・variantGroup 切替すべて不変。
- 見た目・挙動の変更なし (ツールが正しく揃う = バグ修正のみ)。

## テスト方針
- 既存「再利用 (POST 0 回)」: fixtures の metadata に正しい `toolsVersion` を付与し、no-op 再利用を維持。
- 追加「drift → reconcile」: customizer-opus の既存エージェントが toolsVersion 未設定のとき、
  `/v1/agents/{id}` への updateAgent が呼ばれ、body.tools に `propose_agent` が含まれ、
  body.metadata.toolsVersion が現行値になることを検証。
- 追加「409 → retrieve → 別タブ修復済みで終了」: 409 後の取り直しで最新なら再試行しないこと。
