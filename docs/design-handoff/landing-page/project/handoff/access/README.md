# 公開先 (ACL) ピッカー — 実装ハンドオフ

`AgentDetailModal` の「クイックアクション」と「Skills」の間に差し込む **「公開先」セクション** の本実装一式です。
admin が「このエージェントを、どの kintone ユーザーが使えるか」を 3 軸 (ユーザー / グループ / 組織) の
incremental search で設定します。

検討の全体像（4 レイアウト案・マイクロ UX・サマリ 3 案・エッジケース・比較表）は
ルートの **`AccessPicker — UX Exploration.html`**（design canvas）で実際に触れます。

## ファイル

| ファイル | 役割 |
|---|---|
| `accessControl.ts` | 型定義 (`AccessValue` / `AccessEntry` / `AccessSearchFn`) と `formatAccessSummary` 系ヘルパー |
| `AccessPicker.tsx` | 本体。推奨案 A（縦スタック / OR カード）+ 内部小コンポーネント一式 |

## 採用案 — A：縦スタック / OR カード

3 軸を **独立したカードで縦に積み、間に OR バッジ** を挟む構成。最重要視したのは次の 2 点です。

1. **現状把握の一目性** — admin が最初に知りたいのは「いま誰に見えているか」。3 軸を同時に見せ、各カードに
   件数バッジ＋チップを置けばスクロールせず全体像が掴める。最上部のステータスバナーが
   「全員に公開」⇔「指定公開（合計 N 件）」を切り替える。
2. **OR 結合の正しい伝達** — 軸を独立カードに分け、間に OR を挟むことで
   「営業部 OR マネージャー OR 東京営業部」という加算的な結合を構造で示す。

> 不採用：**B タブ**＝隠れる軸が出て一望性が落ちる／**C 横3列**＝680px では各列が窮屈でチップ折返しが崩れる／
> **D 統合検索**＝コンパクトだが軸ごとの OR 構造が見えにくく実装コストも高い。比較表は exploration を参照。

## マイクロ UX の決定

- **検索**：各軸ごとの input。debounce **300ms** で kintone REST を叩き、候補は **最大 10 件**。
- **ドロップダウン**：input 直下に anchored。フォーカス時は空クエリで「候補」を即表示。
- **候補行 / チップ（ユーザー）**：**「名前（メールアドレス）」** 表示（kintone はログイン名＝メアド）。
  `name` に表示名、`code` にメアド（=ログイン名）を入れれば `userLabel()` が自動で `佐藤 健（sato@example.co.jp）` に整形。
  `meta`（候補行の 2 段目）は所属など補助情報のみ。group / org は **タイル + `code · N人` / 階層パス**。
- **チップ**：**name をメイン表示**、`code` は `title`（tooltip）と `aria-label`。× で個別削除。
- **重複防止**：選択済み code は検索の `exclude` に渡し、候補から自動的に外す。
- **キーボード**：`↑/↓` 候補移動・`Enter` 確定・`Esc` クローズ・`Tab` で次の軸へ。
- **大量チップ**：チップ領域は `max-h-[132px]` + 内部スクロール。30 件でもモーダルは伸びない。
- **API エラー**：候補欄にだけエラー＋「再試行」を出し、**選択済みチップは保持**する。

## サマリ表示（AgentsListPane 用）

一覧の狭い列（〜116px）向けに 3 フォーマットを用意。**推奨は案 1**（最短・1 行固定）。

```ts
import { formatAccessSummary, formatAccessFull, accessSummaryParts } from './accessControl';

formatAccessSummary(v); // 案1(推奨): "全員" / "5人" / "5人 +2" / "2グループ +1"
formatAccessFull(v);    // 案2: "全員に公開" / "5人・2グループ・1組織"
accessSummaryParts(v);  // 案3: アイコン+数字描画用の { isOpen, parts:[{kind,n}] }
```

```tsx
// AgentsListPane の行に 1 列追加する例（案 1）
<td className="text-[11.5px] text-muted">{formatAccessSummary(agent)}</td>
```

## 組み込み手順

1. `AgentDetailModal` の「クイックアクション」セクションの直後に、既存と同じ `<h3>` 見出し＋中身の形で差し込む：

```tsx
import { AccessPicker } from './access/AccessPicker';
import type { AccessValue, AccessEntry } from './access/accessControl';

// agent.allowedUsers / allowedGroups / allowedOrganizations を value にまとめる
const access: AccessValue = {
  allowedUsers: agent.allowedUsers,
  allowedGroups: agent.allowedGroups,
  allowedOrganizations: agent.allowedOrganizations,
};

<section>
  <h3 className="mb-2 text-[11.5px] font-bold tracking-wide text-text">公開先</h3>
  <AccessPicker
    value={access}
    onChange={(next) => setAgent({ ...agent, ...next })}
    searchUsers={searchUsers}
    searchGroups={searchGroups}
    searchOrganizations={searchOrganizations}
    resolveEntries={resolveEntries} // 任意：既存 code の name 解決
  />
</section>
```

2. **検索関数** は kintone REST を `AccessSearchFn` 形に正規化して渡す（user/group/organization の
   `code` と表示名 `name`、補助情報 `meta` に詰める）：

```ts
const searchUsers: AccessSearchFn = async (query, { exclude }) => {
  // GET /v1/users.json 等 → AccessEntry[] へ (code = ログイン名 = メアド)
  const res = await kintoneDirectory.users(query);
  return res
    .filter((u) => !exclude.includes(u.code))
    .slice(0, 10)
    .map((u) => ({ code: u.code, name: u.name, meta: u.org ?? '' }));
  // 表示は userLabel() が 「名前（code）」に整形する
};
// searchGroups: meta = `${code} · ${memberCount}人`
// searchOrganizations: meta = 階層パス
```

3. **初期チップの名前解決**（任意）：保存済みは `code` のみのため、`resolveEntries(kind, codes)` を渡すと
   開いた瞬間に表示名へ解決します。未指定でも動作しますが、解決前は `code` がチップに出ます。

## スタイル方針（既存トークン）

ハードコード `teal-*` 等は使わず、既存トークン経由で着色しています。前提クラス：

```
bg-card / bg-card-hi / border-card-border / border-border
text-text / text-muted / text-subtle
bg-accent / bg-accent-soft / text-accent / text-on-accent / ring-accent
```

- **角丸 10〜12px / 影は最小限・境界線で領域分け / 本文 12.5px**（既存 Settings と同一トーン）。
- **軸の識別色** だけは Tailwind class で表現せず、`AXES[].tint` を CSS 変数 `--axis` で渡し
  arbitrary value（`bg-[var(--axis)]/10` 等）で着色。user = `--color-accent`、group / org は彩度を抑えた
  業務トーン（`#7c6aa8` / `#2f6f9f`）。色を増やしたくなければ group / org も `--color-accent` や中立色に
  変更可。`--color-warn`（既定 `#b45309`）はエラー表示に使用。

## エッジケース（実装済み）

| ケース | 挙動 |
|---|---|
| 3 軸すべて空 | 最上部に globe + 「全員に公開」を明示。OR コネクタは非アクティブ表示 |
| 1 軸に大量（例 30 人） | チップ領域 `max-h` + 内部スクロール。モーダルは伸びない |
| バランス型（各 5〜10） | ステータスが「指定公開・合計 N 件」＋各軸サマリへ切替 |
| API エラー | 候補欄にエラー＋再試行。入力済みチップは保持 |
| 選択済みの再表示 | `exclude` で候補から自動除外（重複防止） |

## 注意 / 今後

- i18n 未対応（日本語のみ）。文言は `AccessPicker.tsx` / `accessControl.ts` 内に直書き。
- 推奨上限は 3 軸合計 50 entry。UI は破綻しないが、超大量指定が常用される場合は
  「組織で指定」への誘導コピー追加を検討。
